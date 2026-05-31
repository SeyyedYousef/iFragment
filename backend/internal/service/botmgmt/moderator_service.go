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
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"

	"golang.org/x/sync/singleflight"
	"log/slog"
	"net/http"
)

var (
	linkRegex        = regexp.MustCompile(`(?i)(https?://|t\.me/|t\.co/|tg://|www\.)`)
	domainRegex      = regexp.MustCompile(`(?i)\b[\w-]+\.(com|net|org|co|info|biz|me|io|tv|cc|us|uk|ca|de|fr|ir|xyz|site|online|tech|app|top|link|club|store|ru|cn|in|gov|edu)\b`)
	usernameRegex    = regexp.MustCompile(`(?i)(^|\s)@[a-z][a-z0-9_]{3,24}\b`)
	phoneNumberRegex = regexp.MustCompile(`(?i)(?:(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{7,15}|09\d{9})`)
)

// ModeratorService handles real-time group moderation logic.
type ModeratorService struct {
	settingsRepo  *repository.SettingsRepo
	botRepo       *repository.BotRepo
	auditRepo     *repository.AuditRepo
	analyticsRepo *repository.AnalyticsRepo
	cache         *repository.Cache
	clientCache   sync.Map // botID (uuid.UUID) -> *telegram.BotAPIClient
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
	if err != nil { return }
	if !s.isSubscriptionValid(group) {
		return
	}

	settings, err := s.settingsRepo.GetSettings(ctx, groupID)
	if err != nil { return }
	var gen repository.SettingsGeneral
	if json.Unmarshal(settings.General, &gen) != nil || gen.AntiRaidThreshold <= 0 { return }

	key := fmt.Sprintf("joins_per_min:%s", groupID)
	count, _ := s.cache.Client.Incr(ctx, key).Result()
	if count == 1 {
		s.cache.Client.Expire(ctx, key, 1*time.Minute)
	}

	if int(count) >= gen.AntiRaidThreshold {
		if gen.AntiRaidAction == "lockdown" {
			// Trigger Emergency Lock
			var qh repository.SettingsQuietHours
			json.Unmarshal(settings.QuietHours, &qh)
			if !qh.EmergencyLock {
				qh.EmergencyLock = true
				raw, _ := json.Marshal(qh)
				_, _ = s.settingsRepo.UpdateCategory(ctx, groupID, "quiet_hours", raw, 0, settings.Version)
				slog.Info("ANTI-RAID TRIGGERED for group. Lockdown enabled.", "group_id", groupID)
			}
		}
	}
}

// Violation represents a detected rule violation.
type Violation struct {
	Type            string
	Message         string
	Action          string // delete, mute, kick, ban
	CurrentWarnings int
	WarningThreshold int
}

// MessageContext holds all Telegram message metadata needed for moderation.
type MessageContext struct {
	ChatID       int64
	UserID       int64
	MessageID    int
	Text         string
	Username     string // @username
	IsBot        bool
	HasPhoto     bool
	HasSticker   bool
	HasLocation  bool
	HasAudio     bool
	HasVoice     bool
	HasDocument  bool
	HasAnimation bool // GIF
	HasVideo     bool
	HasPoll      bool
	HasGame      bool
	HasCaption   bool
	Caption      string
	IsForward    bool
	ForwardFromChannel bool
	ForwardFromChatID  int64
	HasInlineKeyboard  bool
	HasReply     bool
	IsReplyToCrossChat bool
	HasViaBot    bool // sent via inline bot / mini app
	IsCommand    bool // starts with /
}

// ValidateMessage checks a message against all configured rules.
func (s *ModeratorService) ValidateMessage(ctx context.Context, mc *MessageContext) (*Violation, error) {
	// 1. Resolve internal group and bot
	group, err := s.botRepo.GetGroupByChatID(ctx, mc.ChatID)
	if err != nil {
		return nil, nil // Group not managed
	}

	bot, err := s.botRepo.GetBotByID(ctx, group.BotID)
	if err != nil {
		return nil, err
	}

	tgClient, err := s.GetTelegramClient(ctx, bot)
	if err != nil {
		return nil, err
	}

	// 2.1 Check Bot Status (BUG #11)
	if bot.Status != "active" {
		return nil, nil // Bot is paused or revoked
	}

	// 2.2 Check Subscription (BUG #9)
	if !s.isSubscriptionValid(group) {
		return nil, nil // Subscription expired
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

	// 4. Log message event for analytics
	s.logEvent(ctx, group.ID, "message", &mc.UserID, mc.Username)

	// 5. Check if user is admin
	isAdmin := false
	status, _ := s.GetChatMemberCached(ctx, tgClient, mc.ChatID, mc.UserID)
	if status == "administrator" || status == "creator" {
		isAdmin = true
	}

	if isAdmin && !general.TrackAdmin {
		// Admins bypass everything EXCEPT emergency lock if AdminOverride is false
		if quiet.EmergencyLock && !quiet.AdminOverride {
			return &Violation{Type: "quiet_hours", Message: "Emergency Lock active", Action: "delete"}, nil
		}
		return nil, nil
	}

	// CAS (Combot Anti-Spam) Check
	if general.CasEnabled {
		if s.checkCAS(ctx, mc.UserID) {
			vAction := "ban"
			if isAdmin {
				vAction = "delete"
			}
			return &Violation{
				Type:    "cas_ban",
				Action:  vAction,
				Message: "Banned by Combot Anti-Spam (CAS)",
			}, nil
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
	if s.isQuietHours(quiet, general.Timezone) {
		vAction := s.ResolveAction(general.DefaultPenalty)
		if isAdmin {
			vAction = "delete"
		}
		return &Violation{Type: "quiet_hours", Message: "Group is in quiet mode", Action: vAction}, nil
	}

	// 8. Mandatory Membership (Force Join)
	if v := s.checkMandatoryMembership(ctx, tgClient, mc, mandatory, settings.CustomTexts); v != nil {
		s.logEvent(ctx, group.ID, "spam_blocked", &mc.UserID, mc.Username)
		if isAdmin {
			v.Action = "delete"
		}
		return v, nil
	}

	// 8.5 Forced Add Members Check
	if mandatory.ForcedAddEnabled && mandatory.ForcedAddCount > 0 {
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
			return &Violation{
				Type:    "forced_add",
				Message: forceAddMsg,
				Action:  vAction,
			}, nil
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
		return resViolation, err
	}

	// 10. Limits — length, flood, duplicates
	if v := s.checkAllLimits(ctx, limits, mc, group.ID.String()); v != nil {
		s.logEvent(ctx, group.ID, "spam_blocked", &mc.UserID, mc.Username)
		v.Action = s.ResolveAction(general.DefaultPenalty)
		var ct repository.SettingsCustomTexts
		json.Unmarshal(settings.CustomTexts, &ct)
		resViolation, err := s.handleAutoWarning(ctx, group.ID, mc.UserID, general, ct, v)
		if resViolation != nil && isAdmin {
			resViolation.Action = "delete"
		}
		return resViolation, err
	}

	return nil, nil
}

func (s *ModeratorService) checkCAS(ctx context.Context, userID int64) bool {
	// Cache CAS results for 24h
	cacheKey := fmt.Sprintf("cas:%d", userID)
	if s.cache != nil && s.cache.Client != nil {
		if val, _ := s.cache.Client.Get(ctx, cacheKey).Result(); val != "" {
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
		return false
	}
	defer resp.Body.Close()

	var result struct {
		OK bool `json:"ok"`
	}
	if json.NewDecoder(resp.Body).Decode(&result) == nil {
		status := "ok"
		if result.OK { status = "banned" }
		if s.cache != nil && s.cache.Client != nil {
			s.cache.Client.Set(ctx, cacheKey, status, 24*time.Hour)
		}
		return result.OK
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
		return client.(*telegram.BotAPIClient), nil
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

func (s *ModeratorService) isQuietHours(q repository.SettingsQuietHours, tz string) bool {
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

	now := time.Now().In(loc)
	nowMinutes := now.Hour()*60 + now.Minute()

	for _, p := range q.Periods {
		var startH, startM, endH, endM int
		fmt.Sscanf(p.Start, "%d:%d", &startH, &startM)
		fmt.Sscanf(p.End, "%d:%d", &endH, &endM)

		startMin := startH*60 + startM
		endMin := endH*60 + endM

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

func (s *ModeratorService) isSubscriptionValid(g *repository.ManagedGroup) bool {
	now := time.Now()
	// If paid period exists and is in the future
	if g.PaidUntil != nil && now.Before(*g.PaidUntil) {
		return true
	}
	// Otherwise check trial
	return now.Before(g.TrialEndsAt)
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
		if err != nil || status == "left" || status == "kicked" || status == "" {
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

	// Cache for 5 minutes
	s.cache.Client.Set(ctx, key, status, 5*time.Minute)
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
		if s.shouldBlock(rd, quiet, general.Timezone) {
			penalty := rd.Penalty
			if penalty == "" || penalty == "default" {
				penalty = general.DefaultPenalty
			}
			return &Violation{Type: vType, Message: vMsg, Action: s.ResolveAction(penalty)}
		}
		return nil
	}

	// Bot blocking
	if v := check(c.BlockBots, mc.IsBot, "bot_blocked", "Bots are not allowed"); v != nil {
		return v
	}

	// ── Links & IDs ──
	if v := check(c.RemoveLinks, linkRegex.MatchString(text), "link", "Links are not allowed"); v != nil {
		return v
	}

	if v := check(c.BlockDomains, domainRegex.MatchString(text), "domain", "Domains are not allowed"); v != nil {
		return v
	}

	if v := check(c.BlockUsernames, usernameRegex.MatchString(text), "username", "Usernames are not allowed"); v != nil {
		return v
	}

	if v := check(c.BlockHashtags, strings.Contains(text, "#"), "hashtag", "Hashtags are not allowed"); v != nil {
		return v
	}

	if v := check(c.BlockPhoneNumbers, phoneNumberRegex.MatchString(text), "phone", "Phone numbers are not allowed"); v != nil {
		return v
	}

	// ── Text & Symbols ──
	if v := check(c.BlockEmojis, containsEmoji(text), "emoji", "Emojis are not allowed"); v != nil {
		return v
	}

	if v := check(c.BlockEmojiOnly, isEmojiOnly(text), "emoji_only", "Emoji-only messages are not allowed"); v != nil {
		return v
	}

	if v := check(c.BlockTextPatterns, s.isSpamPattern(text), "spam_pattern", "Spam pattern detected"); v != nil {
		return v
	}

	// ── Language Filters ──
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

	// ── Media & Files ──
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

	if v := check(c.BlockCaptionless, (mc.HasPhoto || mc.HasVideo) && !mc.HasCaption, "captionless", "Media without caption is not allowed"); v != nil {
		return v
	}

	// ── Interactions ──
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

	if v := check(c.BlockAppMessages, mc.HasViaBot, "app_message", "Mini App messages are not allowed"); v != nil {
		return v
	}

	if v := check(c.BlockPolls, mc.HasPoll, "poll", "Polls are not allowed"); v != nil {
		return v
	}

	if v := check(c.BlockInlineKeyboards, mc.HasInlineKeyboard, "inline_keyboard", "Inline keyboards are not allowed"); v != nil {
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

	// ── Keywords ──
	lowerText := strings.ToLower(text)
	for _, kw := range c.BannedKeywords {
		if strings.Contains(lowerText, strings.ToLower(kw)) {
			return &Violation{Type: "banned_keyword", Message: fmt.Sprintf("Banned keyword: %s", kw), Action: s.ResolveAction(general.DefaultPenalty)}
		}
	}

	if len(c.RequiredKeywords) > 0 {
		found := false
		for _, kw := range c.RequiredKeywords {
			if strings.Contains(lowerText, strings.ToLower(kw)) {
				found = true
				break
			}
		}
		if !found {
			return &Violation{Type: "required_keyword", Message: "Required keyword missing", Action: s.ResolveAction(general.DefaultPenalty)}
		}
	}

	return nil
}

func (s *ModeratorService) shouldBlock(rd repository.RestrictionDetail, quiet repository.SettingsQuietHours, tz string) bool {
	if !rd.Enabled {
		return false
	}
	switch rd.Window {
	case "Always":
		return true
	case "QuietHours":
		return s.isQuietHours(quiet, tz)
	case "Custom":
		return s.isInCustomWindow(rd.Start, rd.End, tz)
	default:
		return true
	}
}

func (s *ModeratorService) isInCustomWindow(start, end, tz string) bool {
	if start == "" || end == "" {
		return false
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)
	nowMin := now.Hour()*60 + now.Minute()

	var sH, sM, eH, eM int
	fmt.Sscanf(start, "%d:%d", &sH, &sM)
	fmt.Sscanf(end, "%d:%d", &eH, &eM)
	startMin := sH*60 + sM
	endMin := eH*60 + eM

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
		pipe.ExpireNX(ctx, floodKey, time.Duration(l.FloodWin)*time.Minute)
		_, _ = pipe.Exec(ctx)
		count, _ := incr.Result()

		if int(count) > l.FloodMsgs {
			return &Violation{Type: "flood", Message: fmt.Sprintf("Flood detected (%d msgs in %d min)", l.FloodMsgs, l.FloodWin)}
		}
	}

	// Duplicate Detection (requires Redis)
	if l.DupCount > 0 && l.DupWin > 0 && len(text) > 0 && s.cache != nil && s.cache.Client != nil {
		hash := fmt.Sprintf("%x", sha256.Sum256([]byte(text)))
		dupKey := fmt.Sprintf("dup:%s:%d:%s", groupID, mc.UserID, hash[:16])
		count, _ := s.cache.Client.Incr(ctx, dupKey).Result()
		if count == 1 {
			s.cache.Client.Expire(ctx, dupKey, time.Duration(l.DupWin)*time.Minute)
		}
		if int(count) > l.DupCount {
			return &Violation{Type: "duplicate", Message: "Duplicate message detected"}
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

func (s *ModeratorService) handleAutoWarning(ctx context.Context, groupID uuid.UUID, userID int64, gen repository.SettingsGeneral, ct repository.SettingsCustomTexts, v *Violation) (*Violation, error) {
	if !gen.AutoWarning {
		return v, nil
	}

	// Use custom warning text if available
	if ct.WarningText != "" {
		v.Message = ct.WarningText
	}

	// Log warning event
	s.logEvent(ctx, groupID, "member_warned", &userID, "")

	// Check count
	count, _ := s.analyticsRepo.GetUserWarningsCount(ctx, groupID, userID, gen.WarningRetention)
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

func containsEmoji(text string) bool {
	for _, r := range text {
		if r >= 0x1F600 && r <= 0x1F64F { return true } // Emoticons
		if r >= 0x1F300 && r <= 0x1F5FF { return true } // Symbols
		if r >= 0x1F680 && r <= 0x1F6FF { return true } // Transport
		if r >= 0x1F900 && r <= 0x1F9FF { return true } // Supplemental
		if r >= 0x2600 && r <= 0x26FF { return true }   // Misc
		if r >= 0x2700 && r <= 0x27BF { return true }   // Dingbats
		if r >= 0xFE00 && r <= 0xFE0F { return true }   // Variation
		if r >= 0x200D && r <= 0x200D { continue }       // ZWJ
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
