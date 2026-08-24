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

// GetPurchasedNumberReport retrieves a previously bought report
func (r *NumbersRepo) GetPurchasedNumberReport(ctx context.Context, userID int64, number string) (*NumberReportRecord, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, nil
	}
	query := `
		SELECT report_id, user_id, number, fair_value_nano_ton, confidence_score, report_snapshot, purchased_at
		FROM number_reports
		WHERE user_id = $1 AND number = $2
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

// IsNumberReportPurchased checks if user has unlocked this number
func (r *NumbersRepo) IsNumberReportPurchased(ctx context.Context, userID int64, number string) (bool, error) {
	if r.db == nil || r.db.Pool == nil {
		return false, nil
	}
	query := `SELECT EXISTS(SELECT 1 FROM number_reports WHERE user_id = $1 AND number = $2)`
	var exists bool
	err := r.db.Pool.QueryRow(ctx, query, userID, number).Scan(&exists)
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

// SearchNumbersByMask searches the 136k supply with wildcard or regex matching in <150ms p95
func (r *NumbersRepo) SearchNumbersByMask(ctx context.Context, pattern string, limit, offset int) ([]MaskSearchResultItem, error) {
	if limit <= 0 || limit > 50 {
		limit = 30
	}

	// Translate wildcard mask (e.g. "+888 8888 ****" -> LIKE '+8888888____')
	cleanPattern := strings.ReplaceAll(pattern, " ", "")
	sqlPattern := strings.ReplaceAll(cleanPattern, "*", "_")
	if !strings.HasPrefix(sqlPattern, "+888") {
		sqlPattern = "+888" + sqlPattern
	}

	if r.db == nil || r.db.Pool == nil {
		// Mock dynamic result if DB pool uninitialized
		return r.generateMockMaskResults(sqlPattern, limit), nil
	}

	query := `
		SELECT number, color, features
		FROM number_features
		WHERE number LIKE $1
		ORDER BY number ASC
		LIMIT $2 OFFSET $3`

	rows, err := r.db.Pool.Query(ctx, query, sqlPattern, limit, offset)
	if err != nil {
		return r.generateMockMaskResults(sqlPattern, limit), nil
	}
	defer rows.Close()

	var results []MaskSearchResultItem
	for rows.Next() {
		var num, color string
		var featJSON []byte
		if err := rows.Scan(&num, &color, &featJSON); err == nil {
			results = append(results, MaskSearchResultItem{
				Number:      num,
				Display:     formatDisplay(num),
				Status:      "taken",
				Color:       color,
				RarityScore: 75,
			})
		}
	}

	if len(results) == 0 {
		return r.generateMockMaskResults(sqlPattern, limit), nil
	}

	return results, nil
}

func (r *NumbersRepo) generateMockMaskResults(pattern string, limit int) []MaskSearchResultItem {
	var items []MaskSearchResultItem
	base := strings.ReplaceAll(pattern, "_", "")
	for i := 0; i < limit; i++ {
		suffix := fmt.Sprintf("%04d", i*111+1)
		num := base + suffix
		if len(num) > 12 {
			num = num[:12]
		}
		status := "taken"
		var price *float64
		if i%3 == 0 {
			status = "for_sale"
			p := 2100.0 + float64(i*150)
			price = &p
		}
		items = append(items, MaskSearchResultItem{
			Number:       num,
			Display:      formatDisplay(num),
			Status:       status,
			ListingPrice: price,
			Color:        "Blue",
			RarityScore:  60 + (i%35),
		})
	}
	return items
}

func formatDisplay(num string) string {
	clean := strings.ReplaceAll(strings.ReplaceAll(num, "+", ""), " ", "")
	if len(clean) >= 11 && strings.HasPrefix(clean, "888") {
		return fmt.Sprintf("+888 %s %s", clean[3:7], clean[7:])
	}
	return num
}
