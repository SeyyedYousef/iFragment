package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/intelcredit"
)

type GroupLeaderboardService struct {
	repo               *repository.GroupLeaderboardRepo
	intelCreditService *intelcredit.IntelCreditService
	cache              *repository.Cache
	tgClient           *telegram.BotAPIClient
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

// RecordGroupMessage records a message sent in @FragmentInvestors and atomically grants 1 Intel Credit
func (s *GroupLeaderboardService) RecordGroupMessage(ctx context.Context, userID int64, username, firstName, photoURL string, messageID int) error {
	if s.repo == nil {
		return nil
	}

	if err := s.repo.RecordGroupMessage(ctx, userID, username, firstName, photoURL, messageID); err != nil {
		slog.Error("failed to record group message in leaderboard repo", "user_id", userID, "error", err)
	}

	// Invalidate leaderboard cache so next request is immediately updated
	s.InvalidateLeaderboardCache(ctx)

	// Atomically grant 1 Intel Credit (1 message = 1 credit)
	if s.intelCreditService != nil && messageID > 0 {
		refID := strconv.Itoa(messageID)
		_, err := s.intelCreditService.GrantCredits(ctx, userID, "reward", 1, "group_message", refID, nil)
		if err != nil {
			// Idempotency constraint or transient error
			slog.Debug("group message credit grant result", "user_id", userID, "message_id", messageID, "error", err)
		}
	}

	return nil
}

// UpdateUserBoostCount updates the user's active boost count
func (s *GroupLeaderboardService) UpdateUserBoostCount(ctx context.Context, userID int64, username, firstName, photoURL string, boostCount int) error {
	if s.repo == nil {
		return nil
	}
	err := s.repo.UpdateUserBoostCount(ctx, userID, username, firstName, photoURL, boostCount)
	if err == nil {
		s.InvalidateLeaderboardCache(ctx)
	}
	return err
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
						_ = s.repo.UpdateUserBoostCount(ctx, adm.User.ID, adm.User.Username, adm.User.FirstName, photoURL, boosts)
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
					_ = s.repo.UpdateUserBoostCount(ctx, target.UserID, target.Username, target.FirstName, photoURL, boosts)
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
