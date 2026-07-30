package username

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"ifragment-backend/internal/repository"
)

type PartitionWorker struct {
	db *repository.Database
}

func NewPartitionWorker(db *repository.Database) *PartitionWorker {
	return &PartitionWorker{db: db}
}

// Start runs the partition creation and vacuum tasks on a schedule
func (w *PartitionWorker) Start(ctx context.Context) {
	if w == nil || w.db == nil || w.db.Pool == nil {
		slog.Warn("[PartitionWorker] Database or pool is nil, partition worker will not run")
		return
	}

	slog.Info("[PartitionWorker] Starting background partition & maintenance worker...")

	// Run immediately on startup
	w.runMaintenance(ctx)

	// Run every 24 hours
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("[PartitionWorker] Stopping background partition worker...")
			return
		case <-ticker.C:
			w.runMaintenance(ctx)
		}
	}
}

var partitionedTables = []string{"search_logs", "group_events", "channel_posts"}

func (w *PartitionWorker) runMaintenance(ctx context.Context) {
	// Try to acquire distributed advisory lock (ID: 847294) to prevent concurrent execution on horizontally scaled instances
	conn, err := w.db.Pool.Acquire(ctx)
	if err != nil {
		slog.Error("[PartitionWorker] Failed to acquire database connection for maintenance", "error", err)
		return
	}

	var acquired bool
	err = conn.QueryRow(ctx, "SELECT pg_try_advisory_lock(847294)").Scan(&acquired)
	if err != nil || !acquired {
		conn.Release()
		slog.Info("[PartitionWorker] Partition maintenance skipped: lock held by another cluster instance")
		return
	}

	slog.Info("[PartitionWorker] Starting maintenance cycle...")

	// 1. Create partitions for current and next 2 months for all partitioned tables
	if err := w.createFuturePartitions(ctx); err != nil {
		slog.Error("[PartitionWorker] Failed to create partitions", "error", err)
	}

	// 2. Retention policy: delete non-partitioned audit_logs & DROP expired partitions for partitioned tables (> 90 days)
	slog.Info("[PartitionWorker] Cleaning up audit_logs and expired partitions older than 90 days...")
	retentionStart := time.Now()
	res, err := w.db.Pool.Exec(ctx, "DELETE FROM audit_logs WHERE created_at < now() - INTERVAL '90 days';")
	if err != nil {
		slog.Error("[PartitionWorker] Failed to clean up audit_logs", "error", err)
	} else {
		slog.Info("[PartitionWorker] Successfully cleaned up audit_logs", "rows_deleted", res.RowsAffected(), "duration", time.Since(retentionStart))
	}

	w.dropExpiredPartitions(ctx, 90)

	// Release advisory lock before long-running VACUUM operations
	_, _ = conn.Exec(context.Background(), "SELECT pg_advisory_unlock(847294)")
	conn.Release()

	// 3. Perform VACUUM ANALYZE (only on Sundays to minimize load)
	if time.Now().UTC().Weekday() == time.Sunday {
		slog.Info("[PartitionWorker] Running weekly VACUUM ANALYZE on critical tables...")
		start := time.Now()
		tables := []string{"search_logs", "group_events", "channel_posts", "audit_logs", "user_stats", "tap_audit"}
		for _, t := range tables {
			if _, err := w.db.Pool.Exec(ctx, fmt.Sprintf("VACUUM ANALYZE %s;", t)); err != nil {
				slog.Error("[PartitionWorker] VACUUM ANALYZE failed", "table", t, "error", err)
			}
		}
		slog.Info("[PartitionWorker] VACUUM ANALYZE completed successfully", "duration", time.Since(start))
	}

	slog.Info("[PartitionWorker] Maintenance cycle finished")
}

func (w *PartitionWorker) createFuturePartitions(ctx context.Context) error {
	now := time.Now().UTC()
	currentYear, currentMonth, _ := now.Date()

	for _, table := range partitionedTables {
		for i := 0; i <= 2; i++ {
			t := time.Date(currentYear, currentMonth+time.Month(i), 1, 0, 0, 0, 0, time.UTC)
			year := t.Year()
			month := t.Month()

			partitionName := fmt.Sprintf("%s_y%dm%02d", table, year, month)
			var exists bool
			query := `
			SELECT EXISTS (
				SELECT FROM pg_tables 
				WHERE schemaname = 'public' 
				AND tablename = $1
			);`
			err := w.db.Pool.QueryRow(ctx, query, partitionName).Scan(&exists)
			if err != nil {
				slog.Error("[PartitionWorker] Failed to check partition existence", "table", partitionName, "error", err)
				continue
			}

			if !exists {
				slog.Info("[PartitionWorker] Creating missing partition table", "name", partitionName)
				startStr := t.Format("2006-01-02 15:04:05+00")
				next := t.AddDate(0, 1, 0)
				endStr := next.Format("2006-01-02 15:04:05+00")

				tx, txErr := w.db.Pool.Begin(ctx)
				if txErr != nil {
					slog.Error("[PartitionWorker] Failed to begin tx for partition creation", "name", partitionName, "error", txErr)
					continue
				}

				_, err = tx.Exec(ctx, "SET LOCAL lock_timeout = '500ms';")
				if err == nil {
					createStmt := fmt.Sprintf(
						"CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES FROM ('%s') TO ('%s');",
						partitionName, table, startStr, endStr,
					)
					_, err = tx.Exec(ctx, createStmt)
				}

				if err != nil {
					_ = tx.Rollback(ctx)
					slog.Warn("[PartitionWorker] Could not acquire lock or create partition, will retry later", "name", partitionName, "error", err)
				} else {
					if commitErr := tx.Commit(ctx); commitErr != nil {
						slog.Error("[PartitionWorker] Failed to commit partition creation", "name", partitionName, "error", commitErr)
					} else {
						slog.Info("[PartitionWorker] Successfully created partition table", "name", partitionName)
					}
				}
			} else {
				slog.Debug("[PartitionWorker] Partition table already exists", "name", partitionName)
			}
		}
	}

	return nil
}

func (w *PartitionWorker) dropExpiredPartitions(ctx context.Context, retentionDays int) {
	cutoffDate := time.Now().UTC().AddDate(0, 0, -retentionDays)
	cutoffYear, cutoffMonth, _ := cutoffDate.Date()
	cutoffKey := cutoffYear*100 + int(cutoffMonth)

	for _, table := range partitionedTables {
		query := `
			SELECT tablename FROM pg_tables
			WHERE schemaname = 'public' AND tablename ~ $1`
		pattern := fmt.Sprintf(`^%s_y\d{4}m\d{2}$`, table)

		rows, err := w.db.Pool.Query(ctx, query, pattern)
		if err != nil {
			slog.Error("[PartitionWorker] Failed to list partitions for retention drop", "table", table, "error", err)
			continue
		}

		var partNames []string
		for rows.Next() {
			var name string
			if err := rows.Scan(&name); err == nil {
				partNames = append(partNames, name)
			}
		}
		rows.Close()

		for _, name := range partNames {
			var y, m int
			_, parseErr := fmt.Sscanf(name, table+"_y%dm%d", &y, &m)
			if parseErr != nil {
				continue
			}

			partKey := y*100 + m
			// Only drop if strictly prior to cutoff month
			if partKey < cutoffKey {
				slog.Info("[PartitionWorker] Dropping expired partition table (retention target)", "partition", name)
				dropStmt := fmt.Sprintf("DROP TABLE IF EXISTS %s;", name)
				if _, dropErr := w.db.Pool.Exec(ctx, dropStmt); dropErr != nil {
					slog.Error("[PartitionWorker] Failed to drop expired partition", "partition", name, "error", dropErr)
				} else {
					slog.Info("[PartitionWorker] Successfully dropped expired partition", "partition", name)
				}
			}
		}
	}
}
