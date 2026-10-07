package raffle

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
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

// RaffleService handles ticket registration, ephemeral feedback, and daily winner selection
// for the @FragmentInvestors paid-message group.
type RaffleService struct {
	raffleRepo       *repository.RaffleRepo
	cache            *repository.Cache
	lastEphemeralMsg sync.Map // key: chatID:userID -> string (ephemeral message ID)
}

// NewRaffleService creates a new RaffleService instance.
func NewRaffleService(raffleRepo *repository.RaffleRepo, cache *repository.Cache) *RaffleService {
	return &RaffleService{
		raffleRepo: raffleRepo,
		cache:      cache,
	}
}

// RecordMessageTicket is disabled because the daily raffle has been removed.
func (s *RaffleService) RecordMessageTicket(ctx context.Context, tgClient *telegram.BotAPIClient, chatID int64, user UserCompact, messageID int) error {
	return nil
}

// ExecuteDailyDraw is disabled because the daily raffle has been removed.
func (s *RaffleService) ExecuteDailyDraw(ctx context.Context, tgClient *telegram.BotAPIClient, date time.Time) error {
	slog.Info("Daily raffle draw is disabled - raffle has been removed")
	return nil
}

// notifyWinner sends a congratulatory direct message to the raffle winner strictly in English.
func (s *RaffleService) notifyWinner(ctx context.Context, client *telegram.BotAPIClient, winner repository.RaffleParticipant, drawDate time.Time, prizeUSD float64, prizeStars int, winChance float64, totalParticipants int) bool {
	if client == nil || winner.UserID == 0 {
		return false
	}

	displayName := winner.FirstName
	if displayName == "" {
		displayName = winner.Username
	}
	if displayName == "" {
		displayName = "Investor"
	}

	dateStr := drawDate.Format("2006-01-02")
	msg := fmt.Sprintf(
		"🎉 <b>Congratulations! You won the daily @FragmentInvestors Gift Raffle!</b> 🎁\n\n"+
			"📅 <b>Draw Date:</b> %s\n"+
			"💎 <b>Your Prize:</b> <b>$%.2f (~%d Stars)</b>\n"+
			"🎯 <b>Your Win Chance:</b> <b>%.1f%%</b> (among %d unique participants)\n\n"+
			"👤 <b>Winner:</b> %s\n\n"+
			"✨ The bot owner will deliver your prize directly to you shortly. Thank you for your active participation in the group!",
		dateStr, prizeUSD, prizeStars, winChance, totalParticipants, displayName,
	)

	bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err := client.SendMessage(bgCtx, winner.UserID, msg, nil, nil)
	if err != nil {
		slog.Warn("Failed to send congratulatory DM to raffle winner", "user_id", winner.UserID, "error", err)
		return false
	}

	slog.Info("Successfully sent congratulatory DM to raffle winner", "user_id", winner.UserID)
	return true
}

// notifyOwnerOnly sends the winner and prize dispatch status strictly to the bot owner(s).
func (s *RaffleService) notifyOwnerOnly(ctx context.Context, tgClient *telegram.BotAPIClient, draw *repository.DailyGiftDraw) bool {
	ownersStr := os.Getenv("OWNER_TELEGRAM_IDS")
	if ownersStr == "" {
		slog.Warn("Cannot notify owner: OWNER_TELEGRAM_IDS not configured")
		return false
	}

	client := tgClient
	if client == nil {
		botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
		if botToken == "" {
			botToken = os.Getenv("BOT_TOKEN")
		}
		if botToken != "" {
			client = telegram.NewBotAPIClient(botToken)
		}
	}

	if client == nil {
		slog.Warn("Cannot notify owner: Telegram client unavailable")
		return false
	}

	usernameDisplay := "ندارد"
	if draw.WinnerUsername != "" {
		usernameDisplay = "@" + draw.WinnerUsername
	}

	notificationMsg := fmt.Sprintf(
		"🎉 <b>برنده جدید قرعه‌کشی روزانه گروه @FragmentInvestors</b>\n\n"+
			"📅 <b>تاریخ:</b> %s\n"+
			"🔒 <b>وضعیت:</b> در دیتابیس قفل شد (منتظر ارسال دستی جایزه توسط شما)\n\n"+
			"👤 <b>مشخصات برنده:</b>\n"+
			"• نام: <b>%s</b>\n"+
			"• یوزرنیم: <b>%s</b>\n"+
			"• شناسه عددی: <code>%d</code>\n"+
			"• لینک کاربر: <a href=\"tg://user?id=%d\">مشاهده و ارسال جایزه به برنده</a>\n\n"+
			"📊 <b>آمار قرعه‌کشی روز:</b>\n"+
			"• کل پیام‌های ارسالی روز: <b>%d پیام ($%.0f)</b>\n"+
			"• تعداد شرکت‌کنندگان یونیک: <b>%d نفر</b> (هر کاربر ۱ شانس)\n"+
			"• درصد شانس برنده: <b>%.1f%%</b>\n\n"+
			"🎁 <b>ارزش جایزه قابل پرداخت:</b>\n"+
			"• مبلغ محاسبه‌شده: <b>$%.2f (~%d Stars)</b>\n\n"+
			"💡 <i>پیام تبریک در پیوی کاربر ارسال شد. لطفاً جایزه را به صورت مستقیم برای برنده ارسال فرمایید.</i>",
		draw.DrawDate.Format("2006-01-02"),
		draw.WinnerFirstName,
		usernameDisplay,
		draw.WinnerUserID,
		draw.WinnerUserID,
		draw.TotalMessages,
		float64(draw.TotalMessages),
		draw.TotalParticipants,
		(1.0/float64(draw.TotalParticipants))*100.0,
		draw.PrizeUSD,
		draw.PrizeStars,
	)

	success := false
	for _, idStr := range strings.Split(ownersStr, ",") {
		idStr = strings.TrimSpace(idStr)
		if idStr == "" {
			continue
		}
		ownerID, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			continue
		}

		bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		err = client.SendMessage(bgCtx, ownerID, notificationMsg, nil, nil)
		cancel()

		if err != nil {
			slog.Error("Failed to notify bot owner", "owner_id", ownerID, "error", err)
		} else {
			success = true
			slog.Info("Notified bot owner about daily raffle winner", "owner_id", ownerID)
		}
	}

	return success
}

// GetLatestDraw returns the most recent locked daily gift draw.
func (s *RaffleService) GetLatestDraw(ctx context.Context) (*repository.DailyGiftDraw, error) {
	if s.raffleRepo == nil {
		return nil, nil
	}
	return s.raffleRepo.GetLatestDailyDraw(ctx)
}

// GetUserWins returns all daily raffle wins for a specific user.
func (s *RaffleService) GetUserWins(ctx context.Context, userID int64) ([]repository.DailyGiftDraw, error) {
	if s.raffleRepo == nil {
		return nil, nil
	}
	return s.raffleRepo.GetUserRaffleWins(ctx, userID)
}

// GetTodayUserStats returns today's participation status and chance for a user.
func (s *RaffleService) GetTodayUserStats(ctx context.Context, userID int64) (uniqueParticipants int, totalMessages int, userEntered bool, err error) {
	if s.raffleRepo == nil {
		return 0, 0, false, nil
	}
	today := time.Now().UTC().Truncate(24 * time.Hour)
	return s.raffleRepo.GetDailyRaffleStats(ctx, today, userID)
}

// GetRepo returns the underlying RaffleRepo.
func (s *RaffleService) GetRepo() *repository.RaffleRepo {
	return s.raffleRepo
}

// StartDailyDrawWorker is disabled because the daily raffle has been removed.
func (s *RaffleService) StartDailyDrawWorker(ctx context.Context, getTgClient func() *telegram.BotAPIClient) {
	slog.Info("Daily raffle draw worker disabled - raffle has been removed")
}
