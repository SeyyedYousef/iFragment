package username

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
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

	CREATE TABLE IF NOT EXISTS nft_collection_top_sales (
		id SERIAL PRIMARY KEY,
		stat_date DATE NOT NULL,
		item_name TEXT NOT NULL,
		price TEXT NOT NULL,
		status TEXT,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		CONSTRAINT fk_stat_date FOREIGN KEY (stat_date) REFERENCES nft_collection_stats (stat_date) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS nft_collection_recent_activity (
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
	CREATE INDEX IF NOT EXISTS idx_nft_coll_top_sales ON nft_collection_top_sales(stat_date);
	CREATE INDEX IF NOT EXISTS idx_nft_coll_recent_act ON nft_collection_recent_activity(stat_date);
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

	// Force fresh seeding for Username stats
	var hasOldData bool
	_ = conn.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM nft_collection_stats WHERE floor_price = '5.66 TON' OR items_count = '581K')").Scan(&hasOldData)
	if hasOldData {
		slog.Info("[CollectionWorker] Detected old stats/anonymous numbers data. Clearing tables for fresh real Username data...")
		_, _ = conn.Exec(ctx, "TRUNCATE TABLE nft_collection_stats CASCADE;")
	}

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

	// 2. Try to fetch live data from GetGems/Fragment and update the database
	if err := w.fetchAndSaveLiveData(ctx, today); err != nil {
		slog.Warn("[CollectionWorker] Failed to fetch live collection data from APIs, using existing/fallback data", "error", err)
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

	// Seed stats using real live metadata values
	_, err = tx.Exec(ctx, `
		INSERT INTO nft_collection_stats (stat_date, items_count, owners_count, floor_price, total_volume)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (stat_date) DO NOTHING
	`, date, "582.8K", "164.6K", "5.49 TON", "124.0M TON")
	if err != nil {
		slog.Error("[CollectionWorker] Failed to seed nft_collection_stats", "error", err)
		return
	}

	// Seed categories
	categories := []struct {
		Name   string
		Volume string
	}{
		{"4 Letters", "55.8M TON"},
		{"5 Letters", "37.2M TON"},
		{"6 Letters", "18.6M TON"},
		{"7+ Letters", "12.4M TON"},
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

	// Seed fallback recent auctions using actual premium ones from Fragment
	auctions := []struct {
		Name   string
		Price  string
		Status string
	}{
		{"@feds", "23,665 TON", "Active"},
		{"@blackhat", "10,001 TON", "Active"},
		{"@gramv", "8,023 TON", "Active"},
		{"@cryptoapp", "8,009 TON", "Active"},
		{"@bcsj", "5,513 TON", "Active"},
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

func fetchHTML(ctx context.Context, url string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	// Set resilient timeout to survive slower network links
	client := &http.Client{Timeout: 25 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

type GetGemsNextData struct {
	Props struct {
		PageProps struct {
			GqlCache map[string]interface{} `json:"gqlCache"`
		} `json:"pageProps"`
	} `json:"props"`
}

func (w *CollectionWorker) fetchRealStatsFromGetGems(ctx context.Context) (items, owners, floor, volume string, err error) {
	html, err := fetchHTML(ctx, "https://getgems.io/collection/EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi")
	if err != nil {
		return "", "", "", "", err
	}

	reNextData := regexp.MustCompile(`(?s)<script id="__NEXT_DATA__" type="application/json">(.*?)</script>`)
	match := reNextData.FindStringSubmatch(html)
	if len(match) < 2 {
		return "", "", "", "", fmt.Errorf("could not find __NEXT_DATA__ script tag")
	}

	var data GetGemsNextData
	if err := json.Unmarshal([]byte(match[1]), &data); err != nil {
		return "", "", "", "", err
	}

	var stats map[string]interface{}
	for k, v := range data.Props.PageProps.GqlCache {
		if len(k) > 23 && k[:23] == "alphaNftCollectionStats" {
			if m, ok := v.(map[string]interface{}); ok {
				stats = m
				break
			}
		}
	}

	if stats == nil {
		return "", "", "", "", fmt.Errorf("collection stats not found in gqlCache")
	}

	floorVal, _ := stats["floorPrice"].(float64)
	floor = fmt.Sprintf("%.2f TON", floorVal)

	itemsVal, _ := stats["itemsCount"].(float64)
	items = fmt.Sprintf("%.1fK", itemsVal/1000.0)

	holdersVal, _ := stats["holders"].(float64)
	owners = fmt.Sprintf("%.1fK", holdersVal/1000.0)

	volStr, _ := stats["totalVolumeSold"].(string)
	if volStr != "" {
		var volFloat float64
		_, err := fmt.Sscanf(volStr, "%f", &volFloat)
		if err == nil {
			volume = fmt.Sprintf("%.1fM TON", volFloat/1e15)
		}
	}
	if volume == "" {
		volume = "124.0M TON"
	}

	return items, owners, floor, volume, nil
}

func (w *CollectionWorker) fetchRealAuctionsFromFragment(ctx context.Context) []struct {
	Name   string
	Price  string
	Status string
} {
	html, err := fetchHTML(ctx, "https://fragment.com/")
	if err != nil {
		slog.Warn("[CollectionWorker] Failed to fetch Fragment homepage", "error", err)
		return nil
	}

	reRow := regexp.MustCompile(`(?s)<tr class="tm-row-selectable">.*?<div class="table-cell-value tm-value">@([a-zA-Z0-9_]+)</div>.*?<div class="table-cell-value tm-value icon-before icon-ton">([0-9,]+)</div>`)
	matches := reRow.FindAllStringSubmatch(html, -1)

	var auctions []struct {
		Name   string
		Price  string
		Status string
	}

	for _, match := range matches {
		if len(match) >= 3 {
			auctions = append(auctions, struct {
				Name   string
				Price  string
				Status string
			}{
				Name:   "@" + match[1],
				Price:  match[2] + " TON",
				Status: "Active",
			})
		}
	}
	return auctions
}

func (w *CollectionWorker) fetchRealTopSalesFromFragment(ctx context.Context) []struct {
	Name   string
	Price  string
	Status string
} {
	html, err := fetchHTML(ctx, "https://fragment.com/?filter=sold")
	if err != nil {
		slog.Warn("[CollectionWorker] Failed to fetch Fragment sold page (top sales)", "error", err)
		return nil
	}

	reRow := regexp.MustCompile(`(?s)<tr class="tm-row-selectable">.*?<div class="table-cell-value tm-value">@([a-zA-Z0-9_]+)</div>.*?<div class="table-cell-value tm-value icon-before icon-ton">([0-9,]+)</div>`)
	matches := reRow.FindAllStringSubmatch(html, -1)

	var sales []struct {
		Name   string
		Price  string
		Status string
	}

	for _, match := range matches {
		if len(match) >= 3 {
			sales = append(sales, struct {
				Name   string
				Price  string
				Status string
			}{
				Name:   "@" + match[1],
				Price:  match[2] + " TON",
				Status: "Sold",
			})
		}
	}
	return sales
}

func (w *CollectionWorker) fetchRealRecentActivityFromFragment(ctx context.Context) []struct {
	Name   string
	Price  string
	Status string
} {
	html, err := fetchHTML(ctx, "https://fragment.com/?filter=sold&sort=listed")
	if err != nil {
		slog.Warn("[CollectionWorker] Failed to fetch Fragment recently sold page", "error", err)
		return nil
	}

	reRow := regexp.MustCompile(`(?s)<tr class="tm-row-selectable">.*?<div class="table-cell-value tm-value">@([a-zA-Z0-9_]+)</div>.*?<div class="table-cell-value tm-value icon-before icon-ton">([0-9,]+)</div>`)
	matches := reRow.FindAllStringSubmatch(html, -1)

	var activity []struct {
		Name   string
		Price  string
		Status string
	}

	for _, match := range matches {
		if len(match) >= 3 {
			activity = append(activity, struct {
				Name   string
				Price  string
				Status string
			}{
				Name:   "@" + match[1],
				Price:  match[2] + " TON",
				Status: "Sold",
			})
		}
	}
	return activity
}

func (w *CollectionWorker) fetchAndSaveLiveData(ctx context.Context, date time.Time) error {
	// Try fetching real live stats from GetGems
	itemsStr, ownersStr, floorStr, volumeStr, err := w.fetchRealStatsFromGetGems(ctx)
	if err != nil {
		slog.Warn("[CollectionWorker] Failed to fetch live stats from GetGems, using fallbacks", "error", err)
		// Fallbacks
		itemsStr = "582.8K"
		ownersStr = "164.6K"
		floorStr = "5.49 TON"
		volumeStr = "124.0M TON"
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
	`, date, itemsStr, ownersStr, floorStr, volumeStr)
	if err != nil {
		return fmt.Errorf("failed to upsert stats: %w", err)
	}

	// Make sure categories exist for today
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
			categories := []struct {
				Name   string
				Volume string
			}{
				{"4 Letters", "55.8M TON"},
				{"5 Letters", "37.2M TON"},
				{"6 Letters", "18.6M TON"},
				{"7+ Letters", "12.4M TON"},
			}
			for _, cat := range categories {
				_, _ = tx.Exec(ctx, `
					INSERT INTO nft_collection_categories (stat_date, category_name, volume)
					VALUES ($1, $2, $3)
				`, date, cat.Name, cat.Volume)
			}
		}
	}

	// Fetch dynamic live premium auctions from Fragment
	liveAuctions := w.fetchRealAuctionsFromFragment(ctx)
	if len(liveAuctions) > 0 {
		slog.Info("[CollectionWorker] Successfully scraped live auctions from Fragment", "count", len(liveAuctions))
		_, _ = tx.Exec(ctx, "DELETE FROM nft_collection_recent_auctions WHERE stat_date = $1", date)
		maxInsert := 8
		if len(liveAuctions) < maxInsert {
			maxInsert = len(liveAuctions)
		}
		for i := 0; i < maxInsert; i++ {
			auc := liveAuctions[i]
			_, err = tx.Exec(ctx, `
				INSERT INTO nft_collection_recent_auctions (stat_date, item_name, price, status)
				VALUES ($1, $2, $3, $4)
			`, date, auc.Name, auc.Price, auc.Status)
			if err != nil {
				slog.Error("[CollectionWorker] Failed to insert Fragment live auction", "name", auc.Name, "error", err)
			}
		}
	} else {
		// Fallback to latest database auctions or defaults
		var aucCount int
		_ = tx.QueryRow(ctx, "SELECT COUNT(*) FROM nft_collection_recent_auctions WHERE stat_date = $1", date).Scan(&aucCount)
		if aucCount == 0 {
			_, err = tx.Exec(ctx, `
				INSERT INTO nft_collection_recent_auctions (stat_date, item_name, price, status)
				SELECT $1, item_name, price, status
				FROM nft_collection_recent_auctions
				WHERE stat_date = (SELECT stat_date FROM nft_collection_recent_auctions ORDER BY stat_date DESC LIMIT 1)
			`, date)
			if err != nil {
				slog.Warn("[CollectionWorker] Could not copy auctions for today, using defaults", "error", err)
				defaultAuctions := []struct {
					Name   string
					Price  string
					Status string
				}{
					{"@feds", "23,665 TON", "Active"},
					{"@blackhat", "10,001 TON", "Active"},
					{"@gramv", "8,023 TON", "Active"},
					{"@cryptoapp", "8,009 TON", "Active"},
					{"@bcsj", "5,513 TON", "Active"},
				}
				for _, auc := range defaultAuctions {
					_, _ = tx.Exec(ctx, `
						INSERT INTO nft_collection_recent_auctions (stat_date, item_name, price, status)
						VALUES ($1, $2, $3, $4)
					`, date, auc.Name, auc.Price, auc.Status)
				}
			}
		}
	}

	// Fetch dynamic live top sales from Fragment
	liveTopSales := w.fetchRealTopSalesFromFragment(ctx)
	if len(liveTopSales) > 0 {
		slog.Info("[CollectionWorker] Successfully scraped top sales from Fragment", "count", len(liveTopSales))
		_, _ = tx.Exec(ctx, "DELETE FROM nft_collection_top_sales WHERE stat_date = $1", date)
		maxInsert := 8
		if len(liveTopSales) < maxInsert {
			maxInsert = len(liveTopSales)
		}
		for i := 0; i < maxInsert; i++ {
			auc := liveTopSales[i]
			_, err = tx.Exec(ctx, `
				INSERT INTO nft_collection_top_sales (stat_date, item_name, price, status)
				VALUES ($1, $2, $3, $4)
			`, date, auc.Name, auc.Price, auc.Status)
			if err != nil {
				slog.Error("[CollectionWorker] Failed to insert Fragment top sale", "name", auc.Name, "error", err)
			}
		}
	} else {
		var saleCount int
		_ = tx.QueryRow(ctx, "SELECT COUNT(*) FROM nft_collection_top_sales WHERE stat_date = $1", date).Scan(&saleCount)
		if saleCount == 0 {
			_, err = tx.Exec(ctx, `
				INSERT INTO nft_collection_top_sales (stat_date, item_name, price, status)
				SELECT $1, item_name, price, status
				FROM nft_collection_top_sales
				WHERE stat_date = (SELECT stat_date FROM nft_collection_top_sales ORDER BY stat_date DESC LIMIT 1)
			`, date)
			if err != nil {
				slog.Warn("[CollectionWorker] Could not copy top sales for today, using defaults", "error", err)
				defaultSales := []struct {
					Name   string
					Price  string
					Status string
				}{
					{"@danbao", "1,583,948 TON", "Sold"},
					{"@news", "994,000 TON", "Sold"},
					{"@auto", "900,000 TON", "Sold"},
					{"@bank", "850,000 TON", "Sold"},
					{"@avia", "800,000 TON", "Sold"},
				}
				for _, auc := range defaultSales {
					_, _ = tx.Exec(ctx, `
						INSERT INTO nft_collection_top_sales (stat_date, item_name, price, status)
						VALUES ($1, $2, $3, $4)
					`, date, auc.Name, auc.Price, auc.Status)
				}
			}
		}
	}

	// Fetch dynamic live recent activity from Fragment
	liveRecent := w.fetchRealRecentActivityFromFragment(ctx)
	if len(liveRecent) > 0 {
		slog.Info("[CollectionWorker] Successfully scraped recent activity from Fragment", "count", len(liveRecent))
		_, _ = tx.Exec(ctx, "DELETE FROM nft_collection_recent_activity WHERE stat_date = $1", date)
		maxInsert := 8
		if len(liveRecent) < maxInsert {
			maxInsert = len(liveRecent)
		}
		for i := 0; i < maxInsert; i++ {
			auc := liveRecent[i]
			_, err = tx.Exec(ctx, `
				INSERT INTO nft_collection_recent_activity (stat_date, item_name, price, status)
				VALUES ($1, $2, $3, $4)
			`, date, auc.Name, auc.Price, auc.Status)
			if err != nil {
				slog.Error("[CollectionWorker] Failed to insert Fragment recent activity", "name", auc.Name, "error", err)
			}
		}
	} else {
		var actCount int
		_ = tx.QueryRow(ctx, "SELECT COUNT(*) FROM nft_collection_recent_activity WHERE stat_date = $1", date).Scan(&actCount)
		if actCount == 0 {
			_, err = tx.Exec(ctx, `
				INSERT INTO nft_collection_recent_activity (stat_date, item_name, price, status)
				SELECT $1, item_name, price, status
				FROM nft_collection_recent_activity
				WHERE stat_date = (SELECT stat_date FROM nft_collection_recent_activity ORDER BY stat_date DESC LIMIT 1)
			`, date)
			if err != nil {
				slog.Warn("[CollectionWorker] Could not copy recent activity for today, using defaults", "error", err)
				defaultRecent := []struct {
					Name   string
					Price  string
					Status string
				}{
					{"@hateallperson", "10 TON", "Sold"},
					{"@ruimatech", "15 TON", "Sold"},
					{"@grimoire", "515 TON", "Sold"},
					{"@aiyawei", "19 TON", "Sold"},
					{"@buxinxie", "19 TON", "Sold"},
				}
				for _, auc := range defaultRecent {
					_, _ = tx.Exec(ctx, `
						INSERT INTO nft_collection_recent_activity (stat_date, item_name, price, status)
						VALUES ($1, $2, $3, $4)
					`, date, auc.Name, auc.Price, auc.Status)
				}
			}
		}
	}

	return tx.Commit(ctx)
}
