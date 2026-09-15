package repository

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"

	"ifragment-backend/internal/model"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type ManagedBot = model.ManagedBot

type BotRepo struct {
	db *Database
}

func NewBotRepo(db *Database) *BotRepo {
	return &BotRepo{db: db}
}

func (r *BotRepo) GetActiveBotEncryptedToken(ctx context.Context) ([]byte, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}
	var encryptedToken []byte
	err := r.db.Pool.QueryRow(ctx, "SELECT bot_token_encrypted FROM managed_bots WHERE status = 'active' LIMIT 1").Scan(&encryptedToken)
	return encryptedToken, err
}

func (r *BotRepo) DB() *Database {
	return r.db
}

func (r *BotRepo) GetMainBot(ctx context.Context) (*ManagedBot, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	token := strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN"))
	if token == "" {
		token = strings.TrimSpace(os.Getenv("BOT_TOKEN"))
	}
	if token == "" {
		return nil, fmt.Errorf("main bot token not configured")
	}

	if strings.HasPrefix(strings.ToLower(token), "bot") {
		token = token[3:]
	}

	parts := strings.SplitN(token, ":", 2)
	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid main bot token: missing colon")
	}

	idStr := strings.TrimSpace(parts[0])
	if idStr == "" || strings.TrimSpace(parts[1]) == "" {
		return nil, fmt.Errorf("invalid main bot token: empty id or secret")
	}

	botID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid main bot id format: %w", err)
	}

	if botID <= 0 {
		return nil, fmt.Errorf("invalid main bot id: must be positive")
	}

	query := `SELECT id, owner_user_id, bot_username, bot_name, bot_id, status, created_at, updated_at, webhook_secret_token, bot_token_encrypted
		FROM managed_bots WHERE bot_id = $1 LIMIT 1`

	var bot ManagedBot
	err = r.db.Pool.QueryRow(ctx, query, botID).Scan(
		&bot.ID, &bot.OwnerUserID, &bot.BotUsername, &bot.BotName, &bot.BotID, &bot.Status, &bot.CreatedAt, &bot.UpdatedAt, &bot.WebhookSecretToken, &bot.BotTokenEncrypted,
	)
	if err != nil {
		return nil, fmt.Errorf("main bot not found in db: %w", err)
	}

	return &bot, nil
}

func (r *BotRepo) CreateBot(ctx context.Context, bot *ManagedBot) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("no database connection")
	}

	query := `INSERT INTO managed_bots (owner_user_id, bot_token_encrypted, bot_username, bot_name, bot_id, status, webhook_secret_token)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (bot_id) DO UPDATE SET
			owner_user_id = EXCLUDED.owner_user_id,
			bot_token_encrypted = EXCLUDED.bot_token_encrypted,
			bot_username = EXCLUDED.bot_username,
			bot_name = EXCLUDED.bot_name,
			status = 'active',
			webhook_secret_token = EXCLUDED.webhook_secret_token,
			updated_at = now()
		RETURNING id, created_at, updated_at`
	return r.db.Pool.QueryRow(ctx, query,
		bot.OwnerUserID, bot.BotTokenEncrypted, bot.BotUsername, bot.BotName, bot.BotID, bot.Status, bot.WebhookSecretToken,
	).Scan(&bot.ID, &bot.CreatedAt, &bot.UpdatedAt)
}

func (r *BotRepo) GetBotsByOwner(ctx context.Context, ownerID int64) ([]ManagedBot, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	query := `SELECT b.id, b.owner_user_id, b.bot_username, b.bot_name, b.bot_id, b.status, b.created_at, b.updated_at, b.webhook_secret_token,
		       'active' as subscription_status
		FROM managed_bots b
		WHERE b.owner_user_id = $1
		ORDER BY b.created_at DESC`
	rows, err := r.db.Pool.Query(ctx, query, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bots []ManagedBot
	for rows.Next() {
		var b ManagedBot
		if err := rows.Scan(
			&b.ID, &b.OwnerUserID, &b.BotUsername, &b.BotName, &b.BotID, &b.Status, &b.CreatedAt, &b.UpdatedAt, &b.WebhookSecretToken,
			&b.SubscriptionStatus,
		); err != nil {
			return nil, err
		}
		bots = append(bots, b)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return bots, nil
}

func (r *BotRepo) GetBotByID(ctx context.Context, id uuid.UUID) (*ManagedBot, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	query := `SELECT b.id, b.owner_user_id, b.bot_token_encrypted, b.bot_username, b.bot_name, b.bot_id, b.status, b.created_at, b.updated_at, b.webhook_secret_token,
		       'active' as subscription_status
		FROM managed_bots b
		WHERE b.id = $1`
	var b ManagedBot
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&b.ID, &b.OwnerUserID, &b.BotTokenEncrypted, &b.BotUsername, &b.BotName, &b.BotID, &b.Status, &b.CreatedAt, &b.UpdatedAt, &b.WebhookSecretToken,
		&b.SubscriptionStatus,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("bot not found")
	}
	return &b, err
}

func (r *BotRepo) UpdateBotStatus(ctx context.Context, id uuid.UUID, status string) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("no database connection")
	}

	query := `UPDATE managed_bots SET status = $1, updated_at = now() WHERE id = $2`
	_, err := r.db.Pool.Exec(ctx, query, status, id)
	return err
}

func (r *BotRepo) DeleteBot(ctx context.Context, id uuid.UUID) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("no database connection")
	}

	query := `DELETE FROM managed_bots WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}
