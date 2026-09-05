package notification

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"ifragment-backend/internal/client/telegram"
)

var (
	defaultAdminNotifier *AdminNotificationService
	adminNotifierOnce    sync.Once
	reRetryAfter         = regexp.MustCompile(`(?i)retry after (\d+)`)
)

type notificationJob struct {
	topicID *int
	text    string
	markup  interface{}
	retries int
}

type AdminNotificationService struct {
	client       *telegram.BotAPIClient
	adminGroupID int64

	topicAVM        *int
	topicNewBot     *int
	topicNewChannel *int
	topicPayments   *int
	topicGifts      *int
	topicNumbers    *int
	topicSystem     *int

	queue  chan notificationJob
	stopCh chan struct{}
}

func NewAdminNotificationService() *AdminNotificationService {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		token = os.Getenv("BOT_TOKEN")
	}

	client := telegram.NewBotAPIClient(token)

	adminGroupID, _ := strconv.ParseInt(os.Getenv("ADMIN_GROUP_ID"), 10, 64)

	var topicAVM, topicNewBot, topicNewChannel, topicPayments, topicGifts, topicNumbers, topicSystem *int
	if t, err := strconv.Atoi(os.Getenv("ADMIN_TOPIC_AVM")); err == nil && t > 0 {
		topicAVM = &t
	}
	if t, err := strconv.Atoi(os.Getenv("ADMIN_TOPIC_NEW_BOT")); err == nil && t > 0 {
		topicNewBot = &t
	}
	if t, err := strconv.Atoi(os.Getenv("ADMIN_TOPIC_NEW_CHANNEL")); err == nil && t > 0 {
		topicNewChannel = &t
	}
	if t, err := strconv.Atoi(os.Getenv("ADMIN_TOPIC_PAYMENTS")); err == nil && t > 0 {
		topicPayments = &t
	}
	if t, err := strconv.Atoi(os.Getenv("ADMIN_TOPIC_GIFTS")); err == nil && t > 0 {
		topicGifts = &t
	} else {
		topicGifts = topicAVM // Fallback to AVM topic if not configured
	}
	if t, err := strconv.Atoi(os.Getenv("ADMIN_TOPIC_NUMBERS")); err == nil && t > 0 {
		topicNumbers = &t
	} else {
		topicNumbers = topicAVM // Fallback to AVM topic if not configured
	}
	if t, err := strconv.Atoi(os.Getenv("ADMIN_TOPIC_SYSTEM")); err == nil && t > 0 {
		topicSystem = &t
	}

	service := &AdminNotificationService{
		client:          client,
		adminGroupID:    adminGroupID,
		topicAVM:        topicAVM,
		topicNewBot:     topicNewBot,
		topicNewChannel: topicNewChannel,
		topicPayments:   topicPayments,
		topicGifts:      topicGifts,
		topicNumbers:    topicNumbers,
		topicSystem:     topicSystem,
		queue:           make(chan notificationJob, 500),
		stopCh:          make(chan struct{}),
	}

	if adminGroupID != 0 {
		go service.startWorker()
	}

	return service
}

func GetAdminNotifier() *AdminNotificationService {
	adminNotifierOnce.Do(func() {
		defaultAdminNotifier = NewAdminNotificationService()
	})
	return defaultAdminNotifier
}

func (s *AdminNotificationService) startWorker() {
	ticker := time.NewTicker(75 * time.Millisecond) // Safe rate limit (~13 msgs/sec burst, max 20 msgs/min per supergroup)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case job := <-s.queue:
			<-ticker.C
			s.dispatchJob(job)
		}
	}
}

func (s *AdminNotificationService) dispatchJob(job notificationJob) {
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()

	var err error
	if job.markup != nil {
		_, err = s.client.SendMessageWithMarkup(ctx, s.adminGroupID, job.text, job.markup, job.topicID)
	} else {
		err = s.client.SendMessage(ctx, s.adminGroupID, job.text, nil, job.topicID)
	}

	if err != nil {
		errStr := err.Error()
		slog.Warn("Failed to send admin notification", "error", err, "topic_id", job.topicID, "retries", job.retries)

		// Handle FloodWait (HTTP 429) with auto-backoff and retry
		if strings.Contains(strings.ToLower(errStr), "too many requests") || strings.Contains(strings.ToLower(errStr), "retry after") {
			waitSec := 3
			if matches := reRetryAfter.FindStringSubmatch(errStr); len(matches) >= 2 {
				if parsedSec, parseErr := strconv.Atoi(matches[1]); parseErr == nil && parsedSec > 0 {
					waitSec = parsedSec
				}
			}
			slog.Info("Admin notification flood wait encountered, backing off", "wait_seconds", waitSec)
			time.Sleep(time.Duration(waitSec) * time.Second)

			if job.retries < 3 {
				job.retries++
				select {
				case s.queue <- job:
				default:
					slog.Error("Admin notification queue full during retry, message dropped", "topic_id", job.topicID)
				}
			}
		}
	}
}

func (s *AdminNotificationService) send(_ context.Context, topicID *int, text string, markup ...interface{}) {
	if s.adminGroupID == 0 {
		return
	}

	var m interface{}
	if len(markup) > 0 && markup[0] != nil {
		m = markup[0]
	}

	job := notificationJob{
		topicID: topicID,
		text:    text,
		markup:  m,
		retries: 0,
	}

	select {
	case s.queue <- job:
	default:
		slog.Warn("Admin notification queue full, dropping message", "topic_id", topicID)
	}
}

// Stop cleanly terminates the background worker
func (s *AdminNotificationService) Stop() {
	close(s.stopCh)
}

func (s *AdminNotificationService) NotifyAVM(ctx context.Context, text string, markup ...interface{}) {
	s.send(ctx, s.topicAVM, text, markup...)
}

func (s *AdminNotificationService) NotifyGift(ctx context.Context, text string, markup ...interface{}) {
	s.send(ctx, s.topicGifts, text, markup...)
}

func (s *AdminNotificationService) NotifyNumber(ctx context.Context, text string, markup ...interface{}) {
	s.send(ctx, s.topicNumbers, text, markup...)
}

func (s *AdminNotificationService) NotifyNewBot(ctx context.Context, text string, markup ...interface{}) {
	s.send(ctx, s.topicNewBot, text, markup...)
}

func (s *AdminNotificationService) NotifyNewChannel(ctx context.Context, text string, markup ...interface{}) {
	s.send(ctx, s.topicNewChannel, text, markup...)
}

func (s *AdminNotificationService) NotifyPayment(ctx context.Context, text string, markup ...interface{}) {
	s.send(ctx, s.topicPayments, text, markup...)
}

func (s *AdminNotificationService) NotifySystem(ctx context.Context, text string, markup ...interface{}) {
	s.send(ctx, s.topicSystem, text, markup...)
}

// Ensure error fallback with sanitized HTML
func (s *AdminNotificationService) NotifyError(ctx context.Context, err error, contextMsg string) {
	safeContext := telegram.EscapeHTML(contextMsg)
	safeErr := "nil"
	if err != nil {
		safeErr = telegram.EscapeHTML(err.Error())
	}
	text := fmt.Sprintf(
		"🚨 <b>خطای سیستمی در iFragment</b>\n\n"+
			"📌 <b>بخش:</b> %s\n"+
			"⚠️ <b>خطا:</b> <code>%s</code>\n"+
			"⏰ <b>زمان:</b> <code>%s</code>",
		safeContext, safeErr, time.Now().UTC().Format("2006-01-02 15:04:05 UTC"),
	)
	s.send(ctx, s.topicSystem, text, nil)
}
