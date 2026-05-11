package botmgmt

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"

	"github.com/redis/go-redis/v9"
)

// ModeratorService handles real-time group moderation logic.
type ModeratorService struct {
	settingsRepo  *repository.SettingsRepo
	botRepo       *repository.BotRepo
	auditRepo     *repository.AuditRepo
	analyticsRepo *repository.AnalyticsRepo
	cache         *repository.Cache
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

	token, err := DecryptToken(bot.BotTokenEncrypted)
	if err != nil {
		return nil, err
	}

	tgClient := telegram.NewBotAPIClient(token)

	// 2. Fetch settings (cached via SettingsRepo)
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

	json.Unmarshal(settings.ContentRestrictions, &content)
	json.Unmarshal(settings.Limits, &limits)
	json.Unmarshal(settings.QuietHours, &quiet)
	json.Unmarshal(settings.MandatoryMembership, &mandatory)
	json.Unmarshal(settings.General, &general)

	// 4. Log message event for analytics
	s.logEvent(ctx, group.ID, "message", &mc.UserID)

	// 5. Check if user is admin — admins bypass all rules
	if quiet.AdminOverride || true { // always check admin status
		status, _ := tgClient.GetChatMember(mc.ChatID, mc.UserID)
		if status == "administrator" || status == "creator" {
			return nil, nil
		}
	}

	// 6. Check exemptions list (usernames or IDs)
	for _, ex := range mandatory.Exemptions {
		if strings.HasPrefix(ex, "@") {
			// Note: We'd need to resolve username to ID, but for now we skip check
			// or assume user knows what they are doing. Simple check:
			continue 
		}
		if fmt.Sprintf("%d", mc.UserID) == ex {
			return nil, nil
		}
	}

	// 7. Emergency Lock / Quiet Hours
	if s.isQuietHours(quiet, general.Timezone) {
		return &Violation{Type: "quiet_hours", Message: "Group is in quiet mode", Action: "delete"}, nil
	}

	// 8. Mandatory Membership (Force Join)
	if v := s.checkMandatoryMembership(tgClient, mc, mandatory); v != nil {
		return v, nil
	}

	// 9. Content Restrictions — ALL checks
	if v := s.checkAllContent(content, mc); v != nil {
		v.Action = s.resolveAction(general.DefaultPenalty)
		return s.handleAutoWarning(ctx, group.ID, mc.UserID, general, v)
	}

	// 10. Limits — length, flood, duplicates
	if v := s.checkAllLimits(ctx, limits, mc, group.ID.String()); v != nil {
		v.Action = s.resolveAction(general.DefaultPenalty)
		return s.handleAutoWarning(ctx, group.ID, mc.UserID, general, v)
	}

	return nil, nil
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

// ─── Mandatory Membership ─────────────────────────────────

func (s *ModeratorService) checkMandatoryMembership(tg *telegram.BotAPIClient, mc *MessageContext, m repository.SettingsMandatoryMembership) *Violation {
	if !m.ForceJoinEnabled || len(m.RequiredChannels) == 0 {
		return nil
	}

	for _, channel := range m.RequiredChannels {
		channelID := channel
		if !strings.HasPrefix(channel, "@") && !strings.HasPrefix(channel, "-100") {
			channelID = "@" + channel
		}

		status, err := tg.GetChatMember(channelID, mc.UserID)
		if err != nil || status == "left" || status == "kicked" || status == "" {
			return &Violation{
				Type:    "mandatory_membership",
				Message: fmt.Sprintf("You must join %s first", channel),
				Action:  "delete",
			}
		}
	}
	return nil
}

// ─── Content Restrictions (ALL 30+ checks) ────────────────

func (s *ModeratorService) checkAllContent(c repository.SettingsContentRestrictions, mc *MessageContext) *Violation {
	text := mc.Text
	if text == "" {
		text = mc.Caption
	}

	// Bot blocking
	if c.BlockBots && mc.IsBot {
		return &Violation{Type: "bot_blocked", Message: "Bots are not allowed"}
	}

	// ── Links & IDs ──
	if c.RemoveLinks {
		if regexp.MustCompile(`(?i)(https?://|t\.me/|t\.co/)`).MatchString(text) {
			return &Violation{Type: "link", Message: "Links are not allowed"}
		}
	}

	if c.BlockDomains {
		if regexp.MustCompile(`(?i)\b[\w-]+\.(com|org|net|ir|io|me|co|info|biz|xyz|app|dev|ru|cn)\b`).MatchString(text) {
			return &Violation{Type: "domain", Message: "Domains are not allowed"}
		}
	}

	if c.BlockUsernames {
		if regexp.MustCompile(`@[a-zA-Z][a-zA-Z0-9_]{3,}`).MatchString(text) {
			return &Violation{Type: "username", Message: "Usernames are not allowed"}
		}
	}

	if c.BlockHashtags && strings.Contains(text, "#") {
		return &Violation{Type: "hashtag", Message: "Hashtags are not allowed"}
	}

	if c.BlockPhoneNumbers {
		if regexp.MustCompile(`(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}`).MatchString(text) {
			return &Violation{Type: "phone", Message: "Phone numbers are not allowed"}
		}
	}

	// ── Text & Symbols ──
	if c.BlockEmojis && containsEmoji(text) {
		return &Violation{Type: "emoji", Message: "Emojis are not allowed"}
	}

	if c.BlockEmojiOnly && isEmojiOnly(text) {
		return &Violation{Type: "emoji_only", Message: "Emoji-only messages are not allowed"}
	}

	if c.BlockTextPatterns && isSpamPattern(text) {
		return &Violation{Type: "spam_pattern", Message: "Spam pattern detected"}
	}

	// ── Language Filters ──
	if c.BlockLatinLetters && containsScript(text, unicode.Latin) {
		return &Violation{Type: "latin", Message: "Latin letters are not allowed"}
	}

	if c.BlockPersianArabicLetters && containsScript(text, unicode.Arabic) {
		return &Violation{Type: "persian_arabic", Message: "Persian/Arabic letters are not allowed"}
	}

	if c.BlockCyrillicLetters && containsScript(text, unicode.Cyrillic) {
		return &Violation{Type: "cyrillic", Message: "Cyrillic letters are not allowed"}
	}

	if c.BlockChineseCharacters && containsScript(text, unicode.Han) {
		return &Violation{Type: "chinese", Message: "Chinese characters are not allowed"}
	}

	// ── Media & Files ──
	if c.BlockPhotos && mc.HasPhoto {
		return &Violation{Type: "photo", Message: "Photos are not allowed"}
	}

	if c.BlockStickers && mc.HasSticker {
		return &Violation{Type: "sticker", Message: "Stickers are not allowed"}
	}

	if c.BlockLocations && mc.HasLocation {
		return &Violation{Type: "location", Message: "Locations are not allowed"}
	}

	if c.BlockAudio && mc.HasAudio {
		return &Violation{Type: "audio", Message: "Audio files are not allowed"}
	}

	if c.BlockVoiceMessages && mc.HasVoice {
		return &Violation{Type: "voice", Message: "Voice messages are not allowed"}
	}

	if c.BlockFiles && mc.HasDocument {
		return &Violation{Type: "file", Message: "Files are not allowed"}
	}

	if c.BlockGifs && mc.HasAnimation {
		return &Violation{Type: "gif", Message: "GIFs are not allowed"}
	}

	if c.BlockCaptionless && (mc.HasPhoto || mc.HasVideo) && !mc.HasCaption {
		return &Violation{Type: "captionless", Message: "Media without caption is not allowed"}
	}

	// ── Interactions ──
	if c.BlockForwards && mc.IsForward {
		return &Violation{Type: "forward", Message: "Forwarded messages are not allowed"}
	}

	if c.RestrictChannelForwards && mc.ForwardFromChannel {
		return &Violation{Type: "channel_forward", Message: "Forwards from channels are not allowed"}
	}

	if c.BlockAppMessages && mc.HasViaBot {
		return &Violation{Type: "app_message", Message: "Mini App messages are not allowed"}
	}

	if c.BlockPolls && mc.HasPoll {
		return &Violation{Type: "poll", Message: "Polls are not allowed"}
	}

	if c.BlockInlineKeyboards && mc.HasInlineKeyboard {
		return &Violation{Type: "inline_keyboard", Message: "Inline keyboards are not allowed"}
	}

	if c.BlockGames && mc.HasGame {
		return &Violation{Type: "game", Message: "Games are not allowed"}
	}

	if c.BlockSlashCommands && mc.IsCommand {
		return &Violation{Type: "slash_command", Message: "Slash commands are not allowed"}
	}

	if c.BlockUserReplies && mc.HasReply {
		return &Violation{Type: "reply", Message: "Replies are not allowed"}
	}

	if c.BlockCrossChatReplies && mc.IsReplyToCrossChat {
		return &Violation{Type: "cross_chat_reply", Message: "Cross-chat replies are not allowed"}
	}

	// ── Keywords ──
	lowerText := strings.ToLower(text)
	for _, kw := range c.BannedKeywords {
		if strings.Contains(lowerText, strings.ToLower(kw)) {
			return &Violation{Type: "banned_keyword", Message: fmt.Sprintf("Banned keyword: %s", kw)}
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
			return &Violation{Type: "required_keyword", Message: "Required keyword missing"}
		}
	}

	return nil
}

// ─── Limits (length + flood + duplicates) ─────────────────

func (s *ModeratorService) checkAllLimits(ctx context.Context, l repository.SettingsLimits, mc *MessageContext, groupID string) *Violation {
	text := mc.Text
	if text == "" {
		text = mc.Caption
	}
	textLen := len([]rune(text))

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
		count, _ := s.cache.Client.Incr(ctx, floodKey).Result()
		if count == 1 {
			s.cache.Client.Expire(ctx, floodKey, time.Duration(l.FloodWin)*time.Minute)
		}
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

func (s *ModeratorService) resolveAction(penalty string) string {
	switch penalty {
	case "mute_1h", "mute_24h":
		return "mute"
	case "kick":
		return "kick"
	case "ban":
		return "ban"
	default:
		return "delete"
	}
}

func (s *ModeratorService) handleAutoWarning(ctx context.Context, groupID uuid.UUID, userID int64, gen repository.SettingsGeneral, v *Violation) (*Violation, error) {
	if !gen.AutoWarning {
		return v, nil
	}

	// Log warning event
	s.logEvent(ctx, groupID, "member_warned", &userID)

	// Check count
	count, _ := s.analyticsRepo.GetUserWarningsCount(ctx, groupID, userID, gen.WarningRetention)
	v.CurrentWarnings = count
	v.WarningThreshold = gen.WarningThreshold

	if count >= gen.WarningThreshold {
		v.Action = s.resolveAction(gen.WarningFinalPenalty)
	}

	return v, nil
}

func (s *ModeratorService) logEvent(ctx context.Context, groupID uuid.UUID, eventType string, userID *int64) {
	if s.analyticsRepo == nil {
		return
	}
	_ = s.analyticsRepo.LogEvent(ctx, &repository.GroupEvent{
		GroupID:   groupID,
		EventType: eventType,
		UserID:    userID,
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

func isSpamPattern(text string) bool {
	if len(text) == 0 {
		return false
	}
	// Detect repeated characters (e.g. "aaaaaa")
	if len(text) >= 10 {
		first := rune(text[0])
		allSame := true
		for _, r := range text {
			if r != first {
				allSame = false
				break
			}
		}
		if allSame {
			return true
		}
	}
	// Detect excessive caps (>80% uppercase in long messages)
	if len([]rune(text)) > 20 {
		upper := 0
		total := 0
		for _, r := range text {
			if unicode.IsLetter(r) {
				total++
				if unicode.IsUpper(r) {
					upper++
				}
			}
		}
		if total > 0 && float64(upper)/float64(total) > 0.8 {
			return true
		}
	}
	return false
}

func containsScript(text string, rangeTable *unicode.RangeTable) bool {
	for _, r := range text {
		if unicode.Is(rangeTable, r) {
			return true
		}
	}
	return false
}

// Ensure redis import is used
var _ redis.Client
