package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrInsufficientIntelCredits = errors.New("insufficient intel credits")
	ErrDuplicateIdempotencyKey  = errors.New("duplicate idempotency key")
)

type IntelCreditRepo struct {
	db *Database
}

func NewIntelCreditRepo(db *Database) *IntelCreditRepo {
	return &IntelCreditRepo{db: db}
}

type IntelCreditBalance struct {
	Balance    int        `json:"balance"`
	NextExpiry *time.Time `json:"next_expiry"`
}

type IntelCreditBatch struct {
	ID          uuid.UUID  `json:"id"`
	UserID      int64      `json:"user_id"`
	Kind        string     `json:"kind"`
	Amount      int        `json:"amount"`
	Remaining   int        `json:"remaining"`
	Source      string     `json:"source"`
	ReferenceID *string    `json:"reference_id"`
	ExpiresAt   *time.Time `json:"expires_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

// GetUserBalance calculates the active remaining credit balance and nearest expiration date
func (r *IntelCreditRepo) GetUserBalance(ctx context.Context, userID int64) (*IntelCreditBalance, error) {
	if r.db == nil || r.db.Pool == nil {
		return &IntelCreditBalance{Balance: 0, NextExpiry: nil}, nil
	}

	query := `
		SELECT 
			COALESCE(SUM(remaining), 0) AS total_balance,
			MIN(expires_at) FILTER (WHERE expires_at > now()) AS next_expiry
		FROM intel_credit_batches
		WHERE user_id = $1 AND remaining > 0 AND (expires_at IS NULL OR expires_at > now())`

	var bal IntelCreditBalance
	err := r.db.Pool.QueryRow(ctx, query, userID).Scan(&bal.Balance, &bal.NextExpiry)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user credit balance: %w", err)
	}

	return &bal, nil
}

// ConsumeCreditFIFO performs an atomic FIFO credit deduction with strict row locking and idempotency protection
func (r *IntelCreditRepo) ConsumeCreditFIFO(ctx context.Context, userID int64, reason, entity, idemKey string) (int, error) {
	if r.db == nil || r.db.Pool == nil {
		return 0, fmt.Errorf("database unavailable")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Check idempotency key if provided
	if idemKey != "" {
		var existingID int64
		err := tx.QueryRow(ctx, `SELECT id FROM intel_credit_ledger WHERE idem_key = $1`, idemKey).Scan(&existingID)
		if err == nil {
			// Idempotent duplicate: fetch current balance and return without duplicate deduction
			var bal int
			_ = tx.QueryRow(ctx, `
				SELECT COALESCE(SUM(remaining), 0) FROM intel_credit_batches
				WHERE user_id = $1 AND remaining > 0 AND (expires_at IS NULL OR expires_at > now())
			`, userID).Scan(&bal)
			_ = tx.Commit(ctx)
			return bal, nil
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return 0, fmt.Errorf("idempotency check error: %w", err)
		}
	}

	// 2. Select earliest expiring batch with remaining > 0 FOR UPDATE
	querySelect := `
		WITH target AS (
			SELECT id FROM intel_credit_batches
			WHERE user_id = $1 AND remaining > 0 AND (expires_at IS NULL OR expires_at > now())
			ORDER BY expires_at NULLS LAST, created_at ASC
			LIMIT 1 FOR UPDATE
		)
		UPDATE intel_credit_batches b
		SET remaining = b.remaining - 1
		FROM target
		WHERE b.id = target.id
		RETURNING b.id, b.remaining`

	var batchID uuid.UUID
	var batchRemaining int
	err = tx.QueryRow(ctx, querySelect, userID).Scan(&batchID, &batchRemaining)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrInsufficientIntelCredits
		}
		return 0, fmt.Errorf("failed to deduct intel credit: %w", err)
	}

	// 3. Record entry into ledger
	queryLedger := `
		INSERT INTO intel_credit_ledger (user_id, delta, reason, entity, batch_id, idem_key, created_at)
		VALUES ($1, -1, $2, $3, $4, $5, now())`

	var idemVal *string
	if idemKey != "" {
		idemVal = &idemKey
	}

	_, err = tx.Exec(ctx, queryLedger, userID, reason, entity, batchID, idemVal)
	if err != nil {
		return 0, fmt.Errorf("failed to insert ledger entry: %w", err)
	}

	// 4. Calculate total remaining balance
	var totalRemaining int
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(remaining), 0) FROM intel_credit_batches
		WHERE user_id = $1 AND remaining > 0 AND (expires_at IS NULL OR expires_at > now())
	`, userID).Scan(&totalRemaining)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch updated balance: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("failed to commit credit deduction: %w", err)
	}

	return totalRemaining, nil
}

// GrantCredits adds a new batch of credits to the user's account and logs it to ledger
func (r *IntelCreditRepo) GrantCredits(ctx context.Context, userID int64, kind string, amount int, source, referenceID string, expiresAt *time.Time) (uuid.UUID, error) {
	if r.db == nil || r.db.Pool == nil {
		return uuid.Nil, fmt.Errorf("database unavailable")
	}

	if amount <= 0 {
		return uuid.Nil, fmt.Errorf("credit amount must be positive")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)

	var refVal *string
	if referenceID != "" {
		refVal = &referenceID
	}

	var batchID uuid.UUID
	queryBatch := `
		INSERT INTO intel_credit_batches (user_id, kind, amount, remaining, source, reference_id, expires_at, created_at)
		VALUES ($1, $2, $3, $3, $4, $5, $6, now())
		RETURNING id`

	err = tx.QueryRow(ctx, queryBatch, userID, kind, amount, source, refVal, expiresAt).Scan(&batchID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to create credit batch: %w", err)
	}

	queryLedger := `
		INSERT INTO intel_credit_ledger (user_id, delta, reason, entity, batch_id, created_at)
		VALUES ($1, $2, $3, $4, $5, now())`

	reason := fmt.Sprintf("grant:%s", source)
	_, err = tx.Exec(ctx, queryLedger, userID, amount, reason, referenceID, batchID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to log grant ledger: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return uuid.Nil, err
	}

	return batchID, nil
}

// RefundCredit refunds 1 consumed credit back to the earliest active batch or creates a refund batch
func (r *IntelCreditRepo) RefundCredit(ctx context.Context, userID int64, reason, entity string) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database unavailable")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Add 1 back to the latest batch for this user, or insert a refund batch
	var batchID uuid.UUID
	err = tx.QueryRow(ctx, `
		SELECT id FROM intel_credit_batches
		WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > now())
		ORDER BY created_at DESC LIMIT 1
	`, userID).Scan(&batchID)

	if err == nil {
		_, _ = tx.Exec(ctx, `UPDATE intel_credit_batches SET remaining = remaining + 1 WHERE id = $1`, batchID)
	} else {
		err = tx.QueryRow(ctx, `
			INSERT INTO intel_credit_batches (user_id, kind, amount, remaining, source, created_at)
			VALUES ($1, 'intel_report', 1, 1, 'refund', now())
			RETURNING id
		`, userID).Scan(&batchID)
		if err != nil {
			return err
		}
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO intel_credit_ledger (user_id, delta, reason, entity, batch_id, created_at)
		VALUES ($1, 1, $2, $3, $4, now())
	`, userID, "refund:"+reason, entity, batchID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// DB exposes the underlying database handle for cross-ledger operations.
func (r *IntelCreditRepo) DB() *Database { return r.db }

// ErrInsufficientCoins is returned when the Airdrop coin balance cannot cover an exchange.
var ErrInsufficientCoins = errors.New("insufficient airdrop coins")

// ExchangeCoinsForCredit atomically deducts Airdrop Coins and grants exactly one
// purchased Intel Credit batch inside a single transaction. Returns the new credit balance.
func (r *IntelCreditRepo) ExchangeCoinsForCredit(ctx context.Context, userID int64, coinsCost float64, expiresAt *time.Time) (int, error) {
	if r.db == nil || r.db.Pool == nil {
		return 0, fmt.Errorf("database unavailable")
	}
	if coinsCost <= 0 {
		return 0, fmt.Errorf("coin cost must be positive")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Deduct Airdrop Coins (FIFO across user_credit_batches)
	if err := r.db.DeductCreditsFIFO(ctx, tx, userID, coinsCost); err != nil {
		if strings.Contains(err.Error(), "insufficient active credits") {
			return 0, ErrInsufficientCoins
		}
		return 0, fmt.Errorf("failed to deduct coins: %w", err)
	}

	// 2. Grant exactly one purchased credit batch
	var batchID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO intel_credit_batches (user_id, kind, amount, remaining, source, expires_at, created_at)
		VALUES ($1, 'purchased', 1, 1, 'coins_exchange', $2, now())
		RETURNING id
	`, userID, expiresAt).Scan(&batchID)
	if err != nil {
		return 0, fmt.Errorf("failed to create credit batch: %w", err)
	}

	// 3. Ledger entry
	_, err = tx.Exec(ctx, `
		INSERT INTO intel_credit_ledger (user_id, delta, reason, entity, batch_id, created_at)
		VALUES ($1, 1, 'grant:coins_exchange', 'coins_exchange', $2, now())
	`, userID, batchID)
	if err != nil {
		return 0, fmt.Errorf("failed to log exchange ledger: %w", err)
	}

	// 4. New balance
	var bal int
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(remaining), 0) FROM intel_credit_batches
		WHERE user_id = $1 AND remaining > 0 AND (expires_at IS NULL OR expires_at > now())
	`, userID).Scan(&bal)
	if err != nil {
		return 0, fmt.Errorf("failed to compute balance: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return bal, nil
}

// GrantPackOnce grants a pack of credits exactly once per reference ID (Telegram charge ID).
// Returns false when the reference was already fulfilled (idempotent duplicate delivery).
func (r *IntelCreditRepo) GrantPackOnce(ctx context.Context, userID int64, credits int, source, referenceID string, expiresAt *time.Time) (bool, error) {
	if r.db == nil || r.db.Pool == nil {
		return false, fmt.Errorf("database unavailable")
	}
	if credits <= 0 || referenceID == "" {
		return false, fmt.Errorf("credits and reference ID are required")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Idempotency guard on the charge reference
	var exists int
	err = tx.QueryRow(ctx, `
		SELECT COUNT(*) FROM intel_credit_ledger
		WHERE user_id = $1 AND reason = 'grant:stars_pack' AND entity = $2
	`, userID, referenceID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("idempotency check failed: %w", err)
	}
	if exists > 0 {
		return false, nil
	}

	// 2. Grant the batch
	var refVal *string
	refVal = &referenceID
	var batchID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO intel_credit_batches (user_id, kind, amount, remaining, source, reference_id, expires_at, created_at)
		VALUES ($1, 'purchased', $2, $2, $3, $4, $5, now())
		RETURNING id
	`, userID, credits, source, refVal, expiresAt).Scan(&batchID)
	if err != nil {
		return false, fmt.Errorf("failed to create credit batch: %w", err)
	}

	// 3. Ledger entry
	_, err = tx.Exec(ctx, `
		INSERT INTO intel_credit_ledger (user_id, delta, reason, entity, batch_id, created_at)
		VALUES ($1, $2, 'grant:stars_pack', $3, $4, now())
	`, userID, credits, referenceID, batchID)
	if err != nil {
		return false, fmt.Errorf("failed to log grant ledger: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}
