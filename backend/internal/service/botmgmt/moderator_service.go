package botmgmt

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"
	_ "time/tzdata"
	"unicode"
	"unicode/utf8"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"

	"github.com/google/uuid"

	"log/slog"
	"net/http"

	"golang.org/x/sync/singleflight"
)

var (
	linkRegex        = regexp.MustCompile(`(?i)(https?://|t\.me/|t\.co/|tg://|www\.)`)
	domainRegex      = regexp.MustCompile(`(?i)\b[\w-]+\.(com|net|org|co|info|biz|me|io|tv|cc|us|uk|ca|de|fr|ir|xyz|site|online|tech|app|top|link|club|store|ru|cn|in|gov|edu)\b`)
	usernameRegex    = regexp.MustCompile(`(?i)(^|\s)@[a-z][a-z0-9_]{3,24}\b`)
	phoneNumberRegex = regexp.MustCompile(`(?i)(?:(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{7,15}|09\d{9})`)
)

type clientCacheItem struct {
	client   *telegram.BotAPIClient
	lastUsed time.Time
}

type botClientCache struct {
	mu      sync.RWMutex
	items   map[uuid.UUID]*clientCacheItem
	maxSize int
}

func newBotClientCache(maxSize int) *botClientCache {
	c := &botClientCache{
		items:   make(map[uuid.UUID]*clientCacheItem),
		maxSize: maxSize,
	}
	go c.cleanupLoop(2*time.Hour, 10*time.Minute)
	return c
}

func (c *botClientCache) Load(botID uuid.UUID) (*telegram.BotAPIClient, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	item, ok := c.items[botID]
	if ok {
		item.lastUsed = time.Now()
		return item.client, true
	}
	return nil, false
}

func (c *botClientCache) Store(botID uuid.UUID, client *telegram.BotAPIClient) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if len(c.items) >= c.maxSize {
		var oldestID uuid.UUID
		var oldestTime time.Time
		first := true
		for id, item := range c.items {
			if first || item.lastUsed.Before(oldestTime) {
				oldestID = id
				oldestTime = item.lastUsed
				first = false
			}
		}
		if !first {
			delete(c.items, oldestID)
		}
	}

	c.items[botID] = &clientCacheItem{
		client:   client,
		lastUsed: time.Now(),
	}
}

func (c *botClientCache) Delete(botID uuid.UUID) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.items, botID)
}

func (c *botClientCache) cleanupLoop(ttl time.Duration, interval time.Duration) {
	ticker := time.NewTicker(interval)
	for range ticker.C {
		c.mu.Lock()
		now := time.Now()
		for id, item := range c.items {
			if now.Sub(item.lastUsed) > ttl {
				delete(c.items, id)
			}
		}
		c.mu.Unlock()
	}
}

// ModeratorService handles real-time group moderation logic.
type ModeratorService struct {
	settingsRepo  *repository.SettingsRepo
	botRepo       *repository.BotRepo
	auditRepo     *repository.AuditRepo
	analyticsRepo *repository.AnalyticsRepo
	cache         *repository.Cache
	clientCache   *botClientCache // Cap memory leak with custom self-cleaning cache
	sf            singleflight.Group
	httpClient    *http.Client
}

func NewModeratorService(
	settingsRepo *repository.SettingsRepo,
	botRepo *repository.BotRepo,
	auditRepo *repository.AuditRepo,
	analyticsRepo *repository.AnalyticsRepo,
	cache *repository.Cache,
) *ModeratorService {
	return &ModeratorService{
		settingsRepo:  settingsRepo,
		botRepo:       botRepo,
		auditRepo:     auditRepo,
		analyticsRepo: analyticsRepo,
		cache:         cache,
		clientCache:   newBotClientCache(1000),
		httpClient: &http.Client{
			Timeout: 3 * time.Second,
		},
	}
}

func (s *ModeratorService) GetCache() *repository.Cache {
	return s.cache
}

func (s *ModeratorService) GetAnalyticsRepo() *repository.AnalyticsRepo {
	return s.analyticsRepo
}

func (s *ModeratorService) GetSettings(ctx context.Context, groupID uuid.UUID) (*repository.GroupSettings, error) {
	return s.settingsRepo.GetSettings(ctx, groupID)
}

func (s *ModeratorService) GetSettingsRepo() *repository.SettingsRepo {
	return s.settingsRepo
}

func (s *ModeratorService) ForceUpdateCategory(ctx context.Context, groupID uuid.UUID, category string, data json.RawMessage) error {
	return s.settingsRepo.ForceUpdateCategory(ctx, groupID, category, data)
}

func (s *ModeratorService) LogMemberEvent(ctx context.Context, groupID uuid.UUID, eventType string, userID *int64) {
	if s.analyticsRepo != nil {
		_ = s.analyticsRepo.LogEvent(ctx, &repository.GroupEvent{
			GroupID:   groupID,
			EventType: eventType,
			UserID:    userID,
		})
	}

	if eventType == "member_join" && s.cache != nil && s.cache.Client != nil {
		s.checkAntiRaid(ctx, groupID)
	}
}

func (s *ModeratorService) checkAntiRaid(ctx context.Context, groupID uuid.UUID) {
	group, err := s.botRepo.GetGroupByID(ctx, groupID)
	if err != nil {
		return
	}
	if !s.IsSubscriptionValid(group) {
		return
	}

	settings, err := s.settingsRepo.GetSettings(ctx, groupID)
	if err != nil {
		return
	}
	var gen repository.SettingsGeneral
	if json.Unmarshal(settings.General, &gen) != nil || gen.AntiRaidThreshold <= 0 {
		return
	}

	key := fmt.Sprintf("joins_per_min:%s", groupID)
	count, _ := s.cache.Client.Incr(ctx, key).Result()
	if count == 1 {
		s.cache.Client.Expire(ctx, key, 1*time.Minute)
	} else {
		// Recovery check: if key somehow lost its TTL due to a Redis glitch, restore it
		ttl, _ := s.cache.Client.TTL(ctx, key).Result()
		if ttl == -1 {
			s.cache.Client.Expire(ctx, key, 1*time.Minute)
		}
	}

	if int(count) >= gen.AntiRaidThreshold {
		if gen.AntiRaidAction == "lockdown" {
			// Trigger Emergency Lock
			var qh repository.SettingsQuietHours
			json.Unmarshal(settings.QuietHours, &qh)
			if !qh.EmergencyLock {
				qh.EmergencyLock = true
				raw, _ := json.Marshal(qh)
				_ = s.settingsRepo.ForceUpdateQuietHours(ctx, groupID, raw)
				slog.Info("ANTI-RAID TRIGGERED for group. Lockdown enabled.", "group_id", groupID)
			}
		} else if gen.AntiRaidAction == "alert" {
			alertKey := fmt.Sprintf("anti_raid_alert:%s", groupID)
			if set, _ := s.cache.Client.SetNX(ctx, alertKey, "1", 1*time.Minute).Result(); set {
				bot, err := s.botRepo.GetBotByID(ctx, group.BotID)
				if err == nil && bot != nil {
					tgClient, tgErr := s.GetTelegramClient(ctx, bot)
					if tgErr == nil {
						targetUserID := bot.OwnerUserID
						if group.ConnectedByUserID != nil {
							targetUserID = *group.ConnectedByUserID
						}
						alertMsg := fmt.Sprintf("🚨 <b>Anti-Raid Alert:</b> High join activity in <b>%s</b> (%d joins in 1 minute).", telegram.EscapeHTML(group.ChatTitle), count)
						_ = tgClient.SendMessage(ctx, targetUserID, alertMsg, nil, nil)
						_ = tgClient.SendMessage(ctx, group.ChatID, alertMsg, nil, nil)
					}
				}
				slog.Info("ANTI-RAID ALERT TRIGGERED for group", "group_id", groupID, "count", count)
			}
		}
	}
}

// SyncNativeChatPermissions synchronizes Always restrictions with Telegram's native setChatPermissions
func (s *ModeratorService) SyncNativeChatPermissions(ctx context.Context, bot *repository.ManagedBot, groupID uuid.UUID, content *repository.SettingsContentRestrictions) error {
	if content == nil {
		return nil
	}
	group, err := s.botRepo.GetGroupByID(ctx, groupID)
	if err != nil || group == nil {
		return err
	}
	tgClient, err := s.GetTelegramClient(ctx, bot)
	if err != nil {
		return err
	}

	canSendAudios := !(content.BlockAudio.Enabled && content.BlockAudio.Window == "Always")
	canSendDocs := !(content.BlockFiles.Enabled && content.BlockFiles.Window == "Always")
	canSendPhotos := !(content.BlockPhotos.Enabled && content.BlockPhotos.Window == "Always")
	canSendVideos := !(content.BlockGifs.Enabled && content.BlockGifs.Window == "Always")
	canSendVoice := !(content.BlockVoiceMessages.Enabled && content.BlockVoiceMessages.Window == "Always")
	canSendPolls := !(content.BlockPolls.Enabled && content.BlockPolls.Window == "Always")
	canSendOther := !(content.BlockStickers.Enabled && content.BlockStickers.Window == "Always")
	canAddPreviews := !(content.RemoveLinks.Enabled && content.RemoveLinks.Window == "Always")
	bTrue := true

	perms := telegram.ChatPermissions{
		CanSendMessages:       &bTrue,
		CanSendAudios:         &canSendAudios,
		CanSendDocuments:      &canSendDocs,
		CanSendPhotos:         &canSendPhotos,
		CanSendVideos:         &canSendVideos,
		CanSendVideoNotes:     &canSendVideos,
		CanSendVoiceNotes:     &canSendVoice,
		CanSendPolls:          &canSendPolls,
		CanSendOtherMessages:  &canSendOther,
		CanAddWebPagePreviews: &canAddPreviews,
		CanChangeInfo:         &bTrue,
		CanInviteUsers:        &bTrue,
		CanPinMessages:        &bTrue,
		CanManageTopics:       &bTrue,
	}

	err = tgClient.SetChatPermissions(ctx, group.ChatID, perms, true)
	if err != nil {
	} else {
		slog.Info("Successfully synced native chat permissions with Telegram", "chat_id", group.ChatID)
	}
	return nil
}

// Violation represents a detected rule violation.
type Violation struct {
	Type             string
	Message          string
	Action           string // delete, mute, kick, ban
	CurrentWarnings  int
	WarningThreshold int
	OriginalText     string // Raw text of violating message for rescue DM
}

// MessageContext holds all Telegram message metadata needed for moderation.
type MessageContext struct {
	ChatID             int64
	UserID             int64
	MessageID          int
	Date               int // Unix timestamp of the message
	Text               string
	Username           string // @username
	FirstName          string // user's first name
	IsBot              bool
	HasPhoto           bool
	HasSticker         bool
	HasLocation        bool
	HasAudio           bool
	HasVoice           bool
	HasDocument        bool
	HasAnimation       bool // GIF
	HasVideo           bool
	HasPoll            bool
	HasGame            bool
	HasCaption         bool
	Caption            string
	IsForward          bool
	ForwardFromChannel bool
	ForwardFromChatID  int64
	HasInlineKeyboard  bool
	HasReply           bool
	IsReplyToCrossChat bool
	// Bot API 9.5-era additions for the /tag command and topic-aware replies.
	ReplyToUserID    int64 // 0 when HasReply is false or sender is unknown
	MessageThreadID  *int
	IsTopicMessage   bool // Bot API: message belongs to a forum topic
	HasViaBot        bool // sent via inline bot / mini app
	IsCommand        bool // starts with /
	HasTextLinks       bool
	TextLinks          []string
}

// ValidateMessage checks a message against all configured rules.
func (s *ModeratorService) ValidateMessage(ctx context.Context, bot *repository.ManagedBot, mc *MessageContext) (*Violation, error) {
	// 1. Resolve internal group and bot
	group, err := s.botRepo.GetGroup(ctx, bot.ID, mc.ChatID)
	if err != nil {
		return nil, nil // Group not managed
	}

	tgClient, err := s.GetTelegramClient(ctx, bot)
	if err != nil {
		return nil, err
	}

	// 2.1 Check Bot Status (BUG #11)
	if bot.Status != "active" {
		return nil, nil // Bot is paused or revoked
	}

	// 2.2 Check Subscription
	if !s.IsSubscriptionValid(group) {
		slog.Warn("Group subscription expired, pausing moderation", "group_id", group.ID)

		// Bot MUST remain completely silent in the group when subscription is expired.
		// Notify the bot owner / group connector in private chat (PV) once per 24 hours.
		if s.cache != nil && s.cache.Client != nil {
			notifyKey := fmt.Sprintf("subscription_expired_notify:%s", group.ID)
			if set, _ := s.cache.Client.SetNX(ctx, notifyKey, "1", 24*time.Hour).Result(); set {
				msg := "⚠️ <b>Group Subscription Expired</b>\n\nModeration features are currently paused for group: <b>" + group.ChatTitle + "</b> because its subscription has expired. Please renew in the dashboard."
				targetUserID := bot.OwnerUserID
				if group.ConnectedByUserID != nil {
					targetUserID = *group.ConnectedByUserID
				}
				_ = tgClient.SendMessage(ctx, targetUserID, msg, nil, nil)
			}
		}

		return nil, nil // Halt moderation; don't give premium features for free
	}

	// 3. Fetch settings (cached via SettingsRepo)
	settings, err := s.settingsRepo.GetSettings(ctx, group.ID)
	if err != nil {
		return nil, err
	}

	// 3. Parse all categories
	var general repository.SettingsGeneral
	var content repository.SettingsContentRestrictions
	var limits repository.SettingsLimits
	var quiet repository.SettingsQuietHours
	var mandatory repository.SettingsMandatoryMembership

	if err := json.Unmarshal(settings.ContentRestrictions, &content); err != nil {
		content = repository.SettingsContentRestrictions{}
	}
	if err := json.Unmarshal(settings.Limits, &limits); err != nil {
		limits = repository.SettingsLimits{}
	}
	if err := json.Unmarshal(settings.QuietHours, &quiet); err != nil {
		quiet = repository.SettingsQuietHours{}
	}
	if err := json.Unmarshal(settings.MandatoryMembership, &mandatory); err != nil {
		mandatory = repository.SettingsMandatoryMembership{}
	}
	if err := json.Unmarshal(settings.General, &general); err != nil {
		general = repository.SettingsGeneral{}
	}
	var customTexts repository.SettingsCustomTexts
	if err := json.Unmarshal(settings.CustomTexts, &customTexts); err != nil {
		customTexts = repository.SettingsCustomTexts{}
	}

	// 4. Log message event for analytics
	s.logEvent(ctx, group.ID, "message", &mc.UserID, mc.Username)

	// 5. Check if user is admin
	isAdmin := false
	status, _ := s.GetChatMemberCached(ctx, tgClient, mc.ChatID, mc.UserID)
	if status == "administrator" || status == "creator" {
		isAdmin = true
	}

	rawMsgText := mc.Text
	if rawMsgText == "" {
		rawMsgText = mc.Caption
	}

	if isAdmin && !general.TrackAdmin {
		// Admins bypass everything EXCEPT emergency lock if AdminOverride is false
		if quiet.EmergencyLock && !quiet.AdminOverride {
			return &Violation{Type: "quiet_hours", Message: "Emergency Lock active", Action: "delete", OriginalText: rawMsgText}, nil
		}
		return nil, nil
	}

	checkFreshAdmin := func(v *Violation, err error) (*Violation, error) {
		if err != nil || v == nil {
			return v, err
		}

		if v.OriginalText == "" {
			v.OriginalText = rawMsgText
		}

		if v.Message != "" {
			v.Message = strings.ReplaceAll(v.Message, "{first_name}", telegram.EscapeHTML(mc.FirstName))
			if mc.Username != "" {
				v.Message = strings.ReplaceAll(v.Message, "{username}", "@"+telegram.EscapeHTML(mc.Username))
			} else {
				v.Message = strings.ReplaceAll(v.Message, "{username}", telegram.EscapeHTML(mc.FirstName))
			}

			rulesText := customTexts.RulesText
			if rulesText == "" {
				rulesText = "📜 <b>Rules</b>: Respect others • No spam or links"
			}
			v.Message = strings.ReplaceAll(v.Message, "{rules}", rulesText)
		}

		if isAdmin {
			return v, err
		}
		freshStatus, errFresh := tgClient.GetChatMember(ctx, mc.ChatID, mc.UserID)
		if errFresh == nil && (freshStatus == "administrator" || freshStatus == "creator") {
			// Update the cache immediately to prevent subsequent API hits
			if s.cache != nil && s.cache.Client != nil {
				key := fmt.Sprintf("chat_member:%v:%d", mc.ChatID, mc.UserID)
				s.cache.Client.Set(ctx, key, freshStatus, 5*time.Minute)
			}
			isAdmin = true
			if !general.TrackAdmin {
				if quiet.EmergencyLock && !quiet.AdminOverride {
					v.Action = "delete"
					return v, nil
				}
				return nil, nil
			}
			v.Action = "delete"
			return v, nil
		}
		return v, err
	}

	// CAS (Combot Anti-Spam) Check
	if general.CasEnabled {
		if s.checkCAS(ctx, mc.UserID) {
			vAction := "ban"
			if isAdmin {
				vAction = "delete"
			}
			return checkFreshAdmin(&Violation{
				Type:    "cas_ban",
				Action:  vAction,
				Message: "Banned by Combot Anti-Spam (CAS)",
			}, nil)
		}
	}

	// 6. Check exemptions list (usernames or IDs)
	isExempt := false
	for _, ex := range mandatory.Exemptions {
		if strings.HasPrefix(ex, "@") {
			if mc.Username != "" && strings.EqualFold(mc.Username, strings.TrimPrefix(ex, "@")) {
				isExempt = true
				break
			}
			continue
		}
		if fmt.Sprintf("%d", mc.UserID) == ex {
			isExempt = true
			break
		}
	}
	if isExempt {
		return nil, nil
	}

	// 7. Emergency Lock / Quiet Hours
	if s.isQuietHours(quiet, general.Timezone, mc.Date) {
		vAction := s.ResolveAction(general.DefaultPenalty)
		if isAdmin {
			vAction = "delete"
		}
		return checkFreshAdmin(&Violation{Type: "quiet_hours", Message: "Group is in quiet mode", Action: vAction}, nil)
	}

	// 8. Mandatory Membership (Force Join)
	if v := s.checkMandatoryMembership(ctx, tgClient, mc, mandatory, settings.CustomTexts); v != nil {
		s.logEvent(ctx, group.ID, "spam_blocked", &mc.UserID, mc.Username)
		if isAdmin {
			v.Action = "delete"
		}
		return checkFreshAdmin(v, nil)
	}

	// 8.5 Forced Add Members Check (exempt admins)
	if mandatory.ForcedAddEnabled && mandatory.ForcedAddCount > 0 && !isAdmin {
		inviteCount := 0
		if s.cache != nil && s.cache.Client != nil {
			key := fmt.Sprintf("invites:%s:%d", group.ID, mc.UserID)
			val, _ := s.cache.Client.Get(ctx, key).Result()
			if val != "" {
				fmt.Sscanf(val, "%d", &inviteCount)
			}
		}
		if inviteCount < mandatory.ForcedAddCount {
			var ct repository.SettingsCustomTexts
			_ = json.Unmarshal(settings.CustomTexts, &ct)

			forceAddMsg := ct.ForceAddText
			if forceAddMsg == "" {
				forceAddMsg = fmt.Sprintf("You must add %d members to the group before you can send messages.", mandatory.ForcedAddCount)
			} else {
				forceAddMsg = strings.ReplaceAll(forceAddMsg, "{count}", fmt.Sprintf("%d", mandatory.ForcedAddCount))
			}

			vAction := "delete"
			return checkFreshAdmin(&Violation{
				Type:    "forced_add",
				Message: forceAddMsg,
				Action:  vAction,
			}, nil)
		}
	}

	// 9. Content Restrictions — ALL checks
	if v := s.checkAllContent(content, quiet, general, mc); v != nil {
		s.logEvent(ctx, group.ID, "spam_blocked", &mc.UserID, mc.Username)
		var ct repository.SettingsCustomTexts
		json.Unmarshal(settings.CustomTexts, &ct)
		resViolation, err := s.handleAutoWarning(ctx, group.ID, mc.UserID, general, ct, v)
		if resViolation != nil && isAdmin {
			resViolation.Action = "delete"
		}
		return checkFreshAdmin(resViolation, err)
	}

	// 10. Limits — length, flood, duplicates
	if v := s.checkAllLimits(ctx, limits, mc, group.ID.String()); v != nil {
		s.logEvent(ctx, group.ID, "spam_blocked", &mc.UserID, mc.Username)
		if v.Action == "" {
			v.Action = s.ResolveAction(general.DefaultPenalty)
		}
		var ct repository.SettingsCustomTexts
		json.Unmarshal(settings.CustomTexts, &ct)
		resViolation, err := s.handleAutoWarning(ctx, group.ID, mc.UserID, general, ct, v)
		if resViolation != nil && isAdmin {
			resViolation.Action = "delete"
		}
		return checkFreshAdmin(resViolation, err)
	}

	return nil, nil
}

func (s *ModeratorService) checkCAS(ctx context.Context, userID int64) bool {
	// Cache CAS results for 24h (or 10m on API outage)
	cacheKey := fmt.Sprintf("cas:%d", userID)
	if s.cache != nil && s.cache.Client != nil {
		if val, _ := s.cache.Client.Get(ctx, cacheKey).Result(); val != "" {
			if val == "failed_bypass" {
				return false
			}
			return val == "banned"
		}
	}

	url := fmt.Sprintf("https://api.cas.chat/check?user_id=%d", userID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return false
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		// Negative caching: Cache failures for 10 minutes to protect pool from thread starvation DoS
		if s.cache != nil && s.cache.Client != nil {
			s.cache.Client.Set(ctx, cacheKey, "failed_bypass", 10*time.Minute)
		}
		return false
	}
	defer resp.Body.Close()

	var result struct {
		OK bool `json:"ok"`
	}
	if json.NewDecoder(resp.Body).Decode(&result) == nil {
		status := "ok"
		if result.OK {
			status = "banned"
		}
		if s.cache != nil && s.cache.Client != nil {
			s.cache.Client.Set(ctx, cacheKey, status, 24*time.Hour)
		}
		return result.OK
	} else {
		// Cache malformed payload response as failed bypass as well
		if s.cache != nil && s.cache.Client != nil {
			s.cache.Client.Set(ctx, cacheKey, "failed_bypass", 10*time.Minute)
		}
	}
	return false
}

func (s *ModeratorService) AnswerCallbackQuery(ctx context.Context, bot *repository.ManagedBot, queryID string, text string, showAlert bool) error {
	tg, err := s.GetTelegramClient(ctx, bot)
	if err != nil {
		return err
	}
	return tg.AnswerCallbackQuery(ctx, queryID, text, showAlert)
}

func (s *ModeratorService) GetTelegramClient(ctx context.Context, bot *repository.ManagedBot) (*telegram.BotAPIClient, error) {
	if client, ok := s.clientCache.Load(bot.ID); ok {
		return client, nil
	}

	token, err := DecryptToken(bot.BotTokenEncrypted)
	if err != nil {
		return nil, err
	}

	client := telegram.NewBotAPIClient(token)
	s.clientCache.Store(bot.ID, client)
	return client, nil
}

// EvictStaleBotClient removes a bot client from the memory cache when its token is rotated or when it is deleted
func (s *ModeratorService) EvictStaleBotClient(botID uuid.UUID) {
	s.clientCache.Delete(botID)
	slog.Info("Successfully evicted stale client from moderator client cache", "bot_id", botID)
}

// ─── Quiet Hours ──────────────────────────────────────────

func parseHHMM(s string) (int, bool) {
	var h, m int
	if n, err := fmt.Sscanf(s, "%d:%d", &h, &m); err != nil || n != 2 {
		return 0, false
	}
	if h < 0 || h > 23 || m < 0 || m > 59 {
		return 0, false
	}
	return h*60 + m, true
}

func (s *ModeratorService) isQuietHours(q repository.SettingsQuietHours, tz string, msgDate int) bool {
	if q.EmergencyLock {
		return true
	}
	if len(q.Periods) == 0 {
		return false
	}

	loc, err := time.LoadLocation(tz)
	if err != nil {
		loc = time.UTC
	}

	var now time.Time
	if msgDate > 0 {
		now = time.Unix(int64(msgDate), 0).In(loc)
	} else {
		now = time.Now().In(loc)
	}

	nowMinutes := now.Hour()*60 + now.Minute()

	for _, p := range q.Periods {
		startMin, ok1 := parseHHMM(p.Start)
		endMin, ok2 := parseHHMM(p.End)
		if !ok1 || !ok2 {
			continue
		}

		if startMin < endMin {
			if nowMinutes >= startMin && nowMinutes < endMin {
				return true
			}
		} else {
			// Crosses midnight (e.g. 23:00 → 07:00)
			if nowMinutes >= startMin || nowMinutes < endMin {
				return true
			}
		}
	}
	return false
}

func IsSubscriptionValid(g *repository.ManagedGroup) bool {
	if g == nil || g.SubscriptionStatus == "expired" {
		return false
	}
	now := time.Now()
	// If paid period exists and is in the future
	if g.PaidUntil != nil && now.Before(*g.PaidUntil) {
		return true
	}
	// Otherwise check trial
	return now.Before(g.TrialEndsAt)
}

func (s *ModeratorService) IsSubscriptionValid(g *repository.ManagedGroup) bool {
	return IsSubscriptionValid(g)
}

// ─── Mandatory Membership ─────────────────────────────────

func (s *ModeratorService) checkMandatoryMembership(ctx context.Context, tg *telegram.BotAPIClient, mc *MessageContext, m repository.SettingsMandatoryMembership, customTextsRaw json.RawMessage) *Violation {
	if !m.ForceJoinEnabled || len(m.RequiredChannels) == 0 {
		return nil
	}

	var ct repository.SettingsCustomTexts
	json.Unmarshal(customTextsRaw, &ct)

	for _, channel := range m.RequiredChannels {
		channelID := channel
		if !strings.HasPrefix(channel, "@") && !strings.HasPrefix(channel, "-100") {
			channelID = "@" + channel
		}

		status, err := s.GetChatMemberCached(ctx, tg, channelID, mc.UserID)
		if err != nil {
			slog.Warn("Failed to check mandatory membership, failing open", "channel", channelID, "user", mc.UserID, "error", err)
			continue
		}

		if status == "left" || status == "kicked" || status == "" {
			msg := ct.ForceJoinText
			if msg == "" {
				msg = fmt.Sprintf("You must join %s first", channel)
			}
			return &Violation{
				Type:    "mandatory_membership",
				Message: msg,
				Action:  "delete",
			}
		}
	}
	return nil
}

// GetChatMemberCached fetches chat member status with Redis caching (BUG #5)
func (s *ModeratorService) GetChatMemberCached(ctx context.Context, tg *telegram.BotAPIClient, chatID interface{}, userID int64) (string, error) {
	if s.cache == nil || s.cache.Client == nil {
		return tg.GetChatMember(ctx, chatID, userID)
	}

	key := fmt.Sprintf("chat_member:%v:%d", chatID, userID)
	status, err := s.cache.Client.Get(ctx, key).Result()
	if err == nil {
		return status, nil
	}

	status, err = tg.GetChatMember(ctx, chatID, userID)
	if err != nil {
		return "", err
	}

	// High-privilege admin/owner statuses cached for only 15 seconds to mitigate demotion exploit window
	ttl := 5 * time.Minute
	switch status {
	case "administrator", "creator":
		ttl = 15 * time.Second
	case "left", "kicked", "":
		// Short TTL for non-members so they aren't blocked for 5 minutes after joining
		ttl = 15 * time.Second
	}
	s.cache.Client.Set(ctx, key, status, ttl)
	return status, nil
}

// ─── Content Restrictions ─────────────────────────────────

func (s *ModeratorService) checkAllContent(c repository.SettingsContentRestrictions, quiet repository.SettingsQuietHours, general repository.SettingsGeneral, mc *MessageContext) *Violation {
	text := mc.Text
	if text == "" {
		text = mc.Caption
	}

	// ── Rules Wrapper ──
	check := func(rd repository.RestrictionDetail, violated bool, vType, vMsg string) *Violation {
		if !violated {
			return nil
		}
		if s.shouldBlock(rd, quiet, general.Timezone, mc.Date) {
			penalty := rd.Penalty
			if penalty == "" || penalty == "default" {
				penalty = general.DefaultPenalty
			}
			return &Violation{Type: vType, Message: vMsg, Action: s.ResolveAction(penalty)}
		}
		return nil
	}

	// 1. CHEAP boolean/interaction checks FIRST (no regex, no string allocation/traversal)
	if v := check(c.BlockBots, mc.IsBot, "bot_blocked", "Bots are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockPhotos, mc.HasPhoto, "photo", "Photos are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockStickers, mc.HasSticker, "sticker", "Stickers are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockLocations, mc.HasLocation, "location", "Locations are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockAudio, mc.HasAudio, "audio", "Audio files are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockVoiceMessages, mc.HasVoice, "voice", "Voice messages are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockFiles, mc.HasDocument, "file", "Files are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockGifs, mc.HasAnimation, "gif", "GIFs are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockPolls, mc.HasPoll, "poll", "Polls are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockGames, mc.HasGame, "game", "Games are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockSlashCommands, mc.IsCommand, "slash_command", "Slash commands are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockUserReplies, mc.HasReply, "reply", "Replies are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockCrossChatReplies, mc.IsReplyToCrossChat, "cross_chat_reply", "Cross-chat replies are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockAppMessages, mc.HasViaBot, "app_message", "Mini App messages are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockInlineKeyboards, mc.HasInlineKeyboard, "inline_keyboard", "Inline keyboards are not allowed"); v != nil {
		return v
	}
	if v := check(c.BlockCaptionless, (mc.HasPhoto || mc.HasVideo) && !mc.HasCaption, "captionless", "Media without caption is not allowed"); v != nil {
		return v
	}

	isWhitelisted := false
	if mc.IsForward && mc.ForwardFromChatID != 0 {
		for _, wID := range c.ForwardWhitelist {
			if wID == fmt.Sprintf("%d", mc.ForwardFromChatID) {
				isWhitelisted = true
				break
			}
		}
	}
	if v := check(c.BlockForwards, mc.IsForward && !isWhitelisted, "forward", "Forwarded messages are not allowed"); v != nil {
		return v
	}
	if v := check(c.RestrictChannelForwards, mc.ForwardFromChannel && !isWhitelisted, "channel_forward", "Forwards from channels are not allowed"); v != nil {
		return v
	}

	// 2. EXPENSIVE text scans ONLY if text/caption is not empty
	hasViolatedLink := false
	if text != "" {
		hasViolatedLink = linkRegex.MatchString(text)
	}
	if !hasViolatedLink && mc.HasTextLinks {
		hasViolatedLink = true
	}
	if v := check(c.RemoveLinks, hasViolatedLink, "link", "Links are not allowed"); v != nil {
		return v
	}

	hasViolatedDomain := false
	if text != "" {
		hasViolatedDomain = domainRegex.MatchString(text)
	}
	if !hasViolatedDomain && mc.HasTextLinks {
		for _, url := range mc.TextLinks {
			if domainRegex.MatchString(url) {
				hasViolatedDomain = true
				break
			}
		}
	}
	if v := check(c.BlockDomains, hasViolatedDomain, "domain", "Domains are not allowed"); v != nil {
		return v
	}

	if text != "" {
		if v := check(c.BlockUsernames, usernameRegex.MatchString(text), "username", "Usernames are not allowed"); v != nil {
			return v
		}
		if v := check(c.BlockHashtags, strings.Contains(text, "#"), "hashtag", "Hashtags are not allowed"); v != nil {
			return v
		}
		if v := check(c.BlockPhoneNumbers, phoneNumberRegex.MatchString(text), "phone", "Phone numbers are not allowed"); v != nil {
			return v
		}
		if v := check(c.BlockEmojis, containsEmoji(text), "emoji", "Emojis are not allowed"); v != nil {
			return v
		}
		if v := check(c.BlockEmojiOnly, isEmojiOnly(text), "emoji_only", "Emoji-only messages are not allowed"); v != nil {
			return v
		}
		// Language Filters
		if v := check(c.BlockLatinLetters, containsScriptRatio(text, unicode.Latin, 0.5), "latin", "Latin letters are not allowed"); v != nil {
			return v
		}
		if v := check(c.BlockPersianArabicLetters, containsScriptRatio(text, unicode.Arabic, 0.5), "persian_arabic", "Persian/Arabic letters are not allowed"); v != nil {
			return v
		}
		if v := check(c.BlockCyrillicLetters, containsScriptRatio(text, unicode.Cyrillic, 0.5), "cyrillic", "Cyrillic letters are not allowed"); v != nil {
			return v
		}
		if v := check(c.BlockChineseCharacters, containsScriptRatio(text, unicode.Han, 0.5), "chinese", "Chinese characters are not allowed"); v != nil {
			return v
		}

		// Keywords
		if len(c.BannedKeywords) > 0 || len(c.RequiredKeywords) > 0 {
			kwPenalty := general.DefaultPenalty
			if kwPenalty == "" {
				kwPenalty = "delete"
			}
			action := s.ResolveAction(kwPenalty)

			cleanedText := cleanTextForComparison(text)
			for _, kw := range c.BannedKeywords {
				if kw != "" && strings.Contains(cleanedText, cleanTextForComparison(kw)) {
					return &Violation{Type: "banned_keyword", Message: fmt.Sprintf("Banned keyword: %s", kw), Action: action}
				}
			}

			if len(c.RequiredKeywords) > 0 {
				found := false
				for _, kw := range c.RequiredKeywords {
					if kw != "" && strings.Contains(cleanedText, cleanTextForComparison(kw)) {
						found = true
						break
					}
				}
				if !found {
					return &Violation{Type: "required_keyword", Message: "Required keyword missing", Action: action}
				}
			}
		}
	}

	return nil
}

func (s *ModeratorService) shouldBlock(rd repository.RestrictionDetail, quiet repository.SettingsQuietHours, tz string, msgDate int) bool {
	if !rd.Enabled {
		return false
	}
	switch rd.Window {
	case "Always":
		return true
	case "QuietHours":
		return s.isQuietHours(quiet, tz, msgDate)
	case "Custom":
		return s.isInCustomWindow(rd.Start, rd.End, tz, msgDate)
	default:
		return true
	}
}

func (s *ModeratorService) isInCustomWindow(start, end, tz string, msgDate int) bool {
	if start == "" || end == "" {
		return false
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		loc = time.UTC
	}

	var now time.Time
	if msgDate > 0 {
		now = time.Unix(int64(msgDate), 0).In(loc)
	} else {
		now = time.Now().In(loc)
	}

	nowMin := now.Hour()*60 + now.Minute()

	startMin, ok1 := parseHHMM(start)
	endMin, ok2 := parseHHMM(end)
	if !ok1 || !ok2 {
		return false
	}

	if startMin < endMin {
		return nowMin >= startMin && nowMin < endMin
	}
	return nowMin >= startMin || nowMin < endMin
}

// ─── Limits (length + flood + duplicates) ─────────────────

func (s *ModeratorService) checkAllLimits(ctx context.Context, l repository.SettingsLimits, mc *MessageContext, groupID string) *Violation {
	text := mc.Text
	if text == "" {
		text = mc.Caption
	}
	textLen := utf8.RuneCountInString(text)

	// Min/Max length
	if l.MinLen > 0 && textLen > 0 && textLen < l.MinLen {
		return &Violation{Type: "min_length", Message: fmt.Sprintf("Too short (min %d chars)", l.MinLen)}
	}
	if l.MaxLen > 0 && textLen > l.MaxLen {
		return &Violation{Type: "max_length", Message: fmt.Sprintf("Too long (max %d chars)", l.MaxLen)}
	}

	// Flood Control (requires Redis)
	if l.FloodMsgs > 0 && l.FloodWin > 0 && s.cache != nil && s.cache.Client != nil {
		floodKey := fmt.Sprintf("flood:%s:%d", groupID, mc.UserID)
		pipe := s.cache.Client.Pipeline()
		incr := pipe.Incr(ctx, floodKey)
		ttl := pipe.TTL(ctx, floodKey)
		_, err := pipe.Exec(ctx)
		count := incr.Val()

		if err == nil && (count == 1 || ttl.Val() == -1) {
			s.cache.Client.Expire(ctx, floodKey, time.Duration(l.FloodWin)*time.Minute)
		}

		if int(count) > l.FloodMsgs {
			action := ""
			if int(count) >= l.FloodMsgs+5 {
				action = "ban"
			} else if int(count) >= l.FloodMsgs+2 {
				action = "mute"
			}
			return &Violation{Type: "flood", Message: fmt.Sprintf("Flood detected (%d msgs in %d min)", l.FloodMsgs, l.FloodWin), Action: action}
		}
	}

	// Duplicate Detection (requires Redis)
	if l.DupCount > 0 && l.DupWin > 0 && len(text) > 0 && s.cache != nil && s.cache.Client != nil {
		hash := fmt.Sprintf("%x", sha256.Sum256([]byte(text)))
		dupKey := fmt.Sprintf("dup:%s:%d:%s", groupID, mc.UserID, hash[:16])
		pipe := s.cache.Client.Pipeline()
		incr := pipe.Incr(ctx, dupKey)
		ttl := pipe.TTL(ctx, dupKey)
		_, err := pipe.Exec(ctx)
		count := incr.Val()

		if err == nil && (count == 1 || ttl.Val() == -1) {
			s.cache.Client.Expire(ctx, dupKey, time.Duration(l.DupWin)*time.Minute)
		}

		if int(count) > l.DupCount {
			action := ""
			if int(count) >= l.DupCount+5 {
				action = "ban"
			} else if int(count) >= l.DupCount+2 {
				action = "mute"
			}
			return &Violation{Type: "duplicate", Message: "Duplicate message detected", Action: action}
		}
	}

	return nil
}

// ─── Helpers ──────────────────────────────────────────────

func (s *ModeratorService) ResolveAction(penalty string) string {
	if penalty == "" {
		return "delete"
	}
	return penalty
}

func (s *ModeratorService) handleAutoWarning(ctx context.Context, groupID uuid.UUID, userID int64, gen repository.SettingsGeneral, _ repository.SettingsCustomTexts, v *Violation) (*Violation, error) {
	if !gen.AutoWarning {
		return v, nil
	}

	// Log warning event
	s.logEventWithPayload(ctx, groupID, "member_warned", &userID, map[string]interface{}{
		"reason": v.Message,
		"type":   v.Type,
		"action": v.Action,
	})

	// Check count atomically to prevent fast-repeat bypasses
	var count int
	if s.cache != nil && s.cache.Client != nil {
		warnKey := fmt.Sprintf("warn_count:%s:%d", groupID, userID)
		c, err := s.cache.Client.Incr(ctx, warnKey).Result()
		if err == nil {
			if c == 1 {
				dbCount, _ := s.analyticsRepo.GetUserWarningsCount(ctx, groupID, userID, gen.WarningRetention)
				if dbCount > 1 {
					s.cache.Client.IncrBy(ctx, warnKey, int64(dbCount-1))
					c += int64(dbCount - 1)
				}
				s.cache.Client.Expire(ctx, warnKey, time.Duration(gen.WarningRetention)*time.Minute)
			}
			count = int(c)
		} else {
			count, _ = s.analyticsRepo.GetUserWarningsCount(ctx, groupID, userID, gen.WarningRetention)
		}
	} else {
		count, _ = s.analyticsRepo.GetUserWarningsCount(ctx, groupID, userID, gen.WarningRetention)
	}

	v.CurrentWarnings = count
	v.WarningThreshold = gen.WarningThreshold

	if count >= gen.WarningThreshold {
		v.Action = s.ResolveAction(gen.WarningFinalPenalty)
	}

	return v, nil
}

func (s *ModeratorService) logEvent(ctx context.Context, groupID uuid.UUID, eventType string, userID *int64, name string) {
	if s.analyticsRepo == nil {
		return
	}
	payload := []byte(nil)
	if name != "" {
		p, _ := json.Marshal(map[string]string{"name": name})
		payload = p
	}
	_ = s.analyticsRepo.LogEvent(ctx, &repository.GroupEvent{
		GroupID:   groupID,
		EventType: eventType,
		UserID:    userID,
		Payload:   payload,
	})
}

func (s *ModeratorService) logEventWithPayload(ctx context.Context, groupID uuid.UUID, eventType string, userID *int64, data interface{}) {
	if s.analyticsRepo == nil {
		return
	}
	var payload []byte
	if data != nil {
		p, err := json.Marshal(data)
		if err == nil {
			payload = p
		}
	}
	_ = s.analyticsRepo.LogEvent(ctx, &repository.GroupEvent{
		GroupID:   groupID,
		EventType: eventType,
		UserID:    userID,
		Payload:   payload,
	})
}

func containsEmoji(text string) bool {
	for _, r := range text {
		if r >= 0x1F600 && r <= 0x1F64F {
			return true
		} // Emoticons
		if r >= 0x1F300 && r <= 0x1F5FF {
			return true
		} // Symbols
		if r >= 0x1F680 && r <= 0x1F6FF {
			return true
		} // Transport
		if r >= 0x1F900 && r <= 0x1F9FF {
			return true
		} // Supplemental
		if r >= 0x2600 && r <= 0x26FF {
			return true
		} // Misc
		if r >= 0x2700 && r <= 0x27BF {
			return true
		} // Dingbats
		if r >= 0xFE00 && r <= 0xFE0F {
			return true
		} // Variation
		if r >= 0x200D && r <= 0x200D {
			continue
		} // ZWJ
	}
	return false
}

func isEmojiOnly(text string) bool {
	if text == "" {
		return false
	}
	for _, r := range text {
		if !unicode.IsSpace(r) && !isEmojiRune(r) && r != 0x200D && r != 0xFE0F {
			return false
		}
	}
	return true
}

func isEmojiRune(r rune) bool {
	return (r >= 0x1F600 && r <= 0x1F64F) ||
		(r >= 0x1F300 && r <= 0x1F5FF) ||
		(r >= 0x1F680 && r <= 0x1F6FF) ||
		(r >= 0x1F900 && r <= 0x1F9FF) ||
		(r >= 0x2600 && r <= 0x26FF) ||
		(r >= 0x2700 && r <= 0x27BF)
}

func (s *ModeratorService) isSpamPattern(text string) bool {
	runes := []rune(text)
	if len(runes) == 0 {
		return false
	}

	// 1. Detect repeated characters (e.g. "aaaaaa")
	if len(runes) >= 10 {
		first := runes[0]
		allSame := true
		for _, r := range runes {
			if r != first && !unicode.IsSpace(r) {
				allSame = false
				break
			}
		}
		if allSame {
			return true
		}
	}

	// 2. Detect Zalgo / Excessive Combining Marks
	combiningMarks := 0
	for _, r := range runes {
		if unicode.Is(unicode.Mn, r) || unicode.Is(unicode.Me, r) || unicode.Is(unicode.Mc, r) {
			combiningMarks++
		}
	}
	if len(runes) > 0 && float64(combiningMarks)/float64(len(runes)) > 0.4 {
		return true
	}

	// 3. Detect excessive caps (>80% uppercase in long messages)
	if len(runes) > 20 {
		upper := 0
		total := 0
		for _, r := range runes {
			if unicode.IsLetter(r) {
				total++
				if unicode.IsUpper(r) {
					upper++
				}
			}
		}
		if total > 5 && float64(upper)/float64(total) > 0.8 {
			return true
		}
	}

	// 4. Vertical text detection (many newlines)
	newlines := strings.Count(text, "\n")
	if newlines > 10 && len(text)/newlines < 5 {
		return true
	}

	return false
}

func containsScriptRatio(text string, rangeTable *unicode.RangeTable, threshold float64) bool {
	if text == "" {
		return false
	}
	matched := 0
	total := 0
	for _, r := range text {
		if unicode.IsLetter(r) {
			total++
			if unicode.Is(rangeTable, r) {
				matched++
			}
		}
	}
	if total == 0 {
		return false
	}
	return float64(matched)/float64(total) >= threshold
}

func cleanTextForComparison(text string) string {
	// Strip zero-width and control characters
	r := strings.NewReplacer(
		"\u200b", "", // Zero-width space
		"\u200c", "", // Zero-width non-joiner
		"\u200d", "", // Zero-width joiner
		"\ufeff", "", // Byte order mark
	)
	text = r.Replace(text)

	// Convert common lookalike homoglyphs to latin equivalents for comparison
	// Cyrillic homoglyphs: а, е, о, р, с, х
	homoglyphs := map[rune]rune{
		'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x',
		'А': 'a', 'Е': 'e', 'О': 'o', 'Р': 'p', 'С': 'c', 'Х': 'x',
		'a': 'a', 'e': 'e', 'o': 'o', 'p': 'p', 'c': 'c', 'x': 'x',
	}
	var buf strings.Builder
	for _, char := range text {
		if repl, exists := homoglyphs[char]; exists {
			buf.WriteRune(repl)
		} else {
			buf.WriteRune(unicode.ToLower(char))
		}
	}
	return buf.String()
}
