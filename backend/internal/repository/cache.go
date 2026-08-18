package repository

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Cache wraps multiple Redis clients with intelligent auto-failover and quota detection.
type Cache struct {
	mu                 sync.RWMutex
	Client             *redis.Client // Active client for direct access (thread-safely updated)
	clients            []*redis.Client
	urls               []string
	activeIdx          int
	quotaExceededUntil []time.Time
	isQuotaExceededAll bool
	stopRecoveryCh     chan struct{}
}

type failoverHook struct {
	cache *Cache
	idx   int
}

func (h *failoverHook) DialHook(next redis.DialHook) redis.DialHook {
	return next
}

func (h *failoverHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		err := next(ctx, cmd)
		if err != nil && h.cache.IsQuotaError(err) {
			h.cache.handleQuotaTrigger(h.idx, err.Error())
		}
		return err
	}
}

func (h *failoverHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return func(ctx context.Context, cmds []redis.Cmder) error {
		err := next(ctx, cmds)
		if err != nil && h.cache.IsQuotaError(err) {
			h.cache.handleQuotaTrigger(h.idx, err.Error())
		}
		return err
	}
}

func parseRedisURLs() []string {
	var raw string
	for _, envKey := range []string{
		"REDIS_URLS",
		"REDIS_URL",
		"UPSTASH_REDIS_URLS",
		"UPSTASH_REDIS_URL",
		"DRAGONFLY_URLS",
		"DRAGONFLY_URL",
	} {
		if val := os.Getenv(envKey); strings.TrimSpace(val) != "" {
			raw = val
			break
		}
	}

	if raw == "" {
		return []string{"redis://localhost:6379/0"}
	}

	var result []string
	for _, p := range strings.Split(raw, ",") {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}

	if len(result) == 0 {
		return []string{"redis://localhost:6379/0"}
	}
	return result
}

func NewCache(ctx context.Context) (*Cache, error) {
	urls := parseRedisURLs()

	c := &Cache{
		urls:               urls,
		clients:            make([]*redis.Client, 0, len(urls)),
		quotaExceededUntil: make([]time.Time, len(urls)),
		stopRecoveryCh:     make(chan struct{}),
	}

	var firstHealthyClient *redis.Client
	firstHealthyIdx := -1

	for i, u := range urls {
		opts, err := redis.ParseURL(u)
		if err != nil {
			slog.Warn("Failed to parse Redis URL in pool, skipping", "index", i+1, "error", err)
			continue
		}

		// DragonflyDB / Upstash high-performance options
		opts.PoolSize = 150
		opts.MinIdleConns = 10
		opts.PoolFIFO = false
		opts.ConnMaxIdleTime = 5 * time.Minute
		opts.ConnMaxLifetime = 30 * time.Minute
		opts.DialTimeout = 3 * time.Second
		opts.ReadTimeout = 2 * time.Second
		opts.WriteTimeout = 2 * time.Second
		opts.MaxRetries = 1

		client := redis.NewClient(opts)
		client.AddHook(&failoverHook{cache: c, idx: len(c.clients)})

		// Test connection
		pingErr := client.Ping(ctx).Err()
		if pingErr != nil {
			if c.IsQuotaError(pingErr) {
				slog.Warn("⚠️ Redis instance quota exceeded on startup", "index", i+1, "url_masked", maskURL(u))
				c.quotaExceededUntil[len(c.clients)] = time.Now().Add(1 * time.Hour)
			} else {
				slog.Warn("⚠️ Redis instance ping failed on startup", "index", i+1, "error", pingErr)
			}
		} else if firstHealthyIdx == -1 {
			firstHealthyIdx = len(c.clients)
			firstHealthyClient = client
		}

		c.clients = append(c.clients, client)
	}

	if len(c.clients) == 0 {
		return nil, fmt.Errorf("no valid Redis instances could be initialized from provided URLs")
	}

	if firstHealthyClient != nil {
		c.activeIdx = firstHealthyIdx
		c.Client = firstHealthyClient
		slog.Info("✅ Connected to primary Redis successfully",
			"active_instance", c.activeIdx+1,
			"total_instances", len(c.clients),
		)
	} else {
		// All instances failed ping or exceeded quota on boot, use first client as fallback
		c.activeIdx = 0
		c.Client = c.clients[0]
		c.isQuotaExceededAll = true
		slog.Warn("⚠️ All Redis instances failed startup ping or exceeded quota. Active fallback set to instance #1",
			"total_instances", len(c.clients),
		)
	}

	// Start background worker for automatic quota recovery check
	if len(c.clients) > 1 {
		go c.startQuotaRecoveryWorker()
	}

	return c, nil
}

func (c *Cache) handleQuotaTrigger(idx int, errReason string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Only trigger failover if the error occurred on the currently active client
	if idx != c.activeIdx && len(c.clients) > 1 {
		c.quotaExceededUntil[idx] = time.Now().Add(1 * time.Hour)
		return
	}

	c.quotaExceededUntil[c.activeIdx] = time.Now().Add(1 * time.Hour)

	if len(c.clients) <= 1 {
		c.isQuotaExceededAll = true
		return
	}

	// Find the next healthy client in the pool
	for i := 1; i < len(c.clients); i++ {
		nextIdx := (c.activeIdx + i) % len(c.clients)
		if time.Now().After(c.quotaExceededUntil[nextIdx]) {
			prevIdx := c.activeIdx
			c.activeIdx = nextIdx
			c.Client = c.clients[nextIdx]
			c.isQuotaExceededAll = false
			slog.Warn("🔄 [Redis Failover] Switched active Redis instance due to quota limit",
				"from_instance", prevIdx+1,
				"to_instance", nextIdx+1,
				"total_instances", len(c.clients),
				"reason", errReason,
			)
			return
		}
	}

	c.isQuotaExceededAll = true
	slog.Error("❌ [Redis Failover] All Redis instances in pool have exceeded their quota!",
		"total_instances", len(c.clients),
	)
}

func (c *Cache) SwitchToNext(reason string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	if len(c.clients) <= 1 {
		return false
	}

	for i := 1; i < len(c.clients); i++ {
		nextIdx := (c.activeIdx + i) % len(c.clients)
		if time.Now().After(c.quotaExceededUntil[nextIdx]) {
			prevIdx := c.activeIdx
			c.activeIdx = nextIdx
			c.Client = c.clients[nextIdx]
			c.isQuotaExceededAll = false
			slog.Warn("🔄 [Redis Failover] Manually switched active Redis instance",
				"from_instance", prevIdx+1,
				"to_instance", nextIdx+1,
				"reason", reason,
			)
			return true
		}
	}
	return false
}

func (c *Cache) startQuotaRecoveryWorker() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-c.stopRecoveryCh:
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			c.mu.Lock()
			for i, client := range c.clients {
				if time.Now().Before(c.quotaExceededUntil[i]) {
					// Test if quota was reset
					if err := client.Ping(ctx).Err(); err == nil {
						c.quotaExceededUntil[i] = time.Time{}
						c.isQuotaExceededAll = false
						slog.Info("🎉 [Redis Failover] Redis instance quota has reset and is back online!",
							"instance", i+1,
							"total_instances", len(c.clients),
						)
					}
				}
			}
			c.mu.Unlock()
			cancel()
		}
	}
}

func (c *Cache) Close() {
	if c == nil {
		return
	}
	select {
	case <-c.stopRecoveryCh:
	default:
		close(c.stopRecoveryCh)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, client := range c.clients {
		if client != nil {
			_ = client.Close()
		}
	}
}

func (c *Cache) IsQuotaExceeded() bool {
	if c == nil || c.Client == nil {
		return true
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.isQuotaExceededAll ||
		os.Getenv("DISABLE_REDIS_RATE_LIMIT") == "true" ||
		os.Getenv("DISABLE_REDIS_RATE_LIMIT") == "1" ||
		os.Getenv("DISABLE_REDIS") == "true"
}

func (c *Cache) MarkQuotaExceeded() {
	c.handleQuotaTrigger(c.activeIdx, "manual mark quota exceeded")
}

func (c *Cache) IsQuotaError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "max requests limit") ||
		strings.Contains(msg, "quota exceeded") ||
		strings.Contains(msg, "daily request limit") ||
		strings.Contains(msg, "rate limit exceeded") ||
		strings.Contains(msg, "max daily request") ||
		strings.Contains(msg, "oom command not allowed") ||
		strings.Contains(msg, "maxmemory")
}

func (c *Cache) HandleError(err error) bool {
	if c.IsQuotaError(err) {
		c.handleQuotaTrigger(c.activeIdx, err.Error())
		return true
	}
	return false
}

func maskURL(raw string) string {
	parts := strings.Split(raw, "@")
	if len(parts) > 1 {
		return "...@" + parts[1]
	}
	return raw
}
