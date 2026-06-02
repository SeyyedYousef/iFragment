package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
)

type GroupEvent struct {
	ID        uuid.UUID `json:"id"`
	GroupID   uuid.UUID `json:"group_id"`
	EventType string   `json:"event_type"`
	UserID    *int64   `json:"user_id,omitempty"`
	Payload   []byte   `json:"payload,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type DailyMetric struct {
	Date  string `json:"date"`
	Value int    `json:"value"`
}

type TopUser struct {
	UserID   int64  `json:"user_id"`
	Name     string `json:"name"`     // Note: Name might need to be fetched separately or logged in payload
	MsgCount int    `json:"msgs"`
}

type AnalyticsSummary struct {
	TotalMembers    int       `json:"total_members"`
	MembersChange   int       `json:"members_change"`
	TotalMessages   int       `json:"total_messages"`
	MessagesChange  float64   `json:"messages_change_pct"`
	SpamBlocked     int       `json:"spam_blocked"`
	NewMembers      int       `json:"new_members"`
	MembersLeft     int       `json:"members_left"`
	ActiveUsers     int       `json:"active_users"`
	TopUsers        []TopUser `json:"top_users"`
}

type AnalyticsRepo struct {
	db *Database
}

var (
	eventChan chan *GroupEvent
	startOnce sync.Once
)

func startAsyncWorkers(db *Database) {
	eventChan = make(chan *GroupEvent, 5000)
	for i := 0; i < 4; i++ {
		go func() {
			for event := range eventChan {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				query := `INSERT INTO group_events (group_id, event_type, user_id, payload)
					VALUES ($1, $2, $3, $4)`
				_, err := db.Pool.Exec(ctx, query, event.GroupID, event.EventType, event.UserID, event.Payload)
				if err != nil {
					slog.Error("Failed to log analytics event async", "error", err, "event_type", event.EventType)
				}
				cancel()
			}
		}()
	}
}

func NewAnalyticsRepo(db *Database) *AnalyticsRepo {
	startOnce.Do(func() {
		startAsyncWorkers(db)
	})
	return &AnalyticsRepo{db: db}
}

func (r *AnalyticsRepo) LogEvent(ctx context.Context, event *GroupEvent) error {
	query := `INSERT INTO group_events (group_id, event_type, user_id, payload)
		VALUES ($1, $2, $3, $4) RETURNING id, created_at`
	return r.db.Pool.QueryRow(ctx, query, event.GroupID, event.EventType, event.UserID, event.Payload).
		Scan(&event.ID, &event.CreatedAt)
}

// LogEventAsync queues the event for async insertion, decoupling webhook latency from DB writes.
// Uses a buffered channel internally so callers never block.
func (r *AnalyticsRepo) LogEventAsync(event *GroupEvent) {
	if eventChan == nil {
		slog.Warn("Analytics async worker not initialized, dropping event", "event_type", event.EventType)
		return
	}
	select {
	case eventChan <- event:
	default:
		slog.Warn("Analytics event channel full, dropping event", "event_type", event.EventType)
	}
}

// GetSummary retrieves analytics summary for a group.
// Optimization: Ensure composite index on (group_id, event_type, created_at) exists in DB.
func (r *AnalyticsRepo) GetSummary(ctx context.Context, groupID uuid.UUID, days int) (*AnalyticsSummary, error) {
	since := time.Now().AddDate(0, 0, -days)
	summary := &AnalyticsSummary{}

	query := `
		SELECT 
			COALESCE(COUNT(*) FILTER (WHERE event_type = 'message'), 0),
			COALESCE(COUNT(*) FILTER (WHERE event_type = 'member_join'), 0),
			COALESCE(COUNT(*) FILTER (WHERE event_type = 'member_leave'), 0),
			COALESCE(COUNT(*) FILTER (WHERE event_type = 'spam_blocked'), 0),
			COALESCE(COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'message'), 0)
		FROM group_events 
		WHERE group_id = $1 AND created_at >= $2
	`

	err := r.db.Pool.QueryRow(ctx, query, groupID, since).Scan(
		&summary.TotalMessages,
		&summary.NewMembers,
		&summary.MembersLeft,
		&summary.SpamBlocked,
		&summary.ActiveUsers,
	)
	if err != nil {
		return nil, err
	}

	summary.MembersChange = summary.NewMembers - summary.MembersLeft
	summary.TopUsers, _ = r.GetTopUsers(ctx, groupID, days, 5)
	return summary, nil
}

func (r *AnalyticsRepo) GetTopUsers(ctx context.Context, groupID uuid.UUID, days int, limit int) ([]TopUser, error) {
	since := time.Now().AddDate(0, 0, -days)
	query := `SELECT user_id, COUNT(*) as msgs, MAX(payload)
		FROM group_events 
		WHERE group_id = $1 AND event_type = 'message' AND created_at >= $2 AND user_id IS NOT NULL
		GROUP BY user_id 
		ORDER BY msgs DESC 
		LIMIT $3`
	
	rows, err := r.db.Pool.Query(ctx, query, groupID, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []TopUser
	for rows.Next() {
		var u TopUser
		var payload []byte
		if err := rows.Scan(&u.UserID, &u.MsgCount, &payload); err != nil {
			return nil, err
		}
		
		u.Name = fmt.Sprintf("User %d", u.UserID)
		if payload != nil {
			var p map[string]string
			if err := json.Unmarshal(payload, &p); err == nil && p["name"] != "" {
				u.Name = p["name"]
			}
		}
		users = append(users, u)
	}
	return users, nil
}

func (r *AnalyticsRepo) GetGrowthTimeline(ctx context.Context, groupID uuid.UUID, days int) ([]DailyMetric, error) {
	since := time.Now().AddDate(0, 0, -days)
	query := `SELECT to_char(created_at::date, 'YYYY-MM-DD') as day, COUNT(*)
		FROM group_events WHERE group_id = $1 AND event_type = 'member_join' AND created_at >= $2
		GROUP BY created_at::date ORDER BY created_at::date`
	rows, err := r.db.Pool.Query(ctx, query, groupID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var metrics []DailyMetric
	for rows.Next() {
		var m DailyMetric
		if err := rows.Scan(&m.Date, &m.Value); err != nil {
			return nil, err
		}
		metrics = append(metrics, m)
	}
	return metrics, nil
}

func (r *AnalyticsRepo) GetActivityTimeline(ctx context.Context, groupID uuid.UUID, days int) ([]DailyMetric, error) {
	since := time.Now().AddDate(0, 0, -days)
	query := `SELECT to_char(created_at::date, 'YYYY-MM-DD') as day, COUNT(*)
		FROM group_events WHERE group_id = $1 AND event_type = 'message' AND created_at >= $2
		GROUP BY created_at::date ORDER BY created_at::date`
	rows, err := r.db.Pool.Query(ctx, query, groupID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var metrics []DailyMetric
	for rows.Next() {
		var m DailyMetric
		if err := rows.Scan(&m.Date, &m.Value); err != nil {
			return nil, err
		}
		metrics = append(metrics, m)
	}
	return metrics, nil
}
func (r *AnalyticsRepo) GetUserWarningsCount(ctx context.Context, groupID uuid.UUID, userID int64, days int) (int, error) {
	since := time.Now().AddDate(0, 0, -days)
	var count int
	err := r.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM group_events 
		 WHERE group_id = $1 AND user_id = $2 AND event_type = 'member_warned' AND created_at >= $3`,
		groupID, userID, since,
	).Scan(&count)
	return count, err
}
