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
	if w.db == nil {
		slog.Warn("[PartitionWorker] Database is nil, partition worker will not run")
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

func (w *PartitionWorker) runMaintenance(ctx context.Context) {
	// Try to acquire distributed advisory lock (ID: 847294) to prevent concurrent execution on horizontally scaled instances
	var acquired bool
	err := w.db.Pool.QueryRow(ctx, "SELECT pg_try_advisory_lock(847294)").Scan(&acquired)
	if err != nil || !acquired {
		slog.Info("[PartitionWorker] Partition maintenance skipped: lock held by another cluster instance")
		return
	}
	defer func() {
		_, _ = w.db.Pool.Exec(context.Background(), "SELECT pg_advisory_unlock(847294)")
	}()

	slog.Info("[PartitionWorker] Starting maintenance cycle...")

	// 1. Create partitions for current and next 2 months
	if err := w.createFuturePartitions(ctx); err != nil {
		slog.Error("[PartitionWorker] Failed to create partitions", "error", err)
	}

	// 2. Retention policy: delete audit_logs older than 90 days
	slog.Info("[PartitionWorker] Cleaning up audit_logs older than 90 days...")
	retentionStart := time.Now()
	res, err := w.db.Pool.Exec(ctx, "DELETE FROM audit_logs WHERE created_at < now() - INTERVAL '90 days';")
	if err != nil {
		slog.Error("[PartitionWorker] Failed to clean up audit_logs", "error", err)
	} else {
		slog.Info("[PartitionWorker] Successfully cleaned up audit_logs", "rows_deleted", res.RowsAffected(), "duration", time.Since(retentionStart))
	}

	// 3. Perform VACUUM ANALYZE (only on Sundays to minimize load)
	if time.Now().Weekday() == time.Sunday {
		slog.Info("[PartitionWorker] Running weekly VACUUM ANALYZE on search_logs and group_events...")
		start := time.Now()
		_, err := w.db.Pool.Exec(ctx, "VACUUM ANALYZE search_logs;")
		if err != nil {
			slog.Error("[PartitionWorker] VACUUM ANALYZE search_logs failed", "error", err)
		}
		_, err = w.db.Pool.Exec(ctx, "VACUUM ANALYZE group_events;")
		if err != nil {
			slog.Error("[PartitionWorker] VACUUM ANALYZE group_events failed", "error", err)
		}
		slog.Info("[PartitionWorker] VACUUM ANALYZE completed successfully", "duration", time.Since(start))
	}

	slog.Info("[PartitionWorker] Maintenance cycle finished")
}

func (w *PartitionWorker) createFuturePartitions(ctx context.Context) error {
	now := time.Now().UTC()
	currentYear, currentMonth, _ := now.Date()

	for i := 0; i <= 2; i++ {
		t := time.Date(currentYear, currentMonth+time.Month(i), 1, 0, 0, 0, 0, time.UTC)
		year := t.Year()
		month := t.Month()

		// 1. search_logs partitions
		{
			partitionName := fmt.Sprintf("search_logs_y%dm%02d", year, month)
			var exists bool
			query := `
				SELECT EXISTS (
					SELECT FROM pg_tables 
					WHERE schemaname = 'public' 
					AND tablename = $1
				);`
			err := w.db.Pool.QueryRow(ctx, query, partitionName).Scan(&exists)
			if err != nil {
				return fmt.Errorf("failed to check partition existence for %s: %w", partitionName, err)
			}

			if !exists {
				slog.Info("[PartitionWorker] Creating missing partition table", "name", partitionName)
				startStr := t.Format("2006-01-02 15:04:05+00")
				next := t.AddDate(0, 1, 0)
				endStr := next.Format("2006-01-02 15:04:05+00")

				createStmt := fmt.Sprintf(
					"CREATE TABLE IF NOT EXISTS %s PARTITION OF search_logs FOR VALUES FROM ('%s') TO ('%s');",
					partitionName, startStr, endStr,
				)

				_, err = w.db.Pool.Exec(ctx, createStmt)
				if err != nil {
					return fmt.Errorf("failed to create partition %s: %w", partitionName, err)
				}
				slog.Info("[PartitionWorker] Successfully created partition table", "name", partitionName)
			} else {
				slog.Debug("[PartitionWorker] Partition table already exists", "name", partitionName)
			}
		}

		// 2. group_events partitions
		{
			partitionName := fmt.Sprintf("group_events_y%dm%02d", year, month)
			var exists bool
			query := `
				SELECT EXISTS (
					SELECT FROM pg_tables 
					WHERE schemaname = 'public' 
					AND tablename = $1
				);`
			err := w.db.Pool.QueryRow(ctx, query, partitionName).Scan(&exists)
			if err != nil {
				return fmt.Errorf("failed to check partition existence for %s: %w", partitionName, err)
			}

			if !exists {
				slog.Info("[PartitionWorker] Creating missing partition table", "name", partitionName)
				startStr := t.Format("2006-01-02 15:04:05+00")
				next := t.AddDate(0, 1, 0)
				endStr := next.Format("2006-01-02 15:04:05+00")

				createStmt := fmt.Sprintf(
					"CREATE TABLE IF NOT EXISTS %s PARTITION OF group_events FOR VALUES FROM ('%s') TO ('%s');",
					partitionName, startStr, endStr,
				)

				_, err = w.db.Pool.Exec(ctx, createStmt)
				if err != nil {
					return fmt.Errorf("failed to create partition %s: %w", partitionName, err)
				}
				slog.Info("[PartitionWorker] Successfully created partition table", "name", partitionName)
			} else {
				slog.Debug("[PartitionWorker] Partition table already exists", "name", partitionName)
			}
		}
	}

	return nil
}
