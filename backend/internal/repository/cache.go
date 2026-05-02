package repository

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
)

type Cache struct {
	Client *redis.Client
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

	client := redis.NewClient(opts)

	// Test connection
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("cache ping failed: %v", err)
	}

	log.Println("✅ Connected to DragonflyDB/Redis successfully")
	return &Cache{Client: client}, nil
}

func (c *Cache) Close() {
	c.Client.Close()
}
