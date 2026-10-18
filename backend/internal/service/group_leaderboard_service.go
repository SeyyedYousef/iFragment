package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/intelcredit"
)

type GroupLeaderboardService struct {
	repo               *repository.GroupLeaderboardRepo
	intelCreditService *intelcredit.IntelCreditService
	cache              *repository.Cache
	tgClient           *telegram.BotAPIClient
	memMu              sync.Mutex
	boostMultipliers   map[int64]int
}

func NewGroupLeaderboardService(
	repo *repository.GroupLeaderboardRepo,
	intelCreditService *intelcredit.IntelCreditService,
	cache *repository.Cache,
) *GroupLeaderboardService {
	return &GroupLeaderboardService{
		repo:               repo,
		intelCreditService: intelCreditService,
		cache:              cache,
		boostMultipliers:   make(map[int64]int),
	}
}

func (s *GroupLeaderboardService) SetTelegramClient(client *telegram.BotAPIClient) {
	s.tgClient = client
}

// InvalidateLeaderboardCache purges cached leaderboard standings so next read is fresh
func (s *GroupLeaderboardService) InvalidateLeaderboardCache(ctx context.Context) {
	if s.cache != nil && s.cache.Client != nil && !s.cache.IsQuotaExceeded() {
		_ = s.cache.Client.Del(ctx,
			"leaderboard:group:messages:100",
			"leaderboard:group:boosts:100",
			"leaderboard:group:messages:50",
			"leaderboard:group:boosts:50",
		).Err()
	}
}

// ComputeBoostMultiplier calculates the active credit multiplier for a @FragmentInvestors booster
func ComputeBoostMultiplier(boostCount int) int {
	switch {
	case boostCount >= 4:
		return 3 // 3x Whale Booster Perk
	case boostCount >= 2:
		return 2 // 2x Twin Booster Perk
	default:
		return 1
	}
}

// GetUserBoostMultiplier returns the user's active boost multiplier (1x, 2x, or 3x)
func (s *GroupLeaderboardService) GetUserBoostMultiplier(ctx context.Context, userID int64) int {
	if userID <= 0 {
		return 1
	}
	if s.cache != nil && s.cache.Client != nil && !s.cache.IsQuotaExceeded() {
		if val, err := s.cache.Client.Get(ctx, fmt.Sprintf("fi:boost_mult:%d", userID)).Int(); err == nil && val >= 1 {
			return val
		}
	}
	s.memMu.Lock()
	mult, ok := s.boostMultipliers[userID]
	s.memMu.Unlock()
	if ok && mult >= 1 {
		return mult
	}
	if s.repo != nil {
		if stats, err := s.repo.GetUserStats(ctx, "boosts", userID); err == nil && stats != nil {
			m := ComputeBoostMultiplier(stats.Score)
			s.setUserBoostMultiplier(ctx, userID, m)
			return m
		}
	}
	return 1
}

func (s *GroupLeaderboardService) setUserBoostMultiplier(ctx context.Context, userID int64, mult int) {
	if userID <= 0 {
		return
	}
	if mult <= 1 {
		s.memMu.Lock()
		delete(s.boostMultipliers, userID)
		s.memMu.Unlock()
		if s.cache != nil && s.cache.Client != nil && !s.cache.IsQuotaExceeded() {
			_ = s.cache.Client.Del(ctx, fmt.Sprintf("fi:boost_mult:%d", userID)).Err()
		}
		return
	}
	s.memMu.Lock()
	s.boostMultipliers[userID] = mult
	s.memMu.Unlock()
	if s.cache != nil && s.cache.Client != nil && !s.cache.IsQuotaExceeded() {
		_ = s.cache.Client.Set(ctx, fmt.Sprintf("fi:boost_mult:%d", userID), strconv.Itoa(mult), 48*time.Hour).Err()
	}
}

func (s *GroupLeaderboardService) GetLeaderboard(ctx context.Context, rankType string, limit int, currentUserID int64) (*repository.GroupLeaderboardResult, error) {
	if rankType != "boosts" {
		rankType = "messages"
	}
	if limit <= 0 || limit > 100 {
		limit = 100
	}

	cacheKey := fmt.Sprintf("leaderboard:group:%s:%d", rankType, limit)
	var baseRes *repository.GroupLeaderboardResult

	// 1. Try to read from DragonflyDB cache (<1ms response)
	if s.cache != nil && s.cache.Client != nil && !s.cache.IsQuotaExceeded() {
		if cachedJSON, err := s.cache.Client.Get(ctx, cacheKey).Result(); err == nil && cachedJSON != "" {
			var cached repository.GroupLeaderboardResult
			if err := json.Unmarshal([]byte(cachedJSON), &cached); err == nil {
				baseRes = &cached
			}
		}
	}

	// 2. Query Database if cache miss
	if baseRes == nil {
		var err error
		baseRes, err = s.repo.GetLeaderboard(ctx, rankType, limit, 0)
		if err != nil {
			return nil, err
		}

		// Store in DragonflyDB with 120s TTL
		if s.cache != nil && s.cache.Client != nil && !s.cache.IsQuotaExceeded() {
			if data, err := json.Marshal(baseRes); err == nil {
				_ = s.cache.Client.Set(ctx, cacheKey, string(data), 120*time.Second).Err()
			}
		}
	}

	// 3. Prepare result copy for caller
	result := &repository.GroupLeaderboardResult{
		Type:     baseRes.Type,
		Top3:     baseRes.Top3,
		Featured: baseRes.Featured,
		Items:    baseRes.Items,
		MyStats: repository.UserLeaderboardStats{
			UserID:  currentUserID,
			RankStr: "100k+",
		},
	}

	// 4. Attach personal user rank and credits if authenticated
	if currentUserID > 0 {
		userStats, err := s.repo.GetUserStats(ctx, rankType, currentUserID)
		if err == nil && userStats != nil {
			result.MyStats = *userStats
		}

		if s.intelCreditService != nil {
			bal, err := s.intelCreditService.GetBalance(ctx, currentUserID)
			if err == nil && bal != nil {
				result.MyStats.Credits = bal.Balance
			}
		}

		if rankType == "boosts" && s.tgClient != nil {
			go func(uid int64) {
				bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				_, _ = s.SyncUserBoosts(bgCtx, s.tgClient, "@FragmentInvestors", uid, "", "", "")
			}(currentUserID)
		}
	}

	return result, nil
}

// ComputeMessageRewardCredits calculates the unconditional credit reward for a message in @FragmentInvestors.
// Because @FragmentInvestors operates with Telegram Paid Messages (users spend Telegram Stars per message),
// EVERY user message has intrinsic monetary value and is rewarded 100% without any anti-spam, length,
// duplicate, cooldown, or daily-cap filtering.
func (s *GroupLeaderboardService) ComputeMessageRewardCredits(ctx context.Context, userID int64, paidStarCount int) int {
	if userID <= 0 {
		return 0
	}
	mult := s.GetUserBoostMultiplier(ctx, userID)
	if mult < 1 {
		mult = 1
	}
	baseCredits := 1
	if paidStarCount > 1 {
		baseCredits = paidStarCount
	}
	return baseCredits * mult
}

// RecordGroupMessage records EVERY message sent in @FragmentInvestors and atomically grants Intel Credits.
// Zero messages are filtered out because @FragmentInvestors uses Telegram Paid Messages (Stars per message),
// meaning every single message sent by a member carries real Star value.
func (s *GroupLeaderboardService) RecordGroupMessage(ctx context.Context, userID int64, username, firstName, photoURL, languageCode string, messageID int, rawText ...string) error {
	return s.RecordGroupMessageWithStars(ctx, userID, username, firstName, photoURL, languageCode, messageID, 0, rawText...)
}

// RecordGroupMessageWithStars records a message in @FragmentInvestors and grants Intel Credits scaled by
// paidStarCount (when > 1) and the user's active group boost multiplier (1x, 2x, or 3x), with zero filtering.
func (s *GroupLeaderboardService) RecordGroupMessageWithStars(ctx context.Context, userID int64, username, firstName, photoURL, languageCode string, messageID int, paidStarCount int, rawText ...string) error {
	if userID <= 0 {
		return nil
	}

	if s.repo != nil {
		if err := s.repo.RecordGroupMessage(ctx, userID, username, firstName, photoURL, languageCode, messageID); err != nil {
			slog.Error("failed to record group message in leaderboard repo", "user_id", userID, "error", err)
		}
	}

	// Invalidate leaderboard cache so next request is immediately updated
	s.InvalidateLeaderboardCache(ctx)

	// Unconditionally grant Intel Credits for every message (no length filter, no duplicate drop, no cooldown, no daily cap)
	if s.intelCreditService != nil && messageID > 0 {
		rewardCredits := s.ComputeMessageRewardCredits(ctx, userID, paidStarCount)
		if rewardCredits <= 0 {
			rewardCredits = 1
		}
		refID := strconv.Itoa(messageID)
		_, err := s.intelCreditService.GrantCredits(ctx, userID, "reward", rewardCredits, "group_message", refID, nil)
		if err == nil {
			go s.sendCreditEarnedNotification(userID, "group_message", rewardCredits)
		} else {
			slog.Debug("group message credit grant result", "user_id", userID, "message_id", messageID, "error", err)
		}
	}

	return nil
}

// UpdateUserBoostCount updates the user's active boost count and adjusts their active boost multiplier perk
func (s *GroupLeaderboardService) UpdateUserBoostCount(ctx context.Context, userID int64, username, firstName, photoURL string, boostCount int) error {
	if s.repo == nil {
		return nil
	}
	if boostCount < 0 {
		boostCount = 0
	}
	err := s.repo.UpdateUserBoostCount(ctx, userID, username, firstName, photoURL, boostCount)
	if err == nil {
		s.InvalidateLeaderboardCache(ctx)
		// Grant or revoke boost multiplier perks immediately based on updated boost count
		s.setUserBoostMultiplier(ctx, userID, ComputeBoostMultiplier(boostCount))
	}
	return err
}

// HandleRealtimeChatBoost processes a live chat_boost event for @FragmentInvestors,
// activates the user's boost multiplier, and immediately grants daily bonus credits if eligible.
func (s *GroupLeaderboardService) HandleRealtimeChatBoost(ctx context.Context, tgClient *telegram.BotAPIClient, chatID interface{}, userID int64, username, firstName string) {
	if userID <= 0 {
		return
	}
	boosts := 1
	if tgClient != nil && chatID != nil {
		if synced, err := s.SyncUserBoosts(ctx, tgClient, chatID, userID, username, firstName, ""); err == nil && synced > 0 {
			boosts = synced
		} else {
			_ = s.UpdateUserBoostCount(ctx, userID, username, firstName, "", 1)
		}
	} else {
		_ = s.UpdateUserBoostCount(ctx, userID, username, firstName, "", 1)
	}

	// Immediately process daily boost reward if user has >= 2 boosts (or grant instant 1-credit welcome boost bonus)
	if s.intelCreditService != nil {
		today := time.Now().UTC().Format("2006-01-02")
		rewardCredits := boosts / 2
		if rewardCredits < 1 {
			rewardCredits = 1
		}
		ref := fmt.Sprintf("boost:%d:%s", userID, today)
		if _, err := s.intelCreditService.GrantCredits(ctx, userID, "reward", rewardCredits, "daily_boost_reward", ref, nil); err == nil {
			go s.sendCreditEarnedNotification(userID, "daily_boost_reward", rewardCredits)
		}
	}
}

// HandleRealtimeRemovedChatBoost processes a live removed_chat_boost event for @FragmentInvestors,
// re-syncing active boosts and revoking perks if boosts were removed or expired.
func (s *GroupLeaderboardService) HandleRealtimeRemovedChatBoost(ctx context.Context, tgClient *telegram.BotAPIClient, chatID interface{}, userID int64, username, firstName string) {
	if userID <= 0 {
		return
	}
	if tgClient != nil && chatID != nil {
		if synced, err := s.SyncUserBoosts(ctx, tgClient, chatID, userID, username, firstName, ""); err == nil {
			s.setUserBoostMultiplier(ctx, userID, ComputeBoostMultiplier(synced))
			return
		}
	}
	_ = s.UpdateUserBoostCount(ctx, userID, username, firstName, "", 0)
	s.setUserBoostMultiplier(ctx, userID, 1)
}

// SyncUserBoosts fetches live boosts from Telegram Bot API and updates local record
func (s *GroupLeaderboardService) SyncUserBoosts(ctx context.Context, tgClient *telegram.BotAPIClient, chatID interface{}, userID int64, username, firstName, photoURL string) (int, error) {
	if tgClient == nil || chatID == nil || userID <= 0 {
		return 0, fmt.Errorf("invalid arguments for boost sync")
	}

	boosts, err := tgClient.GetUserChatBoosts(ctx, chatID, userID)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch user chat boosts: %w", err)
	}

	if photoURL == "" {
		if photoPath, pErr := tgClient.GetUserProfilePhotoURL(ctx, userID); pErr == nil && photoPath != "" {
			if strings.HasPrefix(photoPath, "http://") || strings.HasPrefix(photoPath, "https://") {
				photoURL = photoPath
			}
		}
	}

	if err := s.UpdateUserBoostCount(ctx, userID, username, firstName, photoURL, boosts); err != nil {
		return boosts, err
	}

	return boosts, nil
}

// SyncUserBoostsThrottled checks user's active boosts if not checked recently (e.g. in last 30 minutes)
func (s *GroupLeaderboardService) SyncUserBoostsThrottled(ctx context.Context, tgClient *telegram.BotAPIClient, chatID interface{}, userID int64, username, firstName, photoURL string) {
	if s.cache != nil && s.cache.Client != nil && !s.cache.IsQuotaExceeded() {
		throttleKey := fmt.Sprintf("boost_check_throttle:%d", userID)
		if exists, _ := s.cache.Client.Exists(ctx, throttleKey).Result(); exists > 0 {
			return
		}
		_ = s.cache.Client.Set(ctx, throttleKey, "1", 30*time.Minute).Err()
	}
	_, _ = s.SyncUserBoosts(ctx, tgClient, chatID, userID, username, firstName, photoURL)
}

// RunHourlyBoostSyncAndRewards synchronizes boost counts and grants 1 credit per 2 boosts every 24h
func (s *GroupLeaderboardService) RunHourlyBoostSyncAndRewards(ctx context.Context, tgClient *telegram.BotAPIClient, chatID interface{}) error {
	if s.repo == nil {
		return nil
	}

	// 1. Sync boosts for group administrators and known users from Telegram if client available
	if tgClient != nil && chatID != nil {
		if admins, err := tgClient.GetChatAdministrators(ctx, chatID); err == nil {
			for _, adm := range admins {
				if adm.User.ID > 0 {
					boosts, bErr := tgClient.GetUserChatBoosts(ctx, chatID, adm.User.ID)
					if bErr == nil {
						photoURL := ""
						if photoPath, pErr := tgClient.GetUserProfilePhotoURL(ctx, adm.User.ID); pErr == nil && photoPath != "" {
							if strings.HasPrefix(photoPath, "http://") || strings.HasPrefix(photoPath, "https://") {
								photoURL = photoPath
							}
						}
						_ = s.UpdateUserBoostCount(ctx, adm.User.ID, adm.User.Username, adm.User.FirstName, photoURL, boosts)
					}
					time.Sleep(50 * time.Millisecond)
				}
			}
		}

		targets, err := s.repo.GetUsersForBoostCheck(ctx, 100)
		if err == nil {
			for _, target := range targets {
				boosts, err := tgClient.GetUserChatBoosts(ctx, chatID, target.UserID)
				if err == nil {
					photoURL := ""
					if photoPath, pErr := tgClient.GetUserProfilePhotoURL(ctx, target.UserID); pErr == nil && photoPath != "" {
						if strings.HasPrefix(photoPath, "http://") || strings.HasPrefix(photoPath, "https://") {
							photoURL = photoPath
						}
					}
					_ = s.UpdateUserBoostCount(ctx, target.UserID, target.Username, target.FirstName, photoURL, boosts)
				}
				time.Sleep(50 * time.Millisecond) // rate limiting protection
			}
		}
	}

	// 2. Process daily boost rewards: 1 credit per 2 boosts if not rewarded in last 24h
	today := time.Now().UTC().Format("2006-01-02")
	rewarded, err := s.repo.ProcessDailyBoostRewards(ctx, func(grantCtx context.Context, uid int64, credits int) error {
		if s.intelCreditService == nil || credits <= 0 {
			return nil
		}
		ref := fmt.Sprintf("boost:%d:%s", uid, today)
		_, grantErr := s.intelCreditService.GrantCredits(grantCtx, uid, "reward", credits, "daily_boost_reward", ref, nil)
		if grantErr == nil {
			go s.sendCreditEarnedNotification(uid, "daily_boost_reward", credits)
		}
		return grantErr
	})

	if err != nil {
		slog.Error("failed processing daily boost rewards", "error", err)
		return err
	}

	if rewarded > 0 {
		slog.Info("processed daily boost rewards successfully", "rewarded_users", rewarded)
	}

	return nil
}

// sendCreditEarnedNotification dispatches a multilingual Telegram DM to the user in their preferred language (en, fa, ru, zh)
func (s *GroupLeaderboardService) sendCreditEarnedNotification(userID int64, rewardType string, rewardAmount int) {
	if userID <= 0 || rewardAmount <= 0 {
		return
	}

	bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	lang := "en"
	if s.repo != nil {
		rawLang := s.repo.GetUserLanguage(bgCtx, userID)
		lang = i18n.DetectLanguage(rawLang)
	}

	currentBalance := rewardAmount
	if s.intelCreditService != nil {
		if bal, bErr := s.intelCreditService.GetBalance(bgCtx, userID); bErr == nil && bal != nil {
			currentBalance = bal.Balance
		}
	}

	textKey := "reward_notification.group_message_text"
	if rewardType == "daily_boost_reward" {
		textKey = "reward_notification.group_boost_text"
	}

	text := i18n.T(lang, textKey, map[string]interface{}{
		"group":   "FragmentInvestors",
		"reward":  rewardAmount,
		"credits": currentBalance,
	})

	btnText := i18n.T(lang, "reward_notification.btn_open_app")
	miniAppURL := os.Getenv("MINI_APP_URL")
	if miniAppURL == "" {
		miniAppURL = "https://t.me/iFragmentBot/app"
	}

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{
					"text": btnText,
					"url":  miniAppURL,
				},
			},
		},
	}

	client := s.tgClient
	if client == nil {
		botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
		if botToken == "" {
			botToken = os.Getenv("BOT_TOKEN")
		}
		if botToken != "" {
			client = telegram.NewBotAPIClient(botToken)
		}
	}

	if client != nil {
		if _, err := client.SendMessageWithMarkup(bgCtx, userID, text, markup, nil); err != nil {
			slog.Debug("Failed to deliver credit reward DM to user", "user_id", userID, "reward_type", rewardType, "error", err)
		} else {
			slog.Info("Successfully delivered credit reward DM to user", "user_id", userID, "reward_type", rewardType, "lang", lang)
		}
	}
}
