package repository

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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
	ConnectedByUserID  *int64     `json:"connected_by_user_id,omitempty"`
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
	ID                uuid.UUID  `json:"id"`
	ChannelID         uuid.UUID  `json:"channel_id"`
	TelegramMessageID int64      `json:"telegram_message_id"`
	AuthorUserID      *int64     `json:"author_user_id,omitempty"`
	Text              string     `json:"text"`
	HasMedia          bool       `json:"has_media"`
	ViewsCount        int        `json:"views_count"`
	ReactionsCount    int        `json:"reactions_count"`
	ForwardsCount     int        `json:"forwards_count"`
	IsPinned          bool       `json:"is_pinned"`
	ScheduledAt       *time.Time `json:"scheduled_at,omitempty"`
	PostedAt          *time.Time `json:"posted_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
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
		return fmt.Errorf("database pool is not initialized")
	}

	query := `INSERT INTO managed_channels (bot_id, chat_id, chat_title, subscribers_count, subscription_status, trial_ends_at, linked_chat_id, slow_mode_delay, auto_delete_time, sign_messages, protect_content, connected_by_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (bot_id, chat_id) DO UPDATE SET chat_title = EXCLUDED.chat_title, subscribers_count = EXCLUDED.subscribers_count, updated_at = now(), deleted_at = NULL
		RETURNING id, created_at, updated_at, trial_ends_at`

	return r.db.Pool.QueryRow(ctx, query,
		ch.BotID, ch.ChatID, ch.ChatTitle, ch.SubscribersCount, ch.SubscriptionStatus, ch.TrialEndsAt,
		ch.LinkedChatID, ch.SlowModeDelay, ch.AutoDeleteTime, ch.SignMessages, ch.ProtectContent, ch.ConnectedByUserID,
	).Scan(&ch.ID, &ch.CreatedAt, &ch.UpdatedAt, &ch.TrialEndsAt)
}

func (r *ChannelRepo) GetChannelsByBot(ctx context.Context, botID uuid.UUID, cursor *time.Time, cursorID *uuid.UUID, limit int) ([]ManagedChannel, *time.Time, *uuid.UUID, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, nil, nil, fmt.Errorf("database pool is not initialized")
	}

	var query string
	var args []interface{}

	if limit <= 0 {
		limit = 20
	}

	if cursor != nil && cursorID != nil {
		query = `SELECT c.id, c.bot_id, c.chat_id, COALESCE(NULLIF(f.project_name, ''), c.chat_title), c.subscribers_count, c.subscription_status, c.trial_ends_at, c.paid_until, c.linked_chat_id, c.slow_mode_delay, c.auto_delete_time, c.sign_messages, c.protect_content, c.connected_by_user_id, c.created_at, c.updated_at
			FROM managed_channels c
			LEFT JOIN channel_funnels f ON f.output_chat_id = c.chat_id AND f.bot_id = c.bot_id
			WHERE c.bot_id = $1 
			AND c.chat_id NOT IN (SELECT input_chat_id FROM channel_funnels WHERE bot_id = $1)
			AND (c.created_at < $2 OR (c.created_at = $2 AND c.id < $3)) 
			ORDER BY c.created_at DESC, c.id DESC LIMIT $4`
		args = []interface{}{botID, *cursor, *cursorID, limit}
	} else {
		query = `SELECT c.id, c.bot_id, c.chat_id, COALESCE(NULLIF(f.project_name, ''), c.chat_title), c.subscribers_count, c.subscription_status, c.trial_ends_at, c.paid_until, c.linked_chat_id, c.slow_mode_delay, c.auto_delete_time, c.sign_messages, c.protect_content, c.connected_by_user_id, c.created_at, c.updated_at
			FROM managed_channels c
			LEFT JOIN channel_funnels f ON f.output_chat_id = c.chat_id AND f.bot_id = c.bot_id
			WHERE c.bot_id = $1 
			AND c.chat_id NOT IN (SELECT input_chat_id FROM channel_funnels WHERE bot_id = $1)
			ORDER BY c.created_at DESC, c.id DESC LIMIT $2`
		args = []interface{}{botID, limit}
	}

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, nil, nil, err
	}
	defer rows.Close()

	var channels []ManagedChannel
	for rows.Next() {
		var c ManagedChannel
		if err := rows.Scan(
			&c.ID, &c.BotID, &c.ChatID, &c.ChatTitle, &c.SubscribersCount, &c.SubscriptionStatus, &c.TrialEndsAt,
			&c.PaidUntil, &c.LinkedChatID, &c.SlowModeDelay, &c.AutoDeleteTime, &c.SignMessages, &c.ProtectContent,
			&c.ConnectedByUserID, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, nil, nil, err
		}
		channels = append(channels, c)
	}

	if err := rows.Err(); err != nil {
		return nil, nil, nil, fmt.Errorf("rows iteration error: %w", err)
	}

	var nextCursor *time.Time
	var nextCursorID *uuid.UUID
	if len(channels) == limit && limit > 0 {
		lastChannel := channels[len(channels)-1]
		nextCursor = &lastChannel.CreatedAt
		nextCursorID = &lastChannel.ID
	}

	return channels, nextCursor, nextCursorID, nil
}

func (r *ChannelRepo) GetChannelsByOwner(ctx context.Context, ownerUserID int64, cursor *time.Time, cursorID *uuid.UUID, limit int) ([]ManagedChannel, *time.Time, *uuid.UUID, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, nil, nil, fmt.Errorf("database pool is not initialized")
	}

	var query string
	var args []interface{}

	if limit <= 0 {
		limit = 20
	}

	if cursor != nil && cursorID != nil {
		query = `SELECT c.id, c.bot_id, c.chat_id, COALESCE(NULLIF(f.project_name, ''), c.chat_title), c.subscribers_count, c.subscription_status, c.trial_ends_at, c.paid_until, c.linked_chat_id, c.slow_mode_delay, c.auto_delete_time, c.sign_messages, c.protect_content, c.connected_by_user_id, c.created_at, c.updated_at
			FROM managed_channels c
			JOIN managed_bots b ON c.bot_id = b.id
			LEFT JOIN channel_funnels f ON f.output_chat_id = c.chat_id AND f.bot_id = c.bot_id
			WHERE (c.connected_by_user_id = $1 OR EXISTS (SELECT 1 FROM channel_admins ca WHERE ca.channel_id = c.id AND ca.telegram_id = $1)) 
			AND c.chat_id NOT IN (SELECT input_chat_id FROM channel_funnels WHERE owner_user_id = $1)
			AND (c.created_at < $2 OR (c.created_at = $2 AND c.id < $3)) 
			ORDER BY c.created_at DESC, c.id DESC LIMIT $4`
		args = []interface{}{ownerUserID, *cursor, *cursorID, limit}
	} else {
		query = `SELECT c.id, c.bot_id, c.chat_id, COALESCE(NULLIF(f.project_name, ''), c.chat_title), c.subscribers_count, c.subscription_status, c.trial_ends_at, c.paid_until, c.linked_chat_id, c.slow_mode_delay, c.auto_delete_time, c.sign_messages, c.protect_content, c.connected_by_user_id, c.created_at, c.updated_at
			FROM managed_channels c
			JOIN managed_bots b ON c.bot_id = b.id
			LEFT JOIN channel_funnels f ON f.output_chat_id = c.chat_id AND f.bot_id = c.bot_id
			WHERE (c.connected_by_user_id = $1 OR EXISTS (SELECT 1 FROM channel_admins ca WHERE ca.channel_id = c.id AND ca.telegram_id = $1))
			AND c.chat_id NOT IN (SELECT input_chat_id FROM channel_funnels WHERE owner_user_id = $1)
			ORDER BY c.created_at DESC, c.id DESC LIMIT $2`
		args = []interface{}{ownerUserID, limit}
	}

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, nil, nil, err
	}
	defer rows.Close()

	var channels []ManagedChannel
	for rows.Next() {
		var c ManagedChannel
		if err := rows.Scan(
			&c.ID, &c.BotID, &c.ChatID, &c.ChatTitle, &c.SubscribersCount, &c.SubscriptionStatus, &c.TrialEndsAt,
			&c.PaidUntil, &c.LinkedChatID, &c.SlowModeDelay, &c.AutoDeleteTime, &c.SignMessages, &c.ProtectContent,
			&c.ConnectedByUserID, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, nil, nil, err
		}
		channels = append(channels, c)
	}

	if err := rows.Err(); err != nil {
		return nil, nil, nil, fmt.Errorf("rows iteration error: %w", err)
	}

	var nextCursor *time.Time
	var nextCursorID *uuid.UUID
	if len(channels) == limit && limit > 0 {
		lastChannel := channels[len(channels)-1]
		nextCursor = &lastChannel.CreatedAt
		nextCursorID = &lastChannel.ID
	}

	return channels, nextCursor, nextCursorID, nil
}

func (r *ChannelRepo) GetChannelByID(ctx context.Context, id uuid.UUID) (*ManagedChannel, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `SELECT id, bot_id, chat_id, chat_title, subscribers_count, subscription_status, trial_ends_at, paid_until, linked_chat_id, slow_mode_delay, auto_delete_time, sign_messages, protect_content, connected_by_user_id, created_at, updated_at
		FROM managed_channels WHERE id = $1`

	var c ManagedChannel
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&c.ID, &c.BotID, &c.ChatID, &c.ChatTitle, &c.SubscribersCount, &c.SubscriptionStatus, &c.TrialEndsAt,
		&c.PaidUntil, &c.LinkedChatID, &c.SlowModeDelay, &c.AutoDeleteTime, &c.SignMessages, &c.ProtectContent,
		&c.ConnectedByUserID, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("channel not found")
		}
		return nil, err
	}
	return &c, nil
}

func (r *ChannelRepo) GetChannelByChatID(ctx context.Context, chatID int64) (*ManagedChannel, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `SELECT id, bot_id, chat_id, chat_title, subscribers_count, subscription_status, trial_ends_at, paid_until, linked_chat_id, slow_mode_delay, auto_delete_time, sign_messages, protect_content, connected_by_user_id, created_at, updated_at
		FROM managed_channels WHERE chat_id = $1`

	var c ManagedChannel
	err := r.db.Pool.QueryRow(ctx, query, chatID).Scan(
		&c.ID, &c.BotID, &c.ChatID, &c.ChatTitle, &c.SubscribersCount, &c.SubscriptionStatus, &c.TrialEndsAt,
		&c.PaidUntil, &c.LinkedChatID, &c.SlowModeDelay, &c.AutoDeleteTime, &c.SignMessages, &c.ProtectContent,
		&c.ConnectedByUserID, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("channel not found")
		}
		return nil, err
	}
	return &c, nil
}

func (r *ChannelRepo) UpdateChannelFlags(ctx context.Context, id uuid.UUID, signMessages bool, protectContent bool) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	query := `UPDATE managed_channels SET sign_messages = $1, protect_content = $2, updated_at = now() WHERE id = $3`
	_, err := r.db.Pool.Exec(ctx, query, signMessages, protectContent, id)
	return err
}

func (r *ChannelRepo) DeleteChannel(ctx context.Context, id uuid.UUID) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	query := `DELETE FROM managed_channels WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

func (r *ChannelRepo) DisconnectChannel(ctx context.Context, id uuid.UUID) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	query := `UPDATE managed_channels SET subscription_status = 'disconnected', updated_at = now() WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

func (r *ChannelRepo) ReconnectChannel(ctx context.Context, id uuid.UUID, botID uuid.UUID, connectedByUserID int64, status string, title string) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	query := `UPDATE managed_channels SET bot_id = $1, connected_by_user_id = $2, subscription_status = $3, chat_title = $4, updated_at = now() WHERE id = $5`
	_, err := r.db.Pool.Exec(ctx, query, botID, connectedByUserID, status, title, id)
	return err
}

// Channel Settings (JSONB columns)

func (r *ChannelRepo) GetChannelSettings(ctx context.Context, channelID uuid.UUID) (*ChannelSettings, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
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
	if err != nil {
		if err == pgx.ErrNoRows {
			return r.InitChannelSettings(ctx, channelID)
		}
		return nil, err
	}

	if r.cache != nil && r.cache.Client != nil {
		cacheKey := fmt.Sprintf("channel_settings:%s", channelID.String())
		data, _ := json.Marshal(s)
		r.cache.Client.Set(ctx, cacheKey, data, 1*time.Hour)
	}

	return &s, nil
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
	if err != nil {
		if err == pgx.ErrNoRows {
			return r.GetChannelSettings(ctx, channelID)
		}
		return nil, err
	}
	return s, nil
}

func (r *ChannelRepo) UpdateChannelSettingsCategory(ctx context.Context, channelID uuid.UUID, category string, data json.RawMessage, userID int64, currentVersion int) (*ChannelSettings, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	var column string
	switch category {
	case "general", "posting", "forwarding", "inline_buttons", "dynamic_bio", "auto_responder":
		column = category
	default:
		return nil, fmt.Errorf("invalid channel settings category: %s", category)
	}

	var query string
	var err error
	var version int
	var updatedAt time.Time

	query = fmt.Sprintf(`UPDATE channel_settings SET %s = $1, version = version + 1, updated_at = now(), updated_by = $2
		WHERE channel_id = $3 AND version = $4
		RETURNING version, updated_at`, column)
	err = r.db.Pool.QueryRow(ctx, query, data, userID, channelID, currentVersion).Scan(&version, &updatedAt)

	if err == pgx.ErrNoRows {
		return nil, ErrOptimisticLockConflict
	}
	if err != nil {
		return nil, err
	}

	if r.cache != nil && r.cache.Client != nil {
		cacheKey := fmt.Sprintf("channel_settings:%s", channelID.String())
		r.cache.Client.Del(ctx, cacheKey)
	}

	return r.GetChannelSettings(ctx, channelID)
}

type ChannelAuditLog struct {
	ID         uuid.UUID       `json:"id"`
	ChannelID  uuid.UUID       `json:"channel_id"`
	ActorID    int64           `json:"actor_id"`
	Action     string          `json:"action"`
	TargetType *string         `json:"target_type,omitempty"`
	TargetID   *string         `json:"target_id,omitempty"`
	OldValue   json.RawMessage `json:"old_value,omitempty"`
	NewValue   json.RawMessage `json:"new_value,omitempty"`
	Metadata   json.RawMessage `json:"metadata,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
}

type ChannelAnalytics struct {
	ID               uuid.UUID `json:"id"`
	ChannelID        uuid.UUID `json:"channel_id"`
	SnapshotDate     time.Time `json:"snapshot_date"`
	SubscribersCount int       `json:"subscribers_count"`
	NewSubscribers   int       `json:"new_subscribers"`
	ViewsCount       int       `json:"views_count"`
	ReactionsCount   int       `json:"reactions_count"`
	PostsCount       int       `json:"posts_count"`
	CreatedAt        time.Time `json:"created_at"`
}

// LogAudit persists an audit log entry for channel events
func (r *ChannelRepo) LogAudit(ctx context.Context, log *ChannelAuditLog) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	query := `INSERT INTO channel_audit_logs (channel_id, actor_id, action, target_type, target_id, old_value, new_value, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`

	return r.db.Pool.QueryRow(ctx, query,
		log.ChannelID, log.ActorID, log.Action, log.TargetType, log.TargetID, log.OldValue, log.NewValue, log.Metadata,
	).Scan(&log.ID, &log.CreatedAt)
}

// GetAuditLogs loads paginated audit logs for a specific channel using high-performance cursor-based pagination
func (r *ChannelRepo) GetAuditLogs(ctx context.Context, channelID uuid.UUID, cursor *time.Time, cursorID *uuid.UUID, limit int) ([]ChannelAuditLog, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	if limit <= 0 {
		limit = 20
	}

	var query string
	var args []interface{}

	if cursor != nil && cursorID != nil {
		query = `SELECT id, channel_id, actor_id, action, target_type, target_id, old_value, new_value, metadata, created_at
			FROM channel_audit_logs 
			WHERE channel_id = $1 AND (created_at < $2 OR (created_at = $2 AND id < $3)) 
			ORDER BY created_at DESC, id DESC LIMIT $4`
		args = []interface{}{channelID, *cursor, *cursorID, limit}
	} else {
		query = `SELECT id, channel_id, actor_id, action, target_type, target_id, old_value, new_value, metadata, created_at
			FROM channel_audit_logs 
			WHERE channel_id = $1 
			ORDER BY created_at DESC, id DESC LIMIT $2`
		args = []interface{}{channelID, limit}
	}

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []ChannelAuditLog
	for rows.Next() {
		var l ChannelAuditLog
		if err := rows.Scan(
			&l.ID, &l.ChannelID, &l.ActorID, &l.Action, &l.TargetType, &l.TargetID, &l.OldValue, &l.NewValue, &l.Metadata, &l.CreatedAt,
		); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}

	return logs, nil
}

// SaveAnalyticsSnapshot inserts or updates a daily analytics snapshot
func (r *ChannelRepo) SaveAnalyticsSnapshot(ctx context.Context, snapshot *ChannelAnalytics) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	query := `INSERT INTO channel_analytics (channel_id, snapshot_date, subscribers_count, new_subscribers, views_count, reactions_count, posts_count)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (channel_id, snapshot_date) DO UPDATE SET
			subscribers_count = EXCLUDED.subscribers_count,
			new_subscribers = EXCLUDED.new_subscribers,
			views_count = EXCLUDED.views_count,
			reactions_count = EXCLUDED.reactions_count,
			posts_count = EXCLUDED.posts_count
		RETURNING id, created_at`

	return r.db.Pool.QueryRow(ctx, query,
		snapshot.ChannelID, snapshot.SnapshotDate.Format("2006-01-02"), snapshot.SubscribersCount, snapshot.NewSubscribers,
		snapshot.ViewsCount, snapshot.ReactionsCount, snapshot.PostsCount,
	).Scan(&snapshot.ID, &snapshot.CreatedAt)
}

// GetAnalyticsTimeline retrieves a history timeline of daily snapshots
// GetDailyPostStats aggregates the total posts, views, and reactions for a channel on a specific date
func (r *ChannelRepo) GetDailyPostStats(ctx context.Context, channelID uuid.UUID, date time.Time) (postsCount int, viewsCount int, reactionsCount int, err error) {
	if r.db == nil || r.db.Pool == nil {
		return 0, 0, 0, fmt.Errorf("database pool is not initialized")
	}

	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	query := `
		SELECT COUNT(id), COALESCE(SUM(views_count), 0), COALESCE(SUM(reactions_count), 0)
		FROM channel_posts
		WHERE channel_id = $1 AND created_at >= $2 AND created_at < $3
	`

	err = r.db.Pool.QueryRow(ctx, query, channelID, startOfDay, endOfDay).Scan(&postsCount, &viewsCount, &reactionsCount)
	if err != nil {
		return 0, 0, 0, err
	}

	return postsCount, viewsCount, reactionsCount, nil
}

// GetTopPosts retrieves the most viewed posts in the specified date range
func (r *ChannelRepo) GetTopPosts(ctx context.Context, channelID uuid.UUID, since time.Time, limit int) ([]ChannelPost, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `
		SELECT id, channel_id, telegram_message_id, author_user_id, text, has_media, views_count, reactions_count, forwards_count, is_pinned, scheduled_at, posted_at, created_at
		FROM channel_posts
		WHERE channel_id = $1 AND created_at >= $2
		ORDER BY views_count DESC
		LIMIT $3
	`

	rows, err := r.db.Pool.Query(ctx, query, channelID, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []ChannelPost
	for rows.Next() {
		var p ChannelPost
		if err := rows.Scan(
			&p.ID, &p.ChannelID, &p.TelegramMessageID, &p.AuthorUserID, &p.Text, &p.HasMedia,
			&p.ViewsCount, &p.ReactionsCount, &p.ForwardsCount, &p.IsPinned, &p.ScheduledAt, &p.PostedAt, &p.CreatedAt,
		); err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}

	return posts, nil
}

func (r *ChannelRepo) GetAnalyticsTimeline(ctx context.Context, channelID uuid.UUID, days int) ([]ChannelAnalytics, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `SELECT id, channel_id, snapshot_date, subscribers_count, new_subscribers, views_count, reactions_count, posts_count, created_at
		FROM (
			SELECT id, channel_id, snapshot_date, subscribers_count, new_subscribers, views_count, reactions_count, posts_count, created_at
			FROM channel_analytics 
			WHERE channel_id = $1 
			ORDER BY snapshot_date DESC LIMIT $2
		) AS recent
		ORDER BY snapshot_date ASC`

	rows, err := r.db.Pool.Query(ctx, query, channelID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var snapshots []ChannelAnalytics
	for rows.Next() {
		var s ChannelAnalytics
		var t time.Time
		if err := rows.Scan(
			&s.ID, &s.ChannelID, &t, &s.SubscribersCount, &s.NewSubscribers, &s.ViewsCount, &s.ReactionsCount, &s.PostsCount, &s.CreatedAt,
		); err != nil {
			return nil, err
		}
		s.SnapshotDate = t
		snapshots = append(snapshots, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}
	return snapshots, nil
}

// CreatePost schedules or registers a post entry
func (r *ChannelRepo) CreatePost(ctx context.Context, post *ChannelPost) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	query := `INSERT INTO channel_posts (channel_id, telegram_message_id, author_user_id, text, has_media, views_count, reactions_count, forwards_count, is_pinned, scheduled_at, posted_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at`

	return r.db.Pool.QueryRow(ctx, query,
		post.ChannelID, post.TelegramMessageID, post.AuthorUserID, post.Text, post.HasMedia, post.ViewsCount,
		post.ReactionsCount, post.ForwardsCount, post.IsPinned, post.ScheduledAt, post.PostedAt,
	).Scan(&post.ID, &post.CreatedAt)
}

// GetScheduledPosts retrieves all pending posts scheduled for publishing
func (r *ChannelRepo) GetScheduledPosts(ctx context.Context) ([]ChannelPost, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `SELECT id, channel_id, telegram_message_id, author_user_id, text, has_media, views_count, reactions_count, forwards_count, is_pinned, scheduled_at, posted_at, created_at
		FROM channel_posts WHERE posted_at IS NULL AND scheduled_at IS NOT NULL`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []ChannelPost
	for rows.Next() {
		var p ChannelPost
		if err := rows.Scan(
			&p.ID, &p.ChannelID, &p.TelegramMessageID, &p.AuthorUserID, &p.Text, &p.HasMedia, &p.ViewsCount,
			&p.ReactionsCount, &p.ForwardsCount, &p.IsPinned, &p.ScheduledAt, &p.PostedAt, &p.CreatedAt,
		); err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}
	return posts, nil
}

// MarkPostAsPublished marks a scheduled post as successfully published
func (r *ChannelRepo) MarkPostAsPublished(ctx context.Context, postID uuid.UUID, telegramMsgID int64) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	query := `UPDATE channel_posts SET telegram_message_id = $1, posted_at = now() WHERE id = $2`
	_, err := r.db.Pool.Exec(ctx, query, telegramMsgID, postID)
	return err
}

// GetAllChannels retrieves all active (non-deleted) managed channels in the system
func (r *ChannelRepo) GetAllChannels(ctx context.Context) ([]ManagedChannel, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `SELECT id, bot_id, chat_id, chat_title, subscribers_count, subscription_status, trial_ends_at, paid_until, linked_chat_id, slow_mode_delay, auto_delete_time, sign_messages, protect_content, connected_by_user_id, created_at, updated_at
		FROM managed_channels`

	rows, err := r.db.Pool.Query(ctx, query)
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
			&c.ConnectedByUserID, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		channels = append(channels, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}
	return channels, nil
}

// UpdateChannelSubscribers updates the cached subscribers count for a channel
func (r *ChannelRepo) UpdateChannelSubscribers(ctx context.Context, channelID uuid.UUID, subscribersCount int) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	query := `UPDATE managed_channels SET subscribers_count = $1, updated_at = now() WHERE id = $2`
	_, err := r.db.Pool.Exec(ctx, query, subscribersCount, channelID)
	return err
}

type ChannelWithBotDetail struct {
	ChannelID          uuid.UUID
	BotID              uuid.UUID
	ChatID             int64
	ChatTitle          string
	SubscribersCount   int
	SubscriptionStatus string
	TrialEndsAt        time.Time
	PaidUntil          *time.Time
	BotTokenEncrypted  []byte
	CreatedAt          time.Time
}

// GetAllChannelsWithBots retrieves all active managed channels joined with bot decrypted tokens (for background tasks)
func (r *ChannelRepo) GetAllChannelsWithBots(ctx context.Context) ([]ChannelWithBotDetail, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `SELECT c.id, c.bot_id, c.chat_id, c.chat_title, c.subscribers_count, c.subscription_status, c.trial_ends_at, c.paid_until, b.bot_token_encrypted
		FROM managed_channels c
		JOIN managed_bots b ON c.bot_id = b.id`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var details []ChannelWithBotDetail
	for rows.Next() {
		var d ChannelWithBotDetail
		if err := rows.Scan(
			&d.ChannelID, &d.BotID, &d.ChatID, &d.ChatTitle, &d.SubscribersCount, &d.SubscriptionStatus, &d.TrialEndsAt,
			&d.PaidUntil, &d.BotTokenEncrypted,
		); err != nil {
			return nil, err
		}
		details = append(details, d)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}

	return details, nil
}

// GetChannelsWithBotsPaged retrieves managed channels joined with bot decrypted tokens in paged batches to prevent OOM in background tasks, using keyset pagination.
func (r *ChannelRepo) GetChannelsWithBotsPaged(ctx context.Context, limit int, cursor *time.Time, cursorID *uuid.UUID) ([]ChannelWithBotDetail, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	var query string
	var args []interface{}

	if cursor != nil && cursorID != nil {
		query = `SELECT c.id, c.bot_id, c.chat_id, c.chat_title, c.subscribers_count, c.subscription_status, c.trial_ends_at, c.paid_until, b.bot_token_encrypted, c.created_at
			FROM managed_channels c
			JOIN managed_bots b ON c.bot_id = b.id
			WHERE c.created_at > $1 OR (c.created_at = $1 AND c.id > $2)
			ORDER BY c.created_at ASC, c.id ASC LIMIT $3`
		args = []interface{}{*cursor, *cursorID, limit}
	} else {
		query = `SELECT c.id, c.bot_id, c.chat_id, c.chat_title, c.subscribers_count, c.subscription_status, c.trial_ends_at, c.paid_until, b.bot_token_encrypted, c.created_at
			FROM managed_channels c
			JOIN managed_bots b ON c.bot_id = b.id
			ORDER BY c.created_at ASC, c.id ASC LIMIT $1`
		args = []interface{}{limit}
	}

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var details []ChannelWithBotDetail
	for rows.Next() {
		var d ChannelWithBotDetail
		if err := rows.Scan(
			&d.ChannelID, &d.BotID, &d.ChatID, &d.ChatTitle, &d.SubscribersCount, &d.SubscriptionStatus, &d.TrialEndsAt,
			&d.PaidUntil, &d.BotTokenEncrypted, &d.CreatedAt,
		); err != nil {
			return nil, err
		}
		details = append(details, d)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}

	return details, nil
}

// SaveSnapshotAndUpdateSubscribers persists the daily analytics snapshot and updates the channel's subscribers count inside an atomic transaction.
func (r *ChannelRepo) SaveSnapshotAndUpdateSubscribers(ctx context.Context, snapshot *ChannelAnalytics, count int) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Step 1: Update Channel Subscribers count (Lock parent first to prevent deadlocks)
	querySubscribers := `UPDATE managed_channels SET subscribers_count = $1, updated_at = now() WHERE id = $2`
	_, err = tx.Exec(ctx, querySubscribers, count, snapshot.ChannelID)
	if err != nil {
		return err
	}

	// Step 2: Save Analytics Snapshot
	querySnapshot := `INSERT INTO channel_analytics (channel_id, snapshot_date, subscribers_count, new_subscribers, views_count, reactions_count, posts_count)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (channel_id, snapshot_date) DO UPDATE SET
			subscribers_count = EXCLUDED.subscribers_count,
			new_subscribers = EXCLUDED.new_subscribers,
			views_count = EXCLUDED.views_count,
			reactions_count = EXCLUDED.reactions_count,
			posts_count = EXCLUDED.posts_count
		RETURNING id, created_at`

	err = tx.QueryRow(ctx, querySnapshot,
		snapshot.ChannelID, snapshot.SnapshotDate.Format("2006-01-02"), snapshot.SubscribersCount, snapshot.NewSubscribers,
		snapshot.ViewsCount, snapshot.ReactionsCount, snapshot.PostsCount,
	).Scan(&snapshot.ID, &snapshot.CreatedAt)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

type ChannelForwardingRule struct {
	ID             uuid.UUID       `json:"id"`
	ChannelID      uuid.UUID       `json:"channel_id"`
	Direction      string          `json:"direction"`
	TargetType     string          `json:"target_type"`
	Target         string          `json:"target"`
	SourceChannel  string          `json:"source_channel"`
	TargetChannel  string          `json:"target_channel"`
	Mode           string          `json:"mode"`
	Delay          string          `json:"delay"`
	IsActive       bool            `json:"is_active"`
	ContentTypes   json.RawMessage `json:"content_types"`
	RemoveAds      bool            `json:"remove_ads"`
	RemoveHashtags bool            `json:"remove_hashtags"`
	RemoveLinks    bool            `json:"remove_links"`
	Watermark      string          `json:"watermark"`
	CreatedAt      time.Time       `json:"created_at"`
}

type ChannelAdmin struct {
	ID          uuid.UUID `json:"id"`
	ChannelID   uuid.UUID `json:"channel_id"`
	TelegramID  int64     `json:"telegram_id"`
	Username    *string   `json:"username"`
	FirstName   string    `json:"first_name"`
	CustomTitle *string   `json:"custom_title"`
	IsOwner     bool      `json:"is_owner"`
	CreatedAt   time.Time `json:"created_at"`
}

type ChannelInlineButton struct {
	ID         uuid.UUID `json:"id"`
	ChannelID  uuid.UUID `json:"channel_id"`
	Title      string    `json:"title"`
	Value      string    `json:"value"`
	Type       string    `json:"type"`
	Style      string    `json:"style"`
	Emoji      string    `json:"emoji"`
	ClickCount int       `json:"click_count"`
	OrderIndex int       `json:"order_index"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
}

// CreateForwardingRule creates a new channel forwarding rule
func (r *ChannelRepo) CreateForwardingRule(ctx context.Context, rule *ChannelForwardingRule) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	query := `INSERT INTO channel_forwarding_rules (channel_id, direction, target_type, target, source_channel, target_channel, mode, delay, is_active, content_types, remove_ads, remove_hashtags, remove_links, watermark)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, created_at`

	return r.db.Pool.QueryRow(ctx, query,
		rule.ChannelID, rule.Direction, rule.TargetType, rule.Target, rule.SourceChannel, rule.TargetChannel, rule.Mode, rule.Delay, rule.IsActive,
		rule.ContentTypes, rule.RemoveAds, rule.RemoveHashtags, rule.RemoveLinks, rule.Watermark,
	).Scan(&rule.ID, &rule.CreatedAt)
}

// GetForwardingRules retrieves all forwarding rules for a channel
func (r *ChannelRepo) GetForwardingRules(ctx context.Context, channelID uuid.UUID) ([]ChannelForwardingRule, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `SELECT id, channel_id, direction, target_type, target, source_channel, target_channel, mode, delay, is_active, content_types, remove_ads, remove_hashtags, remove_links, watermark, created_at
		FROM channel_forwarding_rules WHERE channel_id = $1 ORDER BY created_at ASC`

	rows, err := r.db.Pool.Query(ctx, query, channelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []ChannelForwardingRule
	for rows.Next() {
		var rl ChannelForwardingRule
		if err := rows.Scan(
			&rl.ID, &rl.ChannelID, &rl.Direction, &rl.TargetType, &rl.Target, &rl.SourceChannel, &rl.TargetChannel, &rl.Mode, &rl.Delay, &rl.IsActive,
			&rl.ContentTypes, &rl.RemoveAds, &rl.RemoveHashtags, &rl.RemoveLinks, &rl.Watermark, &rl.CreatedAt,
		); err != nil {
			return nil, err
		}
		rules = append(rules, rl)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}
	return rules, nil
}

// UpdateForwardingRule updates an existing forwarding rule
func (r *ChannelRepo) UpdateForwardingRule(ctx context.Context, rule *ChannelForwardingRule) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	query := `UPDATE channel_forwarding_rules SET direction = $1, target_type = $2, target = $3, source_channel = $4, target_channel = $5, mode = $6, delay = $7, is_active = $8, content_types = $9, remove_ads = $10, remove_hashtags = $11, remove_links = $12, watermark = $13
		WHERE id = $14 AND channel_id = $15`

	tag, err := r.db.Pool.Exec(ctx, query,
		rule.Direction, rule.TargetType, rule.Target, rule.SourceChannel, rule.TargetChannel, rule.Mode, rule.Delay, rule.IsActive,
		rule.ContentTypes, rule.RemoveAds, rule.RemoveHashtags, rule.RemoveLinks, rule.Watermark, rule.ID, rule.ChannelID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("forwarding rule not found")
	}
	return nil
}

// DeleteForwardingRule deletes a forwarding rule
func (r *ChannelRepo) DeleteForwardingRule(ctx context.Context, channelID uuid.UUID, ruleID uuid.UUID) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	query := `DELETE FROM channel_forwarding_rules WHERE id = $1 AND channel_id = $2`
	tag, err := r.db.Pool.Exec(ctx, query, ruleID, channelID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("forwarding rule not found")
	}
	return nil
}

// GetAllActiveForwardingRules retrieves all active forwarding rules across all channels
func (r *ChannelRepo) GetAllActiveForwardingRules(ctx context.Context) ([]ChannelForwardingRule, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `SELECT id, channel_id, direction, target_type, target, source_channel, target_channel, mode, delay, is_active, content_types, remove_ads, remove_hashtags, remove_links, watermark, created_at
		FROM channel_forwarding_rules WHERE is_active = true`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []ChannelForwardingRule
	for rows.Next() {
		var rl ChannelForwardingRule
		if err := rows.Scan(
			&rl.ID, &rl.ChannelID, &rl.Direction, &rl.TargetType, &rl.Target, &rl.SourceChannel, &rl.TargetChannel, &rl.Mode, &rl.Delay, &rl.IsActive,
			&rl.ContentTypes, &rl.RemoveAds, &rl.RemoveHashtags, &rl.RemoveLinks, &rl.Watermark, &rl.CreatedAt,
		); err != nil {
			return nil, err
		}
		rules = append(rules, rl)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}
	return rules, nil
}

// GetActiveForwardingRulesBySource retrieves active rules (inbound or outbound) by a target username or ID
func (r *ChannelRepo) GetActiveForwardingRulesBySource(ctx context.Context, target string) ([]ChannelForwardingRule, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `SELECT id, channel_id, direction, target_type, target, source_channel, target_channel, mode, delay, is_active, content_types, remove_ads, remove_hashtags, remove_links, watermark, created_at
		FROM channel_forwarding_rules WHERE (source_channel = $1 OR target = $1) AND is_active = true`

	rows, err := r.db.Pool.Query(ctx, query, target)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []ChannelForwardingRule
	for rows.Next() {
		var rl ChannelForwardingRule
		if err := rows.Scan(
			&rl.ID, &rl.ChannelID, &rl.Direction, &rl.TargetType, &rl.Target, &rl.SourceChannel, &rl.TargetChannel, &rl.Mode, &rl.Delay, &rl.IsActive,
			&rl.ContentTypes, &rl.RemoveAds, &rl.RemoveHashtags, &rl.RemoveLinks, &rl.Watermark, &rl.CreatedAt,
		); err != nil {
			return nil, err
		}
		rules = append(rules, rl)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}
	return rules, nil
}

// SyncChannelAdmins synchronizes Telegram administrators list locally using high-performance batching
func (r *ChannelRepo) SyncChannelAdmins(ctx context.Context, channelID uuid.UUID, admins []ChannelAdmin) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if len(admins) > 0 {
		// Sort admins by TelegramID to prevent deadlocks on concurrent upserts
		sort.Slice(admins, func(i, j int) bool {
			return admins[i].TelegramID < admins[j].TelegramID
		})

		batch := &pgx.Batch{}
		query := `INSERT INTO channel_admins (channel_id, telegram_id, username, first_name, custom_title, is_owner) 
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (channel_id, telegram_id) 
			DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name, custom_title = EXCLUDED.custom_title, is_owner = EXCLUDED.is_owner`

		activeIDs := make([]int64, 0, len(admins))
		for _, admin := range admins {
			batch.Queue(query, channelID, admin.TelegramID, admin.Username, admin.FirstName, admin.CustomTitle, admin.IsOwner)
			activeIDs = append(activeIDs, admin.TelegramID)
		}

		br := tx.SendBatch(ctx, batch)
		for i := 0; i < len(admins); i++ {
			if _, err := br.Exec(); err != nil {
				br.Close()
				return fmt.Errorf("failed to execute admin sync batch: %w", err)
			}
		}
		if err := br.Close(); err != nil {
			return fmt.Errorf("failed to close admin sync batch: %w", err)
		}

		_, err = tx.Exec(ctx, `DELETE FROM channel_admins WHERE channel_id = $1 AND telegram_id != ALL($2)`, channelID, activeIDs)
		if err != nil {
			return err
		}
	} else {
		_, err = tx.Exec(ctx, `DELETE FROM channel_admins WHERE channel_id = $1`, channelID)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// GetChannelAdmins returns local administrators list for a channel
func (r *ChannelRepo) GetChannelAdmins(ctx context.Context, channelID uuid.UUID) ([]ChannelAdmin, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `SELECT id, channel_id, telegram_id, username, first_name, custom_title, is_owner, created_at
		FROM channel_admins WHERE channel_id = $1 ORDER BY is_owner DESC, first_name ASC`

	rows, err := r.db.Pool.Query(ctx, query, channelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var admins []ChannelAdmin
	for rows.Next() {
		var a ChannelAdmin
		if err := rows.Scan(
			&a.ID, &a.ChannelID, &a.TelegramID, &a.Username, &a.FirstName, &a.CustomTitle, &a.IsOwner, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		admins = append(admins, a)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}
	return admins, nil
}

// SaveChannelButtons synchronizes interactive inline buttons for a channel, preserving existing statistics (click counts) and button IDs to avoid breaking callback queries.
func (r *ChannelRepo) SaveChannelButtons(ctx context.Context, channelID uuid.UUID, buttons []ChannelInlineButton) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Acquire row-level lock on the channel to prevent race conditions that could bypass button limits
	_, err = tx.Exec(ctx, `SELECT 1 FROM managed_channels WHERE id = $1 FOR NO KEY UPDATE`, channelID)
	if err != nil {
		return err
	}

	// 1. Fetch existing buttons inside the transaction to identify matches
	queryExisting := `SELECT id, channel_id, title, value, type, style, emoji, click_count, order_index, is_active, created_at
		FROM channel_inline_buttons WHERE channel_id = $1 ORDER BY order_index ASC, created_at ASC`
	rows, err := tx.Query(ctx, queryExisting, channelID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var existing []ChannelInlineButton
	for rows.Next() {
		var b ChannelInlineButton
		if err := rows.Scan(
			&b.ID, &b.ChannelID, &b.Title, &b.Value, &b.Type, &b.Style, &b.Emoji, &b.ClickCount, &b.OrderIndex, &b.IsActive, &b.CreatedAt,
		); err != nil {
			return err
		}
		existing = append(existing, b)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("rows iteration error: %w", err)
	}
	rows.Close()

	existingMap := make(map[uuid.UUID]ChannelInlineButton)
	for _, btn := range existing {
		existingMap[btn.ID] = btn
	}

	var keepIDs []uuid.UUID

	// 2. Insert or update each button, keeping IDs intact
	for i, btn := range buttons {
		// If ID is nil/empty or not in existing, it's a new button
		if btn.ID != uuid.Nil {
			if _, exists := existingMap[btn.ID]; exists {
				// Update all fields (including title/value/type) but keep click count intact
				query := `UPDATE channel_inline_buttons SET title = $1, value = $2, type = $3, style = $4, emoji = $5, order_index = $6, is_active = $7 WHERE id = $8`
				_, err = tx.Exec(ctx, query, btn.Title, btn.Value, btn.Type, btn.Style, btn.Emoji, i, btn.IsActive, btn.ID)
				if err != nil {
					return err
				}
				keepIDs = append(keepIDs, btn.ID)
				continue
			}
		}

		// Insert new button
		newID := uuid.New()
		query := `INSERT INTO channel_inline_buttons (id, channel_id, title, value, type, style, emoji, click_count, order_index, is_active)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9)`
		_, err = tx.Exec(ctx, query, newID, channelID, btn.Title, btn.Value, btn.Type, btn.Style, btn.Emoji, i, btn.IsActive)
		if err != nil {
			return err
		}
		keepIDs = append(keepIDs, newID)
	}

	// 3. Delete any removed buttons
	if len(keepIDs) > 0 {
		query := `DELETE FROM channel_inline_buttons WHERE channel_id = $1 AND id != ALL($2)`
		_, err = tx.Exec(ctx, query, channelID, keepIDs)
		if err != nil {
			return err
		}
	} else {
		_, err = tx.Exec(ctx, `DELETE FROM channel_inline_buttons WHERE channel_id = $1`, channelID)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// GetChannelButtons returns inline buttons list for a channel
func (r *ChannelRepo) GetChannelButtons(ctx context.Context, channelID uuid.UUID) ([]ChannelInlineButton, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `SELECT id, channel_id, title, value, type, style, emoji, click_count, order_index, is_active, created_at
		FROM channel_inline_buttons WHERE channel_id = $1 ORDER BY order_index ASC, created_at ASC`

	rows, err := r.db.Pool.Query(ctx, query, channelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var buttons []ChannelInlineButton
	for rows.Next() {
		var b ChannelInlineButton
		if err := rows.Scan(
			&b.ID, &b.ChannelID, &b.Title, &b.Value, &b.Type, &b.Style, &b.Emoji, &b.ClickCount, &b.OrderIndex, &b.IsActive, &b.CreatedAt,
		); err != nil {
			return nil, err
		}
		buttons = append(buttons, b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}
	return buttons, nil
}

// IncrementButtonClicks increments count of clicks for an inline button
func (r *ChannelRepo) IncrementButtonClicks(ctx context.Context, buttonID uuid.UUID) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}

	query := `UPDATE channel_inline_buttons SET click_count = click_count + 1 WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, buttonID)
	return err
}

// GetButtonByID retrieves an inline button by its UUID
func (r *ChannelRepo) GetButtonByID(ctx context.Context, buttonID uuid.UUID) (*ChannelInlineButton, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `SELECT id, channel_id, title, value, type, style, emoji, click_count, order_index, is_active, created_at
		FROM channel_inline_buttons WHERE id = $1`

	var b ChannelInlineButton
	err := r.db.Pool.QueryRow(ctx, query, buttonID).Scan(
		&b.ID, &b.ChannelID, &b.Title, &b.Value, &b.Type, &b.Style, &b.Emoji, &b.ClickCount, &b.OrderIndex, &b.IsActive, &b.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("button not found")
		}
		return nil, err
	}
	return &b, nil
}

func (r *ChannelRepo) GetCache() *Cache {
	return r.cache
}

func (r *ChannelRepo) PruneAuditLogs(ctx context.Context, cutoff time.Time) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	query := `DELETE FROM channel_audit_logs WHERE created_at < $1`
	_, err := r.db.Pool.Exec(ctx, query, cutoff)
	return err
}

type PendingPost struct {
	ID        uuid.UUID             `json:"id"`
	ChannelID uuid.UUID             `json:"channel_id"`
	ChatID    int64                 `json:"chat_id"`
	Text      string                `json:"text"`
	Buttons   []ChannelInlineButton `json:"buttons"`
}

// Channel Funnel System Types & Methods

type ChannelFunnel struct {
	ID           uuid.UUID `json:"id"`
	BotID        uuid.UUID `json:"bot_id"`
	ProjectName  string    `json:"project_name"`
	InputChatID  int64     `json:"input_chat_id"`
	OutputChatID int64     `json:"output_chat_id"`
	OwnerUserID  int64     `json:"owner_user_id"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type FunnelMediaItem struct {
	FileID  string `json:"file_id"`
	Type    string `json:"type"` // "photo", "video", "document", "audio"
	Caption string `json:"caption,omitempty"`
}

type PendingFunnelPost struct {
	ID                     uuid.UUID         `json:"id"`
	FunnelID               uuid.UUID         `json:"funnel_id"`
	InputMessageID         int64             `json:"input_message_id"`
	OriginalAuthorID       *int64            `json:"original_author_id,omitempty"`
	OriginalAuthorName     string            `json:"original_author_name,omitempty"`
	MediaGroupID           *string           `json:"media_group_id,omitempty"`
	MediaPayload           []FunnelMediaItem `json:"media_payload"`
	DraftText              string            `json:"draft_text"`
	DraftButtons           json.RawMessage   `json:"draft_buttons"`
	AiVariations           []string          `json:"ai_variations"`
	SelectedVariationIndex int               `json:"selected_variation_index"`
	Status                 string            `json:"status"` // "pending", "approved", "rejected", "scheduled"
	ScheduledAt            *time.Time        `json:"scheduled_at,omitempty"`
	PublishedMessageID     *int64            `json:"published_message_id,omitempty"`
	CreatedAt              time.Time         `json:"created_at"`
	UpdatedAt              time.Time         `json:"updated_at"`
}

func (r *ChannelRepo) CreateChannelFunnel(ctx context.Context, f *ChannelFunnel) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	query := `INSERT INTO channel_funnels (bot_id, project_name, input_chat_id, output_chat_id, owner_user_id, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (bot_id, input_chat_id) DO UPDATE SET output_chat_id = EXCLUDED.output_chat_id, project_name = EXCLUDED.project_name, is_active = EXCLUDED.is_active, updated_at = now()
		RETURNING id, created_at, updated_at`
	return r.db.Pool.QueryRow(ctx, query, f.BotID, f.ProjectName, f.InputChatID, f.OutputChatID, f.OwnerUserID, f.IsActive).
		Scan(&f.ID, &f.CreatedAt, &f.UpdatedAt)
}

func (r *ChannelRepo) GetFunnelByInputChatID(ctx context.Context, botID uuid.UUID, inputChatID int64) (*ChannelFunnel, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	query := `SELECT id, bot_id, project_name, input_chat_id, output_chat_id, owner_user_id, is_active, created_at, updated_at
		FROM channel_funnels WHERE bot_id = $1 AND input_chat_id = $2`
	var f ChannelFunnel
	err := r.db.Pool.QueryRow(ctx, query, botID, inputChatID).Scan(
		&f.ID, &f.BotID, &f.ProjectName, &f.InputChatID, &f.OutputChatID, &f.OwnerUserID, &f.IsActive, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // Not found
		}
		return nil, err
	}
	return &f, nil
}

func (r *ChannelRepo) GetFunnelsByInputChatID(ctx context.Context, inputChatID int64) ([]*ChannelFunnel, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	query := `SELECT id, bot_id, project_name, input_chat_id, output_chat_id, owner_user_id, is_active, created_at, updated_at
		FROM channel_funnels WHERE input_chat_id = $1 AND is_active = true`
	rows, err := r.db.Pool.Query(ctx, query, inputChatID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var funnels []*ChannelFunnel
	for rows.Next() {
		var f ChannelFunnel
		if err := rows.Scan(&f.ID, &f.BotID, &f.ProjectName, &f.InputChatID, &f.OutputChatID, &f.OwnerUserID, &f.IsActive, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		funnels = append(funnels, &f)
	}
	return funnels, nil
}

func (r *ChannelRepo) GetFunnelByOutputChatID(ctx context.Context, botID uuid.UUID, outputChatID int64) (*ChannelFunnel, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	query := `SELECT id, bot_id, project_name, input_chat_id, output_chat_id, owner_user_id, is_active, created_at, updated_at
		FROM channel_funnels WHERE bot_id = $1 AND output_chat_id = $2`
	var f ChannelFunnel
	err := r.db.Pool.QueryRow(ctx, query, botID, outputChatID).Scan(
		&f.ID, &f.BotID, &f.ProjectName, &f.InputChatID, &f.OutputChatID, &f.OwnerUserID, &f.IsActive, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // Not found
		}
		return nil, err
	}
	return &f, nil
}

func (r *ChannelRepo) GetFunnelByID(ctx context.Context, id uuid.UUID) (*ChannelFunnel, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	query := `SELECT id, bot_id, project_name, input_chat_id, output_chat_id, owner_user_id, is_active, created_at, updated_at
		FROM channel_funnels WHERE id = $1`
	var f ChannelFunnel
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&f.ID, &f.BotID, &f.ProjectName, &f.InputChatID, &f.OutputChatID, &f.OwnerUserID, &f.IsActive, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("funnel not found")
		}
		return nil, err
	}
	return &f, nil
}

func (r *ChannelRepo) DeleteChannelFunnel(ctx context.Context, id uuid.UUID) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	query := `DELETE FROM channel_funnels WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

func (r *ChannelRepo) UpdateChannelFunnelTx(ctx context.Context, tx pgx.Tx, f *ChannelFunnel) error {
	query := `UPDATE channel_funnels SET project_name = $1, input_chat_id = $2, output_chat_id = $3, updated_at = now() WHERE id = $4`
	var err error
	if tx != nil {
		_, err = tx.Exec(ctx, query, f.ProjectName, f.InputChatID, f.OutputChatID, f.ID)
	} else {
		_, err = r.db.Pool.Exec(ctx, query, f.ProjectName, f.InputChatID, f.OutputChatID, f.ID)
	}
	return err
}

func (r *ChannelRepo) SavePendingFunnelPost(ctx context.Context, p *PendingFunnelPost) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	mediaPayloadJSON, err := json.Marshal(p.MediaPayload)
	if err != nil {
		return err
	}
	aiVariationsJSON, err := json.Marshal(p.AiVariations)
	if err != nil {
		return err
	}

	query := `INSERT INTO pending_funnel_posts (funnel_id, input_message_id, original_author_id, original_author_name, media_group_id, media_payload, draft_text, draft_buttons, ai_variations, selected_variation_index, status, scheduled_at, published_message_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (funnel_id, input_message_id) DO UPDATE SET media_payload = EXCLUDED.media_payload, draft_text = EXCLUDED.draft_text, draft_buttons = EXCLUDED.draft_buttons, ai_variations = EXCLUDED.ai_variations, selected_variation_index = EXCLUDED.selected_variation_index, status = EXCLUDED.status, scheduled_at = EXCLUDED.scheduled_at, published_message_id = EXCLUDED.published_message_id, updated_at = now()
		RETURNING id, created_at, updated_at`
	return r.db.Pool.QueryRow(ctx, query, p.FunnelID, p.InputMessageID, p.OriginalAuthorID, p.OriginalAuthorName, p.MediaGroupID, mediaPayloadJSON, p.DraftText, p.DraftButtons, aiVariationsJSON, p.SelectedVariationIndex, p.Status, p.ScheduledAt, p.PublishedMessageID).
		Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (r *ChannelRepo) GetPendingFunnelPostByID(ctx context.Context, id uuid.UUID) (*PendingFunnelPost, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	query := `SELECT id, funnel_id, input_message_id, original_author_id, original_author_name, media_group_id, media_payload, draft_text, draft_buttons, ai_variations, selected_variation_index, status, scheduled_at, published_message_id, created_at, updated_at
		FROM pending_funnel_posts WHERE id = $1`
	var p PendingFunnelPost
	var mediaPayloadRaw, aiVariationsRaw []byte
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.FunnelID, &p.InputMessageID, &p.OriginalAuthorID, &p.OriginalAuthorName, &p.MediaGroupID, &mediaPayloadRaw, &p.DraftText, &p.DraftButtons, &aiVariationsRaw, &p.SelectedVariationIndex, &p.Status, &p.ScheduledAt, &p.PublishedMessageID, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("pending post not found")
		}
		return nil, err
	}
	_ = json.Unmarshal(mediaPayloadRaw, &p.MediaPayload)
	_ = json.Unmarshal(aiVariationsRaw, &p.AiVariations)
	return &p, nil
}

func (r *ChannelRepo) GetPendingFunnelPostByMessageID(ctx context.Context, funnelID uuid.UUID, inputMsgID int64) (*PendingFunnelPost, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	query := `SELECT id, funnel_id, input_message_id, original_author_id, original_author_name, media_group_id, media_payload, draft_text, draft_buttons, ai_variations, selected_variation_index, status, scheduled_at, published_message_id, created_at, updated_at
		FROM pending_funnel_posts WHERE funnel_id = $1 AND input_message_id = $2`
	var p PendingFunnelPost
	var mediaPayloadRaw, aiVariationsRaw []byte
	err := r.db.Pool.QueryRow(ctx, query, funnelID, inputMsgID).Scan(
		&p.ID, &p.FunnelID, &p.InputMessageID, &p.OriginalAuthorID, &p.OriginalAuthorName, &p.MediaGroupID, &mediaPayloadRaw, &p.DraftText, &p.DraftButtons, &aiVariationsRaw, &p.SelectedVariationIndex, &p.Status, &p.ScheduledAt, &p.PublishedMessageID, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // Not found
		}
		return nil, err
	}
	_ = json.Unmarshal(mediaPayloadRaw, &p.MediaPayload)
	_ = json.Unmarshal(aiVariationsRaw, &p.AiVariations)
	return &p, nil
}

func (r *ChannelRepo) UpdatePendingFunnelPost(ctx context.Context, p *PendingFunnelPost) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	mediaPayloadJSON, err := json.Marshal(p.MediaPayload)
	if err != nil {
		return err
	}
	aiVariationsJSON, err := json.Marshal(p.AiVariations)
	if err != nil {
		return err
	}

	query := `UPDATE pending_funnel_posts SET
		media_payload = $1,
		draft_text = $2,
		draft_buttons = $3,
		ai_variations = $4,
		selected_variation_index = $5,
		status = $6,
		scheduled_at = $7,
		published_message_id = $8,
		updated_at = now()
		WHERE id = $9`
	_, err = r.db.Pool.Exec(ctx, query, mediaPayloadJSON, p.DraftText, p.DraftButtons, aiVariationsJSON, p.SelectedVariationIndex, p.Status, p.ScheduledAt, p.PublishedMessageID, p.ID)
	return err
}

func (r *ChannelRepo) GetScheduledFunnelPosts(ctx context.Context) ([]PendingFunnelPost, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	query := `SELECT id, funnel_id, input_message_id, original_author_id, original_author_name, media_group_id, media_payload, draft_text, draft_buttons, ai_variations, selected_variation_index, status, scheduled_at, published_message_id, created_at, updated_at
		FROM pending_funnel_posts
		WHERE status = 'scheduled' AND scheduled_at <= now()`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []PendingFunnelPost
	for rows.Next() {
		var p PendingFunnelPost
		var mediaPayloadRaw, aiVariationsRaw []byte
		err := rows.Scan(
			&p.ID, &p.FunnelID, &p.InputMessageID, &p.OriginalAuthorID, &p.OriginalAuthorName, &p.MediaGroupID, &mediaPayloadRaw, &p.DraftText, &p.DraftButtons, &aiVariationsRaw, &p.SelectedVariationIndex, &p.Status, &p.ScheduledAt, &p.PublishedMessageID, &p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		_ = json.Unmarshal(mediaPayloadRaw, &p.MediaPayload)
		_ = json.Unmarshal(aiVariationsRaw, &p.AiVariations)
		posts = append(posts, p)
	}
	return posts, nil
}

// RegisterPostButtonClick registers a user click on an inline button for a specific message.
// It supports toggling and mutual exclusivity for counter buttons.
// Returns action ("inserted", "deleted", "swapped"), oldButtonID (if swapped), and error.
func (r *ChannelRepo) RegisterPostButtonClick(ctx context.Context, channelID uuid.UUID, telegramMessageID int64, buttonID uuid.UUID, userID int64) (string, uuid.UUID, error) {
	if r.db == nil || r.db.Pool == nil {
		return "", uuid.Nil, fmt.Errorf("database pool is not initialized")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return "", uuid.Nil, err
	}
	defer tx.Rollback(ctx)

	// Acquire advisory lock to prevent concurrent click race conditions for the same user + message
	lockID := int64(binary.LittleEndian.Uint64(channelID[:8])) ^ telegramMessageID ^ userID
	_, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, lockID)
	if err != nil {
		return "", uuid.Nil, err
	}

	// 1. Get the clicked button type
	var btnType string
	err = tx.QueryRow(ctx, `SELECT type FROM channel_inline_buttons WHERE id = $1`, buttonID).Scan(&btnType)
	if err != nil {
		return "", uuid.Nil, err
	}

	if btnType == "counter" {
		// 2. Find all counter buttons for this channel
		rows, err := tx.Query(ctx, `SELECT id FROM channel_inline_buttons WHERE channel_id = $1 AND type = 'counter'`, channelID)
		if err != nil {
			return "", uuid.Nil, err
		}
		var counterBtnIDs []uuid.UUID
		for rows.Next() {
			var id uuid.UUID
			if err := rows.Scan(&id); err == nil {
				counterBtnIDs = append(counterBtnIDs, id)
			}
		}
		rows.Close()

		if len(counterBtnIDs) > 0 {
			// 3. Find if the user has clicked any of these counter buttons for this message
			var existingClickedBtnID uuid.UUID
			err = tx.QueryRow(ctx, `
				SELECT button_id FROM channel_post_clicks 
				WHERE channel_id = $1 AND telegram_message_id = $2 AND user_id = $3 AND button_id = ANY($4)
			`, channelID, telegramMessageID, userID, counterBtnIDs).Scan(&existingClickedBtnID)

			if err == nil {
				// Case A: User has already clicked the SAME button -> Toggle OFF (delete the click)
				if existingClickedBtnID == buttonID {
					_, err = tx.Exec(ctx, `
						DELETE FROM channel_post_clicks 
						WHERE channel_id = $1 AND telegram_message_id = $2 AND user_id = $3 AND button_id = $4
					`, channelID, telegramMessageID, userID, buttonID)
					if err != nil {
						return "", uuid.Nil, err
					}
					if err := tx.Commit(ctx); err != nil {
						return "", uuid.Nil, err
					}
					return "deleted", uuid.Nil, nil
				}

				// Case B: User has clicked a DIFFERENT counter button -> Switch vote (delete old click, insert new one)
				_, err = tx.Exec(ctx, `
					DELETE FROM channel_post_clicks 
					WHERE channel_id = $1 AND telegram_message_id = $2 AND user_id = $3 AND button_id = $4
				`, channelID, telegramMessageID, userID, existingClickedBtnID)
				if err != nil {
					return "", uuid.Nil, err
				}

				_, err = tx.Exec(ctx, `
					INSERT INTO channel_post_clicks (channel_id, telegram_message_id, button_id, user_id)
					VALUES ($1, $2, $3, $4)
				`, channelID, telegramMessageID, buttonID, userID)
				if err != nil {
					return "", uuid.Nil, err
				}

				if err := tx.Commit(ctx); err != nil {
					return "", uuid.Nil, err
				}
				return "swapped", existingClickedBtnID, nil
			} else if err != pgx.ErrNoRows {
				return "", uuid.Nil, err
			}
		}
	}

	// Case C: No existing click or not a counter button. Let's do standard insert.
	_, err = tx.Exec(ctx, `
		INSERT INTO channel_post_clicks (channel_id, telegram_message_id, button_id, user_id)
		VALUES ($1, $2, $3, $4)
	`, channelID, telegramMessageID, buttonID, userID)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			if pgErr.Code == "23505" {
				return "", uuid.Nil, fmt.Errorf("already clicked")
			}
		}
		return "", uuid.Nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return "", uuid.Nil, err
	}
	return "inserted", uuid.Nil, nil
}

// GetChannelButtonsWithCounts returns inline buttons list for a channel with counts for a specific message
func (r *ChannelRepo) GetChannelButtonsWithCounts(ctx context.Context, channelID uuid.UUID, telegramMessageID int64) ([]ChannelInlineButton, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}

	query := `SELECT b.id, b.channel_id, b.title, b.value, b.type, b.style, b.emoji, 
		COALESCE((SELECT COUNT(*) FROM channel_post_clicks c 
		          WHERE c.channel_id = b.channel_id 
		            AND c.telegram_message_id = $2 
		            AND c.button_id = b.id), 0) AS click_count,
		b.order_index, b.is_active, b.created_at
		FROM channel_inline_buttons b 
		WHERE b.channel_id = $1 
		ORDER BY b.order_index ASC, b.created_at ASC`

	rows, err := r.db.Pool.Query(ctx, query, channelID, telegramMessageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var buttons []ChannelInlineButton
	for rows.Next() {
		var b ChannelInlineButton
		if err := rows.Scan(
			&b.ID, &b.ChannelID, &b.Title, &b.Value, &b.Type, &b.Style, &b.Emoji, &b.ClickCount, &b.OrderIndex, &b.IsActive, &b.CreatedAt,
		); err != nil {
			return nil, err
		}
		buttons = append(buttons, b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}
	return buttons, nil
}

type ChannelBillingSubscription struct {
	ID            uuid.UUID
	UserID        int64
	ChannelID     uuid.UUID
	PackageID     string
	ChannelsLimit int
	AmountFRG     float64
	Period        string
	Status        string
	StartsAt      time.Time
	ExpiresAt     time.Time
}

func (r *ChannelRepo) DB() *Database {
	return r.db
}

func (r *ChannelRepo) UpdateChannelSubscription(ctx context.Context, channelID uuid.UUID, status string, paidUntil *time.Time) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("no database connection")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query1 := `UPDATE managed_channels SET subscription_status = $1, paid_until = $2, updated_at = now() WHERE id = $3`
	if _, err := tx.Exec(ctx, query1, status, paidUntil, channelID); err != nil {
		return err
	}

	if status == "expired" {
		query2 := `UPDATE channel_billing_subscriptions SET status = 'expired' WHERE channel_id = $1 AND status = 'active'`
		if _, err := tx.Exec(ctx, query2, channelID); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *ChannelRepo) UpdateChannelSubscriptionTx(ctx context.Context, tx pgx.Tx, channelID uuid.UUID, status string, paidUntil *time.Time) error {
	query1 := `UPDATE managed_channels SET subscription_status = $1, paid_until = $2, updated_at = now() WHERE id = $3`
	if _, err := tx.Exec(ctx, query1, status, paidUntil, channelID); err != nil {
		return err
	}

	if status == "expired" {
		query2 := `UPDATE channel_billing_subscriptions SET status = 'expired' WHERE channel_id = $1 AND status = 'active'`
		if _, err := tx.Exec(ctx, query2, channelID); err != nil {
			return err
		}
	}

	return nil
}

func (r *ChannelRepo) CreateChannelBillingSubscription(ctx context.Context, sub *ChannelBillingSubscription) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("no database connection")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Deactivate any existing active subscriptions for this channel
	query1 := `UPDATE channel_billing_subscriptions SET status = 'expired' WHERE channel_id = $1 AND status = 'active'`
	if _, err := tx.Exec(ctx, query1, sub.ChannelID); err != nil {
		return err
	}

	query2 := `
		INSERT INTO channel_billing_subscriptions (user_id, channel_id, package_id, channels_limit, amount_frg, period, status, starts_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`
	if err := tx.QueryRow(ctx, query2, sub.UserID, sub.ChannelID, sub.PackageID, sub.ChannelsLimit, sub.AmountFRG, sub.Period, sub.Status, sub.StartsAt, sub.ExpiresAt).Scan(&sub.ID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *ChannelRepo) CreateChannelBillingSubscriptionTx(ctx context.Context, tx pgx.Tx, sub *ChannelBillingSubscription) error {
	// Deactivate any existing active subscriptions for this channel
	query1 := `UPDATE channel_billing_subscriptions SET status = 'expired' WHERE channel_id = $1 AND status = 'active'`
	if _, err := tx.Exec(ctx, query1, sub.ChannelID); err != nil {
		return err
	}

	query2 := `
		INSERT INTO channel_billing_subscriptions (user_id, channel_id, package_id, channels_limit, amount_frg, period, status, starts_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`
	if err := tx.QueryRow(ctx, query2, sub.UserID, sub.ChannelID, sub.PackageID, sub.ChannelsLimit, sub.AmountFRG, sub.Period, sub.Status, sub.StartsAt, sub.ExpiresAt).Scan(&sub.ID); err != nil {
		return err
	}

	return nil
}

func (r *ChannelRepo) TransferChannelSubscriptionTx(ctx context.Context, tx pgx.Tx, oldChannelID uuid.UUID, newChannelID uuid.UUID) error {
	var status string
	var paidUntil, trialEndsAt *time.Time
	err := tx.QueryRow(ctx, `SELECT subscription_status, paid_until, trial_ends_at FROM managed_channels WHERE id = $1`, oldChannelID).Scan(&status, &paidUntil, &trialEndsAt)
	if err != nil {
		return fmt.Errorf("failed to get old channel subscription: %w", err)
	}

	_, err = tx.Exec(ctx, `UPDATE managed_channels SET subscription_status = $1, paid_until = $2, trial_ends_at = $3, updated_at = now() WHERE id = $4`, status, paidUntil, trialEndsAt, newChannelID)
	if err != nil {
		return fmt.Errorf("failed to update new channel subscription: %w", err)
	}

	_, err = tx.Exec(ctx, `UPDATE managed_channels SET subscription_status = 'free', paid_until = NULL, trial_ends_at = NULL, updated_at = now() WHERE id = $1`, oldChannelID)
	if err != nil {
		return fmt.Errorf("failed to reset old channel subscription: %w", err)
	}

	_, err = tx.Exec(ctx, `UPDATE channel_billing_subscriptions SET channel_id = $1 WHERE channel_id = $2`, newChannelID, oldChannelID)
	if err != nil {
		return fmt.Errorf("failed to transfer billing subscriptions: %w", err)
	}

	return nil
}

func (r *ChannelRepo) UpdateFunnelWithSubscriptionTx(ctx context.Context, f *ChannelFunnel, oldOutputChatID, newOutputChatID int64, oldChannelID, newChannelID uuid.UUID) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Update the funnel
	if err := r.UpdateChannelFunnelTx(ctx, tx, f); err != nil {
		return fmt.Errorf("failed to update funnel: %w", err)
	}

	// Transfer subscription if output channel changed
	if oldOutputChatID != newOutputChatID {
		if err := r.TransferChannelSubscriptionTx(ctx, tx, oldChannelID, newChannelID); err != nil {
			return fmt.Errorf("failed to transfer subscription: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// IsExemptFromAutoLeave checks whether a channel or group is protected from automatic leaving.
// Protected items include:
// 1. Specific community channels: @Fragmentscommunity, @TheGramPrice, @Fragmentinvestort
// 2. Any channel configured in the Tasks/Quests section (table: quests)
func IsExemptFromAutoLeave(ctx context.Context, db *Database, chatID int64, chatTitle string) bool {
	cleanTitle := strings.ToLower(strings.TrimSpace(chatTitle))
	normalizedTitle := strings.ReplaceAll(strings.TrimPrefix(cleanTitle, "@"), " ", "")

	// 1. Check static exempt list (@Fragmentscommunity, @Fragmentinvestort)
	staticExempt := []string{
		"fragmentscommunity",
		"fragmentinvestort",
	}

	for _, name := range staticExempt {
		if normalizedTitle == name || strings.Contains(normalizedTitle, name) {
			return true
		}
	}

	if db == nil || db.Pool == nil {
		return false
	}

	// 2. Check dynamic task channels from quests table
	rows, err := db.Pool.Query(ctx, `SELECT config FROM quests WHERE is_active = true OR is_active IS NULL`)
	if err != nil {
		return false
	}
	defer rows.Close()

	for rows.Next() {
		var configBytes []byte
		if err := rows.Scan(&configBytes); err != nil {
			continue
		}

		if len(configBytes) == 0 {
			continue
		}

		var cfg map[string]interface{}
		if err := json.Unmarshal(configBytes, &cfg); err != nil {
			continue
		}

		// Check channel_username in config
		if chUsernameRaw, ok := cfg["channel_username"]; ok {
			if chUsernameStr, isStr := chUsernameRaw.(string); isStr && chUsernameStr != "" {
				chUserClean := strings.ToLower(strings.TrimSpace(chUsernameStr))
				chUserNorm := strings.ReplaceAll(strings.TrimPrefix(chUserClean, "@"), " ", "")
				if normalizedTitle == chUserNorm || strings.Contains(normalizedTitle, chUserNorm) {
					return true
				}
			}
		}

		// Check channel_id in config
		if chIDRaw, ok := cfg["channel_id"]; ok {
			var cfgID int64
			switch v := chIDRaw.(type) {
			case float64:
				cfgID = int64(v)
			case int64:
				cfgID = v
			}
			if cfgID != 0 && cfgID == chatID {
				return true
			}
		}
	}

	return false
}

// ─── Projects Architecture (Decoupled Funnel Model) ───────────────────

type Project struct {
	ID                      uuid.UUID       `json:"id"`
	OwnerUserID             int64           `json:"owner_user_id"`
	Name                    string          `json:"name"`
	Status                  string          `json:"status"` // "active", "expired", "cancelled", "paused"
	StarsSubscriptionActive bool            `json:"stars_subscription_active"`
	StarsExpiresAt          *time.Time      `json:"stars_expires_at,omitempty"`
	TrialUsed               bool            `json:"trial_used"`
	TrialEndsAt             *time.Time      `json:"trial_ends_at,omitempty"`
	SourceChannelID         *uuid.UUID      `json:"source_channel_id,omitempty"`
	TargetChannelID         *uuid.UUID      `json:"target_channel_id,omitempty"`
	SourceChatID            *int64          `json:"source_chat_id,omitempty"`
	TargetChatID            *int64          `json:"target_chat_id,omitempty"`
	PipelineConfig          json.RawMessage `json:"pipeline_config"`
	CreatedAt               time.Time       `json:"created_at"`
	UpdatedAt               time.Time       `json:"updated_at"`

	// Enriched fields for UI presentation
	SourceTitle    string `json:"source_title,omitempty"`
	TargetTitle    string `json:"target_title,omitempty"`
	SourceUsername string `json:"source_username,omitempty"`
	TargetUsername string `json:"target_username,omitempty"`
}

func (r *ChannelRepo) CreateProject(ctx context.Context, p *Project) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	if p.PipelineConfig == nil || len(p.PipelineConfig) == 0 {
		p.PipelineConfig = json.RawMessage("{}")
	}
	query := `INSERT INTO projects (
		owner_user_id, name, status, stars_subscription_active, stars_expires_at, trial_used, trial_ends_at,
		source_channel_id, target_channel_id, source_chat_id, target_chat_id, pipeline_config
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	RETURNING id, created_at, updated_at`
	return r.db.Pool.QueryRow(ctx, query,
		p.OwnerUserID, p.Name, p.Status, p.StarsSubscriptionActive, p.StarsExpiresAt, p.TrialUsed, p.TrialEndsAt,
		p.SourceChannelID, p.TargetChannelID, p.SourceChatID, p.TargetChatID, p.PipelineConfig,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (r *ChannelRepo) GetProjectsByOwner(ctx context.Context, ownerUserID int64) ([]*Project, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	query := `SELECT 
		p.id, p.owner_user_id, p.name, p.status, p.stars_subscription_active, p.stars_expires_at, p.trial_used, p.trial_ends_at,
		p.source_channel_id, p.target_channel_id, p.source_chat_id, p.target_chat_id, p.pipeline_config, p.created_at, p.updated_at,
		COALESCE(sc.chat_title, '') as source_title,
		COALESCE(tc.chat_title, '') as target_title,
		COALESCE(sc.chat_username, '') as source_username,
		COALESCE(tc.chat_username, '') as target_username
	FROM projects p
	LEFT JOIN managed_channels sc ON sc.id = p.source_channel_id
	LEFT JOIN managed_channels tc ON tc.id = p.target_channel_id
	WHERE p.owner_user_id = $1
	ORDER BY p.created_at DESC`

	rows, err := r.db.Pool.Query(ctx, query, ownerUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(
			&p.ID, &p.OwnerUserID, &p.Name, &p.Status, &p.StarsSubscriptionActive, &p.StarsExpiresAt, &p.TrialUsed, &p.TrialEndsAt,
			&p.SourceChannelID, &p.TargetChannelID, &p.SourceChatID, &p.TargetChatID, &p.PipelineConfig, &p.CreatedAt, &p.UpdatedAt,
			&p.SourceTitle, &p.TargetTitle, &p.SourceUsername, &p.TargetUsername,
		); err != nil {
			return nil, err
		}
		list = append(list, &p)
	}
	return list, nil
}

func (r *ChannelRepo) GetProjectByID(ctx context.Context, id uuid.UUID) (*Project, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	query := `SELECT 
		p.id, p.owner_user_id, p.name, p.status, p.stars_subscription_active, p.stars_expires_at, p.trial_used, p.trial_ends_at,
		p.source_channel_id, p.target_channel_id, p.source_chat_id, p.target_chat_id, p.pipeline_config, p.created_at, p.updated_at,
		COALESCE(sc.chat_title, '') as source_title,
		COALESCE(tc.chat_title, '') as target_title,
		COALESCE(sc.chat_username, '') as source_username,
		COALESCE(tc.chat_username, '') as target_username
	FROM projects p
	LEFT JOIN managed_channels sc ON sc.id = p.source_channel_id
	LEFT JOIN managed_channels tc ON tc.id = p.target_channel_id
	WHERE p.id = $1`

	var p Project
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.OwnerUserID, &p.Name, &p.Status, &p.StarsSubscriptionActive, &p.StarsExpiresAt, &p.TrialUsed, &p.TrialEndsAt,
		&p.SourceChannelID, &p.TargetChannelID, &p.SourceChatID, &p.TargetChatID, &p.PipelineConfig, &p.CreatedAt, &p.UpdatedAt,
		&p.SourceTitle, &p.TargetTitle, &p.SourceUsername, &p.TargetUsername,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *ChannelRepo) GetProjectsBySourceChatID(ctx context.Context, sourceChatID int64) ([]*Project, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	query := `SELECT 
		p.id, p.owner_user_id, p.name, p.status, p.stars_subscription_active, p.stars_expires_at, p.trial_used, p.trial_ends_at,
		p.source_channel_id, p.target_channel_id, p.source_chat_id, p.target_chat_id, p.pipeline_config, p.created_at, p.updated_at,
		COALESCE(sc.chat_title, '') as source_title,
		COALESCE(tc.chat_title, '') as target_title,
		COALESCE(sc.chat_username, '') as source_username,
		COALESCE(tc.chat_username, '') as target_username
	FROM projects p
	LEFT JOIN managed_channels sc ON sc.id = p.source_channel_id
	LEFT JOIN managed_channels tc ON tc.id = p.target_channel_id
	WHERE p.source_chat_id = $1 AND p.status = 'active'`

	rows, err := r.db.Pool.Query(ctx, query, sourceChatID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(
			&p.ID, &p.OwnerUserID, &p.Name, &p.Status, &p.StarsSubscriptionActive, &p.StarsExpiresAt, &p.TrialUsed, &p.TrialEndsAt,
			&p.SourceChannelID, &p.TargetChannelID, &p.SourceChatID, &p.TargetChatID, &p.PipelineConfig, &p.CreatedAt, &p.UpdatedAt,
			&p.SourceTitle, &p.TargetTitle, &p.SourceUsername, &p.TargetUsername,
		); err != nil {
			return nil, err
		}
		list = append(list, &p)
	}
	return list, nil
}

func (r *ChannelRepo) UpdateProject(ctx context.Context, p *Project) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	query := `UPDATE projects SET
		name = $1, status = $2, source_channel_id = $3, target_channel_id = $4,
		source_chat_id = $5, target_chat_id = $6, pipeline_config = $7, updated_at = now()
	WHERE id = $8`
	_, err := r.db.Pool.Exec(ctx, query,
		p.Name, p.Status, p.SourceChannelID, p.TargetChannelID,
		p.SourceChatID, p.TargetChatID, p.PipelineConfig, p.ID,
	)
	return err
}

func (r *ChannelRepo) UpdateProjectSubscription(ctx context.Context, id uuid.UUID, status string, starsActive bool, expiresAt *time.Time) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	query := `UPDATE projects SET
		status = $1, stars_subscription_active = $2, stars_expires_at = $3, updated_at = now()
	WHERE id = $4`
	_, err := r.db.Pool.Exec(ctx, query, status, starsActive, expiresAt, id)
	return err
}

func (r *ChannelRepo) DeleteProject(ctx context.Context, id uuid.UUID) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	query := `DELETE FROM projects WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

func (r *ChannelRepo) HasUserUsedProjectTrial(ctx context.Context, ownerUserID int64) (bool, error) {
	if r.db == nil || r.db.Pool == nil {
		return false, fmt.Errorf("database pool is not initialized")
	}
	var count int
	err := r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM projects WHERE owner_user_id = $1 AND trial_used = true`, ownerUserID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *ChannelRepo) GetExpiredProjects(ctx context.Context) ([]*Project, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database pool is not initialized")
	}
	query := `SELECT id, owner_user_id, name, status, stars_subscription_active, stars_expires_at, trial_used, trial_ends_at,
		source_channel_id, target_channel_id, source_chat_id, target_chat_id, pipeline_config, created_at, updated_at
	FROM projects
	WHERE status = 'active' AND (
		(stars_subscription_active = true AND stars_expires_at IS NOT NULL AND stars_expires_at < now()) OR
		(stars_subscription_active = false AND trial_ends_at IS NOT NULL AND trial_ends_at < now())
	)`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(
			&p.ID, &p.OwnerUserID, &p.Name, &p.Status, &p.StarsSubscriptionActive, &p.StarsExpiresAt, &p.TrialUsed, &p.TrialEndsAt,
			&p.SourceChannelID, &p.TargetChannelID, &p.SourceChatID, &p.TargetChatID, &p.PipelineConfig, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, &p)
	}
	return list, nil
}


