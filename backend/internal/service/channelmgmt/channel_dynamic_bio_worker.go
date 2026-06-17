package channelmgmt

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"
)

type DynamicBioConfig struct {
	Enabled           bool   `json:"enabled"`
	BioTemplate       string `json:"bioTemplate"`
	DisplayInName     bool   `json:"displayInName"`
	NameTemplate      string `json:"nameTemplate"`
	Interval          string `json:"interval"`
	EnableCountdown   bool   `json:"enableCountdown"`
	EventName         string `json:"eventName"`
	TargetDate        string `json:"targetDate"`
	CountdownLocation string `json:"countdownLocation"`
	PostExpiryText    string `json:"postExpiryText"`
}

func (s *ChannelService) dynamicBioWorker(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Minute) // Base poll interval
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Dynamic Bio Worker stopped due to context cancellation")
			return
		case <-ticker.C:
			s.processDynamicBios(ctx)
		}
	}
}

func (s *ChannelService) processDynamicBios(ctx context.Context) {
	// Fetch all connected channels
	channels, err := s.channelRepo.GetAllChannels(ctx)
	if err != nil {
		slog.Error("Failed to list channels for dynamic bio", "error", err)
		return
	}

	for _, ch := range channels {
		settings, err := s.channelRepo.GetChannelSettings(ctx, ch.ID)
		if err != nil || settings == nil {
			continue
		}

		var config DynamicBioConfig
		if err := json.Unmarshal(settings.DynamicBio, &config); err != nil {
			continue
		}

		if !config.Enabled {
			continue
		}

		s.updateChannelDynamicBio(ctx, &ch, config)
		time.Sleep(1 * time.Second) // Prevent Telegram Rate Limit (30 req/sec)
	}
}

func (s *ChannelService) updateChannelDynamicBio(ctx context.Context, ch *repository.ManagedChannel, config DynamicBioConfig) {
	bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
	if err != nil {
		return
	}

	token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	if err != nil {
		return
	}

	tg := telegram.NewBotAPIClient(token)

	// Fetch variables
	memberCount := "0"
	if count, err := tg.GetChatMemberCount(ctx, ch.ChatID); err == nil {
		memberCount = fmt.Sprintf("%d", count)
	}

	now := time.Now()
	timeStr := now.Format("15:04")
	dateStr := now.Format("02 Jan 2006")
	dayStr := now.Format("Monday")

	// Calculate countdown
	countdownStr := ""
	if config.EnableCountdown && config.TargetDate != "" {
		target, err := time.Parse("2006-01-02T15:04", config.TargetDate)
		if err == nil {
			diff := target.Sub(now)
			if diff > 0 {
				hours := int(diff.Hours())
				mins := int(diff.Minutes()) % 60
				secs := int(diff.Seconds()) % 60
				countdownStr = fmt.Sprintf("%02d:%02d:%02d", hours, mins, secs)
			} else {
				countdownStr = config.PostExpiryText
			}
		}
	}

	replaceVars := func(template string) string {
		res := template
		res = strings.ReplaceAll(res, "$members", memberCount)
		res = strings.ReplaceAll(res, "$time", timeStr)
		res = strings.ReplaceAll(res, "$date", dateStr)
		res = strings.ReplaceAll(res, "$day_name", dayStr)
		if config.EnableCountdown {
			res = strings.ReplaceAll(res, "$countdown", countdownStr)
		}
		// TODO: Add crypto variables if needed by platform
		return res
	}

	if config.BioTemplate != "" {
		newBio := replaceVars(config.BioTemplate)
		_ = tg.SetChatDescription(ctx, ch.ChatID, newBio)
	}

	if config.DisplayInName && config.NameTemplate != "" {
		newName := replaceVars(config.NameTemplate)
		_ = tg.SetChatTitle(ctx, ch.ChatID, newName)
	}
}
