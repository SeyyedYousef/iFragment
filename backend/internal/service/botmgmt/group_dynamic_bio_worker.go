package botmgmt

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
)

type GroupDynamicBioConfig struct {
	Enabled       bool   `json:"enabled"`
	BioTemplate   string `json:"bioTemplate"`
	DisplayInName bool   `json:"displayInName"`
	NameTemplate  string `json:"nameTemplate"`
	Interval      string `json:"interval"` // "10m", "30m", "1h", "24h"
}

func (s *BotService) dynamicBioWorker(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute) // Check every minute
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Group Dynamic Bio Worker stopped due to context cancellation")
			return
		case <-ticker.C:
			s.processGroupDynamicBios(ctx)
		}
	}
}

func (s *BotService) processGroupDynamicBios(ctx context.Context) {
	// Fetch all active groups
	groups, err := s.botRepo.GetAllActiveGroups(ctx)
	if err != nil {
		slog.Error("Failed to list groups for dynamic bio", "error", err)
		return
	}

	for _, g := range groups {
		settings, err := s.settingsRepo.GetSettings(ctx, g.ID)
		if err != nil || settings == nil {
			continue
		}

		var config GroupDynamicBioConfig
		if err := json.Unmarshal(settings.DynamicBio, &config); err != nil {
			continue
		}

		if !config.Enabled {
			continue
		}

		// Check interval
		intervalDuration := 10 * time.Minute // default
		switch config.Interval {
		case "10m":
			intervalDuration = 10 * time.Minute
		case "30m":
			intervalDuration = 30 * time.Minute
		case "1h":
			intervalDuration = 1 * time.Hour
		case "24h":
			intervalDuration = 24 * time.Hour
		}

		lastUpdateVal, ok := s.lastBioUpdate.Load(g.ID)
		if ok {
			lastUpdate := lastUpdateVal.(time.Time)
			if time.Since(lastUpdate) < intervalDuration {
				continue // Skip, interval not reached
			}
		}

		s.updateGroupDynamicBio(ctx, &g, config)
		s.lastBioUpdate.Store(g.ID, time.Now())
		time.Sleep(1 * time.Second) // Prevent Telegram Rate Limit
	}
}

func (s *BotService) updateGroupDynamicBio(ctx context.Context, g *repository.ManagedGroup, config GroupDynamicBioConfig) {
	bot, err := s.botRepo.GetBotByID(ctx, g.BotID)
	if err != nil {
		return
	}

	token, err := DecryptToken(bot.BotTokenEncrypted)
	if err != nil {
		return
	}

	tg := telegram.NewBotAPIClient(token)

	// Fetch variables
	memberCount := "0"
	if count, err := tg.GetChatMemberCount(ctx, g.ChatID); err == nil {
		memberCount = fmt.Sprintf("%d", count)
	}

	now := time.Now()
	timeStr := now.Format("15:04")
	dateStr := now.Format("02 Jan 2006")
	dayStr := now.Format("Monday")

	replaceVars := func(template string) string {
		res := template
		res = strings.ReplaceAll(res, "$members", memberCount)
		res = strings.ReplaceAll(res, "$time", timeStr)
		res = strings.ReplaceAll(res, "$date", dateStr)
		res = strings.ReplaceAll(res, "$day_name", dayStr)

		return res
	}

	if config.BioTemplate != "" {
		newBio := replaceVars(config.BioTemplate)
		_ = tg.SetChatDescription(ctx, g.ChatID, newBio)
	}

	if config.DisplayInName && config.NameTemplate != "" {
		newName := replaceVars(config.NameTemplate)
		_ = tg.SetChatTitle(ctx, g.ChatID, newName)
	}
}
