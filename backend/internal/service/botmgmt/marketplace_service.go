package botmgmt

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
	"strings"

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

func (s *MarketplaceService) getBotAPIClient(ctx context.Context) (*telegram.BotAPIClient, error) {
	// Try first from DB
	var encryptedToken []byte
	err := s.frgRepo.DB().Pool.QueryRow(ctx, "SELECT bot_token_encrypted FROM managed_bots WHERE status = 'active' LIMIT 1").Scan(&encryptedToken)
	if err == nil && len(encryptedToken) > 0 {
		token, err := DecryptToken(encryptedToken)
		if err == nil {
			return telegram.NewBotAPIClient(token), nil
		}
	}

	// Try from env variable
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token != "" {
		return telegram.NewBotAPIClient(token), nil
	}

	return nil, fmt.Errorf("no active telegram bot client found or configured")
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

	if telegramChargeID == "" {
		return nil, fmt.Errorf("empty telegram charge id")
	}

	// 1. Idempotency Check in Database
	exists, err := s.frgRepo.TransactionExistsByChargeID(ctx, telegramChargeID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("charge already processed")
	}

	// 2. Verification with Telegram getStarTransactions API
	isProd := os.Getenv("APP_ENV") == "production"
	if isProd {
		tg, err := s.getBotAPIClient(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to load telegram bot client for verification: %w", err)
		}
		
		txs, err := tg.GetStarTransactions(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve star transactions: %w", err)
		}
		
		var verifiedTx *telegram.StarTransaction
		for _, tx := range txs.Transactions {
			if tx.ID == telegramChargeID {
				verifiedTx = &tx
				break
			}
		}
		
		if verifiedTx == nil {
			return nil, fmt.Errorf("stars payment charge %s not found on Telegram", telegramChargeID)
		}
		
		if verifiedTx.Source.User == nil || verifiedTx.Source.User.ID != userID {
			return nil, fmt.Errorf("stars payment user mismatch")
		}
		
		expectedAmount := int(opt.Price)
		if verifiedTx.Amount != expectedAmount {
			return nil, fmt.Errorf("stars payment amount mismatch: expected %d, got %d", expectedAmount, verifiedTx.Amount)
		}
	}

	// 3. Credit inside transaction with idempotency
	meta, _ := json.Marshal(map[string]interface{}{
		"option_id":          optionID,
		"method":             "stars",
		"stars_amount":       opt.Price,
		"telegram_charge_id": telegramChargeID,
	})

	return s.frgRepo.CreditWithIdempotency(ctx, userID, opt.FRGAmount, "purchase_stars", meta, telegramChargeID)
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

	if txHash == "" {
		return nil, fmt.Errorf("tx_hash is required")
	}

	// 1. Verification with TON Blockchain via TonAPI (only if not local/development)
	isProd := os.Getenv("APP_ENV") == "production"
	if isProd {
		tonClient := tonapi.NewClient()
		txInfo, err := tonClient.GetTransaction(ctx, txHash)
		if err != nil {
			return nil, fmt.Errorf("failed to verify Toncoin transaction: %w", err)
		}
		if txInfo == nil {
			return nil, fmt.Errorf("Toncoin transaction %s not found on blockchain", txHash)
		}
		if !txInfo.Success {
			return nil, fmt.Errorf("Toncoin transaction was not successful")
		}
		if txInfo.InMsg == nil {
			return nil, fmt.Errorf("invalid Toncoin transaction: missing in_msg")
		}

		expectedNanotons := int64(math.Round(opt.Price * 1e9))
		if txInfo.InMsg.Value < expectedNanotons {
			return nil, fmt.Errorf("Toncoin payment amount mismatch: expected %d nanotons, got %d", expectedNanotons, txInfo.InMsg.Value)
		}

		recipientWallet := os.Getenv("TON_RECIPIENT_WALLET")
		if recipientWallet != "" && txInfo.InMsg.Destination != nil {
			destAddr := txInfo.InMsg.Destination.Address
			if !strings.EqualFold(destAddr, recipientWallet) {
				return nil, fmt.Errorf("Toncoin payment recipient mismatch: expected %s, got %s", recipientWallet, destAddr)
			}
		}
	}

	// 2. Credit inside transaction with idempotency
	meta, _ := json.Marshal(map[string]interface{}{
		"option_id":  optionID,
		"method":     "toncoin",
		"ton_amount": opt.Price,
		"tx_hash":    txHash,
	})

	return s.frgRepo.CreditWithToncoinIdempotency(ctx, userID, opt.FRGAmount, "purchase_toncoin", meta, txHash)
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

