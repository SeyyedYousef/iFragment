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

	"github.com/google/uuid"
)

type DynamicBioConfig struct {
	Enabled           bool        `json:"enabled"`
	Target            string      `json:"target,omitempty"` // "input" or "output"
	BioTemplate       string      `json:"bioTemplate,omitempty"`
	BioTemplateSnake string      `json:"bio_template,omitempty"`
	DisplayInName     bool        `json:"displayInName"`
	DisplayInNameS    bool        `json:"display_in_name,omitempty"`
	NameTemplate      string      `json:"nameTemplate,omitempty"`
	NameTemplateSnake string     `json:"name_template,omitempty"`
	Interval          interface{} `json:"interval"` // "10m", "30m", "1h", "24h" or minutes integer
	EnableCountdown   bool        `json:"enableCountdown"`
	EnableCountdownS  bool        `json:"enable_countdown,omitempty"`
	EventName         string      `json:"eventName,omitempty"`
	TargetDate        string      `json:"targetDate,omitempty"`
	CountdownLocation string      `json:"countdownLocation,omitempty"`
	PostExpiryText    string      `json:"postExpiryText,omitempty"`
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

	// 1. Process Dynamic Bio for Projects (Controlled exclusively at the Project level)
	projects, pErr := s.channelRepo.GetAllActiveProjects(ctx)
	if pErr == nil && len(projects) > 0 {
		for _, p := range projects {
			if !isProjectSubscriptionValid(p) || len(p.PipelineConfig) == 0 {
				continue
			}

			var pCfg map[string]interface{}
			if err := json.Unmarshal(p.PipelineConfig, &pCfg); err != nil {
				continue
			}

			bioRaw, hasBio := pCfg["dynamic_bio"]
			if !hasBio || bioRaw == nil {
				continue
			}

			bioBytes, _ := json.Marshal(bioRaw)
			var config DynamicBioConfig
			if err := json.Unmarshal(bioBytes, &config); err != nil || !config.Enabled {
				continue
			}

			// Resolve target channel: Input vs Output
			var targetChatID int64
			var targetChannelID *uuid.UUID
			targetType := strings.ToLower(strings.TrimSpace(config.Target))
			if targetType == "input" {
				if p.SourceChatID != nil && *p.SourceChatID != 0 {
					targetChatID = *p.SourceChatID
				}
				targetChannelID = p.SourceChannelID
			} else {
				// Default to output channel
				if p.TargetChatID != nil && *p.TargetChatID != 0 {
					targetChatID = *p.TargetChatID
				}
				targetChannelID = p.TargetChannelID
			}

			if targetChatID == 0 && targetChannelID != nil {
				if ch, chErr := s.channelRepo.GetChannelByID(ctx, *targetChannelID); chErr == nil && ch != nil {
					targetChatID = ch.ChatID
				}
			}

			if targetChatID == 0 {
				continue
			}

			// Interval check
			cacheKey := fmt.Sprintf("proj_bio:%s:%s", p.ID.String(), targetType)
			lastUpdateVal, ok := s.lastBioUpdate.Load(cacheKey)
			intervalMinutes, err := normalizeDynamicBioInterval(config.Interval)
			if err != nil || intervalMinutes < 10 {
				intervalMinutes = 10
			}
			intervalDuration := time.Duration(intervalMinutes) * time.Minute

			if ok {
				lastUpdate := lastUpdateVal.(time.Time)
				if time.Since(lastUpdate) < intervalDuration {
					continue
				}
			}

			// Resolve bot client for target channel
			_, tg := s.resolveBotClientForChat(ctx, targetChatID, nil)
			if tg == nil {
				continue
			}

			s.wg.Add(1)
			configCopy := config
			targetChatIDCopy := targetChatID
			cacheKeyCopy := cacheKey
			GoSafe(func() {
				defer s.wg.Done()
				bgCtx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
				defer cancel()
				s.updateChatDynamicBio(bgCtx, targetChatIDCopy, cacheKeyCopy, configCopy, tg)
			})

			s.lastBioUpdate.Store(cacheKey, time.Now())
		}
	}

	// 2. Fetch all connected channels (Legacy Channel Settings fallback)
	channels, err := s.channelRepo.GetAllChannels(ctx)
	if err != nil {
		slog.Error("Failed to list channels for dynamic bio", "error", err)
		return
	}

	for _, ch := range channels {
		// Quick local cache check to skip DB query if updated very recently
		lastUpdateVal, ok := s.lastBioUpdate.Load(ch.ID.String())
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

		// Check interval (enforce hard minimum 10 minutes to protect channel)
		intervalMinutes, err := normalizeDynamicBioInterval(config.Interval)
		if err != nil || intervalMinutes < 10 {
			intervalMinutes = 10 // safe fallback
		}
		intervalDuration := time.Duration(intervalMinutes) * time.Minute

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

		s.lastBioUpdate.Store(ch.ID.String(), time.Now())
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
	s.updateChatDynamicBio(ctx, ch.ChatID, ch.ID.String(), config, tg)
}

func (s *ChannelService) updateChatDynamicBio(ctx context.Context, chatID int64, entityKey string, config DynamicBioConfig, tg *telegram.BotAPIClient) {
	// Fetch variables
	memberCount := "0"
	if count, err := tg.GetChatMemberCount(ctx, chatID); err == nil {
		memberCount = fmt.Sprintf("%d", count)
	}

	now := time.Now().UTC()
	timeStr := now.Format("15:04")
	dateStr := now.Format("02 Jan 2006")
	dayStr := now.Format("Monday")

	countdownStr := ""
	if (config.EnableCountdown || config.EnableCountdownS) && config.TargetDate != "" {
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

	bioTmpl := config.BioTemplate
	if bioTmpl == "" {
		bioTmpl = config.BioTemplateSnake
	}
	nameTmpl := config.NameTemplate
	if nameTmpl == "" {
		nameTmpl = config.NameTemplateSnake
	}
	displayInName := config.DisplayInName || config.DisplayInNameS

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
			res = strings.ReplaceAll(res, "$ton", s.cryptoSvc.GetPrice("the-open-network"))
			res = strings.ReplaceAll(res, "$Gram", s.cryptoSvc.GetPrice("the-open-network"))
			res = strings.ReplaceAll(res, "$eth", s.cryptoSvc.GetPrice("ethereum"))
			res = strings.ReplaceAll(res, "$frg", s.cryptoSvc.GetPrice("fragment"))
		}

		return res
	}

	if bioTmpl != "" {
		newBio := replaceVars(bioTmpl)
		if len(newBio) > 255 {
			newBio = newBio[:255]
		}
		lastBio, _ := s.lastBioContent.Load(entityKey)
		if lastBio != newBio {
			if err := tg.SetChatDescription(ctx, chatID, newBio); err != nil {
				slog.Error("Failed to update chat bio", "chatID", chatID, "error", err)
			} else {
				s.lastBioContent.Store(entityKey, newBio)
				slog.Info("Successfully updated chat dynamic bio", "chatID", chatID)
			}
		}
	}

	if displayInName && nameTmpl != "" {
		newName := replaceVars(nameTmpl)
		if len(newName) > 128 {
			newName = newName[:128]
		}
		lastTitle, _ := s.lastTitleContent.Load(entityKey)
		if lastTitle != newName {
			if err := tg.SetChatTitle(ctx, chatID, newName); err != nil {
				slog.Error("Failed to update chat title", "chatID", chatID, "error", err)
			} else {
				s.lastTitleContent.Store(entityKey, newName)
				slog.Info("Successfully updated chat dynamic title", "chatID", chatID)
			}
		}
	}
}
