package repository

import (
	"context"
	"fmt"
	"github.com/google/uuid"
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
