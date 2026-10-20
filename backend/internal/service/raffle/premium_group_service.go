package raffle

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"ifragment-backend/internal/client/telegram"
)

// UserCompact is a minimal representation of a Telegram User.
type UserCompact struct {
	ID        int64
	Username  string
	FirstName string
	IsPremium bool
	IsBot     bool
}

// IsFragmentInvestorsGroup checks if a given chat title or username corresponds to @FragmentInvestors.
func IsFragmentInvestorsGroup(chatTitle, chatUsername string) bool {
	u := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(chatUsername)), "@")
	if u == "fragmentinvestors" || u == "fragment_investors" {
		return true
	}
	t := strings.ToLower(chatTitle)
	return strings.Contains(t, "fragmentinvestors") || strings.Contains(t, "fragment investors")
}

// JoinAttemptRecord tracks join attempts for anti-spam rate limiting.
type JoinAttemptRecord struct {
	Count     int
	FirstSeen time.Time
	LastSeen  time.Time
}

// PremiumGroupService enforces Telegram Premium access for @FragmentInvestors.
type PremiumGroupService struct {
	joinAttempts sync.Map // map[string]*JoinAttemptRecord (key: "chatID:userID")
}

// NewPremiumGroupService creates a new instance of PremiumGroupService.
func NewPremiumGroupService() *PremiumGroupService {
	return &PremiumGroupService{}
}

// ProcessMemberJoinRealtime handles real-time join or message activity for @FragmentInvestors.
// Telegram Premium requirement has been removed: all users are allowed to join and chat.
func (s *PremiumGroupService) ProcessMemberJoinRealtime(ctx context.Context, tgClient *telegram.BotAPIClient, chatID int64, user UserCompact) error {
	// All users (Premium and non-Premium) are allowed
	return nil
}

// HandleChatJoinRequest processes a join request for @FragmentInvestors.
// Approves join requests for all users without requiring Telegram Premium.
func (s *PremiumGroupService) HandleChatJoinRequest(ctx context.Context, tgClient *telegram.BotAPIClient, chatID int64, chatTitle string, from UserCompact, userChatID int64, userLang string) error {
	if tgClient == nil {
		return fmt.Errorf("tgClient is nil")
	}

	slog.Info("Approving user join request for @FragmentInvestors", "chat_id", chatID, "user_id", from.ID)
	return tgClient.ApproveChatJoinRequest(ctx, chatID, from.ID)
}

// RunDailyAudit is disabled because all Telegram users are permitted in @FragmentInvestors.
func (s *PremiumGroupService) RunDailyAudit(ctx context.Context, tgClient *telegram.BotAPIClient) {
	slog.Info("Daily premium audit is disabled - all users are allowed in @FragmentInvestors")
}

// StartDailyAuditWorker is disabled because all Telegram users are permitted in @FragmentInvestors.
func (s *PremiumGroupService) StartDailyAuditWorker(ctx context.Context, getTgClient func() *telegram.BotAPIClient) {
	slog.Info("Daily premium audit worker disabled - all users are allowed in @FragmentInvestors")
}

