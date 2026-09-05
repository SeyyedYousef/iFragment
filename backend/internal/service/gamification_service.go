package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/middleware"
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
		go s.startLeaderboardCacheWorker(context.Background())
		go s.startTapBatchWorker(context.Background())
		go s.StartExpirationReminderWorker(context.Background())
		go s.StartTapBotFullReminderWorker(context.Background())
	}

	return s
}

// startLeaderboardCacheWorker refreshes the leaderboard JSON payload every 5 minutes
func (s *GamificationService) startLeaderboardCacheWorker(ctx context.Context) {
	refresh := func() {
		for _, period := range []string{"all", "daily", "weekly"} {
			s.computeAndCacheLeaderboard(ctx, period)
		}
	}
	refresh() // Initial cache
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			refresh()
		}
	}
}

// startTapBatchWorker flushes batched taps from Redis to Postgres every 30 seconds
func (s *GamificationService) startTapBatchWorker(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.flushTapBatches(ctx)
		}
	}
}

func (s *GamificationService) flushTapBatches(ctx context.Context) {
	if s.cache == nil || s.cache.Client == nil || s.cache.IsQuotaExceeded() || s.db == nil || s.db.Pool == nil {
		return
	}

	// Rename key to avoid race conditions during processing
	batchKey := "profile:taps:batch"
	processingKey := "profile:taps:batch:processing"
	err := s.cache.Client.Rename(ctx, batchKey, processingKey).Err()
	if err != nil {
		if err == redis.Nil || strings.Contains(strings.ToLower(err.Error()), "no such key") {
			return // Nothing to process
		}
		if s.cache.HandleError(err) {
			return
		}
		slog.Error("failed to rename tap batch key", "err", err)
		return
	}

	taps, err := s.cache.Client.HGetAll(ctx, processingKey).Result()
	if err != nil {
		if !s.cache.HandleError(err) {
			slog.Error("failed to get processing tap batch", "err", err)
		}
		return
	}

	if len(taps) == 0 {
		return
	}

	// Batch update PostgreSQL
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		slog.Error("failed to begin tap batch tx", "err", err)
		return
	}
	defer tx.Rollback(ctx)

	stmt := `
		UPDATE user_stats 
		SET airdrop_coins = airdrop_coins + $2,
			xp = xp + $2,
			total_coins_earned = total_coins_earned + $2
		WHERE user_id = $1
	`

	var pipe redis.Pipeliner
	if s.cache != nil && s.cache.Client != nil {
		pipe = s.cache.Client.Pipeline()
	}

	now := time.Now().UTC()
	dayKey := fmt.Sprintf("leaderboard:daily:%s", now.Format("2006-01-02"))
	year, week := now.ISOWeek()
	weekKey := fmt.Sprintf("leaderboard:weekly:%d-W%02d", year, week)
	hasUpdates := false

	for userIDStr, tapCountStr := range taps {
		userID, err := strconv.ParseInt(userIDStr, 10, 64)
		if err != nil {
			continue
		}
		tapCount, err := strconv.ParseInt(tapCountStr, 10, 64)
		if err != nil || tapCount <= 0 {
			continue
		}

		_, err = tx.Exec(ctx, stmt, userID, tapCount)
		if err != nil {
			slog.Error("failed to update taps in db", "user", userID, "err", err)
		} else if pipe != nil {
			hasUpdates = true
			pipe.ZIncrBy(ctx, "leaderboard", float64(tapCount), userIDStr)
			pipe.ZIncrBy(ctx, "leaderboard:all", float64(tapCount), userIDStr)
			pipe.ZIncrBy(ctx, dayKey, float64(tapCount), userIDStr)
			pipe.ZIncrBy(ctx, weekKey, float64(tapCount), userIDStr)
			pipe.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
		}
	}

	if pipe != nil && hasUpdates {
		pipe.Expire(ctx, dayKey, 48*time.Hour)
		pipe.Expire(ctx, weekKey, 14*24*time.Hour)
		if _, err := pipe.Exec(ctx); err != nil {
			slog.Error("failed to execute batched leaderboard pipeline", "err", err)
		}
	}

	err = tx.Commit(ctx)
	if err != nil {
		slog.Error("failed to commit tap batch tx", "err", err)
	} else if s.cache != nil && s.cache.Client != nil {
		// Clean up processing key
		s.cache.Client.Del(ctx, processingKey)
	}
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
	1: {Frg: 500, Xp: 10},
	2: {Frg: 1000, Xp: 20},
	3: {Frg: 2500, Xp: 50},
	4: {Frg: 5000, Xp: 100},
	5: {Frg: 10000, Xp: 200},
	6: {Frg: 25000, Xp: 300},
	7: {Frg: 50000, Xp: 500},
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

	totalStreak := streak + 1
	rewardDay := ((totalStreak - 1) % 7) + 1
	reward := dailyRewards[rewardDay]

	// 3. Update user_daily_claims in transaction
	claimQuery := `
		INSERT INTO user_daily_claims (user_id, last_claimed_at, streak)
		VALUES ($1, CURRENT_TIMESTAMP, $2)
		ON CONFLICT (user_id) DO UPDATE
		SET last_claimed_at = CURRENT_TIMESTAMP, streak = $2
	`
	_, err = tx.Exec(ctx, claimQuery, userID, totalStreak)
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
	err = tx.QueryRow(ctx, updateStatsQuery, reward.Frg, reward.Xp, totalStreak, userID).Scan(&xp, &oldLevel)
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

	// Record 15-day expiring credit batch
	if reward.Frg > 0 {
		_, _ = tx.Exec(ctx, `
			INSERT INTO user_credit_batches (user_id, amount, remaining_amount, source, earned_at, expires_at, is_expired)
			VALUES ($1, $2, $2, 'streak', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '15 days', FALSE)
		`, userID, reward.Frg)
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
		s.cache.Client.ZRemRangeByRank(ctx, "leaderboard", 0, -1001)
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	timeLeft := float64(86400) - float64(now.Hour()*3600+now.Minute()*60+now.Second())
	return &DailyRewardInfo{
		Streak:    totalStreak,
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
	activeQuests, err := ownerRepo.GetQuests(ctx)
	if err != nil {
		return nil, err
	}

	// Fetch user stats for progress tracking
	var taps int
	var level int
	var referrals int
	var hasClan bool
	var isPremium bool
	_ = s.db.Pool.QueryRow(ctx, "SELECT COALESCE(total_taps, 0), COALESCE(level, 1) FROM user_stats WHERE user_id = $1", userID).Scan(&taps, &level)
	_ = s.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE referred_by = $1", userID).Scan(&referrals)
	_ = s.db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM clan_members WHERE user_id = $1)", userID).Scan(&hasClan)
	_ = s.db.Pool.QueryRow(ctx, "SELECT COALESCE(is_premium, false) FROM users WHERE telegram_id = $1", userID).Scan(&isPremium)
	if !isPremium {
		if rawUser := ctx.Value(middleware.UserContextKey); rawUser != nil {
			if userMap, ok := rawUser.(map[string]interface{}); ok {
				if tgIsPremium, ok := userMap["is_premium"].(bool); ok && tgIsPremium {
					isPremium = true
					_, _ = s.db.Pool.Exec(ctx, "UPDATE users SET is_premium = TRUE WHERE telegram_id = $1", userID)
				}
			}
		}
	}

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
			if hasClan {
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
				q.ActionText = "@Fragmentscommunity"
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

	// 1. Dynamic backend verification checks with machine-readable error codes
	switch target.Type {
	case "league_gold":
		var level int
		_ = s.db.Pool.QueryRow(ctx, "SELECT level FROM user_stats WHERE user_id = $1", userID).Scan(&level)
		if level < 3 {
			return nil, fmt.Errorf("ERR_NEED_GOLD_LEAGUE")
		}
	case "join_clan":
		var hasClan bool
		err := s.db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM clan_members WHERE user_id = $1)", userID).Scan(&hasClan)
		if err != nil || !hasClan {
			return nil, fmt.Errorf("ERR_NEED_CLAN")
		}
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
			return nil, fmt.Errorf("ERR_NEED_FRENS_COUNT:%d", required)
		}
	case "taps_100k":
		var taps int
		_ = s.db.Pool.QueryRow(ctx, "SELECT COALESCE(total_taps, 0) FROM user_stats WHERE user_id = $1", userID).Scan(&taps)
		if taps < 100000 {
			return nil, fmt.Errorf("ERR_NEED_100K_TAPS")
		}
	case "telegram_premium":
		var isPremium bool
		_ = s.db.Pool.QueryRow(ctx, "SELECT COALESCE(is_premium, false) FROM users WHERE telegram_id = $1", userID).Scan(&isPremium)
		if !isPremium {
			if rawUser := ctx.Value(middleware.UserContextKey); rawUser != nil {
				if userMap, ok := rawUser.(map[string]interface{}); ok {
					if tgIsPremium, ok := userMap["is_premium"].(bool); ok && tgIsPremium {
						isPremium = true
						_, _ = s.db.Pool.Exec(ctx, "UPDATE users SET is_premium = TRUE WHERE telegram_id = $1", userID)
					}
				}
			}
		}
		if !isPremium {
			tgClient := s.getBotAPIClient()
			if tgClient != nil {
				memberRes, err := tgClient.GetChatMemberFull(ctx, userID, userID)
				if err == nil && memberRes != nil && memberRes.User.IsPremium {
					isPremium = true
					_, _ = s.db.Pool.Exec(ctx, "UPDATE users SET is_premium = TRUE WHERE telegram_id = $1", userID)
				}
			}
		}
		if !isPremium {
			return nil, fmt.Errorf("ERR_NEED_TG_PREMIUM")
		}
	case "channel_join":
		var config struct {
			ChannelUsername string `json:"channel_username"`
		}
		_ = json.Unmarshal(target.Config, &config)
		channelName := config.ChannelUsername
		if channelName == "" {
			channelName = "@Fragmentscommunity"
		} else if !strings.HasPrefix(channelName, "@") && !strings.HasPrefix(channelName, "-") {
			channelName = "@" + channelName
		}

		tgClient := s.getBotAPIClient()
		if tgClient == nil {
			if os.Getenv("APP_ENV") == "production" {
				return nil, fmt.Errorf("ERR_BOT_TOKEN_MISSING")
			}
		} else {
			status, err := s.getChatMemberCached(ctx, tgClient, channelName, userID)
			if err != nil {
				return nil, fmt.Errorf("ERR_MEMBERSHIP_PENDING")
			}
			if status == "left" || status == "kicked" || status == "" {
				return nil, fmt.Errorf("ERR_NEED_CHANNEL_JOIN")
			}
		}
	case "quiz":
		var config struct {
			QuizAnswerHash string `json:"quiz_answer_hash"`
		}
		_ = json.Unmarshal(target.Config, &config)
		if config.QuizAnswerHash == "" {
			return nil, fmt.Errorf("ERR_QUIZ_MISCONFIGURED")
		}

		cleanedInput := strings.ToLower(strings.TrimSpace(answer))
		hash := sha256.New()
		hash.Write([]byte(cleanedInput))
		userHash := hex.EncodeToString(hash.Sum(nil))

		if userHash != config.QuizAnswerHash {
			return nil, fmt.Errorf("ERR_INCORRECT_QUIZ_ANSWER")
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

	// Record 15-day expiring credit batch for airdrop coins
	if target.RewardFrg > 0 {
		_, _ = tx.Exec(ctx, `
			INSERT INTO user_credit_batches (user_id, amount, remaining_amount, source, earned_at, expires_at, is_expired)
			VALUES ($1, $2, $2, 'task', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '15 days', FALSE)
		`, userID, target.RewardFrg)
	}

	// Reward Intel Credits if quest config specifies intel_credit reward
	var questCfg struct {
		RewardType   string `json:"reward_type"`
		IntelCredits int    `json:"intel_credits"`
	}
	_ = json.Unmarshal(target.Config, &questCfg)
	if questCfg.RewardType == "intel_credit" || questCfg.IntelCredits > 0 {
		creditsAmount := questCfg.IntelCredits
		if creditsAmount <= 0 {
			creditsAmount = 1
		}
		var batchID string
		err = tx.QueryRow(ctx, `
			INSERT INTO intel_credit_batches (user_id, kind, amount, remaining, source, reference_id, created_at)
			VALUES ($1, 'intel_report', $2, $2, 'task_reward', $3, now())
			RETURNING id::text
		`, userID, creditsAmount, taskKey).Scan(&batchID)
		if err == nil && batchID != "" {
			_, _ = tx.Exec(ctx, `
				INSERT INTO intel_credit_ledger (user_id, delta, reason, entity, batch_id, created_at)
				VALUES ($1, $2, $3, $4, $5::uuid, now())
			`, userID, creditsAmount, "reward:"+taskKey, taskKey, batchID)
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
		s.cache.Client.ZRemRangeByRank(ctx, "leaderboard", 0, -1001)
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

	// 5. Verify balance and deduct via FIFO
	if currentCoins < priceCoins {
		return nil, fmt.Errorf("insufficient Coin balance: have %.2f, need %.2f", currentCoins, priceCoins)
	}

	if err := s.db.DeductCreditsFIFO(ctx, tx, userID, priceCoins); err != nil {
		return nil, fmt.Errorf("failed to deduct credits: %w", err)
	}

	// 6. Update user_boosts inside transaction
	var updateQuery string
	switch boostType {
	case "multitap":
		updateQuery = "UPDATE user_boosts SET multitap_level = $1 WHERE user_id = $2"
	case "energy_limit":
		updateQuery = "UPDATE user_boosts SET energy_limit_level = $1 WHERE user_id = $2"
	case "tap_bot":
		updateQuery = "UPDATE user_boosts SET tap_bot_level = $1, tap_bot_last_collected_at = CURRENT_TIMESTAMP WHERE user_id = $2"
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

// GetLeaderboard retrieves Top 100 members sorted by XP for a given period and league
func (s *GamificationService) GetLeaderboard(ctx context.Context, userID int64, period string, league string) ([]LeaderboardMember, int, int64, error) {
	if period == "" {
		period = "day"
	}

	var minXP, maxXP int
	hasLeague := false
	switch strings.ToLower(league) {
	case "bronze":
		minXP, maxXP = 0, 5000
		hasLeague = true
	case "silver":
		minXP, maxXP = 5000, 25000
		hasLeague = true
	case "gold":
		minXP, maxXP = 25000, 100000
		hasLeague = true
	case "platinum":
		minXP, maxXP = 100000, 500000
		hasLeague = true
	case "diamond":
		minXP, maxXP = 500000, 2000000
		hasLeague = true
	case "master":
		minXP, maxXP = 2000000, 10000000
		hasLeague = true
	case "grandmaster":
		minXP, maxXP = 10000000, 1000000000
		hasLeague = true
	}

	res := make([]LeaderboardMember, 0)
	var err error

	if hasLeague && s.db != nil && s.db.Pool != nil {
		// Query users in this league specifically
		query := `
			SELECT u.telegram_id, u.first_name, u.username, us.xp, us.level, c.chat_title as clan_name
			FROM users u
			JOIN user_stats us ON us.user_id = u.telegram_id
			LEFT JOIN clan_members cm ON cm.user_id = u.telegram_id
			LEFT JOIN clans c ON c.id = cm.clan_id
			WHERE us.xp >= $1 AND us.xp < $2
			ORDER BY us.xp DESC
			LIMIT 100
		`
		rows, queryErr := s.db.Pool.Query(ctx, query, minXP, maxXP)
		if queryErr == nil {
			defer rows.Close()
			rank := 1
			for rows.Next() {
				var m LeaderboardMember
				var fn, username, clanName *string
				if err := rows.Scan(&m.UserID, &fn, &username, &m.XP, &m.Level, &clanName); err == nil {
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
					res = append(res, m)
					rank++
				}
			}
		}
	} else {
		cacheKey := fmt.Sprintf("stats:leaderboard:payload:%s", period)
		if s.cache != nil && s.cache.Client != nil {
			cached, err := s.cache.Client.Get(ctx, cacheKey).Result()
			if err == nil && cached != "" {
				_ = json.Unmarshal([]byte(cached), &res)
			}
		}
		if len(res) == 0 {
			res, err = s.computeAndCacheLeaderboard(ctx, period)
			if err == nil && len(res) > 0 && s.cache != nil && s.cache.Client != nil {
				if data, err := json.Marshal(res); err == nil {
					_ = s.cache.Client.Set(ctx, cacheKey, string(data), 2*time.Minute).Err()
				}
			}
		}
	}

	userRank := 0
	if userID > 0 && s.db != nil && s.db.Pool != nil {
		if hasLeague {
			_ = s.db.Pool.QueryRow(ctx, `
				SELECT COUNT(*) + 1 FROM user_stats 
				WHERE xp >= $1 AND xp < $2 AND xp > (SELECT COALESCE(xp, 0) FROM user_stats WHERE user_id = $3)
			`, minXP, maxXP, userID).Scan(&userRank)
		} else {
			_ = s.db.Pool.QueryRow(ctx, `
				SELECT COUNT(*) + 1 FROM user_stats 
				WHERE xp > (SELECT COALESCE(xp, 0) FROM user_stats WHERE user_id = $1)
			`, userID).Scan(&userRank)
		}
	}

	totalMiners, _ := s.GetTotalMiners(ctx)
	return res, userRank, totalMiners, err
}

// StartExpirationReminderWorker checks users whose credit batches expire in 5 days (Day 25 of 30)
func (s *GamificationService) StartExpirationReminderWorker(ctx context.Context) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.checkExpiringCredits(ctx)
		}
	}
}

func (s *GamificationService) checkExpiringCredits(ctx context.Context) {
	if s.db == nil || s.db.Pool == nil {
		return
	}

	query := `
		SELECT DISTINCT user_id, SUM(remaining_amount) as expiring_amount
		FROM user_credit_batches
		WHERE is_expired = FALSE 
		  AND remaining_amount > 0 
		  AND expires_at BETWEEN NOW() + INTERVAL '4 days' AND NOW() + INTERVAL '6 days'
		GROUP BY user_id
	`
	rows, err := s.db.Pool.Query(ctx, query)
	if err != nil {
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var userID int64
		var expiringAmount float64
		if err := rows.Scan(&userID, &expiringAmount); err == nil {
			slog.Info("Day-25 Expiration Reminder queued for user", "userID", userID, "expiringAmount", expiringAmount)
			count++
		}
	}
	slog.Info("Completed Day-25 coin expiration check", "notified_users", count)
}

func (s *GamificationService) computeAndCacheLeaderboard(ctx context.Context, period string) ([]LeaderboardMember, error) {
	now := time.Now().UTC()
	var redisZSetKey string
	switch strings.ToLower(period) {
	case "daily", "day":
		redisZSetKey = fmt.Sprintf("leaderboard:daily:%s", now.Format("2006-01-02"))
	case "weekly", "week":
		year, week := now.ISOWeek()
		redisZSetKey = fmt.Sprintf("leaderboard:weekly:%d-W%02d", year, week)
	default:
		redisZSetKey = "leaderboard"
	}

	var ids []int64
	scoreMap := make(map[int64]int)

	if s.cache != nil && s.cache.Client != nil {
		membersZ, err := s.cache.Client.ZRevRangeWithScores(ctx, redisZSetKey, 0, 99).Result()
		if (err != nil || len(membersZ) == 0) && (period == "" || strings.EqualFold(period, "all")) {
			// Fallback to legacy "leaderboard:all" key
			membersZ, err = s.cache.Client.ZRevRangeWithScores(ctx, "leaderboard:all", 0, 99).Result()
		}
		if err == nil && len(membersZ) > 0 {
			for _, m := range membersZ {
				id, err := strconv.ParseInt(m.Member.(string), 10, 64)
				if err == nil {
					ids = append(ids, id)
					scoreMap[id] = int(m.Score)
				}
			}
		}
	}

	result := make([]LeaderboardMember, 0, 100)

	if len(ids) > 0 {
		// We have Redis ids, query DB for names
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

			rank := 1
			for _, id := range ids {
				if m, exists := memberMap[id]; exists {
					m.Rank = rank
					result = append(result, m)
					rank++
				}
			}
		}
	}

	if len(result) == 0 {
		// Fallback to pure DB query if redis ZSET was empty
		interval := "1 day"
		if period == "week" {
			interval = "7 days"
		}

		query := fmt.Sprintf(`
			SELECT u.telegram_id, u.first_name, u.username, us.xp, us.level, c.chat_title as clan_name
			FROM users u
			JOIN user_stats us ON us.user_id = u.telegram_id
			LEFT JOIN clan_members cm ON cm.user_id = u.telegram_id
			LEFT JOIN clans c ON c.id = cm.clan_id
			WHERE us.last_active_at >= NOW() - INTERVAL '%s'
			ORDER BY us.xp DESC
			LIMIT 100
		`, interval)
		rows, err := s.db.Pool.Query(ctx, query)
		fallbackNeeded := err != nil
		if err == nil {
			rank := 1
			for rows.Next() {
				var m LeaderboardMember
				var fn, username, clanName *string
				if scanErr := rows.Scan(&m.UserID, &fn, &username, &m.XP, &m.Level, &clanName); scanErr == nil {
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
					rank++
				}
			}
			rows.Close()
			if len(result) == 0 {
				fallbackNeeded = true
			}
		}

		if fallbackNeeded {
			fallbackQuery := `
				SELECT u.telegram_id, u.first_name, u.username, us.xp, us.level, c.chat_title as clan_name
				FROM users u
				JOIN user_stats us ON us.user_id = u.telegram_id
				LEFT JOIN clan_members cm ON cm.user_id = u.telegram_id
				LEFT JOIN clans c ON c.id = cm.clan_id
				ORDER BY us.xp DESC
				LIMIT 100
			`
			fbRows, fbErr := s.db.Pool.Query(ctx, fallbackQuery)
			if fbErr == nil {
				defer fbRows.Close()
				rank := 1
				for fbRows.Next() {
					var m LeaderboardMember
					var fn, username, clanName *string
					if scanErr := fbRows.Scan(&m.UserID, &fn, &username, &m.XP, &m.Level, &clanName); scanErr == nil {
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
						rank++
					}
				}
			}
		}

		// Repair sorted set if needed
		if s.cache != nil && s.cache.Client != nil && len(result) > 0 {
			var zsetMembers []redis.Z
			for _, m := range result {
				zsetMembers = append(zsetMembers, redis.Z{
					Score:  float64(m.XP),
					Member: strconv.FormatInt(m.UserID, 10),
				})
			}
			s.cache.Client.ZAdd(ctx, redisZSetKey, zsetMembers...)
		}
	}

	return result, nil
}

// GetTotalMiners returns the total number of users
func (s *GamificationService) GetTotalMiners(ctx context.Context) (int64, error) {
	if s.cache != nil && s.cache.Client != nil {
		val, err := s.cache.Client.Get(ctx, "stats:total_miners").Int64()
		if err == nil && val > 0 {
			return val, nil
		}
	}

	var count int64
	err := s.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	if err == nil && s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Set(ctx, "stats:total_miners", count, 5*time.Minute)
	}
	return count, err
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
	SessionCap      float64 `json:"sessionCap,omitempty"`
	DailyRemaining  float64 `json:"dailyRemaining,omitempty"`
}

const (
	// minOfflineDuration is the minimum seconds the user must be offline for bot to mine (1 minute)
	minOfflineDuration = 60
	// collectionCooldownSec prevents rapid re-collection calls (60 seconds)
	collectionCooldownSec = 60
	// dailyCapMultiplier defines how many session-caps worth of coins can be earned per day
	dailyCapMultiplier = 3
)

// StartOfflineMining records the user's current energy state when they go offline.
// The frontend calls this when the app becomes hidden / user leaves.
func (s *GamificationService) StartOfflineMining(ctx context.Context, userID int64) error {
	if s.db.Pool == nil {
		return fmt.Errorf("database pool is nil")
	}

	var storedEnergy int
	var energyUpdatedAt time.Time
	var energyLimitLevel int

	err := s.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(s.energy, 500), COALESCE(s.energy_updated_at, now()), COALESCE(b.energy_limit_level, 1)
		FROM user_stats s
		LEFT JOIN user_boosts b ON s.user_id = b.user_id
		WHERE s.user_id = $1
	`, userID).Scan(&storedEnergy, &energyUpdatedAt, &energyLimitLevel)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil
		}
		return fmt.Errorf("failed to read energy state: %w", err)
	}

	maxEnergy := 500 + (energyLimitLevel-1)*250
	regen := int(time.Since(energyUpdatedAt).Seconds())
	currentEnergy := storedEnergy + regen
	if currentEnergy > maxEnergy {
		currentEnergy = maxEnergy
	}

	_, err = s.db.Pool.Exec(ctx, `
		UPDATE user_boosts
		SET tap_bot_energy_snapshot = $1,
		    tap_bot_last_collected_at = CURRENT_TIMESTAMP
		WHERE user_id = $2
	`, currentEnergy, userID)
	if err != nil {
		return fmt.Errorf("failed to snapshot energy for mining: %w", err)
	}

	return nil
}

// CollectOfflineMining calculates and awards offline mining rewards:
// 1. Minimum offline duration: 60 seconds
// 2. Collection cooldown: 60 seconds
// 3. Dynamic scaling: rates and caps scale with Multitap, Energy Limit, and Bot Level
// 4. Session cap: (maxEnergy * multitap * 1.5) + 2000
// 5. Daily cap: sessionCap * 3
// 6. Smooth diminishing returns
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
	var energySnapshot int
	var dailyEarned float64
	var dailyResetAt *time.Time

	query := `
		SELECT b.tap_bot_level, b.tap_bot_last_collected_at, b.tap_bot_cap_seconds,
		       b.multitap_level, b.energy_limit_level,
		       COALESCE(b.tap_bot_energy_snapshot, 0),
		       COALESCE(b.tap_bot_daily_earned, 0),
		       b.tap_bot_daily_reset_at
		FROM user_boosts b
		JOIN user_stats s ON s.user_id = b.user_id
		WHERE b.user_id = $1 FOR UPDATE`
	err = tx.QueryRow(ctx, query, userID).Scan(
		&level, &lastCollectedAt, &capSeconds,
		&multitap, &energyLimitLevel,
		&energySnapshot, &dailyEarned, &dailyResetAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return &OfflineMiningResult{Earned: 0, DurationSeconds: 0}, nil
		}
		return nil, fmt.Errorf("failed to get user boosts: %w", err)
	}

	// Tap Bot not purchased
	if level == 0 {
		return &OfflineMiningResult{Earned: 0, DurationSeconds: 0}, nil
	}

	now := time.Now().UTC()
	if lastCollectedAt == nil {
		lastCollectedAt = &now
	}

	elapsed := int(now.Sub(*lastCollectedAt).Seconds())
	if elapsed < 0 {
		elapsed = 0
	}

	// Rule 1: Collection cooldown & minimum offline duration
	if elapsed < collectionCooldownSec || elapsed < minOfflineDuration {
		return &OfflineMiningResult{Earned: 0, DurationSeconds: elapsed}, nil
	}

	if capSeconds <= 0 {
		capSeconds = 12 * 3600 // 12 hours default cap
	}
	if elapsed > capSeconds {
		elapsed = capSeconds
	}

	// Rule 2: Reset daily counter if new day
	today := now.Truncate(24 * time.Hour)
	if dailyResetAt == nil || dailyResetAt.Before(today) {
		dailyEarned = 0
	}

	maxEnergy := 500 + (energyLimitLevel-1)*250
	multitapLevel := max(1, multitap)
	energyLevel := max(1, energyLimitLevel)

	// Calculate balanced caps based on player stats
	sessionCap := (float64(maxEnergy*multitapLevel) * 1.5) + 2000.0
	dailyCap := sessionCap * float64(dailyCapMultiplier)

	// Check daily cap headroom
	dailyRemaining := dailyCap - dailyEarned
	if dailyRemaining <= 0 {
		_, _ = tx.Exec(ctx, `UPDATE user_boosts SET tap_bot_last_collected_at = CURRENT_TIMESTAMP WHERE user_id = $1`, userID)
		_ = tx.Commit(ctx)
		return &OfflineMiningResult{Earned: 0, DurationSeconds: elapsed, DailyRemaining: 0}, nil
	}

	// Base rate scaled with player level, multitap, and energy limit
	baseRate := (float64(multitapLevel)*0.35 + float64(energyLevel)*0.15 + 0.20) * float64(level)

	// Calculate earned with diminishing returns applied against session cap
	earned := calculateDiminishingEarnings(float64(elapsed), baseRate, sessionCap)

	// Clamp to session cap
	if earned > sessionCap {
		earned = sessionCap
	}

	// Clamp to daily remaining
	if earned > dailyRemaining {
		earned = dailyRemaining
	}

	earnedInt := int(earned)

	if earnedInt > 0 {
		_, err = tx.Exec(ctx, `UPDATE user_stats SET airdrop_coins = airdrop_coins + $1, total_coins_earned = total_coins_earned + $1 WHERE user_id = $2`, earnedInt, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to update user stats: %w", err)
		}
		_, _ = tx.Exec(ctx, `
			INSERT INTO user_credit_batches (user_id, amount, remaining_amount, source, earned_at, expires_at, is_expired)
			VALUES ($1, $2, $2, 'offline', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '15 days', FALSE)
		`, userID, float64(earnedInt))
	}

	// Update tap bot state: reset timer, accumulate daily earnings, reset daily date if new day, clear notification flag
	_, err = tx.Exec(ctx, `
		UPDATE user_boosts
		SET tap_bot_last_collected_at = CURRENT_TIMESTAMP,
		    tap_bot_daily_earned = CASE
		        WHEN tap_bot_daily_reset_at IS NULL OR tap_bot_daily_reset_at < $2::date THEN $3
		        ELSE COALESCE(tap_bot_daily_earned, 0) + $3
		    END,
		    tap_bot_daily_reset_at = $2::date,
		    tap_bot_energy_snapshot = 0,
		    tap_bot_notified_at = NULL
		WHERE user_id = $1
	`, userID, now, float64(earnedInt))
	if err != nil {
		return nil, fmt.Errorf("failed to update tap bot state: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit: %w", err)
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	newDailyEarned := dailyEarned + float64(earnedInt)
	return &OfflineMiningResult{
		Earned:          float64(earnedInt),
		DurationSeconds: elapsed,
		SessionCap:      sessionCap,
		DailyRemaining:  max(0, dailyCap-newDailyEarned),
	}, nil
}

// calculateDiminishingEarnings applies tiered diminishing returns:
// - First 50% of session cap: 100% rate
// - 50%-75% of session cap: 50% rate
// - 75%-100% of session cap: 25% rate
func calculateDiminishingEarnings(elapsedSec, baseRate, sessionCap float64) float64 {
	if sessionCap <= 0 || baseRate <= 0 {
		return 0
	}

	tier1Limit := sessionCap * 0.50 // First 50%
	tier2Limit := sessionCap * 0.75 // Next 25%

	var earned float64
	remainingTime := elapsedSec

	// Tier 1: full rate until 50% of cap
	tier1Time := tier1Limit / baseRate
	if remainingTime <= tier1Time {
		return remainingTime * baseRate
	}
	earned += tier1Limit
	remainingTime -= tier1Time

	// Tier 2: 50% rate from 50% to 75% of cap
	tier2Rate := baseRate * 0.5
	tier2Amount := tier2Limit - tier1Limit // 25% of cap
	tier2Time := tier2Amount / tier2Rate
	if remainingTime <= tier2Time {
		earned += remainingTime * tier2Rate
		return earned
	}
	earned += tier2Amount
	remainingTime -= tier2Time

	// Tier 3: 25% rate from 75% to 100% of cap
	tier3Rate := baseRate * 0.25
	tier3Amount := sessionCap - tier2Limit // 25% of cap
	tier3Time := tier3Amount / tier3Rate
	if remainingTime <= tier3Time {
		earned += remainingTime * tier3Rate
		return earned
	}
	earned += tier3Amount

	return earned
}

// StartTapBotFullReminderWorker periodically checks users whose 12-hour offline mining is full
func (s *GamificationService) StartTapBotFullReminderWorker(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.notifyFullTapBots(ctx)
		}
	}
}

func (s *GamificationService) notifyFullTapBots(ctx context.Context) {
	if s.db == nil || s.db.Pool == nil {
		return
	}

	tg := s.getBotAPIClient()
	if tg == nil {
		return
	}

	query := `
		SELECT b.user_id, COALESCE(u.language_code, 'en') as lang
		FROM user_boosts b
		LEFT JOIN users u ON u.telegram_id = b.user_id
		WHERE b.tap_bot_level >= 1
		  AND b.tap_bot_last_collected_at IS NOT NULL
		  AND b.tap_bot_last_collected_at <= NOW() - (COALESCE(b.tap_bot_cap_seconds, 43200) * INTERVAL '1 second')
		  AND (b.tap_bot_notified_at IS NULL OR b.tap_bot_notified_at < b.tap_bot_last_collected_at)
		LIMIT 100
	`
	rows, err := s.db.Pool.Query(ctx, query)
	if err != nil {
		slog.Error("failed to query full tap bots", "err", err)
		return
	}
	defer rows.Close()

	type notifyTarget struct {
		UserID int64
		Lang   string
	}
	var targets []notifyTarget
	for rows.Next() {
		var t notifyTarget
		if err := rows.Scan(&t.UserID, &t.Lang); err == nil {
			targets = append(targets, t)
		}
	}

	if len(targets) == 0 {
		return
	}

	miniAppURL := os.Getenv("TELEGRAM_MINI_APP_URL")
	if miniAppURL == "" {
		miniAppURL = "https://t.me/iFragmentBot/app?startapp=tap"
	}

	for _, target := range targets {
		var msgText string
		var btnText string

		switch strings.ToLower(target.Lang) {
		case "fa", "fas", "per":
			msgText = "🤖 <b>ظرفیت ربات استخراج شما تکمیل شد!</b>\n\nربات ماینر شما به مدت ۱۲ ساعت استخراج کرده و مخزن آن پر شده است. برای دریافت سکه‌ها و فعال‌سازی مجدد استخراج، وارد وب‌اپ شوید."
			btnText = "🪙 دریافت سکه‌های ماین‌شده"
		case "ru":
			msgText = "🤖 <b>Ваш майнинг-бот заполнен!</b>\n\nВаш авто-бот добывал монеты в течение 12 часов. Зайдите в приложение, чтобы забрать награду и продолжить добычу."
			btnText = "🪙 Забрать монеты"
		default:
			msgText = "🤖 <b>Your Tap-Bot storage is full!</b>\n\nYour mining bot has been active for 12 hours. Open the app now to claim your mined coins and resume mining."
			btnText = "🪙 Claim Mined Coins"
		}

		replyMarkup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{
						"text": btnText,
						"url":  miniAppURL,
					},
				},
			},
		}

		_, sendErr := tg.SendMessageWithMarkup(ctx, target.UserID, msgText, replyMarkup, nil, "HTML")
		if sendErr != nil {
			slog.Debug("failed to send tap bot full reminder", "userID", target.UserID, "err", sendErr)
		}

		_, _ = s.db.Pool.Exec(ctx, `UPDATE user_boosts SET tap_bot_notified_at = CURRENT_TIMESTAMP WHERE user_id = $1`, target.UserID)
	}
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

type DailyComboStatus struct {
	IsActive  bool  `json:"is_active"`
	IsClaimed bool  `json:"is_claimed"`
	Reward    int64 `json:"reward"`
}

func (s *GamificationService) GetDailyComboStatus(ctx context.Context, userID int64) (*DailyComboStatus, error) {
	combo, err := s.db.GetTodayCombo(ctx)
	if err != nil {
		return nil, err
	}
	if combo == nil {
		return &DailyComboStatus{IsActive: false}, nil
	}

	claimed, err := s.db.HasClaimedCombo(ctx, userID, combo.ID)
	if err != nil {
		return nil, err
	}

	return &DailyComboStatus{
		IsActive:  true,
		IsClaimed: claimed,
		Reward:    combo.RewardAmount,
	}, nil
}

func (s *GamificationService) ClaimDailyCombo(ctx context.Context, userID int64, secretWord string) error {
	combo, err := s.db.GetTodayCombo(ctx)
	if err != nil {
		return fmt.Errorf("failed to check today's combo: %w", err)
	}
	if combo == nil {
		return fmt.Errorf("no daily combo is active today")
	}

	if strings.ToUpper(strings.TrimSpace(secretWord)) != strings.ToUpper(strings.TrimSpace(combo.SecretWord)) {
		return fmt.Errorf("incorrect secret word")
	}

	claimed, err := s.db.HasClaimedCombo(ctx, userID, combo.ID)
	if err != nil {
		return fmt.Errorf("failed to verify claim status: %w", err)
	}
	if claimed {
		return fmt.Errorf("you have already claimed today's combo")
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO user_daily_combo_claims (user_id, combo_id)
		VALUES ($1, $2)
	`, userID, combo.ID)
	if err != nil {
		return fmt.Errorf("failed to record claim: %w", err)
	}

	var beforeCoins float64
	_ = tx.QueryRow(ctx, "SELECT COALESCE(airdrop_coins, 0) FROM user_stats WHERE user_id = $1", userID).Scan(&beforeCoins)
	afterCoins := beforeCoins + float64(combo.RewardAmount)

	_, err = tx.Exec(ctx, `
		UPDATE user_stats 
		SET airdrop_coins = COALESCE(airdrop_coins, 0) + $2,
		    total_coins_earned = COALESCE(total_coins_earned, 0) + $2,
		    xp = COALESCE(xp, 0) + $2
		WHERE user_id = $1
	`, userID, combo.RewardAmount)
	if err != nil {
		return fmt.Errorf("failed to grant reward: %w", err)
	}

	_, _ = tx.Exec(ctx, `
		INSERT INTO user_ledger_events (
			user_id, category, event_type, amount, balance_before, balance_after,
			title, reference_id, metadata, created_at
		) VALUES (
			$1, 'coins', 'earn_daily_combo', $2, $3, $4,
			'Daily Secret Combo Bonus', 'daily_combo_' || $5::text,
			'{"source": "daily_combo"}'::jsonb, CURRENT_TIMESTAMP
		)
	`, userID, combo.RewardAmount, beforeCoins, afterCoins, combo.ID)

	_, _ = tx.Exec(ctx, `
		INSERT INTO user_credit_batches (user_id, amount, remaining_amount, source, earned_at, expires_at, is_expired)
		VALUES ($1, $2, $2, 'daily_combo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '15 days', FALSE)
	`, userID, float64(combo.RewardAmount))

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("transaction commit failed: %w", err)
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	return nil
}
