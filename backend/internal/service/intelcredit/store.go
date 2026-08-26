package intelcredit

import (
	"context"
	"fmt"
	"time"

	"ifragment-backend/internal/config"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/payment"
)

// CreditPack describes one purchasable Intel Credit bundle.
type CreditPack struct {
	ID           string `json:"id"`
	Credits      int    `json:"credits"`
	BonusCredits int    `json:"bonus_credits"`
	StarsPrice   int    `json:"stars_price"`
	Popular      bool   `json:"popular,omitempty"`
	BestValue    bool   `json:"best_value,omitempty"`
}

// TotalCredits returns base plus bonus credits carried by the pack.
func (p CreditPack) TotalCredits() int { return p.Credits + p.BonusCredits }

// StoreConfig is the public, server-authoritative pricing contract consumed by the Mini App.
// The frontend must never hardcode these values.
type StoreConfig struct {
	CreditsPerReport int          `json:"credits_per_report"`
	CoinsPerCredit   int          `json:"coins_per_credit"`
	Packs            []CreditPack `json:"packs"`
}

// Packs builds the live pack catalog strictly from environment-backed configuration.
func Packs() []CreditPack {
	return []CreditPack{
		{
			ID:         "c1",
			Credits:    1,
			StarsPrice: config.Economics.CreditPack1Stars,
			BestValue:  false,
		},
		{
			ID:           "c3p1",
			Credits:      3,
			BonusCredits: 1,
			StarsPrice:   config.Economics.CreditPack3P1Stars,
			Popular:      true,
		},
		{
			ID:           "c10p3",
			Credits:      10,
			BonusCredits: 3,
			StarsPrice:   config.Economics.CreditPack10P3Stars,
			BestValue:    true,
		},
	}
}

// FindPack resolves a pack by ID.
func FindPack(id string) (CreditPack, bool) {
	for _, p := range Packs() {
		if p.ID == id {
			return p, true
		}
	}
	return CreditPack{}, false
}

// PackCredits returns the total credits a pack grants (0 when unknown).
func PackCredits(id string) int {
	if p, ok := FindPack(id); ok {
		return p.TotalCredits()
	}
	return 0
}

// StoreService implements the credit economy: config, coin exchange and Stars checkout.
type StoreService struct {
	repo *repository.IntelCreditRepo
}

// NewStoreService builds a store service. db may be nil for config-only usage.
func NewStoreService(db *repository.Database) *StoreService {
	return &StoreService{repo: repository.NewIntelCreditRepo(db)}
}

func purchasedCreditsExpiry() *time.Time {
	exp := time.Now().Add(time.Duration(config.Economics.CreditBatchExpiryDays) * 24 * time.Hour)
	return &exp
}

// GetConfig returns the authoritative store pricing.
func (s *StoreService) GetConfig() StoreConfig {
	return StoreConfig{
		CreditsPerReport: 1,
		CoinsPerCredit:   config.Economics.CreditsCoinsPerCredit,
		Packs:            Packs(),
	}
}

// ExchangeCoins atomically converts Airdrop Coins into exactly 1 Intel Credit.
// Returns the resulting credit balance.
func (s *StoreService) ExchangeCoins(ctx context.Context, userID int64) (int, error) {
	if s.repo == nil || s.repo.DB() == nil {
		return 0, fmt.Errorf("database unavailable")
	}
	return s.repo.ExchangeCoinsForCredit(ctx, userID, float64(config.Economics.CreditsCoinsPerCredit), purchasedCreditsExpiry())
}

// CreateStarsInvoice creates the pending order and returns the Telegram Stars invoice link.
// Fulfillment happens asynchronously through the bot webhook on successful payment.
func (s *StoreService) CreateStarsInvoice(ctx context.Context, userID int64, packID string) (string, error) {
	pack, ok := FindPack(packID)
	if !ok {
		return "", fmt.Errorf("unknown credit pack: %s", packID)
	}
	db := s.repo.DB()
	if db == nil {
		return "", fmt.Errorf("database unavailable")
	}

	payload := fmt.Sprintf("intel_credits:%s:%d", pack.ID, userID)
	if _, err := db.CreateOrder(ctx, repository.Order{
		UserID:  userID,
		Amount:  pack.StarsPrice,
		Status:  "pending",
		Payload: payload,
	}); err != nil {
		return "", fmt.Errorf("failed to create credit pack order: %w", err)
	}

	stars := payment.NewStarsService(db)
	title := "iFragment Intel Credits"
	desc := fmt.Sprintf("%d Intel Credits", pack.TotalCredits())
	return stars.CreateInvoiceLink(title, desc, payload, pack.StarsPrice)
}

// FulfillStarsPurchase grants pack credits exactly once per Telegram charge ID.
// Returns false when the charge was already fulfilled (duplicate webhook delivery).
func (s *StoreService) FulfillStarsPurchase(ctx context.Context, userID int64, packID, chargeID string) (bool, error) {
	credits := PackCredits(packID)
	if credits <= 0 {
		return false, fmt.Errorf("unknown credit pack: %s", packID)
	}
	if chargeID == "" {
		chargeID = fmt.Sprintf("payload:%d:%s", userID, packID)
	}
	return s.repo.GrantPackOnce(ctx, userID, credits, "stars_pack", chargeID, purchasedCreditsExpiry())
}
