package botmgmt

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
)

type JoinAttemptRecord struct {
	Count     int
	FirstSeen time.Time
	LastSeen  time.Time
}

type PremiumGroupService struct {
	botRepo       *repository.BotRepo
	analyticsRepo *repository.AnalyticsRepo
	joinAttempts  sync.Map // map[string]*JoinAttemptRecord (key: "chatID:userID")
}

func NewPremiumGroupService(botRepo *repository.BotRepo, analyticsRepo *repository.AnalyticsRepo) *PremiumGroupService {
	return &PremiumGroupService{
		botRepo:       botRepo,
		analyticsRepo: analyticsRepo,
	}
}

// IsFragmentInvestorsGroup checks if a given chat title or username corresponds to @FragmentInvestors.
func IsFragmentInvestorsGroup(chatTitle, chatUsername string) bool {
	cleanUsername := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(chatUsername), "@"))
	if cleanUsername == "fragmentinvestors" {
		return true
	}
	cleanTitle := strings.ToLower(strings.TrimSpace(chatTitle))
	cleanTitleNoAt := strings.ReplaceAll(strings.TrimPrefix(cleanTitle, "@"), " ", "")
	return cleanTitleNoAt == "fragmentinvestors" || strings.Contains(cleanTitleNoAt, "fragmentinvestors")
}

// UserCompact is a minimal representation of a Telegram User for premium verification.
type UserCompact struct {
	ID        int64
	IsBot     bool
	FirstName string
	Username  string
	IsPremium bool
}

// ProcessMemberJoinRealtime handles real-time join or activity for @FragmentInvestors.
// If user is non-premium:
// - Kicks user immediately.
// - If user joined > 3 times in 10 minutes, applies a 15-minute temporary ban (until_date = now + 15m).
// - Otherwise, immediately unbans user (so they can still view public group).
func (s *PremiumGroupService) ProcessMemberJoinRealtime(ctx context.Context, tgClient *telegram.BotAPIClient, chatID int64, user UserCompact) error {
	// Bots and Telegram Premium users are allowed
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
			epMsgID = epMsg.EphemeralMessageID.String()
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

	// 2. Pause 2 seconds so the user can read the warning
	time.Sleep(2 * time.Second)

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

// StartDailyAuditWorker starts background daily worker running at 00:00 GMT (04:30 AFN).
func (s *PremiumGroupService) StartDailyAuditWorker(ctx context.Context) {
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
				s.RunDailyAudit(ctx)
			}
		}
	}()
}

// RunDailyAudit executes a full member audit for @FragmentInvestors at 00:00 GMT.
func (s *PremiumGroupService) RunDailyAudit(ctx context.Context) {
	slog.Info("Starting 24h daily audit for @FragmentInvestors premium membership...")

	if s.botRepo == nil {
		return
	}

	groups, err := s.botRepo.GetAllActiveGroups(ctx)
	if err != nil {
		slog.Error("Failed to fetch active groups for daily premium audit", "error", err)
		return
	}

	for _, g := range groups {
		if !IsFragmentInvestorsGroup(g.ChatTitle, "") {
			continue
		}

		bot, err := s.botRepo.GetBotByID(ctx, g.BotID)
		if err != nil {
			continue
		}

		token, err := DecryptToken(bot.BotTokenEncrypted)
		if err != nil {
			continue
		}

		tg := telegram.NewBotAPIClient(token)

		var memberIDs []int64
		if s.analyticsRepo != nil {
			memberIDs, _ = s.analyticsRepo.GetGroupMemberIDs(ctx, g.ID)
		}

		if len(memberIDs) == 0 {
			slog.Info("No tracked members found for daily audit in group", "group_id", g.ID)
			continue
		}

		removedCount := 0
		for _, memberID := range memberIDs {
			select {
			case <-ctx.Done():
				return
			default:
			}

			cm, err := tg.GetChatMemberFull(ctx, g.ChatID, memberID)
			if err != nil || cm == nil {
				continue
			}

			if cm.Status == "left" || cm.Status == "kicked" || cm.Status == "creator" || cm.Status == "administrator" {
				continue
			}

			if !cm.User.IsBot && !cm.User.IsPremium {
				userObj := UserCompact{
					ID:        cm.User.ID,
					IsBot:     cm.User.IsBot,
					FirstName: cm.User.FirstName,
					Username:  cm.User.Username,
					IsPremium: cm.User.IsPremium,
				}
				if err := s.ProcessMemberJoinRealtime(ctx, tg, g.ChatID, userObj); err == nil {
					removedCount++
				}
			}

			time.Sleep(200 * time.Millisecond)
		}

		slog.Info("Completed 24h daily premium audit for @FragmentInvestors", "chat_id", g.ChatID, "removed_count", removedCount)
	}
}
