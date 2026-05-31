package service

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

type referralJob struct {
	spenderID   int64
	amountSpent float64
}

type GamificationService struct {
	db               *repository.Database
	frgRepo          *repository.FRGRepo
	gamificationRepo *repository.Database
	cache            *repository.Cache
	referralQueue    chan referralJob
}

func NewGamificationService(db *repository.Database, cache *repository.Cache) *GamificationService {
	s := &GamificationService{
		db:               db,
		frgRepo:          repository.NewFRGRepo(db),
		gamificationRepo: db,
		cache:            cache,
		referralQueue:    make(chan referralJob, 1000),
	}

	// Launch background workers for referral payments to avoid connection pool starvation
	for i := 0; i < 3; i++ {
		go s.startReferralWorker()
	}

	return s
}

func (s *GamificationService) startReferralWorker() {
	for job := range s.referralQueue {
		func() {
			defer func() {
				if r := recover(); r != nil {
					slog.Error("panic in referral worker background task", "err", r)
				}
			}()
			bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			s.db.CreditReferrerShare(bgCtx, job.spenderID, job.amountSpent, s.frgRepo)
		}()
	}
}

func (s *GamificationService) getBotAPIClient() *telegram.BotAPIClient {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		token = os.Getenv("BOT_TOKEN")
	}
	if token != "" {
		return telegram.NewBotAPIClient(token)
	}
	return nil
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

// ClaimDailyReward claims the user's daily rewards safely inside a locked transaction
func (s *GamificationService) ClaimDailyReward(ctx context.Context, userID int64) (*DailyRewardInfo, error) {
	if s.db.Pool == nil {
		return nil, fmt.Errorf("database pool is nil")
	}

	// 1. Begin single unified transaction
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 2. Lock user's daily claims row to serialize concurrent claims
	var lastClaimedAt *time.Time
	var streak int
	query := "SELECT last_claimed_at, streak FROM user_daily_claims WHERE user_id = $1 FOR UPDATE"
	err = tx.QueryRow(ctx, query, userID).Scan(&lastClaimedAt, &streak)
	
	if err != nil && err != pgx.ErrNoRows {
		return nil, fmt.Errorf("failed to lock daily claim state: %w", err)
	}

	now := time.Now().UTC()
	canClaim := true

	if err != pgx.ErrNoRows && lastClaimedAt != nil {
		lastYear, lastMonth, lastDay := lastClaimedAt.UTC().Date()
		curYear, curMonth, curDay := now.Date()

		if lastYear == curYear && lastMonth == curMonth && lastDay == curDay {
			canClaim = false
		}
	}

	if !canClaim {
		return nil, fmt.Errorf("daily reward already claimed today")
	}

	// Reset streak if user missed a day
	if lastClaimedAt != nil {
		yesterday := now.AddDate(0, 0, -1)
		yYear, yMonth, yDay := yesterday.Date()
		lYear, lMonth, lDay := lastClaimedAt.UTC().Date()
		if !(lYear == yYear && lMonth == yMonth && lDay == yDay) {
			streak = 0
		}
	}

	nextStreak := streak + 1
	if nextStreak > 7 {
		nextStreak = 1
	}

	reward := dailyRewards[nextStreak]

	// 3. Update user_daily_claims in transaction
	claimQuery := `
		INSERT INTO user_daily_claims (user_id, last_claimed_at, streak)
		VALUES ($1, CURRENT_TIMESTAMP, $2)
		ON CONFLICT (user_id) DO UPDATE
		SET last_claimed_at = CURRENT_TIMESTAMP, streak = $2
	`
	_, err = tx.Exec(ctx, claimQuery, userID, nextStreak)
	if err != nil {
		return nil, fmt.Errorf("failed to update daily claim state: %w", err)
	}

	// 4. Credit FRG in transaction
	var balanceBefore float64
	err = tx.QueryRow(ctx, `SELECT balance FROM frg_balances WHERE user_id = $1 FOR UPDATE`, userID).Scan(&balanceBefore)
	if err != nil && err != pgx.ErrNoRows {
		return nil, fmt.Errorf("failed to lock user balance: %w", err)
	}

	var balanceAfter float64
	if err == pgx.ErrNoRows {
		balanceBefore = 0
		balanceAfter = reward.Frg
		_, err = tx.Exec(ctx, `INSERT INTO frg_balances (user_id, balance, total_earned) VALUES ($1, $2, $2)`, userID, reward.Frg)
	} else {
		balanceAfter = balanceBefore + reward.Frg
		_, err = tx.Exec(ctx, `UPDATE frg_balances SET balance = balance + $1, total_earned = total_earned + $1, updated_at = now() WHERE user_id = $2`, reward.Frg, userID)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update balance: %w", err)
	}

	// Insert transaction log
	meta, _ := json.Marshal(map[string]interface{}{"streak_day": nextStreak})
	_, err = tx.Exec(ctx,
		`INSERT INTO frg_transactions (user_id, type, amount, balance_before, balance_after, metadata)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		userID, "daily_claim", reward.Frg, balanceBefore, balanceAfter, meta,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to log transaction: %w", err)
	}

	// 5. Award XP in transaction
	ensureQuery := `
		INSERT INTO user_stats (user_id, xp, level, current_streak, last_active_at)
		VALUES ($1, $2, 1, $3, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id) DO UPDATE
		SET xp = user_stats.xp + $2, current_streak = $3, last_active_at = CURRENT_TIMESTAMP
	`
	_, err = tx.Exec(ctx, ensureQuery, userID, reward.Xp, nextStreak)
	if err != nil {
		return nil, fmt.Errorf("failed to update user stats: %w", err)
	}
	
	var xp, oldLevel int
	_ = tx.QueryRow(ctx, "SELECT xp, level FROM user_stats WHERE user_id = $1", userID).Scan(&xp, &oldLevel)
	newLevel := repository.GetLevelFromXP(xp)
	if newLevel > oldLevel {
		_, _ = tx.Exec(ctx, "UPDATE user_stats SET level = $1 WHERE user_id = $2", newLevel, userID)
	}

	// Commit transaction
	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit daily claim: %w", err)
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.ZAdd(ctx, "leaderboard", redis.Z{
			Score:  float64(xp),
			Member: strconv.FormatInt(userID, 10),
		})
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	timeLeft := float64(86400) - float64(now.Hour()*3600+now.Minute()*60+now.Second())
	return &DailyRewardInfo{
		Streak:    nextStreak,
		FrgReward: reward.Frg,
		XpReward:  reward.Xp,
		Claimed:   true,
		CanClaim:  false,
		TimeLeft:  timeLeft,
	}, nil
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

// CompleteTask verifies and completes a quest safely under a database transaction with row locks
func (s *GamificationService) CompleteTask(ctx context.Context, userID int64, taskKey string) (*UserTaskStatus, error) {
	if s.db.Pool == nil {
		return nil, fmt.Errorf("database pool is nil")
	}

	// 1. Begin single unified transaction
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 2. Lock user task record to prevent concurrent claims
	var completed bool
	queryTask := `
		SELECT completed FROM user_tasks 
		WHERE user_id = $1 AND task_key = $2 FOR UPDATE
	`
	err = tx.QueryRow(ctx, queryTask, userID, taskKey).Scan(&completed)
	if err != nil && err != pgx.ErrNoRows {
		return nil, fmt.Errorf("failed to lock user task status: %w", err)
	}

	if completed {
		return nil, fmt.Errorf("task already completed")
	}

	// Fetch task target config
	var target *TaskConfig
	for i := range tasksConfig {
		if tasksConfig[i].Key == taskKey {
			target = &tasksConfig[i]
			break
		}
	}
	if target == nil {
		return nil, fmt.Errorf("invalid task key")
	}

	// 3. Dynamic backend verification checks
	switch taskKey {
	case "first_username_scan":
		var count int
		_ = tx.QueryRow(ctx, "SELECT COUNT(*) FROM search_logs WHERE user_id = $1", userID).Scan(&count)
		if count == 0 {
			return nil, fmt.Errorf("you must search/scan at least one username first")
		}
	case "register_first_bot":
		var count int
		_ = tx.QueryRow(ctx, "SELECT COUNT(*) FROM managed_bots WHERE owner_user_id = $1", userID).Scan(&count)
		if count == 0 {
			return nil, fmt.Errorf("you must register at least one managed bot first")
		}
	case "join_ifragment_channel":
		// Cyber security check: Query live Telegram Bot API to check if user is a member
		tgClient := s.getBotAPIClient()
		if tgClient != nil {
			status, err := tgClient.GetChatMember(ctx, "@ifragment_channel", userID)
			if err != nil {
				return nil, fmt.Errorf("failed to verify official channel membership: %w", err)
			}
			if status == "left" || status == "kicked" {
				return nil, fmt.Errorf("you must join our official Telegram channel first")
			}
		}
	}

	// 4. Update task completion in transaction
	taskInsert := `
		INSERT INTO user_tasks (user_id, task_key, completed, completed_at)
		VALUES ($1, $2, true, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id, task_key) DO UPDATE SET completed = true, completed_at = CURRENT_TIMESTAMP
	`
	_, err = tx.Exec(ctx, taskInsert, userID, taskKey)
	if err != nil {
		return nil, fmt.Errorf("failed to complete task: %w", err)
	}

	// 5. Credit FRG reward in transaction
	var balanceBefore float64
	err = tx.QueryRow(ctx, `SELECT balance FROM frg_balances WHERE user_id = $1 FOR UPDATE`, userID).Scan(&balanceBefore)
	if err != nil && err != pgx.ErrNoRows {
		return nil, fmt.Errorf("failed to lock user balance for task reward: %w", err)
	}

	var balanceAfter float64
	if err == pgx.ErrNoRows {
		balanceBefore = 0
		balanceAfter = target.RewardFrg
		_, err = tx.Exec(ctx, `INSERT INTO frg_balances (user_id, balance, total_earned) VALUES ($1, $2, $2)`, userID, target.RewardFrg)
	} else {
		balanceAfter = balanceBefore + target.RewardFrg
		_, err = tx.Exec(ctx, `UPDATE frg_balances SET balance = balance + $1, total_earned = total_earned + $1, updated_at = now() WHERE user_id = $2`, target.RewardFrg, userID)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to credit task reward balance: %w", err)
	}

	// Insert transaction log
	meta, _ := json.Marshal(map[string]interface{}{"task_key": taskKey})
	_, err = tx.Exec(ctx,
		`INSERT INTO frg_transactions (user_id, type, amount, balance_before, balance_after, metadata)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		userID, "task_reward", target.RewardFrg, balanceBefore, balanceAfter, meta,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to log task transaction: %w", err)
	}

	// 6. Award XP in transaction
	statsEnsure := `
		INSERT INTO user_stats (user_id, xp, level, last_active_at)
		VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id) DO UPDATE SET xp = user_stats.xp + $2, last_active_at = CURRENT_TIMESTAMP
	`
	_, err = tx.Exec(ctx, statsEnsure, userID, target.RewardXp)
	if err != nil {
		return nil, fmt.Errorf("failed to award task xp: %w", err)
	}

	var xp, oldLevel int
	_ = tx.QueryRow(ctx, "SELECT xp, level FROM user_stats WHERE user_id = $1", userID).Scan(&xp, &oldLevel)
	newLevel := repository.GetLevelFromXP(xp)
	if newLevel > oldLevel {
		_, _ = tx.Exec(ctx, "UPDATE user_stats SET level = $1 WHERE user_id = $2", newLevel, userID)
	}

	// Commit transaction
	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit task completion: %w", err)
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.ZAdd(ctx, "leaderboard", redis.Z{
			Score:  float64(xp),
			Member: strconv.FormatInt(userID, 10),
		})
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	return &UserTaskStatus{
		TaskConfig: *target,
		Completed:  true,
	}, nil
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
	if s.db.Pool == nil {
		return &repository.UserBoosts{UserID: userID}, fmt.Errorf("database pool is nil")
	}

	// 1. Begin single unified transaction
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 2. Lock user's boost row inside the transaction to prevent concurrent race conditions
	var boosts repository.UserBoosts
	query := `
		SELECT user_id, multitap_level, energy_limit_level, tap_bot_level 
		FROM user_boosts 
		WHERE user_id = $1 FOR UPDATE
	`
	err = tx.QueryRow(ctx, query, userID).Scan(&boosts.UserID, &boosts.MultitapLevel, &boosts.EnergyLimitLevel, &boosts.TapBotLevel)
	if err != nil {
		if err == pgx.ErrNoRows {
			// Initialize row if not exists
			ensureQuery := `
				INSERT INTO user_boosts (user_id, multitap_level, energy_limit_level, tap_bot_level)
				VALUES ($1, 1, 1, 0)
				ON CONFLICT (user_id) DO NOTHING
			`
			_, err = tx.Exec(ctx, ensureQuery, userID)
			if err != nil {
				return nil, fmt.Errorf("failed to initialize user boosts: %w", err)
			}
			// Read again with lock
			err = tx.QueryRow(ctx, query, userID).Scan(&boosts.UserID, &boosts.MultitapLevel, &boosts.EnergyLimitLevel, &boosts.TapBotLevel)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, fmt.Errorf("failed to fetch user boosts with lock: %w", err)
		}
	}

	// 3. Validation and pricing calculation using locked state values
	var nextLevel int
	var priceFrg float64
	var maxLevel bool

	switch boostType {
	case "multitap":
		nextLevel = boosts.MultitapLevel + 1
		priceFrg = float64(boosts.MultitapLevel) * 2000.0
		maxLevel = boosts.MultitapLevel >= 10
	case "energy_limit":
		nextLevel = boosts.EnergyLimitLevel + 1
		priceFrg = float64(boosts.EnergyLimitLevel) * 1500.0
		maxLevel = boosts.EnergyLimitLevel >= 10
	case "tap_bot":
		nextLevel = boosts.TapBotLevel + 1
		priceFrg = 20000.0
		maxLevel = boosts.TapBotLevel >= 1
	default:
		return nil, fmt.Errorf("invalid boost type")
	}

	if maxLevel {
		return nil, fmt.Errorf("boost level already at maximum")
	}

	// 4. Debit user balance inside the same transaction
	var balanceBefore float64
	err = tx.QueryRow(ctx, `SELECT balance FROM frg_balances WHERE user_id = $1 FOR UPDATE`, userID).Scan(&balanceBefore)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch balance with lock: %w", err)
	}

	if balanceBefore < priceFrg {
		return nil, fmt.Errorf("insufficient FRG balance: have %.4f, need %.4f", balanceBefore, priceFrg)
	}

	balanceAfter := balanceBefore - priceFrg

	// Update balance
	_, err = tx.Exec(ctx,
		`UPDATE frg_balances SET balance = $1, total_spent = total_spent + $2, updated_at = now() WHERE user_id = $3`,
		balanceAfter, priceFrg, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update user balance: %w", err)
	}

	// Insert transaction log
	meta, _ := json.Marshal(map[string]interface{}{"boost_type": boostType, "target_level": nextLevel})
	_, err = tx.Exec(ctx,
		`INSERT INTO frg_transactions (user_id, type, amount, balance_before, balance_after, metadata)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		userID, "boost_purchase", -priceFrg, balanceBefore, balanceAfter, meta,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to log transaction: %w", err)
	}

	// 5. Update user_boosts inside transaction
	var updateQuery string
	switch boostType {
	case "multitap":
		updateQuery = "UPDATE user_boosts SET multitap_level = $1 WHERE user_id = $2"
	case "energy_limit":
		updateQuery = "UPDATE user_boosts SET energy_limit_level = $1 WHERE user_id = $2"
	case "tap_bot":
		updateQuery = "UPDATE user_boosts SET tap_bot_level = $1 WHERE user_id = $2"
	}
	_, err = tx.Exec(ctx, updateQuery, nextLevel, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to update user boosts level: %w", err)
	}

	// Commit transaction
	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// 6. Post-commit background task queued to fixed size workers
	select {
	case s.referralQueue <- referralJob{spenderID: userID, amountSpent: priceFrg}:
	default:
		slog.Warn("Referral payout queue is full, dropping job", "user_id", userID)
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
		// Try fallback cache first if sorted set is down or empty
		cachedFallback, err := s.cache.Client.Get(ctx, "leaderboard_cached_fallback").Result()
		if err == nil && cachedFallback != "" {
			var cachedRes []LeaderboardMember
			if json.Unmarshal([]byte(cachedFallback), &cachedRes) == nil {
				return cachedRes, nil
			}
		}

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

	// Cache fallback result in Redis with a 60 seconds TTL to protect DB
	if s.cache != nil && s.cache.Client != nil && len(result) > 0 {
		if data, err := json.Marshal(result); err == nil {
			s.cache.Client.Set(ctx, "leaderboard_cached_fallback", data, 60*time.Second)
		}
	}

	return result, nil
}
