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

func (r *ChannelRepo) GetChannelsByBot(ctx context.Context, botID uuid.UUID, cursor *time.Time, limit int) ([]ManagedChannel, *time.Time, error) {
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
		}, nil, nil
	}

	var query string
	var args []interface{}
	
	if limit <= 0 {
		limit = 20
	}

	if cursor != nil {
		query = `SELECT id, bot_id, chat_id, chat_title, subscribers_count, subscription_status, trial_ends_at, paid_until, linked_chat_id, slow_mode_delay, auto_delete_time, sign_messages, protect_content, created_at, updated_at
			FROM managed_channels 
			WHERE bot_id = $1 AND created_at < $2 AND deleted_at IS NULL 
			ORDER BY created_at DESC LIMIT $3`
		args = []interface{}{botID, *cursor, limit}
	} else {
		query = `SELECT id, bot_id, chat_id, chat_title, subscribers_count, subscription_status, trial_ends_at, paid_until, linked_chat_id, slow_mode_delay, auto_delete_time, sign_messages, protect_content, created_at, updated_at
			FROM managed_channels 
			WHERE bot_id = $1 AND deleted_at IS NULL 
			ORDER BY created_at DESC LIMIT $2`
		args = []interface{}{botID, limit}
	}
	
	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, nil, err
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
			return nil, nil, err
		}
		channels = append(channels, c)
	}

	var nextCursor *time.Time
	if len(channels) == limit && limit > 0 {
		lastChannel := channels[len(channels)-1]
		nextCursor = &lastChannel.CreatedAt
	}

	return channels, nextCursor, nil
}

func (r *ChannelRepo) GetChannelsByOwner(ctx context.Context, ownerUserID int64, cursor *time.Time, limit int) ([]ManagedChannel, *time.Time, error) {
	if r.db == nil || r.db.Pool == nil {
		return []ManagedChannel{}, nil, nil
	}

	var query string
	var args []interface{}

	if limit <= 0 {
		limit = 20
	}

	if cursor != nil {
		query = `SELECT c.id, c.bot_id, c.chat_id, c.chat_title, c.subscribers_count, c.subscription_status, c.trial_ends_at, c.paid_until, c.linked_chat_id, c.slow_mode_delay, c.auto_delete_time, c.sign_messages, c.protect_content, c.created_at, c.updated_at
			FROM managed_channels c
			JOIN managed_bots b ON c.bot_id = b.id
			WHERE b.owner_user_id = $1 AND c.created_at < $2 AND c.deleted_at IS NULL 
			ORDER BY c.created_at DESC LIMIT $3`
		args = []interface{}{ownerUserID, *cursor, limit}
	} else {
		query = `SELECT c.id, c.bot_id, c.chat_id, c.chat_title, c.subscribers_count, c.subscription_status, c.trial_ends_at, c.paid_until, c.linked_chat_id, c.slow_mode_delay, c.auto_delete_time, c.sign_messages, c.protect_content, c.created_at, c.updated_at
			FROM managed_channels c
			JOIN managed_bots b ON c.bot_id = b.id
			WHERE b.owner_user_id = $1 AND c.deleted_at IS NULL 
			ORDER BY c.created_at DESC LIMIT $2`
		args = []interface{}{ownerUserID, limit}
	}
	
	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, nil, err
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
			return nil, nil, err
		}
		channels = append(channels, c)
	}

	var nextCursor *time.Time
	if len(channels) == limit && limit > 0 {
		lastChannel := channels[len(channels)-1]
		nextCursor = &lastChannel.CreatedAt
	}

	return channels, nextCursor, nil
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
	if r.db == nil || r.db.Pool == nil {
		return r.GetChannelSettings(ctx, channelID)
	}

	var query string
	switch category {
	case "general":
		query = `UPDATE channel_settings SET general = $1, version = version + 1, updated_at = now(), updated_by = $2
			WHERE channel_id = $3 AND version = $4
			RETURNING version, updated_at`
	case "posting":
		query = `UPDATE channel_settings SET posting = $1, version = version + 1, updated_at = now(), updated_by = $2
			WHERE channel_id = $3 AND version = $4
			RETURNING version, updated_at`
	case "forwarding":
		query = `UPDATE channel_settings SET forwarding = $1, version = version + 1, updated_at = now(), updated_by = $2
			WHERE channel_id = $3 AND version = $4
			RETURNING version, updated_at`
	case "inline_buttons":
		query = `UPDATE channel_settings SET inline_buttons = $1, version = version + 1, updated_at = now(), updated_by = $2
			WHERE channel_id = $3 AND version = $4
			RETURNING version, updated_at`
	case "dynamic_bio":
		query = `UPDATE channel_settings SET dynamic_bio = $1, version = version + 1, updated_at = now(), updated_by = $2
			WHERE channel_id = $3 AND version = $4
			RETURNING version, updated_at`
	case "auto_responder":
		query = `UPDATE channel_settings SET auto_responder = $1, version = version + 1, updated_at = now(), updated_by = $2
			WHERE channel_id = $3 AND version = $4
			RETURNING version, updated_at`
	default:
		return nil, fmt.Errorf("invalid channel settings category: %s", category)
	}

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
		log.ID = uuid.New()
		log.CreatedAt = time.Now()
		return nil
	}

	query := `INSERT INTO channel_audit_logs (channel_id, actor_id, action, target_type, target_id, old_value, new_value, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`
	
	return r.db.Pool.QueryRow(ctx, query,
		log.ChannelID, log.ActorID, log.Action, log.TargetType, log.TargetID, log.OldValue, log.NewValue, log.Metadata,
	).Scan(&log.ID, &log.CreatedAt)
}

// GetAuditLogs loads paginated audit logs for a specific channel
func (r *ChannelRepo) GetAuditLogs(ctx context.Context, channelID uuid.UUID, limit, offset int) ([]ChannelAuditLog, error) {
	if r.db == nil || r.db.Pool == nil {
		return []ChannelAuditLog{
			{
				ID:        uuid.New(),
				ChannelID: channelID,
				ActorID:   12345,
				Action:    "channel.mock_action",
				CreatedAt: time.Now(),
			},
		}, nil
	}

	query := `SELECT id, channel_id, actor_id, action, target_type, target_id, old_value, new_value, metadata, created_at
		FROM channel_audit_logs WHERE channel_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	
	rows, err := r.db.Pool.Query(ctx, query, channelID, limit, offset)
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
	return logs, nil
}

// SaveAnalyticsSnapshot inserts or updates a daily analytics snapshot
func (r *ChannelRepo) SaveAnalyticsSnapshot(ctx context.Context, snapshot *ChannelAnalytics) error {
	if r.db == nil || r.db.Pool == nil {
		snapshot.ID = uuid.New()
		snapshot.CreatedAt = time.Now()
		return nil
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
func (r *ChannelRepo) GetAnalyticsTimeline(ctx context.Context, channelID uuid.UUID, days int) ([]ChannelAnalytics, error) {
	if r.db == nil || r.db.Pool == nil {
		var out []ChannelAnalytics
		now := time.Now()
		for i := days - 1; i >= 0; i-- {
			out = append(out, ChannelAnalytics{
				ID:               uuid.New(),
				ChannelID:        channelID,
				SnapshotDate:     now.AddDate(0, 0, -i),
				SubscribersCount: 12000 + i*10,
				NewSubscribers:   10,
				ViewsCount:       45000 + i*100,
				ReactionsCount:   80,
				PostsCount:       3,
				CreatedAt:        now.AddDate(0, 0, -i),
			})
		}
		return out, nil
	}

	query := `SELECT id, channel_id, snapshot_date, subscribers_count, new_subscribers, views_count, reactions_count, posts_count, created_at
		FROM channel_analytics WHERE channel_id = $1 ORDER BY snapshot_date ASC LIMIT $2`
	
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
	return snapshots, nil
}

// CreatePost schedules or registers a post entry
func (r *ChannelRepo) CreatePost(ctx context.Context, post *ChannelPost) error {
	if r.db == nil || r.db.Pool == nil {
		post.ID = uuid.New()
		post.CreatedAt = time.Now()
		return nil
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
		return nil, nil
	}

	query := `SELECT id, channel_id, telegram_message_id, author_user_id, text, has_media, views_count, reactions_count, forwards_count, is_pinned, scheduled_at, posted_at, created_at
		FROM channel_posts WHERE scheduled_at <= now() AND posted_at IS NULL`
	
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
	return posts, nil
}

// MarkPostAsPublished marks a scheduled post as successfully published
func (r *ChannelRepo) MarkPostAsPublished(ctx context.Context, postID uuid.UUID, telegramMsgID int64) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	query := `UPDATE channel_posts SET telegram_message_id = $1, posted_at = now() WHERE id = $2`
	_, err := r.db.Pool.Exec(ctx, query, telegramMsgID, postID)
	return err
}

// GetAllChannels retrieves all active (non-deleted) managed channels in the system
func (r *ChannelRepo) GetAllChannels(ctx context.Context) ([]ManagedChannel, error) {
	if r.db == nil || r.db.Pool == nil {
		return []ManagedChannel{}, nil
	}

	query := `SELECT id, bot_id, chat_id, chat_title, subscribers_count, subscription_status, trial_ends_at, paid_until, linked_chat_id, slow_mode_delay, auto_delete_time, sign_messages, protect_content, created_at, updated_at
		FROM managed_channels WHERE deleted_at IS NULL`
	
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
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		channels = append(channels, c)
	}
	return channels, nil
}

// UpdateChannelSubscribers updates the cached subscribers count for a channel
func (r *ChannelRepo) UpdateChannelSubscribers(ctx context.Context, channelID uuid.UUID, subscribersCount int) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	query := `UPDATE managed_channels SET subscribers_count = $1, updated_at = now() WHERE id = $2`
	_, err := r.db.Pool.Exec(ctx, query, subscribersCount, channelID)
	return err
}

type ChannelForwardingRule struct {
	ID             uuid.UUID       `json:"id"`
	ChannelID      uuid.UUID       `json:"channel_id"`
	Direction      string          `json:"direction"`
	TargetType     string          `json:"target_type"`
	Target         string          `json:"target"`
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
	CreatedAt  time.Time `json:"created_at"`
}

// CreateForwardingRule creates a new channel forwarding rule
func (r *ChannelRepo) CreateForwardingRule(ctx context.Context, rule *ChannelForwardingRule) error {
	if r.db == nil || r.db.Pool == nil {
		rule.ID = uuid.New()
		rule.CreatedAt = time.Now()
		return nil
	}

	query := `INSERT INTO channel_forwarding_rules (channel_id, direction, target_type, target, mode, delay, is_active, content_types, remove_ads, remove_hashtags, remove_links, watermark)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at`
	
	return r.db.Pool.QueryRow(ctx, query,
		rule.ChannelID, rule.Direction, rule.TargetType, rule.Target, rule.Mode, rule.Delay, rule.IsActive,
		rule.ContentTypes, rule.RemoveAds, rule.RemoveHashtags, rule.RemoveLinks, rule.Watermark,
	).Scan(&rule.ID, &rule.CreatedAt)
}

// GetForwardingRules retrieves all forwarding rules for a channel
func (r *ChannelRepo) GetForwardingRules(ctx context.Context, channelID uuid.UUID) ([]ChannelForwardingRule, error) {
	if r.db == nil || r.db.Pool == nil {
		return []ChannelForwardingRule{}, nil
	}

	query := `SELECT id, channel_id, direction, target_type, target, mode, delay, is_active, content_types, remove_ads, remove_hashtags, remove_links, watermark, created_at
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
			&rl.ID, &rl.ChannelID, &rl.Direction, &rl.TargetType, &rl.Target, &rl.Mode, &rl.Delay, &rl.IsActive,
			&rl.ContentTypes, &rl.RemoveAds, &rl.RemoveHashtags, &rl.RemoveLinks, &rl.Watermark, &rl.CreatedAt,
		); err != nil {
			return nil, err
		}
		rules = append(rules, rl)
	}
	return rules, nil
}

// UpdateForwardingRule updates an existing forwarding rule
func (r *ChannelRepo) UpdateForwardingRule(ctx context.Context, rule *ChannelForwardingRule) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	query := `UPDATE channel_forwarding_rules SET direction = $1, target_type = $2, target = $3, mode = $4, delay = $5, is_active = $6, content_types = $7, remove_ads = $8, remove_hashtags = $9, remove_links = $10, watermark = $11
		WHERE id = $12`
	
	_, err := r.db.Pool.Exec(ctx, query,
		rule.Direction, rule.TargetType, rule.Target, rule.Mode, rule.Delay, rule.IsActive,
		rule.ContentTypes, rule.RemoveAds, rule.RemoveHashtags, rule.RemoveLinks, rule.Watermark, rule.ID,
	)
	return err
}

// DeleteForwardingRule deletes a forwarding rule
func (r *ChannelRepo) DeleteForwardingRule(ctx context.Context, ruleID uuid.UUID) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	query := `DELETE FROM channel_forwarding_rules WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, ruleID)
	return err
}

// GetActiveForwardingRulesBySource retrieves active rules (inbound or outbound) by a target username or ID
func (r *ChannelRepo) GetActiveForwardingRulesBySource(ctx context.Context, target string) ([]ChannelForwardingRule, error) {
	if r.db == nil || r.db.Pool == nil {
		return []ChannelForwardingRule{}, nil
	}

	query := `SELECT id, channel_id, direction, target_type, target, mode, delay, is_active, content_types, remove_ads, remove_hashtags, remove_links, watermark, created_at
		FROM channel_forwarding_rules WHERE target = $1 AND is_active = true`
	
	rows, err := r.db.Pool.Query(ctx, query, target)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []ChannelForwardingRule
	for rows.Next() {
		var rl ChannelForwardingRule
		if err := rows.Scan(
			&rl.ID, &rl.ChannelID, &rl.Direction, &rl.TargetType, &rl.Target, &rl.Mode, &rl.Delay, &rl.IsActive,
			&rl.ContentTypes, &rl.RemoveAds, &rl.RemoveHashtags, &rl.RemoveLinks, &rl.Watermark, &rl.CreatedAt,
		); err != nil {
			return nil, err
		}
		rules = append(rules, rl)
	}
	return rules, nil
}

// SyncChannelAdmins synchronizes Telegram administrators list locally
func (r *ChannelRepo) SyncChannelAdmins(ctx context.Context, channelID uuid.UUID, admins []ChannelAdmin) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Step 1: Insert/Update active admins
	var activeIDs []int64
	for _, admin := range admins {
		activeIDs = append(activeIDs, admin.TelegramID)
		query := `INSERT INTO channel_admins (channel_id, telegram_id, username, first_name, custom_title, is_owner)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (channel_id, telegram_id) DO UPDATE SET
				username = EXCLUDED.username,
				first_name = EXCLUDED.first_name,
				custom_title = EXCLUDED.custom_title,
				is_owner = EXCLUDED.is_owner`
		_, err = tx.Exec(ctx, query, channelID, admin.TelegramID, admin.Username, admin.FirstName, admin.CustomTitle, admin.IsOwner)
		if err != nil {
			return err
		}
	}

	// Step 2: Delete inactive local admins
	if len(activeIDs) > 0 {
		query := `DELETE FROM channel_admins WHERE channel_id = $1 AND telegram_id != ALL($2)`
		_, err = tx.Exec(ctx, query, channelID, activeIDs)
		if err != nil {
			return err
		}
	} else {
		query := `DELETE FROM channel_admins WHERE channel_id = $1`
		_, err = tx.Exec(ctx, query, channelID)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// GetChannelAdmins returns local administrators list for a channel
func (r *ChannelRepo) GetChannelAdmins(ctx context.Context, channelID uuid.UUID) ([]ChannelAdmin, error) {
	if r.db == nil || r.db.Pool == nil {
		return []ChannelAdmin{}, nil
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
	return admins, nil
}

// SaveChannelButtons synchronizes interactive inline buttons for a channel
func (r *ChannelRepo) SaveChannelButtons(ctx context.Context, channelID uuid.UUID, buttons []ChannelInlineButton) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Step 1: Delete all current buttons
	_, err = tx.Exec(ctx, `DELETE FROM channel_inline_buttons WHERE channel_id = $1`, channelID)
	if err != nil {
		return err
	}

	// Step 2: Insert new ones
	for _, btn := range buttons {
		query := `INSERT INTO channel_inline_buttons (channel_id, title, value, type, style, emoji, click_count)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`
		_, err = tx.Exec(ctx, query, channelID, btn.Title, btn.Value, btn.Type, btn.Style, btn.Emoji, btn.ClickCount)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// GetChannelButtons returns inline buttons list for a channel
func (r *ChannelRepo) GetChannelButtons(ctx context.Context, channelID uuid.UUID) ([]ChannelInlineButton, error) {
	if r.db == nil || r.db.Pool == nil {
		return []ChannelInlineButton{}, nil
	}

	query := `SELECT id, channel_id, title, value, type, style, emoji, click_count, created_at
		FROM channel_inline_buttons WHERE channel_id = $1 ORDER BY created_at ASC`
	
	rows, err := r.db.Pool.Query(ctx, query, channelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var buttons []ChannelInlineButton
	for rows.Next() {
		var b ChannelInlineButton
		if err := rows.Scan(
			&b.ID, &b.ChannelID, &b.Title, &b.Value, &b.Type, &b.Style, &b.Emoji, &b.ClickCount, &b.CreatedAt,
		); err != nil {
			return nil, err
		}
		buttons = append(buttons, b)
	}
	return buttons, nil
}

// IncrementButtonClicks increments count of clicks for an inline button
func (r *ChannelRepo) IncrementButtonClicks(ctx context.Context, buttonID uuid.UUID) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	query := `UPDATE channel_inline_buttons SET click_count = click_count + 1 WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, buttonID)
	return err
}

// GetButtonByID retrieves an inline button by its UUID
func (r *ChannelRepo) GetButtonByID(ctx context.Context, buttonID uuid.UUID) (*ChannelInlineButton, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	query := `SELECT id, channel_id, title, value, type, style, emoji, click_count, created_at
		FROM channel_inline_buttons WHERE id = $1`

	var b ChannelInlineButton
	err := r.db.Pool.QueryRow(ctx, query, buttonID).Scan(
		&b.ID, &b.ChannelID, &b.Title, &b.Value, &b.Type, &b.Style, &b.Emoji, &b.ClickCount, &b.CreatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("button not found")
	}
	return &b, err
}



