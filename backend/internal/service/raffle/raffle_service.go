package raffle

import (
	"context"
	cryptoRand "crypto/rand"
	"fmt"
	"log/slog"
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
	u := strings.ToLower(chatUsername)
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

// RecordMessageTicket registers a paid message as a raffle ticket and sends a 10-second ephemeral feedback message in English.
func (s *RaffleService) RecordMessageTicket(ctx context.Context, tgClient *telegram.BotAPIClient, chatID int64, user UserCompact, messageID int) error {
	nowUTC := time.Now().UTC()
	today := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day(), 0, 0, 0, 0, time.UTC)

	ticket := &repository.RaffleTicket{
		RaffleDate: today,
		ChatID:     chatID,
		UserID:     user.ID,
		Username:   user.Username,
		FirstName:  user.FirstName,
		MessageID:  messageID,
		CreatedAt:  nowUTC,
	}

	if s.raffleRepo != nil {
		if err := s.raffleRepo.AddRaffleTicket(ctx, ticket); err != nil {
			slog.Error("Failed to record raffle ticket for user", "chat_id", chatID, "user_id", user.ID, "error", err)
		}
	}

	uniqueParticipants := 1
	totalMessages := 1
	if s.raffleRepo != nil {
		up, tm, _, err := s.raffleRepo.GetDailyRaffleStats(ctx, today, user.ID)
		if err == nil {
			if up > 0 {
				uniqueParticipants = up
			}
			if tm > 0 {
				totalMessages = tm
			}
		}
	}

	if uniqueParticipants <= 0 {
		uniqueParticipants = 1
	}

	// Each unique user has exactly 1 entry in the draw
	chancePercent := (1.0 / float64(uniqueParticipants)) * 100.0
	if chancePercent > 100.0 {
		chancePercent = 100.0
	}

	// Each message costs $1 USD -> Prize pool is 25% to 50% of total messages
	poolTotalUSD := float64(totalMessages) * 1.0
	rewardMinUSD := poolTotalUSD * 0.25
	rewardMaxUSD := poolTotalUSD * 0.50

	// Ephemeral feedback message in strictly English
	ephemeralText := fmt.Sprintf(
		"🎟 <b>Daily Telegram Gift Raffle</b>\n\n"+
			"Your message has been registered! You are entered in today's Gift Raffle 🎁\n\n"+
			"👥 <b>Unique Participants:</b> %d\n"+
			"🎯 <b>Your Win Chance:</b> <b>%.1f%%</b> (1 entry per user)\n"+
			"🌐 <b>Group Total Messages:</b> %d\n"+
			"💎 <b>Prize Pool:</b> $%.2f – $%.2f (25%%–50%% pool)\n\n"+
			"⏰ <i>Winner is drawn daily at 00:00 UTC and receives a real Telegram Gift or Stars!</i>",
		uniqueParticipants, chancePercent, totalMessages, rewardMinUSD, rewardMaxUSD,
	)

	if tgClient != nil {
		key := fmt.Sprintf("%d:%d", chatID, user.ID)

		// Delete previously stored ephemeral message if exists to keep user's chat tidy
		if prevIDVal, loaded := s.lastEphemeralMsg.Load(key); loaded {
			if prevID, ok := prevIDVal.(string); ok && prevID != "" {
				bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				_ = tgClient.DeleteEphemeralMessage(bgCtx, chatID, prevID, user.ID)
				cancel()
			}
		}

		epMsg, err := tgClient.SendEphemeralMessage(ctx, chatID, user.ID, ephemeralText, nil)
		if err == nil && epMsg != nil && string(epMsg.EphemeralMessageID) != "" {
			s.lastEphemeralMsg.Store(key, string(epMsg.EphemeralMessageID))

			// Auto-cleanup ephemeral message after exactly 10 seconds
			go func(cID, uID int64, epID string) {
				time.Sleep(10 * time.Second)
				bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				_ = tgClient.DeleteEphemeralMessage(bgCtx, cID, epID, uID)
			}(chatID, user.ID, string(epMsg.EphemeralMessageID))
		}
	}

	return nil
}

// ExecuteDailyDraw performs the deduplicated random draw for the specified date,
// sends real Gift/Stars from bot balance if possible, locks the draw in daily_gift_draws,
// and notifies ONLY the bot owner.
func (s *RaffleService) ExecuteDailyDraw(ctx context.Context, tgClient *telegram.BotAPIClient, date time.Time) error {
	targetDate := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	slog.Info("Executing daily raffle draw for @FragmentInvestors", "date", targetDate.Format("2006-01-02"))

	if s.raffleRepo == nil {
		return nil
	}

	// 1. Check if draw is already locked in daily_gift_draws to prevent re-execution
	alreadyLocked, err := s.raffleRepo.IsDailyDrawLocked(ctx, targetDate)
	if err != nil {
		slog.Error("Failed to check if daily draw is locked", "date", targetDate, "error", err)
		return err
	}
	if alreadyLocked {
		slog.Info("Daily gift draw is already locked for date, skipping", "date", targetDate)
		return nil
	}

	// 2. Read deduplicated participants: each unique user enters exactly once
	participants, totalMessages, err := s.raffleRepo.GetDailyUniqueParticipants(ctx, targetDate)
	if err != nil {
		slog.Error("Failed to retrieve unique participants for daily draw", "date", targetDate, "error", err)
		return err
	}

	if len(participants) == 0 {
		slog.Info("No messages/participants recorded for raffle on date, skipping draw", "date", targetDate)
		return nil
	}

	// 3. Fair cryptographically secure random selection among unique users
	nBig, err := cryptoRand.Int(cryptoRand.Reader, big.NewInt(int64(len(participants))))
	if err != nil {
		slog.Error("Failed to generate secure random number for raffle", "error", err)
		return err
	}
	winner := participants[nBig.Int64()]

	// 4. Calculate prize between 25% and 50% of the day's message value ($1/msg)
	poolTotalUSD := float64(totalMessages) * 1.0
	minPrizeUSD := poolTotalUSD * 0.25
	maxPrizeUSD := poolTotalUSD * 0.50

	// Random percentage between 25% and 50%
	ratioRand, _ := cryptoRand.Int(cryptoRand.Reader, big.NewInt(1000))
	randFraction := float64(ratioRand.Int64()) / 1000.0
	prizeUSD := minPrizeUSD + (maxPrizeUSD-minPrizeUSD)*randFraction
	if prizeUSD < minPrizeUSD {
		prizeUSD = minPrizeUSD
	}

	// Telegram Stars equivalent: 1 USD ≈ 50 Stars
	prizeStars := int(prizeUSD * 50.0)
	if prizeStars < 50 && totalMessages > 0 {
		prizeStars = 50 // Minimum 50 stars
	}

	// 5. Send real Gift or Stars from bot's balance via Telegram Bot API 8.0+
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

	var autoSent bool
	var giftID string
	var giftTitle string

	if client != nil {
		giftsResp, errGifts := client.GetAvailableGifts(ctx)
		if errGifts == nil && giftsResp != nil && len(giftsResp.Gifts) > 0 {
			var bestGift *telegram.BotGift
			for i := range giftsResp.Gifts {
				g := &giftsResp.Gifts[i]
				if g.StarCount <= prizeStars {
					if bestGift == nil || g.StarCount > bestGift.StarCount {
						bestGift = g
					}
				}
			}

			// If no gift under budget, pick the lowest tier available
			if bestGift == nil && len(giftsResp.Gifts) > 0 {
				bestGift = &giftsResp.Gifts[0]
			}

			if bestGift != nil {
				giftReq := telegram.SendGiftRequest{
					UserID: winner.UserID,
					GiftID: bestGift.ID,
					Text:   "🎉 Congratulations! You won the daily @FragmentInvestors Gift Raffle 🎁",
				}
				ok, sendErr := client.SendGift(ctx, giftReq)
				if sendErr == nil && ok {
					autoSent = true
					giftID = bestGift.ID
					giftTitle = fmt.Sprintf("Telegram Star Gift (%d Stars)", bestGift.StarCount)
					prizeStars = bestGift.StarCount
					slog.Info("Successfully sent automatic Star Gift to raffle winner", "user_id", winner.UserID, "gift_id", giftID, "stars", prizeStars)
				} else {
					slog.Warn("Could not send gift automatically from bot balance (insufficient stars or API error)", "user_id", winner.UserID, "error", sendErr)
				}
			}
		} else {
			slog.Warn("Could not fetch available gifts from Telegram", "error", errGifts)
		}
	}

	// 6. Lock and record in daily_gift_draws
	drawRecord := &repository.DailyGiftDraw{
		DrawDate:          targetDate,
		TotalMessages:     totalMessages,
		TotalParticipants: len(participants),
		WinnerUserID:      winner.UserID,
		WinnerUsername:    winner.Username,
		WinnerFirstName:   winner.FirstName,
		PrizeUSD:          prizeUSD,
		PrizeStars:        prizeStars,
		GiftID:            giftID,
		GiftTitle:         giftTitle,
		AutoSent:          autoSent,
		LockStatus:        "LOCKED",
		NotifiedOwner:     false,
		CreatedAt:         time.Now().UTC(),
	}

	// 7. Notify ONLY the bot owner
	ownerNotified := s.notifyOwnerOnly(ctx, client, drawRecord)
	drawRecord.NotifiedOwner = ownerNotified

	if err := s.raffleRepo.LockDailyDraw(ctx, drawRecord); err != nil {
		slog.Error("Failed to lock daily gift draw record", "date", targetDate, "error", err)
		return err
	}

	slog.Info("Successfully locked daily gift draw for @FragmentInvestors",
		"date", targetDate.Format("2006-01-02"),
		"winner_user_id", drawRecord.WinnerUserID,
		"winner_username", drawRecord.WinnerUsername,
		"total_messages", drawRecord.TotalMessages,
		"total_participants", drawRecord.TotalParticipants,
		"prize_usd", drawRecord.PrizeUSD,
		"prize_stars", drawRecord.PrizeStars,
		"auto_sent", drawRecord.AutoSent,
	)

	return nil
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

	statusText := "✅ <b>گیفت مستقیماً از موجودی Stars ربات ارسال شد.</b>"
	if !draw.AutoSent {
		statusText = "⚠️ <b>ارسال خودکار انجام نشد (موجودی Stars ربات ناکافی است یا خطا رخ داد). لطفاً گیفت یا Stars را دستی ارسال فرمایید.</b>"
	}

	notificationMsg := fmt.Sprintf(
		"🎉 <b>برنده قرعه‌کشی روزانه گروه @FragmentInvestors</b>\n\n"+
			"📅 <b>تاریخ:</b> %s\n"+
			"🔒 <b>وضعیت:</b> در daily_gift_draws قفل شد\n\n"+
			"👤 <b>مشخصات برنده:</b>\n"+
			"• نام: <b>%s</b>\n"+
			"• یوزرنیم: <b>%s</b>\n"+
			"• شناسه عددی: <code>%d</code>\n"+
			"• لینک کاربر: <a href=\"tg://user?id=%d\">مشاهده پروفایل برنده</a>\n\n"+
			"📊 <b>آمار قرعه‌کشی روز:</b>\n"+
			"• کل پیام‌های ارسالی روز: <b>%d پیام ($%.0f)</b>\n"+
			"• تعداد شرکت‌کنندگان یونیک: <b>%d نفر</b> (هر کاربر ۱ شانس)\n"+
			"• درصد شانس برنده: <b>%.1f%%</b>\n\n"+
			"🎁 <b>ارزش جایزه (۲۵٪ تا ۵۰٪ کل پیام‌ها):</b>\n"+
			"• مبلغ محاسبه‌شده: <b>$%.2f (~%d Stars)</b>\n"+
			"• وضعیت ارسال: %s",
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
		statusText,
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
