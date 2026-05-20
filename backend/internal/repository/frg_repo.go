package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type FRGBalance struct {
	UserID      int64   `json:"user_id"`
	Balance     float64 `json:"balance"`
	TotalEarned float64 `json:"total_earned"`
	TotalSpent  float64 `json:"total_spent"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type FRGTransaction struct {
	ID            uuid.UUID `json:"id"`
	UserID        int64     `json:"user_id"`
	Type          string    `json:"type"`
	Amount        float64   `json:"amount"`
	BalanceBefore float64   `json:"balance_before"`
	BalanceAfter  float64   `json:"balance_after"`
	Metadata      []byte    `json:"metadata,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type FRGRepo struct {
	db *Database
}

func NewFRGRepo(db *Database) *FRGRepo {
	return &FRGRepo{db: db}
}

func (r *FRGRepo) DB() *Database {
	return r.db
}

func (r *FRGRepo) GetBalance(ctx context.Context, userID int64) (*FRGBalance, error) {
	query := `SELECT user_id, balance, total_earned, total_spent, updated_at FROM frg_balances WHERE user_id = $1`
	var b FRGBalance
	err := r.db.Pool.QueryRow(ctx, query, userID).Scan(&b.UserID, &b.Balance, &b.TotalEarned, &b.TotalSpent, &b.UpdatedAt)
	if err == pgx.ErrNoRows {
		return r.initBalance(ctx, userID)
	}
	return &b, err
}

func (r *FRGRepo) initBalance(ctx context.Context, userID int64) (*FRGBalance, error) {
	b := &FRGBalance{UserID: userID}
	query := `INSERT INTO frg_balances (user_id) VALUES ($1)
		ON CONFLICT (user_id) DO NOTHING
		RETURNING balance, total_earned, total_spent, updated_at`
	err := r.db.Pool.QueryRow(ctx, query, userID).Scan(&b.Balance, &b.TotalEarned, &b.TotalSpent, &b.UpdatedAt)
	if err == pgx.ErrNoRows {
		return r.GetBalance(ctx, userID)
	}
	return b, err
}

func (r *FRGRepo) Credit(ctx context.Context, userID int64, amount float64, txType string, metadata []byte) (*FRGTransaction, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Lock balance row
	var balanceBefore float64
	err = tx.QueryRow(ctx,
		`SELECT balance FROM frg_balances WHERE user_id = $1 FOR UPDATE`, userID,
	).Scan(&balanceBefore)
	if err == pgx.ErrNoRows {
		_, _ = r.initBalance(ctx, userID)
		balanceBefore = 0
	} else if err != nil {
		return nil, err
	}

	balanceAfter := balanceBefore + amount

	_, err = tx.Exec(ctx,
		`UPDATE frg_balances SET balance = $1, total_earned = total_earned + $2, updated_at = now() WHERE user_id = $3`,
		balanceAfter, amount, userID,
	)
	if err != nil {
		return nil, err
	}

	var t FRGTransaction
	err = tx.QueryRow(ctx,
		`INSERT INTO frg_transactions (user_id, type, amount, balance_before, balance_after, metadata)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at`,
		userID, txType, amount, balanceBefore, balanceAfter, metadata,
	).Scan(&t.ID, &t.CreatedAt)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	t.UserID = userID
	t.Type = txType
	t.Amount = amount
	t.BalanceBefore = balanceBefore
	t.BalanceAfter = balanceAfter
	t.Metadata = metadata
	return &t, nil
}

func (r *FRGRepo) Debit(ctx context.Context, userID int64, amount float64, txType string, metadata []byte) (*FRGTransaction, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var balanceBefore float64
	err = tx.QueryRow(ctx,
		`SELECT balance FROM frg_balances WHERE user_id = $1 FOR UPDATE`, userID,
	).Scan(&balanceBefore)
	if err != nil {
		return nil, err
	}

	if balanceBefore < amount {
		return nil, fmt.Errorf("insufficient FRG balance: have %.4f, need %.4f", balanceBefore, amount)
	}

	balanceAfter := balanceBefore - amount

	_, err = tx.Exec(ctx,
		`UPDATE frg_balances SET balance = $1, total_spent = total_spent + $2, updated_at = now() WHERE user_id = $3`,
		balanceAfter, amount, userID,
	)
	if err != nil {
		return nil, err
	}

	var t FRGTransaction
	err = tx.QueryRow(ctx,
		`INSERT INTO frg_transactions (user_id, type, amount, balance_before, balance_after, metadata)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at`,
		userID, txType, -amount, balanceBefore, balanceAfter, metadata,
	).Scan(&t.ID, &t.CreatedAt)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	t.UserID = userID
	t.Type = txType
	t.Amount = -amount
	t.BalanceBefore = balanceBefore
	t.BalanceAfter = balanceAfter
	t.Metadata = metadata
	return &t, nil
}

func (r *FRGRepo) GetTransactions(ctx context.Context, userID int64, limit, offset int) ([]FRGTransaction, error) {
	query := `SELECT id, user_id, type, amount, balance_before, balance_after, metadata, created_at
		FROM frg_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.Pool.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []FRGTransaction
	for rows.Next() {
		var t FRGTransaction
		if err := rows.Scan(&t.ID, &t.UserID, &t.Type, &t.Amount, &t.BalanceBefore, &t.BalanceAfter, &t.Metadata, &t.CreatedAt); err != nil {
			return nil, err
		}
		txs = append(txs, t)
	}
	return txs, nil
}
