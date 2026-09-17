package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
)

type GiftsRepo struct {
	db *Database
}

func NewGiftsRepo(db *Database) *GiftsRepo {
	return &GiftsRepo{db: db}
}

type GiftReportRecord struct {
	ReportID        uuid.UUID
	UserID          int64
	GiftID          string
	ModelID         string
	SerialNumber    int
	FairValueNano   int64
	ConfidenceScore int
	ReportSnapshot  []byte
	PurchasedAt     time.Time
}

type GiftWatchlistItem struct {
	ID                int64           `json:"id"`
	UserID            int64           `json:"user_id"`
	GiftID            string          `json:"gift_id"`
	ModelID           string          `json:"model_id"`
	SerialNumber      int             `json:"serial_number"`
	AlertOnSale       bool            `json:"alert_on_sale"`
	AlertOnPriceDrop  bool            `json:"alert_on_price_drop"`
	TargetPriceGRAM   decimal.Decimal `json:"target_price_gram"`
	CreatedAt         time.Time       `json:"created_at"`
}

type GiftSaleRecord struct {
	ID              int64           `json:"id"`
	GiftID          string          `json:"gift_id"`
	ModelID         string          `json:"model_id"`
	SerialNumber    int             `json:"serial_number"`
	Venue           string          `json:"venue"`
	Currency        string          `json:"currency"`
	SalePriceRaw    decimal.Decimal `json:"sale_price_raw"`
	SalePriceGRAM   decimal.Decimal `json:"sale_price_gram"`
	SalePriceUSD    decimal.Decimal `json:"sale_price_usd"`
	VenueFeePct     decimal.Decimal `json:"venue_fee_pct"`
	PriceConfidence string          `json:"price_confidence"`
	SaleDate        time.Time       `json:"sale_date"`
	BuyerAddress    string           `json:"buyer_address"`
	SellerAddress   string           `json:"seller_address"`
	TxHash          string           `json:"tx_hash"`
	EventIndex      int              `json:"event_index"`
	TonUsdAtSale    *decimal.Decimal `json:"ton_usd_at_sale,omitempty"`
}

type VenueSnapshotRecord struct {
	ModelID            string          `json:"model_id"`
	Venue              string          `json:"venue"`
	FloorPriceRaw      decimal.Decimal `json:"floor_price_raw"`
	FloorPriceGRAM     decimal.Decimal `json:"floor_price_gram"`
	Currency           string          `json:"currency"`
	Volume24hGRAM      decimal.Decimal `json:"volume_24h_gram"`
	Volume7dGRAM       decimal.Decimal `json:"volume_7d_gram"`
	ActiveListings     int             `json:"active_listings"`
	VenueFeePct        decimal.Decimal `json:"venue_fee_pct"`
	HasRealVolumeBadge bool            `json:"has_real_volume_badge"`
	UpdatedAt          time.Time       `json:"updated_at"`
}

func (r *GiftsRepo) GetPurchasedGiftReport(ctx context.Context, userID int64, giftID string) (*GiftReportRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database connection unavailable")
	}

	query := `
		SELECT report_id, user_id, gift_id, model_id, serial_number, fair_value_nano_gram, confidence_score, report_snapshot, purchased_at
		FROM gift_reports
		WHERE user_id = $1 AND gift_id = $2 AND purchased_at > now() - interval '24 hours'
		ORDER BY purchased_at DESC
		LIMIT 1`

	var rec GiftReportRecord
	err := r.db.Pool.QueryRow(ctx, query, userID, giftID).Scan(
		&rec.ReportID, &rec.UserID, &rec.GiftID, &rec.ModelID, &rec.SerialNumber,
		&rec.FairValueNano, &rec.ConfidenceScore, &rec.ReportSnapshot, &rec.PurchasedAt,
	)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *GiftsRepo) IsGiftReportPurchased(ctx context.Context, userID int64, giftID string) (bool, error) {
	if r.db == nil || r.db.Pool == nil {
		return false, fmt.Errorf("database connection unavailable")
	}

	query := `
		SELECT EXISTS(
			SELECT 1 FROM gift_reports
			WHERE user_id = $1 AND gift_id = $2 AND purchased_at > now() - interval '24 hours'
		)`

	var exists bool
	err := r.db.Pool.QueryRow(ctx, query, userID, giftID).Scan(&exists)
	return exists, err
}

func (r *GiftsRepo) SaveGiftReport(ctx context.Context, userID int64, giftID, modelID string, serialNumber int, fairNano int64, confidence int, snapshot []byte) (uuid.UUID, error) {
	if r.db == nil || r.db.Pool == nil {
		return uuid.Nil, fmt.Errorf("database connection unavailable")
	}

	query := `
		INSERT INTO gift_reports (
			user_id, gift_id, model_id, serial_number, fair_value_nano_gram, confidence_score, report_snapshot, purchased_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
		ON CONFLICT (user_id, gift_id) DO UPDATE SET report_snapshot = EXCLUDED.report_snapshot, purchased_at = now()
		RETURNING report_id`

	var reportID uuid.UUID
	err := r.db.Pool.QueryRow(ctx, query, userID, giftID, modelID, serialNumber, fairNano, confidence, snapshot).Scan(&reportID)
	return reportID, err
}

func (r *GiftsRepo) SaveGiftReportTx(ctx context.Context, tx pgx.Tx, userID int64, giftID, modelID string, serialNumber int, fairNano int64, confidence int, snapshot []byte) (uuid.UUID, error) {
	if tx == nil {
		return r.SaveGiftReport(ctx, userID, giftID, modelID, serialNumber, fairNano, confidence, snapshot)
	}

	query := `
		INSERT INTO gift_reports (
			user_id, gift_id, model_id, serial_number, fair_value_nano_gram, confidence_score, report_snapshot, purchased_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
		ON CONFLICT (user_id, gift_id) DO UPDATE SET report_snapshot = EXCLUDED.report_snapshot, purchased_at = now()
		RETURNING report_id`

	var reportID uuid.UUID
	err := tx.QueryRow(ctx, query, userID, giftID, modelID, serialNumber, fairNano, confidence, snapshot).Scan(&reportID)
	return reportID, err
}

func (r *GiftsRepo) AddToWatchlist(ctx context.Context, userID int64, giftID string) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database connection unavailable")
	}

	query := `
		INSERT INTO gift_watchlist (user_id, gift_id, alert_on_sale, alert_on_price_drop, created_at)
		VALUES ($1, $2, true, true, now())
		ON CONFLICT (user_id, gift_id) DO NOTHING`

	_, err := r.db.Pool.Exec(ctx, query, userID, giftID)
	return err
}

func (r *GiftsRepo) RemoveFromWatchlist(ctx context.Context, userID int64, giftID string) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database connection unavailable")
	}

	query := `DELETE FROM gift_watchlist WHERE user_id = $1 AND gift_id = $2`
	_, err := r.db.Pool.Exec(ctx, query, userID, giftID)
	return err
}

func (r *GiftsRepo) GetWatchlist(ctx context.Context, userID int64) ([]GiftWatchlistItem, error) {
	if r.db == nil || r.db.Pool == nil {
		return []GiftWatchlistItem{}, nil
	}

	query := `
		SELECT id, user_id, gift_id, alert_on_sale, alert_on_price_drop, COALESCE(target_price_gram, 0), created_at
		FROM gift_watchlist
		WHERE user_id = $1
		ORDER BY created_at DESC`

	rows, err := r.db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]GiftWatchlistItem, 0)
	for rows.Next() {
		var it GiftWatchlistItem
		if err := rows.Scan(&it.ID, &it.UserID, &it.GiftID, &it.AlertOnSale, &it.AlertOnPriceDrop, &it.TargetPriceGRAM, &it.CreatedAt); err == nil {
			items = append(items, it)
		}
	}
	return items, nil
}

func (r *GiftsRepo) GetVenueSnapshots(ctx context.Context, modelID string) ([]VenueSnapshotRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return []VenueSnapshotRecord{}, nil
	}

	query := `
		SELECT model_id, venue, floor_price_raw, floor_price_gram, currency, volume_24h_gram, volume_7d_gram, active_listings, venue_fee_pct, has_real_volume_badge, updated_at
		FROM venue_snapshots
		WHERE (model_id = $1 OR $1 = '') AND updated_at >= now() - interval '6 hours'
		ORDER BY floor_price_gram ASC`

	rows, err := r.db.Pool.Query(ctx, query, modelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []VenueSnapshotRecord
	for rows.Next() {
		var s VenueSnapshotRecord
		if err := rows.Scan(
			&s.ModelID, &s.Venue, &s.FloorPriceRaw, &s.FloorPriceGRAM, &s.Currency,
			&s.Volume24hGRAM, &s.Volume7dGRAM, &s.ActiveListings, &s.VenueFeePct,
			&s.HasRealVolumeBadge, &s.UpdatedAt,
		); err == nil {
			list = append(list, s)
		}
	}
	return list, nil
}

func (r *GiftsRepo) InsertGiftSale(ctx context.Context, s GiftSaleRecord) (int64, error) {
	if r.db == nil || r.db.Pool == nil {
		return 0, fmt.Errorf("database connection unavailable")
	}

	query := `
		INSERT INTO gift_sales (
			gift_id, model_id, serial_number, venue, currency,
			sale_price_raw, sale_price_gram, sale_price_usd, venue_fee_pct,
			price_confidence, sale_date, buyer_address, seller_address, tx_hash,
			event_index, ton_usd_at_sale
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		ON CONFLICT (venue, tx_hash, event_index) WHERE tx_hash IS NOT NULL AND tx_hash != ''
		DO NOTHING
		RETURNING id`

	var id int64
	err := r.db.Pool.QueryRow(ctx, query,
		s.GiftID, s.ModelID, s.SerialNumber, s.Venue, s.Currency,
		s.SalePriceRaw, s.SalePriceGRAM, s.SalePriceUSD, s.VenueFeePct,
		s.PriceConfidence, s.SaleDate, s.BuyerAddress, s.SellerAddress, s.TxHash,
		s.EventIndex, s.TonUsdAtSale,
	).Scan(&id)
	if err != nil && (err.Error() == "no rows in result set" || strings.Contains(err.Error(), "no rows")) {
		return 0, nil
	}

	return id, err
}

func (r *GiftsRepo) SaveValuationAudit(ctx context.Context, giftID, modelID string, serialNumber int, modelVersion string, configSnapshot map[string]interface{}, gramUsdRate, baseGram, lowGram, expectedGram, highGram float64, confidence int16, priceBasis string, reasoningLog map[string]interface{}) (int64, error) {
	if r.db == nil || r.db.Pool == nil {
		return 1, nil
	}

	cfgBytes, _ := json.Marshal(configSnapshot)
	logBytes, _ := json.Marshal(reasoningLog)

	query := `
		INSERT INTO gift_valuations (
			gift_id, model_id, serial_number, model_version, config_snapshot,
			gram_usd_rate, base_price_gram, low_gram, expected_gram, high_gram,
			confidence_score, price_basis, reasoning_log
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id`

	var id int64
	err := r.db.Pool.QueryRow(ctx, query,
		giftID, modelID, serialNumber, modelVersion, cfgBytes,
		gramUsdRate, baseGram, lowGram, expectedGram, highGram,
		confidence, priceBasis, logBytes,
	).Scan(&id)

	return id, err
}

// GetLastSaleForGift returns the most recent realized sale record for an exact gift item (model + serial)
func (r *GiftsRepo) GetLastSaleForGift(ctx context.Context, modelID string, serialNumber int) (*GiftSaleRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, nil
	}

	altModel := strings.ReplaceAll(modelID, "_", "-")
	if altModel == modelID {
		altModel = strings.ReplaceAll(modelID, "-", "_")
	}

	query := `
		SELECT id, gift_id, model_id, serial_number, venue, currency,
		       sale_price_raw, sale_price_gram, sale_price_usd, venue_fee_pct,
		       price_confidence, sale_date, buyer_address, seller_address, tx_hash,
		       COALESCE(event_index, 0), ton_usd_at_sale
		FROM gift_sales
		WHERE (model_id = $1 OR model_id = $2) AND serial_number = $3 AND COALESCE(is_reorged, FALSE) = FALSE
		ORDER BY sale_date DESC
		LIMIT 1`

	var s GiftSaleRecord
	err := r.db.Pool.QueryRow(ctx, query, modelID, altModel, serialNumber).Scan(
		&s.ID, &s.GiftID, &s.ModelID, &s.SerialNumber, &s.Venue, &s.Currency,
		&s.SalePriceRaw, &s.SalePriceGRAM, &s.SalePriceUSD, &s.VenueFeePct,
		&s.PriceConfidence, &s.SaleDate, &s.BuyerAddress, &s.SellerAddress, &s.TxHash,
		&s.EventIndex, &s.TonUsdAtSale,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// GetCompsForGift fetches closest comparable sales by model and serial proximity
func (r *GiftsRepo) GetCompsForGift(ctx context.Context, modelID string, serialNumber int, limit int) ([]GiftSaleRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return []GiftSaleRecord{}, nil
	}
	if limit <= 0 {
		limit = 5
	}

	query := `
		SELECT id, gift_id, model_id, serial_number, venue, currency,
		       sale_price_raw, sale_price_gram, sale_price_usd, venue_fee_pct,
		       price_confidence, sale_date, buyer_address, seller_address, tx_hash,
		       COALESCE(event_index, 0), ton_usd_at_sale
		FROM gift_sales
		WHERE model_id = $1 AND COALESCE(is_reorged, FALSE) = FALSE
		ORDER BY ABS(serial_number - $2) ASC, sale_date DESC
		LIMIT $3`

	rows, err := r.db.Pool.Query(ctx, query, modelID, serialNumber, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comps []GiftSaleRecord
	for rows.Next() {
		var s GiftSaleRecord
		if err := rows.Scan(
			&s.ID, &s.GiftID, &s.ModelID, &s.SerialNumber, &s.Venue, &s.Currency,
			&s.SalePriceRaw, &s.SalePriceGRAM, &s.SalePriceUSD, &s.VenueFeePct,
			&s.PriceConfidence, &s.SaleDate, &s.BuyerAddress, &s.SellerAddress, &s.TxHash,
			&s.EventIndex, &s.TonUsdAtSale,
		); err == nil {
			comps = append(comps, s)
		}
	}
	return comps, nil
}

// GetRecentSalesByModel fetches recent sales for a collection model
func (r *GiftsRepo) GetRecentSalesByModel(ctx context.Context, modelID string, limit int) ([]GiftSaleRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return []GiftSaleRecord{}, nil
	}
	if limit <= 0 {
		limit = 10
	}

	query := `
		SELECT id, gift_id, model_id, serial_number, venue, currency,
		       sale_price_raw, sale_price_gram, sale_price_usd, venue_fee_pct,
		       price_confidence, sale_date, buyer_address, seller_address, tx_hash,
		       COALESCE(event_index, 0), ton_usd_at_sale
		FROM gift_sales
		WHERE model_id = $1 OR $1 = ''
		ORDER BY sale_date DESC
		LIMIT $2`

	rows, err := r.db.Pool.Query(ctx, query, modelID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sales []GiftSaleRecord
	for rows.Next() {
		var s GiftSaleRecord
		if err := rows.Scan(
			&s.ID, &s.GiftID, &s.ModelID, &s.SerialNumber, &s.Venue, &s.Currency,
			&s.SalePriceRaw, &s.SalePriceGRAM, &s.SalePriceUSD, &s.VenueFeePct,
			&s.PriceConfidence, &s.SaleDate, &s.BuyerAddress, &s.SellerAddress, &s.TxHash,
			&s.EventIndex, &s.TonUsdAtSale,
		); err == nil {
			sales = append(sales, s)
		}
	}
	return sales, nil
}

// UpsertVenueSnapshot inserts or updates a venue's floor and volume snapshot
func (r *GiftsRepo) UpsertVenueSnapshot(ctx context.Context, s VenueSnapshotRecord) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	query := `
		INSERT INTO venue_snapshots (
			model_id, venue, floor_price_raw, floor_price_gram, currency,
			volume_24h_gram, volume_7d_gram, active_listings, venue_fee_pct,
			has_real_volume_badge, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
		ON CONFLICT (model_id, venue) DO UPDATE SET
			floor_price_raw = EXCLUDED.floor_price_raw,
			floor_price_gram = EXCLUDED.floor_price_gram,
			currency = EXCLUDED.currency,
			volume_24h_gram = EXCLUDED.volume_24h_gram,
			volume_7d_gram = EXCLUDED.volume_7d_gram,
			active_listings = EXCLUDED.active_listings,
			venue_fee_pct = EXCLUDED.venue_fee_pct,
			has_real_volume_badge = EXCLUDED.has_real_volume_badge,
			updated_at = now()`

	_, err := r.db.Pool.Exec(ctx, query,
		s.ModelID, s.Venue, s.FloorPriceRaw, s.FloorPriceGRAM, s.Currency,
		s.Volume24hGRAM, s.Volume7dGRAM, s.ActiveListings, s.VenueFeePct,
		s.HasRealVolumeBadge,
	)
	return err
}

// GetGiftTraits fetches traits for a model from gift_traits table
func (r *GiftsRepo) GetGiftTraits(ctx context.Context, modelID string) ([]struct {
	TraitType string
	TraitName string
	Permille  int
}, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, nil
	}

	query := `
		SELECT trait_type, trait_name, permille
		FROM gift_traits
		WHERE model_id = $1
		ORDER BY trait_type ASC, permille ASC`

	rows, err := r.db.Pool.Query(ctx, query, modelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []struct {
		TraitType string
		TraitName string
		Permille  int
	}
	for rows.Next() {
		var item struct {
			TraitType string
			TraitName string
			Permille  int
		}
		if err := rows.Scan(&item.TraitType, &item.TraitName, &item.Permille); err == nil {
			result = append(result, item)
		}
	}
	return result, nil
}

type MarketSalesSourceBreakdownRecord struct {
	VenueName  string          `json:"venue_name"`
	VolumeGRAM decimal.Decimal `json:"volume_gram"`
	DealsCount int             `json:"deals_count"`
}

type SalesPeriodStatsRecord struct {
	DealsCount int                                `json:"deals_count"`
	VolumeGRAM decimal.Decimal                    `json:"volume_gram"`
	MinGRAM    decimal.Decimal                    `json:"min_gram"`
	AvgGRAM    decimal.Decimal                    `json:"avg_gram"`
	MaxGRAM    decimal.Decimal                    `json:"max_gram"`
	BySource   []MarketSalesSourceBreakdownRecord `json:"by_source"`
}

type FloorHistoryPointRecord struct {
	Timestamp      time.Time                  `json:"timestamp"`
	FloorGRAM      decimal.Decimal            `json:"floor_gram"`
	VenueBreakdown map[string]decimal.Decimal `json:"venue_breakdown"`
}

type MarketListingRecord struct {
	ID           int64           `json:"id"`
	ModelID      string          `json:"model_id"`
	SerialNumber int             `json:"serial_number"`
	Venue        string          `json:"venue"`
	ListingID    string          `json:"listing_id"`
	PriceGRAM    decimal.Decimal `json:"price_gram"`
	PriceUSD     decimal.Decimal `json:"price_usd"`
	ModelName    string          `json:"model_name"`
	BackdropName string          `json:"backdrop_name"`
	SymbolName   string          `json:"symbol_name"`
	CenterHex    string          `json:"center_hex"`
	EdgeHex      string          `json:"edge_hex"`
	BuyURL       string          `json:"buy_url"`
	IsActive     bool            `json:"is_active"`
	ObservedAt   time.Time       `json:"observed_at"`
}

// GetSalesStatsByPeriod computes real volume, min, max, avg and deal counts from completed sales
func (r *GiftsRepo) GetSalesStatsByPeriod(ctx context.Context, modelID string, since time.Time) (*SalesPeriodStatsRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return &SalesPeriodStatsRecord{}, nil
	}

	altModel := strings.ReplaceAll(modelID, "_", "-")
	if altModel == modelID {
		altModel = strings.ReplaceAll(modelID, "-", "_")
	}

	querySummary := `
		SELECT
			COALESCE(COUNT(*), 0),
			COALESCE(SUM(sale_price_gram), 0),
			COALESCE(MIN(sale_price_gram), 0),
			COALESCE(AVG(sale_price_gram), 0),
			COALESCE(MAX(sale_price_gram), 0)
		FROM gift_sales
		WHERE (model_id = $1 OR model_id = $2 OR $1 = '')
		  AND sale_date >= $3`

	var rec SalesPeriodStatsRecord
	err := r.db.Pool.QueryRow(ctx, querySummary, modelID, altModel, since).Scan(
		&rec.DealsCount,
		&rec.VolumeGRAM,
		&rec.MinGRAM,
		&rec.AvgGRAM,
		&rec.MaxGRAM,
	)
	if err != nil {
		return nil, err
	}

	queryBySource := `
		SELECT
			venue,
			COALESCE(SUM(sale_price_gram), 0),
			COALESCE(COUNT(*), 0)
		FROM gift_sales
		WHERE (model_id = $1 OR model_id = $2 OR $1 = '')
		  AND sale_date >= $3
		GROUP BY venue
		ORDER BY SUM(sale_price_gram) DESC`

	rows, err := r.db.Pool.Query(ctx, queryBySource, modelID, altModel, since)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var b MarketSalesSourceBreakdownRecord
			if err := rows.Scan(&b.VenueName, &b.VolumeGRAM, &b.DealsCount); err == nil {
				rec.BySource = append(rec.BySource, b)
			}
		}
	}

	return &rec, nil
}

// InsertVenueSnapshotHistory logs an immutable snapshot to build truthful historical charts
func (r *GiftsRepo) InsertVenueSnapshotHistory(ctx context.Context, s VenueSnapshotRecord) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	query := `
		INSERT INTO venue_snapshot_history (
			model_id, venue, floor_price_raw, floor_price_gram, currency,
			volume_24h_gram, volume_7d_gram, active_listings, captured_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`

	_, err := r.db.Pool.Exec(ctx, query,
		s.ModelID, s.Venue, s.FloorPriceRaw, s.FloorPriceGRAM, s.Currency,
		s.Volume24hGRAM, s.Volume7dGRAM, s.ActiveListings,
	)
	return err
}

// GetFloorHistoryFromSnapshots retrieves daily floor snapshots from verified records
func (r *GiftsRepo) GetFloorHistoryFromSnapshots(ctx context.Context, modelID string, days int) ([]FloorHistoryPointRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return []FloorHistoryPointRecord{}, nil
	}
	if days <= 0 {
		days = 30
	}

	altModel := strings.ReplaceAll(modelID, "_", "-")
	if altModel == modelID {
		altModel = strings.ReplaceAll(modelID, "-", "_")
	}

	query := `
		SELECT
			DATE_TRUNC('day', captured_at) AS day_bucket,
			venue,
			MIN(floor_price_gram) AS day_floor
		FROM venue_snapshot_history
		WHERE (model_id = $1 OR model_id = $2 OR $1 = '')
		  AND captured_at >= now() - ($3 || ' days')::interval
		GROUP BY day_bucket, venue
		ORDER BY day_bucket ASC`

	rows, err := r.db.Pool.Query(ctx, query, modelID, altModel, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	dayMap := make(map[string]*FloorHistoryPointRecord)
	var orderedDays []string

	for rows.Next() {
		var dayBucket time.Time
		var venue string
		var dayFloor decimal.Decimal
		if err := rows.Scan(&dayBucket, &venue, &dayFloor); err == nil {
			dayKey := dayBucket.Format("2006-01-02")
			if _, exists := dayMap[dayKey]; !exists {
				dayMap[dayKey] = &FloorHistoryPointRecord{
					Timestamp:      dayBucket,
					FloorGRAM:      dayFloor,
					VenueBreakdown: make(map[string]decimal.Decimal),
				}
				orderedDays = append(orderedDays, dayKey)
			}
			dayMap[dayKey].VenueBreakdown[venue] = dayFloor
			if dayFloor.LessThan(dayMap[dayKey].FloorGRAM) || dayMap[dayKey].FloorGRAM.IsZero() {
				dayMap[dayKey].FloorGRAM = dayFloor
			}
		}
	}

	var results []FloorHistoryPointRecord
	for _, k := range orderedDays {
		results = append(results, *dayMap[k])
	}
	return results, nil
}

// UpsertMarketListing inserts or updates an active marketplace listing
func (r *GiftsRepo) UpsertMarketListing(ctx context.Context, l MarketListingRecord) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	query := `
		INSERT INTO market_listings (
			model_id, serial_number, venue, listing_id, price_gram, price_usd,
			model_name, backdrop_name, symbol_name, center_hex, edge_hex, buy_url, is_active, observed_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
		ON CONFLICT (venue, listing_id) DO UPDATE SET
			price_gram = EXCLUDED.price_gram,
			price_usd = EXCLUDED.price_usd,
			is_active = EXCLUDED.is_active,
			observed_at = now()`

	_, err := r.db.Pool.Exec(ctx, query,
		l.ModelID, l.SerialNumber, l.Venue, l.ListingID, l.PriceGRAM, l.PriceUSD,
		l.ModelName, l.BackdropName, l.SymbolName, l.CenterHex, l.EdgeHex, l.BuyURL, l.IsActive,
	)
	return err
}

// GetActiveMarketListings returns verified lowest active listings for a model
func (r *GiftsRepo) GetActiveMarketListings(ctx context.Context, modelID string, limit int) ([]MarketListingRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return []MarketListingRecord{}, nil
	}
	if limit <= 0 {
		limit = 10
	}

	altModel := strings.ReplaceAll(modelID, "_", "-")
	if altModel == modelID {
		altModel = strings.ReplaceAll(modelID, "-", "_")
	}

	query := `
		SELECT
			id, model_id, serial_number, venue, listing_id, price_gram, COALESCE(price_usd, 0),
			COALESCE(model_name, ''), COALESCE(backdrop_name, ''), COALESCE(symbol_name, ''),
			COALESCE(center_hex, ''), COALESCE(edge_hex, ''), COALESCE(buy_url, ''), is_active, observed_at
		FROM market_listings
		WHERE (model_id = $1 OR model_id = $2 OR $1 = '')
		  AND is_active = TRUE
		  AND observed_at >= now() - interval '6 hours'
		ORDER BY price_gram ASC
		LIMIT $3`

	rows, err := r.db.Pool.Query(ctx, query, modelID, altModel, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []MarketListingRecord
	for rows.Next() {
		var it MarketListingRecord
		if err := rows.Scan(
			&it.ID, &it.ModelID, &it.SerialNumber, &it.Venue, &it.ListingID,
			&it.PriceGRAM, &it.PriceUSD, &it.ModelName, &it.BackdropName, &it.SymbolName,
			&it.CenterHex, &it.EdgeHex, &it.BuyURL, &it.IsActive, &it.ObservedAt,
		); err == nil {
			list = append(list, it)
		}
	}
	return list, nil
}

// UpdateSourceHealth updates health status and response metrics for a data source
func (r *GiftsRepo) UpdateSourceHealth(ctx context.Context, source, status string, success bool, respTimeMs int, errMsg string) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	query := `
		INSERT INTO source_health (
			source_name, status, last_success_at, last_failure_at, consecutive_failures, response_time_ms, error_message, updated_at
		) VALUES (
			$1, $2,
			CASE WHEN $3 THEN now() ELSE NULL END,
			CASE WHEN NOT $3 THEN now() ELSE NULL END,
			CASE WHEN $3 THEN 0 ELSE 1 END,
			$4, $5, now()
		)
		ON CONFLICT (source_name) DO UPDATE SET
			status = EXCLUDED.status,
			last_success_at = CASE WHEN $3 THEN now() ELSE source_health.last_success_at END,
			last_failure_at = CASE WHEN NOT $3 THEN now() ELSE source_health.last_failure_at END,
			consecutive_failures = CASE WHEN $3 THEN 0 ELSE source_health.consecutive_failures + 1 END,
			response_time_ms = EXCLUDED.response_time_ms,
			error_message = EXCLUDED.error_message,
			updated_at = now()`

	_, err := r.db.Pool.Exec(ctx, query, source, status, success, respTimeMs, errMsg)
	return err
}

// GiftCollectionRecord represents an official Telegram gift collection in PostgreSQL
type GiftCollectionRecord struct {
	ModelID        string     `json:"model_id"`
	Name           string     `json:"name"`
	TotalSupply    int        `json:"total_supply"`
	CraftedFlag    bool       `json:"crafted_flag"`
	ReleaseDate    *time.Time `json:"release_date,omitempty"`
	BaseStarsPrice int        `json:"base_stars_price"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// GiftTraitRecord represents an official trait (model, backdrop, symbol) in PostgreSQL
type GiftTraitRecord struct {
	ID                  int64     `json:"id"`
	ModelID             string    `json:"model_id"`
	TraitType           string    `json:"trait_type"` // 'model', 'backdrop', 'symbol'
	TraitName           string    `json:"trait_name"`
	Permille            int       `json:"permille"`
	BackdropCenter      string    `json:"backdrop_center,omitempty"`
	BackdropEdge        string    `json:"backdrop_edge,omitempty"`
	BackdropPattern     string    `json:"backdrop_pattern,omitempty"`
	BackdropText        string    `json:"backdrop_text,omitempty"`
	CraftChancePermille int       `json:"craft_chance_permille"`
	CreatedAt           time.Time `json:"created_at"`
}

// UpsertGiftCollection persists or updates a collection in the database
func (r *GiftsRepo) UpsertGiftCollection(ctx context.Context, c GiftCollectionRecord) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database connection unavailable")
	}

	query := `
		INSERT INTO gift_collections (
			model_id, name, total_supply, crafted_flag, release_date, base_stars_price, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, now())
		ON CONFLICT (model_id) DO UPDATE SET
			name = EXCLUDED.name,
			total_supply = EXCLUDED.total_supply,
			crafted_flag = EXCLUDED.crafted_flag,
			release_date = COALESCE(EXCLUDED.release_date, gift_collections.release_date),
			base_stars_price = EXCLUDED.base_stars_price,
			updated_at = now()`

	_, err := r.db.Pool.Exec(ctx, query,
		c.ModelID, c.Name, c.TotalSupply, c.CraftedFlag, c.ReleaseDate, c.BaseStarsPrice,
	)
	return err
}

// GetGiftCollection fetches a single collection by model_id or slug
func (r *GiftsRepo) GetGiftCollection(ctx context.Context, modelID string) (*GiftCollectionRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database connection unavailable")
	}

	altID := strings.ReplaceAll(modelID, "-", "_")
	if altID == modelID {
		altID = strings.ReplaceAll(modelID, "_", "-")
	}

	query := `
		SELECT model_id, name, total_supply, crafted_flag, release_date, base_stars_price, created_at, updated_at
		FROM gift_collections
		WHERE model_id = $1 OR model_id = $2
		LIMIT 1`

	var c GiftCollectionRecord
	err := r.db.Pool.QueryRow(ctx, query, modelID, altID).Scan(
		&c.ModelID, &c.Name, &c.TotalSupply, &c.CraftedFlag, &c.ReleaseDate, &c.BaseStarsPrice,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// GetAllGiftCollections returns all known official gift collections
func (r *GiftsRepo) GetAllGiftCollections(ctx context.Context) ([]GiftCollectionRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return []GiftCollectionRecord{}, nil
	}

	query := `
		SELECT model_id, name, total_supply, crafted_flag, release_date, base_stars_price, created_at, updated_at
		FROM gift_collections
		ORDER BY total_supply ASC, name ASC`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []GiftCollectionRecord
	for rows.Next() {
		var c GiftCollectionRecord
		if err := rows.Scan(
			&c.ModelID, &c.Name, &c.TotalSupply, &c.CraftedFlag, &c.ReleaseDate, &c.BaseStarsPrice,
			&c.CreatedAt, &c.UpdatedAt,
		); err == nil {
			list = append(list, c)
		}
	}
	return list, nil
}

// GetGiftCollectionsCount returns the count of collections in the database
func (r *GiftsRepo) GetGiftCollectionsCount(ctx context.Context) (int, error) {
	if r.db == nil || r.db.Pool == nil {
		return 0, nil
	}

	var count int
	err := r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM gift_collections`).Scan(&count)
	return count, err
}

// UpsertGiftTrait persists a model, backdrop, or symbol trait for a collection
func (r *GiftsRepo) UpsertGiftTrait(ctx context.Context, t GiftTraitRecord) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database connection unavailable")
	}

	query := `
		INSERT INTO gift_traits (
			model_id, trait_type, trait_name, permille, backdrop_center, backdrop_edge,
			backdrop_pattern, backdrop_text, craft_chance_permille
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (model_id, trait_type, trait_name) DO UPDATE SET
			permille = EXCLUDED.permille,
			backdrop_center = EXCLUDED.backdrop_center,
			backdrop_edge = EXCLUDED.backdrop_edge,
			backdrop_pattern = EXCLUDED.backdrop_pattern,
			backdrop_text = EXCLUDED.backdrop_text,
			craft_chance_permille = EXCLUDED.craft_chance_permille`

	_, err := r.db.Pool.Exec(ctx, query,
		t.ModelID, t.TraitType, t.TraitName, t.Permille,
		t.BackdropCenter, t.BackdropEdge, t.BackdropPattern, t.BackdropText,
		t.CraftChancePermille,
	)
	return err
}

// GetGiftTraitsByModel returns all traits belonging to a given gift model
func (r *GiftsRepo) GetGiftTraitsByModel(ctx context.Context, modelID string) ([]GiftTraitRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return []GiftTraitRecord{}, nil
	}

	altID := strings.ReplaceAll(modelID, "-", "_")
	if altID == modelID {
		altID = strings.ReplaceAll(modelID, "_", "-")
	}

	query := `
		SELECT id, model_id, trait_type, trait_name, permille,
		       COALESCE(backdrop_center, ''), COALESCE(backdrop_edge, ''),
		       COALESCE(backdrop_pattern, ''), COALESCE(backdrop_text, ''),
		       craft_chance_permille, created_at
		FROM gift_traits
		WHERE model_id = $1 OR model_id = $2
		ORDER BY trait_type ASC, permille ASC`

	rows, err := r.db.Pool.Query(ctx, query, modelID, altID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []GiftTraitRecord
	for rows.Next() {
		var tr GiftTraitRecord
		if err := rows.Scan(
			&tr.ID, &tr.ModelID, &tr.TraitType, &tr.TraitName, &tr.Permille,
			&tr.BackdropCenter, &tr.BackdropEdge, &tr.BackdropPattern, &tr.BackdropText,
			&tr.CraftChancePermille, &tr.CreatedAt,
		); err == nil {
			list = append(list, tr)
		}
	}
	return list, nil
}

type ArbitrageOpportunityRecord struct {
	ID              int64           `json:"id"`
	ModelID         string          `json:"model_id"`
	SourceVenue     string          `json:"source_venue"`
	TargetVenue     string          `json:"target_venue"`
	SourceFloorGRAM decimal.Decimal `json:"source_floor_gram"`
	TargetFloorGRAM decimal.Decimal `json:"target_floor_gram"`
	GrossSpreadGRAM decimal.Decimal `json:"gross_spread_gram"`
	NetProfitGRAM   decimal.Decimal `json:"net_profit_gram"`
	NetROIPct       decimal.Decimal `json:"net_roi_pct"`
	SourceURL       string          `json:"source_url"`
	TargetURL       string          `json:"target_url"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

func (r *GiftsRepo) UpsertArbitrageOpportunity(ctx context.Context, opp ArbitrageOpportunityRecord) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database connection unavailable")
	}

	query := `
		INSERT INTO gift_arbitrage_opportunities (
			model_id, source_venue, target_venue, source_floor_gram, target_floor_gram,
			gross_spread_gram, net_profit_gram, net_roi_pct, source_url, target_url, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
		ON CONFLICT (model_id, source_venue, target_venue) DO UPDATE SET
			source_floor_gram = EXCLUDED.source_floor_gram,
			target_floor_gram = EXCLUDED.target_floor_gram,
			gross_spread_gram = EXCLUDED.gross_spread_gram,
			net_profit_gram = EXCLUDED.net_profit_gram,
			net_roi_pct = EXCLUDED.net_roi_pct,
			source_url = EXCLUDED.source_url,
			target_url = EXCLUDED.target_url,
			updated_at = now()`

	_, err := r.db.Pool.Exec(ctx, query,
		opp.ModelID, opp.SourceVenue, opp.TargetVenue,
		opp.SourceFloorGRAM, opp.TargetFloorGRAM, opp.GrossSpreadGRAM,
		opp.NetProfitGRAM, opp.NetROIPct, opp.SourceURL, opp.TargetURL,
	)
	return err
}

func (r *GiftsRepo) GetArbitrageOpportunities(ctx context.Context, limit int) ([]ArbitrageOpportunityRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return []ArbitrageOpportunityRecord{}, nil
	}
	if limit <= 0 {
		limit = 50
	}

	query := `
		SELECT id, model_id, source_venue, target_venue, source_floor_gram, target_floor_gram,
		       gross_spread_gram, net_profit_gram, net_roi_pct, COALESCE(source_url, ''),
		       COALESCE(target_url, ''), updated_at
		FROM gift_arbitrage_opportunities
		WHERE net_profit_gram > 0
		ORDER BY net_profit_gram DESC, net_roi_pct DESC
		LIMIT $1`

	rows, err := r.db.Pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ArbitrageOpportunityRecord
	for rows.Next() {
		var o ArbitrageOpportunityRecord
		if err := rows.Scan(
			&o.ID, &o.ModelID, &o.SourceVenue, &o.TargetVenue,
			&o.SourceFloorGRAM, &o.TargetFloorGRAM, &o.GrossSpreadGRAM,
			&o.NetProfitGRAM, &o.NetROIPct, &o.SourceURL, &o.TargetURL,
			&o.UpdatedAt,
		); err == nil {
			list = append(list, o)
		}
	}
	return list, nil
}

type WhaleWalletRecord struct {
	ID                 int64           `json:"id"`
	WalletAddress      string          `json:"wallet_address"`
	Label              string          `json:"label"`
	GiftsCount         int             `json:"gifts_count"`
	UniqueCollections  int             `json:"unique_collections"`
	TotalEstValueGRAM  decimal.Decimal `json:"total_est_value_gram"`
	TopAssetName       string          `json:"top_asset_name"`
	LastActiveAt       time.Time       `json:"last_active_at"`
}

func (r *GiftsRepo) UpsertWhaleWallet(ctx context.Context, w WhaleWalletRecord) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database connection unavailable")
	}

	query := `
		INSERT INTO gift_whale_wallets (
			wallet_address, label, gifts_count, unique_collections,
			total_est_value_gram, top_asset_name, last_active_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (wallet_address) DO UPDATE SET
			label = EXCLUDED.label,
			gifts_count = EXCLUDED.gifts_count,
			unique_collections = EXCLUDED.unique_collections,
			total_est_value_gram = EXCLUDED.total_est_value_gram,
			top_asset_name = EXCLUDED.top_asset_name,
			last_active_at = EXCLUDED.last_active_at`

	_, err := r.db.Pool.Exec(ctx, query,
		w.WalletAddress, w.Label, w.GiftsCount, w.UniqueCollections,
		w.TotalEstValueGRAM, w.TopAssetName, w.LastActiveAt,
	)
	return err
}

func (r *GiftsRepo) GetWhaleWallets(ctx context.Context, limit int) ([]WhaleWalletRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return []WhaleWalletRecord{}, nil
	}
	if limit <= 0 {
		limit = 25
	}

	query := `
		SELECT id, wallet_address, label, gifts_count, unique_collections,
		       total_est_value_gram, COALESCE(top_asset_name, ''), last_active_at
		FROM gift_whale_wallets
		ORDER BY total_est_value_gram DESC, gifts_count DESC
		LIMIT $1`

	rows, err := r.db.Pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []WhaleWalletRecord
	for rows.Next() {
		var w WhaleWalletRecord
		if err := rows.Scan(
			&w.ID, &w.WalletAddress, &w.Label, &w.GiftsCount, &w.UniqueCollections,
			&w.TotalEstValueGRAM, &w.TopAssetName, &w.LastActiveAt,
		); err == nil {
			list = append(list, w)
		}
	}
	return list, nil
}

type ExtendedGiftCollectionRecord struct {
	ModelID            string          `json:"model_id"`
	Name               string          `json:"name"`
	Slug               string          `json:"slug"`
	TotalSupply        int             `json:"total_supply"`
	CraftedFlag        bool            `json:"crafted_flag"`
	UpgradedCount      int             `json:"upgraded_count"`
	AvailabilityRemain int             `json:"availability_remains"`
	IsAuction          bool            `json:"is_auction"`
	IsLimited          bool            `json:"is_limited"`
	UniqueHoldersCount int             `json:"unique_holders_count"`
	ATHPriceGRAM       decimal.Decimal `json:"ath_price_gram"`
	ATHDate            *time.Time      `json:"ath_date"`
	ATLPriceGRAM       decimal.Decimal `json:"atl_price_gram"`
	ATLDate            *time.Time      `json:"atl_date"`
	Volume24hGRAM      decimal.Decimal `json:"volume_24h_gram"`
	Volume7dGRAM       decimal.Decimal `json:"volume_7d_gram"`
	Volume30dGRAM      decimal.Decimal `json:"volume_30d_gram"`
	TurnoverRate24h    decimal.Decimal `json:"turnover_rate_24h"`
	PriceChange24hPct  decimal.Decimal `json:"price_change_24h_pct"`
	PriceChange7dPct   decimal.Decimal `json:"price_change_7d_pct"`
	MarketCapUSD       decimal.Decimal `json:"market_cap_usd"`
	BaseStarsPrice     int             `json:"base_stars_price"`
	ReleaseDate        *time.Time      `json:"release_date"`
	UpdatedAt          time.Time       `json:"updated_at"`
}

func (r *GiftsRepo) UpsertGiftCollectionExtended(ctx context.Context, c ExtendedGiftCollectionRecord) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database connection unavailable")
	}

	query := `
		INSERT INTO gift_collections (
			model_id, name, slug, total_supply, crafted_flag, upgraded_count, availability_remains,
			is_auction, is_limited, unique_holders_count, ath_price_gram, ath_date, atl_price_gram, atl_date,
			volume_24h_gram, volume_7d_gram, volume_30d_gram, turnover_rate_24h,
			price_change_24h_pct, price_change_7d_pct, market_cap_usd, base_stars_price, release_date, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7,
			$8, $9, $10, $11, $12, $13, $14,
			$15, $16, $17, $18,
			$19, $20, $21, $22, $23, now()
		)
		ON CONFLICT (model_id) DO UPDATE SET
			name = EXCLUDED.name,
			slug = EXCLUDED.slug,
			total_supply = EXCLUDED.total_supply,
			crafted_flag = EXCLUDED.crafted_flag,
			upgraded_count = EXCLUDED.upgraded_count,
			availability_remains = EXCLUDED.availability_remains,
			is_auction = EXCLUDED.is_auction,
			is_limited = EXCLUDED.is_limited,
			unique_holders_count = EXCLUDED.unique_holders_count,
			ath_price_gram = EXCLUDED.ath_price_gram,
			ath_date = COALESCE(EXCLUDED.ath_date, gift_collections.ath_date),
			atl_price_gram = EXCLUDED.atl_price_gram,
			atl_date = COALESCE(EXCLUDED.atl_date, gift_collections.atl_date),
			volume_24h_gram = EXCLUDED.volume_24h_gram,
			volume_7d_gram = EXCLUDED.volume_7d_gram,
			volume_30d_gram = EXCLUDED.volume_30d_gram,
			turnover_rate_24h = EXCLUDED.turnover_rate_24h,
			price_change_24h_pct = EXCLUDED.price_change_24h_pct,
			price_change_7d_pct = EXCLUDED.price_change_7d_pct,
			market_cap_usd = EXCLUDED.market_cap_usd,
			base_stars_price = EXCLUDED.base_stars_price,
			release_date = COALESCE(EXCLUDED.release_date, gift_collections.release_date),
			updated_at = now()`

	_, err := r.db.Pool.Exec(ctx, query,
		c.ModelID, c.Name, c.Slug, c.TotalSupply, c.CraftedFlag, c.UpgradedCount, c.AvailabilityRemain,
		c.IsAuction, c.IsLimited, c.UniqueHoldersCount, c.ATHPriceGRAM, c.ATHDate, c.ATLPriceGRAM, c.ATLDate,
		c.Volume24hGRAM, c.Volume7dGRAM, c.Volume30dGRAM, c.TurnoverRate24h,
		c.PriceChange24hPct, c.PriceChange7dPct, c.MarketCapUSD, c.BaseStarsPrice, c.ReleaseDate,
	)
	return err
}

func (r *GiftsRepo) GetAllCollectionsExtended(ctx context.Context) ([]ExtendedGiftCollectionRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return []ExtendedGiftCollectionRecord{}, nil
	}

	query := `
		SELECT model_id, name, COALESCE(slug, ''), total_supply, crafted_flag,
		       upgraded_count, availability_remains, is_auction, is_limited,
		       unique_holders_count, ath_price_gram, ath_date, atl_price_gram, atl_date,
		       volume_24h_gram, volume_7d_gram, volume_30d_gram, turnover_rate_24h,
		       price_change_24h_pct, price_change_7d_pct, market_cap_usd, base_stars_price,
		       release_date, updated_at
		FROM gift_collections
		ORDER BY volume_24h_gram DESC, total_supply ASC`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ExtendedGiftCollectionRecord
	for rows.Next() {
		var c ExtendedGiftCollectionRecord
		if err := rows.Scan(
			&c.ModelID, &c.Name, &c.Slug, &c.TotalSupply, &c.CraftedFlag,
			&c.UpgradedCount, &c.AvailabilityRemain, &c.IsAuction, &c.IsLimited,
			&c.UniqueHoldersCount, &c.ATHPriceGRAM, &c.ATHDate, &c.ATLPriceGRAM, &c.ATLDate,
			&c.Volume24hGRAM, &c.Volume7dGRAM, &c.Volume30dGRAM, &c.TurnoverRate24h,
			&c.PriceChange24hPct, &c.PriceChange7dPct, &c.MarketCapUSD, &c.BaseStarsPrice,
			&c.ReleaseDate, &c.UpdatedAt,
		); err == nil {
			list = append(list, c)
		}
	}
	return list, nil
}


