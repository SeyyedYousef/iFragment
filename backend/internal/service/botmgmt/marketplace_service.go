package botmgmt

import (
	"context"
	"encoding/json"
	"fmt"
	"math"

	"ifragment-backend/internal/repository"
	"github.com/jackc/pgx/v5"
)

const (
	AirdropToFRGRate = 100000.0 // 100,000 airdrop coins = 1 FRG
	FRGToUSD         = 1.0      // 1 FRG = $1
	StarsToUSD       = 0.013    // ~1 Star = $0.013
)

type MarketplaceService struct {
	frgRepo *repository.FRGRepo
}

func NewMarketplaceService(frgRepo *repository.FRGRepo) *MarketplaceService {
	return &MarketplaceService{frgRepo: frgRepo}
}

type PurchaseOption struct {
	ID          string  `json:"id"`
	Method      string  `json:"method"`
	FRGAmount   float64 `json:"frg_amount"`
	Price       float64 `json:"price"`
	Currency    string  `json:"currency"`
	Discount    string  `json:"discount,omitempty"`
	Popular     bool    `json:"popular,omitempty"`
}

func (s *MarketplaceService) GetPurchaseOptions() []PurchaseOption {
	return []PurchaseOption{
		// Stars packages
		{ID: "stars_5", Method: "stars", FRGAmount: 5, Price: 385, Currency: "XTR"},
		{ID: "stars_10", Method: "stars", FRGAmount: 10, Price: 750, Currency: "XTR", Discount: "~3%"},
		{ID: "stars_25", Method: "stars", FRGAmount: 25, Price: 1800, Currency: "XTR", Discount: "~6%", Popular: true},
		{ID: "stars_50", Method: "stars", FRGAmount: 50, Price: 3400, Currency: "XTR", Discount: "~12%"},
		// Toncoin packages
		{ID: "ton_5", Method: "toncoin", FRGAmount: 5, Price: 1.5, Currency: "TON"},
		{ID: "ton_10", Method: "toncoin", FRGAmount: 10, Price: 2.8, Currency: "TON", Discount: "~7%"},
		{ID: "ton_25", Method: "toncoin", FRGAmount: 25, Price: 6.5, Currency: "TON", Discount: "~13%", Popular: true},
		{ID: "ton_50", Method: "toncoin", FRGAmount: 50, Price: 12.0, Currency: "TON", Discount: "~20%"},
	}
}

func (s *MarketplaceService) PurchaseWithStars(ctx context.Context, userID int64, optionID string, telegramChargeID string) (*repository.FRGTransaction, error) {
	options := s.GetPurchaseOptions()
	var opt *PurchaseOption
	for _, o := range options {
		if o.ID == optionID && o.Method == "stars" {
			opt = &o
			break
		}
	}
	if opt == nil {
		return nil, fmt.Errorf("invalid purchase option: %s", optionID)
	}

	meta, _ := json.Marshal(map[string]interface{}{
		"option_id":          optionID,
		"method":             "stars",
		"stars_amount":       opt.Price,
		"telegram_charge_id": telegramChargeID,
	})

	return s.frgRepo.Credit(ctx, userID, opt.FRGAmount, "purchase_stars", meta)
}

func (s *MarketplaceService) PurchaseWithToncoin(ctx context.Context, userID int64, optionID string, txHash string) (*repository.FRGTransaction, error) {
	options := s.GetPurchaseOptions()
	var opt *PurchaseOption
	for _, o := range options {
		if o.ID == optionID && o.Method == "toncoin" {
			opt = &o
			break
		}
	}
	if opt == nil {
		return nil, fmt.Errorf("invalid purchase option: %s", optionID)
	}

	meta, _ := json.Marshal(map[string]interface{}{
		"option_id": optionID,
		"method":    "toncoin",
		"ton_amount": opt.Price,
		"tx_hash":   txHash,
	})

	return s.frgRepo.Credit(ctx, userID, opt.FRGAmount, "purchase_toncoin", meta)
}

func (s *MarketplaceService) ConvertAirdropCoins(ctx context.Context, userID int64, coins float64) (*repository.FRGTransaction, error) {
	if coins < AirdropToFRGRate {
		return nil, fmt.Errorf("minimum conversion is %.0f coins (= 1 FRG)", AirdropToFRGRate)
	}

	tx, err := s.frgRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Lock and check user_stats for airdrop_coins
	var currentCoins float64
	err = tx.QueryRow(ctx, `SELECT airdrop_coins FROM user_stats WHERE user_id = $1 FOR UPDATE`, userID).Scan(&currentCoins)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("user stats not found, no coins to convert")
	} else if err != nil {
		return nil, err
	}

	if currentCoins < coins {
		return nil, fmt.Errorf("insufficient airdrop coins: have %.0f, trying to convert %.0f", currentCoins, coins)
	}

	frgAmount := math.Floor(coins/AirdropToFRGRate*10000) / 10000 // 4 decimal precision

	// 2. Deduct coins from user_stats
	_, err = tx.Exec(ctx, `UPDATE user_stats SET airdrop_coins = airdrop_coins - $1 WHERE user_id = $2`, coins, userID)
	if err != nil {
		return nil, err
	}

	// Lock balance row
	var balanceBefore float64
	err = tx.QueryRow(ctx,
		`SELECT balance FROM frg_balances WHERE user_id = $1 FOR UPDATE`, userID,
	).Scan(&balanceBefore)
	if err == pgx.ErrNoRows {
		// Initialize balance inside transaction
		_, err = tx.Exec(ctx, `INSERT INTO frg_balances (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, userID)
		if err != nil {
			return nil, err
		}
		balanceBefore = 0
	} else if err != nil {
		return nil, err
	}

	balanceAfter := balanceBefore + frgAmount

	_, err = tx.Exec(ctx,
		`UPDATE frg_balances SET balance = $1, total_earned = total_earned + $2, updated_at = now() WHERE user_id = $3`,
		balanceAfter, frgAmount, userID,
	)
	if err != nil {
		return nil, err
	}

	meta, _ := json.Marshal(map[string]interface{}{
		"coins_converted": coins,
		"rate":            AirdropToFRGRate,
	})

	var t repository.FRGTransaction
	err = tx.QueryRow(ctx,
		`INSERT INTO frg_transactions (user_id, type, amount, balance_before, balance_after, metadata)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at`,
		userID, "airdrop_convert", frgAmount, balanceBefore, balanceAfter, meta,
	).Scan(&t.ID, &t.CreatedAt)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	t.UserID = userID
	t.Type = "airdrop_convert"
	t.Amount = frgAmount
	t.BalanceBefore = balanceBefore
	t.BalanceAfter = balanceAfter
	t.Metadata = meta

	return &t, nil
}

func (s *MarketplaceService) GetBalance(ctx context.Context, userID int64) (*repository.FRGBalance, error) {
	return s.frgRepo.GetBalance(ctx, userID)
}

func (s *MarketplaceService) GetTransactions(ctx context.Context, userID int64, limit, offset int) ([]repository.FRGTransaction, error) {
	return s.frgRepo.GetTransactions(ctx, userID, limit, offset)
}

