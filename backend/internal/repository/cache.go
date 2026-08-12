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

type Cache struct {
	Client                  *redis.Client
	redisQuotaMu            sync.RWMutex
	redisQuotaExceededUntil time.Time
}

func NewCache(ctx context.Context) (*Cache, error) {
	url := os.Getenv("DRAGONFLY_URL")
	if url == "" {
		// Fallback to local redis default
		url = "redis://localhost:6379/0"
	}

	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("unable to parse DRAGONFLY_URL: %v", err)
	}

	// Production configuration options for Dragonfly/Redis
	opts.PoolSize = 100
	opts.MinIdleConns = 10
	opts.DialTimeout = 3 * time.Second
	opts.ReadTimeout = 2 * time.Second
	opts.MaxRetries = 2

	client := redis.NewClient(opts)

	// Test connection
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("cache ping failed: %v", err)
	}

	slog.Info("✅ Connected to DragonflyDB/Redis successfully", "pool_size", opts.PoolSize)
	return &Cache{Client: client}, nil
}

func (c *Cache) Close() {
	if c != nil && c.Client != nil {
		c.Client.Close()
	}
}

func (c *Cache) IsQuotaExceeded() bool {
	if c == nil {
		return true
	}
	if os.Getenv("DISABLE_REDIS_RATE_LIMIT") == "true" || os.Getenv("DISABLE_REDIS_RATE_LIMIT") == "1" || os.Getenv("DISABLE_REDIS") == "true" {
		return true
	}
	c.redisQuotaMu.RLock()
	defer c.redisQuotaMu.RUnlock()
	return time.Now().Before(c.redisQuotaExceededUntil)
}

func (c *Cache) MarkQuotaExceeded() {
	if c == nil {
		return
	}
	c.redisQuotaMu.Lock()
	alreadyExceeded := time.Now().Before(c.redisQuotaExceededUntil)
	c.redisQuotaExceededUntil = time.Now().Add(1 * time.Hour)
	c.redisQuotaMu.Unlock()

	if !alreadyExceeded {
		slog.Warn("Redis quota limit detected! Global circuit breaker activated: Redis operations temporarily disabled/switched to in-memory mode for 1 hour to save Redis commands.")
	}
}

func (c *Cache) IsQuotaError(err error) bool {
	if err == nil {
		return false
	}
	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "max requests limit exceeded") ||
		strings.Contains(errStr, "free tier limit") ||
		strings.Contains(errStr, "err max") ||
		strings.Contains(errStr, "quota exceeded") ||
		strings.Contains(errStr, "request limit reached")
}

func (c *Cache) HandleError(err error) bool {
	if c == nil || err == nil {
		return false
	}
	if c.IsQuotaError(err) {
		c.MarkQuotaExceeded()
		return true
	}
	return false
}
