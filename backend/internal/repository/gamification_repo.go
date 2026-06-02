package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
)

type DailyClaimState struct {
	UserID        int64      `json:"user_id"`
	LastClaimedAt *time.Time `json:"last_claimed_at"`
	Streak        int        `json:"streak"`
}

type UserBoosts struct {
	UserID           int64 `json:"user_id"`
	MultitapLevel    int   `json:"multitap_level"`
	EnergyLimitLevel int   `json:"energy_limit_level"`
	TapBotLevel      int   `json:"tap_bot_level"`
}

type UserTask struct {
	TaskKey     string     `json:"task_key"`
	Completed   bool       `json:"completed"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

// GetDailyClaimState returns the user's daily login reward claim status
func (db *Database) GetDailyClaimState(ctx context.Context, userID int64) (*DailyClaimState, error) {
	if db.Pool == nil {
		return &DailyClaimState{UserID: userID, Streak: 0}, nil
	}

	var state DailyClaimState
	query := "SELECT user_id, last_claimed_at, streak FROM user_daily_claims WHERE user_id = $1"
	err := db.Pool.QueryRow(ctx, query, userID).Scan(&state.UserID, &state.LastClaimedAt, &state.Streak)
	if err == pgx.ErrNoRows {
		return &DailyClaimState{UserID: userID, Streak: 0}, nil
	}
	return &state, err
}

// ClaimDailyReward records a successful daily reward claim
func (db *Database) ClaimDailyReward(ctx context.Context, userID int64, streak int) error {
	if db.Pool == nil {
		return nil
	}

	query := `
		INSERT INTO user_daily_claims (user_id, last_claimed_at, streak)
		VALUES ($1, CURRENT_TIMESTAMP, $2)
		ON CONFLICT (user_id) DO UPDATE
		SET last_claimed_at = CURRENT_TIMESTAMP, streak = $2
		WHERE (user_daily_claims.streak = $2 - 1) OR ($2 = 1)
	`
	_, err := db.Pool.Exec(ctx, query, userID, streak)
	return err
}

// GetUserBoosts returns user's upgrades (multitap, energy limit, tap bot)
func (db *Database) GetUserBoosts(ctx context.Context, userID int64) (*UserBoosts, error) {
	if db.Pool == nil {
		return &UserBoosts{UserID: userID, MultitapLevel: 1, EnergyLimitLevel: 1, TapBotLevel: 0}, nil
	}

	// Ensure record exists
	ensureQuery := `
		INSERT INTO user_boosts (user_id, multitap_level, energy_limit_level, tap_bot_level)
		VALUES ($1, 1, 1, 0)
		ON CONFLICT (user_id) DO NOTHING
	`
	_, _ = db.Pool.Exec(ctx, ensureQuery, userID)

	var boosts UserBoosts
	query := "SELECT user_id, multitap_level, energy_limit_level, tap_bot_level FROM user_boosts WHERE user_id = $1"
	err := db.Pool.QueryRow(ctx, query, userID).Scan(&boosts.UserID, &boosts.MultitapLevel, &boosts.EnergyLimitLevel, &boosts.TapBotLevel)
	return &boosts, err
}

// UpgradeUserBoost increments the level of a specific boost
func (db *Database) UpgradeUserBoost(ctx context.Context, userID int64, boostType string, nextLevel int) error {
	if db.Pool == nil {
		return nil
	}

	var query string
	switch boostType {
	case "multitap":
		query = "UPDATE user_boosts SET multitap_level = $1 WHERE user_id = $2 AND multitap_level = $1 - 1"
	case "energy_limit":
		query = "UPDATE user_boosts SET energy_limit_level = $1 WHERE user_id = $2 AND energy_limit_level = $1 - 1"
	case "tap_bot":
		query = "UPDATE user_boosts SET tap_bot_level = $1 WHERE user_id = $2 AND tap_bot_level = $1 - 1"
	default:
		return pgx.ErrNoRows
	}

	cmd, err := db.Pool.Exec(ctx, query, nextLevel, userID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return fmt.Errorf("optimistic lock conflict: level mismatch or concurrent update")
	}
	return nil
}

// GetUserTasks returns all completed and active tasks for a user
func (db *Database) GetUserTasks(ctx context.Context, userID int64) ([]UserTask, error) {
	if db.Pool == nil {
		return []UserTask{}, nil
	}

	query := "SELECT task_key, completed, completed_at FROM user_tasks WHERE user_id = $1"
	rows, err := db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []UserTask
	for rows.Next() {
		var t UserTask
		if err := rows.Scan(&t.TaskKey, &t.Completed, &t.CompletedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

// CompleteUserTask marks a specific task as completed
func (db *Database) CompleteUserTask(ctx context.Context, userID int64, taskKey string) error {
	if db.Pool == nil {
		return nil
	}

	query := `
		INSERT INTO user_tasks (user_id, task_key, completed, completed_at)
		VALUES ($1, $2, true, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id, task_key) DO NOTHING
	`
	_, err := db.Pool.Exec(ctx, query, userID, taskKey)
	return err
}

// CreditReferrerShare handles Tier 1 & Tier 2 lifetime commissions on user spending.
// Tier 1 receives 10%, Tier 2 receives 3% of spender's spend.
func (db *Database) CreditReferrerShare(ctx context.Context, spenderID int64, amountSpent float64, frgRepo *FRGRepo) {
	if db.Pool == nil || amountSpent <= 0 {
		return
	}

	// 1. Get spender's Tier 1 referrer ID directly (referred_by is BIGINT telegram_id)
	var t1ReferrerID *int64
	err := db.Pool.QueryRow(ctx, "SELECT referred_by FROM users WHERE telegram_id = $1", spenderID).Scan(&t1ReferrerID)
	if err != nil || t1ReferrerID == nil || *t1ReferrerID == 0 {
		return // Spender has no referrer
	}

	// Credit 10% to Tier 1
	t1Commission := amountSpent * 0.10
	metaT1, _ := json.Marshal(map[string]interface{}{
		"commission_tier": 1,
		"spender_id":      spenderID,
		"amount_spent":    amountSpent,
	})
	_, _ = frgRepo.Credit(ctx, *t1ReferrerID, t1Commission, "referral_payout", metaT1)

	// 2. Get Tier 1's referrer ID (referred_by is BIGINT telegram_id of Tier 1's referrer)
	var t2ReferrerID *int64
	err = db.Pool.QueryRow(ctx, "SELECT referred_by FROM users WHERE telegram_id = $1", *t1ReferrerID).Scan(&t2ReferrerID)
	if err != nil || t2ReferrerID == nil || *t2ReferrerID == 0 {
		return // No Tier 2 referrer
	}

	// Credit 3% to Tier 2
	t2Commission := amountSpent * 0.03
	metaT2, _ := json.Marshal(map[string]interface{}{
		"commission_tier": 2,
		"spender_id":      spenderID,
		"amount_spent":    amountSpent,
	})
	_, _ = frgRepo.Credit(ctx, *t2ReferrerID, t2Commission, "referral_payout", metaT2)
}
