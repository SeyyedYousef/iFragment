package channelmgmt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"
	"ifragment-backend/internal/telemetry"
)

type ChannelService struct {
	channelRepo   *repository.ChannelRepo
	botRepo       *repository.BotRepo
	auditRepo     *repository.AuditRepo
}

func NewChannelService(
	channelRepo *repository.ChannelRepo,
	botRepo *repository.BotRepo,
	auditRepo *repository.AuditRepo,
) *ChannelService {
	return &ChannelService{
		channelRepo: channelRepo,
		botRepo:     botRepo,
		auditRepo:   auditRepo,
	}
}

// Channel Connection & Management

func (s *ChannelService) ConnectChannel(ctx context.Context, ownerUserID int64, botID uuid.UUID, channelUsernameOrID string) (*repository.ManagedChannel, error) {
	var metricStatus = "failed"
	defer func() {
		telemetry.RecordChannelConnect(metricStatus)
	}()

	// 1. Get bot
	bot, err := s.botRepo.GetBotByID(ctx, botID)
	if err != nil {
		return nil, fmt.Errorf("bot not found: %w", err)
	}
	if bot.OwnerUserID != ownerUserID {
		return nil, fmt.Errorf("unauthorized to use this bot")
	}

	// 2. Initialize Telegram Client
	token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt bot token: %w", err)
	}
	tg := telegram.NewBotAPIClient(token)

	// 3. Normalize username or chat ID
	var targetChat string
	if !strings.HasPrefix(channelUsernameOrID, "@") && !strings.HasPrefix(channelUsernameOrID, "-100") {
		if _, err := fmt.Sscan(channelUsernameOrID, new(int64)); err == nil {
			targetChat = channelUsernameOrID
		} else {
			targetChat = "@" + channelUsernameOrID
		}
	} else {
		targetChat = channelUsernameOrID
	}

	// 4. Get chat details from Telegram
	chat, err := tg.GetChat(ctx, targetChat)
	if err != nil {
		return nil, fmt.Errorf("failed to locate channel: %w", err)
	}
	if chat.Type != "channel" {
		return nil, fmt.Errorf("located chat is not a channel: type=%s", chat.Type)
	}

	// 5. Verify Bot is an administrator in the channel
	member, err := tg.GetChatMember(ctx, chat.ID, bot.BotID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify bot membership status: %w", err)
	}
	if member != "administrator" && member != "creator" {
		return nil, fmt.Errorf("bot must be an administrator in the channel")
	}

	// 6. Get subscribers count
	count, err := tg.GetChatMemberCount(ctx, chat.ID)
	if err != nil {
		count = 0
	}

	// 7. Save channel to DB
	ch := &repository.ManagedChannel{
		BotID:              bot.ID,
		ChatID:             chat.ID,
		ChatTitle:          chat.Title,
		SubscribersCount:   count,
		SubscriptionStatus: "trial",
		TrialEndsAt:        time.Now().Add(72 * time.Hour),
		SignMessages:       false,
		ProtectContent:     false,
	}

	err = s.channelRepo.CreateChannel(ctx, ch)
	if err != nil {
		return nil, fmt.Errorf("failed to save channel to database: %w", err)
	}

	// 8. Log audit log
	slog.Info("Channel connected successfully", "channel_id", ch.ID, "title", chat.Title)
	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		ActorID:    ownerUserID,
		Action:     "channel.connect",
		TargetID:   &channelUsernameOrID,
	})

	metricStatus = "success"
	return ch, nil
}

func (s *ChannelService) DisconnectChannel(ctx context.Context, ownerUserID int64, channelID uuid.UUID) error {
	if err := s.verifyAccess(ctx, ownerUserID, channelID, RoleOwner); err != nil {
		return err
	}

	err := s.channelRepo.DeleteChannel(ctx, channelID)
	if err != nil {
		return err
	}

	target := channelID.String()
	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		ActorID:    ownerUserID,
		Action:     "channel.disconnect",
		TargetID:   &target,
	})
	return nil
}

func (s *ChannelService) ListChannels(ctx context.Context, ownerUserID int64, botID uuid.UUID, cursor *time.Time, limit int) ([]repository.ManagedChannel, *time.Time, error) {
	if botID == uuid.Nil {
		return s.channelRepo.GetChannelsByOwner(ctx, ownerUserID, cursor, limit)
	}

	// Verify bot ownership
	bot, err := s.botRepo.GetBotByID(ctx, botID)
	if err != nil {
		return nil, nil, err
	}
	if bot.OwnerUserID != ownerUserID {
		return nil, nil, fmt.Errorf("unauthorized")
	}

	return s.channelRepo.GetChannelsByBot(ctx, botID, cursor, limit)
}

type Role string

const (
	RoleOwner  Role = "owner"
	RoleAdmin  Role = "admin"
	RoleViewer Role = "viewer"
)

func (s *ChannelService) GetUserRole(ctx context.Context, userID int64, channelID uuid.UUID) (Role, error) {
	ch, err := s.channelRepo.GetChannelByID(ctx, channelID)
	if err != nil {
		return "", err
	}

	// 1. Check if they are the bot owner
	bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
	if err == nil && bot.OwnerUserID == userID {
		return RoleOwner, nil
	}

	// 2. Check channel_admins table
	admins, err := s.channelRepo.GetChannelAdmins(ctx, channelID)
	if err == nil {
		for _, admin := range admins {
			if admin.TelegramID == userID {
				if admin.IsOwner {
					return RoleOwner, nil
				}
				if admin.CustomTitle != nil && strings.Contains(strings.ToLower(*admin.CustomTitle), "viewer") {
					return RoleViewer, nil
				}
				return RoleAdmin, nil
			}
		}
	}

	return "", fmt.Errorf("unauthorized")
}

func (s *ChannelService) verifyAccess(ctx context.Context, userID int64, channelID uuid.UUID, allowedRoles ...Role) error {
	role, err := s.GetUserRole(ctx, userID, channelID)
	if err != nil {
		return err
	}

	for _, allowed := range allowedRoles {
		if role == allowed {
			return nil
		}
	}

	return fmt.Errorf("unauthorized: role %s not allowed", role)
}

func (s *ChannelService) GetChannel(ctx context.Context, ownerUserID int64, channelID uuid.UUID) (*repository.ManagedChannel, error) {
	if err := s.verifyAccess(ctx, ownerUserID, channelID, RoleOwner, RoleAdmin, RoleViewer); err != nil {
		return nil, err
	}
	return s.channelRepo.GetChannelByID(ctx, channelID)
}

// Settings CRUD

func (s *ChannelService) GetSettings(ctx context.Context, ownerUserID int64, channelID uuid.UUID) (*repository.ChannelSettings, error) {
	if _, err := s.GetChannel(ctx, ownerUserID, channelID); err != nil {
		return nil, err
	}
	return s.channelRepo.GetChannelSettings(ctx, channelID)
}

func (s *ChannelService) UpdateSettings(ctx context.Context, ownerUserID int64, channelID uuid.UUID, category string, data json.RawMessage, version int) (*repository.ChannelSettings, error) {
	oldSettings, err := s.GetSettings(ctx, ownerUserID, channelID)
	if err != nil {
		return nil, err
	}

	newSettings, err := s.channelRepo.UpdateChannelSettingsCategory(ctx, channelID, category, data, ownerUserID, version)
	if err != nil {
		return nil, err
	}

	// Audit Log
	var oldVal []byte
	switch category {
	case "general":
		oldVal = oldSettings.General
	case "posting":
		oldVal = oldSettings.Posting
	case "forwarding":
		oldVal = oldSettings.Forwarding
	case "inline_buttons":
		oldVal = oldSettings.InlineButtons
	case "dynamic_bio":
		oldVal = oldSettings.DynamicBio
	case "auto_responder":
		oldVal = oldSettings.AutoResponder
	}

	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		ActorID:  ownerUserID,
		Action:   "channel.settings.update." + category,
		OldValue: oldVal,
		NewValue: data,
	})

	return newSettings, nil
}

// Webhook & Interactive Handlers

func (s *ChannelService) ProcessChannelPost(ctx context.Context, chatID int64, messageID int, postText string, replyMarkup json.RawMessage) error {
	// 1. Inbound Forwarding Rules (Inbound copy/forward from other channels into ours)
	if os.Getenv("FEATURE_FLAG_FORWARDING") != "false" {
		inboundRules, err := s.channelRepo.GetActiveForwardingRulesBySource(ctx, strconv.FormatInt(chatID, 10))
		if err == nil && len(inboundRules) > 0 {
			for _, rule := range inboundRules {
				if rule.Direction != "inbound" {
					continue
				}

				destChan, err := s.channelRepo.GetChannelByID(ctx, rule.ChannelID)
				if err != nil {
					continue
				}

				bot, err := s.botRepo.GetBotByID(ctx, destChan.BotID)
				if err != nil {
					continue
				}

				token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
				if err != nil {
					continue
				}

				tg := telegram.NewBotAPIClient(token)
				if rule.Mode == "forward" {
					_ = tg.ForwardMessage(ctx, destChan.ChatID, chatID, messageID)
				} else {
					text := postText
					if rule.Mode == "ai" {
						text = "🤖 [AI Paraphrase] " + text + "\n\nParaphrased with iFragment AI."
					}
					if rule.Watermark != "" {
						text = text + "\n\n" + rule.Watermark
					}
					if rule.RemoveAds {
						text = strings.ReplaceAll(text, "#ad", "")
					}
					if rule.RemoveHashtags {
						text = removeHashtagsHelper(text)
					}
					if rule.RemoveLinks {
						text = removeLinksHelper(text)
					}
					_ = tg.SendMessage(ctx, destChan.ChatID, text, nil, nil)
				}
			}
		}
	}

	// Look up connected channel to see if it is managed directly (for Outbound/Auto-Responder)
	ch, err := s.channelRepo.GetChannelByChatID(ctx, chatID)
	if err != nil {
		return nil // Not managed directly, skip outbound/responder
	}

	settings, err := s.channelRepo.GetChannelSettings(ctx, ch.ID)
	if err != nil {
		return err
	}

	// 2. Outbound Forwarding Rules (Copy/forward from our managed channel to other channels/webhooks)
	if os.Getenv("FEATURE_FLAG_FORWARDING") != "false" {
		outboundRules, err := s.channelRepo.GetForwardingRules(ctx, ch.ID)
		if err == nil && len(outboundRules) > 0 {
			for _, rule := range outboundRules {
				if !rule.IsActive || rule.Direction != "outbound" {
					continue
				}

				bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
				if err != nil {
					continue
				}

				token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
				if err != nil {
					continue
				}

				tg := telegram.NewBotAPIClient(token)

				if rule.TargetType == "telegram" {
					var finalChatID int64
					if val, err := strconv.ParseInt(rule.Target, 10, 64); err == nil {
						finalChatID = val
					} else {
						targetUser := rule.Target
						if !strings.HasPrefix(targetUser, "@") {
							targetUser = "@" + targetUser
						}
						chatRes, err := tg.GetChat(ctx, targetUser)
						if err == nil && chatRes != nil {
							finalChatID = chatRes.ID
						}
					}

					if finalChatID != 0 {
						if rule.Mode == "forward" {
							_ = tg.ForwardMessage(ctx, finalChatID, chatID, messageID)
						} else {
							text := postText
							if rule.Mode == "ai" {
								text = "🤖 [AI Paraphrase] " + text + "\n\nParaphrased with iFragment AI."
							}
							if rule.Watermark != "" {
								text = text + "\n\n" + rule.Watermark
							}
							if rule.RemoveAds {
								text = strings.ReplaceAll(text, "#ad", "")
							}
							if rule.RemoveHashtags {
								text = removeHashtagsHelper(text)
							}
							if rule.RemoveLinks {
								text = removeLinksHelper(text)
							}
							_ = tg.SendMessage(ctx, finalChatID, text, nil, nil)
						}
					}
				} else if rule.TargetType == "webhook" {
					go func(targetURL string, msgText string) {
						payload := map[string]interface{}{
							"channel_id":   ch.ID,
							"chat_id":      chatID,
							"message_id":   messageID,
							"text":         msgText,
							"timestamp":    time.Now().Unix(),
						}
						body, _ := json.Marshal(payload)
						_, _ = http.Post(targetURL, "application/json", bytes.NewBuffer(body))
					}(rule.Target, postText)
				}
			}
		}
	}

	// 3. Auto-Responder logic
	if os.Getenv("FEATURE_FLAG_AUTORESPONDER") != "false" {
		var responderConfig struct {
			Enabled bool `json:"enabled"`
			Rules   []struct {
				Trigger  string `json:"trigger"`
				Response string `json:"response"`
				Type     string `json:"type"`
			} `json:"rules"`
		}
		if err := json.Unmarshal(settings.AutoResponder, &responderConfig); err == nil && responderConfig.Enabled {
			for _, rule := range responderConfig.Rules {
				matched := false
				if rule.Type == "exact" && strings.EqualFold(strings.TrimSpace(postText), strings.TrimSpace(rule.Trigger)) {
					matched = true
				} else if rule.Type == "contains" && strings.Contains(strings.ToLower(postText), strings.ToLower(rule.Trigger)) {
					matched = true
				}
				if matched {
					telemetry.RecordAutoresponderMatch(rule.Type)
					// Send auto response message back to channel
					bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
					if err == nil {
						token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
						tg := telegram.NewBotAPIClient(token)
						_ = tg.SendMessage(ctx, chatID, rule.Response, nil, nil)
					}
					break
				}
			}
		}
	}

	return nil
}

// GetAuditLogs fetches paginated audit logs for a managed channel
func (s *ChannelService) GetAuditLogs(ctx context.Context, ownerUserID int64, channelID uuid.UUID, limit, offset int) ([]repository.ChannelAuditLog, error) {
	// Verify ownership first
	if _, err := s.GetChannel(ctx, ownerUserID, channelID); err != nil {
		return nil, err
	}

	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	return s.channelRepo.GetAuditLogs(ctx, channelID, limit, offset)
}

// GetAnalytics fetches daily analytics timeline snapshots for a managed channel
func (s *ChannelService) GetAnalytics(ctx context.Context, ownerUserID int64, channelID uuid.UUID, days int) ([]repository.ChannelAnalytics, error) {
	// Verify ownership first
	if _, err := s.GetChannel(ctx, ownerUserID, channelID); err != nil {
		return nil, err
	}

	if days <= 0 {
		days = 7
	}

	return s.channelRepo.GetAnalyticsTimeline(ctx, channelID, days)
}

// CreatePost creates a new post which will be either published immediately or scheduled for later
func (s *ChannelService) CreatePost(ctx context.Context, ownerUserID int64, post *repository.ChannelPost) error {
	// Verify ownership
	ch, err := s.GetChannel(ctx, ownerUserID, post.ChannelID)
	if err != nil {
		return err
	}

	post.AuthorUserID = &ownerUserID

	// If no scheduling date is provided, publish immediately
	if post.ScheduledAt == nil || post.ScheduledAt.Before(time.Now()) {
		bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
		if err != nil {
			return fmt.Errorf("bot not found for channel: %w", err)
		}

		token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		if err != nil {
			return fmt.Errorf("failed to decrypt bot token: %w", err)
		}

		tg := telegram.NewBotAPIClient(token)
		res, err := tg.SendMessageWithResult(ctx, ch.ChatID, post.Text, nil, nil)
		if err != nil {
			return fmt.Errorf("failed to send message via telegram: %w", err)
		}

		telegramMsgID := int64(res.MessageID)
		post.TelegramMessageID = telegramMsgID
		now := time.Now()
		post.PostedAt = &now
	}

	err = s.channelRepo.CreatePost(ctx, post)
	if err != nil {
		return fmt.Errorf("failed to create post in repository: %w", err)
	}

	// Audit Log
	meta, _ := json.Marshal(map[string]interface{}{"post_id": post.ID})
	_ = s.channelRepo.LogAudit(ctx, &repository.ChannelAuditLog{
		ChannelID: ch.ID,
		ActorID:   ownerUserID,
		Action:    "channel.post.create",
		Metadata:  meta,
	})

	return nil
}

// StartBackgroundTasks initializes the concurrent background routines for post scheduling and daily analytics
func (s *ChannelService) StartBackgroundTasks(ctx context.Context) {
	slog.Info("Starting Channel background workers...")
	go s.scheduledPostWorker(ctx)
	go s.analyticsSnapshotWorker(ctx)
}

func (s *ChannelService) scheduledPostWorker(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Scheduled Post Worker stopped due to context cancellation")
			return
		case <-ticker.C:
			posts, err := s.channelRepo.GetScheduledPosts(ctx)
			if err != nil {
				slog.Error("Failed to fetch scheduled posts in worker", "error", err)
				continue
			}

			for _, post := range posts {
				ch, err := s.channelRepo.GetChannelByID(ctx, post.ChannelID)
				if err != nil {
					slog.Error("Failed to fetch channel for scheduled post", "post_id", post.ID, "error", err)
					continue
				}

				bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
				if err != nil {
					slog.Error("Failed to fetch bot for scheduled post", "post_id", post.ID, "error", err)
					continue
				}

				token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
				if err != nil {
					slog.Error("Failed to decrypt bot token in scheduled post worker", "post_id", post.ID, "error", err)
					continue
				}

				tg := telegram.NewBotAPIClient(token)
				res, err := tg.SendMessageWithResult(ctx, ch.ChatID, post.Text, nil, nil)
				if err != nil {
					slog.Error("Failed to send scheduled message via telegram in worker", "post_id", post.ID, "error", err)
					continue
				}

				err = s.channelRepo.MarkPostAsPublished(ctx, post.ID, int64(res.MessageID))
				if err != nil {
					slog.Error("Failed to mark scheduled post as published in db", "post_id", post.ID, "error", err)
					continue
				}

				// Log background audit
				meta, _ := json.Marshal(map[string]interface{}{"post_id": post.ID, "message_id": res.MessageID})
				_ = s.channelRepo.LogAudit(ctx, &repository.ChannelAuditLog{
					ChannelID: ch.ID,
					ActorID:   bot.OwnerUserID,
					Action:    "channel.post.published_scheduled",
					Metadata:  meta,
				})

				slog.Info("Successfully published scheduled post", "post_id", post.ID, "channel_id", ch.ID)
			}
		}
	}
}

func (s *ChannelService) analyticsSnapshotWorker(ctx context.Context) {
	// Execute immediately on startup
	s.runAnalyticsSnapshot(ctx)

	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Daily Analytics Worker stopped due to context cancellation")
			return
		case <-ticker.C:
			s.runAnalyticsSnapshot(ctx)
		}
	}
}

func (s *ChannelService) runAnalyticsSnapshot(ctx context.Context) {
	slog.Info("Running daily channel analytics snapshot generation...")
	channels, err := s.channelRepo.GetAllChannels(ctx)
	if err != nil {
		slog.Error("Failed to retrieve channels for daily analytics", "error", err)
		return
	}

	for _, ch := range channels {
		bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
		if err != nil {
			slog.Error("Failed to fetch bot for analytics channel", "channel_id", ch.ID, "error", err)
			continue
		}

		token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		if err != nil {
			slog.Error("Failed to decrypt bot token for analytics", "channel_id", ch.ID, "error", err)
			continue
		}

		tg := telegram.NewBotAPIClient(token)
		currentCount, err := tg.GetChatMemberCount(ctx, ch.ChatID)
		if err != nil {
			slog.Error("Failed to fetch current telegram subscriber count for analytics", "channel_id", ch.ID, "error", err)
			continue
		}

		newSubscribers := currentCount - ch.SubscribersCount
		if newSubscribers < 0 {
			newSubscribers = 0
		}

		// Save Snapshot date as truncated to midnight
		now := time.Now()
		snapshotDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

		snapshot := &repository.ChannelAnalytics{
			ChannelID:        ch.ID,
			SnapshotDate:     snapshotDate,
			SubscribersCount: currentCount,
			NewSubscribers:   newSubscribers,
			ViewsCount:       0,
			ReactionsCount:   0,
			PostsCount:       0,
		}

		err = s.channelRepo.SaveAnalyticsSnapshot(ctx, snapshot)
		if err != nil {
			slog.Error("Failed to save analytics snapshot", "channel_id", ch.ID, "error", err)
			continue
		}

		err = s.channelRepo.UpdateChannelSubscribers(ctx, ch.ID, currentCount)
		if err != nil {
			slog.Error("Failed to update channel cached subscriber count", "channel_id", ch.ID, "error", err)
		}

		slog.Info("Completed daily analytics snapshot for channel", "channel_id", ch.ID, "subscribers", currentCount)
	}
}

// GetForwardingRules fetches all forwarding rules for a channel
func (s *ChannelService) GetForwardingRules(ctx context.Context, ownerUserID int64, channelID uuid.UUID) ([]repository.ChannelForwardingRule, error) {
	// Verify ownership first
	if _, err := s.GetChannel(ctx, ownerUserID, channelID); err != nil {
		return nil, err
	}

	return s.channelRepo.GetForwardingRules(ctx, channelID)
}

// CreateForwardingRule creates a new channel forwarding rule
func (s *ChannelService) CreateForwardingRule(ctx context.Context, ownerUserID int64, rule *repository.ChannelForwardingRule) error {
	// Verify ownership first
	ch, err := s.GetChannel(ctx, ownerUserID, rule.ChannelID)
	if err != nil {
		return err
	}

	err = s.channelRepo.CreateForwardingRule(ctx, rule)
	if err != nil {
		return err
	}

	// Audit Log
	meta, _ := json.Marshal(map[string]interface{}{"rule_id": rule.ID, "target": rule.Target})
	_ = s.channelRepo.LogAudit(ctx, &repository.ChannelAuditLog{
		ChannelID: ch.ID,
		ActorID:   ownerUserID,
		Action:    "channel.forwarding.rule.create",
		Metadata:  meta,
	})

	return nil
}

// UpdateForwardingRule updates an existing forwarding rule
func (s *ChannelService) UpdateForwardingRule(ctx context.Context, ownerUserID int64, rule *repository.ChannelForwardingRule) error {
	// Verify ownership first
	ch, err := s.GetChannel(ctx, ownerUserID, rule.ChannelID)
	if err != nil {
		return err
	}

	err = s.channelRepo.UpdateForwardingRule(ctx, rule)
	if err != nil {
		return err
	}

	// Audit Log
	meta, _ := json.Marshal(map[string]interface{}{"rule_id": rule.ID, "target": rule.Target})
	_ = s.channelRepo.LogAudit(ctx, &repository.ChannelAuditLog{
		ChannelID: ch.ID,
		ActorID:   ownerUserID,
		Action:    "channel.forwarding.rule.update",
		Metadata:  meta,
	})

	return nil
}

// DeleteForwardingRule deletes a forwarding rule
func (s *ChannelService) DeleteForwardingRule(ctx context.Context, ownerUserID int64, channelID uuid.UUID, ruleID uuid.UUID) error {
	// Verify ownership first
	if _, err := s.GetChannel(ctx, ownerUserID, channelID); err != nil {
		return err
	}

	err := s.channelRepo.DeleteForwardingRule(ctx, ruleID)
	if err != nil {
		return err
	}

	// Audit Log
	meta, _ := json.Marshal(map[string]interface{}{"rule_id": ruleID})
	_ = s.channelRepo.LogAudit(ctx, &repository.ChannelAuditLog{
		ChannelID: channelID,
		ActorID:   ownerUserID,
		Action:    "channel.forwarding.rule.delete",
		Metadata:  meta,
	})

	return nil
}

// SyncAdmins synchronizes Telegram administrators list locally
func (s *ChannelService) SyncAdmins(ctx context.Context, ownerUserID int64, channelID uuid.UUID) error {
	ch, err := s.GetChannel(ctx, ownerUserID, channelID)
	if err != nil {
		return err
	}

	bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
	if err != nil {
		return err
	}

	token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	if err != nil {
		return err
	}

	tg := telegram.NewBotAPIClient(token)
	adminsTG, err := tg.GetChatAdministrators(ctx, ch.ChatID)
	if err != nil {
		return err
	}

	var admins []repository.ChannelAdmin
	for _, a := range adminsTG {
		usernameCopy := a.User.Username
		customTitleCopy := a.CustomTitle
		admins = append(admins, repository.ChannelAdmin{
			ChannelID:   channelID,
			TelegramID:  a.User.ID,
			Username:    &usernameCopy,
			FirstName:   a.User.FirstName,
			CustomTitle: &customTitleCopy,
			IsOwner:     a.Status == "creator",
		})
	}

	err = s.channelRepo.SyncChannelAdmins(ctx, channelID, admins)
	if err != nil {
		return err
	}

	// Audit Log
	_ = s.channelRepo.LogAudit(ctx, &repository.ChannelAuditLog{
		ChannelID: channelID,
		ActorID:   ownerUserID,
		Action:    "channel.admins.sync",
	})

	return nil
}

// GetAdmins returns local administrators list for a channel
func (s *ChannelService) GetAdmins(ctx context.Context, ownerUserID int64, channelID uuid.UUID) ([]repository.ChannelAdmin, error) {
	// Verify ownership first
	if _, err := s.GetChannel(ctx, ownerUserID, channelID); err != nil {
		return nil, err
	}

	return s.channelRepo.GetChannelAdmins(ctx, channelID)
}

// GetButtons returns inline buttons list for a channel
func (s *ChannelService) GetButtons(ctx context.Context, ownerUserID int64, channelID uuid.UUID) ([]repository.ChannelInlineButton, error) {
	// Verify ownership first
	if _, err := s.GetChannel(ctx, ownerUserID, channelID); err != nil {
		return nil, err
	}

	return s.channelRepo.GetChannelButtons(ctx, channelID)
}

// SaveButtons synchronizes interactive inline buttons for a channel
func (s *ChannelService) SaveButtons(ctx context.Context, ownerUserID int64, channelID uuid.UUID, buttons []repository.ChannelInlineButton) error {
	// Verify ownership first
	if _, err := s.GetChannel(ctx, ownerUserID, channelID); err != nil {
		return err
	}

	// Make sure channel ID is bound
	for i := range buttons {
		buttons[i].ChannelID = channelID
	}

	err := s.channelRepo.SaveChannelButtons(ctx, channelID, buttons)
	if err != nil {
		return err
	}

	// Audit Log
	_ = s.channelRepo.LogAudit(ctx, &repository.ChannelAuditLog{
		ChannelID: channelID,
		ActorID:   ownerUserID,
		Action:    "channel.buttons.update",
	})

	return nil
}

// RegisterButtonClick increments click count of an inline button
func (s *ChannelService) RegisterButtonClick(ctx context.Context, buttonID uuid.UUID) error {
	return s.channelRepo.IncrementButtonClicks(ctx, buttonID)
}

// Helper Functions

func removeHashtagsHelper(text string) string {
	words := strings.Fields(text)
	var out []string
	for _, w := range words {
		if !strings.HasPrefix(w, "#") {
			out = append(out, w)
		}
	}
	return strings.Join(out, " ")
}

func removeLinksHelper(text string) string {
	words := strings.Fields(text)
	var out []string
	for _, w := range words {
		if !strings.HasPrefix(w, "http://") && !strings.HasPrefix(w, "https://") && !strings.Contains(w, ".com") {
			out = append(out, w)
		}
	}
	return strings.Join(out, " ")
}

func parseChatIDOrUsername(target string) interface{} {
	if strings.HasPrefix(target, "-100") || strings.HasPrefix(target, "-") {
		if val, err := strconv.ParseInt(target, 10, 64); err == nil {
			return val
		}
	}
	if !strings.HasPrefix(target, "@") {
		return "@" + target
	}
	return target
}

func (s *ChannelService) GetChannelByChatID(ctx context.Context, chatID int64) (*repository.ManagedChannel, error) {
	return s.channelRepo.GetChannelByChatID(ctx, chatID)
}

func (s *ChannelService) GetButtonByID(ctx context.Context, buttonID uuid.UUID) (*repository.ChannelInlineButton, error) {
	return s.channelRepo.GetButtonByID(ctx, buttonID)
}

func (s *ChannelService) GetChannelButtonsByChannelID(ctx context.Context, channelID uuid.UUID) ([]repository.ChannelInlineButton, error) {
	return s.channelRepo.GetChannelButtons(ctx, channelID)
}


