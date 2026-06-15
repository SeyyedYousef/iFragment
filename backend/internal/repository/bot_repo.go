package repository

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type ManagedBot struct {
	ID                 uuid.UUID `json:"id"`
	OwnerUserID        int64     `json:"owner_user_id"`
	BotTokenEncrypted  []byte    `json:"-"`
	BotUsername        string    `json:"bot_username"`
	BotName            string    `json:"bot_name"`
	BotID              int64     `json:"bot_id"`
	Status             string    `json:"status"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
	ManagedGroupsCount int       `json:"managed_groups_count"`
	SubscriptionStatus string    `json:"subscription_status"`
	WebhookSecretToken string    `json:"webhook_secret_token"`
}

type BillingSubscription struct {
	ID          uuid.UUID
	UserID      int64
	GroupID     uuid.UUID
	PackageID   string
	GroupsLimit int
	AmountFRG   float64
	Period      string
	Status      string
	StartsAt    time.Time
	ExpiresAt   time.Time
}

type ManagedGroup struct {
	ID                 uuid.UUID  `json:"id"`
	BotID              uuid.UUID  `json:"bot_id"`
	ChatID             int64      `json:"chat_id"`
	ChatTitle          string     `json:"chat_title"`
	ChatType           string     `json:"chat_type"`
	MembersCount       int        `json:"members_count"`
	SubscriptionStatus string     `json:"subscription_status"`
	TrialEndsAt        time.Time  `json:"trial_ends_at"`
	PaidUntil          *time.Time `json:"paid_until,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type BotRepo struct {
	db *Database
}

func NewBotRepo(db *Database) *BotRepo {
	return &BotRepo{db: db}
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
		       COALESCE(mg.groups_count, 0) as managed_groups_count,
		       COALESCE(sub.subscription_status, 'free') as subscription_status
		FROM managed_bots b
		LEFT JOIN LATERAL (
			SELECT COUNT(*) as groups_count FROM managed_groups g WHERE g.bot_id = b.id
		) mg ON true
		LEFT JOIN LATERAL (
			SELECT COALESCE(
				(SELECT bs.package_id FROM billing_subscriptions bs
				 JOIN managed_groups g ON bs.group_id = g.id
				 WHERE g.bot_id = b.id AND bs.status = 'active'
				 ORDER BY CASE bs.package_id
					 WHEN 'business' THEN 4
					 WHEN 'pro' THEN 3
					 WHEN 'basic' THEN 2
					 WHEN 'starter' THEN 1
					 ELSE 0
				 END DESC LIMIT 1),
				(SELECT g.subscription_status FROM managed_groups g 
				 WHERE g.bot_id = b.id AND g.subscription_status = 'trial' 
				 LIMIT 1)
			) as subscription_status
		) sub ON true
		WHERE b.owner_user_id = $1 ORDER BY b.created_at DESC`
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
			&b.ManagedGroupsCount, &b.SubscriptionStatus,
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
		       COALESCE(mg.groups_count, 0) as managed_groups_count,
		       COALESCE(sub.subscription_status, 'free') as subscription_status
		FROM managed_bots b
		LEFT JOIN LATERAL (
			SELECT COUNT(*) as groups_count FROM managed_groups g WHERE g.bot_id = b.id
		) mg ON true
		LEFT JOIN LATERAL (
			SELECT COALESCE(
				(SELECT bs.package_id FROM billing_subscriptions bs
				 JOIN managed_groups g ON bs.group_id = g.id
				 WHERE g.bot_id = b.id AND bs.status = 'active'
				 ORDER BY CASE bs.package_id
					 WHEN 'business' THEN 4
					 WHEN 'pro' THEN 3
					 WHEN 'basic' THEN 2
					 WHEN 'starter' THEN 1
					 ELSE 0
				 END DESC LIMIT 1),
				(SELECT g.subscription_status FROM managed_groups g 
				 WHERE g.bot_id = b.id AND g.subscription_status = 'trial' 
				 LIMIT 1)
			) as subscription_status
		) sub ON true
		WHERE b.id = $1`
	var b ManagedBot
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&b.ID, &b.OwnerUserID, &b.BotTokenEncrypted, &b.BotUsername, &b.BotName, &b.BotID, &b.Status, &b.CreatedAt, &b.UpdatedAt, &b.WebhookSecretToken,
		&b.ManagedGroupsCount, &b.SubscriptionStatus,
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

// Groups

func (r *BotRepo) CreateGroup(ctx context.Context, group *ManagedGroup) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("no database connection")
	}

	query := `INSERT INTO managed_groups (bot_id, chat_id, chat_title, chat_type, members_count, subscription_status, trial_ends_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (bot_id, chat_id) DO UPDATE SET chat_title = EXCLUDED.chat_title, members_count = EXCLUDED.members_count, updated_at = now()
		RETURNING id, subscription_status, trial_ends_at, paid_until, created_at, updated_at`
	return r.db.Pool.QueryRow(ctx, query,
		group.BotID, group.ChatID, group.ChatTitle, group.ChatType, group.MembersCount, group.SubscriptionStatus, group.TrialEndsAt,
	).Scan(&group.ID, &group.SubscriptionStatus, &group.TrialEndsAt, &group.PaidUntil, &group.CreatedAt, &group.UpdatedAt)
}

func (r *BotRepo) GetGroupsByBot(ctx context.Context, botID uuid.UUID) ([]ManagedGroup, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	query := `SELECT id, bot_id, chat_id, chat_title, chat_type, members_count, subscription_status, trial_ends_at, paid_until, created_at, updated_at
		FROM managed_groups WHERE bot_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Pool.Query(ctx, query, botID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []ManagedGroup
	for rows.Next() {
		var g ManagedGroup
		if err := rows.Scan(&g.ID, &g.BotID, &g.ChatID, &g.ChatTitle, &g.ChatType, &g.MembersCount,
			&g.SubscriptionStatus, &g.TrialEndsAt, &g.PaidUntil, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return groups, nil
}

func (r *BotRepo) GetGroupByID(ctx context.Context, id uuid.UUID) (*ManagedGroup, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	query := `SELECT id, bot_id, chat_id, chat_title, chat_type, members_count, subscription_status, trial_ends_at, paid_until, created_at, updated_at
		FROM managed_groups WHERE id = $1`
	var g ManagedGroup
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&g.ID, &g.BotID, &g.ChatID, &g.ChatTitle, &g.ChatType, &g.MembersCount,
		&g.SubscriptionStatus, &g.TrialEndsAt, &g.PaidUntil, &g.CreatedAt, &g.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("group not found")
	}
	return &g, err
}

func (r *BotRepo) UpdateGroupSubscription(ctx context.Context, groupID uuid.UUID, status string, paidUntil *time.Time) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("no database connection")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query1 := `UPDATE managed_groups SET subscription_status = $1, paid_until = $2, updated_at = now() WHERE id = $3`
	if _, err := tx.Exec(ctx, query1, status, paidUntil, groupID); err != nil {
		return err
	}

	if status == "expired" {
		query2 := `UPDATE billing_subscriptions SET status = 'expired' WHERE group_id = $1 AND status = 'active'`
		if _, err := tx.Exec(ctx, query2, groupID); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *BotRepo) UpdateGroupSubscriptionTx(ctx context.Context, tx pgx.Tx, groupID uuid.UUID, status string, paidUntil *time.Time) error {
	query1 := `UPDATE managed_groups SET subscription_status = $1, paid_until = $2, updated_at = now() WHERE id = $3`
	if _, err := tx.Exec(ctx, query1, status, paidUntil, groupID); err != nil {
		return err
	}

	if status == "expired" {
		query2 := `UPDATE billing_subscriptions SET status = 'expired' WHERE group_id = $1 AND status = 'active'`
		if _, err := tx.Exec(ctx, query2, groupID); err != nil {
			return err
		}
	}

	return nil
}

func (r *BotRepo) CreateBillingSubscription(ctx context.Context, sub *BillingSubscription) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("no database connection")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Deactivate any existing active subscriptions for this group
	query1 := `UPDATE billing_subscriptions SET status = 'expired' WHERE group_id = $1 AND status = 'active'`
	if _, err := tx.Exec(ctx, query1, sub.GroupID); err != nil {
		return err
	}

	query2 := `
		INSERT INTO billing_subscriptions (user_id, group_id, package_id, groups_limit, amount_frg, period, status, starts_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`
	if err := tx.QueryRow(ctx, query2, sub.UserID, sub.GroupID, sub.PackageID, sub.GroupsLimit, sub.AmountFRG, sub.Period, sub.Status, sub.StartsAt, sub.ExpiresAt).Scan(&sub.ID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *BotRepo) CreateBillingSubscriptionTx(ctx context.Context, tx pgx.Tx, sub *BillingSubscription) error {
	// Deactivate any existing active subscriptions for this group
	query1 := `UPDATE billing_subscriptions SET status = 'expired' WHERE group_id = $1 AND status = 'active'`
	if _, err := tx.Exec(ctx, query1, sub.GroupID); err != nil {
		return err
	}

	query2 := `
		INSERT INTO billing_subscriptions (user_id, group_id, package_id, groups_limit, amount_frg, period, status, starts_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`
	if err := tx.QueryRow(ctx, query2, sub.UserID, sub.GroupID, sub.PackageID, sub.GroupsLimit, sub.AmountFRG, sub.Period, sub.Status, sub.StartsAt, sub.ExpiresAt).Scan(&sub.ID); err != nil {
		return err
	}

	return nil
}

func (r *BotRepo) GetGroup(ctx context.Context, botID uuid.UUID, chatID int64) (*ManagedGroup, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}
	query := `SELECT id, bot_id, chat_id, chat_title, chat_type, members_count, subscription_status, trial_ends_at, paid_until, created_at, updated_at
		FROM managed_groups WHERE bot_id = $1 AND chat_id = $2`
	var g ManagedGroup
	err := r.db.Pool.QueryRow(ctx, query, botID, chatID).Scan(
		&g.ID, &g.BotID, &g.ChatID, &g.ChatTitle, &g.ChatType, &g.MembersCount,
		&g.SubscriptionStatus, &g.TrialEndsAt, &g.PaidUntil, &g.CreatedAt, &g.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("group not found")
	}
	return &g, err
}



func (r *BotRepo) GetAllActiveGroups(ctx context.Context) ([]ManagedGroup, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}
	query := `SELECT id, bot_id, chat_id, chat_title, chat_type, members_count, subscription_status, trial_ends_at, paid_until, created_at, updated_at
		FROM managed_groups`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []ManagedGroup
	for rows.Next() {
		var g ManagedGroup
		err := rows.Scan(
			&g.ID, &g.BotID, &g.ChatID, &g.ChatTitle, &g.ChatType, &g.MembersCount,
			&g.SubscriptionStatus, &g.TrialEndsAt, &g.PaidUntil, &g.CreatedAt, &g.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return groups, nil
}
