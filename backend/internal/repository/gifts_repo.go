package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
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
	BuyerAddress    string          `json:"buyer_address"`
	SellerAddress   string          `json:"seller_address"`
	TxHash          string          `json:"tx_hash"`
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
		RETURNING report_id`

	var reportID uuid.UUID
	err := r.db.Pool.QueryRow(ctx, query, userID, giftID, modelID, serialNumber, fairNano, confidence, snapshot).Scan(&reportID)
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
		WHERE model_id = $1 OR $1 = ''
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
			price_confidence, sale_date, buyer_address, seller_address, tx_hash
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id`

	var id int64
	err := r.db.Pool.QueryRow(ctx, query,
		s.GiftID, s.ModelID, s.SerialNumber, s.Venue, s.Currency,
		s.SalePriceRaw, s.SalePriceGRAM, s.SalePriceUSD, s.VenueFeePct,
		s.PriceConfidence, s.SaleDate, s.BuyerAddress, s.SellerAddress, s.TxHash,
	).Scan(&id)

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
		       price_confidence, sale_date, buyer_address, seller_address, tx_hash
		FROM gift_sales
		WHERE model_id = $1
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
		       price_confidence, sale_date, buyer_address, seller_address, tx_hash
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
