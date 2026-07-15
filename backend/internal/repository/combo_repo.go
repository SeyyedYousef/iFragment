package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

type DailyCombo struct {
	ID           int       `json:"id"`
	ActiveDate   time.Time `json:"active_date"`
	SecretWord   string    `json:"secret_word"`
	RewardAmount int64     `json:"reward_amount"`
}

func (db *Database) GetTodayCombo(ctx context.Context) (*DailyCombo, error) {
	if db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}
	var combo DailyCombo
	err := db.Pool.QueryRow(ctx, `
		SELECT id, active_date, secret_word, reward_amount 
		FROM daily_combos 
		WHERE active_date = CURRENT_DATE
	`).Scan(&combo.ID, &combo.ActiveDate, &combo.SecretWord, &combo.RewardAmount)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // No combo today
		}
		return nil, err
	}
	return &combo, nil
}

func (db *Database) ClaimDailyCombo(ctx context.Context, userID int64, comboID int) error {
	if db.Pool == nil {
		return fmt.Errorf("no database connection")
	}
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO user_daily_combo_claims (user_id, combo_id)
		VALUES ($1, $2)
	`, userID, comboID)
	return err
}

func (db *Database) HasClaimedCombo(ctx context.Context, userID int64, comboID int) (bool, error) {
	if db.Pool == nil {
		return false, fmt.Errorf("no database connection")
	}
	var exists bool
	err := db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM user_daily_combo_claims 
			WHERE user_id = $1 AND combo_id = $2
		)
	`, userID, comboID).Scan(&exists)
	return exists, err
}

func (db *Database) AdminListCombos(ctx context.Context) ([]DailyCombo, error) {
	if db.Pool == nil {
		return nil, fmt.Errorf("no db")
	}
	rows, err := db.Pool.Query(ctx, `
		SELECT id, active_date, secret_word, reward_amount 
		FROM daily_combos 
		ORDER BY active_date DESC LIMIT 50
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var combos []DailyCombo
	for rows.Next() {
		var c DailyCombo
		if err := rows.Scan(&c.ID, &c.ActiveDate, &c.SecretWord, &c.RewardAmount); err == nil {
			combos = append(combos, c)
		}
	}
	return combos, nil
}

func (db *Database) AdminUpsertCombo(ctx context.Context, date time.Time, word string, reward int64) error {
	if db.Pool == nil {
		return fmt.Errorf("no db")
	}
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO daily_combos (active_date, secret_word, reward_amount)
		VALUES ($1, $2, $3)
		ON CONFLICT (active_date) DO UPDATE 
		SET secret_word = EXCLUDED.secret_word, reward_amount = EXCLUDED.reward_amount
	`, date.Format("2006-01-02"), word, reward)
	return err
}
