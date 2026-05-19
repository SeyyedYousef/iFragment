package repository

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
	"time"

	"github.com/jackc/pgx/v5"
)

type ProfileStats struct {
	UsernamesAnalyzed int       `json:"usernamesAnalyzed"`
	GroupsManaged     int       `json:"groupsManaged"`
	ChannelsManaged   int       `json:"channelsManaged"`
	DaysActive        int       `json:"daysActive"`
	CurrentStreak     int       `json:"currentStreak"`
	GlobalRank        int       `json:"globalRank"`
	TotalTaps         int       `json:"totalTaps"`
	TotalFrgEarned    float64   `json:"totalFrgEarned"`
	TotalFrgSpent     float64   `json:"totalFrgSpent"`
	FrgBalance        float64   `json:"frgBalance"`
	MemberSince       time.Time `json:"memberSince"`
	Level             int       `json:"level"`
	XP                int       `json:"xp"`
	XPToNextLevel     int       `json:"xpToNextLevel"`
}

type UserAchievement struct {
	ID         string     `json:"id"`
	Unlocked   bool       `json:"unlocked"`
	UnlockedAt *time.Time `json:"unlockedAt,omitempty"`
	Progress   int        `json:"progress"`
	Target     int        `json:"target"`
}

type ReferralFriend struct {
	ID       int64     `json:"id"`
	Name     string    `json:"name"`
	JoinedAt time.Time `json:"joinedAt"`
	Earned   float64   `json:"earned"`
}

type ReferralHubData struct {
	ReferralCode string           `json:"referralCode"`
	TotalInvited int              `json:"totalInvited"`
	TotalEarned  float64          `json:"totalEarned"`
	Friends      []ReferralFriend `json:"friends"`
}

// EnsureStatsExists inserts default stats for the user if they don't exist
func (db *Database) EnsureStatsExists(ctx context.Context, userID int64) error {
	query := `
		INSERT INTO user_stats (user_id, days_active, current_streak, total_taps, xp, level, last_active_at)
		VALUES ($1, 1, 1, 0, 0, 1, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id) DO NOTHING
	`
	_, err := db.Pool.Exec(ctx, query, userID)
	return err
}

func (db *Database) GetProfileStats(ctx context.Context, userID int64) (*ProfileStats, error) {
	if err := db.EnsureStatsExists(ctx, userID); err != nil {
		return nil, err
	}

	// 1. Fetch member_since from users
	var memberSince time.Time
	err := db.Pool.QueryRow(ctx, "SELECT created_at FROM users WHERE telegram_id = $1", userID).Scan(&memberSince)
	if err != nil {
		return nil, err
	}

	// 2. Fetch usernames_analyzed count
	var usernamesAnalyzed int
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM username_reports WHERE user_id = $1", userID).Scan(&usernamesAnalyzed)

	// 3. Fetch groups_managed and channels_managed count
	var groupsManaged, channelsManaged int
	groupQuery := `
		SELECT 
			COALESCE(SUM(CASE WHEN chat_type IN ('group', 'supergroup') THEN 1 ELSE 0 END), 0) as groups,
			COALESCE(SUM(CASE WHEN chat_type = 'channel' THEN 1 ELSE 0 END), 0) as channels
		FROM managed_groups mg
		JOIN managed_bots mb ON mg.bot_id = mb.id
		WHERE mb.owner_user_id = $1
	`
	_ = db.Pool.QueryRow(ctx, groupQuery, userID).Scan(&groupsManaged, &channelsManaged)

	// 4. Fetch FRG balance details
	var frgBalance, totalFrgEarned, totalFrgSpent float64
	frgQuery := "SELECT balance, total_earned, total_spent FROM frg_balances WHERE user_id = $1"
	_ = db.Pool.QueryRow(ctx, frgQuery, userID).Scan(&frgBalance, &totalFrgEarned, &totalFrgSpent)

	// 5. Fetch user_stats properties
	var daysActive, currentStreak, totalTaps, xp, level int
	var lastActiveAt time.Time
	statsQuery := "SELECT days_active, current_streak, total_taps, xp, level, last_active_at FROM user_stats WHERE user_id = $1"
	err = db.Pool.QueryRow(ctx, statsQuery, userID).Scan(&daysActive, &currentStreak, &totalTaps, &xp, &level, &lastActiveAt)
	if err != nil {
		return nil, err
	}

	// Dynamic streak update: if last active was yesterday, keep streak. If it was today, keep. If it was more than 1 day ago, reset streak to 1.
	now := time.Now()
	diff := now.Sub(lastActiveAt)
	if diff > 48*time.Hour {
		currentStreak = 1
		_, _ = db.Pool.Exec(ctx, "UPDATE user_stats SET current_streak = 1, last_active_at = CURRENT_TIMESTAMP WHERE user_id = $1", userID)
	} else if diff > 24*time.Hour {
		currentStreak++
		daysActive++
		_, _ = db.Pool.Exec(ctx, "UPDATE user_stats SET current_streak = $1, days_active = $2, last_active_at = CURRENT_TIMESTAMP WHERE user_id = $1", currentStreak, daysActive, userID)
	}

	// 6. Calculate global rank (simple ordering by total taps/xp)
	var globalRank int
	rankQuery := "SELECT COUNT(*) + 1 FROM user_stats WHERE xp > $1"
	_ = db.Pool.QueryRow(ctx, rankQuery, xp).Scan(&globalRank)

	return &ProfileStats{
		UsernamesAnalyzed: usernamesAnalyzed,
		GroupsManaged:     groupsManaged,
		ChannelsManaged:   channelsManaged,
		DaysActive:        daysActive,
		CurrentStreak:     currentStreak,
		GlobalRank:        globalRank,
		TotalTaps:         totalTaps,
		TotalFrgEarned:    totalFrgEarned,
		TotalFrgSpent:     totalFrgSpent,
		FrgBalance:        frgBalance,
		MemberSince:       memberSince,
		Level:             level,
		XP:                xp,
		XPToNextLevel:     level * 3000,
	}, nil
}

var predefinedAchievements = map[string]int{
	"first_steps":        1,
	"home_base":          1,
	"tap_novice":         1000,
	"mining_machine":     100000,
	"frg_millionaire":    1000000,
	"first_scan":         1,
	"whale_hunter":       100,
	"data_scientist":     500,
	"social_butterfly":   5,
	"army_builder":       50,
	"network_king":       200,
	"group_guardian":     1,
	"channel_commander":  1,
	"empire_builder":     10,
	"week_warrior":       7,
	"month_master":       30,
	"legendary":          100,
	"early_adopter":      1,
	"premium_user":       1,
	"bug_hunter":         1,
}

func (db *Database) GetAchievements(ctx context.Context, userID int64) ([]UserAchievement, error) {
	rows, err := db.Pool.Query(ctx, "SELECT achievement_id, progress, unlocked, unlocked_at FROM user_achievements WHERE user_id = $1", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userProgress := make(map[string]UserAchievement)
	for rows.Next() {
		var achID string
		var progress int
		var unlocked bool
		var unlockedAt *time.Time
		if err := rows.Scan(&achID, &progress, &unlocked, &unlockedAt); err == nil {
			target := predefinedAchievements[achID]
			if target == 0 {
				target = 1
			}
			userProgress[achID] = UserAchievement{
				ID:         achID,
				Unlocked:   unlocked,
				UnlockedAt: unlockedAt,
				Progress:   progress,
				Target:     target,
			}
		}
	}

	achievementsList := []UserAchievement{}
	// Order by achievement name to match frontend mock expectations
	keys := []string{
		"first_steps", "home_base", "tap_novice", "mining_machine", "frg_millionaire",
		"first_scan", "whale_hunter", "data_scientist", "social_butterfly", "army_builder",
		"network_king", "group_guardian", "channel_commander", "empire_builder", "week_warrior",
		"month_master", "legendary", "early_adopter", "premium_user", "bug_hunter",
	}

	for _, k := range keys {
		if ach, exists := userProgress[k]; exists {
			achievementsList = append(achievementsList, ach)
		} else {
			achievementsList = append(achievementsList, UserAchievement{
				ID:       k,
				Unlocked: false,
				Progress: 0,
				Target:   predefinedAchievements[k],
			})
		}
	}

	return achievementsList, nil
}

func (db *Database) UpdateAchievementProgress(ctx context.Context, userID int64, achievementID string, progress int) error {
	target, ok := predefinedAchievements[achievementID]
	if !ok {
		return fmt.Errorf("unknown achievement %s", achievementID)
	}

	unlocked := progress >= target
	var unlockedAt *time.Time
	if unlocked {
		t := time.Now()
		unlockedAt = &t
	}

	query := `
		INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked, unlocked_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, achievement_id) DO UPDATE SET
			progress = GREATEST(user_achievements.progress, EXCLUDED.progress),
			unlocked = CASE WHEN user_achievements.unlocked = TRUE THEN TRUE ELSE EXCLUDED.unlocked END,
			unlocked_at = CASE WHEN user_achievements.unlocked = TRUE THEN user_achievements.unlocked_at ELSE EXCLUDED.unlocked_at END
	`
	_, err := db.Pool.Exec(ctx, query, userID, achievementID, progress, unlocked, unlockedAt)
	return err
}

func (db *Database) GetReferralData(ctx context.Context, userID int64) (*ReferralHubData, error) {
	// 1. Fetch user's referral code. Generate one if missing.
	var refCode sql.NullString
	err := db.Pool.QueryRow(ctx, "SELECT referral_code FROM users WHERE telegram_id = $1", userID).Scan(&refCode)
	if err != nil {
		return nil, err
	}

	code := refCode.String
	if !refCode.Valid || code == "" {
		// Generate random ref code
		code = fmt.Sprintf("ref_%d", rand.Intn(1000000))
		_, err = db.Pool.Exec(ctx, "UPDATE users SET referral_code = $1 WHERE telegram_id = $2", code, userID)
		if err != nil {
			return nil, err
		}
	}

	// 2. Query all friends referred by this user
	friendsQuery := `
		SELECT u.telegram_id, COALESCE(u.username, u.first_name), u.created_at, COALESCE(fb.total_earned, 0)
		FROM users u
		LEFT JOIN frg_balances fb ON u.telegram_id = fb.user_id
		WHERE u.referred_by = $1
		ORDER BY u.created_at DESC
	`
	rows, err := db.Pool.Query(ctx, friendsQuery, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	friends := []ReferralFriend{}
	var totalInvited int
	var totalEarned float64

	for rows.Next() {
		var friendID int64
		var name string
		var joinedAt time.Time
		var earned float64
		if err := rows.Scan(&friendID, &name, &joinedAt, &earned); err == nil {
			friends = append(friends, ReferralFriend{
				ID:       friendID,
				Name:     name,
				JoinedAt: joinedAt,
				Earned:   earned,
			})
			totalInvited++
			totalEarned += 10000 // referrer gets 10000 FRG per friend
		}
	}

	return &ReferralHubData{
		ReferralCode: code,
		TotalInvited: totalInvited,
		TotalEarned:  totalEarned,
		Friends:      friends,
	}, nil
}

func (db *Database) SetReferredBy(ctx context.Context, userID int64, referrerCode string) error {
	// Find referrer by referral_code
	var referrerID int64
	err := db.Pool.QueryRow(ctx, "SELECT telegram_id FROM users WHERE referral_code = $1", referrerCode).Scan(&referrerID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("invalid referral code")
		}
		return err
	}

	if referrerID == userID {
		return fmt.Errorf("cannot refer yourself")
	}

	// Update user's referred_by if it is currently NULL
	_, err = db.Pool.Exec(ctx, `
		UPDATE users 
		SET referred_by = $1 
		WHERE telegram_id = $2 AND referred_by IS NULL
	`, referrerID, userID)
	return err
}
