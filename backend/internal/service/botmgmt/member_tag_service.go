package botmgmt

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"
)

// ============================================================================
// MemberTagService — Bot API 9.5 setChatMemberTag (added 2026-08-25)
//
// Design decisions locked by Seyyed Yousef on 2026-08-25:
//   • Enabled BY DEFAULT for all groups.
//   • Admins may tag anyone; every member may change their OWN tag.
//   • Purely manual command-driven (/tag). No automatic gamification sync.
//
// The bot belongs to the group owner (managed bot), so this service never
// mutates tags autonomously — it only executes explicit /tag commands and
// answers with ephemeral messages so the group is never spammed.
// ============================================================================

const (
	// Telegram-side limit for member tags is 16 characters (Bot API 9.5).
	defaultMaxTagLength = 16
	tagCooldownSeconds  = 30 // per-user anti-abuse cooldown between self-tag changes
)

var tagSanitizer = regexp.MustCompile(`[\x00-\x1f<>]`)

func isEmojiRune(r rune) bool {
	return (r >= 0x1F600 && r <= 0x1F64F) || // Emoticons
		(r >= 0x1F300 && r <= 0x1F5FF) || // Misc Symbols and Pictographs
		(r >= 0x1F680 && r <= 0x1F6FF) || // Transport and Map
		(r >= 0x1F700 && r <= 0x1F77F) || // Alchemical Symbols
		(r >= 0x1F780 && r <= 0x1F7FF) || // Geometric Shapes Extended
		(r >= 0x1F800 && r <= 0x1F8FF) || // Supplemental Arrows-C
		(r >= 0x1F900 && r <= 0x1F9FF) || // Supplemental Symbols and Pictographs
		(r >= 0x1FA00 && r <= 0x1FA6F) || // Chess Symbols
		(r >= 0x1FA70 && r <= 0x1FAFF) || // Symbols and Pictographs Extended-A
		(r >= 0x2600 && r <= 0x26FF) || // Misc symbols
		(r >= 0x2700 && r <= 0x27BF) || // Dingbats
		(r >= 0xFE00 && r <= 0xFE0F) || // Variation Selectors
		(r >= 0x1F1E6 && r <= 0x1F1FF) // Regional indicator flags
}

type MemberTagService struct {
	botRepo      *repository.BotRepo
	settingsRepo *repository.SettingsRepo
	cache        *repository.Cache
}

func NewMemberTagService(botRepo *repository.BotRepo, settingsRepo *repository.SettingsRepo, cache *repository.Cache) *MemberTagService {
	return &MemberTagService{botRepo: botRepo, settingsRepo: settingsRepo, cache: cache}
}

// sanitizeTag strips control chars/markup brackets/emojis and clamps to maxLen runes.
func sanitizeTag(raw string, maxLen int) string {
	clean := strings.TrimSpace(tagSanitizer.ReplaceAllString(raw, ""))
	var noEmoji strings.Builder
	for _, r := range clean {
		if !isEmojiRune(r) {
			noEmoji.WriteRune(r)
		}
	}
	clean = strings.TrimSpace(noEmoji.String())
	if maxLen <= 0 || maxLen > defaultMaxTagLength {
		maxLen = defaultMaxTagLength
	}
	if utf8.RuneCountInString(clean) > maxLen {
		runes := []rune(clean)
		clean = string(runes[:maxLen])
	}
	return clean
}

// loadGroupAndGeneral resolves the managed group from the bot+chat pair and
// returns its general settings. Tag flag defaults ON when the key has never
// been persisted in the JSONB blob (user decision: enabled by default).
func (s *MemberTagService) loadGroupAndGeneral(ctx context.Context, botID uuid.UUID, chatID int64) (*model.ManagedGroup, repository.SettingsGeneral, error) {
	group, err := s.botRepo.GetGroup(ctx, botID, chatID)
	if err != nil || group == nil {
		return nil, repository.SettingsGeneral{}, fmt.Errorf("group not managed: %w", err)
	}

	settings, serr := s.settingsRepo.GetSettings(ctx, group.ID)
	general := repository.SettingsGeneral{}
	hasKey := false
	if serr == nil && len(settings.General) > 0 {
		if err := json.Unmarshal(settings.General, &general); err != nil {
			general = repository.SettingsGeneral{}
		}
		var probe map[string]json.RawMessage
		if json.Unmarshal(settings.General, &probe) == nil {
			_, hasKey = probe["memberTagsEnabled"]
		}
	}
	if !hasKey {
		general.MemberTagsEnabled = true
	}
	return group, general, nil
}

// HandleTagCommand executes /tag. The webhook router has matched the command;
// args is everything after "/tag".
//
// Syntax:
//
//	/tag <text>            → set your own tag
//	/tag off               → clear your own tag
//	/tag @user <text>      → admin only: set someone's tag
//	reply + /tag <text>    → admin only: tag the replied-to member
func (s *MemberTagService) HandleTagCommand(ctx context.Context, tg *telegram.BotAPIClient, mc *MessageContext, group *model.ManagedGroup, botID uuid.UUID, args string) {
	if tg == nil || mc == nil || group == nil {
		return
	}

	_, general, err := s.loadGroupAndGeneral(ctx, botID, mc.ChatID)
	if err != nil {
		slog.Warn("/tag: failed to resolve group", "chat", mc.ChatID, "error", err)
		return
	}
	if !general.MemberTagsEnabled {
		replyEphemeralText(ctx, tg, mc, i18nTagDisabled)
		return
	}

	args = strings.TrimSpace(args)
	if args == "" {
		replyEphemeralText(ctx, tg, mc, i18nTagUsage)
		return
	}

	targetUserID := mc.UserID
	isSelf := true

	// Form: /tag @username <text> — admin-only target by username.
	if strings.HasPrefix(args, "@") {
		status, serr := s.memberStatus(ctx, tg, mc.ChatID, mc.UserID)
		if serr != nil || (status != "creator" && status != "administrator") {
			replyEphemeralText(ctx, tg, mc, i18nTagAdminOnly)
			return
		}
		parts := strings.SplitN(args, " ", 2)
		username := strings.TrimPrefix(parts[0], "@")
		resolvedID, rerr := s.resolveUsernameToID(ctx, tg, mc.ChatID, username)
		if rerr != nil || resolvedID == 0 {
			replyEphemeralText(ctx, tg, mc, i18nTagUserNotFound)
			return
		}
		targetUserID = resolvedID
		args = ""
		if len(parts) == 2 {
			args = parts[1]
		}
	} else if mc.HasReply && !strings.EqualFold(args, "off") {
		// Form: reply + /tag <text> — admin-only.
		status, serr := s.memberStatus(ctx, tg, mc.ChatID, mc.UserID)
		if serr != nil || (status != "creator" && status != "administrator") {
			replyEphemeralText(ctx, tg, mc, i18nTagAdminOnly)
			return
		}
		if mc.ReplyToUserID != 0 {
			targetUserID = mc.ReplyToUserID
			isSelf = false
		}
	}

	clearing := strings.EqualFold(args, "off") || strings.EqualFold(args, "خاموش")

	// Anti-abuse cooldown for self tag changes.
	if isSelf && !clearing && s.onCooldown(mc.ChatID, mc.UserID) {
		replyEphemeralText(ctx, tg, mc, i18nTagCooldown)
		return
	}

	newTag := ""
	if !clearing {
		newTag = sanitizeTag(args, general.MaxTagLength)
		if newTag == "" {
			replyEphemeralText(ctx, tg, mc, i18nTagEmpty)
			return
		}
	}

	if err := tg.SetChatMemberTag(ctx, mc.ChatID, targetUserID, newTag); err != nil {
		slog.Warn("/tag: setChatMemberTag failed", "chat", mc.ChatID, "target", targetUserID, "error", err)
		// Most common cause: the bot was re-promoted without can_manage_tags.
		replyEphemeralText(ctx, tg, mc, i18nTagBotPermission)
		return
	}

	if clearing {
		replyEphemeralText(ctx, tg, mc, i18nTagCleared)
	} else {
		replyEphemeralText(ctx, tg, mc, i18nTagSetPrefix+newTag+i18nTagSetSuffix)
	}
	s.markUsed(mc.ChatID, mc.UserID)
}

func (s *MemberTagService) memberStatus(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, userID int64) (string, error) {
	payload := map[string]interface{}{"chat_id": chatID, "user_id": userID}
	raw, err := tg.Request(ctx, "getChatMember", payload)
	if err != nil {
		return "", err
	}
	var m struct {
		Status string `json:"status"`
	}
	if err := json.Unmarshal(raw, &m); err != nil {
		return "", err
	}
	return m.Status, nil
}

func (s *MemberTagService) resolveUsernameToID(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, username string) (int64, error) {
	cleanUser := strings.ToLower(strings.TrimPrefix(username, "@"))
	if s.cache != nil && s.cache.Client != nil {
		if val, err := s.cache.Client.Get(ctx, "uname:"+cleanUser).Int64(); err == nil && val > 0 {
			return val, nil
		}
	}
	if s.botRepo != nil && s.botRepo.DB() != nil && s.botRepo.DB().Pool != nil {
		var uid int64
		err := s.botRepo.DB().Pool.QueryRow(ctx, "SELECT telegram_id FROM users WHERE LOWER(username) = $1 LIMIT 1", cleanUser).Scan(&uid)
		if err == nil && uid > 0 {
			return uid, nil
		}
	}
	return 0, fmt.Errorf("user not found by username; please reply to their message with /tag <text>")
}

const tagCooldownKey = "tagcd:%d:%d"

func (s *MemberTagService) onCooldown(chatID, userID int64) bool {
	if s.cache == nil || s.cache.Client == nil {
		return false
	}
	key := fmt.Sprintf(tagCooldownKey, chatID, userID)
	exists, _ := s.cache.Client.Exists(context.Background(), key).Result()
	return exists > 0
}

func (s *MemberTagService) markUsed(chatID, userID int64) {
	if s.cache == nil || s.cache.Client == nil {
		return
	}
	key := fmt.Sprintf(tagCooldownKey, chatID, userID)
	_ = s.cache.Client.Set(context.Background(), key, 1, tagCooldownSeconds*time.Second).Err()
}

// ── Ephemeral reply helper ──

func replyEphemeralText(ctx context.Context, tg *telegram.BotAPIClient, mc *MessageContext, text string) {
	_, _ = tg.SendEphemeralMessageWithMarkup(ctx, mc.ChatID, mc.UserID, text, nil, mc.MessageThreadID)
}

// ── Response strings (EN base; webhook layer localizes via i18n when available) ──

const (
	i18nTagUsage = `🏷️ <b>Tag usage:</b>
• /tag &lt;text&gt; — set your own tag
• /tag off — remove your tag
Admins:
• /tag @user &lt;text&gt; — set someone's tag
• Reply to a message + /tag &lt;text&gt;`
	i18nTagDisabled      = "🏷️ Member tags are currently disabled in this group."
	i18nTagAdminOnly     = "🚫 Only admins can set other members' tags."
	i18nTagUserNotFound  = "❌ User not found by @username. Please reply to that member's message with <code>/tag &lt;text&gt;</code>."
	i18nTagCooldown      = "⏳ Please wait before changing your tag again."
	i18nTagEmpty         = "❌ The tag text is empty or contains unsupported characters."
	i18nTagBotPermission = "⚠️ I could not set the tag.\nMake sure I am an admin with the <b>Manage Tags</b> permission, then try again."
	i18nTagCleared       = "✅ Tag removed."
	i18nTagSetPrefix     = "✅ Tag set: <b>"
	i18nTagSetSuffix     = "</b>"
)
