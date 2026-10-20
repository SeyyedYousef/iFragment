package broadcaster

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"sync"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
)

const (
	redisKeyGramTicks     = "gram:broadcaster:ticks:24h"
	redisKeyGramLastRecap = "gram:broadcaster:last_recap_date"
)

type PriceTick struct {
	Price     float64   `json:"price"`
	Timestamp time.Time `json:"timestamp"`
}

type GramBroadcaster struct {
	tgClient           *telegram.BotAPIClient
	cryptoSvc          cryptoPriceProvider
	cache              *repository.Cache
	target             string
	mu                 sync.RWMutex
	priceHistory       []PriceTick
	lastDailyRecapDate string
}

type cryptoPriceProvider interface {
	GetPrice(symbol string) string
	GetFloatPrice(symbol string) (float64, bool)
}

func NewGramBroadcaster(botToken string, cryptoSvc *cryptoprice.CryptoPriceService) *GramBroadcaster {
	targetChannel := strings.TrimSpace(os.Getenv("GRAM_CHANNEL_ID"))
	if targetChannel == "" {
		targetChannel = "@TheGramPrice"
	}
	return &GramBroadcaster{
		tgClient:     telegram.NewBotAPIClient(botToken),
		cryptoSvc:    cryptoSvc,
		target:       targetChannel,
		priceHistory: make([]PriceTick, 0),
	}
}

func (b *GramBroadcaster) SetCache(cache *repository.Cache) {
	b.mu.Lock()
	b.cache = cache
	b.mu.Unlock()
	b.restoreHistoryFromRedis(context.Background())
}

func (b *GramBroadcaster) restoreHistoryFromRedis(ctx context.Context) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.cache == nil || b.cache.Client == nil {
		return
	}
	if raw, err := b.cache.Client.Get(ctx, redisKeyGramTicks).Result(); err == nil && raw != "" {
		var saved []PriceTick
		if json.Unmarshal([]byte(raw), &saved) == nil && len(saved) > 0 {
			cutoff := time.Now().UTC().Add(-24 * time.Hour)
			filtered := make([]PriceTick, 0, len(saved))
			for _, tk := range saved {
				if tk.Timestamp.After(cutoff) || tk.Timestamp.Equal(cutoff) {
					filtered = append(filtered, tk)
				}
			}
			b.priceHistory = filtered
		}
	}
	if lastDate, err := b.cache.Client.Get(ctx, redisKeyGramLastRecap).Result(); err == nil && lastDate != "" {
		b.lastDailyRecapDate = lastDate
	}
}

func (b *GramBroadcaster) persistHistoryToRedis(ctx context.Context) {
	if b.cache == nil || b.cache.Client == nil {
		return
	}
	if data, err := json.Marshal(b.priceHistory); err == nil {
		_ = b.cache.Client.Set(ctx, redisKeyGramTicks, string(data), 36*time.Hour).Err()
	}
	if b.lastDailyRecapDate != "" {
		_ = b.cache.Client.Set(ctx, redisKeyGramLastRecap, b.lastDailyRecapDate, 48*time.Hour).Err()
	}
}

func formatCleanGramPrice(p float64) string {
	if p <= 0 {
		return "N/A"
	}
	if p >= 1.0 {
		return fmt.Sprintf("$%.2f", p)
	} else if p >= 0.01 {
		return fmt.Sprintf("$%.4f", p)
	}
	return fmt.Sprintf("$%.5f", p)
}

func (b *GramBroadcaster) resolveLiveGramPrice() (float64, bool) {
	if b.cryptoSvc == nil {
		return 0, false
	}
	// Always use official TON (The Open Network / Gram) rate
	if p, ok := b.cryptoSvc.GetFloatPrice("the-open-network"); ok && p > 0 {
		return p, true
	}
	return 0, false
}

func (b *GramBroadcaster) Start(ctx context.Context) {
	slog.Info("Starting Gram Broadcaster Worker (10-min interval, Redis 24h persistence, clean format)...", "target", b.target)

	b.restoreHistoryFromRedis(ctx)

	now := time.Now().UTC()
	minutesToWait := 10 - (now.Minute() % 10)
	nextRun := time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), now.Minute()+minutesToWait, 0, 0, time.UTC)
	if nextRun.Before(now) {
		nextRun = nextRun.Add(10 * time.Minute)
	}

	sleepDuration := time.Until(nextRun)
	slog.Info("Gram Broadcaster scheduled next run", "utc_time", nextRun.Format(time.RFC3339), "sleeping", sleepDuration)

	select {
	case <-ctx.Done():
		return
	case <-time.After(sleepDuration):
	}

	b.processCycle(ctx)

	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Gram Broadcaster stopped")
			return
		case <-ticker.C:
			b.processCycle(ctx)
		}
	}
}

func (b *GramBroadcaster) processCycle(ctx context.Context) {
	now := time.Now().UTC()

	// 1. Record current price & clean data older than 24h (persisted in Redis)
	b.recordPriceAndCleanup(now)

	// 2. Broadcast regular 10-minute post (never emits "(stale)")
	b.broadcast10MinPost(ctx, now)

	// 3. Check if 00:00 GMT daily recap should be sent
	b.checkAndSendDailyRecap(ctx, now)
}

func (b *GramBroadcaster) recordPriceAndCleanup(now time.Time) {
	b.mu.Lock()
	defer b.mu.Unlock()

	price, ok := b.resolveLiveGramPrice()
	if ok && price > 0 {
		b.priceHistory = append(b.priceHistory, PriceTick{
			Price:     price,
			Timestamp: now,
		})
	}

	// Auto-purge records older than 24 hours
	cutoff := now.Add(-24 * time.Hour)
	validIdx := 0
	for i, tick := range b.priceHistory {
		if tick.Timestamp.After(cutoff) || tick.Timestamp.Equal(cutoff) {
			validIdx = i
			break
		}
	}
	if validIdx > 0 {
		b.priceHistory = b.priceHistory[validIdx:]
	}

	b.persistHistoryToRedis(context.Background())
}

func (b *GramBroadcaster) broadcast10MinPost(ctx context.Context, now time.Time) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if len(b.priceHistory) == 0 {
		slog.Warn("Gram Broadcaster skipped: no price history available")
		return
	}

	currentTick := b.priceHistory[len(b.priceHistory)-1]
	currentPrice := currentTick.Price

	// Strip any "(stale)" suffix if GetPrice is used, or format directly from currentPrice
	priceStr := formatCleanGramPrice(currentPrice)
	if b.cryptoSvc != nil {
		if rawStr := b.cryptoSvc.GetPrice("the-open-network"); rawStr != "" && rawStr != "N/A" {
			clean := strings.TrimSpace(strings.TrimSuffix(rawStr, "(stale)"))
			if clean != "" {
				priceStr = clean
			}
		}
	}

	payload := map[string]interface{}{
		"chat_id": b.target,
		"text":    priceStr,
	}

	_, err := b.tgClient.Request(ctx, "sendMessage", payload)
	if err != nil {
		slog.Error("Failed to broadcast 10-min Gram price", "target", b.target, "error", err)
	} else {
		slog.Info("Successfully broadcasted 10-min Gram price", "target", b.target, "price", currentPrice)
	}
}

func (b *GramBroadcaster) checkAndSendDailyRecap(ctx context.Context, now time.Time) {
	// Daily Recap triggers at 00:00 GMT
	todayStr := now.Format("2006-01-02")
	if now.Hour() != 0 {
		return
	}

	b.mu.Lock()
	if b.lastDailyRecapDate == todayStr {
		b.mu.Unlock()
		return
	}
	b.lastDailyRecapDate = todayStr
	historyCopy := make([]PriceTick, len(b.priceHistory))
	copy(historyCopy, b.priceHistory)
	b.persistHistoryToRedis(ctx)
	b.mu.Unlock()

	if len(historyCopy) == 0 {
		slog.Warn("Daily recap skipped: insufficient data")
		return
	}

	openPrice := historyCopy[0].Price
	closePrice := historyCopy[len(historyCopy)-1].Price
	highPrice := openPrice
	lowPrice := openPrice
	highTime := historyCopy[0].Timestamp
	lowTime := historyCopy[0].Timestamp
	sumPrice := 0.0

	for _, tick := range historyCopy {
		sumPrice += tick.Price
		if tick.Price > highPrice {
			highPrice = tick.Price
			highTime = tick.Timestamp
		}
		if tick.Price < lowPrice {
			lowPrice = tick.Price
			lowTime = tick.Timestamp
		}
	}

	avgPrice := sumPrice / float64(len(historyCopy))
	netChange := closePrice - openPrice
	pctChange := 0.0
	if openPrice > 0 {
		pctChange = (netChange / openPrice) * 100
	}

	signStr := "+"
	if netChange < 0 {
		signStr = ""
	}

	yesterdayDate := now.Add(-12 * time.Hour).Format("02 JAN 2006")

	recapText := fmt.Sprintf("📊 GRAM DAILY RECAP — %s\n\n Open:  %s\n High:  %s (%s UTC)\n Low:   %s (%s UTC)\n Close: %s\n Avg:   %s\n\n📈 Change: %s%.4f (%s%.2f%%)\n⚡ Updates: %d",
		yesterdayDate,
		formatCleanGramPrice(openPrice),
		formatCleanGramPrice(highPrice), highTime.Format("15:04"),
		formatCleanGramPrice(lowPrice), lowTime.Format("15:04"),
		formatCleanGramPrice(closePrice),
		formatCleanGramPrice(avgPrice),
		signStr, netChange,
		signStr, pctChange,
		len(historyCopy),
	)

	// Step 1: Unpin all previous pinned messages
	_, _ = b.tgClient.Request(ctx, "unpinAllChatMessages", map[string]interface{}{
		"chat_id": b.target,
	})

	// Step 2: Send Daily Recap Message
	resp, err := b.tgClient.Request(ctx, "sendMessage", map[string]interface{}{
		"chat_id": b.target,
		"text":    recapText,
	})
	if err != nil {
		slog.Error("Failed to send Daily Recap", "target", b.target, "error", err)
		return
	}

	// Step 3: Pin the new message exclusively
	msgID := extractMessageID(resp)
	if msgID > 0 {
		_, errPin := b.tgClient.Request(ctx, "pinChatMessage", map[string]interface{}{
			"chat_id":              b.target,
			"message_id":           msgID,
			"disable_notification": false,
		})
		if errPin != nil {
			slog.Error("Failed to pin Daily Recap", "msg_id", msgID, "error", errPin)
		} else {
			slog.Info("Successfully pinned Daily Recap", "msg_id", msgID)
		}
	}
}

func extractMessageID(resp []byte) int64 {
	var parsed struct {
		Ok     bool `json:"ok"`
		Result struct {
			MessageID int64 `json:"message_id"`
		} `json:"result"`
	}
	if err := json.Unmarshal(resp, &parsed); err == nil && parsed.Ok {
		return parsed.Result.MessageID
	}
	return 0
}
