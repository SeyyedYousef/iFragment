package watchlist

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/numbers/features"
)

type WatchlistNotifier struct {
	repo     *repository.NumbersRepo
	tgClient *telegram.BotAPIClient
	appURL   string
}

func NewWatchlistNotifier(repo *repository.NumbersRepo) *WatchlistNotifier {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		token = os.Getenv("BOT_TOKEN")
	}
	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "https://t.me/iFragmentBot/app"
	}

	var tgClient *telegram.BotAPIClient
	if token != "" {
		tgClient = telegram.NewBotAPIClient(token)
	}

	return &WatchlistNotifier{
		repo:     repo,
		tgClient: tgClient,
		appURL:   appURL,
	}
}

// NotifySale sends an instant Telegram alert to all users watching this anonymous number
func (n *WatchlistNotifier) NotifySale(ctx context.Context, sale repository.NumberSaleRecord, tonUsdRate float64) {
	if n.repo == nil || n.tgClient == nil {
		return
	}

	userIDs, err := n.repo.GetWatchedUsersForNumber(ctx, sale.Number)
	if err != nil || len(userIDs) == 0 {
		return
	}

	displayNum := features.FormatDisplayNumber(sale.Number)
	priceUSD := sale.SalePriceTON * tonUsdRate

	msg := fmt.Sprintf(
		"🔔 <b>Watchlist Alert: %s Sold!</b>\n\n"+
			"💰 <b>Price:</b> <code>%.2f TON</code> (≈ $%.2f)\n"+
			"🏷 <b>Type:</b> %s\n"+
			"📅 <b>Date:</b> %s\n\n"+
			"📊 <a href=\"%s?startapp=num_%s\">View Number Intelligence Report</a>",
		displayNum,
		sale.SalePriceTON,
		priceUSD,
		sale.SaleType,
		sale.SaleDate.Format("02 Jan 2006 15:04 UTC"),
		n.appURL,
		sale.Number,
	)

	for _, uID := range userIDs {
		targetID := uID
		go func() {
			bgCtx := context.Background()
			if err := n.tgClient.SendMessage(bgCtx, targetID, msg, nil, nil); err != nil {
				slog.Warn("Failed to send number watchlist alert to user", "user_id", targetID, "number", sale.Number, "error", err)
			} else {
				slog.Info("Sent number watchlist sale alert", "user_id", targetID, "number", sale.Number)
			}
		}()
	}
}
