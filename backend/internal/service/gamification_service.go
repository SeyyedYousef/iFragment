package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"
	"log/slog"
	"os"
	"strconv"
	"strings"
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
	gamificationRepo *repository.Database
	cache            *repository.Cache
	referralQueue    chan referralJob
}

func NewGamificationService(db *repository.Database, cache *repository.Cache) *GamificationService {
	s := &GamificationService{
		db:               db,
		gamificationRepo: db,
		cache:            cache,
		referralQueue:    make(chan referralJob, 1000),
	}

	// Launch background workers for referral payments to avoid connection pool starvation
	for i := 0; i < 3; i++ {
		go s.startReferralWorker()
	}

	if db.Pool != nil {
		go s.StartCoinDecayWorker(context.Background())
	}

	return s
}

// StartCoinDecayWorker periodically checks and applies a 2% penalty to inactive users' airdrop coins
func (s *GamificationService) StartCoinDecayWorker(ctx context.Context) {
	ticker := time.NewTicker(6 * time.Hour) // Run every 6 hours
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.applyCoinDecay(ctx)
		}
	}
}

func (s *GamificationService) applyCoinDecay(ctx context.Context) {
	if s.db.Pool == nil {
		return
	}

	query := `
		UPDATE user_stats 
		SET airdrop_coins = airdrop_coins * 0.98,
		    last_decay_at = CURRENT_DATE 
		WHERE last_active_at < NOW() - INTERVAL '5 days' 
		  AND (last_decay_at IS NULL OR last_decay_at < CURRENT_DATE) 
		  AND airdrop_coins > 0;
	`
	tag, err := s.db.Pool.Exec(ctx, query)
	if err != nil {
		slog.Error("Failed to apply coin decay", "err", err)
	} else if tag.RowsAffected() > 0 {
		slog.Info("Applied coin decay", "affected_users", tag.RowsAffected())
	}
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
			s.db.CreditReferrerShareCoins(bgCtx, job.spenderID, job.amountSpent)
		}()
	}
}

// QueueReferralReward safely queues a background job to credit the referrer
func (s *GamificationService) QueueReferralReward(spenderID int64, amountSpent float64) {
	select {
	case s.referralQueue <- referralJob{
		spenderID:   spenderID,
		amountSpent: amountSpent,
	}:
	default:
		slog.Warn("referralQueue is full, dropping referral reward job", "spenderID", spenderID)
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

func (s *GamificationService) getChatMemberCached(ctx context.Context, tg *telegram.BotAPIClient, chatID interface{}, userID int64) (string, error) {
	if s.cache == nil || s.cache.Client == nil {
		return tg.GetChatMember(ctx, chatID, userID)
	}

	key := fmt.Sprintf("chat_member_gamification:%v:%d", chatID, userID)
	status, err := s.cache.Client.Get(ctx, key).Result()
	if err == nil {
		return status, nil
	}

	status, err = tg.GetChatMember(ctx, chatID, userID)
	if err != nil {
		return "", err
	}

	ttl := 5 * time.Minute
	if status == "left" || status == "kicked" || status == "" {
		ttl = 30 * time.Second
	}
	s.cache.Client.Set(ctx, key, status, ttl)
	return status, nil
}

type DailyRewardInfo struct {
	Streak    int     `json:"streak"`
	FrgReward float64 `json:"frg_reward"`
	XpReward  int     `json:"xp_reward"`
	Claimed   bool    `json:"claimed"`
	CanClaim  bool    `json:"can_claim"`
	TimeLeft  float64 `json:"time_left_seconds,omitempty"`
}

var dailyRewards = map[int]struct {
	Frg float64 // Labeled Frg for JSON compatibility, actually represents Coins
	Xp  int
}{
	1: {Frg: 200, Xp: 10},
	2: {Frg: 400, Xp: 20},
	3: {Frg: 800, Xp: 50},
	4: {Frg: 1500, Xp: 100},
	5: {Frg: 3000, Xp: 200},
	6: {Frg: 5000, Xp: 300},
	7: {Frg: 8000, Xp: 500},
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

	// Ensure row exists inside transaction first so FOR UPDATE successfully locks it
	_, err = tx.Exec(ctx, `
		INSERT INTO user_daily_claims (user_id, last_claimed_at, streak)
		VALUES ($1, NULL, 0)
		ON CONFLICT (user_id) DO NOTHING
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to ensure daily claim record: %w", err)
	}

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

	// 4. Update user stats: ensure row exists, then credit Coins (airdrop_coins), award XP, update streak, and last_active_at.
	_, err = tx.Exec(ctx, `
		INSERT INTO user_stats (user_id, xp, level, current_streak, last_active_at, energy, energy_updated_at, airdrop_coins)
		VALUES ($1, 0, 1, 0, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP, 0.0)
		ON CONFLICT (user_id) DO NOTHING
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to ensure user stats: %w", err)
	}

	var xp, oldLevel int
	updateStatsQuery := `
		UPDATE user_stats
		SET airdrop_coins = airdrop_coins + $1,
		    total_coins_earned = total_coins_earned + $1,
		    xp = xp + $2,
		    current_streak = $3,
		    last_active_at = CURRENT_TIMESTAMP
		WHERE user_id = $4
		RETURNING xp, level
	`
	err = tx.QueryRow(ctx, updateStatsQuery, reward.Frg, reward.Xp, nextStreak, userID).Scan(&xp, &oldLevel)
	if err != nil {
		return nil, fmt.Errorf("failed to update user stats: %w", err)
	}

	// Handle level up
	newLevel := repository.GetLevelFromXP(xp)
	if newLevel > oldLevel {
		_, err = tx.Exec(ctx, "UPDATE user_stats SET level = $1 WHERE user_id = $2", newLevel, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to update user level: %w", err)
		}
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

type UserTaskStatus struct {
	model.Quest
	Completed bool `json:"completed"`
}

// GetTasksStatus returns status of quests/tasks with enriched UI metadata
func (s *GamificationService) GetTasksStatus(ctx context.Context, userID int64) ([]UserTaskStatus, error) {
	completedTasks, err := s.db.GetUserTasks(ctx, userID)
	if err != nil {
		return nil, err
	}

	completedMap := make(map[string]bool)
	for _, t := range completedTasks {
		completedMap[t.TaskKey] = t.Completed
	}

	ownerRepo := repository.NewOwnerRepo(s.db)
	activeQuests, err := ownerRepo.GetActiveQuests(ctx)
	if err != nil {
		return nil, err
	}

	// Fetch user stats for progress tracking
	var taps int
	var level int
	var referrals int
	var clanID int64
	var isPremium bool
	_ = s.db.Pool.QueryRow(ctx, "SELECT COALESCE(total_taps, 0), COALESCE(level, 1) FROM user_stats WHERE user_id = $1", userID).Scan(&taps, &level)
	_ = s.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE referred_by = $1", userID).Scan(&referrals)
	_ = s.db.Pool.QueryRow(ctx, "SELECT COALESCE(clan_id, 0) FROM clan_members WHERE user_id = $1 LIMIT 1", userID).Scan(&clanID)
	_ = s.db.Pool.QueryRow(ctx, "SELECT COALESCE(is_premium, false) FROM users WHERE telegram_id = $1", userID).Scan(&isPremium)

	results := make([]UserTaskStatus, 0, len(activeQuests))
	for _, q := range activeQuests {
		switch q.Type {
		case "taps_100k":
			q.ProgressCurrent = taps
			q.ProgressTarget = 100000
		case "invite_1_fren":
			q.ProgressCurrent = referrals
			q.ProgressTarget = 1
		case "invite_3_frens":
			q.ProgressCurrent = referrals
			q.ProgressTarget = 3
		case "invite_10_frens":
			q.ProgressCurrent = referrals
			q.ProgressTarget = 10
		case "league_gold":
			q.ProgressCurrent = level
			q.ProgressTarget = 3
		case "telegram_premium":
			q.IsPremiumReq = true
			if isPremium {
				q.ProgressCurrent = 1
			} else {
				q.ProgressCurrent = 0
			}
			q.ProgressTarget = 1
		case "join_clan":
			q.IsClanReq = true
			if clanID > 0 {
				q.ProgressCurrent = 1
			}
			q.ProgressTarget = 1
		case "channel_join":
			var config struct {
				ChannelUsername string `json:"channel_username"`
			}
			_ = json.Unmarshal(q.Config, &config)
			q.ActionText = config.ChannelUsername
			if q.ActionText == "" {
				q.ActionText = "@ifragment_channel"
			}
			if !strings.HasPrefix(q.ActionText, "@") && !strings.HasPrefix(q.ActionText, "-") {
				q.ActionText = "@" + q.ActionText
			}
			channelRaw := strings.TrimPrefix(q.ActionText, "@")
			q.ActionURL = "https://t.me/" + channelRaw
		case "link", "social", "campaign":
			var config struct {
				URL string `json:"url"`
			}
			_ = json.Unmarshal(q.Config, &config)
			if config.URL != "" {
				q.ActionURL = config.URL
			}
		}

		if q.ProgressCurrent > q.ProgressTarget {
			q.ProgressCurrent = q.ProgressTarget
		}

		results = append(results, UserTaskStatus{
			Quest:     q,
			Completed: completedMap[q.Key],
		})
	}
	return results, nil
}

// CompleteTask verifies and completes a quest safely under a database transaction with row locks
func (s *GamificationService) CompleteTask(ctx context.Context, userID int64, taskKey string, answer string) (*UserTaskStatus, error) {
	if s.db.Pool == nil {
		return nil, fmt.Errorf("database pool is nil")
	}

	ownerRepo := repository.NewOwnerRepo(s.db)
	target, err := ownerRepo.GetQuestByKey(ctx, taskKey)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch quest: %w", err)
	}
	if target == nil {
		return nil, fmt.Errorf("invalid quest key")
	}
	// Log debugging info
	slog.Info("Completing task", "userID", userID, "taskKey", taskKey, "taskType", target.Type)
	if !target.IsActive || (target.ExpiresAt != nil && target.ExpiresAt.Before(time.Now())) {
		return nil, fmt.Errorf("quest is inactive or expired")
	}

	// 1. Dynamic backend verification checks (done BEFORE transaction to prevent pool starvation)
	switch target.Type {
	case "league_gold":
		var level int
		_ = s.db.Pool.QueryRow(ctx, "SELECT level FROM user_stats WHERE user_id = $1", userID).Scan(&level)
		if level < 3 { // Assuming level 3 is Gold
			return nil, fmt.Errorf("you must reach Gold league first")
		}
	case "join_clan":
		// Verify that the user belongs to a clan in the application
		var clanID int64
		err := s.db.Pool.QueryRow(ctx, "SELECT cm.clan_id FROM clan_members cm WHERE cm.user_id = $1", userID).Scan(&clanID)
		if err != nil || clanID == 0 {
			return nil, fmt.Errorf("you must join a clan first")
		}
		// No further verification needed; DB membership is sufficient.
	case "invite_1_fren", "invite_3_frens", "invite_10_frens":
		var frens int
		_ = s.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE referred_by = $1", userID).Scan(&frens)
		required := 1
		switch target.Type {
		case "invite_3_frens":
			required = 3
		case "invite_10_frens":
			required = 10
		}
		if frens < required {
			return nil, fmt.Errorf("you must invite at least %d frens", required)
		}
	case "taps_100k":
		var taps int
		_ = s.db.Pool.QueryRow(ctx, "SELECT COALESCE(total_taps, 0) FROM user_stats WHERE user_id = $1", userID).Scan(&taps)
		if taps < 100000 {
			return nil, fmt.Errorf("you must reach 100,000 total taps")
		}
	case "telegram_premium":
		var isPremium bool
		_ = s.db.Pool.QueryRow(ctx, "SELECT COALESCE(is_premium, false) FROM users WHERE telegram_id = $1", userID).Scan(&isPremium)
		if !isPremium {
			return nil, fmt.Errorf("you must have Telegram Premium")
		}
	case "channel_join":
		var config struct {
			ChannelUsername string `json:"channel_username"`
		}
		_ = json.Unmarshal(target.Config, &config)
		channelName := config.ChannelUsername
		if channelName == "" {
			channelName = "@ifragment_channel" // fallback
		} else if !strings.HasPrefix(channelName, "@") && !strings.HasPrefix(channelName, "-") {
			channelName = "@" + channelName
		}

		// Query live Telegram Bot API to check if user is a member
		tgClient := s.getBotAPIClient()
		if tgClient == nil {
			if os.Getenv("APP_ENV") == "production" {
				return nil, fmt.Errorf("official Telegram Bot Token not configured (fail-closed)")
			}
		} else {
			status, err := s.getChatMemberCached(ctx, tgClient, channelName, userID)
			if err != nil {
				return nil, fmt.Errorf("failed to verify official channel membership: %w", err)
			}
			if status == "left" || status == "kicked" {
				return nil, fmt.Errorf("you must join official Telegram channel %s first", channelName)
			}
		}
	case "quiz":
		var config struct {
			QuizAnswerHash string `json:"quiz_answer_hash"`
		}
		_ = json.Unmarshal(target.Config, &config)
		if config.QuizAnswerHash == "" {
			return nil, fmt.Errorf("quiz quest is misconfigured on the server")
		}

		// Cryptographic check: compare SHA256 of cleaned user input
		cleanedInput := strings.ToLower(strings.TrimSpace(answer))
		hash := sha256.New()
		hash.Write([]byte(cleanedInput))
		userHash := hex.EncodeToString(hash.Sum(nil))

		if userHash != config.QuizAnswerHash {
			return nil, fmt.Errorf("incorrect quiz answer")
		}
	case "campaign":
		var pendingSubquests int
		query := `
			SELECT count(*)
			FROM quests q
			LEFT JOIN user_tasks ut ON q.key = ut.task_key AND ut.user_id = $1 AND ut.completed = true
			WHERE q.parent_key = $2 AND q.is_active = true AND ut.task_key IS NULL
		`
		err := s.db.Pool.QueryRow(ctx, query, userID, taskKey).Scan(&pendingSubquests)
		if err != nil {
			return nil, fmt.Errorf("failed to verify campaign sub-tasks: %w", err)
		}
		if pendingSubquests > 0 {
			return nil, fmt.Errorf("you must complete all sub-tasks first")
		}
	case "link", "social":
		// Dumb verification: Frontend handles timer. Fall through.
	}

	// 2. Begin single unified transaction
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Ensure task row exists first inside transaction so FOR UPDATE successfully locks it
	_, err = tx.Exec(ctx, `
		INSERT INTO user_tasks (user_id, task_key, completed)
		VALUES ($1, $2, false)
		ON CONFLICT (user_id, task_key) DO NOTHING
	`, userID, taskKey)
	if err != nil {
		return nil, fmt.Errorf("failed to ensure task record: %w", err)
	}

	// 3. Lock user task record to prevent concurrent claims
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

	// 5. Update user stats: ensure row exists, then credit Coins (airdrop_coins) and XP.
	_, err = tx.Exec(ctx, `
		INSERT INTO user_stats (user_id, xp, level, current_streak, last_active_at, energy, energy_updated_at, airdrop_coins)
		VALUES ($1, 0, 1, 0, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP, 0.0)
		ON CONFLICT (user_id) DO NOTHING
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to ensure user stats: %w", err)
	}

	var xp, oldLevel int
	updateStatsQuery := `
		UPDATE user_stats
		SET airdrop_coins = airdrop_coins + $1,
		    total_coins_earned = total_coins_earned + $1,
		    xp = xp + $2,
		    last_active_at = CURRENT_TIMESTAMP
		WHERE user_id = $3
		RETURNING xp, level
	`
	err = tx.QueryRow(ctx, updateStatsQuery, target.RewardFrg, target.RewardXp, userID).Scan(&xp, &oldLevel)
	if err != nil {
		return nil, fmt.Errorf("failed to update user stats: %w", err)
	}

	// Handle level up
	newLevel := repository.GetLevelFromXP(xp)
	if newLevel > oldLevel {
		_, err = tx.Exec(ctx, "UPDATE user_stats SET level = $1 WHERE user_id = $2", newLevel, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to update user level: %w", err)
		}
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
		Quest:     *target,
		Completed: true,
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

	// Multi-tap pricing: Level * 3000.0 Coins. Max Level: 10
	mtMax := boosts.MultitapLevel >= 10
	mtPrice := float64(boosts.MultitapLevel) * 3000.0

	// Energy Limit pricing: Level * 2500.0 Coins. Max Level: 10
	elMax := boosts.EnergyLimitLevel >= 10
	elPrice := float64(boosts.EnergyLimitLevel) * 2500.0

	// Tap Bot: Level 0 (not bought) to 1 (bought). Max Level: 1
	tbMax := boosts.TapBotLevel >= 1
	tbPrice := 50000.0

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

// UpgradeBoost purchases a boost upgrade with Coins
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

	// 2. Lock user_stats row first to prevent concurrent balance deductions
	_, err = tx.Exec(ctx, `
		INSERT INTO user_stats (user_id, xp, level, current_streak, last_active_at, energy, energy_updated_at, airdrop_coins)
		VALUES ($1, 0, 1, 0, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP, 0.0)
		ON CONFLICT (user_id) DO NOTHING
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to ensure user stats for upgrade: %w", err)
	}

	var currentCoins float64
	err = tx.QueryRow(ctx, `SELECT COALESCE(airdrop_coins, 0) FROM user_stats WHERE user_id = $1 FOR UPDATE`, userID).Scan(&currentCoins)
	if err != nil {
		return nil, fmt.Errorf("failed to lock user stats: %w", err)
	}

	// 3. Ensure user boosts row exists and lock it
	_, err = tx.Exec(ctx, `
		INSERT INTO user_boosts (user_id, multitap_level, energy_limit_level, tap_bot_level)
		VALUES ($1, 1, 1, 0)
		ON CONFLICT (user_id) DO NOTHING
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to ensure user boosts: %w", err)
	}

	var boosts repository.UserBoosts
	query := `
		SELECT user_id, multitap_level, energy_limit_level, tap_bot_level 
		FROM user_boosts 
		WHERE user_id = $1 FOR UPDATE
	`
	err = tx.QueryRow(ctx, query, userID).Scan(&boosts.UserID, &boosts.MultitapLevel, &boosts.EnergyLimitLevel, &boosts.TapBotLevel)
	if err != nil {
		return nil, fmt.Errorf("failed to lock user boosts: %w", err)
	}

	// 4. Validation and pricing calculation using locked state values (in Coins)
	var nextLevel int
	var priceCoins float64
	var maxLevel bool

	switch boostType {
	case "multitap":
		nextLevel = boosts.MultitapLevel + 1
		priceCoins = float64(max(1, boosts.MultitapLevel)) * 3000.0
		maxLevel = boosts.MultitapLevel >= 10
	case "energy_limit":
		nextLevel = boosts.EnergyLimitLevel + 1
		priceCoins = float64(max(1, boosts.EnergyLimitLevel)) * 2500.0
		maxLevel = boosts.EnergyLimitLevel >= 10
	case "tap_bot":
		nextLevel = boosts.TapBotLevel + 1
		priceCoins = 50000.0
		maxLevel = boosts.TapBotLevel >= 1
	default:
		return nil, fmt.Errorf("invalid boost type")
	}

	if maxLevel {
		return nil, fmt.Errorf("boost level already at maximum")
	}

	// 5. Verify balance
	if currentCoins < priceCoins {
		return nil, fmt.Errorf("insufficient Coin balance: have %.2f, need %.2f", currentCoins, priceCoins)
	}

	// Update user stats with new coin balance
	res, err := tx.Exec(ctx,
		`UPDATE user_stats SET airdrop_coins = airdrop_coins - $1, last_active_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND COALESCE(airdrop_coins, 0) >= $1`,
		priceCoins, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update user coins balance: %w", err)
	}
	if res.RowsAffected() == 0 {
		return nil, fmt.Errorf("insufficient Coin balance during final deduction")
	}

	// 6. Update user_boosts inside transaction
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

	// Queue referral reward for the spent coins
	s.QueueReferralReward(userID, priceCoins)

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
	ClanName  string `json:"clan_name,omitempty"`
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

			// Query database to resolve first_name, username, level, and clan
			query := `
				SELECT u.telegram_id, u.first_name, u.username, us.level, c.chat_title as clan_name
				FROM users u
				JOIN user_stats us ON us.user_id = u.telegram_id
				LEFT JOIN clan_members cm ON cm.user_id = u.telegram_id
				LEFT JOIN clans c ON c.id = cm.clan_id
				WHERE u.telegram_id = ANY($1)
			`
			rows, err := s.db.Pool.Query(ctx, query, ids)
			if err == nil {
				defer rows.Close()
				memberMap := make(map[int64]LeaderboardMember)
				for rows.Next() {
					var id int64
					var fn, username, clanName *string
					var level int
					if err := rows.Scan(&id, &fn, &username, &level, &clanName); err == nil {
						m := LeaderboardMember{
							UserID: id,
							Level:  level,
							XP:     scoreMap[id],
						}
						if fn != nil {
							m.FirstName = *fn
						}
						if username != nil {
							m.Username = *username
						}
						if clanName != nil {
							m.ClanName = *clanName
						}
						memberMap[id] = m
					}
				}

				// Sort according to redis order
				result := make([]LeaderboardMember, 0, len(ids))
				rank := 1
				for _, id := range ids {
					if m, exists := memberMap[id]; exists {
						m.Rank = rank
						result = append(result, m)
						rank++
					}
				}
				return result, nil
			}
		}
	}

	// Fallback to database
	query := `
		SELECT u.telegram_id, u.first_name, u.username, us.xp, us.level, c.chat_title as clan_name
		FROM users u
		JOIN user_stats us ON us.user_id = u.telegram_id
		LEFT JOIN clan_members cm ON cm.user_id = u.telegram_id
		LEFT JOIN clans c ON c.id = cm.clan_id
		ORDER BY us.xp DESC
		LIMIT 100
	`
	rows, err := s.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]LeaderboardMember, 0, 100)
	rank := 1
	var zsetMembers []redis.Z
	for rows.Next() {
		var m LeaderboardMember
		var fn, username, clanName *string
		err := rows.Scan(&m.UserID, &fn, &username, &m.XP, &m.Level, &clanName)
		if err != nil {
			continue
		}
		if fn != nil {
			m.FirstName = *fn
		}
		if username != nil {
			m.Username = *username
		}
		if clanName != nil {
			m.ClanName = *clanName
		}
		m.Rank = rank
		result = append(result, m)
		zsetMembers = append(zsetMembers, redis.Z{
			Score:  float64(m.XP),
			Member: strconv.FormatInt(m.UserID, 10),
		})
		rank++
	}

	// Cache fallback result in Redis with a 60 seconds TTL to protect DB
	if s.cache != nil && s.cache.Client != nil && len(result) > 0 {
		if data, err := json.Marshal(result); err == nil {
			s.cache.Client.Set(ctx, "leaderboard_cached_fallback", data, 60*time.Second)
		}
		if len(zsetMembers) > 0 {
			s.cache.Client.ZAdd(ctx, "leaderboard", zsetMembers...)
		}
	}

	return result, nil
}

func (s *GamificationService) GetGlobalClans(ctx context.Context) ([]map[string]interface{}, error) {
	return s.db.GetGlobalClans(ctx)
}

func (s *GamificationService) GetActiveQuests(ctx context.Context, userID int64) ([]map[string]interface{}, error) {
	return s.db.GetActiveQuests(ctx, userID)
}

type OfflineMiningResult struct {
	Earned          float64 `json:"earned"`
	DurationSeconds int     `json:"durationSeconds"`
}

// CollectOfflineMining calculates and awards offline mining rewards
func (s *GamificationService) CollectOfflineMining(ctx context.Context, userID int64) (*OfflineMiningResult, error) {
	if s.db.Pool == nil {
		return nil, fmt.Errorf("database pool is nil")
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	var level, multitap, energyLimitLevel int
	var lastCollectedAt *time.Time
	var capSeconds int
	var energy int
	var energyUpdatedAt time.Time

	query := `
		SELECT b.tap_bot_level, b.tap_bot_last_collected_at, b.tap_bot_cap_seconds, b.multitap_level, b.energy_limit_level,
		       s.energy, s.energy_updated_at
		FROM user_boosts b
		JOIN user_stats s ON s.user_id = b.user_id
		WHERE b.user_id = $1 FOR UPDATE`
	err = tx.QueryRow(ctx, query, userID).Scan(&level, &lastCollectedAt, &capSeconds, &multitap, &energyLimitLevel, &energy, &energyUpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return &OfflineMiningResult{Earned: 0, DurationSeconds: 0}, nil
		}
		return nil, fmt.Errorf("failed to get user boosts: %w", err)
	}

	if level == 0 {
		return &OfflineMiningResult{Earned: 0, DurationSeconds: 0}, nil
	}

	now := time.Now().UTC()
	if lastCollectedAt == nil {
		lastCollectedAt = &now
	}

	if capSeconds <= 0 {
		capSeconds = 8 * 3600 // 8 hours default cap
	}

	maxEnergy := 500 + (energyLimitLevel-1)*250
	timeToFull := maxEnergy - energy
	if timeToFull < 0 {
		timeToFull = 0
	}
	timeEnergyFullAt := energyUpdatedAt.Add(time.Duration(timeToFull) * time.Second)

	botStartTime := *lastCollectedAt
	if timeEnergyFullAt.After(botStartTime) {
		botStartTime = timeEnergyFullAt
	}

	elapsed := int(now.Sub(botStartTime).Seconds())
	if elapsed < 0 {
		elapsed = 0
	}
	if elapsed > capSeconds {
		elapsed = capSeconds
	}

	rate := (float64(multitap) / 5.0) * float64(level)
	earned := float64(elapsed) * rate
	earnedInt := int(earned)

	if earnedInt > 0 {
		_, err = tx.Exec(ctx, `UPDATE user_stats SET airdrop_coins = airdrop_coins + $1, total_coins_earned = total_coins_earned + $1 WHERE user_id = $2`, earnedInt, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to update user stats: %w", err)
		}
	}

	_, err = tx.Exec(ctx, `UPDATE user_boosts SET tap_bot_last_collected_at = CURRENT_TIMESTAMP WHERE user_id = $1`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to update tap bot last collected: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit: %w", err)
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	return &OfflineMiningResult{Earned: float64(earnedInt), DurationSeconds: elapsed}, nil
}

// ApplyTurbo applies a daily turbo boost
func (s *GamificationService) ApplyTurbo(ctx context.Context, userID int64) error {
	if s.db.Pool == nil {
		return fmt.Errorf("database pool is nil")
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO user_daily_boosts (user_id, day, turbo_used, full_energy_used)
		VALUES ($1, CURRENT_DATE, 0, 0)
		ON CONFLICT (user_id, day) DO NOTHING
	`, userID)
	if err != nil {
		return fmt.Errorf("failed to init daily boosts: %w", err)
	}

	var turboUsed int
	err = tx.QueryRow(ctx, `SELECT turbo_used FROM user_daily_boosts WHERE user_id = $1 AND day = CURRENT_DATE FOR UPDATE`, userID).Scan(&turboUsed)
	if err != nil {
		return fmt.Errorf("failed to lock daily boosts: %w", err)
	}

	if turboUsed >= 2 {
		return fmt.Errorf("daily turbo limit reached")
	}

	_, err = tx.Exec(ctx, `UPDATE user_daily_boosts SET turbo_used = turbo_used + 1, turbo_expires_at = CURRENT_TIMESTAMP + INTERVAL '15 seconds' WHERE user_id = $1 AND day = CURRENT_DATE`, userID)
	if err != nil {
		return fmt.Errorf("failed to update turbo usage: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit: %w", err)
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	return nil
}

// ApplyFullEnergy applies a daily full energy boost
func (s *GamificationService) ApplyFullEnergy(ctx context.Context, userID int64) error {
	if s.db.Pool == nil {
		return fmt.Errorf("database pool is nil")
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO user_daily_boosts (user_id, day, turbo_used, full_energy_used)
		VALUES ($1, CURRENT_DATE, 0, 0)
		ON CONFLICT (user_id, day) DO NOTHING
	`, userID)
	if err != nil {
		return fmt.Errorf("failed to init daily boosts: %w", err)
	}

	var fullEnergyUsed int
	err = tx.QueryRow(ctx, `SELECT full_energy_used FROM user_daily_boosts WHERE user_id = $1 AND day = CURRENT_DATE FOR UPDATE`, userID).Scan(&fullEnergyUsed)
	if err != nil {
		return fmt.Errorf("failed to lock daily boosts: %w", err)
	}

	if fullEnergyUsed >= 3 {
		return fmt.Errorf("daily full energy limit reached")
	}

	_, err = tx.Exec(ctx, `UPDATE user_daily_boosts SET full_energy_used = full_energy_used + 1 WHERE user_id = $1 AND day = CURRENT_DATE`, userID)
	if err != nil {
		return fmt.Errorf("failed to update full energy usage: %w", err)
	}

	var energyLimitLevel int
	err = tx.QueryRow(ctx, `SELECT energy_limit_level FROM user_boosts WHERE user_id = $1`, userID).Scan(&energyLimitLevel)
	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("failed to get energy limit level: %w", err)
	}
	if err == pgx.ErrNoRows {
		energyLimitLevel = 1
	}

	maxEnergy := 500 + ((energyLimitLevel - 1) * 250)

	_, err = tx.Exec(ctx, `UPDATE user_stats SET energy = $1, energy_updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`, maxEnergy, userID)
	if err != nil {
		return fmt.Errorf("failed to refill energy: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit: %w", err)
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	return nil
}
