package channelmgmt

import (
	"context"
	"fmt"
	"log/slog"
	"runtime/debug"
	"strings"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"

	"github.com/google/uuid"
)

func (s *ChannelService) analyticsSnapshotWorker(ctx context.Context) {
	// Delay first run to avoid API overload during startup
	select {
	case <-ctx.Done():
		slog.Info("Daily Analytics Worker stopped before first run")
		return
	case <-time.After(5 * time.Minute):
		func() {
			defer func() {
				if r := recover(); r != nil {
					slog.Error("Recovered from panic in runAnalyticsSnapshot initial run", "panic", r, "stack", string(debug.Stack()))
				}
			}()
			s.runAnalyticsSnapshot(ctx)
		}()
	}

	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	lastRunDay := time.Now().YearDay()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Daily Analytics Worker stopped due to context cancellation")
			return
		case <-ticker.C:
			currentDay := time.Now().YearDay()
			if currentDay != lastRunDay {
				func() {
					defer func() {
						if r := recover(); r != nil {
							slog.Error("Recovered from panic in runAnalyticsSnapshot hourly ticker run", "panic", r, "stack", string(debug.Stack()))
						}
					}()
					s.runAnalyticsSnapshot(ctx)
					lastRunDay = currentDay
				}()
			}
		}
	}
}

func (s *ChannelService) runAnalyticsSnapshot(ctx context.Context) {
	cache := s.channelRepo.GetCache()
	if cache != nil && cache.Client != nil {
		todayStr := time.Now().Format("2006-01-02")
		lockKey := fmt.Sprintf("lock:analytics:%s", todayStr)

		// Acquire Redis Lock for 23 hours to prevent multi-replica execution collisions
		acquired, err := cache.Client.SetNX(ctx, lockKey, "locked", 23*time.Hour).Result()
		if err != nil || !acquired {
			slog.Info("Daily analytics snapshot already processed by another replica for day", "date", todayStr)
			return
		}
	}

	slog.Info("Running daily channel analytics snapshot generation...")

	limit := 100
	var cursor *time.Time
	var cursorID *uuid.UUID
	sem := make(chan struct{}, 5)

	// Safe spacing ticker (100ms interval) to respect Telegram API limits
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		batch, err := s.channelRepo.GetChannelsWithBotsPaged(ctx, limit, cursor, cursorID)
		if err != nil {
			slog.Error("Failed to retrieve paged channels for daily analytics", "error", err)
			break
		}
		if len(batch) == 0 {
			break
		}

		for _, cb := range batch {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				// Tick received, safe to launch next Telegram request
			}

			select {
			case <-ctx.Done():
				return
			case sem <- struct{}{}:
				// Acquired concurrency ticket
			}

			item := cb
			GoSafe(func() {
				defer func() { <-sem }() // Release concurrency ticket

				token, err := botmgmt.DecryptToken(item.BotTokenEncrypted)
				if err != nil {
					slog.Error("Failed to decrypt bot token for analytics", "channel_id", item.ChannelID, "error", err)
					return
				}

				tg := telegram.NewBotAPIClient(token)
				currentCount, err := tg.GetChatMemberCount(ctx, item.ChatID)
				if err != nil {
					slog.Error("Failed to fetch current telegram subscriber count for analytics", "channel_id", item.ChannelID, "error", err)

					lowerErr := strings.ToLower(err.Error())
					if strings.Contains(lowerErr, "forbidden") || strings.Contains(lowerErr, "kicked") || strings.Contains(lowerErr, "not a member") || strings.Contains(lowerErr, "not a participant") || strings.Contains(lowerErr, "chat not found") {
						slog.Warn("Bot was kicked from channel detected during analytics, disconnecting it", "channel_id", item.ChannelID)
						_ = s.channelRepo.DeleteChannel(ctx, item.ChannelID)
						// Log audit using system user or skip since it's background
					}

					return
				}

				newSubscribers := currentCount - item.SubscribersCount
				if newSubscribers < 0 {
					newSubscribers = 0
				}

				// Save Snapshot date as truncated to midnight
				now := time.Now()
				snapshotDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

				postsCount, viewsCount, reactionsCount, err := s.channelRepo.GetDailyPostStats(ctx, item.ChannelID, now)
				if err != nil {
					slog.Warn("Failed to get daily post stats, defaulting to 0", "channel_id", item.ChannelID, "error", err)
					postsCount, viewsCount, reactionsCount = 0, 0, 0
				}

				snapshot := &repository.ChannelAnalytics{
					ChannelID:        item.ChannelID,
					SnapshotDate:     snapshotDate,
					SubscribersCount: currentCount,
					NewSubscribers:   newSubscribers,
					ViewsCount:       viewsCount,
					ReactionsCount:   reactionsCount,
					PostsCount:       postsCount,
				}

				err = s.channelRepo.SaveSnapshotAndUpdateSubscribers(ctx, snapshot, currentCount)
				if err != nil {
					slog.Error("Failed to save analytics snapshot and update subscribers", "channel_id", item.ChannelID, "error", err)
					return
				}

				slog.Info("Completed daily analytics snapshot for channel", "channel_id", item.ChannelID, "subscribers", currentCount)
			})
		}

		lastItem := batch[len(batch)-1]
		cursor = &lastItem.CreatedAt
		cursorID = &lastItem.ChannelID
	}

	// Drain semaphore channel to verify all workers have finished before returning
	for i := 0; i < 5; i++ {
		sem <- struct{}{}
	}
}
