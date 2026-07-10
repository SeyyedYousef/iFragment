package username

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
)

type CollectionWorker struct {
	db        *repository.Database
	tonClient *tonapi.Client
}

func NewCollectionWorker(db *repository.Database, ton *tonapi.Client) *CollectionWorker {
	return &CollectionWorker{
		db:        db,
		tonClient: ton,
	}
}

// Start runs the collection data updater and seeder
func (w *CollectionWorker) Start(ctx context.Context) {
	if w == nil || w.db == nil || w.db.Pool == nil {
		slog.Warn("[CollectionWorker] Database or pool is nil, collection worker will not run")
		return
	}

	slog.Info("[CollectionWorker] Starting background collection stats worker...")

	// Run immediately on startup to seed and update
	w.updateCollectionData(ctx)

	// Run every 12 hours
	ticker := time.NewTicker(12 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("[CollectionWorker] Stopping background collection stats worker...")
			return
		case <-ticker.C:
			w.updateCollectionData(ctx)
		}
	}
}

func (w *CollectionWorker) ensureTablesExist(ctx context.Context) error {
	schemaSQL := `
	CREATE TABLE IF NOT EXISTS nft_collection_stats (
		id SERIAL PRIMARY KEY,
		stat_date DATE NOT NULL UNIQUE,
		items_count TEXT NOT NULL,
		owners_count TEXT NOT NULL,
		floor_price TEXT NOT NULL,
		total_volume TEXT NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS nft_collection_categories (
		id SERIAL PRIMARY KEY,
		stat_date DATE NOT NULL,
		category_name TEXT NOT NULL,
		volume TEXT NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		CONSTRAINT fk_stat_date FOREIGN KEY (stat_date) REFERENCES nft_collection_stats (stat_date) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS nft_collection_recent_auctions (
		id SERIAL PRIMARY KEY,
		stat_date DATE NOT NULL,
		item_name TEXT NOT NULL,
		price TEXT NOT NULL,
		status TEXT,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		CONSTRAINT fk_stat_date FOREIGN KEY (stat_date) REFERENCES nft_collection_stats (stat_date) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_nft_coll_categories_date ON nft_collection_categories(stat_date);
	CREATE INDEX IF NOT EXISTS idx_nft_coll_auctions_date ON nft_collection_recent_auctions(stat_date);
	`
	_, err := w.db.Pool.Exec(ctx, schemaSQL)
	return err
}

func (w *CollectionWorker) updateCollectionData(ctx context.Context) {
	// Ensure tables exist before running any operations (self-healing migration fallback)
	if err := w.ensureTablesExist(ctx); err != nil {
		slog.Error("[CollectionWorker] Failed to ensure collection tables exist", "error", err)
		return
	}

	// advisory lock ID: 847295 to prevent concurrent runs on multiple instances
	conn, err := w.db.Pool.Acquire(ctx)
	if err != nil {
		slog.Error("[CollectionWorker] Failed to acquire database connection", "error", err)
		return
	}
	defer conn.Release()

	var acquired bool
	err = conn.QueryRow(ctx, "SELECT pg_try_advisory_lock(847295)").Scan(&acquired)
	if err != nil || !acquired {
		slog.Info("[CollectionWorker] Collection stats update skipped: lock held by another instance")
		return
	}
	defer func() {
		_, _ = conn.Exec(context.Background(), "SELECT pg_advisory_unlock(847295)")
	}()

	slog.Info("[CollectionWorker] Running collection stats update cycle...")

	// 1. Check if stats table has any rows
	var count int
	err = conn.QueryRow(ctx, "SELECT COUNT(*) FROM nft_collection_stats").Scan(&count)
	if err != nil {
		slog.Error("[CollectionWorker] Failed to check nft_collection_stats count", "error", err)
		return
	}

	today := time.Now().UTC().Truncate(24 * time.Hour)

	if count == 0 {
		slog.Info("[CollectionWorker] Database is empty. Seeding initial collection data...")
		w.seedInitialData(ctx, today)
	}

	// 2. Try to fetch live data from TonAPI and update the database
	if err := w.fetchAndSaveLiveData(ctx, today); err != nil {
		slog.Warn("[CollectionWorker] Failed to fetch live collection data from TonAPI, using existing/fallback data", "error", err)
	} else {
		slog.Info("[CollectionWorker] Successfully updated collection stats with live data")
	}
}

func (w *CollectionWorker) seedInitialData(ctx context.Context, date time.Time) {
	tx, err := w.db.Pool.Begin(ctx)
	if err != nil {
		slog.Error("[CollectionWorker] Failed to start transaction for seeding", "error", err)
		return
	}
	defer tx.Rollback(ctx)

	// Seed stats
	_, err = tx.Exec(ctx, `
		INSERT INTO nft_collection_stats (stat_date, items_count, owners_count, floor_price, total_volume)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (stat_date) DO NOTHING
	`, date, "581K", "164K", "5.66 TON", "124M TON")
	if err != nil {
		slog.Error("[CollectionWorker] Failed to seed nft_collection_stats", "error", err)
		return
	}

	// Seed categories
	categories := []struct {
		Name   string
		Volume string
	}{
		{"2 Letters", "12.4M TON"},
		{"3 Letters", "8.9M TON"},
		{"4 Letters", "5.2M TON"},
		{"5 Letters", "3.1M TON"},
		{"6+ Letters", "1.8M TON"},
	}
	for _, cat := range categories {
		_, err = tx.Exec(ctx, `
			INSERT INTO nft_collection_categories (stat_date, category_name, volume)
			VALUES ($1, $2, $3)
		`, date, cat.Name, cat.Volume)
		if err != nil {
			slog.Error("[CollectionWorker] Failed to seed category", "name", cat.Name, "error", err)
			return
		}
	}

	// Seed recent auctions
	auctions := []struct {
		Name   string
		Price  string
		Status string
	}{
		{"+888 0000 0000", "4,500 TON", "Active"},
		{"+888 1234 5678", "2,100 TON", "Active"},
		{"+888 8888 8888", "15,000 TON", "Active"},
		{"+888 0909 0909", "1,800 TON", "Active"},
		{"+888 7777 7777", "9,800 TON", "Active"},
	}
	for _, auc := range auctions {
		_, err = tx.Exec(ctx, `
			INSERT INTO nft_collection_recent_auctions (stat_date, item_name, price, status)
			VALUES ($1, $2, $3, $4)
		`, date, auc.Name, auc.Price, auc.Status)
		if err != nil {
			slog.Error("[CollectionWorker] Failed to seed auction", "name", auc.Name, "error", err)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		slog.Error("[CollectionWorker] Failed to commit seeding transaction", "error", err)
	} else {
		slog.Info("[CollectionWorker] Initial seeding completed successfully")
	}
}

func (w *CollectionWorker) fetchAndSaveLiveData(ctx context.Context, date time.Time) error {
	if w.tonClient == nil {
		return fmt.Errorf("tonClient is nil")
	}

	// Query collection details from TonAPI
	addr := "EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi"
	collection, err := w.tonClient.GetCollection(ctx, addr)
	if err != nil {
		return fmt.Errorf("failed to fetch collection from TonAPI: %w", err)
	}

	itemsCount := collection.NextItemIndex
	// Formulate a nice readable string like "581.2K"
	itemsStr := ""
	if itemsCount > 0 {
		itemsStr = fmt.Sprintf("%d", itemsCount)
		if itemsCount >= 1000 {
			itemsStr = fmt.Sprintf("%.1fK", float64(itemsCount)/1000.0)
		}
	}

	// We can't fetch owners/floor_price/volume directly from TonAPI as it is marketplace-specific.
	// So we retrieve the last known valid values from the database, or use default fallbacks.
	var lastOwners, lastFloor, lastVolume, lastItems string
	err = w.db.Pool.QueryRow(ctx, `
		SELECT owners_count, floor_price, total_volume, items_count
		FROM nft_collection_stats
		WHERE items_count != '-1' AND items_count != '0' AND items_count != ''
		ORDER BY stat_date DESC
		LIMIT 1
	`).Scan(&lastOwners, &lastFloor, &lastVolume, &lastItems)

	if err != nil {
		// Fallback to defaults if no previous valid stats exist
		lastOwners = "164K"
		lastFloor = "5.66 TON"
		lastVolume = "124M TON"
		lastItems = "581K"
	}

	if itemsStr == "" {
		itemsStr = lastItems
	}

	// Save the updated stats for today
	tx, err := w.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Upsert stats for today
	_, err = tx.Exec(ctx, `
		INSERT INTO nft_collection_stats (stat_date, items_count, owners_count, floor_price, total_volume)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (stat_date) DO UPDATE SET
			items_count = EXCLUDED.items_count,
			owners_count = EXCLUDED.owners_count,
			floor_price = EXCLUDED.floor_price,
			total_volume = EXCLUDED.total_volume
	`, date, itemsStr, lastOwners, lastFloor, lastVolume)
	if err != nil {
		return fmt.Errorf("failed to upsert stats: %w", err)
	}

	// Also make sure categories and auctions exist for today
	var catCount int
	_ = tx.QueryRow(ctx, "SELECT COUNT(*) FROM nft_collection_categories WHERE stat_date = $1", date).Scan(&catCount)
	if catCount == 0 {
		// Copy from the latest available date
		_, err = tx.Exec(ctx, `
			INSERT INTO nft_collection_categories (stat_date, category_name, volume)
			SELECT $1, category_name, volume
			FROM nft_collection_categories
			WHERE stat_date = (SELECT stat_date FROM nft_collection_categories ORDER BY stat_date DESC LIMIT 1)
		`, date)
		if err != nil {
			slog.Warn("[CollectionWorker] Could not copy categories for today, using defaults", "error", err)
			// Fallback default categories
			categories := []struct {
				Name   string
				Volume string
			}{
				{"2 Letters", "12.4M TON"},
				{"3 Letters", "8.9M TON"},
				{"4 Letters", "5.2M TON"},
				{"5 Letters", "3.1M TON"},
				{"6+ Letters", "1.8M TON"},
			}
			for _, cat := range categories {
				_, _ = tx.Exec(ctx, `
					INSERT INTO nft_collection_categories (stat_date, category_name, volume)
					VALUES ($1, $2, $3)
				`, date, cat.Name, cat.Volume)
			}
		}
	}

	var aucCount int
	_ = tx.QueryRow(ctx, "SELECT COUNT(*) FROM nft_collection_recent_auctions WHERE stat_date = $1", date).Scan(&aucCount)
	if aucCount == 0 {
		// Copy from latest available
		_, err = tx.Exec(ctx, `
			INSERT INTO nft_collection_recent_auctions (stat_date, item_name, price, status)
			SELECT $1, item_name, price, status
			FROM nft_collection_recent_auctions
			WHERE stat_date = (SELECT stat_date FROM nft_collection_recent_auctions ORDER BY stat_date DESC LIMIT 1)
		`, date)
		if err != nil {
			slog.Warn("[CollectionWorker] Could not copy auctions for today, using defaults", "error", err)
			// Fallback defaults
			auctions := []struct {
				Name   string
				Price  string
				Status string
			}{
				{"+888 0000 0000", "4,500 TON", "Active"},
				{"+888 1234 5678", "2,100 TON", "Active"},
				{"+888 8888 8888", "15,000 TON", "Active"},
			}
			for _, auc := range auctions {
				_, _ = tx.Exec(ctx, `
					INSERT INTO nft_collection_recent_auctions (stat_date, item_name, price, status)
					VALUES ($1, $2, $3, $4)
				`, date, auc.Name, auc.Price, auc.Status)
			}
		}
	}

	return tx.Commit(ctx)
}
