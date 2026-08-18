package repository

import (
	"context"
	"fmt"

	"ifragment-backend/internal/model"

	"github.com/jackc/pgx/v5"
)

type DailyClaimState = model.DailyClaimState
type UserBoosts = model.UserBoosts
type UserTask = model.UserTask

// GetDailyClaimState returns the user's daily login reward claim status
func (db *Database) GetDailyClaimState(ctx context.Context, userID int64) (*DailyClaimState, error) {
	if db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
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
		return fmt.Errorf("no database connection")
	}
	if streak < 1 {
		return fmt.Errorf("invalid streak")
	}

	query := `
		INSERT INTO user_daily_claims (user_id, last_claimed_at, streak)
		VALUES ($1, CURRENT_TIMESTAMP, $2)
		ON CONFLICT (user_id) DO UPDATE
		SET last_claimed_at = CURRENT_TIMESTAMP, streak = $2
		WHERE (
			(user_daily_claims.streak = $2 - 1 AND user_daily_claims.last_claimed_at >= CURRENT_DATE - INTERVAL '1 day' AND user_daily_claims.last_claimed_at < CURRENT_DATE)
			OR
			($2 = 1 AND user_daily_claims.last_claimed_at < CURRENT_DATE)
		)
	`
	cmd, err := db.Pool.Exec(ctx, query, userID, streak)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return fmt.Errorf("daily reward claim condition not met or already claimed today")
	}
	return nil
}

// GetUserBoosts returns user's upgrades (multitap, energy limit, tap bot)
func (db *Database) GetUserBoosts(ctx context.Context, userID int64) (*UserBoosts, error) {
	if db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	// Ensure parent user row exists first to satisfy FK constraint
	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO users (telegram_id, username, first_name, last_name, language_code)
		VALUES ($1, '', 'User', '', 'en')
		ON CONFLICT (telegram_id) DO NOTHING
	`, userID)

	// Ensure record exists
	ensureQuery := `
		INSERT INTO user_boosts (user_id, multitap_level, energy_limit_level, tap_bot_level)
		VALUES ($1, 1, 1, 0)
		ON CONFLICT (user_id) DO NOTHING
	`
	if _, err := db.Pool.Exec(ctx, ensureQuery, userID); err != nil {
		return nil, fmt.Errorf("failed to ensure user boosts exist: %w", err)
	}

	var boosts UserBoosts
	query := "SELECT user_id, multitap_level, energy_limit_level, tap_bot_level FROM user_boosts WHERE user_id = $1"
	err := db.Pool.QueryRow(ctx, query, userID).Scan(&boosts.UserID, &boosts.MultitapLevel, &boosts.EnergyLimitLevel, &boosts.TapBotLevel)
	return &boosts, err
}

// UpgradeUserBoost increments the level of a specific boost
func (db *Database) UpgradeUserBoost(ctx context.Context, userID int64, boostType string, nextLevel int) error {
	if db.Pool == nil {
		return fmt.Errorf("no database connection")
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
		return fmt.Errorf("invalid boost type: %s", boostType)
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
		return nil, fmt.Errorf("no database connection")
	}

	query := "SELECT task_key, completed, completed_at FROM user_tasks WHERE user_id = $1"
	rows, err := db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]UserTask, 0)
	for rows.Next() {
		var t UserTask
		if err := rows.Scan(&t.TaskKey, &t.Completed, &t.CompletedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return tasks, nil
}

// CompleteUserTask marks a specific task as completed
func (db *Database) CompleteUserTask(ctx context.Context, userID int64, taskKey string) error {
	if db.Pool == nil {
		return fmt.Errorf("no database connection")
	}

	query := `
		INSERT INTO user_tasks (user_id, task_key, completed, completed_at)
		VALUES ($1, $2, true, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id, task_key) DO NOTHING
	`
	_, err := db.Pool.Exec(ctx, query, userID, taskKey)
	return err
}

// CreditReferrerShareCoins handles Tier 1 & Tier 2 lifetime commissions on user in-game Coins spending.
// Tier 1 receives 10%, Tier 2 receives 3% of spender's spend.
func (db *Database) CreditReferrerShareCoins(ctx context.Context, spenderID int64, amountSpent float64) error {
	if db.Pool == nil || amountSpent <= 0 {
		return nil
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Get spender's Tier 1 referrer ID
	var t1ReferrerID *int64
	err = tx.QueryRow(ctx, "SELECT referred_by FROM users WHERE telegram_id = $1", spenderID).Scan(&t1ReferrerID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil
		}
		return fmt.Errorf("failed to get t1 referrer: %w", err)
	}
	if t1ReferrerID == nil || *t1ReferrerID == 0 {
		return nil
	}

	// 2. Get Tier 1's referrer ID
	var t2ReferrerID *int64
	err = tx.QueryRow(ctx, "SELECT referred_by FROM users WHERE telegram_id = $1", *t1ReferrerID).Scan(&t2ReferrerID)
	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("failed to get t2 referrer: %w", err)
	}

	t1Commission := amountSpent * 0.05
	hasT2 := t2ReferrerID != nil && *t2ReferrerID != 0
	var t2Commission float64
	if hasT2 {
		t2Commission = amountSpent * 0.01
	}

	creditCoins := func(userID int64, commission float64, tier int) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO user_stats (user_id, xp, level, current_streak, last_active_at, energy, energy_updated_at, airdrop_coins, total_coins_earned)
			VALUES ($1, 0, 1, 0, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP, $2, $2)
			ON CONFLICT (user_id) DO UPDATE SET 
				airdrop_coins = COALESCE(user_stats.airdrop_coins, 0.0) + $2,
				total_coins_earned = COALESCE(user_stats.total_coins_earned, 0.0) + $2
		`, userID, commission)
		if err != nil {
			return fmt.Errorf("failed to credit t%d coins commission: %w", tier, err)
		}
		return nil
	}

	// Execute in ID order to prevent deadlocks
	if hasT2 && *t1ReferrerID > *t2ReferrerID {
		if err := creditCoins(*t2ReferrerID, t2Commission, 2); err != nil {
			return err
		}
		if err := creditCoins(*t1ReferrerID, t1Commission, 1); err != nil {
			return err
		}
	} else {
		if err := creditCoins(*t1ReferrerID, t1Commission, 1); err != nil {
			return err
		}
		if hasT2 {
			if err := creditCoins(*t2ReferrerID, t2Commission, 2); err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

// GetGlobalClans returns the top 100 clans sorted by total score
func (db *Database) GetGlobalClans(ctx context.Context) ([]map[string]interface{}, error) {
	if db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	query := `
		SELECT id, chat_title, total_score, members_count as member_count
		FROM clans
		ORDER BY total_score DESC
		LIMIT 100
	`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clans []map[string]interface{}
	for rows.Next() {
		var id string
		var name string
		var score float64
		var members int
		if err := rows.Scan(&id, &name, &score, &members); err != nil {
			continue
		}
		clans = append(clans, map[string]interface{}{
			"id":           id,
			"name":         name,
			"total_score":  score,
			"member_count": members,
		})
	}
	return clans, nil
}

// GetActiveQuests returns quests that are active (not expired)
func (db *Database) GetActiveQuests(ctx context.Context, userID int64) ([]map[string]interface{}, error) {
	if db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	query := `
		SELECT key, description, reward_amount, type, group_id
		FROM tasks
		WHERE is_active = true AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
	`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []map[string]interface{}
	for rows.Next() {
		var key, desc, tType string
		var reward float64
		var groupID *string
		if err := rows.Scan(&key, &desc, &reward, &tType, &groupID); err != nil {
			continue
		}
		tasks = append(tasks, map[string]interface{}{
			"key":         key,
			"description": desc,
			"reward":      reward,
			"type":        tType,
			"group_id":    groupID,
		})
	}
	return tasks, nil
}
