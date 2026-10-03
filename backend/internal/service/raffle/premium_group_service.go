package raffle

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
)

// JoinAttemptRecord tracks join attempts for anti-spam rate limiting.
type JoinAttemptRecord struct {
	Count     int
	FirstSeen time.Time
	LastSeen  time.Time
}

// PremiumGroupService enforces Telegram Premium access for @FragmentInvestors.
type PremiumGroupService struct {
	raffleRepo   *repository.RaffleRepo
	joinAttempts sync.Map // map[string]*JoinAttemptRecord (key: "chatID:userID")
}

// NewPremiumGroupService creates a new instance of PremiumGroupService.
func NewPremiumGroupService(raffleRepo *repository.RaffleRepo) *PremiumGroupService {
	return &PremiumGroupService{
		raffleRepo: raffleRepo,
	}
}

// ProcessMemberJoinRealtime handles real-time join or non-premium message activity for @FragmentInvestors.
// If the user does not have Telegram Premium:
// 1. Sends an ephemeral warning message visible only to that user.
// 2. Waits 6 seconds so the user can read the warning.
// 3. If the user joined > 3 times in 10 minutes, applies a 15-minute temporary ban.
// 4. Otherwise, kicks the user immediately (ban with until_date=0) and unbans immediately so they can view but not stay/chat.
// 5. Cleans up the ephemeral warning message.
func (s *PremiumGroupService) ProcessMemberJoinRealtime(ctx context.Context, tgClient *telegram.BotAPIClient, chatID int64, user UserCompact) error {
	// Bots and Telegram Premium users are fully allowed
	if user.IsBot || user.IsPremium {
		return nil
	}

	key := fmt.Sprintf("%d:%d", chatID, user.ID)
	now := time.Now()

	var count int
	val, loaded := s.joinAttempts.Load(key)
	if loaded {
		rec := val.(*JoinAttemptRecord)
		if now.Sub(rec.FirstSeen) > 10*time.Minute {
			rec.Count = 1
			rec.FirstSeen = now
			rec.LastSeen = now
		} else {
			rec.Count++
			rec.LastSeen = now
		}
		count = rec.Count
	} else {
		count = 1
		s.joinAttempts.Store(key, &JoinAttemptRecord{
			Count:     1,
			FirstSeen: now,
			LastSeen:  now,
		})
	}

	// 1. Send targeted ephemeral warning message visible ONLY to that user
	warningText := "⚠️ <b>Access Restricted</b>\n\nThis group is strictly reserved for <b>Telegram Premium</b> subscribers. Please activate Telegram Premium to join!"
	var epMsgID string

	if tgClient != nil {
		epMsg, err := tgClient.SendEphemeralMessage(ctx, chatID, user.ID, warningText, nil)
		if err == nil && epMsg != nil {
			epMsgID = string(epMsg.EphemeralMessageID)
		} else {
			// Fallback: send standard message and auto-delete after reading
			msgRes, msgErr := tgClient.SendMessageWithResult(ctx, chatID, warningText, nil, nil)
			if msgErr == nil && msgRes != nil {
				defer func(mID int) {
					bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					_ = tgClient.DeleteMessage(bgCtx, chatID, mID)
				}(msgRes.MessageID)
			}
		}
	}

	// 2. Pause 6 seconds so any user can read the warning comfortably
	time.Sleep(6 * time.Second)

	// 3. Repeat joiner (> 3 attempts in 10 minutes) -> 15-minute temp ban
	if count > 3 {
		untilDate := now.Add(15 * time.Minute).Unix()
		slog.Warn("Anti-spam triggered for repeat non-premium joiner to @FragmentInvestors. Applying 15-min temp ban.", "chat_id", chatID, "user_id", user.ID, "join_count", count)

		if tgClient != nil {
			if err := tgClient.BanChatMember(ctx, chatID, user.ID, untilDate, false); err != nil {
				slog.Error("Failed to temp-ban non-premium user", "chat_id", chatID, "user_id", user.ID, "error", err)
			}

			if epMsgID != "" {
				_ = tgClient.DeleteEphemeralMessage(ctx, chatID, epMsgID, user.ID)
			}

			go func(cID, uID int64) {
				time.Sleep(15 * time.Minute)
				bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				_ = tgClient.UnbanChatMember(bgCtx, cID, uID, true)
				slog.Info("Unbanned user after 15-min temp ban expired", "chat_id", cID, "user_id", uID)
			}(chatID, user.ID)
		}

		return nil
	}

	// Standard join: Kick immediately + Unban immediately
	slog.Info("Kicking non-premium user from @FragmentInvestors (will unban immediately)", "chat_id", chatID, "user_id", user.ID)
	if tgClient != nil {
		if err := tgClient.BanChatMember(ctx, chatID, user.ID, 0, false); err != nil {
			slog.Error("Failed to kick non-premium user", "chat_id", chatID, "user_id", user.ID, "error", err)
			return err
		}

		if err := tgClient.UnbanChatMember(ctx, chatID, user.ID, true); err != nil {
			slog.Warn("Failed to unban user after kick", "chat_id", chatID, "user_id", user.ID, "error", err)
		}

		if epMsgID != "" {
			_ = tgClient.DeleteEphemeralMessage(ctx, chatID, epMsgID, user.ID)
		}
	}

	return nil
}

// HandleChatJoinRequest processes a join request for @FragmentInvestors.
func (s *PremiumGroupService) HandleChatJoinRequest(ctx context.Context, tgClient *telegram.BotAPIClient, chatID int64, chatTitle string, from UserCompact, userChatID int64, userLang string) error {
	if tgClient == nil {
		return fmt.Errorf("tgClient is nil")
	}

	if from.IsBot || from.IsPremium {
		slog.Info("Approving Telegram Premium user join request for @FragmentInvestors", "chat_id", chatID, "user_id", from.ID)
		return tgClient.ApproveChatJoinRequest(ctx, chatID, from.ID)
	}

	slog.Info("Declining non-premium user join request for @FragmentInvestors", "chat_id", chatID, "user_id", from.ID)
	if err := tgClient.DeclineChatJoinRequest(ctx, chatID, from.ID); err != nil {
		slog.Warn("Failed to decline chat join request", "chat_id", chatID, "user_id", from.ID, "error", err)
	}

	targetChatID := userChatID
	if targetChatID == 0 {
		targetChatID = from.ID
	}

	var rejectMsg string
	if userLang == "fa" {
		rejectMsg = fmt.Sprintf("⚠️ درخواست عضویت شما در گروه <b>%s</b> به دلیل نداشتن اکانت <b>Telegram Premium</b> پذیرفته نشد.\n\nاین گروه منحصراً ویژه دارندگان اشتراک پرمیوم تلگرام است.", chatTitle)
	} else {
		rejectMsg = fmt.Sprintf("⚠️ Your request to join <b>%s</b> was declined because your account does not have <b>Telegram Premium</b>.\n\nThis group is strictly reserved for Telegram Premium subscribers.", chatTitle)
	}

	_ = tgClient.SendMessage(ctx, targetChatID, rejectMsg, nil, nil)
	return nil
}

// RunDailyAudit performs an audit of active members to check if their Telegram Premium status expired.
func (s *PremiumGroupService) RunDailyAudit(ctx context.Context, tgClient *telegram.BotAPIClient) {
	slog.Info("Starting daily 24h audit for @FragmentInvestors premium membership...")
	if tgClient == nil || s.raffleRepo == nil {
		return
	}

	userIDs, chatID, err := s.raffleRepo.GetActiveParticipantUserIDs(ctx, 30)
	if err != nil || len(userIDs) == 0 || chatID == 0 {
		slog.Info("No active members found for daily premium audit", "user_count", len(userIDs), "chat_id", chatID)
		return
	}

	removedCount := 0
	for _, uid := range userIDs {
		select {
		case <-ctx.Done():
			return
		default:
		}

		cm, err := tgClient.GetChatMemberFull(ctx, chatID, uid)
		if err != nil || cm == nil {
			continue
		}

		if cm.Status == "left" || cm.Status == "kicked" || cm.Status == "creator" || cm.Status == "administrator" {
			continue
		}

		if !cm.User.IsBot && !cm.User.IsPremium {
			userComp := UserCompact{
				ID:        cm.User.ID,
				Username:  cm.User.Username,
				FirstName: cm.User.FirstName,
				IsPremium: cm.User.IsPremium,
				IsBot:     cm.User.IsBot,
			}
			if err := s.ProcessMemberJoinRealtime(ctx, tgClient, chatID, userComp); err == nil {
				removedCount++
			}
		}

		time.Sleep(300 * time.Millisecond) // gentle rate limit
	}

	slog.Info("Completed daily premium audit for @FragmentInvestors", "chat_id", chatID, "checked", len(userIDs), "removed", removedCount)
}

// StartDailyAuditWorker runs a background ticker executing at 00:00 UTC daily.
func (s *PremiumGroupService) StartDailyAuditWorker(ctx context.Context, getTgClient func() *telegram.BotAPIClient) {
	go func() {
		for {
			now := time.Now().UTC()
			nextRun := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
			if !now.Before(nextRun) {
				nextRun = nextRun.Add(24 * time.Hour)
			}

			waitDuration := nextRun.Sub(now)
			slog.Info("Scheduled daily @FragmentInvestors premium audit worker", "next_run_utc", nextRun, "wait_duration", waitDuration)

			select {
			case <-ctx.Done():
				slog.Info("Daily Premium Audit Worker stopped")
				return
			case <-time.After(waitDuration):
				if getTgClient != nil {
					client := getTgClient()
					if client != nil {
						s.RunDailyAudit(ctx, client)
					}
				}
			}
		}
	}()
}
