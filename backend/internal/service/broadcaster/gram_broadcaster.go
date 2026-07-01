package broadcaster

import (
	"context"
	"log/slog"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/service/cryptoprice"
)

type GramBroadcaster struct {
	tgClient  *telegram.BotAPIClient
	cryptoSvc *cryptoprice.CryptoPriceService
	target    string
}

func NewGramBroadcaster(botToken string, cryptoSvc *cryptoprice.CryptoPriceService) *GramBroadcaster {
	return &GramBroadcaster{
		tgClient:  telegram.NewBotAPIClient(botToken),
		cryptoSvc: cryptoSvc,
		target:    "@TheGramPrice",
	}
}

func (b *GramBroadcaster) Start(ctx context.Context) {
	slog.Info("Starting Gram Broadcaster Worker...")

	// Align to the next 5-minute mark (e.g., :00, :05, :10)
	now := time.Now()
	minutesToWait := 5 - (now.Minute() % 5)
	// We want to start exactly at the zero second of the 5-minute mark
	nextRun := time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), now.Minute()+minutesToWait, 0, 0, now.Location())
	if nextRun.Before(now) {
		nextRun = nextRun.Add(5 * time.Minute)
	}

	sleepDuration := time.Until(nextRun)
	slog.Info("Gram Broadcaster will start at", "time", nextRun.Format(time.RFC3339), "sleeping", sleepDuration)

	select {
	case <-ctx.Done():
		return
	case <-time.After(sleepDuration):
	}

	b.broadcast()

	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Gram Broadcaster stopped")
			return
		case <-ticker.C:
			b.broadcast()
		}
	}
}

func (b *GramBroadcaster) broadcast() {
	priceStr := b.cryptoSvc.GetPrice("the-open-network")
	if priceStr == "N/A" || priceStr == "" {
		slog.Warn("Gram Broadcaster skipped: Price is N/A")
		return
	}

	// Format the message - only price
	text := priceStr

	// Use raw request to allow string target
	payload := map[string]interface{}{
		"chat_id": b.target,
		"text":    text,
	}

	_, err := b.tgClient.Request(context.Background(), "sendMessage", payload)
	if err != nil {
		slog.Error("Failed to broadcast Gram price", "target", b.target, "error", err)
	} else {
		slog.Info("Successfully broadcasted Gram price", "target", b.target, "price", priceStr)
	}
}
