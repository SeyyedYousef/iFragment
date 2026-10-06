package service

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/intelcredit"
)

type GroupLeaderboardService struct {
	repo               *repository.GroupLeaderboardRepo
	intelCreditService *intelcredit.IntelCreditService
	cache              *repository.Cache
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

func (s *GroupLeaderboardService) GetLeaderboard(ctx context.Context, rankType string, limit int, currentUserID int64) (*repository.GroupLeaderboardResult, error) {
	if rankType != "boosts" {
		rankType = "messages"
	}

	res, err := s.repo.GetLeaderboard(ctx, rankType, limit, currentUserID)
	if err != nil {
		return nil, err
	}

	// Attach user's real Intel Credit balance
	if currentUserID > 0 && s.intelCreditService != nil {
		bal, err := s.intelCreditService.GetBalance(ctx, currentUserID)
		if err == nil && bal != nil {
			res.MyStats.Credits = bal.Balance
		}
	}

	return res, nil
}

// RecordGroupMessage records a message sent in @FragmentInvestors and atomically grants 1 Intel Credit
func (s *GroupLeaderboardService) RecordGroupMessage(ctx context.Context, userID int64, username, firstName, photoURL string, messageID int) error {
	if s.repo == nil {
		return nil
	}

	if err := s.repo.RecordGroupMessage(ctx, userID, username, firstName, photoURL); err != nil {
		slog.Error("failed to record group message in leaderboard repo", "user_id", userID, "error", err)
	}

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
	return s.repo.UpdateUserBoostCount(ctx, userID, username, firstName, photoURL, boostCount)
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

	if err := s.UpdateUserBoostCount(ctx, userID, username, firstName, photoURL, boosts); err != nil {
		return boosts, err
	}

	return boosts, nil
}

// RunHourlyBoostSyncAndRewards synchronizes boost counts and grants 1 credit per 2 boosts every 24h
func (s *GroupLeaderboardService) RunHourlyBoostSyncAndRewards(ctx context.Context, tgClient *telegram.BotAPIClient, chatID interface{}) error {
	if s.repo == nil {
		return nil
	}

	// 1. Sync boosts for a batch of known users from Telegram if client available
	if tgClient != nil && chatID != nil {
		targets, err := s.repo.GetUsersForBoostCheck(ctx, 100)
		if err == nil {
			for _, target := range targets {
				boosts, err := tgClient.GetUserChatBoosts(ctx, chatID, target.UserID)
				if err == nil {
					_ = s.repo.UpdateUserBoostCount(ctx, target.UserID, target.Username, target.FirstName, "", boosts)
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
