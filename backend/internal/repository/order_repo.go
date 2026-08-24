package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ... existing methods ...

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
	cmdTag, err := tx.Exec(ctx, queryOrder, chargeID, payload)
	if err != nil {
		return fmt.Errorf("update order status: %w", err)
	}
	if cmdTag.RowsAffected() == 0 {
		// Order might already be paid (idempotency), proceed to grant/extend premium
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

// CompleteChannelStarsPayment atomically marks order as paid AND grants/extends subscription to the channel.
func (db *Database) CompleteChannelStarsPayment(ctx context.Context, payload string, chargeID string, channelID uuid.UUID, duration time.Duration) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Update order status to paid
	queryOrder := `
		UPDATE orders
		SET status = 'paid', telegram_payment_charge_id = $1, updated_at = CURRENT_TIMESTAMP
		WHERE payload = $2 AND status != 'paid'
	`
	cmdTag, err := tx.Exec(ctx, queryOrder, chargeID, payload)
	if err != nil {
		return fmt.Errorf("update order status: %w", err)
	}
	if cmdTag.RowsAffected() == 0 {
		// Already paid
	}

	// 2. Fetch current paid_until
	var currentPaidUntil *time.Time
	err = tx.QueryRow(ctx, "SELECT paid_until FROM managed_channels WHERE id = $1 FOR UPDATE", channelID).Scan(&currentPaidUntil)
	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("fetch paid_until: %w", err)
	}

	newUntil := time.Now().Add(duration)
	if currentPaidUntil != nil && currentPaidUntil.After(time.Now()) {
		newUntil = currentPaidUntil.Add(duration)
	}

	// 3. Grant subscription
	_, err = tx.Exec(ctx, "UPDATE managed_channels SET subscription_status = 'premium', paid_until = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", newUntil, channelID)
	if err != nil {
		return fmt.Errorf("grant channel premium: %w", err)
	}

	return tx.Commit(ctx)
}

// HasPaidValuation checks if a user has a paid valuation order for the specified username within the last 24 hours.
// Returns (hasAccess, method, error).
func (db *Database) HasPaidValuation(ctx context.Context, userID int64, username string) (bool, string, error) {
	if db.Pool == nil {
		return false, "", nil
	}
	cleanU := strings.ToLower(strings.TrimPrefix(username, "@"))
	query := `
		SELECT payload
		FROM orders
		WHERE user_id = $1
		  AND status = 'paid'
		  AND created_at > NOW() - INTERVAL '24 hours'
		  AND (LOWER(payload) LIKE $2 OR LOWER(payload) LIKE $3 OR LOWER(payload) LIKE $4)
		ORDER BY created_at DESC
		LIMIT 1
	`
	p1 := "val_coins:" + cleanU + "%"
	p2 := "val_stars:" + fmt.Sprintf("%d:%s", userID, cleanU) + "%"
	p3 := "val_free:" + fmt.Sprintf("%d:%s", userID, cleanU) + "%"
	var payload string
	err := db.Pool.QueryRow(ctx, query, userID, p1, p2, p3).Scan(&payload)
	if err == pgx.ErrNoRows {
		return false, "", nil
	}
	if err != nil {
		return false, "", err
	}

	method := "coins"
	if len(payload) >= 8 && strings.ToLower(payload[:8]) == "val_free" {
		method = "free"
	} else if len(payload) >= 9 && strings.ToLower(payload[:9]) == "val_stars" {
		method = "stars"
	}
	return true, method, nil
}

// HasUsedFreeValuationQuota checks if a user has ever claimed a free valuation.
func (db *Database) HasUsedFreeValuationQuota(ctx context.Context, userID int64) (bool, error) {
	if db.Pool == nil {
		return false, nil
	}
	query := `SELECT EXISTS(SELECT 1 FROM orders WHERE user_id = $1 AND starts_with(payload, 'val_free:') AND status = 'paid')`
	var exists bool
	err := db.Pool.QueryRow(ctx, query, userID).Scan(&exists)
	return exists, err
}
