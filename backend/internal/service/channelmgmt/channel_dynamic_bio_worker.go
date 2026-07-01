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
	Enabled           bool        `json:"enabled"`
	BioTemplate       string      `json:"bioTemplate"`
	DisplayInName     bool        `json:"displayInName"`
	NameTemplate      string      `json:"nameTemplate"`
	Interval          interface{} `json:"interval"` // "10m", "30m", "1h", "24h" or minutes integer
	EnableCountdown   bool        `json:"enableCountdown"`
	EventName         string      `json:"eventName"`
	TargetDate        string      `json:"targetDate"`
	CountdownLocation string      `json:"countdownLocation"`
	PostExpiryText    string      `json:"postExpiryText"`
}

func (s *ChannelService) dynamicBioWorker(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute) // Check every 5 minutes to reduce load
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Dynamic Bio Worker stopped due to context cancellation")
			return
		case <-ticker.C:
			// Ensure only one worker runs globally using Redis lock
			cache := s.channelRepo.GetCache()
			if cache != nil && cache.Client != nil {
				locked, _ := cache.Client.SetNX(ctx, "lock:dynamic_bio_worker", "1", 4*time.Minute).Result()
				if !locked {
					continue // Another instance is already processing
				}
			}

			s.processDynamicBios(ctx)
		}
	}
}

func (s *ChannelService) processDynamicBios(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("Recovered from panic in dynamicBioWorker", "panic", r)
		}
	}()

	// Fetch all connected channels
	channels, err := s.channelRepo.GetAllChannels(ctx)
	if err != nil {
		slog.Error("Failed to list channels for dynamic bio", "error", err)
		return
	}

	for _, ch := range channels {
		// Quick local cache check to skip DB query if updated very recently
		lastUpdateVal, ok := s.lastBioUpdate.Load(ch.ID)
		if ok {
			lastUpdate := lastUpdateVal.(time.Time)
			if time.Since(lastUpdate) < 9*time.Minute {
				continue // Skip immediately without hitting DB
			}
		}

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

		// Check interval
		intervalMinutes, err := normalizeDynamicBioInterval(config.Interval)
		if err != nil {
			intervalMinutes = 10 // default fallback
		}
		intervalDuration := time.Duration(intervalMinutes) * time.Minute
		if intervalDuration <= 0 {
			intervalDuration = 10 * time.Minute
		}

		if ok {
			lastUpdate := lastUpdateVal.(time.Time)
			if time.Since(lastUpdate) < intervalDuration {
				continue // Skip, interval not reached
			}
		}

		// Update in background so one failure doesn't block others
		s.wg.Add(1)
		chCopy := ch
		configCopy := config
		GoSafe(func() {
			defer s.wg.Done()
			bgCtx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
			defer cancel()
			s.updateChannelDynamicBio(bgCtx, &chCopy, configCopy)
		})
		
		s.lastBioUpdate.Store(ch.ID, time.Now())
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

	countdownStr := ""
	if config.EnableCountdown && config.TargetDate != "" {
		targetTime, err := time.Parse("2006-01-02", config.TargetDate)
		if err == nil {
			nowZero := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
			targetZero := time.Date(targetTime.Year(), targetTime.Month(), targetTime.Day(), 0, 0, 0, 0, now.Location())
			
			diff := targetZero.Sub(nowZero)
			days := int(diff.Hours() / 24)
			
			if days > 0 {
				countdownStr = fmt.Sprintf("%d days", days)
			} else if days == 0 {
				countdownStr = "Today!"
			} else {
				if config.PostExpiryText != "" {
					countdownStr = config.PostExpiryText
				} else {
					countdownStr = "Ended"
				}
			}
		}
	}

	replaceVars := func(template string) string {
		res := template
		res = strings.ReplaceAll(res, "$members", memberCount)
		res = strings.ReplaceAll(res, "$time", timeStr)
		res = strings.ReplaceAll(res, "$date", dateStr)
		res = strings.ReplaceAll(res, "$day_name", dayStr)
		res = strings.ReplaceAll(res, "$countdown", countdownStr)
		res = strings.ReplaceAll(res, "$event", config.EventName)
		
		if s.cryptoSvc != nil {
			res = strings.ReplaceAll(res, "$btc", s.cryptoSvc.GetPrice("bitcoin"))
			res = strings.ReplaceAll(res, "$eth", s.cryptoSvc.GetPrice("ethereum"))
			res = strings.ReplaceAll(res, "$Gram", s.cryptoSvc.GetPrice("the-open-network"))
			res = strings.ReplaceAll(res, "$sol", s.cryptoSvc.GetPrice("solana"))
			res = strings.ReplaceAll(res, "$ton", s.cryptoSvc.GetPrice("the-open-network"))
		}

		return res
	}

	if config.BioTemplate != "" {
		newBio := replaceVars(config.BioTemplate)
		if err := tg.SetChatDescription(ctx, ch.ChatID, newBio); err != nil {
			slog.Error("Failed to update channel bio", "channelID", ch.ChatID, "error", err)
		}
	}

	if config.DisplayInName && config.NameTemplate != "" {
		newName := replaceVars(config.NameTemplate)
		if err := tg.SetChatTitle(ctx, ch.ChatID, newName); err != nil {
			slog.Error("Failed to update channel title", "channelID", ch.ChatID, "error", err)
		}
	}
}
