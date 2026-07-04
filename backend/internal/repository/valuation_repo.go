package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
)

// Sale represents a single username sale record for AVM comparables.
type Sale struct {
	ID            int64           `json:"id"`
	Username      string          `json:"username"`
	SalePriceTON  decimal.Decimal `json:"sale_price_ton"`
	SaleType      string          `json:"sale_type"`
	SaleDate      time.Time       `json:"sale_date"`
	BuyerAddress  *string         `json:"buyer_address,omitempty"`
	SellerAddress *string         `json:"seller_address,omitempty"`
	IsWash        bool            `json:"is_wash"`
	CharLength    int16           `json:"char_length"`
	Segment       string          `json:"segment"`
	HasNumbers    bool            `json:"has_numbers"`
	HasUnderscore bool            `json:"has_underscore"`
	IsDictionary  bool            `json:"is_dictionary"`
	Source        string          `json:"source"`
	RawData       json.RawMessage `json:"raw_data,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}

// ValuationRun represents a persisted audit record for a single valuation execution.
type ValuationRun struct {
	ID               int64           `json:"id"`
	Username         string          `json:"username"`
	RunTimestamp      time.Time       `json:"run_timestamp"`
	ModelVersion     string          `json:"model_version"`
	ConfigSnapshot   json.RawMessage `json:"config_snapshot"`
	TONUSDRate       decimal.Decimal `json:"ton_usd_rate"`
	BasePriceTON     decimal.Decimal `json:"base_price_ton"`
	LowTON           decimal.Decimal `json:"low_ton"`
	ExpectedTON      decimal.Decimal `json:"expected_ton"`
	HighTON          decimal.Decimal `json:"high_ton"`
	ConfidenceScore  int16           `json:"confidence_score"`
	ComparableSaleIDs []int64        `json:"comparable_sale_ids"`
	ReasoningLog     json.RawMessage `json:"reasoning_log"`
}

// InsertSale persists a sale record and returns the new row ID.
func (db *Database) InsertSale(ctx context.Context, s Sale) (int64, error) {
	query := `
		INSERT INTO username_sales (
			username, sale_price_ton, sale_type, sale_date,
			buyer_address, seller_address, is_wash,
			char_length, segment, has_numbers, has_underscore, is_dictionary,
			source, raw_data
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		RETURNING id`

	var id int64
	err := db.Pool.QueryRow(ctx, query,
		s.Username, s.SalePriceTON, s.SaleType, s.SaleDate,
		s.BuyerAddress, s.SellerAddress, s.IsWash,
		s.CharLength, s.Segment, s.HasNumbers, s.HasUnderscore, s.IsDictionary,
		s.Source, s.RawData,
	).Scan(&id)
	return id, err
}

// GetExactComparables fetches non-wash sales matching both segment AND char_length,
// ordered by sale_date DESC for time-decay weighting.
func (db *Database) GetExactComparables(ctx context.Context, segment string, charLen int16, before time.Time, limit int) ([]Sale, error) {
	query := `
		SELECT id, username, sale_price_ton, sale_type, sale_date,
		       buyer_address, seller_address, is_wash,
		       char_length, segment, has_numbers, has_underscore, is_dictionary,
		       source, raw_data, created_at
		FROM username_sales
		WHERE segment = $1
		  AND char_length = $2
		  AND sale_date < $3
		  AND is_wash = FALSE
		ORDER BY sale_date DESC
		LIMIT $4`

	return db.scanSales(ctx, query, segment, charLen, before, limit)
}

// GetBroadComparables fetches non-wash sales matching segment only (any length),
// used as the broad prior in Bayesian shrinkage.
func (db *Database) GetBroadComparables(ctx context.Context, segment string, before time.Time, limit int) ([]Sale, error) {
	query := `
		SELECT id, username, sale_price_ton, sale_type, sale_date,
		       buyer_address, seller_address, is_wash,
		       char_length, segment, has_numbers, has_underscore, is_dictionary,
		       source, raw_data, created_at
		FROM username_sales
		WHERE segment = $1
		  AND sale_date < $2
		  AND is_wash = FALSE
		ORDER BY sale_date DESC
		LIMIT $3`

	return db.scanSales(ctx, query, segment, before, limit)
}

// GetMomentumCounts returns sale counts in the 0-30 day and 31-90 day windows
// before the given timestamp, for smoothed momentum calculation.
func (db *Database) GetMomentumCounts(ctx context.Context, segment string, charLen int16, before time.Time) (count30 int, count31_90 int, err error) {
	query := `
		SELECT
			COUNT(*) FILTER (WHERE sale_date >= $3::timestamptz - INTERVAL '30 days' AND sale_date < $3),
			COUNT(*) FILTER (WHERE sale_date >= $3::timestamptz - INTERVAL '90 days' AND sale_date < $3::timestamptz - INTERVAL '30 days')
		FROM username_sales
		WHERE segment = $1
		  AND char_length = $2
		  AND is_wash = FALSE`

	err = db.Pool.QueryRow(ctx, query, segment, charLen, before).Scan(&count30, &count31_90)
	return
}

// InsertValuationRun persists the audit record for a valuation run.
// This MUST succeed before the HTTP response is sent (synchronous audit).
func (db *Database) InsertValuationRun(ctx context.Context, run ValuationRun) (int64, error) {
	query := `
		INSERT INTO valuation_runs (
			username, model_version, config_snapshot,
			ton_usd_rate, base_price_ton, low_ton, expected_ton, high_ton,
			confidence_score, comparable_sale_ids, reasoning_log
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		RETURNING id`

	var id int64
	err := db.Pool.QueryRow(ctx, query,
		run.Username, run.ModelVersion, run.ConfigSnapshot,
		run.TONUSDRate, run.BasePriceTON, run.LowTON, run.ExpectedTON, run.HighTON,
		run.ConfidenceScore, run.ComparableSaleIDs, run.ReasoningLog,
	).Scan(&id)
	return id, err
}

// scanSales is a shared row scanner for sale queries.
func (db *Database) scanSales(ctx context.Context, query string, args ...interface{}) ([]Sale, error) {
	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sales []Sale
	for rows.Next() {
		var s Sale
		if err := rows.Scan(
			&s.ID, &s.Username, &s.SalePriceTON, &s.SaleType, &s.SaleDate,
			&s.BuyerAddress, &s.SellerAddress, &s.IsWash,
			&s.CharLength, &s.Segment, &s.HasNumbers, &s.HasUnderscore, &s.IsDictionary,
			&s.Source, &s.RawData, &s.CreatedAt,
		); err != nil {
			return nil, err
		}
		sales = append(sales, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return sales, nil
}

// GetSalesByUsername fetches all non-wash sales for a specific username.
func (db *Database) GetSalesByUsername(ctx context.Context, username string) ([]Sale, error) {
	query := `
		SELECT id, username, sale_price_ton, sale_type, sale_date,
		       buyer_address, seller_address, is_wash,
		       char_length, segment, has_numbers, has_underscore, is_dictionary,
		       source, raw_data, created_at
		FROM username_sales
		WHERE username = $1
		  AND is_wash = FALSE
		ORDER BY sale_date DESC`

	return db.scanSales(ctx, query, username)
}

// BulkInsertSales inserts multiple sale records in a single batch using pgx CopyFrom.
func (db *Database) BulkInsertSales(ctx context.Context, sales []Sale) (int64, error) {
	if len(sales) == 0 {
		return 0, nil
	}

	columns := []string{
		"username", "sale_price_ton", "sale_type", "sale_date",
		"buyer_address", "seller_address", "is_wash",
		"char_length", "segment", "has_numbers", "has_underscore", "is_dictionary",
		"source", "raw_data",
	}

	rows := make([][]interface{}, len(sales))
	for i, s := range sales {
		rows[i] = []interface{}{
			s.Username, s.SalePriceTON, s.SaleType, s.SaleDate,
			s.BuyerAddress, s.SellerAddress, s.IsWash,
			s.CharLength, s.Segment, s.HasNumbers, s.HasUnderscore, s.IsDictionary,
			s.Source, s.RawData,
		}
	}

	copyCount, err := db.Pool.CopyFrom(
		ctx,
		pgx.Identifier{"username_sales"},
		columns,
		pgx.CopyFromRows(rows),
	)
	return copyCount, err
}

// GetAllSales fetches all non-wash sales from the database ordered by sale_date ASC.
// This is used exclusively for the Point-in-Time (PiT) Backtesting CLI.
func (db *Database) GetAllSales(ctx context.Context) ([]Sale, error) {
	query := `
		SELECT id, username, sale_price_ton, sale_type, sale_date,
		       buyer_address, seller_address, is_wash,
		       char_length, segment, has_numbers, has_underscore, is_dictionary,
		       source, raw_data, created_at
		FROM username_sales
		WHERE is_wash = FALSE
		ORDER BY sale_date ASC`

	return db.scanSales(ctx, query)
}
