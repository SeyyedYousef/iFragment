package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type ManagedChannel struct {
	ID                 uuid.UUID  `json:"id"`
	BotID              uuid.UUID  `json:"bot_id"`
	ChatID             int64      `json:"chat_id"`
	ChatTitle          string     `json:"chat_title"`
	SubscribersCount   int        `json:"subscribers_count"`
	SubscriptionStatus string     `json:"subscription_status"`
	TrialEndsAt        time.Time  `json:"trial_ends_at"`
	PaidUntil          *time.Time `json:"paid_until,omitempty"`
	LinkedChatID       *int64     `json:"linked_chat_id,omitempty"`
	SlowModeDelay      int        `json:"slow_mode_delay"`
	AutoDeleteTime     int        `json:"auto_delete_time"`
	SignMessages       bool       `json:"sign_messages"`
	ProtectContent     bool       `json:"protect_content"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type ChannelSettings struct {
	ChannelID     uuid.UUID       `json:"channel_id"`
	General       json.RawMessage `json:"general"`
	Posting       json.RawMessage `json:"posting"`
	Forwarding    json.RawMessage `json:"forwarding"`
	InlineButtons json.RawMessage `json:"inline_buttons"`
	DynamicBio    json.RawMessage `json:"dynamic_bio"`
	AutoResponder json.RawMessage `json:"auto_responder"`
	Version       int             `json:"version"`
	UpdatedAt     time.Time       `json:"updated_at"`
	UpdatedBy     *int64          `json:"updated_by,omitempty"`
}

type ChannelPost struct {
	ID                 uuid.UUID  `json:"id"`
	ChannelID          uuid.UUID  `json:"channel_id"`
	TelegramMessageID  int64      `json:"telegram_message_id"`
	AuthorUserID       *int64     `json:"author_user_id,omitempty"`
	Text               string     `json:"text"`
	HasMedia           bool       `json:"has_media"`
	ViewsCount         int        `json:"views_count"`
	ReactionsCount     int        `json:"reactions_count"`
	ForwardsCount      int        `json:"forwards_count"`
	IsPinned           bool       `json:"is_pinned"`
	ScheduledAt        *time.Time `json:"scheduled_at,omitempty"`
	PostedAt           *time.Time `json:"posted_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}

type ChannelRepo struct {
	db    *Database
	cache *Cache
}

func NewChannelRepo(db *Database, cache *Cache) *ChannelRepo {
	return &ChannelRepo{db: db, cache: cache}
}

func (r *ChannelRepo) CreateChannel(ctx context.Context, ch *ManagedChannel) error {
	if r.db == nil || r.db.Pool == nil {
		ch.ID = uuid.New()
		ch.CreatedAt = time.Now()
		ch.UpdatedAt = time.Now()
		return nil
	}

	query := `INSERT INTO managed_channels (bot_id, chat_id, chat_title, subscribers_count, subscription_status, trial_ends_at, linked_chat_id, slow_mode_delay, auto_delete_time, sign_messages, protect_content)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (bot_id, chat_id) DO UPDATE SET chat_title = EXCLUDED.chat_title, subscribers_count = EXCLUDED.subscribers_count, updated_at = now()
		RETURNING id, created_at, updated_at, trial_ends_at`
	
	return r.db.Pool.QueryRow(ctx, query,
		ch.BotID, ch.ChatID, ch.ChatTitle, ch.SubscribersCount, ch.SubscriptionStatus, ch.TrialEndsAt,
		ch.LinkedChatID, ch.SlowModeDelay, ch.AutoDeleteTime, ch.SignMessages, ch.ProtectContent,
	).Scan(&ch.ID, &ch.CreatedAt, &ch.UpdatedAt, &ch.TrialEndsAt)
}

func (r *ChannelRepo) GetChannelsByBot(ctx context.Context, botID uuid.UUID) ([]ManagedChannel, error) {
	if r.db == nil || r.db.Pool == nil {
		pu := time.Now().Add(30 * 24 * time.Hour)
		return []ManagedChannel{
			{
				ID:                 uuid.New(),
				BotID:              botID,
				ChatID:             -100222222,
				ChatTitle:          "Mock Channel",
				SubscribersCount:   1000,
				SubscriptionStatus: "trial",
				TrialEndsAt:        time.Now().Add(72 * time.Hour),
				PaidUntil:          &pu,
				CreatedAt:          time.Now(),
				UpdatedAt:          time.Now(),
			},
		}, nil
	}

	query := `SELECT id, bot_id, chat_id, chat_title, subscribers_count, subscription_status, trial_ends_at, paid_until, linked_chat_id, slow_mode_delay, auto_delete_time, sign_messages, protect_content, created_at, updated_at
		FROM managed_channels WHERE bot_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`
	
	rows, err := r.db.Pool.Query(ctx, query, botID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []ManagedChannel
	for rows.Next() {
		var c ManagedChannel
		if err := rows.Scan(
			&c.ID, &c.BotID, &c.ChatID, &c.ChatTitle, &c.SubscribersCount, &c.SubscriptionStatus, &c.TrialEndsAt,
			&c.PaidUntil, &c.LinkedChatID, &c.SlowModeDelay, &c.AutoDeleteTime, &c.SignMessages, &c.ProtectContent,
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		channels = append(channels, c)
	}
	return channels, nil
}

func (r *ChannelRepo) GetChannelsByOwner(ctx context.Context, ownerUserID int64) ([]ManagedChannel, error) {
	if r.db == nil || r.db.Pool == nil {
		return []ManagedChannel{}, nil
	}

	query := `SELECT c.id, c.bot_id, c.chat_id, c.chat_title, c.subscribers_count, c.subscription_status, c.trial_ends_at, c.paid_until, c.linked_chat_id, c.slow_mode_delay, c.auto_delete_time, c.sign_messages, c.protect_content, c.created_at, c.updated_at
		FROM managed_channels c
		JOIN managed_bots b ON c.bot_id = b.id
		WHERE b.owner_user_id = $1 AND c.deleted_at IS NULL ORDER BY c.created_at DESC`
	
	rows, err := r.db.Pool.Query(ctx, query, ownerUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []ManagedChannel
	for rows.Next() {
		var c ManagedChannel
		if err := rows.Scan(
			&c.ID, &c.BotID, &c.ChatID, &c.ChatTitle, &c.SubscribersCount, &c.SubscriptionStatus, &c.TrialEndsAt,
			&c.PaidUntil, &c.LinkedChatID, &c.SlowModeDelay, &c.AutoDeleteTime, &c.SignMessages, &c.ProtectContent,
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		channels = append(channels, c)
	}
	return channels, nil
}

func (r *ChannelRepo) GetChannelByID(ctx context.Context, id uuid.UUID) (*ManagedChannel, error) {
	if r.db == nil || r.db.Pool == nil {
		return &ManagedChannel{
			ID:                 id,
			BotID:              uuid.New(),
			ChatID:             -100222222,
			ChatTitle:          "Mock Channel",
			SubscribersCount:   1000,
			SubscriptionStatus: "trial",
			TrialEndsAt:        time.Now().Add(72 * time.Hour),
			CreatedAt:          time.Now(),
			UpdatedAt:          time.Now(),
		}, nil
	}

	query := `SELECT id, bot_id, chat_id, chat_title, subscribers_count, subscription_status, trial_ends_at, paid_until, linked_chat_id, slow_mode_delay, auto_delete_time, sign_messages, protect_content, created_at, updated_at
		FROM managed_channels WHERE id = $1 AND deleted_at IS NULL`
	
	var c ManagedChannel
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&c.ID, &c.BotID, &c.ChatID, &c.ChatTitle, &c.SubscribersCount, &c.SubscriptionStatus, &c.TrialEndsAt,
		&c.PaidUntil, &c.LinkedChatID, &c.SlowModeDelay, &c.AutoDeleteTime, &c.SignMessages, &c.ProtectContent,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("channel not found")
	}
	return &c, err
}

func (r *ChannelRepo) GetChannelByChatID(ctx context.Context, chatID int64) (*ManagedChannel, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	query := `SELECT id, bot_id, chat_id, chat_title, subscribers_count, subscription_status, trial_ends_at, paid_until, linked_chat_id, slow_mode_delay, auto_delete_time, sign_messages, protect_content, created_at, updated_at
		FROM managed_channels WHERE chat_id = $1 AND deleted_at IS NULL`
	
	var c ManagedChannel
	err := r.db.Pool.QueryRow(ctx, query, chatID).Scan(
		&c.ID, &c.BotID, &c.ChatID, &c.ChatTitle, &c.SubscribersCount, &c.SubscriptionStatus, &c.TrialEndsAt,
		&c.PaidUntil, &c.LinkedChatID, &c.SlowModeDelay, &c.AutoDeleteTime, &c.SignMessages, &c.ProtectContent,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("channel not found")
	}
	return &c, err
}

func (r *ChannelRepo) DeleteChannel(ctx context.Context, id uuid.UUID) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}
	query := `UPDATE managed_channels SET deleted_at = now() WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

// Channel Settings (JSONB columns)

func (r *ChannelRepo) GetChannelSettings(ctx context.Context, channelID uuid.UUID) (*ChannelSettings, error) {
	if r.db == nil || r.db.Pool == nil {
		empty := json.RawMessage(`{}`)
		return &ChannelSettings{
			ChannelID:     channelID,
			General:       empty,
			Posting:       empty,
			Forwarding:    empty,
			InlineButtons: empty,
			DynamicBio:    empty,
			AutoResponder: empty,
			Version:       1,
			UpdatedAt:     time.Now(),
		}, nil
	}

	// 1. Try cache
	if r.cache != nil && r.cache.Client != nil {
		cacheKey := fmt.Sprintf("channel_settings:%s", channelID.String())
		val, err := r.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var s ChannelSettings
			if json.Unmarshal([]byte(val), &s) == nil {
				return &s, nil
			}
		}
	}

	query := `SELECT channel_id, general, posting, forwarding, inline_buttons, dynamic_bio, auto_responder, version, updated_at, updated_by
		FROM channel_settings WHERE channel_id = $1`
	
	var s ChannelSettings
	err := r.db.Pool.QueryRow(ctx, query, channelID).Scan(
		&s.ChannelID, &s.General, &s.Posting, &s.Forwarding, &s.InlineButtons, &s.DynamicBio, &s.AutoResponder,
		&s.Version, &s.UpdatedAt, &s.UpdatedBy,
	)
	if err == pgx.ErrNoRows {
		return r.InitChannelSettings(ctx, channelID)
	}

	if err == nil && r.cache != nil {
		cacheKey := fmt.Sprintf("channel_settings:%s", channelID.String())
		data, _ := json.Marshal(s)
		r.cache.Client.Set(ctx, cacheKey, data, 1*time.Hour)
	}

	return &s, err
}

func (r *ChannelRepo) InitChannelSettings(ctx context.Context, channelID uuid.UUID) (*ChannelSettings, error) {
	empty := json.RawMessage(`{}`)
	s := &ChannelSettings{
		ChannelID:     channelID,
		General:       empty,
		Posting:       empty,
		Forwarding:    empty,
		InlineButtons: empty,
		DynamicBio:    empty,
		AutoResponder: empty,
		Version:       1,
	}

	query := `INSERT INTO channel_settings (channel_id, general, posting, forwarding, inline_buttons, dynamic_bio, auto_responder)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (channel_id) DO NOTHING
		RETURNING updated_at`
	
	err := r.db.Pool.QueryRow(ctx, query, channelID, empty, empty, empty, empty, empty, empty).Scan(&s.UpdatedAt)
	if err == pgx.ErrNoRows {
		return r.GetChannelSettings(ctx, channelID)
	}
	return s, err
}

func (r *ChannelRepo) UpdateChannelSettingsCategory(ctx context.Context, channelID uuid.UUID, category string, data json.RawMessage, userID int64, currentVersion int) (*ChannelSettings, error) {
	validCategories := map[string]bool{
		"general": true, "posting": true, "forwarding": true,
		"inline_buttons": true, "dynamic_bio": true, "auto_responder": true,
	}
	if !validCategories[category] {
		return nil, fmt.Errorf("invalid channel settings category: %s", category)
	}

	if r.db == nil || r.db.Pool == nil {
		return r.GetChannelSettings(ctx, channelID)
	}

	query := fmt.Sprintf(`UPDATE channel_settings SET %s = $1, version = version + 1, updated_at = now(), updated_by = $2
		WHERE channel_id = $3 AND version = $4
		RETURNING version, updated_at`, category)

	var version int
	var updatedAt time.Time
	err := r.db.Pool.QueryRow(ctx, query, data, userID, channelID, currentVersion).Scan(&version, &updatedAt)
	if err == pgx.ErrNoRows {
		return nil, ErrOptimisticLockConflict
	}
	if err != nil {
		return nil, err
	}

	if r.cache != nil {
		cacheKey := fmt.Sprintf("channel_settings:%s", channelID.String())
		r.cache.Client.Del(ctx, cacheKey)
	}

	return r.GetChannelSettings(ctx, channelID)
}

func (r *ChannelRepo) GetBotByChannelChatID(ctx context.Context, chatID int64) (*ManagedBot, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	query := `SELECT b.id, b.owner_user_id, b.bot_token_encrypted, b.bot_username, b.bot_name, b.bot_id, b.status, b.created_at, b.updated_at
		FROM managed_bots b
		JOIN managed_channels c ON c.bot_id = b.id
		WHERE c.chat_id = $1`
	
	var b ManagedBot
	err := r.db.Pool.QueryRow(ctx, query, chatID).Scan(
		&b.ID, &b.OwnerUserID, &b.BotTokenEncrypted, &b.BotUsername, &b.BotName, &b.BotID, &b.Status, &b.CreatedAt, &b.UpdatedAt,
	)
	return &b, err
}
