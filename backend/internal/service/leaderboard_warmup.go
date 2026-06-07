package service

import (
	"context"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// WarmLeaderboard fully populates the Redis sorted set from PostgreSQL.
// Should be run on startup AND every N minutes via a scheduler.
func (s *ProfileService) WarmLeaderboard(ctx context.Context) error {
	if s.cache == nil || s.cache.Client == nil {
		return nil
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT user_id, xp FROM user_stats
		WHERE xp > 0
		ORDER BY xp DESC
		LIMIT 100000
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	const batchSize = 1000
	batch := make([]redis.Z, 0, batchSize)
	tempKey := "leaderboard:tmp"

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, tempKey)
	}

	hasWrote := false
	flush := func() error {
		if len(batch) == 0 {
			return nil
		}
		hasWrote = true
		return s.cache.Client.ZAdd(ctx, tempKey, batch...).Err()
	}
	for rows.Next() {
		var uid int64
		var xp int
		if err := rows.Scan(&uid, &xp); err != nil {
			continue
		}
		batch = append(batch, redis.Z{Score: float64(xp), Member: strconv.FormatInt(uid, 10)})
		if len(batch) >= batchSize {
			if err := flush(); err != nil {
				return err
			}
			batch = batch[:0]
		}
	}
	if err := flush(); err != nil {
		return err
	}
	if hasWrote {
		s.cache.Client.Rename(ctx, tempKey, "leaderboard")
	} else {
		s.cache.Client.Del(ctx, "leaderboard")
	}
	// stamp last-warmed for diagnostics
	s.cache.Client.Set(ctx, "leaderboard:warmed_at", time.Now().Unix(), 0)
	return nil
}
