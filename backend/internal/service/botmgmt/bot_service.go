package botmgmt

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"crypto/sha256"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/crypto"
)

type SubscriptionPackage struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	DurationMonths int     `json:"duration_months"`
	PriceUSD       float64 `json:"price_usd"`
	PricePerMonth  float64 `json:"price_per_month"`
	PriceStars     int     `json:"price_stars"`
	PriceCoins     float64 `json:"price_coins"`
	GroupsLimit    int     `json:"groups_limit"`
	PriceFRG       float64 `json:"price_frg"`
	Discount       string  `json:"discount,omitempty"`
	Badge          string  `json:"badge,omitempty"`
}

var Packages = []SubscriptionPackage{
	{ID: "1_month", Name: "1 Month", DurationMonths: 1, PriceUSD: 1.99, PricePerMonth: 1.99, PriceStars: 150, PriceCoins: 350000, GroupsLimit: 1, PriceFRG: 1.99, Discount: "", Badge: ""},
	{ID: "3_months", Name: "3 Months", DurationMonths: 3, PriceUSD: 4.49, PricePerMonth: 1.49, PriceStars: 350, PriceCoins: 900000, GroupsLimit: 1, PriceFRG: 4.49, Discount: "25%", Badge: "popular"},
	{ID: "6_months", Name: "6 Months", DurationMonths: 6, PriceUSD: 7.49, PricePerMonth: 1.29, PriceStars: 575, PriceCoins: 1500000, GroupsLimit: 1, PriceFRG: 7.49, Discount: "35%", Badge: ""},
	{ID: "12_months", Name: "12 Months", DurationMonths: 12, PriceUSD: 11.99, PricePerMonth: 1.00, PriceStars: 925, PriceCoins: 2500000, GroupsLimit: 1, PriceFRG: 11.99, Discount: "50%", Badge: "best_value"},
}

type BotService struct {
	botRepo              *repository.BotRepo
	settingsRepo         *repository.SettingsRepo
	auditRepo            *repository.AuditRepo
	analyticsRepo        *repository.AnalyticsRepo
	lastNotificationDate string               // format: YYYY-MM-DD
	qhNotifications      map[string]time.Time // key: groupID:action:HH:MM, val: time
	lastBioUpdate        sync.Map             // map[uuid.UUID]time.Time
	cryptoService        *crypto.CryptoService
	mu                   sync.Mutex
}

func NewBotService(
	botRepo *repository.BotRepo,
	settingsRepo *repository.SettingsRepo,
	auditRepo *repository.AuditRepo,
	analyticsRepo *repository.AnalyticsRepo,
) *BotService {
	return &BotService{
		botRepo:       botRepo,
		settingsRepo:  settingsRepo,
		auditRepo:     auditRepo,
		analyticsRepo: analyticsRepo,
		cryptoService: crypto.NewCryptoService(),
	}
}

func (s *BotService) StartBackgroundTasks(ctx context.Context) {
	expiryTicker := time.NewTicker(10 * time.Minute)
	qhTicker := time.NewTicker(1 * time.Minute)
	go func() {
		defer expiryTicker.Stop()
		defer qhTicker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-expiryTicker.C:
				s.CheckExpirations(ctx)
			case <-qhTicker.C:
				s.CheckQuietHoursTransitions(ctx)
			}
		}
	}()

	// Start group dynamic bio worker
	go s.dynamicBioWorker(ctx)
}

func (s *BotService) CheckExpirations(ctx context.Context) {
	groups, err := s.botRepo.GetAllActiveGroups(ctx)
	if err != nil {
		return
	}

	now := time.Now()

	// Determine if we should process 10 AM alerts today
	shouldAlert := false
	todayStr := now.Format("2006-01-02")
	if now.Hour() == 10 {
		s.mu.Lock()
		if s.lastNotificationDate != todayStr {
			shouldAlert = true
			s.lastNotificationDate = todayStr
		}
		s.mu.Unlock()
	}

	const maxConcurrency = 15
	sem := make(chan struct{}, maxConcurrency)
	var wg sync.WaitGroup

	for _, g := range groups {
		sem <- struct{}{}
		wg.Add(1)
		go func(g repository.ManagedGroup) {
			defer wg.Done()
			defer func() { <-sem }()

			groupCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
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
				s.sendExpirationNotice(groupCtx, g, "service_ended", map[string]interface{}{"group": g.ChatTitle})
				return
			}

			// 2. Auto-leave if expired for > 7 days
			if g.SubscriptionStatus == "expired" && now.After(expiry.Add(7*24*time.Hour)) {
				bot, err := s.botRepo.GetBotByID(groupCtx, g.BotID)
				if err == nil {
					token, decErr := DecryptToken(bot.BotTokenEncrypted)
					if decErr == nil {
						tg := telegram.NewBotAPIClient(token)
						_ = tg.LeaveChat(groupCtx, g.ChatID)
						
						lang := i18n.DetectLanguage("")
						msg := i18n.T(lang, "notifications.group_auto_left", map[string]interface{}{"group": g.ChatTitle})
						_ = tg.SendMessage(groupCtx, bot.OwnerUserID, msg, nil, nil)
					}
				}
				_ = s.botRepo.DeleteGroup(groupCtx, g.ID)
				return
			}

			if g.SubscriptionStatus == "expired" {
				return
			}

			// 2. Check for alerts (3 days and 1 day before)
			if shouldAlert {
				targetDate := time.Date(expiry.Year(), expiry.Month(), expiry.Day(), 0, 0, 0, 0, expiry.Location())
				nowDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
				daysLeft := int(targetDate.Sub(nowDate).Hours() / 24)
				if daysLeft == 3 || daysLeft == 1 {
					template := "expiry_3d"
					if daysLeft == 1 {
						template = "expiry_24h"
					}
					s.sendExpirationNotice(groupCtx, g, template, map[string]interface{}{"group": g.ChatTitle})
				}
			}
		}(g)
	}
	wg.Wait()
}

func (s *BotService) sendExpirationNotice(ctx context.Context, g repository.ManagedGroup, template string, vars map[string]interface{}) {
	bot, err := s.botRepo.GetBotByID(ctx, g.BotID)
	if err != nil {
		return
	}

	// Get Language
	lang := "en"
	settings, _ := s.settingsRepo.GetSettings(ctx, g.ID)
	if settings != nil {
		var general repository.SettingsGeneral
		if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
			lang = general.Language
		}
	}

	token, _ := DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)

	msg := i18n.T(lang, "notifications."+template, vars)

	// Send to owner PV ONLY
	_ = tg.SendMessage(ctx, bot.OwnerUserID, msg, nil, nil)
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
	if _, err := s.GetBot(ctx, botID, ownerID); err != nil {
		return nil, err
	}
	groups, err := s.botRepo.GetGroupsByBot(ctx, botID)
	if err != nil {
		return nil, err
	}

	// Check trial expirations
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
	}

	return groups, nil
}

func (s *BotService) GetGroup(ctx context.Context, groupID uuid.UUID, ownerID int64) (*repository.ManagedGroup, error) {
	group, err := s.botRepo.GetGroupByID(ctx, groupID)
	if err != nil {
		return nil, err
	}
	if _, err := s.GetBot(ctx, group.BotID, ownerID); err != nil {
		return nil, err
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

func (s *BotService) GetSettings(ctx context.Context, groupID uuid.UUID, ownerID int64) (*repository.GroupSettings, error) {
	group, err := s.GetGroup(ctx, groupID, ownerID)
	if err != nil {
		return nil, err
	}
	settings, err := s.settingsRepo.GetSettings(ctx, groupID)
	if err != nil {
		return nil, err
	}

	// Dynamically inject live Telegram Group info
	bot, err := s.botRepo.GetBotByID(ctx, group.BotID)
	if err == nil && bot != nil {
		token, decErr := DecryptToken(bot.BotTokenEncrypted)
		if decErr == nil && token != "" {
			tg := telegram.NewBotAPIClient(token)
			chatRes, tgErr := tg.GetChat(ctx, group.ChatID)
			if tgErr == nil && chatRes != nil {
				var genMap map[string]interface{}
				if err := json.Unmarshal(settings.General, &genMap); err == nil {
					genMap["name"] = chatRes.Title
					if chatRes.Description != "" {
						genMap["description"] = chatRes.Description
					}
					if chatRes.Username != nil {
						genMap["username"] = *chatRes.Username
					}

					// Try to fetch photo URL
					photoURL, pErr := tg.GetChatPhotoURL(ctx, group.ChatID)
					if pErr == nil && photoURL != "" {
						genMap["photo"] = photoURL
					} else if pErr == nil && photoURL == "" {
						genMap["photo"] = "" // explicit empty if no photo
					}

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

func (s *BotService) ActivateSubscriptionFromStars(ctx context.Context, userID int64, groupID uuid.UUID, packageID string) error {
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

	// Lock and check user_stats for airdrop_coins
	var currentCoins float64
	err = tx.QueryRow(ctx, `SELECT airdrop_coins FROM user_stats WHERE user_id = $1 FOR UPDATE`, userID).Scan(&currentCoins)
	if err != nil {
		return fmt.Errorf("failed to get user airdrop coins: %w", err)
	}

	if currentCoins < requiredCoins {
		return fmt.Errorf("insufficient airdrop coins: need %.0f, have %.0f", requiredCoins, currentCoins)
	}

	// Deduct coins
	_, err = tx.Exec(ctx, `UPDATE user_stats SET airdrop_coins = airdrop_coins - $1 WHERE user_id = $2`, requiredCoins, userID)
	if err != nil {
		return fmt.Errorf("failed to deduct airdrop coins: %w", err)
	}

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
	s.notifyOwnerOnSubscription(context.Background(), botUsername, group.ChatTitle, pkg.Name, "Airdrop Coins", userID)

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
				hash := sha256.Sum256([]byte(jwtSecret))
				cryptoKey = hash[:]
				return
			}
			if os.Getenv("APP_ENV") != "production" {
				keyStr = "dev_bot_token_key_32_characters_"
			} else {
				panic("CRITICAL: BOT_TOKEN_KEY and JWT_SECRET environment variables are not set")
			}
		}
		key := []byte(keyStr)
		if len(key) != 32 {
			if os.Getenv("APP_ENV") != "production" {
				// Pad or truncate to 32 bytes for dev
				temp := make([]byte, 32)
				copy(temp, key)
				key = temp
			} else {
				panic("CRITICAL: BOT_TOKEN_KEY must be exactly 32 bytes/characters long")
			}
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
	if msg == "" {
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
	if bot.OwnerUserID != userID {
		return fmt.Errorf("unauthorized: not bot owner")
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
	paidUntil := base.Add(30 * 24 * time.Hour)

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
	if bot.OwnerUserID != userID {
		return fmt.Errorf("unauthorized: not bot owner")
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

	var currentCoins float64
	err = tx.QueryRow(ctx, `SELECT airdrop_coins FROM user_stats WHERE user_id = $1 FOR UPDATE`, userID).Scan(&currentCoins)
	if err != nil {
		return fmt.Errorf("failed to get user airdrop coins: %w", err)
	}

	if currentCoins < requiredCoins {
		return fmt.Errorf("insufficient airdrop coins: need %.0f, have %.0f", requiredCoins, currentCoins)
	}

	_, err = tx.Exec(ctx, `UPDATE user_stats SET airdrop_coins = airdrop_coins - $1 WHERE user_id = $2`, requiredCoins, userID)
	if err != nil {
		return fmt.Errorf("failed to deduct airdrop coins: %w", err)
	}

	if err := s.internalActivateChannelSubscriptionTx(ctx, tx, userID, channelID, packageID, ch, pkg); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit subscription transaction: %w", err)
	}

	s.notifyOwnerOnSubscription(context.Background(), bot.BotUsername, ch.ChatTitle, pkg.Name, "Airdrop Coins (Channel)", userID)

	go func() {
		
		
	}()

	return nil
}

func (s *BotService) ActivateChannelSubscriptionFromStars(ctx context.Context, userID int64, channelID uuid.UUID, packageID string) error {
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

	if err := s.internalActivateChannelSubscriptionTx(ctx, tx, userID, channelID, packageID, ch, pkg); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	s.notifyOwnerOnSubscription(context.Background(), bot.BotUsername, ch.ChatTitle, pkg.Name, "Telegram Stars (Channel)", userID)

	go func() {
		
		
	}()

	return nil
}
