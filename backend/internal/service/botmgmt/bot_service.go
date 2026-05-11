package botmgmt

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/google/uuid"
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

func (s *BotService) GetGroup(ctx context.Context, groupID uuid.UUID) (*repository.ManagedGroup, error) {
	return s.botRepo.GetGroupByID(ctx, groupID)
}

// Settings Operations

func (s *BotService) GetSettings(ctx context.Context, groupID uuid.UUID) (*repository.GroupSettings, error) {
	return s.settingsRepo.GetSettings(ctx, groupID)
}

func (s *BotService) UpdateSettings(ctx context.Context, groupID uuid.UUID, category string, data json.RawMessage, userID int64, version int) (*repository.GroupSettings, error) {
	oldSettings, err := s.settingsRepo.GetSettings(ctx, groupID)
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

	return nil
}

// Analytics

func (s *BotService) GetAnalytics(ctx context.Context, groupID uuid.UUID, days int) (*repository.AnalyticsSummary, error) {
	return s.analyticsRepo.GetSummary(ctx, groupID, days)
}

func (s *BotService) GetGrowthTimeline(ctx context.Context, groupID uuid.UUID, days int) ([]repository.DailyMetric, error) {
	return s.analyticsRepo.GetGrowthTimeline(ctx, groupID, days)
}

func (s *BotService) GetActivityTimeline(ctx context.Context, groupID uuid.UUID, days int) ([]repository.DailyMetric, error) {
	return s.analyticsRepo.GetActivityTimeline(ctx, groupID, days)
}

// Audit

func (s *BotService) GetAuditLog(ctx context.Context, groupID uuid.UUID, limit, offset int) ([]repository.AuditLog, error) {
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

func EncryptToken(token string) ([]byte, error) {
	key := []byte(os.Getenv("BOT_TOKEN_KEY"))
	if len(key) != 32 {
		padded := make([]byte, 32)
		copy(padded, key)
		key = padded
	}

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
	key := []byte(os.Getenv("BOT_TOKEN_KEY"))
	if len(key) != 32 {
		padded := make([]byte, 32)
		copy(padded, key)
		key = padded
	}

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
