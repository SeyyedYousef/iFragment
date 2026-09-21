package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type NumbersRepo struct {
	db *Database
}

func NewNumbersRepo(db *Database) *NumbersRepo {
	return &NumbersRepo{db: db}
}

type NumberFeatureRecord struct {
	Number       string          `json:"number"`
	Color        string          `json:"color"`
	OwnerAddress string          `json:"owner_address"`
	NFTAddress   string          `json:"nft_address"`
	Features     json.RawMessage `json:"features"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

type NumberReportRecord struct {
	ReportID       uuid.UUID       `json:"report_id"`
	UserID         int64           `json:"user_id"`
	Number         string          `json:"number"`
	FairValueNano  int64           `json:"fair_value_nano_ton"`
	Confidence     int             `json:"confidence_score"`
	ReportSnapshot json.RawMessage `json:"report_snapshot"`
	PurchasedAt    time.Time       `json:"purchased_at"`
}

type NumberWatchlistItem struct {
	ID          int64     `json:"id"`
	UserID      int64     `json:"user_id"`
	Number      string    `json:"number"`
	AlertOnSale bool      `json:"alert_on_sale"`
	AlertOnBid  bool      `json:"alert_on_bid"`
	CreatedAt   time.Time `json:"created_at"`
}

type MaskSearchResultItem struct {
	Number       string   `json:"number"`
	Display      string   `json:"display_number"`
	Status       string   `json:"status"` // "for_sale", "on_auction", "taken"
	ListingPrice *float64 `json:"listing_price_ton,omitempty"`
	Color        string   `json:"color"`
	RarityScore  int      `json:"rarity_score"`
}

// GetNumberFeatures returns stored feature profile
func (r *NumbersRepo) GetNumberFeatures(ctx context.Context, number string) (*NumberFeatureRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, nil
	}
	query := `
		SELECT number, color, owner_address, nft_address, features, updated_at
		FROM number_features
		WHERE number = $1`

	var rec NumberFeatureRecord
	var featJSON []byte
	err := r.db.Pool.QueryRow(ctx, query, number).Scan(
		&rec.Number, &rec.Color, &rec.OwnerAddress, &rec.NFTAddress, &featJSON, &rec.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	rec.Features = featJSON
	return &rec, nil
}

// SaveNumberReport persists purchased report for 24h caching and history
func (r *NumbersRepo) SaveNumberReport(ctx context.Context, userID int64, number string, fairValueNano int64, confidence int, snapshot json.RawMessage) (uuid.UUID, error) {
	if r.db == nil || r.db.Pool == nil {
		return uuid.New(), nil
	}
	query := `
		INSERT INTO number_reports (user_id, number, fair_value_nano_ton, confidence_score, report_snapshot, purchased_at)
		VALUES ($1, $2, $3, $4, $5, now())
		RETURNING report_id`

	var reportID uuid.UUID
	err := r.db.Pool.QueryRow(ctx, query, userID, number, fairValueNano, confidence, snapshot).Scan(&reportID)
	return reportID, err
}

// SaveNumberReportTx persists purchased report within an existing database transaction
func (r *NumbersRepo) SaveNumberReportTx(ctx context.Context, tx pgx.Tx, userID int64, number string, fairValueNano int64, confidence int, snapshot json.RawMessage) (uuid.UUID, error) {
	query := `
		INSERT INTO number_reports (user_id, number, fair_value_nano_ton, confidence_score, report_snapshot, purchased_at)
		VALUES ($1, $2, $3, $4, $5, now())
		RETURNING report_id`

	var reportID uuid.UUID
	err := tx.QueryRow(ctx, query, userID, number, fairValueNano, confidence, snapshot).Scan(&reportID)
	return reportID, err
}

// GetPurchasedNumberReport retrieves a previously bought report strictly within 24h cache window
func (r *NumbersRepo) GetPurchasedNumberReport(ctx context.Context, userID int64, number string) (*NumberReportRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, nil
	}
	query := `
		SELECT report_id, user_id, number, fair_value_nano_ton, confidence_score, report_snapshot, purchased_at
		FROM number_reports
		WHERE user_id = $1 AND number = $2 AND purchased_at >= now() - interval '24 hours'
		ORDER BY purchased_at DESC
		LIMIT 1`

	var rec NumberReportRecord
	var snapshotJSON []byte
	err := r.db.Pool.QueryRow(ctx, query, userID, number).Scan(
		&rec.ReportID, &rec.UserID, &rec.Number, &rec.FairValueNano, &rec.Confidence, &snapshotJSON, &rec.PurchasedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	rec.ReportSnapshot = snapshotJSON
	return &rec, nil
}

// IsNumberReportPurchased checks if user has unlocked this number within the past 24 hours
func (r *NumbersRepo) IsNumberReportPurchased(ctx context.Context, userID int64, number string) (bool, error) {
	if r.db == nil || r.db.Pool == nil {
		return false, nil
	}
	query := `SELECT EXISTS(SELECT 1 FROM number_reports WHERE user_id = $1 AND number = $2 AND purchased_at >= now() - interval '24 hours')`
	var exists bool
	err := r.db.Pool.QueryRow(ctx, query, userID, number).Scan(&exists)
	return exists, err
}

// IsNumberReportPurchasedTx checks within a transaction if user unlocked this number within 24h
func (r *NumbersRepo) IsNumberReportPurchasedTx(ctx context.Context, tx pgx.Tx, userID int64, number string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM number_reports WHERE user_id = $1 AND number = $2 AND purchased_at >= now() - interval '24 hours')`
	var exists bool
	err := tx.QueryRow(ctx, query, userID, number).Scan(&exists)
	return exists, err
}

// AddToWatchlist enables notifications (only allowed post-purchase - Sacred Rule 4)
func (r *NumbersRepo) AddToWatchlist(ctx context.Context, userID int64, number string) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}
	query := `
		INSERT INTO number_watchlist (user_id, number, alert_on_sale, alert_on_bid, created_at)
		VALUES ($1, $2, TRUE, TRUE, now())
		ON CONFLICT (user_id, number) DO UPDATE
		SET alert_on_sale = TRUE, alert_on_bid = TRUE`
	_, err := r.db.Pool.Exec(ctx, query, userID, number)
	return err
}

// RemoveFromWatchlist removes number from watchlist
func (r *NumbersRepo) RemoveFromWatchlist(ctx context.Context, userID int64, number string) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}
	query := `DELETE FROM number_watchlist WHERE user_id = $1 AND number = $2`
	_, err := r.db.Pool.Exec(ctx, query, userID, number)
	return err
}

// GetWatchlist returns list of watched numbers for a user
func (r *NumbersRepo) GetWatchlist(ctx context.Context, userID int64) ([]NumberWatchlistItem, error) {
	if r.db == nil || r.db.Pool == nil {
		return []NumberWatchlistItem{}, nil
	}
	query := `
		SELECT id, user_id, number, alert_on_sale, alert_on_bid, created_at
		FROM number_watchlist
		WHERE user_id = $1
		ORDER BY created_at DESC`

	rows, err := r.db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []NumberWatchlistItem
	for rows.Next() {
		var it NumberWatchlistItem
		if err := rows.Scan(&it.ID, &it.UserID, &it.Number, &it.AlertOnSale, &it.AlertOnBid, &it.CreatedAt); err == nil {
			items = append(items, it)
		}
	}
	return items, nil
}

type NumberSaleRecord struct {
	ID              int64     `json:"id"`
	Number          string    `json:"number"`
	SalePriceTON    float64   `json:"sale_price_ton"`
	SaleType        string    `json:"sale_type"`
	SaleDate        time.Time `json:"sale_date"`
	BuyerAddress    string    `json:"buyer_address"`
	SellerAddress   string    `json:"seller_address"`
	MarketAddress   string    `json:"market_address"`
	PriceConfidence string    `json:"price_confidence"`
	TransactionHash string    `json:"transaction_hash"`
	RawData         []byte    `json:"raw_data,omitempty"`
	IndexedAt       time.Time `json:"indexed_at"`
}

// InsertNumberSale inserts a verified on-chain sale for a number with conflict idempotency
func (r *NumbersRepo) InsertNumberSale(ctx context.Context, sale NumberSaleRecord) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}
	query := `
		INSERT INTO number_sales (
			number, sale_price_ton, sale_type, sale_date,
			buyer_address, seller_address, market_address,
			price_confidence, transaction_hash, raw_data, indexed_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
		ON CONFLICT DO NOTHING`

	_, err := r.db.Pool.Exec(ctx, query,
		sale.Number, sale.SalePriceTON, sale.SaleType, sale.SaleDate,
		sale.BuyerAddress, sale.SellerAddress, sale.MarketAddress,
		sale.PriceConfidence, sale.TransactionHash, sale.RawData,
	)
	return err
}

// GetHistoricalSalesForNumber retrieves real on-chain sales for a specific number
func (r *NumbersRepo) GetHistoricalSalesForNumber(ctx context.Context, number string) ([]NumberSaleRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return []NumberSaleRecord{}, nil
	}
	query := `
		SELECT id, number, sale_price_ton, sale_type, sale_date,
		       COALESCE(buyer_address, ''), COALESCE(seller_address, ''), COALESCE(market_address, ''),
		       price_confidence, COALESCE(transaction_hash, ''), indexed_at
		FROM number_sales
		WHERE number = $1 AND COALESCE(is_reorged, FALSE) = FALSE
		ORDER BY sale_date DESC
		LIMIT 20`

	rows, err := r.db.Pool.Query(ctx, query, number)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sales := make([]NumberSaleRecord, 0)
	for rows.Next() {
		var s NumberSaleRecord
		if err := rows.Scan(
			&s.ID, &s.Number, &s.SalePriceTON, &s.SaleType, &s.SaleDate,
			&s.BuyerAddress, &s.SellerAddress, &s.MarketAddress,
			&s.PriceConfidence, &s.TransactionHash, &s.IndexedAt,
		); err == nil {
			sales = append(sales, s)
		}
	}
	return sales, nil
}

// GetCompsForNumber retrieves real peer sales in similar class (same tail or pattern or recent)
func (r *NumbersRepo) GetCompsForNumber(ctx context.Context, targetNumber, tailClass string, maxRun int, limit int) ([]NumberSaleRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return []NumberSaleRecord{}, nil
	}
	if limit <= 0 {
		limit = 5
	}

	// 1. Try to find sales with same tail class or feature pattern within the same length cohort
	query := `
		SELECT s.id, s.number, s.sale_price_ton, s.sale_type, s.sale_date,
		       COALESCE(s.buyer_address, ''), COALESCE(s.seller_address, ''), COALESCE(s.market_address, ''),
		       s.price_confidence, COALESCE(s.transaction_hash, ''), s.indexed_at
		FROM number_sales s
		LEFT JOIN number_features f ON s.number = f.number
		WHERE s.number != $1
		  AND LENGTH(s.number) = LENGTH($1)
		  AND s.price_confidence IN ('exact', 'verified')
		  AND (
		      (f.features->>'tail_class' = $2 AND $2 != '')
		      OR COALESCE(NULLIF(f.features->>'max_run', '')::int, 0) >= $3
		  )
		ORDER BY s.sale_date DESC
		LIMIT $4`

	rows, err := r.db.Pool.Query(ctx, query, targetNumber, tailClass, maxRun, limit)
	if err == nil {
		defer rows.Close()
		sales := make([]NumberSaleRecord, 0)
		for rows.Next() {
			var s NumberSaleRecord
			if err := rows.Scan(
				&s.ID, &s.Number, &s.SalePriceTON, &s.SaleType, &s.SaleDate,
				&s.BuyerAddress, &s.SellerAddress, &s.MarketAddress,
				&s.PriceConfidence, &s.TransactionHash, &s.IndexedAt,
			); err == nil {
				sales = append(sales, s)
			}
		}
		if len(sales) > 0 {
			return sales, nil
		}
	}

	// 2. Fallback to most recent verified sales within the same length cohort (AC-P0-008, N-08)
	fallbackQuery := `
		SELECT id, number, sale_price_ton, sale_type, sale_date,
		       COALESCE(buyer_address, ''), COALESCE(seller_address, ''), COALESCE(market_address, ''),
		       price_confidence, COALESCE(transaction_hash, ''), indexed_at
		FROM number_sales
		WHERE number != $1
		  AND LENGTH(number) = LENGTH($1)
		  AND price_confidence IN ('exact', 'verified')
		ORDER BY sale_date DESC
		LIMIT $2`

	rowsFallback, err := r.db.Pool.Query(ctx, fallbackQuery, targetNumber, limit)
	if err != nil {
		return []NumberSaleRecord{}, nil
	}
	defer rowsFallback.Close()

	fallbackSales := make([]NumberSaleRecord, 0)
	for rowsFallback.Next() {
		var s NumberSaleRecord
		if err := rowsFallback.Scan(
			&s.ID, &s.Number, &s.SalePriceTON, &s.SaleType, &s.SaleDate,
			&s.BuyerAddress, &s.SellerAddress, &s.MarketAddress,
			&s.PriceConfidence, &s.TransactionHash, &s.IndexedAt,
		); err == nil {
			fallbackSales = append(fallbackSales, s)
		}
	}
	return fallbackSales, nil
}

// GetFeatureHistograms loads global frequency counts for exact percentile calculations
func (r *NumbersRepo) GetFeatureHistograms(ctx context.Context) (map[string]map[string]int, error) {
	if r.db == nil || r.db.Pool == nil {
		return make(map[string]map[string]int), nil
	}
	query := `SELECT feature_key, bucket, count FROM feature_histograms`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hist := make(map[string]map[string]int)
	for rows.Next() {
		var k, b string
		var c int
		if err := rows.Scan(&k, &b, &c); err == nil {
			if hist[k] == nil {
				hist[k] = make(map[string]int)
			}
			hist[k][b] = c
		}
	}
	return hist, nil
}

// GetWatchedUsersForNumber returns all user IDs watching this number
func (r *NumbersRepo) GetWatchedUsersForNumber(ctx context.Context, number string) ([]int64, error) {
	if r.db == nil || r.db.Pool == nil {
		return []int64{}, nil
	}
	query := `SELECT user_id FROM number_watchlist WHERE number = $1 AND alert_on_sale = TRUE`
	rows, err := r.db.Pool.Query(ctx, query, number)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userIDs := make([]int64, 0)
	for rows.Next() {
		var uID int64
		if err := rows.Scan(&uID); err == nil {
			userIDs = append(userIDs, uID)
		}
	}
	return userIDs, nil
}

// GetWatchedUsersForNumberWithBidAlerts returns all user IDs watching this number for bid alerts (N-16)
func (r *NumbersRepo) GetWatchedUsersForNumberWithBidAlerts(ctx context.Context, number string) ([]int64, error) {
	if r.db == nil || r.db.Pool == nil {
		return []int64{}, nil
	}
	query := `SELECT user_id FROM number_watchlist WHERE number = $1 AND alert_on_bid = TRUE`
	rows, err := r.db.Pool.Query(ctx, query, number)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userIDs := make([]int64, 0)
	for rows.Next() {
		var uID int64
		if err := rows.Scan(&uID); err == nil {
			userIDs = append(userIDs, uID)
		}
	}
	return userIDs, nil
}

// SearchNumbersByMask searches the 136k supply with wildcard or regex matching in <150ms p95
func (r *NumbersRepo) SearchNumbersByMask(ctx context.Context, pattern string, limit, offset int) ([]MaskSearchResultItem, error) {
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 || limit > 50 {
		limit = 30
	}

	// 1. Sanitize wildcard pattern to avoid LIKE wildcard injection
	cleanPattern := strings.ReplaceAll(pattern, " ", "")
	cleanPattern = strings.TrimPrefix(cleanPattern, "+")
	cleanPattern = strings.TrimPrefix(cleanPattern, "888")

	// Escape raw % and _ to prevent wildcard injection
	cleanPattern = strings.ReplaceAll(cleanPattern, "\\", "\\\\")
	cleanPattern = strings.ReplaceAll(cleanPattern, "%", "\\%")
	cleanPattern = strings.ReplaceAll(cleanPattern, "_", "\\_")

	// Convert user wildcard '*' or '?' to SQL single-character wildcard '_'
	sqlWildcard := strings.ReplaceAll(cleanPattern, "*", "_")
	sqlWildcard = strings.ReplaceAll(sqlWildcard, "?", "_")
	if len(sqlWildcard) > 8 {
		sqlWildcard = sqlWildcard[:8]
	}
	sqlPattern := "+888" + sqlWildcard
	if !strings.Contains(cleanPattern, "*") && !strings.Contains(cleanPattern, "?") && len(cleanPattern) < 8 {
		sqlPattern = "+888" + sqlWildcard + "%"
	}

	if r.db == nil || r.db.Pool == nil {
		return []MaskSearchResultItem{}, nil
	}

	query := `
		SELECT f.number, f.color, f.features, f.owner_address,
		       COALESCE(m.market_type, CASE WHEN f.features->>'listing_price_ton' IS NOT NULL THEN 'sale' ELSE '' END) AS market_status,
		       COALESCE(NULLIF(f.features->>'listing_price_ton', '')::float8, 0) AS listing_price
		FROM number_features f
		LEFT JOIN market_registry m ON f.owner_address = m.address
		WHERE f.number LIKE $1
		ORDER BY f.number ASC
		LIMIT $2 OFFSET $3`

	rows, err := r.db.Pool.Query(ctx, query, sqlPattern, limit, offset)
	if err != nil {
		return []MaskSearchResultItem{}, nil
	}
	defer rows.Close()

	results := make([]MaskSearchResultItem, 0)
	for rows.Next() {
		var num, color, ownerAddr, marketStatus string
		var featJSON []byte
		var listingPrice float64
		if err := rows.Scan(&num, &color, &featJSON, &ownerAddr, &marketStatus, &listingPrice); err == nil {
			rarity := 50
			var fv struct {
				RarityScore      int     `json:"rarity_score"`
				RarityPercentile float64 `json:"rarity_percentile"`
			}
			if json.Unmarshal(featJSON, &fv) == nil {
				if fv.RarityScore > 0 {
					rarity = fv.RarityScore
				} else if fv.RarityPercentile > 0 {
					rarity = int(fv.RarityPercentile)
				}
			}

			status := "taken"
			if marketStatus == "auction" {
				status = "on_auction"
			} else if marketStatus == "sale" || listingPrice > 0 {
				status = "for_sale"
			}

			var pricePtr *float64
			if listingPrice > 0 {
				pricePtr = &listingPrice
			}

			results = append(results, MaskSearchResultItem{
				Number:       num,
				Display:      formatDisplay(num),
				Status:       status,
				ListingPrice: pricePtr,
				Color:        color,
				RarityScore:  rarity,
			})
		}
	}

	return results, nil
}

func formatDisplay(num string) string {
	clean := strings.ReplaceAll(strings.ReplaceAll(num, "+", ""), " ", "")
	if len(clean) >= 11 && strings.HasPrefix(clean, "888") {
		return fmt.Sprintf("+888 %s %s", clean[3:7], clean[7:])
	}
	return num
}

type NumberCollectionMetricsRecord struct {
	ID                   int       `json:"id"`
	StatDate             time.Time `json:"stat_date"`
	MintedSupply         int64     `json:"minted_supply"`
	CirculatingSupply    int64     `json:"circulating_supply"`
	UniqueHolders        int64     `json:"unique_holders"`
	FloorAskNanoTON      *int64    `json:"floor_ask_nano_ton"`
	FloorNumber          *string   `json:"floor_number"`
	FloorVenue           string    `json:"floor_venue"`
	FloorDepth5PctCount  int       `json:"floor_depth_5pct_count"`
	FloorDepth10PctCount int       `json:"floor_depth_10pct_count"`
	FloorDepth25PctCount int       `json:"floor_depth_25pct_count"`
	MedianSale7dNanoTON  *int64    `json:"median_sale_7d_nano_ton"`
	MedianSale30dNanoTON *int64    `json:"median_sale_30d_nano_ton"`
	SalesCount7d         int       `json:"sales_count_7d"`
	SalesCount30d        int       `json:"sales_count_30d"`
	Volume24hNanoTON     string    `json:"volume_24h_nano_ton"`
	Volume7dNanoTON      string    `json:"volume_7d_nano_ton"`
	SalesCount24h        int       `json:"sales_count_24h"`
	UniqueBuyers7d       int       `json:"unique_buyers_7d"`
	UniqueSellers7d      int       `json:"unique_sellers_7d"`
	ActiveListingsCount  int       `json:"active_listings_count"`
	ListedSharePct       float64   `json:"listed_share_pct"`
	Top10HolderSharePct  float64   `json:"top10_holder_share_pct"`
	Top50HolderSharePct  float64   `json:"top50_holder_share_pct"`
	MarketPulseDemand    string    `json:"market_pulse_demand"`
	MarketPulseSupply    string    `json:"market_pulse_supply"`
	MarketPulseLiquidity string    `json:"market_pulse_liquidity"`
	MarketPulseMomentum  string    `json:"market_pulse_momentum"`
	TonUsdRate           *float64  `json:"ton_usd_rate"`
	IsStale              bool      `json:"is_stale"`
	SourceStatus         string    `json:"source_status"`
	LastIndexedAt        time.Time `json:"last_indexed_at"`
	SnapshotID           string    `json:"snapshot_id"`
}

type NumberCollectionHistoryRecord struct {
	ID                int64     `json:"id"`
	Timestamp         time.Time `json:"timestamp"`
	Timeframe         string    `json:"timeframe"`
	FloorNanoTON      int64     `json:"floor_nano_ton"`
	MedianSaleNanoTON *int64    `json:"median_sale_nano_ton"`
	VolumeNanoTON     string    `json:"volume_nano_ton"`
	SalesCount        int       `json:"sales_count"`
	UniqueBuyers      int       `json:"unique_buyers"`
	UniqueSellers     int       `json:"unique_sellers"`
	OpenPriceNanoTON  *int64    `json:"open_price_nano_ton"`
	HighPriceNanoTON  *int64    `json:"high_price_nano_ton"`
	LowPriceNanoTON   *int64    `json:"low_price_nano_ton"`
	ClosePriceNanoTON *int64    `json:"close_price_nano_ton"`
	Provenance        string    `json:"provenance"`
}

type NumberMarketListingRecord struct {
	ID                     int64      `json:"id"`
	Number                 string     `json:"number"`
	DisplayNumber          string     `json:"display_number"`
	NFTItemAddress         *string    `json:"nft_item_address"`
	Venue                  string     `json:"venue"`
	ListingType            string     `json:"listing_type"`
	AskPriceNanoTON        *int64     `json:"ask_price_nano_ton"`
	CurrentBidNanoTON      *int64     `json:"current_bid_nano_ton"`
	NextMinBidNanoTON      *int64     `json:"next_min_bid_nano_ton"`
	BidsCount              int        `json:"bids_count"`
	PatternTag             *string    `json:"pattern_tag"`
	IsGenesis              bool       `json:"is_genesis"`
	EndsAt                 *time.Time `json:"ends_at"`
	IsActive               bool       `json:"is_active"`
	ObservedAt             time.Time  `json:"observed_at"`
	SourceURL              *string    `json:"source_url"`
	SellerAddress          *string    `json:"seller_address"`
	DifferenceFromFloorPct float64    `json:"difference_from_floor_pct"`
}

type NumberPatternAnalyticsRecord struct {
	ID                  int       `json:"id"`
	PatternKey          string    `json:"pattern_key"`
	PatternNameEn       string    `json:"pattern_name_en"`
	PatternNameFa       string    `json:"pattern_name_fa"`
	SampleMask          string    `json:"sample_mask"`
	ExactSupply         int       `json:"exact_supply"`
	SupplySharePct      float64   `json:"supply_share_pct"`
	ActiveListingsCount int       `json:"active_listings_count"`
	FloorNanoTON        *int64    `json:"floor_nano_ton"`
	MedianSaleNanoTON   *int64    `json:"median_sale_nano_ton"`
	P25SaleNanoTON      *int64    `json:"p25_sale_nano_ton"`
	P75SaleNanoTON      *int64    `json:"p75_sale_nano_ton"`
	PremiumPct          float64   `json:"premium_pct"`
	SampleSize          int       `json:"sample_size"`
	ConfidenceScore     int       `json:"confidence_score"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// GetLatestCollectionMetrics retrieves the most recent verified collection metrics
func (r *NumbersRepo) GetLatestCollectionMetrics(ctx context.Context) (*NumberCollectionMetricsRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, nil
	}
	query := `
		SELECT
			id, stat_date, minted_supply, circulating_supply, unique_holders,
			floor_ask_nano_ton, floor_number, floor_venue,
			floor_depth_5pct_count, floor_depth_10pct_count, floor_depth_25pct_count,
			median_sale_7d_nano_ton, median_sale_30d_nano_ton,
			sales_count_7d, sales_count_30d,
			COALESCE(volume_24h_nano_ton::text, '0'), COALESCE(volume_7d_nano_ton::text, '0'),
			sales_count_24h, unique_buyers_7d, unique_sellers_7d,
			active_listings_count, COALESCE(listed_share_pct, 0),
			COALESCE(top10_holder_share_pct, 0), COALESCE(top50_holder_share_pct, 0),
			market_pulse_demand, market_pulse_supply, market_pulse_liquidity, market_pulse_momentum,
			ton_usd_rate, is_stale, source_status, last_indexed_at, COALESCE(snapshot_id, '')
		FROM number_collection_metrics
		ORDER BY stat_date DESC
		LIMIT 1`

	var m NumberCollectionMetricsRecord
	err := r.db.Pool.QueryRow(ctx, query).Scan(
		&m.ID, &m.StatDate, &m.MintedSupply, &m.CirculatingSupply, &m.UniqueHolders,
		&m.FloorAskNanoTON, &m.FloorNumber, &m.FloorVenue,
		&m.FloorDepth5PctCount, &m.FloorDepth10PctCount, &m.FloorDepth25PctCount,
		&m.MedianSale7dNanoTON, &m.MedianSale30dNanoTON,
		&m.SalesCount7d, &m.SalesCount30d,
		&m.Volume24hNanoTON, &m.Volume7dNanoTON,
		&m.SalesCount24h, &m.UniqueBuyers7d, &m.UniqueSellers7d,
		&m.ActiveListingsCount, &m.ListedSharePct,
		&m.Top10HolderSharePct, &m.Top50HolderSharePct,
		&m.MarketPulseDemand, &m.MarketPulseSupply, &m.MarketPulseLiquidity, &m.MarketPulseMomentum,
		&m.TonUsdRate, &m.IsStale, &m.SourceStatus, &m.LastIndexedAt, &m.SnapshotID,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &m, nil
}

// GetCollectionHistory retrieves time-series points for historical chart
func (r *NumbersRepo) GetCollectionHistory(ctx context.Context, timeframe string) ([]NumberCollectionHistoryRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, nil
	}
	if timeframe == "" {
		timeframe = "30d"
	}
	query := `
		SELECT
			id, timestamp, timeframe, floor_nano_ton, median_sale_nano_ton,
			COALESCE(volume_nano_ton::text, '0'), sales_count, unique_buyers, unique_sellers,
			open_price_nano_ton, high_price_nano_ton, low_price_nano_ton, close_price_nano_ton,
			provenance
		FROM number_collection_history
		WHERE timeframe = $1
		ORDER BY timestamp ASC`

	rows, err := r.db.Pool.Query(ctx, query, timeframe)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []NumberCollectionHistoryRecord
	for rows.Next() {
		var h NumberCollectionHistoryRecord
		if err := rows.Scan(
			&h.ID, &h.Timestamp, &h.Timeframe, &h.FloorNanoTON, &h.MedianSaleNanoTON,
			&h.VolumeNanoTON, &h.SalesCount, &h.UniqueBuyers, &h.UniqueSellers,
			&h.OpenPriceNanoTON, &h.HighPriceNanoTON, &h.LowPriceNanoTON, &h.ClosePriceNanoTON,
			&h.Provenance,
		); err == nil {
			records = append(records, h)
		}
	}
	return records, nil
}

// GetMarketListings retrieves active verified listings with venue and type filter
func (r *NumbersRepo) GetMarketListings(ctx context.Context, venue, listingType string, limit, offset int) ([]NumberMarketListingRecord, int, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, 0, nil
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	whereParts := []string{"is_active = TRUE"}
	args := []interface{}{}
	argIdx := 1

	if venue != "" && venue != "all" {
		whereParts = append(whereParts, fmt.Sprintf("venue = $%d", argIdx))
		args = append(args, venue)
		argIdx++
	}

	if listingType != "" && listingType != "all" {
		whereParts = append(whereParts, fmt.Sprintf("listing_type = $%d", argIdx))
		args = append(args, listingType)
		argIdx++
	}

	whereClause := strings.Join(whereParts, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM number_market_listings WHERE %s", whereClause)
	var total int
	_ = r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)

	dataQuery := fmt.Sprintf(`
		SELECT
			id, number, display_number, nft_item_address, venue, listing_type,
			ask_price_nano_ton, current_bid_nano_ton, next_min_bid_nano_ton, bids_count,
			pattern_tag, is_genesis, ends_at, is_active, observed_at,
			source_url, seller_address, COALESCE(difference_from_floor_pct, 0)
		FROM number_market_listings
		WHERE %s
		ORDER BY ask_price_nano_ton ASC NULLS LAST, current_bid_nano_ton ASC NULLS LAST
		LIMIT $%d OFFSET $%d`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)
	rows, err := r.db.Pool.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, total, err
	}
	defer rows.Close()

	var listings []NumberMarketListingRecord
	for rows.Next() {
		var l NumberMarketListingRecord
		if err := rows.Scan(
			&l.ID, &l.Number, &l.DisplayNumber, &l.NFTItemAddress, &l.Venue, &l.ListingType,
			&l.AskPriceNanoTON, &l.CurrentBidNanoTON, &l.NextMinBidNanoTON, &l.BidsCount,
			&l.PatternTag, &l.IsGenesis, &l.EndsAt, &l.IsActive, &l.ObservedAt,
			&l.SourceURL, &l.SellerAddress, &l.DifferenceFromFloorPct,
		); err == nil {
			listings = append(listings, l)
		}
	}
	return listings, total, nil
}

// GetPatternAnalytics retrieves deterministic pattern classifications
func (r *NumbersRepo) GetPatternAnalytics(ctx context.Context) ([]NumberPatternAnalyticsRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, nil
	}
	query := `
		SELECT
			id, pattern_key, pattern_name_en, pattern_name_fa, sample_mask,
			exact_supply, COALESCE(supply_share_pct, 0), active_listings_count,
			floor_nano_ton, median_sale_nano_ton, p25_sale_nano_ton, p75_sale_nano_ton,
			COALESCE(premium_pct, 0), sample_size, confidence_score, updated_at
		FROM number_pattern_analytics
		ORDER BY floor_nano_ton DESC NULLS LAST, exact_supply ASC`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []NumberPatternAnalyticsRecord
	for rows.Next() {
		var p NumberPatternAnalyticsRecord
		if err := rows.Scan(
			&p.ID, &p.PatternKey, &p.PatternNameEn, &p.PatternNameFa, &p.SampleMask,
			&p.ExactSupply, &p.SupplySharePct, &p.ActiveListingsCount,
			&p.FloorNanoTON, &p.MedianSaleNanoTON, &p.P25SaleNanoTON, &p.P75SaleNanoTON,
			&p.PremiumPct, &p.SampleSize, &p.ConfidenceScore, &p.UpdatedAt,
		); err == nil {
			records = append(records, p)
		}
	}
	return records, nil
}



