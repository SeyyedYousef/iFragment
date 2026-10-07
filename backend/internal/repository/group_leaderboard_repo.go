package repository

import (
	"context"
	"fmt"
)

type LeaderboardEntry struct {
	Rank      int    `json:"rank"`
	UserID    int64  `json:"user_id"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
	PhotoURL  string `json:"photo_url"`
	Score     int    `json:"score"`
}

type UserLeaderboardStats struct {
	Rank    int    `json:"rank"`
	RankStr string `json:"rank_str"`
	Score   int    `json:"score"`
	Credits int    `json:"credits"`
	UserID  int64  `json:"user_id"`
}

type GroupLeaderboardResult struct {
	Type     string               `json:"type"` // "messages" or "boosts"
	Top3     []LeaderboardEntry   `json:"top3"`
	Featured []LeaderboardEntry   `json:"featured"`
	Items    []LeaderboardEntry   `json:"items"`
	MyStats  UserLeaderboardStats `json:"my_stats"`
}

type GroupLeaderboardRepo struct {
	db *Database
}

func NewGroupLeaderboardRepo(db *Database) *GroupLeaderboardRepo {
	return &GroupLeaderboardRepo{db: db}
}

// RecordGroupMessage atomically increments user's message counter and updates name/photo
func (r *GroupLeaderboardRepo) RecordGroupMessage(ctx context.Context, userID int64, username, firstName, photoURL string) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database unavailable")
	}

	query := `
		INSERT INTO fragment_investors_user_stats (user_id, username, first_name, photo_url, message_count, updated_at)
		VALUES ($1, $2, $3, $4, 1, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			message_count = fragment_investors_user_stats.message_count + 1,
			username = COALESCE(NULLIF(EXCLUDED.username, ''), fragment_investors_user_stats.username),
			first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), fragment_investors_user_stats.first_name),
			photo_url = COALESCE(NULLIF(EXCLUDED.photo_url, ''), fragment_investors_user_stats.photo_url),
			updated_at = NOW()`

	_, err := r.db.Pool.Exec(ctx, query, userID, username, firstName, photoURL)
	return err
}

// UpdateUserBoostCount updates the user's active boost count
func (r *GroupLeaderboardRepo) UpdateUserBoostCount(ctx context.Context, userID int64, username, firstName, photoURL string, boostCount int) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database unavailable")
	}

	query := `
		INSERT INTO fragment_investors_user_stats (user_id, username, first_name, photo_url, boost_count, last_boost_check_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			boost_count = $5,
			username = COALESCE(NULLIF(EXCLUDED.username, ''), fragment_investors_user_stats.username),
			first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), fragment_investors_user_stats.first_name),
			photo_url = COALESCE(NULLIF(EXCLUDED.photo_url, ''), fragment_investors_user_stats.photo_url),
			last_boost_check_at = NOW(),
			updated_at = NOW()`

	_, err := r.db.Pool.Exec(ctx, query, userID, username, firstName, photoURL, boostCount)
	return err
}

// GetLeaderboard fetches top entries for either "messages" or "boosts"
func (r *GroupLeaderboardRepo) GetLeaderboard(ctx context.Context, rankType string, limit int, currentUserID int64) (*GroupLeaderboardResult, error) {
	if r.db == nil || r.db.Pool == nil {
		return &GroupLeaderboardResult{Type: rankType}, nil
	}

	if limit <= 0 || limit > 100 {
		limit = 100
	}

	orderColumn := "message_count"
	if rankType == "boosts" {
		orderColumn = "boost_count"
	}

	query := fmt.Sprintf(`
		SELECT 
			ROW_NUMBER() OVER (ORDER BY s.%s DESC, s.user_id ASC)::INT as rank,
			s.user_id,
			COALESCE(s.username, u.username, '') as username,
			COALESCE(s.first_name, u.first_name, '') as first_name,
			COALESCE(
				NULLIF(s.photo_url, ''),
				NULLIF(u.photo_url, ''),
				CASE 
					WHEN COALESCE(NULLIF(s.username, ''), NULLIF(u.username, '')) IS NOT NULL 
						THEN 'https://t.me/i/userpic/320/' || COALESCE(NULLIF(s.username, ''), NULLIF(u.username, '')) || '.jpg'
					ELSE '/api/v1/profile/avatar/' || s.user_id::text
				END
			) as photo_url,
			s.%s as score
		FROM fragment_investors_user_stats s
		LEFT JOIN users u ON s.user_id = u.telegram_id
		WHERE s.%s > 0
		ORDER BY s.%s DESC, s.user_id ASC
		LIMIT $1`, orderColumn, orderColumn, orderColumn, orderColumn)

	rows, err := r.db.Pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query leaderboard: %w", err)
	}
	defer rows.Close()

	var allEntries []LeaderboardEntry
	for rows.Next() {
		var e LeaderboardEntry
		if err := rows.Scan(&e.Rank, &e.UserID, &e.Username, &e.FirstName, &e.PhotoURL, &e.Score); err != nil {
			return nil, fmt.Errorf("failed to scan leaderboard entry: %w", err)
		}
		allEntries = append(allEntries, e)
	}

	result := &GroupLeaderboardResult{
		Type:     rankType,
		Top3:     make([]LeaderboardEntry, 0),
		Featured: make([]LeaderboardEntry, 0),
		Items:    make([]LeaderboardEntry, 0),
		MyStats: UserLeaderboardStats{
			UserID:  currentUserID,
			RankStr: "100k+",
		},
	}

	// Partition into Top 3, Featured (4-7), and Items (8+)
	for i, entry := range allEntries {
		if i < 3 {
			result.Top3 = append(result.Top3, entry)
		} else if i < 7 {
			result.Featured = append(result.Featured, entry)
		} else {
			result.Items = append(result.Items, entry)
		}
	}

	// Calculate current user rank & score if user ID provided
	if currentUserID > 0 {
		userRankQuery := fmt.Sprintf(`
			WITH ranked AS (
				SELECT 
					user_id,
					%s,
					ROW_NUMBER() OVER (ORDER BY %s DESC, user_id ASC)::INT as rank
				FROM fragment_investors_user_stats
				WHERE %s > 0
			)
			SELECT rank, %s
			FROM ranked
			WHERE user_id = $1`, orderColumn, orderColumn, orderColumn, orderColumn)

		var rank, score int
		err := r.db.Pool.QueryRow(ctx, userRankQuery, currentUserID).Scan(&rank, &score)
		if err == nil {
			result.MyStats.Rank = rank
			result.MyStats.Score = score
			result.MyStats.RankStr = fmt.Sprintf("#%d", rank)
		} else {
			// Check if user has zero score
			var userScore int
			_ = r.db.Pool.QueryRow(ctx, fmt.Sprintf("SELECT %s FROM fragment_investors_user_stats WHERE user_id = $1", orderColumn), currentUserID).Scan(&userScore)
			result.MyStats.Score = userScore
			result.MyStats.RankStr = "100k+"
		}
	}

	return result, nil
}

type UserBoostTarget struct {
	UserID     int64
	Username   string
	FirstName  string
	BoostCount int
}

// GetUsersForBoostCheck returns users in the stats table for hourly boost checking
func (r *GroupLeaderboardRepo) GetUsersForBoostCheck(ctx context.Context, limit int) ([]UserBoostTarget, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database unavailable")
	}
	if limit <= 0 {
		limit = 100
	}

	query := `
		SELECT user_id, COALESCE(username, ''), COALESCE(first_name, ''), boost_count
		FROM fragment_investors_user_stats
		ORDER BY COALESCE(last_boost_check_at, '1970-01-01'::timestamptz) ASC
		LIMIT $1`

	rows, err := r.db.Pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var targets []UserBoostTarget
	for rows.Next() {
		var t UserBoostTarget
		if err := rows.Scan(&t.UserID, &t.Username, &t.FirstName, &t.BoostCount); err != nil {
			return nil, err
		}
		targets = append(targets, t)
	}
	return targets, nil
}

// ProcessDailyBoostRewards finds all users with boost_count >= 2 who haven't received rewards in 24 hours,
// grants them boost_count / 2 credits, and records the reward timestamp.
func (r *GroupLeaderboardRepo) ProcessDailyBoostRewards(ctx context.Context, grantFn func(ctx context.Context, userID int64, credits int) error) (int, error) {
	if r.db == nil || r.db.Pool == nil {
		return 0, fmt.Errorf("database unavailable")
	}

	query := `
		SELECT user_id, boost_count
		FROM fragment_investors_user_stats
		WHERE boost_count >= 2
		  AND (last_boost_reward_at IS NULL OR last_boost_reward_at < NOW() - INTERVAL '24 hours')
		FOR UPDATE SKIP LOCKED`

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, query)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type rewardItem struct {
		userID  int64
		credits int
	}
	var toReward []rewardItem

	for rows.Next() {
		var uid int64
		var boosts int
		if err := rows.Scan(&uid, &boosts); err != nil {
			continue
		}
		credits := boosts / 2
		if credits > 0 {
			toReward = append(toReward, rewardItem{userID: uid, credits: credits})
		}
	}
	rows.Close()

	rewardedCount := 0
	for _, item := range toReward {
		if err := grantFn(ctx, item.userID, item.credits); err != nil {
			continue
		}
		_, _ = tx.Exec(ctx, `UPDATE fragment_investors_user_stats SET last_boost_reward_at = NOW(), updated_at = NOW() WHERE user_id = $1`, item.userID)
		rewardedCount++
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}

	return rewardedCount, nil
}
