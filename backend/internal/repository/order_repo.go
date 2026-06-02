package repository

import (
	"context"
	"fmt"
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
	ID                     uuid.UUID
	UserID                 int64
	Amount                 int
	Status                 string
	Payload                string
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

// CompleteStarsPremiumPayment atomically marks order as paid AND grants premium to the user.
func (db *Database) CompleteStarsPremiumPayment(ctx context.Context, payload string, chargeID string, userID int64, duration time.Duration) error {
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
		// Order might already be paid (idempotency), which is fine but we should proceed to grant premium if somehow not set.
	}

	// 2. Fetch current premium_until
	var currentPremiumUntil *time.Time
	err = tx.QueryRow(ctx, "SELECT premium_until FROM users WHERE telegram_id = $1 FOR UPDATE").Scan(&currentPremiumUntil)
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

	return tx.Commit(ctx)
}
