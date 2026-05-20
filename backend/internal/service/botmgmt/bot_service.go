package botmgmt

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
)

type SubscriptionPackage struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	GroupsLimit int     `json:"groups_limit"`
	PriceFRG    float64 `json:"price_frg"`
	Discount    string  `json:"discount,omitempty"`
}

var Packages = []SubscriptionPackage{
	{ID: "starter", Name: "Starter", GroupsLimit: 1, PriceFRG: 1.5, Discount: ""},
	{ID: "basic", Name: "Basic", GroupsLimit: 3, PriceFRG: 3.0, Discount: "~33%"},
	{ID: "pro", Name: "Pro", GroupsLimit: 5, PriceFRG: 5.0, Discount: "~33%"},
	{ID: "business", Name: "Business", GroupsLimit: 10, PriceFRG: 8.0, Discount: "~47%"},
}

type BotService struct {
	botRepo       *repository.BotRepo
	settingsRepo  *repository.SettingsRepo
	auditRepo     *repository.AuditRepo
	frgRepo       *repository.FRGRepo
	analyticsRepo *repository.AnalyticsRepo
}

func NewBotService(
	botRepo *repository.BotRepo,
	settingsRepo *repository.SettingsRepo,
	auditRepo *repository.AuditRepo,
	frgRepo *repository.FRGRepo,
	analyticsRepo *repository.AnalyticsRepo,
) *BotService {
	return &BotService{
		botRepo:       botRepo,
		settingsRepo:  settingsRepo,
		auditRepo:     auditRepo,
		frgRepo:       frgRepo,
		analyticsRepo: analyticsRepo,
	}
}

func (s *BotService) StartBackgroundTasks(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.CheckExpirations(ctx)
			}
		}
	}()
}

func (s *BotService) CheckExpirations(ctx context.Context) {
	groups, err := s.botRepo.GetAllActiveGroups(ctx)
	if err != nil {
		return
	}

	now := time.Now()
	for _, g := range groups {
		var expiry *time.Time
		if g.SubscriptionStatus == "trial" {
			expiry = &g.TrialEndsAt
		} else if g.SubscriptionStatus == "paid" && g.PaidUntil != nil {
			expiry = g.PaidUntil
		}

		if expiry == nil {
			continue
		}

		// 1. Check for actual expiration
		if now.After(*expiry) {
			_ = s.botRepo.UpdateGroupSubscription(ctx, g.ID, "expired", nil)
			s.sendExpirationNotice(ctx, g, "service_ended", map[string]interface{}{"group": g.ChatTitle})
			continue
		}

		// 2. Check for alerts (3 days and 1 day before)
		daysLeft := int(expiry.Sub(now).Hours() / 24)
		if daysLeft == 3 || daysLeft == 1 {
			// Simple check if notice already sent (could use a dedicated table or redis)
			// For now, we'll just send it if it's the right time window
			if time.Now().Hour() == 10 { // Only send at 10 AM
				template := "expiry_3d"
				if daysLeft == 1 {
					template = "expiry_24h"
				}
				s.sendExpirationNotice(ctx, g, template, map[string]interface{}{"group": g.ChatTitle})
			}
		}
	}
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
	
	// Send to group
	_ = tg.SendMessage(g.ChatID, msg, nil, nil)
	// Send to owner PV
	_ = tg.SendMessage(bot.OwnerUserID, msg, nil, nil)
}

// Bot Operations

func (s *BotService) RegisterBot(ctx context.Context, ownerID int64, token, username, name string, botID int64) (*repository.ManagedBot, error) {
	encrypted, err := EncryptToken(token)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt token: %w", err)
	}

	bot := &repository.ManagedBot{
		OwnerUserID:       ownerID,
		BotTokenEncrypted: encrypted,
		BotUsername:        username,
		BotName:           name,
		BotID:             botID,
		Status:            "active",
	}

	if err := s.botRepo.CreateBot(ctx, bot); err != nil {
		return nil, err
	}

	return bot, nil
}

func (s *BotService) ListBots(ctx context.Context, ownerID int64) ([]repository.ManagedBot, error) {
	return s.botRepo.GetBotsByOwner(ctx, ownerID)
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
	return s.botRepo.UpdateBotStatus(ctx, bot.ID, "revoked")
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

// Settings Operations

func (s *BotService) GetSettings(ctx context.Context, groupID uuid.UUID, ownerID int64) (*repository.GroupSettings, error) {
	if _, err := s.GetGroup(ctx, groupID, ownerID); err != nil {
		return nil, err
	}
	return s.settingsRepo.GetSettings(ctx, groupID)
}

func (s *BotService) UpdateSettings(ctx context.Context, groupID uuid.UUID, category string, data json.RawMessage, userID int64, version int) (*repository.GroupSettings, error) {
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
		GroupID:  groupID,
		ActorID:  userID,
		Action:   "settings.update." + category,
		OldValue: oldVal,
		NewValue: data,
	})

	return newSettings, nil
}

// Subscription Operations

func (s *BotService) GetPackages() []SubscriptionPackage {
	return Packages
}

func (s *BotService) Subscribe(ctx context.Context, userID int64, groupID uuid.UUID, packageID string) error {
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

	meta, _ := json.Marshal(map[string]interface{}{
		"package": packageID,
		"group_id": groupID.String(),
	})

	_, err := s.frgRepo.Debit(ctx, userID, pkg.PriceFRG, "subscription_payment", meta)
	if err != nil {
		return fmt.Errorf("payment failed: %w", err)
	}

	paidUntil := time.Now().Add(30 * 24 * time.Hour)
	if err := s.botRepo.UpdateGroupSubscription(ctx, groupID, "paid", &paidUntil); err != nil {
		// Refund on failure
		_, _ = s.frgRepo.Credit(ctx, userID, pkg.PriceFRG, "refund", meta)
		return fmt.Errorf("failed to activate subscription: %w", err)
	}

	// Trigger tiered lifetime referral commissions (10% Tier 1, 3% Tier 2)
	go s.frgRepo.DB().CreditReferrerShare(context.Background(), userID, pkg.PriceFRG, s.frgRepo)

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

// FRG Balance

func (s *BotService) GetFRGBalance(ctx context.Context, userID int64) (*repository.FRGBalance, error) {
	return s.frgRepo.GetBalance(ctx, userID)
}

func (s *BotService) GetFRGTransactions(ctx context.Context, userID int64, limit, offset int) ([]repository.FRGTransaction, error) {
	return s.frgRepo.GetTransactions(ctx, userID, limit, offset)
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
			log.Println("⚠️ CRITICAL: BOT_TOKEN_KEY is not set. Token encryption/decryption will fail.")
			keyStr = "default_fallback_key_32_chars_!!!" // Still needs 32 chars
		}
		key := []byte(keyStr)
		if len(key) != 32 {
			padded := make([]byte, 32)
			copy(padded, key)
			key = padded
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
