package repository

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Database struct {
	Pool *pgxpool.Pool
}

func NewDatabase(ctx context.Context) (*Database, error) {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		return nil, fmt.Errorf("DATABASE_URL is not set")
	}

	config, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return nil, fmt.Errorf("unable to parse DATABASE_URL: %v", err)
	}

	maxConns := 50
	if maxConnsStr := os.Getenv("DB_MAX_CONNS"); maxConnsStr != "" {
		if val, err := strconv.Atoi(maxConnsStr); err == nil && val > 0 {
			maxConns = val
		}
	}

	config.MaxConns = int32(maxConns)
	config.MinConns = int32(maxConns / 4)
	if config.MinConns < 2 {
		config.MinConns = 2
	}

	config.MaxConnLifetime = time.Hour
	config.MaxConnLifetimeJitter = 5 * time.Minute
	config.MaxConnIdleTime = 30 * time.Minute
	config.HealthCheckPeriod = time.Minute
	config.ConnConfig.ConnectTimeout = 5 * time.Second

	// Enable automatic statement caching on connections for highest throughput
	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeCacheStatement

	if config.ConnConfig.RuntimeParams == nil {
		config.ConnConfig.RuntimeParams = make(map[string]string)
	}
	config.ConnConfig.RuntimeParams["statement_timeout"] = "30000"                      // 30s max query runtime
	config.ConnConfig.RuntimeParams["lock_timeout"] = "5000"                            // 5s max lock wait to prevent convoys
	config.ConnConfig.RuntimeParams["idle_in_transaction_session_timeout"] = "10000"   // 10s max idle in tx to protect vacuum

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("unable to connect to database: %v", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("database ping failed: %v", err)
	}

	slog.Info("✅ Connected to PostgreSQL successfully (optimized pgxpool)", "max_conns", maxConns)
	return &Database{Pool: pool}, nil
}

func (db *Database) Close() {
	db.Pool.Close()
}
