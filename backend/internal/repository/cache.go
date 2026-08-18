package repository

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache struct {
	Client *redis.Client
}

func NewCache(ctx context.Context) (*Cache, error) {
	url := os.Getenv("DRAGONFLY_URL")
	if url == "" {
		// Fallback to local redis/dragonfly default
		url = "redis://localhost:6379/0"
	}

	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("unable to parse DRAGONFLY_URL: %v", err)
	}

	// Bleeding-edge production configuration options for DragonflyDB
	// Dragonfly natively supports RESP3 protocol with high-throughput multi-threaded I/O
	opts.Protocol = 3
	opts.PoolSize = 150
	opts.MinIdleConns = 20
	opts.PoolFIFO = false // LIFO ordering preserves CPU L1/L2 cache locality for active connections
	opts.ConnMaxIdleTime = 5 * time.Minute
	opts.ConnMaxLifetime = 30 * time.Minute
	opts.DialTimeout = 3 * time.Second
	opts.ReadTimeout = 2 * time.Second
	opts.WriteTimeout = 2 * time.Second
	opts.MaxRetries = 2

	client := redis.NewClient(opts)

	// Test connection
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("cache ping failed: %v", err)
	}

	slog.Info("✅ Connected to DragonflyDB successfully", "protocol", "RESP3", "pool_size", opts.PoolSize)
	return &Cache{Client: client}, nil
}

func (c *Cache) Close() {
	if c != nil && c.Client != nil {
		c.Client.Close()
	}
}

func (c *Cache) IsQuotaExceeded() bool {
	if c == nil || c.Client == nil {
		return true
	}
	return os.Getenv("DISABLE_REDIS_RATE_LIMIT") == "true" ||
		os.Getenv("DISABLE_REDIS_RATE_LIMIT") == "1" ||
		os.Getenv("DISABLE_REDIS") == "true"
}

func (c *Cache) MarkQuotaExceeded() {
	// Preserved for backward-compatible interface
}

func (c *Cache) IsQuotaError(err error) bool {
	return false
}

func (c *Cache) HandleError(err error) bool {
	return false
}

