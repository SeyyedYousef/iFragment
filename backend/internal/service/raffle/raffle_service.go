package raffle

import (
	"context"
	cryptoRand "crypto/rand"
	"fmt"
	"log/slog"
	"math"
	"math/big"
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

// IsRaffleEnabled checks whether the @FragmentInvestors daily paid-message raffle is active.
func IsRaffleEnabled() bool {
	val := strings.ToLower(strings.TrimSpace(os.Getenv("RAFFLE_ENABLED")))
	return val != "false" && val != "0" && val != "off"
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

// RecordMessageTicket registers a daily raffle entry for a user sending a paid-star message in @FragmentInvestors.
func (s *RaffleService) RecordMessageTicket(ctx context.Context, tgClient *telegram.BotAPIClient, chatID int64, user UserCompact, messageID int) error {
	if s.raffleRepo == nil || user.ID <= 0 || user.IsBot || !IsRaffleEnabled() {
		return nil
	}
	now := time.Now().UTC()
	ticket := &repository.RaffleTicket{
		RaffleDate: now.Truncate(24 * time.Hour),
		ChatID:     chatID,
		UserID:     user.ID,
		Username:   user.Username,
		FirstName:  user.FirstName,
		MessageID:  messageID,
		CreatedAt:  now,
	}
	if err := s.raffleRepo.AddRaffleTicket(ctx, ticket); err != nil {
		slog.Debug("Failed to record daily raffle ticket", "user_id", user.ID, "error", err)
		return err
	}
	return nil
}

// ExecuteDailyDraw runs the cryptographically fair daily gift raffle draw for @FragmentInvestors.
func (s *RaffleService) ExecuteDailyDraw(ctx context.Context, tgClient *telegram.BotAPIClient, date time.Time) error {
	if s.raffleRepo == nil || !IsRaffleEnabled() {
		return nil
	}

	drawDate := date.UTC().Truncate(24 * time.Hour)
	locked, err := s.raffleRepo.IsDailyDrawLocked(ctx, drawDate)
	if err != nil {
		return err
	}
	if locked {
		return nil
	}

	participants, totalMessages, err := s.raffleRepo.GetDailyUniqueParticipants(ctx, drawDate)
	if err != nil {
		return err
	}
	if len(participants) == 0 || totalMessages == 0 {
		slog.Info("Daily raffle draw skipped: no participants for date", "date", drawDate.Format("2006-01-02"))
		return nil
	}

	// Cryptographically uniform random winner selection across unique participants
	winnerIdx := 0
	if len(participants) > 1 {
		if nBig, rErr := cryptoRand.Int(cryptoRand.Reader, big.NewInt(int64(len(participants)))); rErr == nil {
			winnerIdx = int(nBig.Int64())
		}
	}
	winner := participants[winnerIdx]

	// Calculate prize pool (35% of daily message pool, minimum $1.00 / 50 Stars)
	poolUSD := float64(totalMessages) * 1.0
	prizeUSD := math.Max(1.0, math.Round(poolUSD*0.35*100)/100)
	prizeStars := int(math.Round(prizeUSD * 50.0))
	if prizeStars < 50 {
		prizeStars = 50
	}
	winChance := (1.0 / float64(len(participants))) * 100.0

	draw := &repository.DailyGiftDraw{
		DrawDate:          drawDate,
		TotalMessages:     totalMessages,
		TotalParticipants: len(participants),
		WinnerUserID:      winner.UserID,
		WinnerUsername:    winner.Username,
		WinnerFirstName:   winner.FirstName,
		PrizeUSD:          prizeUSD,
		PrizeStars:        prizeStars,
		GiftTitle:         fmt.Sprintf("Telegram Star Gift (%d Stars)", prizeStars),
		AutoSent:          false,
		LockStatus:        "LOCKED",
		NotifiedOwner:     false,
		CreatedAt:         time.Now().UTC(),
	}

	if err := s.raffleRepo.LockDailyDraw(ctx, draw); err != nil {
		return err
	}

	_ = s.notifyWinner(ctx, tgClient, winner, drawDate, prizeUSD, prizeStars, winChance, len(participants))
	if s.notifyOwnerOnly(ctx, tgClient, draw) {
		draw.NotifiedOwner = true
		_ = s.raffleRepo.LockDailyDraw(ctx, draw)
	}

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

// StartDailyDrawWorker runs a periodic background check to execute yesterday's daily draw after 00:05 UTC.
func (s *RaffleService) StartDailyDrawWorker(ctx context.Context, getTgClient func() *telegram.BotAPIClient) {
	if !IsRaffleEnabled() {
		slog.Info("Daily raffle draw worker disabled via RAFFLE_ENABLED=false")
		return
	}
	slog.Info("Starting @FragmentInvestors Daily Raffle Draw Worker...")
	go func() {
		ticker := time.NewTicker(15 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				utcNow := now.UTC()
				if utcNow.Hour() == 0 && utcNow.Minute() >= 5 {
					yesterday := utcNow.AddDate(0, 0, -1).Truncate(24 * time.Hour)
					var client *telegram.BotAPIClient
					if getTgClient != nil {
						client = getTgClient()
					}
					_ = s.ExecuteDailyDraw(ctx, client, yesterday)
				}
			}
		}
	}()
}
