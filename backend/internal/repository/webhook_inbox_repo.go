package repository

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
)

// WebhookInboxRecord represents an incoming Telegram webhook update row.
type WebhookInboxRecord struct {
	ID             uuid.UUID  `json:"id"`
	BotID          uuid.UUID  `json:"bot_id"`
	UpdateID       int64      `json:"update_id"`
	ChatID         *int64     `json:"chat_id,omitempty"`
	PayloadHash    string     `json:"payload_hash"`
	Payload        []byte     `json:"payload"`
	Status         string     `json:"status"`
	Attempts       int        `json:"attempts"`
	MaxAttempts    int        `json:"max_attempts"`
	LeaseExpiresAt *time.Time `json:"lease_expires_at,omitempty"`
	LastError      *string    `json:"last_error,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type WebhookInboxRepo struct {
	db *Database
}

func NewWebhookInboxRepo(db *Database) *WebhookInboxRepo {
	return &WebhookInboxRepo{db: db}
}

// RecordIncoming atomically records an incoming Telegram update, establishing a processing lease.
// It returns isDuplicate=true if the update has already been processed, is currently being processed
// by an active lease, or has reached DLQ status.
func (r *WebhookInboxRepo) RecordIncoming(
	ctx context.Context,
	botID uuid.UUID,
	updateID int64,
	chatID int64,
	payloadHash string,
	payload []byte,
) (isDuplicate bool, err error) {
	if r.db == nil || r.db.Pool == nil {
		// Graceful degradation in environments without a database pool
		return false, nil
	}

	query := `
		INSERT INTO telegram_webhook_inbox (
			bot_id, update_id, chat_id, payload_hash, payload, status, attempts, lease_expires_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5::jsonb, 'processing', 1, NOW() + INTERVAL '5 minutes', NOW()
		)
		ON CONFLICT (bot_id, update_id) DO UPDATE SET
			attempts = CASE 
				WHEN telegram_webhook_inbox.status = 'processed' THEN telegram_webhook_inbox.attempts
				WHEN telegram_webhook_inbox.status = 'processing' AND telegram_webhook_inbox.lease_expires_at > NOW() THEN telegram_webhook_inbox.attempts
				WHEN telegram_webhook_inbox.status = 'dlq' THEN telegram_webhook_inbox.attempts
				ELSE telegram_webhook_inbox.attempts + 1
			END,
			status = CASE 
				WHEN telegram_webhook_inbox.status = 'processed' THEN 'processed'
				WHEN telegram_webhook_inbox.status = 'processing' AND telegram_webhook_inbox.lease_expires_at > NOW() THEN 'processing'
				WHEN telegram_webhook_inbox.status = 'dlq' THEN 'dlq'
				WHEN telegram_webhook_inbox.attempts + 1 > telegram_webhook_inbox.max_attempts THEN 'dlq'
				ELSE 'processing'
			END,
			lease_expires_at = CASE 
				WHEN telegram_webhook_inbox.status = 'processed' THEN NULL
				WHEN telegram_webhook_inbox.status = 'processing' AND telegram_webhook_inbox.lease_expires_at > NOW() THEN telegram_webhook_inbox.lease_expires_at
				WHEN telegram_webhook_inbox.status = 'dlq' THEN NULL
				WHEN telegram_webhook_inbox.attempts + 1 > telegram_webhook_inbox.max_attempts THEN NULL
				ELSE NOW() + INTERVAL '5 minutes'
			END,
			updated_at = NOW()
		RETURNING status, attempts, (xmax = 0) AS inserted;
	`

	var chatIDParam interface{}
	if chatID != 0 {
		chatIDParam = chatID
	}

	var status string
	var attempts int
	var inserted bool

	err = r.db.Pool.QueryRow(ctx, query, botID, updateID, chatIDParam, payloadHash, payload).Scan(&status, &attempts, &inserted)
	if err != nil {
		return false, fmt.Errorf("failed to record webhook inbox update: %w", err)
	}

	if inserted {
		return false, nil
	}

	// If not inserted, check whether we reacquired a processing lease or it is a duplicate
	if status == "processed" || status == "dlq" {
		return true, nil
	}

	// If status is 'processing', it's a duplicate ONLY if attempts was not incremented
	// (i.e. existing lease was still valid)
	if status == "processing" && attempts <= 1 {
		return true, nil
	}

	return false, nil
}

// MarkProcessed transitions the update status to 'processed' and clears the lease.
func (r *WebhookInboxRepo) MarkProcessed(ctx context.Context, botID uuid.UUID, updateID int64) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	query := `
		UPDATE telegram_webhook_inbox
		SET status = 'processed', lease_expires_at = NULL, updated_at = NOW()
		WHERE bot_id = $1 AND update_id = $2;
	`
	_, err := r.db.Pool.Exec(ctx, query, botID, updateID)
	if err != nil {
		slog.Warn("Failed to mark webhook inbox as processed", "bot_id", botID, "update_id", updateID, "error", err)
	}
	return err
}

// MarkFailedOrDLQ updates the record on failure, moving to DLQ if max attempts reached.
func (r *WebhookInboxRepo) MarkFailedOrDLQ(ctx context.Context, botID uuid.UUID, updateID int64, lastErr string) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	query := `
		UPDATE telegram_webhook_inbox
		SET status = CASE WHEN attempts >= max_attempts THEN 'dlq' ELSE 'failed' END,
		    last_error = $3,
		    updated_at = NOW()
		WHERE bot_id = $1 AND update_id = $2;
	`
	_, err := r.db.Pool.Exec(ctx, query, botID, updateID, lastErr)
	if err != nil {
		slog.Warn("Failed to mark webhook inbox as failed/dlq", "bot_id", botID, "update_id", updateID, "error", err)
	}
	return err
}
