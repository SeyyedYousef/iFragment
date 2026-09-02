package botmgmt

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/notification"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type SubscriptionPackage struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	DurationMonths int     `json:"duration_months"`
	PriceUSD       float64 `json:"price_usd"`
	PricePerMonth  float64 `json:"price_per_month"`
	PriceStars     int     `json:"price_stars"`
	PriceCoins     float64 `json:"price_coins"`
	PriceCredits   int     `json:"price_credits"`
	GroupsLimit    int     `json:"groups_limit"`
	PriceFRG       float64 `json:"price_frg"`
	Discount       string  `json:"discount,omitempty"`
	Badge          string  `json:"badge,omitempty"`
}

type DiscountTier struct {
	Percent       int     `json:"percent"`
	RequiredCoins float64 `json:"required_coins"`
	Description   string  `json:"description"`
}

var DiscountTiers = []DiscountTier{
	{Percent: 25, RequiredCoins: 38700, Description: "25% OFF - Valid for 15 days"},
	{Percent: 50, RequiredCoins: 77400, Description: "50% OFF - Valid for 15 days"},
	{Percent: 75, RequiredCoins: 116100, Description: "75% OFF (MAX) - Valid for 15 days"},
}

var Packages = []SubscriptionPackage{
	{ID: "1_month", Name: "1 Month", DurationMonths: 1, PriceUSD: 1.99, PricePerMonth: 1.99, PriceStars: 150, PriceCoins: 350000, PriceCredits: 3, GroupsLimit: 1, PriceFRG: 1.99, Discount: "", Badge: ""},
	{ID: "3_months", Name: "3 Months", DurationMonths: 3, PriceUSD: 4.49, PricePerMonth: 1.49, PriceStars: 350, PriceCoins: 900000, PriceCredits: 8, GroupsLimit: 1, PriceFRG: 4.49, Discount: "25%", Badge: "popular"},
	{ID: "6_months", Name: "6 Months", DurationMonths: 6, PriceUSD: 7.49, PricePerMonth: 1.29, PriceStars: 575, PriceCoins: 1500000, PriceCredits: 15, GroupsLimit: 1, PriceFRG: 7.49, Discount: "35%", Badge: ""},
	{ID: "12_months", Name: "12 Months", DurationMonths: 12, PriceUSD: 11.99, PricePerMonth: 1.00, PriceStars: 925, PriceCoins: 2500000, PriceCredits: 25, GroupsLimit: 1, PriceFRG: 11.99, Discount: "50%", Badge: "best_value"},
}

type BotService struct {
	botRepo              *repository.BotRepo
	settingsRepo         *repository.SettingsRepo
	auditRepo            *repository.AuditRepo
	analyticsRepo        *repository.AnalyticsRepo
	premiumGroupSvc      *PremiumGroupService
	lastNotificationDate string               // format: YYYY-MM-DD
	qhNotifications      map[string]time.Time // key: groupID:action:HH:MM, val: time
	lastBioUpdate        sync.Map             // map[uuid.UUID]time.Time
	cache                *repository.Cache
	cryptoSvc            *cryptoprice.CryptoPriceService
	mu                   sync.Mutex
}

func NewBotService(
	botRepo *repository.BotRepo,
	settingsRepo *repository.SettingsRepo,
	auditRepo *repository.AuditRepo,
	analyticsRepo *repository.AnalyticsRepo,
	cache *repository.Cache,
	cryptoSvc *cryptoprice.CryptoPriceService,
) *BotService {
	return &BotService{
		botRepo:         botRepo,
		settingsRepo:    settingsRepo,
		auditRepo:       auditRepo,
		analyticsRepo:   analyticsRepo,
		premiumGroupSvc: NewPremiumGroupService(botRepo, analyticsRepo),
		cache:           cache,
		cryptoSvc:       cryptoSvc,
	}
}

func (s *BotService) BotRepo() *repository.BotRepo {
	return s.botRepo
}

func (s *BotService) GetPremiumGroupService() *PremiumGroupService {
	return s.premiumGroupSvc
}

func (s *BotService) StartBackgroundTasks(ctx context.Context) {
	expiryTicker := time.NewTicker(10 * time.Minute)
	qhTicker := time.NewTicker(1 * time.Minute)
	creditBatchTicker := time.NewTicker(30 * time.Minute)

	go func() {
		defer expiryTicker.Stop()
		defer qhTicker.Stop()
		defer creditBatchTicker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-expiryTicker.C:
				s.CheckExpirations(ctx)
			case <-qhTicker.C:
				s.CheckQuietHoursTransitions(ctx)
			case <-creditBatchTicker.C:
				if s.botRepo != nil && s.botRepo.DB() != nil {
					if expired, err := s.botRepo.DB().ExpireOutdatedCreditBatches(ctx); err == nil && expired > 0 {
						slog.Info("Successfully expired outdated 15-day credit batches", "expired_count", expired)
					}
				}
			}
		}
	}()

	// Start group dynamic bio worker
	go s.dynamicBioWorker(ctx)

	// Start daily @FragmentInvestors premium membership audit worker (00:00 GMT / 04:30 AFN)
	if s.premiumGroupSvc != nil {
		s.premiumGroupSvc.StartDailyAuditWorker(ctx)
	}
}

func (s *BotService) CheckExpirations(ctx context.Context) {
	groups, err := s.botRepo.GetAllActiveGroups(ctx)
	if err != nil {
		return
	}

	now := time.Now()
	const maxConcurrency = 15
	sem := make(chan struct{}, maxConcurrency)
	var wg sync.WaitGroup

	miniAppURL := os.Getenv("MINI_APP_URL")
	if miniAppURL == "" {
		miniAppURL = "https://t.me/iFragmentBot/iFragment"
	}

	for _, g := range groups {
		sem <- struct{}{}
		wg.Add(1)
		go func(g repository.ManagedGroup) {
			defer wg.Done()
			defer func() { <-sem }()

			groupCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			defer cancel()

			var expiry *time.Time
			if g.PaidUntil != nil {
				expiry = g.PaidUntil
			} else {
				expiry = &g.TrialEndsAt
			}

			if expiry == nil {
				return
			}

			// 1. Check for actual expiration
			if g.SubscriptionStatus != "expired" && now.After(*expiry) {
				_ = s.botRepo.UpdateGroupSubscription(groupCtx, g.ID, "expired", nil)
				s.sendSmartExpirationNotice(groupCtx, g, "expired", *expiry, miniAppURL)
				return
			}

			// 2. Auto-leave if expired for > 7 days
			if g.SubscriptionStatus == "expired" && now.After(expiry.Add(7*24*time.Hour)) {
				if repository.IsExemptFromAutoLeave(groupCtx, s.botRepo.DB(), g.ChatID, g.ChatTitle) {
					slog.Info("Skipping auto-leave for exempt group", "chat_id", g.ChatID, "title", g.ChatTitle)
					return
				}

				bot, err := s.botRepo.GetBotByID(groupCtx, g.BotID)
				if err == nil {
					token, decErr := DecryptToken(bot.BotTokenEncrypted)
					if decErr == nil {
						tg := telegram.NewBotAPIClient(token)
						_ = tg.LeaveChat(groupCtx, g.ChatID)

						lang := i18n.DetectLanguage("")
						msg := i18n.T(lang, "notifications.group_auto_left", map[string]interface{}{"group": g.ChatTitle})
						targetUserID := bot.OwnerUserID
						if g.ConnectedByUserID != nil {
							targetUserID = *g.ConnectedByUserID
						}
						_ = tg.SendMessage(groupCtx, targetUserID, msg, nil, nil)
					}
				}
				_ = s.botRepo.DeleteGroup(groupCtx, g.ID)
				return
			}

			if g.SubscriptionStatus == "expired" {
				return
			}

			// 3. Precision Multi-Stage Alerts: 48h, 24h, 6h, 1h before expiration
			remaining := expiry.Sub(now)
			if remaining <= 0 {
				return
			}

			var stage string
			switch {
			case remaining <= 1*time.Hour:
				stage = "1h"
			case remaining <= 6*time.Hour:
				stage = "6h"
			case remaining <= 24*time.Hour:
				stage = "24h"
			case remaining <= 48*time.Hour:
				stage = "48h"
			}

			if stage != "" {
				notifKey := fmt.Sprintf("notif:grp:%s:%s", g.ID.String(), stage)
				alreadySent := false
				if s.cache != nil && s.cache.Client != nil {
					set, err := s.cache.Client.SetNX(groupCtx, notifKey, "1", 7*24*time.Hour).Result()
					if err != nil || !set {
						alreadySent = true
					}
				}
				if !alreadySent {
					s.sendSmartExpirationNotice(groupCtx, g, stage, *expiry, miniAppURL)
				}
			}
		}(g)
	}
	wg.Wait()
}

func (s *BotService) sendSmartExpirationNotice(ctx context.Context, g repository.ManagedGroup, stage string, expiry time.Time, miniAppURL string) {
	bot, err := s.botRepo.GetBotByID(ctx, g.BotID)
	if err != nil {
		return
	}

	// Get Language
	lang := "fa"
	settings, _ := s.settingsRepo.GetSettings(ctx, g.ID)
	if settings != nil {
		var general repository.SettingsGeneral
		if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
			lang = general.Language
		}
	}

	token, _ := DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)

	var text string
	var renewCoinsBtn, renewProBtn, dashboardBtn string

	if lang == "fa" {
		renewCoinsBtn = "🪙 تمدید با سکه ایردراپ"
		renewProBtn = "⭐ تمدید با استارز یا TON"
		dashboardBtn = "⚙️ ورود به داشبورد"

		expiryDateStr := expiry.Format("2006/01/02 15:04")
		switch stage {
		case "48h":
			text = fmt.Sprintf(`🔔 <b>یادآوری تمدید محافظت گروه: %s</b>

⏳ <b>زمان باقی‌مانده از اشتراک:</b> ۴۸ ساعت
📅 <b>تاریخ انقضا:</b> <code>%s</code>
🛡️ <b>وضعیت سپر امنیتی:</b> فعال (ضد اسپم، فیلتر لینک، کپچای ورودی)

✨ برای حفظ آرامش گروه و جلوگیری از ورود ربات‌های تبلیغاتی، می‌توانید همین حالا با <b>سکه ایردراپ</b> یا <b>تلگرام استارز/TON</b> اشتراک خود را تمدید کنید.

🎁 <i>تخفیف وفاداری: تمدید با سکه ایردراپ بدون پرداخت ریالی!</i>`, telegram.EscapeHTML(g.ChatTitle), expiryDateStr)

		case "24h":
			text = fmt.Sprintf(`⚠️ <b>هشدار مهم: فقط ۲۴ ساعت تا پایان محافظت گروه %s!</b>

⏳ <b>زمان انقضا:</b> <code>%s</code>
🚨 پس از پایان این مهلت، ربات محافظ متوقف شده و فیلترهای ضداسپم، کپچا و قفل چت غیرفعال خواهند شد.

⚡ <b>تمدید فوری بدون وقفه:</b>
با یک کلیک از طریق دکمه‌های زیر، اشتراک گروه را تمدید کنید:`, telegram.EscapeHTML(g.ChatTitle), expiryDateStr)

		case "6h", "1h":
			remText := "۶ ساعت"
			if stage == "1h" {
				remText = "کمتر از ۱ ساعت"
			}
			text = fmt.Sprintf(`🚨 <b>هشدار فوری: اشتراک گروه %s در حال اتمام است! (%s باقی‌مانده)</b>

⚡ جلوگیری از هجوم ربات‌های تبلیغاتی و قطع سرویس:
همین حالا با زدن دکمه زیر با سکه‌های ایردراپ یا استارز تلگرام تمدید کنید.`, telegram.EscapeHTML(g.ChatTitle), remText)

		case "expired":
			text = fmt.Sprintf(`🛑 <b>اشتراک محافظت گروه %s به پایان رسید.</b>

⚠️ فیلترهای ضداسپم، حذف لینک و کپچای ورودی به حالت تعلیق درآمدند.
🔒 <b>نگران نباشید:</b> تمامی تنظیمات، لیست سیاه و کانال‌های عضویت اجباری گروه شما محفوظ است و با تمدید اشتراک، بلافاصله فعال خواهند شد.`, telegram.EscapeHTML(g.ChatTitle))
		}
	} else {
		renewCoinsBtn = "🪙 Extend with Airdrop Coins"
		renewProBtn = "⭐ Extend with Stars / TON"
		dashboardBtn = "⚙️ Open Web Dashboard"

		expiryDateStr := expiry.Format("2006/01/02 15:04")
		switch stage {
		case "48h":
			text = fmt.Sprintf(`🔔 <b>Subscription Renewal Reminder: %s</b>

⏳ <b>Time Remaining:</b> 48 Hours
📅 <b>Expires At:</b> <code>%s</code>
🛡️ <b>Protection Status:</b> Active (Anti-Spam, Link Filter, Join CAPTCHA)

✨ Extend now using your <b>Airdrop Coins</b> or <b>Telegram Stars / TON</b> to keep your group protected without interruption.`, telegram.EscapeHTML(g.ChatTitle), expiryDateStr)

		case "24h":
			text = fmt.Sprintf(`⚠️ <b>Important Notice: 24 Hours Left for %s!</b>

⏳ <b>Expires At:</b> <code>%s</code>
🚨 Protection features will be suspended after expiration.

⚡ <b>Instant 1-Click Renewal:</b>
Use the buttons below to extend protection:`, telegram.EscapeHTML(g.ChatTitle), expiryDateStr)

		case "6h", "1h":
			remText := "6 hours"
			if stage == "1h" {
				remText = "less than 1 hour"
			}
			text = fmt.Sprintf(`🚨 <b>Urgent: Protection expiring for %s! (%s left)</b>

⚡ Prevent spam bot attacks and keep your group secure by renewing now:`, telegram.EscapeHTML(g.ChatTitle), remText)

		case "expired":
			text = fmt.Sprintf(`🛑 <b>Protection subscription ended for %s.</b>

⚠️ Anti-spam and auto-moderation features are now suspended.
🔒 <b>All your settings and blacklists are safely preserved.</b> Renew now to restore full protection immediately.`, telegram.EscapeHTML(g.ChatTitle))
		}
	}

	dashboardURL := fmt.Sprintf("%s?startapp=group_%s", miniAppURL, g.ID)
	renewCoinsURL := fmt.Sprintf("%s?startapp=group_%s", miniAppURL, g.ID)
	renewProURL := fmt.Sprintf("%s?startapp=group_%s", miniAppURL, g.ID)

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": renewCoinsBtn, "url": renewCoinsURL},
			},
			{
				{"text": renewProBtn, "url": renewProURL},
			},
			{
				{"text": dashboardBtn, "url": dashboardURL},
			},
		},
	}

	targetUserID := bot.OwnerUserID
	if g.ConnectedByUserID != nil {
		targetUserID = *g.ConnectedByUserID
	}
	_, _ = tg.SendMessageWithMarkup(ctx, targetUserID, text, markup, nil, "HTML")
}


// Bot Operations

func (s *BotService) RegisterBot(ctx context.Context, ownerID int64, token, username, name string, botID int64) (*repository.ManagedBot, error) {
	var me *telegram.User
	var err error
	tgClient := telegram.NewBotAPIClient(token)
	me, err = tgClient.GetMe(ctx)
	if err != nil {
		if os.Getenv("APP_ENV") != "production" {
			slog.Warn("Telegram token verification failed, using mock data for development", "error", err)
			me = &telegram.User{
				ID:        botID,
				IsBot:     true,
				FirstName: name,
				Username:  username,
			}
		} else {
			if errors.Is(err, telegram.ErrUnauthorized) || errors.Is(err, telegram.ErrNotFound) {
				return nil, fmt.Errorf("validation failed: bot token verification failed: %w", err)
			}
			return nil, fmt.Errorf("bot token verification failed: %w", err)
		}
	}
	if me.ID != botID {
		return nil, fmt.Errorf("bot token verification details mismatch")
	}

	botCount, _ := s.botRepo.GetBotCountByOwner(ctx, ownerID)
	if botCount >= 3 {
		return nil, fmt.Errorf("you have reached the maximum limit of 3 bots")
	}

	actualName := me.FirstName
	if actualName == "" {
		actualName = name
	}

	encrypted, err := EncryptToken(token)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt token: %w", err)
	}

	secretBytes := make([]byte, 32)
	if _, err := rand.Read(secretBytes); err != nil {
		return nil, fmt.Errorf("failed to generate webhook secret: %w", err)
	}
	secretHex := hex.EncodeToString(secretBytes)

	bot := &repository.ManagedBot{
		OwnerUserID:        ownerID,
		BotTokenEncrypted:  encrypted,
		BotUsername:        me.Username,
		BotName:            actualName,
		BotID:              me.ID,
		Status:             "active",
		WebhookSecretToken: secretHex,
	}

	if err := s.botRepo.CreateBot(ctx, bot); err != nil {
		return nil, err
	}

	// Register webhook with Telegram using the backend API address
	backendURL := os.Getenv("BACKEND_URL")
	if backendURL == "" {
		backendURL = os.Getenv("API_URL")
	}
	if backendURL == "" {
		backendURL = os.Getenv("APP_URL")
	}
	if backendURL != "" {
		webhookURL := fmt.Sprintf("%s/api/v1/webhook/telegram/%s", strings.TrimSuffix(backendURL, "/"), bot.ID.String())
		tgWebhookURL := fmt.Sprintf("https://api.telegram.org/bot%s/setWebhook", token)
		payload := map[string]interface{}{
			"url":                  webhookURL,
			"secret_token":         secretHex,
			"drop_pending_updates": true,
			"allowed_updates": []string{
				"message",
				"edited_message",
				"callback_query",
				"channel_post",
				"edited_channel_post",
				"my_chat_member",
				"chat_member",
				"chat_join_request",
				"pre_checkout_query",
			},
		}
		body, _ := json.Marshal(payload)

		client := &http.Client{Timeout: 10 * time.Second}
		if resp, err := client.Post(tgWebhookURL, "application/json", bytes.NewBuffer(body)); err == nil {
			resp.Body.Close()
		}
	}

	maskedToken := token
	if len(token) > 10 {
		maskedToken = token[:8] + "..."
	}
	msgTopic := fmt.Sprintf("🤖 <b>ربات جدید ثبت شد!</b>\n\n🆔 <b>آیدی ربات:</b> <code>%d</code>\n👤 <b>یوزرنیم ربات:</b> @%s\n📛 <b>نام ربات:</b> %s\n🧑‍💻 <b>آیدی مالک:</b> <code>%d</code>\n🔑 <b>توکن:</b> <code>%s</code>",
		bot.BotID, bot.BotUsername, bot.BotName, bot.OwnerUserID, maskedToken)
	notification.GetAdminNotifier().NotifyNewBot(ctx, msgTopic)

	return bot, nil
}

func getMainBotID() int64 {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		token = os.Getenv("BOT_TOKEN")
	}
	if token == "" {
		return 0
	}
	parts := strings.Split(token, ":")
	if len(parts) < 2 {
		return 0
	}
	botID, _ := strconv.ParseInt(parts[0], 10, 64)
	return botID
}

func (s *BotService) ListBots(ctx context.Context, ownerID int64) ([]repository.ManagedBot, error) {
	bots, err := s.botRepo.GetBotsByOwner(ctx, ownerID)
	if err != nil {
		return nil, err
	}

	mainBotID := getMainBotID()
	filtered := make([]repository.ManagedBot, 0, len(bots))
	for _, b := range bots {
		if b.Status == "revoked" {
			continue
		}
		if mainBotID != 0 && b.BotID == mainBotID {
			continue
		}
		filtered = append(filtered, b)
	}
	return filtered, nil
}

func (s *BotService) GetBot(ctx context.Context, botID uuid.UUID, ownerID int64) (*repository.ManagedBot, error) {
	bot, err := s.botRepo.GetBotByID(ctx, botID)
	if err != nil {
		return nil, err
	}
	if bot.OwnerUserID != ownerID {
		return nil, fmt.Errorf("unauthorized: not bot owner")
	}
	return bot, nil
}

func (s *BotService) RevokeBot(ctx context.Context, botID uuid.UUID, ownerID int64) error {
	bot, err := s.GetBot(ctx, botID, ownerID)
	if err != nil {
		return err
	}
	err = s.botRepo.UpdateBotStatus(ctx, bot.ID, "revoked")
	if err == nil {
		token, decErr := DecryptToken(bot.BotTokenEncrypted)
		if decErr == nil {
			tgWebhookURL := fmt.Sprintf("https://api.telegram.org/bot%s/deleteWebhook", token)
			client := &http.Client{Timeout: 10 * time.Second}
			if resp, reqErr := client.Post(tgWebhookURL, "application/json", nil); reqErr == nil {
				resp.Body.Close()
			}
		}
	}
	return err
}

// Group Operations

func (s *BotService) ListGroups(ctx context.Context, botID uuid.UUID, ownerID int64) ([]repository.ManagedGroup, error) {
	bot, err := s.GetBot(ctx, botID, ownerID)
	if err != nil {
		return nil, err
	}
	groups, err := s.botRepo.GetGroupsByBot(ctx, botID)
	if err != nil {
		return nil, err
	}

	var tg *telegram.BotAPIClient
	token, _ := DecryptToken(bot.BotTokenEncrypted)
	if token != "" {
		tg = telegram.NewBotAPIClient(token)
	}

	// Check trial expirations & sync missing details
	now := time.Now()
	for i, g := range groups {
		if g.SubscriptionStatus == "trial" && now.After(g.TrialEndsAt) {
			_ = s.botRepo.UpdateGroupSubscription(ctx, g.ID, "expired", nil)
			groups[i].SubscriptionStatus = "expired"
		}
		if g.SubscriptionStatus == "paid" && g.PaidUntil != nil && now.After(*g.PaidUntil) {
			_ = s.botRepo.UpdateGroupSubscription(ctx, g.ID, "expired", nil)
			groups[i].SubscriptionStatus = "expired"
		}

		if tg != nil {
			count, errCount := tg.GetChatMemberCount(ctx, g.ChatID)
			photoURL := ""
			title := g.ChatTitle
			if chatInfo, errChat := tg.GetChat(ctx, g.ChatID); errChat == nil && chatInfo != nil {
				if chatInfo.Title != "" {
					title = chatInfo.Title
				}
				if chatInfo.Username != nil && *chatInfo.Username != "" {
					photoURL = fmt.Sprintf("https://t.me/i/userpic/320/%s.jpg", *chatInfo.Username)
				}
			}
			if photoURL == "" {
				photoURL, _ = tg.GetChatPhotoURL(ctx, g.ChatID)
			}
			if errCount == nil && count > 0 {
				groups[i].MembersCount = count
			}
			if photoURL != "" {
				groups[i].PhotoURL = photoURL
			}
			groups[i].ChatTitle = title
			_ = s.botRepo.UpdateGroupDetails(ctx, g.ID, groups[i].ChatTitle, groups[i].MembersCount, groups[i].PhotoURL)
		}
	}

	return groups, nil
}

func (s *BotService) GetGroup(ctx context.Context, groupID uuid.UUID, ownerID int64) (*repository.ManagedGroup, error) {
	group, err := s.botRepo.GetGroupByID(ctx, groupID)
	if err != nil {
		return nil, err
	}
	if group.ConnectedByUserID != nil && *group.ConnectedByUserID == ownerID {
		if group.PhotoURL == "" {
			if bot, errBot := s.botRepo.GetBotByID(ctx, group.BotID); errBot == nil && bot != nil {
				if token, _ := DecryptToken(bot.BotTokenEncrypted); token != "" {
					tg := telegram.NewBotAPIClient(token)
					photoURL := ""
					if chatInfo, errChat := tg.GetChat(ctx, group.ChatID); errChat == nil && chatInfo != nil && chatInfo.Username != nil && *chatInfo.Username != "" {
						photoURL = fmt.Sprintf("https://t.me/i/userpic/320/%s.jpg", *chatInfo.Username)
					}
					if photoURL == "" {
						photoURL, _ = tg.GetChatPhotoURL(ctx, group.ChatID)
					}
					if photoURL != "" {
						group.PhotoURL = photoURL
						_ = s.botRepo.UpdateGroupDetails(ctx, group.ID, group.ChatTitle, group.MembersCount, group.PhotoURL)
					}
				}
			}
		}
		return group, nil
	}
	if _, err := s.GetBot(ctx, group.BotID, ownerID); err != nil {
		return nil, err
	}
	if group.PhotoURL == "" {
		if bot, errBot := s.botRepo.GetBotByID(ctx, group.BotID); errBot == nil && bot != nil {
			if token, _ := DecryptToken(bot.BotTokenEncrypted); token != "" {
				tg := telegram.NewBotAPIClient(token)
				photoURL := ""
				if chatInfo, errChat := tg.GetChat(ctx, group.ChatID); errChat == nil && chatInfo != nil && chatInfo.Username != nil && *chatInfo.Username != "" {
					photoURL = fmt.Sprintf("https://t.me/i/userpic/320/%s.jpg", *chatInfo.Username)
				}
				if photoURL == "" {
					photoURL, _ = tg.GetChatPhotoURL(ctx, group.ChatID)
				}
				if photoURL != "" {
					group.PhotoURL = photoURL
					_ = s.botRepo.UpdateGroupDetails(ctx, group.ID, group.ChatTitle, group.MembersCount, group.PhotoURL)
				}
			}
		}
	}
	return group, nil
}

func (s *BotService) DeleteGroup(ctx context.Context, groupID uuid.UUID, ownerID int64) error {
	if _, err := s.GetGroup(ctx, groupID, ownerID); err != nil {
		return err
	}
	return s.botRepo.DeleteGroup(ctx, groupID)
}

// Settings Operations

type CachedChatInfo struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Username    string `json:"username"`
	PhotoURL    string `json:"photo_url"`
}

func (s *BotService) GetSettings(ctx context.Context, groupID uuid.UUID, ownerID int64) (*repository.GroupSettings, error) {
	group, err := s.GetGroup(ctx, groupID, ownerID)
	if err != nil {
		return nil, err
	}
	settings, err := s.settingsRepo.GetSettings(ctx, groupID)
	if err != nil {
		return nil, err
	}

	// Dynamically inject live Telegram Group info with 10-minute caching
	bot, err := s.botRepo.GetBotByID(ctx, group.BotID)
	if err == nil && bot != nil {
		token, decErr := DecryptToken(bot.BotTokenEncrypted)
		if decErr == nil && token != "" {
			var cachedInfo CachedChatInfo
			cacheKey := fmt.Sprintf("tg:chat:info:%d", group.ChatID)
			cacheHit := false

			if s.cache != nil && s.cache.Client != nil {
				if val, err := s.cache.Client.Get(ctx, cacheKey).Result(); err == nil {
					if json.Unmarshal([]byte(val), &cachedInfo) == nil {
						cacheHit = true
					}
				}
			}

			if !cacheHit {
				tg := telegram.NewBotAPIClient(token)
				chatRes, tgErr := tg.GetChat(ctx, group.ChatID)
				if tgErr == nil && chatRes != nil {
					cachedInfo.Title = chatRes.Title
					if chatRes.Description != "" {
						cachedInfo.Description = chatRes.Description
					}
					if chatRes.Username != nil {
						cachedInfo.Username = *chatRes.Username
					}
					photoURL, pErr := tg.GetChatPhotoURL(ctx, group.ChatID)
					if pErr == nil {
						cachedInfo.PhotoURL = photoURL
					}

					if s.cache != nil && s.cache.Client != nil {
						if data, err := json.Marshal(cachedInfo); err == nil {
							s.cache.Client.Set(ctx, cacheKey, data, 10*time.Minute)
						}
					}
					cacheHit = true
				}
			}

			if cacheHit {
				var genMap map[string]interface{}
				if err := json.Unmarshal(settings.General, &genMap); err == nil {
					genMap["name"] = cachedInfo.Title
					if cachedInfo.Description != "" {
						genMap["description"] = cachedInfo.Description
					}
					if cachedInfo.Username != "" {
						genMap["username"] = cachedInfo.Username
					}
					genMap["photo"] = cachedInfo.PhotoURL

					// Re-marshal
					if updated, mErr := json.Marshal(genMap); mErr == nil {
						settings.General = updated
					}
				}
			}
		}
	}

	return settings, nil
}

func (s *BotService) UpdateSettings(ctx context.Context, groupID uuid.UUID, category string, data json.RawMessage, userID int64, version int) (*repository.GroupSettings, error) {
	if err := ValidateSettingsCategory(category, data); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	oldSettings, err := s.GetSettings(ctx, groupID, userID)
	if err != nil {
		return nil, err
	}

	newSettings, err := s.settingsRepo.UpdateCategory(ctx, groupID, category, data, userID, version)
	if err != nil {
		return nil, err
	}

	// Audit log
	var oldVal []byte
	switch category {
	case "general":
		oldVal = oldSettings.General
	case "content_restrictions":
		oldVal = oldSettings.ContentRestrictions
	case "limits":
		oldVal = oldSettings.Limits
	case "quiet_hours":
		oldVal = oldSettings.QuietHours
	case "mandatory_membership":
		oldVal = oldSettings.MandatoryMembership
	case "custom_texts":
		oldVal = oldSettings.CustomTexts
	}

	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		GroupID:  &groupID,
		ActorID:  userID,
		Action:   "settings.update." + category,
		OldValue: oldVal,
		NewValue: data,
	})

	if category == "general" {
		group, err := s.botRepo.GetGroupByID(ctx, groupID)
		if err == nil {
			cacheKey := fmt.Sprintf("bot_enabled:%s:%d", group.BotID.String(), group.ChatID)
			s.settingsRepo.ClearCacheKey(ctx, cacheKey)
		}
	}

	if category == "quiet_hours" {
		var newQuiet repository.SettingsQuietHours
		var oldQuiet repository.SettingsQuietHours
		if err := json.Unmarshal(data, &newQuiet); err == nil {
			if len(oldSettings.QuietHours) > 0 {
				_ = json.Unmarshal(oldSettings.QuietHours, &oldQuiet)
			}
			if newQuiet.EmergencyLock != oldQuiet.EmergencyLock {
				group, err := s.botRepo.GetGroupByID(ctx, groupID)
				if err == nil && group != nil {
					bot, err := s.botRepo.GetBotByID(ctx, group.BotID)
					if err == nil && bot != nil {
						token, _ := DecryptToken(bot.BotTokenEncrypted)
						if token != "" {
							var customTexts repository.SettingsCustomTexts
							if len(newSettings.CustomTexts) > 0 {
								_ = json.Unmarshal(newSettings.CustomTexts, &customTexts)
							}
							var general repository.SettingsGeneral
							if len(newSettings.General) > 0 {
								_ = json.Unmarshal(newSettings.General, &general)
							}
							lang := general.Language
							if lang == "" {
								lang = "fa"
							}
							timeStr := time.Now().Format("15:04")
							if newQuiet.EmergencyLock {
								s.sendQHNotice(ctx, *group, "start", customTexts.SilenceStartText, timeStr, lang, general)
							} else {
								s.sendQHNotice(ctx, *group, "end", customTexts.SilenceEndText, timeStr, lang, general)
							}
						}
					}
				}
			}
		}
	}

	if category == "content_restrictions" {
		var content repository.SettingsContentRestrictions
		if err := json.Unmarshal(data, &content); err == nil {
			group, err := s.botRepo.GetGroupByID(ctx, groupID)
			if err == nil && group != nil {
				bot, err := s.botRepo.GetBotByID(ctx, group.BotID)
				if err == nil && bot != nil {
					token, _ := DecryptToken(bot.BotTokenEncrypted)
					if token != "" {
						tg := telegram.NewBotAPIClient(token)
						canSendAudios := !(content.BlockAudio.Enabled && content.BlockAudio.Window == "Always")
						canSendDocs := !(content.BlockFiles.Enabled && content.BlockFiles.Window == "Always")
						canSendPhotos := !(content.BlockPhotos.Enabled && content.BlockPhotos.Window == "Always")
						canSendVideos := !(content.BlockGifs.Enabled && content.BlockGifs.Window == "Always")
						canSendVoice := !(content.BlockVoiceMessages.Enabled && content.BlockVoiceMessages.Window == "Always")
						canSendPolls := !(content.BlockPolls.Enabled && content.BlockPolls.Window == "Always")
						canSendOther := !(content.BlockStickers.Enabled && content.BlockStickers.Window == "Always")
						canAddPreviews := !(content.RemoveLinks.Enabled && content.RemoveLinks.Window == "Always")
						bTrue := true

						perms := telegram.ChatPermissions{
							CanSendMessages:       &bTrue,
							CanSendAudios:         &canSendAudios,
							CanSendDocuments:      &canSendDocs,
							CanSendPhotos:         &canSendPhotos,
							CanSendVideos:         &canSendVideos,
							CanSendVideoNotes:     &canSendVideos,
							CanSendVoiceNotes:     &canSendVoice,
							CanSendPolls:          &canSendPolls,
							CanSendOtherMessages:  &canSendOther,
							CanAddWebPagePreviews: &canAddPreviews,
							CanChangeInfo:         &bTrue,
							CanInviteUsers:        &bTrue,
							CanPinMessages:        &bTrue,
							CanManageTopics:       &bTrue,
						}
						_ = tg.SetChatPermissions(ctx, group.ChatID, perms, true)
					}
				}
			}
		}
	}

	if category == "dynamic_bio" {
		var config GroupDynamicBioConfig
		if err := json.Unmarshal(data, &config); err == nil && config.Enabled {
			group, err := s.botRepo.GetGroupByID(ctx, groupID)
			if err == nil {
				go s.updateGroupDynamicBio(context.Background(), group, config)
			}
		}
	}

	return newSettings, nil
}

// Subscription Operations

func (s *BotService) GetPackages() []SubscriptionPackage {
	return Packages
}

func (s *BotService) Subscribe(ctx context.Context, userID int64, groupID uuid.UUID, packageID string) error {
	group, err := s.GetGroup(ctx, groupID, userID)
	if err != nil {
		return fmt.Errorf("unauthorized or invalid group: %w", err)
	}

	var pkg *SubscriptionPackage
	for _, p := range Packages {
		if p.ID == packageID {
			pkg = &p
			break
		}
	}
	if pkg == nil {
		return fmt.Errorf("invalid package: %s", packageID)
	}

	tx, err := s.botRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := s.internalActivateSubscriptionTx(ctx, tx, userID, groupID, packageID, group, pkg); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit subscription transaction: %w", err)
	}

	bot, _ := s.botRepo.GetBotByID(ctx, group.BotID)
	botUsername := ""
	if bot != nil {
		botUsername = bot.BotUsername
	}
	s.notifyOwnerOnSubscription(context.Background(), botUsername, group.ChatTitle, pkg.Name, "FRG", userID)

	return nil
}

func (s *BotService) internalActivateSubscriptionTx(ctx context.Context, tx pgx.Tx, userID int64, groupID uuid.UUID, packageID string, group *repository.ManagedGroup, pkg *SubscriptionPackage) error {
	base := time.Now()
	if group.SubscriptionStatus == "paid" && group.PaidUntil != nil && group.PaidUntil.After(base) {
		base = *group.PaidUntil
	}

	months := pkg.DurationMonths
	if months <= 0 {
		months = 1
	}
	paidUntil := base.Add(time.Duration(months) * 30 * 24 * time.Hour)

	if err := s.botRepo.UpdateGroupSubscriptionTx(ctx, tx, groupID, "paid", &paidUntil); err != nil {
		return fmt.Errorf("failed to activate subscription: %w", err)
	}

	// Create billing subscription record
	err := s.botRepo.CreateBillingSubscriptionTx(ctx, tx, &repository.BillingSubscription{
		UserID:      userID,
		GroupID:     groupID,
		PackageID:   packageID,
		GroupsLimit: pkg.GroupsLimit,
		AmountFRG:   pkg.PriceFRG,
		Period:      "monthly",
		Status:      "active",
		StartsAt:    time.Now(),
		ExpiresAt:   paidUntil,
	})
	if err != nil {
		return fmt.Errorf("failed to create billing subscription: %w", err)
	}
	return nil
}

func (s *BotService) notifyOwnerOnSubscription(ctx context.Context, botUsername string, groupTitle string, packageName string, paymentMethod string, userID int64) {
	msgTopic := fmt.Sprintf("💳 <b>پرداخت جدید (خرید اشتراک)</b>\n\n🤖 <b>ربات:</b> @%s\n👥 <b>گروه:</b> %s\n📦 <b>پکیج:</b> %s\n💵 <b>روش پرداخت:</b> %s\n👤 <b>آیدی کاربر:</b> <code>%d</code>",
		botUsername, groupTitle, packageName, paymentMethod, userID)
	notification.GetAdminNotifier().NotifyPayment(ctx, msgTopic)

	owners := os.Getenv("OWNER_TELEGRAM_IDS")
	if owners == "" {
		return
	}

	msg := fmt.Sprintf("🔔 <b>New Subscription Purchased!</b>\nBot: @%s\nGroup: %s\nPackage: %s\nMethod: %s\nUser ID: %d",
		botUsername, groupTitle, packageName, paymentMethod, userID)

	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if botToken == "" {
		botToken = os.Getenv("BOT_TOKEN")
	}

	for _, idStr := range strings.Split(owners, ",") {
		idStr = strings.TrimSpace(idStr)
		if idStr == "" {
			continue
		}
		adminID, err := strconv.ParseInt(idStr, 10, 64)
		if err == nil {
			go telegram.NewBotAPIClient(botToken).SendMessage(context.Background(), adminID, msg, nil, nil)
		}
	}
}

func (s *BotService) GetPackageByID(packageID string) *SubscriptionPackage {
	for _, p := range Packages {
		if p.ID == packageID {
			return &p
		}
	}
	return nil
}

func (s *BotService) ActivateSubscriptionFromStars(ctx context.Context, userID int64, groupID uuid.UUID, packageID string, discountPercent int) error {
	group, err := s.botRepo.GetGroupByID(ctx, groupID)
	if err != nil {
		return err
	}
	pkg := s.GetPackageByID(packageID)
	if pkg == nil {
		return fmt.Errorf("invalid package")
	}

	tx, err := s.botRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if discountPercent > 0 {
		if discountPercent > 75 {
			discountPercent = 75
		}
		savedStars := (pkg.PriceStars * discountPercent) / 100
		requiredCoins := float64(savedStars * 1032)
		_ = s.botRepo.DB().DeductCreditsFIFO(ctx, tx, userID, requiredCoins)
	}

	if err := s.internalActivateSubscriptionTx(ctx, tx, userID, groupID, packageID, group, pkg); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	bot, _ := s.botRepo.GetBotByID(ctx, group.BotID)
	botUsername := ""
	if bot != nil {
		botUsername = bot.BotUsername
	}
	s.notifyOwnerOnSubscription(context.Background(), botUsername, group.ChatTitle, pkg.Name, "Telegram Stars", userID)

	return nil
}

func (s *BotService) SubscribeWithAirdrop(ctx context.Context, userID int64, groupID uuid.UUID, packageID string) error {
	group, err := s.GetGroup(ctx, groupID, userID)
	if err != nil {
		return fmt.Errorf("unauthorized or invalid group: %w", err)
	}

	pkg := s.GetPackageByID(packageID)
	if pkg == nil {
		return fmt.Errorf("invalid package: %s", packageID)
	}

	requiredCoins := float64(pkg.PriceCoins)
	if requiredCoins <= 0 {
		requiredCoins = pkg.PriceFRG * 100000.0
	}

	tx, err := s.botRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Deduct coins using FIFO
	if err := s.botRepo.DB().DeductCreditsFIFO(ctx, tx, userID, requiredCoins); err != nil {
		return fmt.Errorf("failed to deduct credits: %w", err)
	}

	if err := s.internalActivateSubscriptionTx(ctx, tx, userID, groupID, packageID, group, pkg); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit subscription transaction: %w", err)
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	bot, _ := s.botRepo.GetBotByID(ctx, group.BotID)
	botUsername := ""
	if bot != nil {
		botUsername = bot.BotUsername
	}
	s.notifyOwnerOnSubscription(context.Background(), botUsername, group.ChatTitle, pkg.Name, "Airdrop Coins", userID)

	return nil
}

func (s *BotService) SubscribeWithCredits(ctx context.Context, userID int64, groupID uuid.UUID, packageID string) error {
	group, err := s.GetGroup(ctx, groupID, userID)
	if err != nil {
		return fmt.Errorf("unauthorized or invalid group: %w", err)
	}

	pkg := s.GetPackageByID(packageID)
	if pkg == nil {
		return fmt.Errorf("invalid package: %s", packageID)
	}

	requiredCredits := pkg.PriceCredits
	if requiredCredits <= 0 {
		requiredCredits = pkg.DurationMonths * 3
	}

	intelRepo := repository.NewIntelCreditRepo(s.botRepo.DB())
	reason := fmt.Sprintf("sub:group:%s", groupID.String())
	if _, err := intelRepo.ConsumeCreditsBatch(ctx, userID, requiredCredits, reason, pkg.ID, ""); err != nil {
		return fmt.Errorf("failed to deduct credits: %w", err)
	}

	tx, err := s.botRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := s.internalActivateSubscriptionTx(ctx, tx, userID, groupID, packageID, group, pkg); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit subscription transaction: %w", err)
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	bot, _ := s.botRepo.GetBotByID(ctx, group.BotID)
	botUsername := ""
	if bot != nil {
		botUsername = bot.BotUsername
	}
	s.notifyOwnerOnSubscription(context.Background(), botUsername, group.ChatTitle, pkg.Name, "Intel Credits", userID)

	return nil
}

// Analytics

func (s *BotService) GetAnalytics(ctx context.Context, groupID uuid.UUID, ownerID int64, days int) (*repository.AnalyticsSummary, error) {
	if _, err := s.GetGroup(ctx, groupID, ownerID); err != nil {
		return nil, err
	}
	return s.analyticsRepo.GetSummary(ctx, groupID, days)
}

func (s *BotService) GetGrowthTimeline(ctx context.Context, groupID uuid.UUID, days int) ([]repository.DailyMetric, error) {
	return s.analyticsRepo.GetGrowthTimeline(ctx, groupID, days)
}

func (s *BotService) GetActivityTimeline(ctx context.Context, groupID uuid.UUID, days int) ([]repository.DailyMetric, error) {
	return s.analyticsRepo.GetActivityTimeline(ctx, groupID, days)
}

// Audit

func (s *BotService) GetAuditLog(ctx context.Context, groupID uuid.UUID, ownerID int64, limit, offset int) ([]repository.AuditLog, error) {
	if _, err := s.GetGroup(ctx, groupID, ownerID); err != nil {
		return nil, err
	}
	return s.auditRepo.GetByGroup(ctx, groupID, limit, offset)
}

// Token encryption

var (
	cryptoKey  []byte
	cryptoOnce sync.Once
)

func getCryptoKey() []byte {
	cryptoOnce.Do(func() {
		keyStr := os.Getenv("BOT_TOKEN_KEY")
		if keyStr == "" {
			jwtSecret := os.Getenv("JWT_SECRET")
			if jwtSecret != "" {
				slog.Warn("BOT_TOKEN_KEY not set. Deriving AES key from sha256(JWT_SECRET).")
				hash := sha256.Sum256([]byte(jwtSecret))
				cryptoKey = hash[:]
				return
			}
			webhookSecret := os.Getenv("WEBHOOK_SECRET_TOKEN")
			if webhookSecret != "" {
				slog.Warn("BOT_TOKEN_KEY not set. Deriving AES key from sha256(WEBHOOK_SECRET_TOKEN).")
				hash := sha256.Sum256([]byte(webhookSecret))
				cryptoKey = hash[:]
				return
			}
			if os.Getenv("APP_ENV") != "production" {
				keyStr = "dev_bot_token_key_32_characters_"
			} else {
				slog.Warn("BOT_TOKEN_KEY and secrets not set. Using fallback encryption key.")
				keyStr = "ifragment_prod_fallback_token_32"
			}
		}
		key := []byte(keyStr)
		if len(key) != 32 {
			hash := sha256.Sum256(key)
			key = hash[:]
		}
		cryptoKey = key
	})
	return cryptoKey
}

func EncryptToken(token string) ([]byte, error) {
	key := getCryptoKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	return gcm.Seal(nonce, nonce, []byte(token), nil), nil
}

func DecryptToken(ciphertext []byte) (string, error) {
	key := getCryptoKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	if len(ciphertext) < gcm.NonceSize() {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonceSize := gcm.NonceSize()
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

func (s *BotService) CheckQuietHoursTransitions(ctx context.Context) {
	groups, err := s.botRepo.GetAllActiveGroups(ctx)
	if err != nil {
		return
	}

	groupIDs := make([]uuid.UUID, len(groups))
	for i, g := range groups {
		groupIDs[i] = g.ID
	}

	// Bulk load settings in a single bulk operation using Redis MGET pipeline!
	bulkSettings, err := s.settingsRepo.GetMultipleSettings(ctx, groupIDs)
	if err != nil {
		bulkSettings = make(map[uuid.UUID]*repository.GroupSettings)
	}

	now := time.Now()
	const maxConcurrency = 15
	sem := make(chan struct{}, maxConcurrency)
	var wg sync.WaitGroup

	for _, g := range groups {
		sem <- struct{}{}
		wg.Add(1)
		go func(g repository.ManagedGroup) {
			defer wg.Done()
			defer func() { <-sem }()

			groupCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			defer cancel()

			settings, ok := bulkSettings[g.ID]
			if !ok {
				// Fallback to single-fetch if not preloaded
				var err error
				settings, err = s.settingsRepo.GetSettings(groupCtx, g.ID)
				if err != nil {
					return
				}
			}

			var general repository.SettingsGeneral
			var quiet repository.SettingsQuietHours
			var customTexts repository.SettingsCustomTexts

			if len(settings.General) > 0 {
				_ = json.Unmarshal(settings.General, &general)
			}
			if len(settings.QuietHours) > 0 {
				_ = json.Unmarshal(settings.QuietHours, &quiet)
			}
			if len(settings.CustomTexts) > 0 {
				_ = json.Unmarshal(settings.CustomTexts, &customTexts)
			}

			if len(quiet.Periods) == 0 || !quiet.SendNotifications {
				return
			}

			loc, err := time.LoadLocation(general.Timezone)
			if err != nil {
				loc = time.UTC
			}

			nowInTZ := now.In(loc)
			currentTimeStr := nowInTZ.Format("15:04") // HH:MM

			lang := general.Language
			if lang == "" {
				lang = "en"
			}
			for _, p := range quiet.Periods {
				if p.Start == currentTimeStr {
					s.sendQHNotice(groupCtx, g, "start", customTexts.SilenceStartText, currentTimeStr, lang, general)
				}
				if p.End == currentTimeStr {
					s.sendQHNotice(groupCtx, g, "end", customTexts.SilenceEndText, currentTimeStr, lang, general)
				}
			}
		}(g)
	}
	wg.Wait()
}

func (s *BotService) sendQHNotice(ctx context.Context, g repository.ManagedGroup, action string, customText string, timeStr string, lang string, general repository.SettingsGeneral) {
	key := fmt.Sprintf("%s:%s:%s", g.ID, action, timeStr)
	s.mu.Lock()
	if s.qhNotifications == nil {
		s.qhNotifications = make(map[string]time.Time)
	}
	lastSent, exists := s.qhNotifications[key]
	// Clean up old entries
	now := time.Now()
	for k, t := range s.qhNotifications {
		if now.Sub(t) > 24*time.Hour {
			delete(s.qhNotifications, k)
		}
	}
	if exists && now.Sub(lastSent) < 5*time.Minute {
		s.mu.Unlock()
		return
	}
	s.qhNotifications[key] = now
	s.mu.Unlock()

	bot, err := s.botRepo.GetBotByID(ctx, g.BotID)
	if err != nil {
		return
	}

	token, _ := DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)

	msg := customText
	if msg != "" {
		msg = strings.ReplaceAll(msg, "{group}", telegram.EscapeHTML(g.ChatTitle))
		msg = strings.ReplaceAll(msg, "{chat_title}", telegram.EscapeHTML(g.ChatTitle))
		msg = strings.ReplaceAll(msg, "{time}", timeStr)
	} else {
		if action == "start" {
			msg = i18n.T(lang, "notifications.qh_start", nil)
		} else {
			msg = i18n.T(lang, "notifications.qh_end", nil)
		}
		if msg == "" || msg == "notifications.qh_start" || msg == "notifications.qh_end" {
			if action == "start" {
				msg = "🔒 *Quiet hours have started.* The group is now muted."
			} else {
				msg = "🔓 *Quiet hours have ended.* You can now send messages."
			}
		}
	}

	res, _ := tg.SendMessageWithResult(ctx, g.ChatID, msg, nil, nil)
	if res != nil && general.AutoDeleteBot && general.AutoDeleteDelay > 0 {
		time.AfterFunc(time.Duration(general.AutoDeleteDelay)*time.Second, func() {
			_ = tg.DeleteMessage(context.Background(), g.ChatID, res.MessageID)
		})
	}
}

func (s *BotService) SubscribeChannel(ctx context.Context, userID int64, channelID uuid.UUID, packageID string) error {
	channelRepo := repository.NewChannelRepo(s.botRepo.DB(), nil)
	ch, err := channelRepo.GetChannelByID(ctx, channelID)
	if err != nil {
		return fmt.Errorf("channel not found: %w", err)
	}

	bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
	if err != nil {
		return fmt.Errorf("unauthorized or invalid bot: %w", err)
	}
	if bot.OwnerUserID != userID && (ch.ConnectedByUserID == nil || *ch.ConnectedByUserID != userID) {
		return fmt.Errorf("unauthorized: not channel owner")
	}

	pkg := s.GetPackageByID(packageID)
	if pkg == nil {
		return fmt.Errorf("invalid package: %s", packageID)
	}

	tx, err := s.botRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := s.internalActivateChannelSubscriptionTx(ctx, tx, userID, channelID, packageID, ch, pkg); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit subscription transaction: %w", err)
	}

	s.notifyOwnerOnSubscription(context.Background(), bot.BotUsername, ch.ChatTitle, pkg.Name, "FRG (Channel)", userID)

	go func() {

	}()

	return nil
}

func (s *BotService) internalActivateChannelSubscriptionTx(ctx context.Context, tx pgx.Tx, userID int64, channelID uuid.UUID, packageID string, ch *repository.ManagedChannel, pkg *SubscriptionPackage) error {
	base := time.Now()
	if ch.SubscriptionStatus == "paid" && ch.PaidUntil != nil && ch.PaidUntil.After(base) {
		base = *ch.PaidUntil
	}

	months := pkg.DurationMonths
	if months <= 0 {
		months = 1
	}
	paidUntil := base.Add(time.Duration(months) * 30 * 24 * time.Hour)

	channelRepo := repository.NewChannelRepo(s.botRepo.DB(), nil)
	if err := channelRepo.UpdateChannelSubscriptionTx(ctx, tx, channelID, "paid", &paidUntil); err != nil {
		return fmt.Errorf("failed to activate subscription: %w", err)
	}

	err := channelRepo.CreateChannelBillingSubscriptionTx(ctx, tx, &repository.ChannelBillingSubscription{
		UserID:        userID,
		ChannelID:     channelID,
		PackageID:     packageID,
		ChannelsLimit: pkg.GroupsLimit,
		AmountFRG:     pkg.PriceFRG,
		Period:        "monthly",
		Status:        "active",
		StartsAt:      time.Now(),
		ExpiresAt:     paidUntil,
	})
	if err != nil {
		return fmt.Errorf("failed to create billing subscription: %w", err)
	}
	return nil
}

func (s *BotService) SubscribeChannelWithAirdrop(ctx context.Context, userID int64, channelID uuid.UUID, packageID string) error {
	channelRepo := repository.NewChannelRepo(s.botRepo.DB(), nil)
	ch, err := channelRepo.GetChannelByID(ctx, channelID)
	if err != nil {
		return fmt.Errorf("channel not found: %w", err)
	}

	bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
	if err != nil {
		return fmt.Errorf("unauthorized or invalid bot: %w", err)
	}
	if bot.OwnerUserID != userID && (ch.ConnectedByUserID == nil || *ch.ConnectedByUserID != userID) {
		return fmt.Errorf("unauthorized: not channel owner")
	}

	pkg := s.GetPackageByID(packageID)
	if pkg == nil {
		return fmt.Errorf("invalid package: %s", packageID)
	}

	requiredCoins := float64(pkg.PriceCoins)
	if requiredCoins <= 0 {
		requiredCoins = pkg.PriceFRG * 100000.0
	}

	tx, err := s.botRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Deduct coins using FIFO
	if err := s.botRepo.DB().DeductCreditsFIFO(ctx, tx, userID, requiredCoins); err != nil {
		return fmt.Errorf("failed to deduct credits: %w", err)
	}

	if err := s.internalActivateChannelSubscriptionTx(ctx, tx, userID, channelID, packageID, ch, pkg); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit subscription transaction: %w", err)
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	s.notifyOwnerOnSubscription(context.Background(), bot.BotUsername, ch.ChatTitle, pkg.Name, "Airdrop Coins (Channel)", userID)

	go func() {

	}()

	return nil
}

func (s *BotService) ActivateChannelSubscriptionFromStars(ctx context.Context, userID int64, channelID uuid.UUID, packageID string, discountPercent int) error {
	channelRepo := repository.NewChannelRepo(s.botRepo.DB(), nil)
	ch, err := channelRepo.GetChannelByID(ctx, channelID)
	if err != nil {
		return err
	}

	bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
	if err != nil {
		return err
	}

	pkg := s.GetPackageByID(packageID)
	if pkg == nil {
		return fmt.Errorf("invalid package")
	}

	tx, err := s.botRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if discountPercent > 0 {
		if discountPercent > 75 {
			discountPercent = 75
		}
		savedStars := (pkg.PriceStars * discountPercent) / 100
		requiredCoins := float64(savedStars * 1032)
		_ = s.botRepo.DB().DeductCreditsFIFO(ctx, tx, userID, requiredCoins)
	}

	if err := s.internalActivateChannelSubscriptionTx(ctx, tx, userID, channelID, packageID, ch, pkg); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	s.notifyOwnerOnSubscription(context.Background(), bot.BotUsername, ch.ChatTitle, pkg.Name, "Telegram Stars (Channel)", userID)

	return nil
}

func (s *BotService) SubscribeChannelWithCredits(ctx context.Context, userID int64, channelID uuid.UUID, packageID string) error {
	channelRepo := repository.NewChannelRepo(s.botRepo.DB(), nil)
	ch, err := channelRepo.GetChannelByID(ctx, channelID)
	if err != nil {
		return err
	}

	bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
	if err != nil {
		return err
	}

	pkg := s.GetPackageByID(packageID)
	if pkg == nil {
		return fmt.Errorf("invalid package: %s", packageID)
	}

	requiredCredits := pkg.PriceCredits
	if requiredCredits <= 0 {
		requiredCredits = pkg.DurationMonths * 3
	}

	intelRepo := repository.NewIntelCreditRepo(s.botRepo.DB())
	reason := fmt.Sprintf("sub:channel:%s", channelID.String())
	if _, err := intelRepo.ConsumeCreditsBatch(ctx, userID, requiredCredits, reason, pkg.ID, ""); err != nil {
		return fmt.Errorf("failed to deduct credits: %w", err)
	}

	tx, err := s.botRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := s.internalActivateChannelSubscriptionTx(ctx, tx, userID, channelID, packageID, ch, pkg); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	s.notifyOwnerOnSubscription(context.Background(), bot.BotUsername, ch.ChatTitle, pkg.Name, "Intel Credits (Channel)", userID)

	return nil
}

// ─── Group Security & Members Moderation ─────────────────────────────────────

type GroupTelegramInfo struct {
	HasProtectedContent          bool                     `json:"has_protected_content"`
	HasHiddenMembers             bool                     `json:"has_hidden_members"`
	HasAggressiveAntiSpamEnabled bool                     `json:"has_aggressive_anti_spam_enabled"`
	JoinToSendMessages           bool                     `json:"join_to_send_messages"`
	JoinByRequest                bool                     `json:"join_by_request"`
	SlowModeDelay                int                      `json:"slow_mode_delay"`
	CanChangeInfo                bool                     `json:"can_change_info"`
	Permissions                  *telegram.ChatPermissions `json:"permissions,omitempty"`
}

type MemberWarning struct {
	UserID       int64     `json:"user_id"`
	Username     string    `json:"username"`
	FirstName    string    `json:"first_name"`
	WarningCount int       `json:"warning_count"`
	Threshold    int       `json:"threshold"`
	LastReason   string    `json:"last_reason"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (s *BotService) GetGroupTelegramInfo(ctx context.Context, groupID uuid.UUID, ownerID int64) (*GroupTelegramInfo, error) {
	group, err := s.GetGroup(ctx, groupID, ownerID)
	if err != nil {
		return nil, err
	}
	bot, err := s.botRepo.GetBotByID(ctx, group.BotID)
	if err != nil || bot == nil {
		return nil, fmt.Errorf("bot not found")
	}
	token, err := DecryptToken(bot.BotTokenEncrypted)
	if err != nil || token == "" {
		return nil, fmt.Errorf("failed to decrypt bot token")
	}

	tg := telegram.NewBotAPIClient(token)
	chatRes, err := tg.GetChat(ctx, group.ChatID)
	if err != nil {
		return nil, err
	}

	info := &GroupTelegramInfo{
		HasProtectedContent:          chatRes.HasProtectedContent,
		HasHiddenMembers:             chatRes.HasHiddenMembers,
		HasAggressiveAntiSpamEnabled: chatRes.HasAggressiveAntiSpamEnabled,
		JoinToSendMessages:           chatRes.JoinToSendMessages,
		JoinByRequest:                chatRes.JoinByRequest,
		SlowModeDelay:                chatRes.SlowModeDelay,
		CanChangeInfo:                true, // Checked via bot permissions if needed
		Permissions:                  chatRes.Permissions,
	}

	// Check bot's own permissions in chat
	if member, err := tg.GetChatMemberFull(ctx, group.ChatID, bot.BotID); err == nil && member != nil {
		if member.Status == "administrator" || member.Status == "creator" {
			info.CanChangeInfo = true
		}
	}

	return info, nil
}

func (s *BotService) ListGroupWarnings(ctx context.Context, groupID uuid.UUID, ownerID int64) ([]MemberWarning, error) {
	_, err := s.GetGroup(ctx, groupID, ownerID)
	if err != nil {
		return nil, err
	}

	settings, _ := s.settingsRepo.GetSettings(ctx, groupID)
	threshold := 3
	retentionDays := 7
	if settings != nil {
		var g repository.SettingsGeneral
		if json.Unmarshal(settings.General, &g) == nil {
			if g.WarningThreshold > 0 {
				threshold = g.WarningThreshold
			}
			if g.WarningRetention > 0 {
				retentionDays = g.WarningRetention
			}
		}
	}

	// 1. Fetch warned members from group_events
	warningMap := make(map[int64]*MemberWarning)
	if s.analyticsRepo != nil {
		records, err := s.analyticsRepo.GetGroupWarnedMembers(ctx, groupID, retentionDays)
		if err == nil {
			for _, rec := range records {
				count := rec.Count
				if s.cache != nil && s.cache.Client != nil {
					warnKey := fmt.Sprintf("warn_count:%s:%d", groupID, rec.UserID)
					if val, err := s.cache.Client.Get(ctx, warnKey).Result(); err == nil {
						if c, err := strconv.Atoi(val); err == nil && c > 0 {
							count = c
						}
					}
				}
				if count > 0 {
					warningMap[rec.UserID] = &MemberWarning{
						UserID:       rec.UserID,
						Username:     fmt.Sprintf("user_%d", rec.UserID),
						FirstName:    "Member",
						WarningCount: count,
						Threshold:    threshold,
						LastReason:   rec.LastReason,
						UpdatedAt:    rec.UpdatedAt,
					}
				}
			}
		}
	}

	// 2. Also check audit logs for manual admin warnings if any
	logs, err := s.auditRepo.GetByGroup(ctx, groupID, 50, 0)
	if err == nil {
		for _, l := range logs {
			if strings.HasPrefix(l.Action, "warn") || strings.Contains(l.Action, "warning") {
				targetID := l.ActorID
				if l.TargetID != nil {
					if parsed, parseErr := strconv.ParseInt(*l.TargetID, 10, 64); parseErr == nil && parsed > 0 {
						targetID = parsed
					}
				}
				if targetID == 0 {
					continue
				}
				if _, exists := warningMap[targetID]; !exists {
					count := 1
					if s.cache != nil && s.cache.Client != nil {
						warnKey := fmt.Sprintf("warn_count:%s:%d", groupID, targetID)
						if val, err := s.cache.Client.Get(ctx, warnKey).Result(); err == nil {
							if c, err := strconv.Atoi(val); err == nil && c > 0 {
								count = c
							}
						}
					}
					warningMap[targetID] = &MemberWarning{
						UserID:       targetID,
						Username:     fmt.Sprintf("user_%d", targetID),
						FirstName:    "Member",
						WarningCount: count,
						Threshold:    threshold,
						LastReason:   "Admin warning",
						UpdatedAt:    l.CreatedAt,
					}
				}
			}
		}
	}

	list := make([]MemberWarning, 0, len(warningMap))
	for _, w := range warningMap {
		list = append(list, *w)
	}
	return list, nil
}

func (s *BotService) ResetGroupWarnings(ctx context.Context, groupID uuid.UUID, targetUserID int64, ownerID int64) error {
	group, err := s.GetGroup(ctx, groupID, ownerID)
	if err != nil {
		return err
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("warn_count:%s:%d", groupID, targetUserID))
		s.cache.Client.Del(ctx, fmt.Sprintf("warnings:%s:%d", groupID, targetUserID))
	}
	if s.analyticsRepo != nil {
		_ = s.analyticsRepo.ResetUserWarnings(ctx, groupID, targetUserID)
	}

	targetStr := fmt.Sprintf("%d", targetUserID)
	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		GroupID:    &groupID,
		ActorID:    ownerID,
		Action:     "member.warnings_reset",
		TargetType: stringPtr("user"),
		TargetID:   &targetStr,
	})

	slog.Info("Reset warnings for user in group", "group_id", group.ID, "user_id", targetUserID, "admin_id", ownerID)
	return nil
}

func (s *BotService) RestrictGroupMember(ctx context.Context, groupID uuid.UUID, targetUserID int64, ownerID int64, untilDate int64, perms telegram.ChatPermissions) error {
	group, err := s.GetGroup(ctx, groupID, ownerID)
	if err != nil {
		return err
	}
	bot, err := s.botRepo.GetBotByID(ctx, group.BotID)
	if err != nil || bot == nil {
		return fmt.Errorf("bot not found")
	}
	token, _ := DecryptToken(bot.BotTokenEncrypted)
	if token == "" {
		return fmt.Errorf("failed to decrypt bot token")
	}

	// Max 366 days in Telegram
	maxUntil := time.Now().Add(366 * 24 * time.Hour).Unix()
	if untilDate > maxUntil {
		untilDate = maxUntil
	}

	tg := telegram.NewBotAPIClient(token)
	err = tg.RestrictChatMember(ctx, group.ChatID, targetUserID, untilDate)
	if err != nil {
		return err
	}

	targetStr := fmt.Sprintf("%d", targetUserID)
	meta, _ := json.Marshal(map[string]interface{}{
		"until_date":  untilDate,
		"permissions": perms,
	})
	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		GroupID:    &groupID,
		ActorID:    ownerID,
		Action:     "member.restricted",
		TargetType: stringPtr("user"),
		TargetID:   &targetStr,
		Metadata:   meta,
	})
	return nil
}

func (s *BotService) UnbanGroupMember(ctx context.Context, groupID uuid.UUID, targetUserID int64, ownerID int64) error {
	group, err := s.GetGroup(ctx, groupID, ownerID)
	if err != nil {
		return err
	}
	bot, err := s.botRepo.GetBotByID(ctx, group.BotID)
	if err != nil || bot == nil {
		return fmt.Errorf("bot not found")
	}
	token, _ := DecryptToken(bot.BotTokenEncrypted)
	if token == "" {
		return fmt.Errorf("failed to decrypt bot token")
	}

	tg := telegram.NewBotAPIClient(token)
	_ = tg.UnbanChatMember(ctx, group.ChatID, targetUserID, false)
	_ = tg.UnrestrictChatMember(ctx, group.ChatID, targetUserID)

	targetStr := fmt.Sprintf("%d", targetUserID)
	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		GroupID:    &groupID,
		ActorID:    ownerID,
		Action:     "member.unbanned",
		TargetType: stringPtr("user"),
		TargetID:   &targetStr,
	})
	return nil
}

func stringPtr(s string) *string {
	return &s
}
