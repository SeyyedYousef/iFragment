package channelmgmt

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"
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
	chat, err := tg.GetChat(targetChat)
	if err != nil {
		return nil, fmt.Errorf("failed to locate channel: %w", err)
	}
	if chat.Type != "channel" {
		return nil, fmt.Errorf("located chat is not a channel: type=%s", chat.Type)
	}

	// 5. Verify Bot is an administrator in the channel
	member, err := tg.GetChatMember(chat.ID, bot.BotID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify bot membership status: %w", err)
	}
	if member != "administrator" && member != "creator" {
		return nil, fmt.Errorf("bot must be an administrator in the channel")
	}

	// 6. Get subscribers count
	count, err := tg.GetChatMemberCount(chat.ID)
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

	return ch, nil
}

func (s *ChannelService) DisconnectChannel(ctx context.Context, ownerUserID int64, channelID uuid.UUID) error {
	ch, err := s.channelRepo.GetChannelByID(ctx, channelID)
	if err != nil {
		return err
	}

	bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
	if err != nil {
		return err
	}
	if bot.OwnerUserID != ownerUserID {
		return fmt.Errorf("unauthorized")
	}

	err = s.channelRepo.DeleteChannel(ctx, channelID)
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

func (s *ChannelService) ListChannels(ctx context.Context, ownerUserID int64, botID uuid.UUID) ([]repository.ManagedChannel, error) {
	if botID == uuid.Nil {
		return s.channelRepo.GetChannelsByOwner(ctx, ownerUserID)
	}

	// Verify bot ownership
	bot, err := s.botRepo.GetBotByID(ctx, botID)
	if err != nil {
		return nil, err
	}
	if bot.OwnerUserID != ownerUserID {
		return nil, fmt.Errorf("unauthorized")
	}

	return s.channelRepo.GetChannelsByBot(ctx, botID)
}

func (s *ChannelService) GetChannel(ctx context.Context, ownerUserID int64, channelID uuid.UUID) (*repository.ManagedChannel, error) {
	ch, err := s.channelRepo.GetChannelByID(ctx, channelID)
	if err != nil {
		return nil, err
	}

	bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
	if err != nil {
		return nil, err
	}
	if bot.OwnerUserID != ownerUserID {
		return nil, fmt.Errorf("unauthorized")
	}

	return ch, nil
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

func (s *ChannelService) ProcessChannelPost(ctx context.Context, chatID int64, postText string, replyMarkup json.RawMessage) error {
	// Look up connected channel
	ch, err := s.channelRepo.GetChannelByChatID(ctx, chatID)
	if err != nil {
		return nil // Not managed
	}

	settings, err := s.channelRepo.GetChannelSettings(ctx, ch.ID)
	if err != nil {
		return err
	}

	// Auto-Responder logic
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
				// Send auto response message back to channel
				bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
				if err == nil {
					token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
					tg := telegram.NewBotAPIClient(token)
					_ = tg.SendMessage(chatID, rule.Response, nil, nil)
				}
				break
			}
		}
	}

	return nil
}
