package repository

import (
	"context"
	"time"
)

// RaffleTicket represents an individual message entry in the daily raffle.
type RaffleTicket struct {
	ID         int64     `json:"id"`
	RaffleDate time.Time `json:"raffle_date"`
	ChatID     int64     `json:"chat_id"`
	UserID     int64     `json:"user_id"`
	Username   string    `json:"username"`
	FirstName  string    `json:"first_name"`
	MessageID  int       `json:"message_id"`
	CreatedAt  time.Time `json:"created_at"`
}

// RaffleParticipant represents a unique user participant in a daily draw.
type RaffleParticipant struct {
	UserID    int64  `json:"user_id"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
}

// DailyGiftDraw represents a completed and locked daily raffle draw.
type DailyGiftDraw struct {
	ID                int64     `json:"id"`
	DrawDate          time.Time `json:"draw_date"`
	TotalMessages     int       `json:"total_messages"`
	TotalParticipants int       `json:"total_participants"`
	WinnerUserID      int64     `json:"winner_user_id"`
	WinnerUsername    string    `json:"winner_username"`
	WinnerFirstName   string    `json:"winner_first_name"`
	PrizeUSD          float64   `json:"prize_usd"`
	PrizeStars        int       `json:"prize_stars"`
	GiftID            string    `json:"gift_id,omitempty"`
	GiftTitle         string    `json:"gift_title,omitempty"`
	AutoSent          bool      `json:"auto_sent"`
	LockStatus        string    `json:"lock_status"` // "LOCKED"
	NotifiedOwner     bool      `json:"notified_owner"`
	CreatedAt         time.Time `json:"created_at"`
}

// RaffleRepo manages persistence for daily raffle tickets and locked daily draws.
type RaffleRepo struct {
	db *Database
}

// NewRaffleRepo creates a new RaffleRepo instance.
func NewRaffleRepo(db *Database) *RaffleRepo {
	return &RaffleRepo{db: db}
}

// DB returns the underlying Database instance.
func (r *RaffleRepo) DB() *Database {
	return r.db
}

// AddRaffleTicket records a message ticket for a user in the daily raffle.
func (r *RaffleRepo) AddRaffleTicket(ctx context.Context, ticket *RaffleTicket) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	query := `INSERT INTO fragment_investors_raffle_tickets 
		(raffle_date, chat_id, user_id, username, first_name, message_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id`

	dateStr := ticket.RaffleDate.Format("2006-01-02")
	return r.db.Pool.QueryRow(ctx, query,
		dateStr,
		ticket.ChatID,
		ticket.UserID,
		ticket.Username,
		ticket.FirstName,
		ticket.MessageID,
		ticket.CreatedAt,
	).Scan(&ticket.ID)
}

// GetDailyRaffleStats retrieves total messages, unique participants count, and if user entered today.
func (r *RaffleRepo) GetDailyRaffleStats(ctx context.Context, date time.Time, userID int64) (uniqueParticipants int, totalMessages int, userEntered bool, err error) {
	if r.db == nil || r.db.Pool == nil {
		return 1, 1, true, nil
	}

	query := `SELECT 
		COUNT(*)::INT AS total_messages,
		COUNT(DISTINCT user_id)::INT AS unique_participants,
		EXISTS(SELECT 1 FROM fragment_investors_raffle_tickets WHERE raffle_date = $1 AND user_id = $2) AS user_entered
	FROM fragment_investors_raffle_tickets
	WHERE raffle_date = $1`

	dateStr := date.Format("2006-01-02")
	err = r.db.Pool.QueryRow(ctx, query, dateStr, userID).Scan(&totalMessages, &uniqueParticipants, &userEntered)
	if err != nil {
		return 0, 0, false, err
	}
	return uniqueParticipants, totalMessages, userEntered, nil
}

// GetDailyUniqueParticipants retrieves deduplicated participants who sent at least 1 message on the given date.
func (r *RaffleRepo) GetDailyUniqueParticipants(ctx context.Context, date time.Time) ([]RaffleParticipant, int, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, 0, nil
	}

	dateStr := date.Format("2006-01-02")

	// 1. Get total message count for pool calculation
	var totalMessages int
	countQuery := `SELECT COUNT(*)::INT FROM fragment_investors_raffle_tickets WHERE raffle_date = $1`
	if err := r.db.Pool.QueryRow(ctx, countQuery, dateStr).Scan(&totalMessages); err != nil {
		return nil, 0, err
	}

	// 2. Deduplicate: each unique user gets exactly 1 entry
	distinctQuery := `SELECT DISTINCT ON (user_id) user_id, username, first_name
	FROM fragment_investors_raffle_tickets
	WHERE raffle_date = $1
	ORDER BY user_id, id ASC`

	rows, err := r.db.Pool.Query(ctx, distinctQuery, dateStr)
	if err != nil {
		return nil, totalMessages, err
	}
	defer rows.Close()

	var participants []RaffleParticipant
	for rows.Next() {
		var p RaffleParticipant
		if err := rows.Scan(&p.UserID, &p.Username, &p.FirstName); err != nil {
			return nil, totalMessages, err
		}
		participants = append(participants, p)
	}

	return participants, totalMessages, rows.Err()
}

// IsDailyDrawLocked checks if daily_gift_draws has already been drawn and locked for the given date.
func (r *RaffleRepo) IsDailyDrawLocked(ctx context.Context, date time.Time) (bool, error) {
	if r.db == nil || r.db.Pool == nil {
		return false, nil
	}

	query := `SELECT EXISTS (
		SELECT 1 FROM daily_gift_draws WHERE draw_date = $1
	)`

	dateStr := date.Format("2006-01-02")
	var exists bool
	err := r.db.Pool.QueryRow(ctx, query, dateStr).Scan(&exists)
	return exists, err
}

// LockDailyDraw inserts and locks the completed daily draw record.
func (r *RaffleRepo) LockDailyDraw(ctx context.Context, draw *DailyGiftDraw) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}

	query := `INSERT INTO daily_gift_draws (
		draw_date, total_messages, total_participants, winner_user_id, winner_username,
		winner_first_name, prize_usd, prize_stars, gift_id, gift_title, auto_sent,
		lock_status, notified_owner, created_at
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	ON CONFLICT (draw_date) DO UPDATE SET
		gift_id = EXCLUDED.gift_id,
		gift_title = EXCLUDED.gift_title,
		auto_sent = EXCLUDED.auto_sent,
		notified_owner = EXCLUDED.notified_owner
	RETURNING id`

	dateStr := draw.DrawDate.Format("2006-01-02")
	return r.db.Pool.QueryRow(ctx, query,
		dateStr,
		draw.TotalMessages,
		draw.TotalParticipants,
		draw.WinnerUserID,
		draw.WinnerUsername,
		draw.WinnerFirstName,
		draw.PrizeUSD,
		draw.PrizeStars,
		draw.GiftID,
		draw.GiftTitle,
		draw.AutoSent,
		draw.LockStatus,
		draw.NotifiedOwner,
		draw.CreatedAt,
	).Scan(&draw.ID)
}

// GetLatestDailyDraw retrieves the most recent locked daily gift draw.
func (r *RaffleRepo) GetLatestDailyDraw(ctx context.Context) (*DailyGiftDraw, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, nil
	}

	query := `SELECT id, draw_date, total_messages, total_participants, winner_user_id,
		winner_username, winner_first_name, prize_usd, prize_stars, gift_id, gift_title,
		auto_sent, lock_status, notified_owner, created_at
	FROM daily_gift_draws
	ORDER BY draw_date DESC
	LIMIT 1`

	var d DailyGiftDraw
	err := r.db.Pool.QueryRow(ctx, query).Scan(
		&d.ID,
		&d.DrawDate,
		&d.TotalMessages,
		&d.TotalParticipants,
		&d.WinnerUserID,
		&d.WinnerUsername,
		&d.WinnerFirstName,
		&d.PrizeUSD,
		&d.PrizeStars,
		&d.GiftID,
		&d.GiftTitle,
		&d.AutoSent,
		&d.LockStatus,
		&d.NotifiedOwner,
		&d.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// GetUserRaffleWins retrieves all wins by a specific user.
func (r *RaffleRepo) GetUserRaffleWins(ctx context.Context, userID int64) ([]DailyGiftDraw, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, nil
	}

	query := `SELECT id, draw_date, total_messages, total_participants, winner_user_id,
		winner_username, winner_first_name, prize_usd, prize_stars, gift_id, gift_title,
		auto_sent, lock_status, notified_owner, created_at
	FROM daily_gift_draws
	WHERE winner_user_id = $1
	ORDER BY draw_date DESC`

	rows, err := r.db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var wins []DailyGiftDraw
	for rows.Next() {
		var d DailyGiftDraw
		if err := rows.Scan(
			&d.ID,
			&d.DrawDate,
			&d.TotalMessages,
			&d.TotalParticipants,
			&d.WinnerUserID,
			&d.WinnerUsername,
			&d.WinnerFirstName,
			&d.PrizeUSD,
			&d.PrizeStars,
			&d.GiftID,
			&d.GiftTitle,
			&d.AutoSent,
			&d.LockStatus,
			&d.NotifiedOwner,
			&d.CreatedAt,
		); err != nil {
			return nil, err
		}
		wins = append(wins, d)
	}
	return wins, rows.Err()
}
