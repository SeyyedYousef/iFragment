package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (db *Database) HasPaidForReport(ctx context.Context, userID int64, username string) (bool, error) {
	prefix := fmt.Sprintf("report_pay:%d:%s:", userID, username)
	query := `SELECT EXISTS(SELECT 1 FROM orders WHERE starts_with(payload, $1) AND status = 'paid')`
	var exists bool
	err := db.Pool.QueryRow(ctx, query, prefix).Scan(&exists)
	return exists, err
}

type Order struct {
	ID                      uuid.UUID
	UserID                  int64
	Amount                  int
	Status                  string
	Payload                 string
	TelegramPaymentChargeID string
}

func (db *Database) CreateOrder(ctx context.Context, o Order) (uuid.UUID, error) {
	query := `
		INSERT INTO orders (user_id, amount, status, payload)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (payload) DO UPDATE SET status = orders.status
		RETURNING id
	`
	var id uuid.UUID
	err := db.Pool.QueryRow(ctx, query, o.UserID, o.Amount, o.Status, o.Payload).Scan(&id)
	return id, err
}

func (db *Database) UpdateOrderStatus(ctx context.Context, payload string, status string, chargeID string) error {
	query := `
		UPDATE orders
		SET status = $1, telegram_payment_charge_id = $2, updated_at = CURRENT_TIMESTAMP
		WHERE payload = $3
	`
	_, err := db.Pool.Exec(ctx, query, status, chargeID, payload)
	return err
}

func (db *Database) GetOrderByID(ctx context.Context, id uuid.UUID) (*Order, error) {
	query := `
		SELECT id, user_id, amount, status, payload, COALESCE(telegram_payment_charge_id, '')
		FROM orders
		WHERE id = $1
	`
	var o Order
	err := db.Pool.QueryRow(ctx, query, id).Scan(&o.ID, &o.UserID, &o.Amount, &o.Status, &o.Payload, &o.TelegramPaymentChargeID)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (db *Database) GetOrderByPayload(ctx context.Context, payload string) (*Order, error) {
	query := `
		SELECT id, user_id, amount, status, payload, COALESCE(telegram_payment_charge_id, '')
		FROM orders
		WHERE payload = $1
	`
	var o Order
	err := db.Pool.QueryRow(ctx, query, payload).Scan(&o.ID, &o.UserID, &o.Amount, &o.Status, &o.Payload, &o.TelegramPaymentChargeID)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// CompleteStarsPremiumPaymentTx marks order as paid AND grants premium within an existing transaction.
func (db *Database) CompleteStarsPremiumPaymentTx(ctx context.Context, tx pgx.Tx, payload string, chargeID string, userID int64, duration time.Duration) error {
	// 1. Update order status to paid
	queryOrder := `
		UPDATE orders
		SET status = 'paid', telegram_payment_charge_id = $1, updated_at = CURRENT_TIMESTAMP
		WHERE payload = $2 AND status != 'paid'
	`
	_, err := tx.Exec(ctx, queryOrder, chargeID, payload)
	if err != nil {
		return fmt.Errorf("update order status: %w", err)
	}

	// 2. Fetch current premium_until
	var currentPremiumUntil *time.Time
	err = tx.QueryRow(ctx, "SELECT premium_until FROM users WHERE telegram_id = $1 FOR UPDATE", userID).Scan(&currentPremiumUntil)
	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("fetch premium_until: %w", err)
	}

	newUntil := time.Now().Add(duration)
	if currentPremiumUntil != nil && currentPremiumUntil.After(time.Now()) {
		newUntil = currentPremiumUntil.Add(duration)
	}

	// 3. Grant premium
	_, err = tx.Exec(ctx, "UPDATE users SET is_premium = TRUE, premium_until = $1, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = $2", newUntil, userID)
	if err != nil {
		return fmt.Errorf("grant premium: %w", err)
	}

	return nil
}

// CompleteStarsPremiumPayment atomically marks order as paid AND grants premium to the user.
func (db *Database) CompleteStarsPremiumPayment(ctx context.Context, payload string, chargeID string, userID int64, duration time.Duration) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if err := db.CompleteStarsPremiumPaymentTx(ctx, tx, payload, chargeID, userID, duration); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// HasPaidValuation checks if a user has a paid valuation order, report entitlement, or consumed an Intel Credit for the specified username.
// Returns (hasAccess, method, error).
func (db *Database) HasPaidValuation(ctx context.Context, userID int64, username string) (bool, string, error) {
	if db == nil || db.Pool == nil {
		return false, "", nil
	}
	cleanU := strings.ToLower(strings.TrimPrefix(username, "@"))

	// 0. Check report_entitlements table (permanent credit/order unlock ledger)
	var entExists int
	errEnt := db.Pool.QueryRow(ctx, `
		SELECT 1
		FROM report_entitlements
		WHERE principal_id = $1
		  AND LOWER(TRIM(LEADING '@' FROM asset_id)) = $2
		  AND product_type IN ('username_report', 'username')
		  AND (expires_at IS NULL OR expires_at > NOW())
		LIMIT 1
	`, userID, cleanU).Scan(&entExists)
	if errEnt == nil {
		return true, "credit", nil
	}

	// 1. Check orders table (Coins, Stars, Free Quota, or Referral Credit)
	query := `
		SELECT payload
		FROM orders
		WHERE user_id = $1
		  AND status = 'paid'
		  AND created_at > NOW() - INTERVAL '24 hours'
		  AND (LOWER(payload) LIKE $2 OR LOWER(payload) LIKE $3 OR LOWER(payload) LIKE $4 OR LOWER(payload) LIKE $5)
		ORDER BY created_at DESC
		LIMIT 1
	`
	p1 := "val_coins:" + cleanU + "%"
	p2 := "val_stars:" + fmt.Sprintf("%d:%s", userID, cleanU) + "%"
	p3 := "val_free:" + fmt.Sprintf("%d:%s", userID, cleanU) + "%"
	p4 := "val_credit:" + cleanU + "%"
	var payload string
	err := db.Pool.QueryRow(ctx, query, userID, p1, p2, p3, p4).Scan(&payload)
	if err == nil {
		method := "coins"
		if len(payload) >= 8 && strings.ToLower(payload[:8]) == "val_free" {
			method = "free"
		} else if len(payload) >= 9 && strings.ToLower(payload[:9]) == "val_stars" {
			method = "stars"
		} else if len(payload) >= 10 && strings.ToLower(payload[:10]) == "val_credit" {
			method = "credit"
		}
		return true, method, nil
	} else if err != pgx.ErrNoRows {
		return false, "", err
	}

	// 2. Check intel_credit_ledger for Intel Credit deductions in the last 24 hours
	ledgerQuery := `
		SELECT 1
		FROM intel_credit_ledger
		WHERE user_id = $1
		  AND delta < 0
		  AND reason IN ('username', 'report:username', 'val_username', 'report:intel')
		  AND LOWER(TRIM(LEADING '@' FROM entity)) = $2
		  AND created_at > NOW() - INTERVAL '24 hours'
		LIMIT 1
	`
	var exists int
	err = db.Pool.QueryRow(ctx, ledgerQuery, userID, cleanU).Scan(&exists)
	if err == nil {
		return true, "credit", nil
	}
	if err == pgx.ErrNoRows {
		return false, "", nil
	}
	return false, "", err
}

// HasUsedFreeValuationQuota checks if a user has ever claimed a free valuation.
func (db *Database) HasUsedFreeValuationQuota(ctx context.Context, userID int64) (bool, error) {
	if db == nil || db.Pool == nil {
		return false, nil
	}
	query := `SELECT EXISTS(SELECT 1 FROM orders WHERE user_id = $1 AND starts_with(payload, 'val_free:') AND status = 'paid')`
	var exists bool
	err := db.Pool.QueryRow(ctx, query, userID).Scan(&exists)
	return exists, err
}

// HasActiveProPass checks if a user has an active 30-day Pro Analyst Pass.
func (db *Database) HasActiveProPass(ctx context.Context, userID int64) (bool, error) {
	if db == nil || db.Pool == nil {
		return false, nil
	}
	query := `SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'paid' AND (payload LIKE 'val_pro:%' OR amount = 249) AND created_at >= NOW() - INTERVAL '30 days'`
	var count int
	if err := db.Pool.QueryRow(ctx, query, userID).Scan(&count); err != nil {
		return false, err
	}
	return count > 0, nil
}

// HasPreviousValuationOrders checks if a user has previously purchased any valuation order.
func (db *Database) HasPreviousValuationOrders(ctx context.Context, userID int64) (bool, error) {
	if db == nil || db.Pool == nil {
		return false, nil
	}
	var orderCount int
	err := db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'paid' AND starts_with(payload, 'val_')`, userID).Scan(&orderCount)
	if err != nil {
		return false, err
	}
	return orderCount > 0, nil
}

// SetUsernameWatchlist enables or disables monitoring for a username in PostgreSQL.
func (db *Database) SetUsernameWatchlist(ctx context.Context, userID int64, username string, enabled bool) error {
	if db == nil || db.Pool == nil {
		return nil
	}
	_, _ = db.Pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS username_watchlist (
		user_id BIGINT NOT NULL,
		username TEXT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		PRIMARY KEY (user_id, username)
	)`)
	if enabled {
		_, err := db.Pool.Exec(ctx, `INSERT INTO username_watchlist (user_id, username, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (user_id, username) DO NOTHING`, userID, username)
		return err
	}
	_, err := db.Pool.Exec(ctx, `DELETE FROM username_watchlist WHERE user_id = $1 AND username = $2`, userID, username)
	return err
}

// HasReportEntitlement checks if an idempotency key was already granted for a principal and asset.
func (db *Database) HasReportEntitlement(ctx context.Context, userID int64, assetID, idempotencyKey string) (bool, error) {
	if db == nil || db.Pool == nil || idempotencyKey == "" {
		return false, nil
	}
	var existingID string
	err := db.Pool.QueryRow(ctx, `
		SELECT id::text FROM report_entitlements
		WHERE principal_id = $1 AND asset_id = $2 AND idempotency_key = $3
		LIMIT 1`, userID, assetID, idempotencyKey).Scan(&existingID)
	if err == nil && existingID != "" {
		return true, nil
	}
	if err == pgx.ErrNoRows {
		return false, nil
	}
	return false, err
}

// GrantReportEntitlement persists a durable report entitlement record in PostgreSQL.
func (db *Database) GrantReportEntitlement(ctx context.Context, userID int64, assetID, idempotencyKey, productType string) error {
	if db == nil || db.Pool == nil {
		return nil
	}
	if idempotencyKey == "" {
		idempotencyKey = fmt.Sprintf("auto:%d:%s:%s:%d", userID, productType, assetID, time.Now().Unix()/(24*3600))
	}
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO report_entitlements (principal_id, asset_id, idempotency_key, product_type, granted_at, expires_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours')
		ON CONFLICT (principal_id, asset_id, idempotency_key) DO NOTHING`,
		userID, assetID, idempotencyKey, productType)
	return err
}

// GetUserLanguageCode fetches the user's preferred language code ('fa', 'en', 'ru', 'zh') from the users table.
func (db *Database) GetUserLanguageCode(ctx context.Context, userID int64) string {
	if db == nil || db.Pool == nil || userID <= 0 {
		return "fa"
	}
	var lang string
	err := db.Pool.QueryRow(ctx, `SELECT COALESCE(NULLIF(language_code, ''), 'fa') FROM users WHERE telegram_id = $1`, userID).Scan(&lang)
	if err != nil || lang == "" {
		return "fa"
	}
	l := strings.ToLower(strings.TrimSpace(lang))
	switch {
	case strings.HasPrefix(l, "en"):
		return "en"
	case strings.HasPrefix(l, "ru"):
		return "ru"
	case strings.HasPrefix(l, "zh"):
		return "zh"
	default:
		return "fa"
	}
}

// GetUserIdentity fetches username and first_name for a user ID.
func (db *Database) GetUserIdentity(ctx context.Context, userID int64) (string, string) {
	if db == nil || db.Pool == nil || userID <= 0 {
		return "", ""
	}
	var uname, fname string
	_ = db.Pool.QueryRow(ctx, `SELECT COALESCE(username, ''), COALESCE(first_name, '') FROM users WHERE telegram_id = $1`, userID).Scan(&uname, &fname)
	return uname, fname
}
