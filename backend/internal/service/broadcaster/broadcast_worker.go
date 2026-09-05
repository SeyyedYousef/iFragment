package broadcaster

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/time/rate"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"
)

type BroadcastWorker struct {
	repo        *repository.OwnerRepo
	redisClient *redis.Client
	tgClient    *telegram.BotAPIClient
	rateLimiter *rate.Limiter
	mu          sync.Mutex
	activeRuns  map[string]context.CancelFunc
}

func NewBroadcastWorker(repo *repository.OwnerRepo, redisClient *redis.Client, botToken string) *BroadcastWorker {
	// Rate limit: 25 messages/sec with burst of 30 (compliant with Telegram Bot API guidelines)
	limiter := rate.NewLimiter(rate.Limit(25), 30)
	var client *telegram.BotAPIClient
	if botToken != "" {
		client = telegram.NewBotAPIClient(botToken)
	}

	return &BroadcastWorker{
		repo:        repo,
		redisClient: redisClient,
		tgClient:    client,
		rateLimiter: limiter,
		activeRuns:  make(map[string]context.CancelFunc),
	}
}

// Start begins the background poll loop for scheduled and ongoing broadcasts
func (w *BroadcastWorker) Start(ctx context.Context) {
	slog.Info("Starting Broadcast Engine Worker (10s polling, distributed lock, 25 msg/s rate-limiting)...")
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Broadcast Engine Worker stopped")
			return
		case <-ticker.C:
			w.processDueBroadcastsWithLock(ctx)
		}
	}
}

func (w *BroadcastWorker) processDueBroadcastsWithLock(ctx context.Context) {
	if w.repo == nil {
		return
	}

	// Distributed lock via Redis SETNX (25s TTL)
	if w.redisClient != nil {
		acquired, err := w.redisClient.SetNX(ctx, "lock:broadcast_scheduler", "1", 25*time.Second).Result()
		if err != nil || !acquired {
			return
		}
		defer w.redisClient.Del(ctx, "lock:broadcast_scheduler")
	}

	dueList, err := w.repo.GetDueBroadcasts(ctx)
	if err != nil {
		slog.Error("Failed to fetch due broadcasts", "error", err)
		return
	}

	for _, b := range dueList {
		w.mu.Lock()
		if _, exists := w.activeRuns[b.ID]; exists {
			w.mu.Unlock()
			continue
		}
		runCtx, cancel := context.WithCancel(ctx)
		w.activeRuns[b.ID] = cancel
		w.mu.Unlock()

		go w.executeBroadcast(runCtx, b)
	}
}

func (w *BroadcastWorker) PauseBroadcast(id string) bool {
	w.mu.Lock()
	cancel, exists := w.activeRuns[id]
	if exists && cancel != nil {
		cancel()
		delete(w.activeRuns, id)
	}
	w.mu.Unlock()

	if w.repo != nil {
		_ = w.repo.UpdateBroadcastStatus(context.Background(), id, "paused")
	}
	return exists
}

func (w *BroadcastWorker) CancelBroadcast(id string) bool {
	w.mu.Lock()
	cancel, exists := w.activeRuns[id]
	if exists && cancel != nil {
		cancel()
		delete(w.activeRuns, id)
	}
	w.mu.Unlock()

	if w.repo != nil {
		_ = w.repo.UpdateBroadcastStatus(context.Background(), id, "cancelled")
	}
	return true
}

func (w *BroadcastWorker) ResumeBroadcast(ctx context.Context, id string) error {
	w.mu.Lock()
	if _, exists := w.activeRuns[id]; exists {
		w.mu.Unlock()
		return errors.New("broadcast is already actively sending")
	}
	w.mu.Unlock()

	b, err := w.repo.GetBroadcastByID(ctx, id)
	if err != nil || b == nil {
		return fmt.Errorf("broadcast not found: %v", err)
	}

	if b.Status != "paused" && b.Status != "failed" && b.Status != "scheduled" {
		return fmt.Errorf("cannot resume broadcast in %s state", b.Status)
	}

	_ = w.repo.UpdateBroadcastStatus(ctx, id, "sending")

	runCtx, cancel := context.WithCancel(context.Background())
	w.mu.Lock()
	w.activeRuns[id] = cancel
	w.mu.Unlock()

	go w.executeBroadcast(runCtx, *b)
	return nil
}

func (w *BroadcastWorker) executeBroadcast(ctx context.Context, b model.Broadcast) {
	defer func() {
		w.mu.Lock()
		delete(w.activeRuns, b.ID)
		w.mu.Unlock()
	}()

	slog.Info("Executing broadcast", "id", b.ID, "audience", b.TargetAudience)

	// Fetch recipient user IDs
	userIDs, err := w.repo.GetAudienceUserIDs(ctx, b.TargetAudience)
	if err != nil {
		slog.Error("Failed to fetch audience for broadcast", "id", b.ID, "error", err)
		_ = w.repo.UpdateBroadcastStatus(context.Background(), b.ID, "failed")
		return
	}

	total := len(userIDs)
	_ = w.repo.UpdateBroadcastProgress(ctx, b.ID, "sending", b.SentCount, total, b.FailedCount)

	sentCount := b.SentCount
	failedCount := b.FailedCount

	if w.tgClient == nil {
		slog.Error("Cannot execute broadcast: Telegram Bot API client is not configured (missing bot token)")
		_ = w.repo.UpdateBroadcastProgress(context.Background(), b.ID, "failed", sentCount, total, total)
		return
	}

	for i := sentCount + failedCount; i < total; i++ {
		select {
		case <-ctx.Done():
			slog.Info("Broadcast run paused or cancelled", "id", b.ID)
			_ = w.repo.UpdateBroadcastProgress(context.Background(), b.ID, "paused", sentCount, total, failedCount)
			return
		default:
		}

		targetUserID := userIDs[i]

		// Wait on token bucket rate limiter (25 req/sec)
		if err := w.rateLimiter.Wait(ctx); err != nil {
			return
		}

		payload := map[string]interface{}{
			"chat_id":    targetUserID,
			"text":       b.Message,
			"parse_mode": "HTML",
		}
		_, reqErr := w.tgClient.Request(ctx, "sendMessage", payload)
		if reqErr != nil {
			// Check for Telegram 429 rate limit
			if strings.Contains(reqErr.Error(), "429") || strings.Contains(reqErr.Error(), "Too Many Requests") {
				retrySec := 5
				if parts := strings.Split(reqErr.Error(), "retry after "); len(parts) > 1 {
					if num, err := strconv.Atoi(strings.Fields(parts[1])[0]); err == nil && num > 0 {
						retrySec = num
					}
				}
				slog.Warn("Telegram 429 hit during broadcast; cooling down", "retry_seconds", retrySec, "id", b.ID)
				time.Sleep(time.Duration(retrySec) * time.Second)
				i-- // retry this user
				continue
			}

			failedCount++
			slog.Warn("Failed to send broadcast message to user", "user_id", targetUserID, "err", reqErr)
		} else {
			sentCount++
		}

		// Update database progress periodically (every 25 messages or at end)
		if (sentCount+failedCount)%25 == 0 || (sentCount+failedCount) == total {
			_ = w.repo.UpdateBroadcastProgress(context.Background(), b.ID, "sending", sentCount, total, failedCount)
		}
	}

	finalStatus := "completed"
	if sentCount == 0 && total > 0 {
		finalStatus = "failed"
	}
	_ = w.repo.UpdateBroadcastProgress(context.Background(), b.ID, finalStatus, sentCount, total, failedCount)
	slog.Info("Broadcast finished", "id", b.ID, "sent", sentCount, "failed", failedCount, "total", total)
}
