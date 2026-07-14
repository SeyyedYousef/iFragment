package notification

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"sync"
	"time"

	"ifragment-backend/internal/client/telegram"
)

var (
	defaultAdminNotifier *AdminNotificationService
	adminNotifierOnce    sync.Once
)

type AdminNotificationService struct {
	client       *telegram.BotAPIClient
	adminGroupID int64

	topicAVM        *int
	topicNewBot     *int
	topicNewChannel *int
	topicPayments   *int
}

func NewAdminNotificationService() *AdminNotificationService {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		token = os.Getenv("BOT_TOKEN")
	}

	client := telegram.NewBotAPIClient(token)

	adminGroupID, _ := strconv.ParseInt(os.Getenv("ADMIN_GROUP_ID"), 10, 64)

	var topicAVM, topicNewBot, topicNewChannel, topicPayments *int
	if t, err := strconv.Atoi(os.Getenv("ADMIN_TOPIC_AVM")); err == nil {
		topicAVM = &t
	}
	if t, err := strconv.Atoi(os.Getenv("ADMIN_TOPIC_NEW_BOT")); err == nil {
		topicNewBot = &t
	}
	if t, err := strconv.Atoi(os.Getenv("ADMIN_TOPIC_NEW_CHANNEL")); err == nil {
		topicNewChannel = &t
	}
	if t, err := strconv.Atoi(os.Getenv("ADMIN_TOPIC_PAYMENTS")); err == nil {
		topicPayments = &t
	}

	return &AdminNotificationService{
		client:          client,
		adminGroupID:    adminGroupID,
		topicAVM:        topicAVM,
		topicNewBot:     topicNewBot,
		topicNewChannel: topicNewChannel,
		topicPayments:   topicPayments,
	}
}

func GetAdminNotifier() *AdminNotificationService {
	adminNotifierOnce.Do(func() {
		defaultAdminNotifier = NewAdminNotificationService()
	})
	return defaultAdminNotifier
}

func (s *AdminNotificationService) send(ctx context.Context, topicID *int, text string) {
	if s.adminGroupID == 0 {
		return
	}

	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err := s.client.SendMessage(bgCtx, s.adminGroupID, text, nil, topicID)
		if err != nil {
			slog.Warn("Failed to send admin notification", "error", err, "topic_id", topicID)
		}
	}()
}

func (s *AdminNotificationService) NotifyAVM(ctx context.Context, text string) {
	s.send(ctx, s.topicAVM, text)
}

func (s *AdminNotificationService) NotifyNewBot(ctx context.Context, text string) {
	s.send(ctx, s.topicNewBot, text)
}

func (s *AdminNotificationService) NotifyNewChannel(ctx context.Context, text string) {
	s.send(ctx, s.topicNewChannel, text)
}

func (s *AdminNotificationService) NotifyPayment(ctx context.Context, text string) {
	s.send(ctx, s.topicPayments, text)
}

// Ensure error fallback
func (s *AdminNotificationService) NotifyError(ctx context.Context, err error, contextMsg string) {
	text := fmt.Sprintf("❌ <b>Error Alert</b>\n\n<b>Context:</b> %s\n<b>Error:</b> %v", contextMsg, err)
	s.send(ctx, nil, text) // Sent to main thread
}
