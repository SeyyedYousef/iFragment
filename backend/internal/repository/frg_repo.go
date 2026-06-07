package repository

import (
	"context"
	"fmt"
	"hash/fnv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type FRGBalance struct {
	UserID      int64     `json:"user_id"`
	Balance     float64   `json:"balance"`
	TotalEarned float64   `json:"total_earned"`
	TotalSpent  float64   `json:"total_spent"`
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
	ChargeID      *string   `json:"charge_id,omitempty"`
	TxHash        *string   `json:"tx_hash,omitempty"`
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
	query := `SELECT user_id, COALESCE(airdrop_coins, 0) as balance, 
		COALESCE((SELECT SUM(amount) FROM frg_transactions WHERE user_id = $1 AND amount > 0), 0.0) as total_earned, 
		COALESCE((SELECT SUM(ABS(amount)) FROM frg_transactions WHERE user_id = $1 AND amount < 0), 0.0) as total_spent, 
		energy_updated_at FROM user_stats WHERE user_id = $1`
	var b FRGBalance
	var updatedAt time.Time
	err := r.db.Pool.QueryRow(ctx, query, userID).Scan(&b.UserID, &b.Balance, &b.TotalEarned, &b.TotalSpent, &updatedAt)
	if err == pgx.ErrNoRows {
		if err := r.db.EnsureStatsExists(ctx, userID); err != nil {
			return nil, err
		}
		err = r.db.Pool.QueryRow(ctx, query, userID).Scan(&b.UserID, &b.Balance, &b.TotalEarned, &b.TotalSpent, &updatedAt)
	}
	b.UpdatedAt = updatedAt
	return &b, err
}

func (r *FRGRepo) initBalance(ctx context.Context, userID int64) (*FRGBalance, error) {
	return r.GetBalance(ctx, userID)
}

func (r *FRGRepo) Credit(ctx context.Context, userID int64, amount float64, txType string, metadata []byte) (*FRGTransaction, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	queryInsert := `INSERT INTO user_stats (user_id, days_active, current_streak, total_taps, xp, level, last_active_at, energy, energy_updated_at, airdrop_coins)
		VALUES ($1, 1, 1, 0, 0, 1, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP, 0.0)
		ON CONFLICT (user_id) DO NOTHING`
	_, err = tx.Exec(ctx, queryInsert, userID)
	if err != nil {
		return nil, err
	}

	var balanceBefore float64
	err = tx.QueryRow(ctx, `SELECT COALESCE(airdrop_coins, 0) FROM user_stats WHERE user_id = $1 FOR UPDATE`, userID).Scan(&balanceBefore)
	if err != nil {
		return nil, err
	}

	balanceAfter := balanceBefore + amount

	_, err = tx.Exec(ctx,
		`UPDATE user_stats SET airdrop_coins = $1 WHERE user_id = $2`,
		balanceAfter, userID,
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

func (r *FRGRepo) CreditTx(ctx context.Context, tx pgx.Tx, userID int64, amount float64, txType string, metadata []byte) (*FRGTransaction, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}

	queryInsert := `INSERT INTO user_stats (user_id, days_active, current_streak, total_taps, xp, level, last_active_at, energy, energy_updated_at, airdrop_coins)
		VALUES ($1, 1, 1, 0, 0, 1, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP, 0.0)
		ON CONFLICT (user_id) DO NOTHING`
	_, err := tx.Exec(ctx, queryInsert, userID)
	if err != nil {
		return nil, err
	}

	var balanceBefore float64
	err = tx.QueryRow(ctx, `SELECT COALESCE(airdrop_coins, 0) FROM user_stats WHERE user_id = $1 FOR UPDATE`, userID).Scan(&balanceBefore)
	if err != nil {
		return nil, err
	}

	balanceAfter := balanceBefore + amount

	_, err = tx.Exec(ctx,
		`UPDATE user_stats SET airdrop_coins = $1 WHERE user_id = $2`,
		balanceAfter, userID,
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

	t.UserID = userID
	t.Type = txType
	t.Amount = amount
	t.BalanceBefore = balanceBefore
	t.BalanceAfter = balanceAfter
	t.Metadata = metadata
	return &t, nil
}

func (r *FRGRepo) DebitTx(ctx context.Context, tx pgx.Tx, userID int64, amount float64, txType string, metadata []byte) (*FRGTransaction, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}

	queryInsert := `INSERT INTO user_stats (user_id, days_active, current_streak, total_taps, xp, level, last_active_at, energy, energy_updated_at, airdrop_coins)
		VALUES ($1, 1, 1, 0, 0, 1, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP, 0.0)
		ON CONFLICT (user_id) DO NOTHING`
	if _, err := tx.Exec(ctx, queryInsert, userID); err != nil {
		return nil, err
	}

	var balanceBefore float64
	err := tx.QueryRow(ctx,
		`SELECT COALESCE(airdrop_coins, 0) FROM user_stats WHERE user_id = $1 FOR UPDATE`, userID,
	).Scan(&balanceBefore)
	if err != nil {
		return nil, err
	}

	if balanceBefore < amount {
		return nil, fmt.Errorf("insufficient FRG balance: have %.4f, need %.4f", balanceBefore, amount)
	}

	balanceAfter := balanceBefore - amount

	_, err = tx.Exec(ctx,
		`UPDATE user_stats SET airdrop_coins = $1 WHERE user_id = $2`,
		balanceAfter, userID,
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

	t.UserID = userID
	t.Type = txType
	t.Amount = -amount
	t.BalanceBefore = balanceBefore
	t.BalanceAfter = balanceAfter
	t.Metadata = metadata
	return &t, nil
}

func (r *FRGRepo) Debit(ctx context.Context, userID int64, amount float64, txType string, metadata []byte) (*FRGTransaction, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	queryInsert := `INSERT INTO user_stats (user_id, days_active, current_streak, total_taps, xp, level, last_active_at, energy, energy_updated_at, airdrop_coins)
		VALUES ($1, 1, 1, 0, 0, 1, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP, 0.0)
		ON CONFLICT (user_id) DO NOTHING`
	if _, err = tx.Exec(ctx, queryInsert, userID); err != nil {
		return nil, err
	}

	var balanceBefore float64
	err = tx.QueryRow(ctx,
		`SELECT COALESCE(airdrop_coins, 0) FROM user_stats WHERE user_id = $1 FOR UPDATE`, userID,
	).Scan(&balanceBefore)
	if err != nil {
		return nil, err
	}

	if balanceBefore < amount {
		return nil, fmt.Errorf("insufficient FRG balance: have %.4f, need %.4f", balanceBefore, amount)
	}

	balanceAfter := balanceBefore - amount

	_, err = tx.Exec(ctx,
		`UPDATE user_stats SET airdrop_coins = $1 WHERE user_id = $2`,
		balanceAfter, userID,
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
	query := `SELECT id, user_id, type, amount, balance_before, balance_after, metadata, charge_id, tx_hash, created_at
		FROM frg_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.Pool.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []FRGTransaction
	for rows.Next() {
		var t FRGTransaction
		if err := rows.Scan(&t.ID, &t.UserID, &t.Type, &t.Amount, &t.BalanceBefore, &t.BalanceAfter, &t.Metadata, &t.ChargeID, &t.TxHash, &t.CreatedAt); err != nil {
			return nil, err
		}
		txs = append(txs, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return txs, nil
}

func (r *FRGRepo) TransactionExistsByChargeID(ctx context.Context, chargeID string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM frg_transactions WHERE charge_id = $1)`
	err := r.db.Pool.QueryRow(ctx, query, chargeID).Scan(&exists)
	return exists, err
}

func (r *FRGRepo) CreditWithIdempotency(ctx context.Context, userID int64, amount float64, txType string, metadata []byte, chargeID string) (*FRGTransaction, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	h := fnv.New64a()
	h.Write([]byte("frg:" + chargeID))
	lockID := int64(h.Sum64())
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, lockID); err != nil {
		return nil, err
	}

	var exists bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM frg_transactions WHERE charge_id = $1)`, chargeID).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("transaction with charge id %s already processed", chargeID)
	}

	queryInsert := `INSERT INTO user_stats (user_id, days_active, current_streak, total_taps, xp, level, last_active_at, energy, energy_updated_at, airdrop_coins)
		VALUES ($1, 1, 1, 0, 0, 1, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP, 0.0)
		ON CONFLICT (user_id) DO NOTHING`
	_, err = tx.Exec(ctx, queryInsert, userID)
	if err != nil {
		return nil, err
	}

	var balanceBefore float64
	err = tx.QueryRow(ctx, `SELECT COALESCE(airdrop_coins, 0) FROM user_stats WHERE user_id = $1 FOR UPDATE`, userID).Scan(&balanceBefore)
	if err != nil {
		return nil, err
	}

	balanceAfter := balanceBefore + amount

	_, err = tx.Exec(ctx,
		`UPDATE user_stats SET airdrop_coins = $1 WHERE user_id = $2`,
		balanceAfter, userID,
	)
	if err != nil {
		return nil, err
	}

	var t FRGTransaction
	err = tx.QueryRow(ctx,
		`INSERT INTO frg_transactions (user_id, type, amount, balance_before, balance_after, metadata, charge_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at`,
		userID, txType, amount, balanceBefore, balanceAfter, metadata, chargeID,
	).Scan(&t.ID, &t.CreatedAt)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
			return nil, fmt.Errorf("transaction with charge id %s already processed", chargeID)
		}
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
	t.ChargeID = &chargeID
	return &t, nil
}

func (r *FRGRepo) CreditWithToncoinIdempotency(ctx context.Context, userID int64, amount float64, txType string, metadata []byte, txHash string) (*FRGTransaction, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	h := fnv.New64a()
	h.Write([]byte("frg:" + txHash))
	lockID := int64(h.Sum64())
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, lockID); err != nil {
		return nil, err
	}

	var exists bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM frg_transactions WHERE tx_hash = $1)`, txHash).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("transaction with tx hash %s already processed", txHash)
	}

	queryInsert := `INSERT INTO user_stats (user_id, days_active, current_streak, total_taps, xp, level, last_active_at, energy, energy_updated_at, airdrop_coins)
		VALUES ($1, 1, 1, 0, 0, 1, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP, 0.0)
		ON CONFLICT (user_id) DO NOTHING`
	_, err = tx.Exec(ctx, queryInsert, userID)
	if err != nil {
		return nil, err
	}

	var balanceBefore float64
	err = tx.QueryRow(ctx, `SELECT COALESCE(airdrop_coins, 0) FROM user_stats WHERE user_id = $1 FOR UPDATE`, userID).Scan(&balanceBefore)
	if err != nil {
		return nil, err
	}

	balanceAfter := balanceBefore + amount

	_, err = tx.Exec(ctx,
		`UPDATE user_stats SET airdrop_coins = $1 WHERE user_id = $2`,
		balanceAfter, userID,
	)
	if err != nil {
		return nil, err
	}

	var t FRGTransaction
	err = tx.QueryRow(ctx,
		`INSERT INTO frg_transactions (user_id, type, amount, balance_before, balance_after, metadata, tx_hash)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at`,
		userID, txType, amount, balanceBefore, balanceAfter, metadata, txHash,
	).Scan(&t.ID, &t.CreatedAt)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
			return nil, fmt.Errorf("transaction with tx hash %s already processed", txHash)
		}
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
	t.TxHash = &txHash
	return &t, nil
}
