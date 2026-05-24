package service

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/repository"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

type GamificationService struct {
	db             *repository.Database
	frgRepo        *repository.FRGRepo
	gamificationRepo *repository.Database
	cache          *repository.Cache
}

func NewGamificationService(db *repository.Database, cache *repository.Cache) *GamificationService {
	return &GamificationService{
		db:               db,
		frgRepo:          repository.NewFRGRepo(db),
		gamificationRepo: db,
		cache:            cache,
	}
}

type DailyRewardInfo struct {
	Streak     int     `json:"streak"`
	FrgReward  float64 `json:"frg_reward"`
	XpReward   int     `json:"xp_reward"`
	Claimed    bool    `json:"claimed"`
	CanClaim   bool    `json:"can_claim"`
	TimeLeft   float64 `json:"time_left_seconds,omitempty"`
}

var dailyRewards = map[int]struct {
	Frg float64
	Xp  int
}{
	1: {Frg: 500, Xp: 10},
	2: {Frg: 1000, Xp: 20},
	3: {Frg: 2500, Xp: 50},
	4: {Frg: 5000, Xp: 100},
	5: {Frg: 10000, Xp: 200},
	6: {Frg: 15000, Xp: 300},
	7: {Frg: 25000, Xp: 500},
}

// GetDailyStatus returns status of daily calendar claims
func (s *GamificationService) GetDailyStatus(ctx context.Context, userID int64) (*DailyRewardInfo, error) {
	state, err := s.db.GetDailyClaimState(ctx, userID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	canClaim := true
	var timeLeft float64

	if state.LastClaimedAt != nil {
		lastYear, lastMonth, lastDay := state.LastClaimedAt.UTC().Date()
		curYear, curMonth, curDay := now.Date()

		if lastYear == curYear && lastMonth == curMonth && lastDay == curDay {
			canClaim = false
			// Time left until next UTC day begins
			nextDay := time.Date(curYear, curMonth, curDay+1, 0, 0, 0, 0, time.UTC)
			timeLeft = nextDay.Sub(now).Seconds()
		}
	}

	currentStreak := state.Streak
	// If streak is not 0 and the user missed a day, state.Streak would need resetting.
	// But let's only reset on active claim if the user broke sequence.
	if state.LastClaimedAt != nil && !canClaim {
		// already claimed
	} else if state.LastClaimedAt != nil {
		yesterday := now.AddDate(0, 0, -1)
		yYear, yMonth, yDay := yesterday.Date()
		lastYear, lastMonth, lastDay := state.LastClaimedAt.UTC().Date()
		if !(lastYear == yYear && lastMonth == yMonth && lastDay == yDay) {
			currentStreak = 0 // Streak broken
		}
	}

	nextStreak := currentStreak + 1
	if nextStreak > 7 {
		nextStreak = 1
	}

	reward := dailyRewards[nextStreak]

	return &DailyRewardInfo{
		Streak:    currentStreak,
		FrgReward: reward.Frg,
		XpReward:  reward.Xp,
		Claimed:   !canClaim,
		CanClaim:  canClaim,
		TimeLeft:  timeLeft,
	}, nil
}

// ClaimDailyReward claims the user's daily rewards
func (s *GamificationService) ClaimDailyReward(ctx context.Context, userID int64) (*DailyRewardInfo, error) {
	status, err := s.GetDailyStatus(ctx, userID)
	if err != nil {
		return nil, err
	}

	if !status.CanClaim {
		return nil, fmt.Errorf("daily reward already claimed today")
	}

	nextStreak := status.Streak + 1
	if nextStreak > 7 {
		nextStreak = 1
	}

	err = s.db.ClaimDailyReward(ctx, userID, nextStreak)
	if err != nil {
		return nil, err
	}

	// Credit FRG
	meta, _ := json.Marshal(map[string]interface{}{"streak_day": nextStreak})
	_, err = s.frgRepo.Credit(ctx, userID, status.FrgReward, "daily_claim", meta)
	if err != nil {
		return nil, err
	}

	// Award XP
	err = s.db.EnsureStatsExists(ctx, userID)
	if err == nil {
		_, _ = s.db.Pool.Exec(ctx, "UPDATE user_stats SET xp = xp + $1, current_streak = $2, last_active_at = CURRENT_TIMESTAMP WHERE user_id = $3", status.XpReward, nextStreak, userID)
		
		var xp, oldLevel int
		_ = s.db.Pool.QueryRow(ctx, "SELECT xp, level FROM user_stats WHERE user_id = $1", userID).Scan(&xp, &oldLevel)
		newLevel := repository.GetLevelFromXP(xp)
		if newLevel > oldLevel {
			_, _ = s.db.Pool.Exec(ctx, "UPDATE user_stats SET level = $1 WHERE user_id = $2", newLevel, userID)
		}

		if s.cache != nil && s.cache.Client != nil {
			s.cache.Client.ZAdd(ctx, "leaderboard", redis.Z{
				Score:  float64(xp),
				Member: strconv.FormatInt(userID, 10),
			})
		}
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	return s.GetDailyStatus(ctx, userID)
}

type TaskConfig struct {
	Key       string  `json:"key"`
	Title     string  `json:"title"`
	RewardFrg float64 `json:"reward_frg"`
	RewardXp  int     `json:"reward_xp"`
}

var tasksConfig = []TaskConfig{
	{Key: "join_ifragment_channel", Title: "Join iFragment Official Channel", RewardFrg: 10000, RewardXp: 100},
	{Key: "first_username_scan", Title: "Scan your first Username", RewardFrg: 5000, RewardXp: 50},
	{Key: "register_first_bot", Title: "Register a Telegram Bot", RewardFrg: 15000, RewardXp: 150},
}

type UserTaskStatus struct {
	TaskConfig
	Completed bool `json:"completed"`
}

// GetTasksStatus returns status of quests/tasks
func (s *GamificationService) GetTasksStatus(ctx context.Context, userID int64) ([]UserTaskStatus, error) {
	completedTasks, err := s.db.GetUserTasks(ctx, userID)
	if err != nil {
		return nil, err
	}

	completedMap := make(map[string]bool)
	for _, t := range completedTasks {
		completedMap[t.TaskKey] = t.Completed
	}

	var results []UserTaskStatus
	for _, conf := range tasksConfig {
		results = append(results, UserTaskStatus{
			TaskConfig: conf,
			Completed:  completedMap[conf.Key],
		})
	}
	return results, nil
}

// CompleteTask verifies and completes a quest
func (s *GamificationService) CompleteTask(ctx context.Context, userID int64, taskKey string) (*UserTaskStatus, error) {
	statuses, err := s.GetTasksStatus(ctx, userID)
	if err != nil {
		return nil, err
	}

	var target *UserTaskStatus
	for i := range statuses {
		if statuses[i].Key == taskKey {
			target = &statuses[i]
			break
		}
	}

	if target == nil {
		return nil, fmt.Errorf("invalid task key")
	}

	if target.Completed {
		return nil, fmt.Errorf("task already completed")
	}

	// Dynamic verification checks
	switch taskKey {
	case "first_username_scan":
		var count int
		_ = s.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM search_logs WHERE user_id = $1", userID).Scan(&count)
		if count == 0 {
			return nil, fmt.Errorf("you must search/scan at least one username first")
		}
	case "register_first_bot":
		var count int
		_ = s.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM managed_bots WHERE owner_user_id = $1", userID).Scan(&count)
		if count == 0 {
			return nil, fmt.Errorf("you must register at least one managed bot first")
		}
	case "join_ifragment_channel":
		// Mark join task as completed (allows instant conversion with CTA redirect verification)
	}

	err = s.db.CompleteUserTask(ctx, userID, taskKey)
	if err != nil {
		return nil, err
	}

	// Credit FRG
	meta, _ := json.Marshal(map[string]interface{}{"task_key": taskKey})
	_, err = s.frgRepo.Credit(ctx, userID, target.RewardFrg, "task_reward", meta)
	if err != nil {
		return nil, err
	}

	// Award XP
	err = s.db.EnsureStatsExists(ctx, userID)
	if err == nil {
		_, _ = s.db.Pool.Exec(ctx, "UPDATE user_stats SET xp = xp + $1, last_active_at = CURRENT_TIMESTAMP WHERE user_id = $2", target.RewardXp, userID)
		
		var xp, oldLevel int
		_ = s.db.Pool.QueryRow(ctx, "SELECT xp, level FROM user_stats WHERE user_id = $1", userID).Scan(&xp, &oldLevel)
		newLevel := repository.GetLevelFromXP(xp)
		if newLevel > oldLevel {
			_, _ = s.db.Pool.Exec(ctx, "UPDATE user_stats SET level = $1 WHERE user_id = $2", newLevel, userID)
		}

		if s.cache != nil && s.cache.Client != nil {
			s.cache.Client.ZAdd(ctx, "leaderboard", redis.Z{
				Score:  float64(xp),
				Member: strconv.FormatInt(userID, 10),
			})
		}
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	target.Completed = true
	return target, nil
}

type BoostInfo struct {
	Type         string  `json:"type"`
	Title        string  `json:"title"`
	CurrentLevel int     `json:"current_level"`
	NextLevel    int     `json:"next_level"`
	PriceFrg     float64 `json:"price_frg"`
	MaxLevel     bool    `json:"max_level"`
}

// GetBoostsStatus returns current levels and prices for user boosts
func (s *GamificationService) GetBoostsStatus(ctx context.Context, userID int64) ([]BoostInfo, error) {
	boosts, err := s.db.GetUserBoosts(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Multi-tap pricing: Level * 2000 FRG. Max Level: 10
	mtMax := boosts.MultitapLevel >= 10
	mtPrice := float64(boosts.MultitapLevel) * 2000.0

	// Energy Limit pricing: Level * 1500 FRG. Max Level: 10
	elMax := boosts.EnergyLimitLevel >= 10
	elPrice := float64(boosts.EnergyLimitLevel) * 1500.0

	// Tap Bot: Level 0 (not bought) to 1 (bought). Max Level: 1
	tbMax := boosts.TapBotLevel >= 1
	tbPrice := 20000.0

	return []BoostInfo{
		{
			Type:         "multitap",
			Title:        "Multi-tap",
			CurrentLevel: boosts.MultitapLevel,
			NextLevel:    boosts.MultitapLevel + 1,
			PriceFrg:     mtPrice,
			MaxLevel:     mtMax,
		},
		{
			Type:         "energy_limit",
			Title:        "Energy Limit",
			CurrentLevel: boosts.EnergyLimitLevel,
			NextLevel:    boosts.EnergyLimitLevel + 1,
			PriceFrg:     elPrice,
			MaxLevel:     elMax,
		},
		{
			Type:         "tap_bot",
			Title:        "Tap Bot",
			CurrentLevel: boosts.TapBotLevel,
			NextLevel:    boosts.TapBotLevel + 1,
			PriceFrg:     tbPrice,
			MaxLevel:     tbMax,
		},
	}, nil
}

// UpgradeBoost purchases a boost upgrade with FRG
func (s *GamificationService) UpgradeBoost(ctx context.Context, userID int64, boostType string) (*repository.UserBoosts, error) {
	boosts, err := s.GetBoostsStatus(ctx, userID)
	if err != nil {
		return nil, err
	}

	var target *BoostInfo
	for i := range boosts {
		if boosts[i].Type == boostType {
			target = &boosts[i]
			break
		}
	}

	if target == nil {
		return nil, fmt.Errorf("invalid boost type")
	}

	if target.MaxLevel {
		return nil, fmt.Errorf("boost level already at maximum")
	}

	// Debit user FRG balance
	meta, _ := json.Marshal(map[string]interface{}{"boost_type": boostType, "target_level": target.NextLevel})
	_, err = s.frgRepo.Debit(ctx, userID, target.PriceFrg, "boost_purchase", meta)
	if err != nil {
		return nil, fmt.Errorf("insufficient FRG balance or payment error: %w", err)
	}

	// Trigger lifetime referral commission payout on this purchase!
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		s.db.CreditReferrerShare(bgCtx, userID, target.PriceFrg, s.frgRepo)
	}()

	err = s.db.UpgradeUserBoost(ctx, userID, boostType, target.NextLevel)
	if err != nil {
		// Refund on DB write failure
		_, _ = s.frgRepo.Credit(ctx, userID, target.PriceFrg, "refund", meta)
		return nil, err
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	return s.db.GetUserBoosts(ctx, userID)
}

type LeaderboardMember struct {
	Rank      int    `json:"rank"`
	UserID    int64  `json:"user_id"`
	FirstName string `json:"first_name"`
	Username  string `json:"username"`
	Level     int    `json:"level"`
	XP        int    `json:"xp"`
}

// GetLeaderboard retrieves Top 100 members sorted by XP
func (s *GamificationService) GetLeaderboard(ctx context.Context) ([]LeaderboardMember, error) {
	if s.cache != nil && s.cache.Client != nil {
		membersZ, err := s.cache.Client.ZRevRangeWithScores(ctx, "leaderboard", 0, 99).Result()
		if err == nil && len(membersZ) > 0 {
			var ids []int64
			scoreMap := make(map[int64]int)
			for _, m := range membersZ {
				id, err := strconv.ParseInt(m.Member.(string), 10, 64)
				if err == nil {
					ids = append(ids, id)
					scoreMap[id] = int(m.Score)
				}
			}

			// Query database to resolve first_name, username, level
			query := `
				SELECT u.telegram_id, u.first_name, u.username, us.level
				FROM users u
				JOIN user_stats us ON us.user_id = u.telegram_id
				WHERE u.telegram_id = ANY($1)
			`
			rows, err := s.db.Pool.Query(ctx, query, ids)
			if err == nil {
				defer rows.Close()
				memberMap := make(map[int64]LeaderboardMember)
				for rows.Next() {
					var id int64
					var fn, username string
					var level int
					if err := rows.Scan(&id, &fn, &username, &level); err == nil {
						memberMap[id] = LeaderboardMember{
							UserID:    id,
							FirstName: fn,
							Username:  username,
							Level:     level,
							XP:        scoreMap[id],
						}
					}
				}

				// Sort according to redis order
				var result []LeaderboardMember
				for idx, id := range ids {
					if m, exists := memberMap[id]; exists {
						m.Rank = idx + 1
						result = append(result, m)
					}
				}
				return result, nil
			}
		}
	}

	// Fallback to database
	query := `
		SELECT u.telegram_id, u.first_name, u.username, us.xp, us.level
		FROM users u
		JOIN user_stats us ON us.user_id = u.telegram_id
		ORDER BY us.xp DESC
		LIMIT 100
	`
	rows, err := s.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []LeaderboardMember
	rank := 1
	for rows.Next() {
		var m LeaderboardMember
		err := rows.Scan(&m.UserID, &m.FirstName, &m.Username, &m.XP, &m.Level)
		if err != nil {
			continue
		}
		m.Rank = rank
		result = append(result, m)
		rank++
	}

	return result, nil
}
