package username

import (
	"context"
	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
	"log/slog"
	"time"
)

type AggregatorService struct {
	tonClient *tonapi.Client
	cache     *repository.Cache
}

func NewAggregatorService(ton *tonapi.Client, cache *repository.Cache) *AggregatorService {
	// Clear standard cache on startup so that new deployments get fresh API data immediately
	// instead of using cached empty/partial stats from prior failed/unauthenticated attempts.
	if cache != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := cache.Client.Del(ctx, "collection:stats_summary:v2", "collection:trending_usernames:v2").Err(); err != nil {
			slog.Warn("AggregatorService: failed to clear startup cache keys", "error", err)
		} else {
			slog.Info("AggregatorService: cleared collection stats and trending cache on startup")
		}
	}

	return &AggregatorService{
		tonClient: ton,
		cache:     cache,
	}
}

// retryWithBackoff executes a function with exponential backoff retries.
func retryWithBackoff(ctx context.Context, maxRetries int, baseDelay time.Duration, maxDelay time.Duration, fn func() error) error {
	var err error
	delay := baseDelay
	for i := 0; i < maxRetries; i++ {
		err = fn()
		if err == nil {
			return nil
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
		delay *= 2
		if delay > maxDelay {
			delay = maxDelay
		}
	}
	return err
}
