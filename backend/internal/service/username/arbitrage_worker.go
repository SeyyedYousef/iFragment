package username

import (
	"context"
	"fmt"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username/avm"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
)

type ArbitrageWorker struct {
	db         *repository.Database
	cache      *repository.Cache
	avmService *avm.ValuationService
	tgClient   *telegram.BotAPIClient
	stopChan   chan struct{}
}

func NewArbitrageWorker(
	db *repository.Database,
	cache *repository.Cache,
	avmService *avm.ValuationService,
) *ArbitrageWorker {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		token = os.Getenv("BOT_TOKEN")
	}

	var tgClient *telegram.BotAPIClient
	if token != "" {
		tgClient = telegram.NewBotAPIClient(token)
	}

	return &ArbitrageWorker{
		db:         db,
		cache:      cache,
		avmService: avmService,
		tgClient:   tgClient,
		stopChan:   make(chan struct{}),
	}
}

func (w *ArbitrageWorker) Start(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Minute)
	go func() {
		defer ticker.Stop()
		// Initial check after startup
		time.Sleep(10 * time.Second)
		w.runScan(ctx)

		for {
			select {
			case <-ctx.Done():
				return
			case <-w.stopChan:
				return
			case <-ticker.C:
				w.runScan(ctx)
			}
		}
	}()
}

func (w *ArbitrageWorker) Stop() {
	close(w.stopChan)
}

func (w *ArbitrageWorker) runScan(ctx context.Context) {
	if w.db == nil || w.avmService == nil || w.tgClient == nil {
		return
	}

	// 1. Fetch recent live auctions & active listings from database
	query := `
		SELECT item_name, price, status 
		FROM nft_collection_auctions 
		WHERE status = 'Active' OR status = 'on_sale'
		ORDER BY id DESC 
		LIMIT 20
	`
	rows, err := w.db.Pool.Query(ctx, query)
	if err != nil {
		slog.Debug("ArbitrageWorker: no active auctions found or query error", "err", err)
		return
	}
	defer rows.Close()

	type listingItem struct {
		name  string
		price float64
	}
	var items []listingItem

	for rows.Next() {
		var name, priceStr, status string
		if err := rows.Scan(&name, &priceStr, &status); err == nil {
			cleanName := strings.ToLower(strings.TrimPrefix(name, "@"))
			cleanedPrice := strings.ToUpper(strings.ReplaceAll(priceStr, "TON", ""))
			cleanedPrice = strings.TrimSpace(cleanedPrice)
			priceVal, errParse := strconv.ParseFloat(cleanedPrice, 64)
			if errParse == nil && priceVal > 0 {
				items = append(items, listingItem{name: cleanName, price: priceVal})
			}
		}
	}

	for _, item := range items {
		// Run valuation
		valResult, errVal := w.avmService.Valuate(ctx, item.name, 0)
		if errVal != nil || valResult == nil {
			continue
		}

		expectedTon, _ := valResult.ExpectedTON.Float64()
		if expectedTon <= 0 || item.price >= expectedTon {
			continue
		}

		// Calculate discount percentage
		discountPct := ((expectedTon - item.price) / expectedTon) * 100.0
		if discountPct >= 70.0 {
			w.dispatchArbitrageAlert(ctx, item.name, item.price, expectedTon, discountPct)
		}
	}
}

func (w *ArbitrageWorker) dispatchArbitrageAlert(
	ctx context.Context,
	handle string,
	askPrice float64,
	fairPrice float64,
	discountPct float64,
) {
	// Deduplicate alert per price & handle in Redis for 6 hours
	if w.cache != nil && w.cache.Client != nil {
		dedupKey := fmt.Sprintf("arbitrage_alert_sent:%s:%.1f", handle, askPrice)
		set, err := w.cache.Client.SetNX(ctx, dedupKey, "1", 6*time.Hour).Result()
		if err != nil || !set {
			return // Already alerted recently
		}
	}

	slog.Info("Arbitrage 70%+ opportunity detected!", "handle", handle, "ask", askPrice, "fair", fairPrice, "discount", discountPct)

	// Fetch active Pro users from DB
	proUserIDs := w.getActiveProUsers(ctx)
	if len(proUserIDs) == 0 {
		return
	}

	fragmentURL := fmt.Sprintf("https://fragment.com/username/%s", handle)
	msgText := fmt.Sprintf(
		"🚨 <b>70%%+ ARBITRAGE RADAR ALERT</b>\n\n"+
			"💎 <b>Handle:</b> @%s\n"+
			"💰 <b>Listed Ask:</b> <code>%.1f TON</code>\n"+
			"📊 <b>Fair AI Value:</b> <code>%.1f TON</code>\n"+
			"🔥 <b>Instant Discount:</b> <b>%.0f%% OFF!</b>\n\n"+
			"⚡ <i>Available now on Fragment. Click below for instant execution.</i>",
		handle, askPrice, fairPrice, discountPct,
	)

	replyMarkup := map[string]interface{}{
		"inline_keyboard": [][]map[string]string{
			{
				{"text": "🛒 Buy on Fragment", "url": fragmentURL},
			},
		},
	}

	for _, userID := range proUserIDs {
		payload := map[string]interface{}{
			"chat_id":      userID,
			"text":         msgText,
			"parse_mode":   "HTML",
			"reply_markup": replyMarkup,
		}
		_, _ = w.tgClient.Request(ctx, "sendMessage", payload)
	}
}

func (w *ArbitrageWorker) getActiveProUsers(ctx context.Context) []int64 {
	// Query paid orders with val_pro or 249 stars in past 30 days
	query := `
		SELECT DISTINCT user_id 
		FROM orders 
		WHERE status = 'paid' 
		  AND (payload LIKE 'val_pro:%' OR amount = 249)
		  AND created_at >= NOW() - INTERVAL '30 days'
	`
	rows, err := w.db.Pool.Query(ctx, query)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var users []int64
	for rows.Next() {
		var u int64
		if err := rows.Scan(&u); err == nil && u > 0 {
			users = append(users, u)
		}
	}
	return users
}
