package repository

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"

	"ifragment-backend/internal/config"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Database struct {
	Pool *pgxpool.Pool
}

func NewDatabase(ctx context.Context) (*Database, error) {
	if cfg := config.Get(); cfg != nil && cfg.DB.URL != "" {
		return NewDatabaseWithConfig(ctx, cfg.DB)
	}
	return NewDatabaseWithConfig(ctx, config.DatabaseConfig{
		URL: os.Getenv("DATABASE_URL"),
	})
}

func NewDatabaseWithConfig(ctx context.Context, cfg config.DatabaseConfig) (*Database, error) {
	connStr := cfg.URL
	if connStr == "" {
		connStr = os.Getenv("DATABASE_URL")
	}
	if connStr == "" {
		return nil, fmt.Errorf("DATABASE_URL is not set")
	}

	poolConfig, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return nil, fmt.Errorf("unable to parse DATABASE_URL: %v", err)
	}

	maxConns := cfg.MaxConns
	if maxConns <= 0 {
		maxConns = 50
		if maxConnsStr := os.Getenv("DB_MAX_CONNS"); maxConnsStr != "" {
			if val, err := strconv.Atoi(maxConnsStr); err == nil && val > 0 {
				maxConns = val
			}
		}
	}

	poolConfig.MaxConns = int32(maxConns)
	poolConfig.MinConns = int32(maxConns / 4)
	if poolConfig.MinConns < 2 {
		poolConfig.MinConns = 2
	}

	poolConfig.MaxConnLifetime = time.Hour
	poolConfig.MaxConnLifetimeJitter = 5 * time.Minute
	poolConfig.MaxConnIdleTime = 30 * time.Minute
	poolConfig.HealthCheckPeriod = time.Minute
	poolConfig.ConnConfig.ConnectTimeout = 5 * time.Second

	// Enable automatic statement caching on connections for highest throughput
	poolConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeCacheStatement

	if poolConfig.ConnConfig.RuntimeParams == nil {
		poolConfig.ConnConfig.RuntimeParams = make(map[string]string)
	}
	poolConfig.ConnConfig.RuntimeParams["statement_timeout"] = "30000"                      // 30s max query runtime
	poolConfig.ConnConfig.RuntimeParams["lock_timeout"] = "5000"                            // 5s max lock wait to prevent convoys
	poolConfig.ConnConfig.RuntimeParams["idle_in_transaction_session_timeout"] = "10000"   // 10s max idle in tx to protect vacuum

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
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

