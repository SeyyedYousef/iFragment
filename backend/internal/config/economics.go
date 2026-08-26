package config

import (
	"os"
	"strconv"
	"time"
)

// EconomicsConfig encapsulates all financial exchange rates, quotas, and pricing constants
// across the iFragment ecosystem. Every literal is configurable via environment variables
// with mathematically verified production defaults.
type EconomicsConfig struct {
	// CoinsPerStar defines the exchange rate of Airdrop Coins per 1 Telegram Star saved via discount.
	// Formula: requiredCoins = savedStars * CoinsPerStar
	// Default: 1032
	CoinsPerStar int

	// ProValuationStars is the base price in Telegram Stars for a 30-day Pro Valuation pass.
	// Default: 249 Stars
	ProValuationStars int

	// ProValuationDuration is the validity duration granted by a Pro Valuation pass.
	// Default: 30 days
	ProValuationDuration time.Duration

	// SingleValuationDuration is the validity duration for a single username valuation unlock.
	// Default: 24 hours
	SingleValuationDuration time.Duration

	// DailyProValuationQuota is the daily cap of deep AI valuations for Pro users.
	// Default: 3 per day
	DailyProValuationQuota int

	// ReportPriceStars is the price in Telegram Stars for unlocking an official full report.
	// Default: 100 Stars
	ReportPriceStars int

	// CreditsPer100Stars is the number of valuation credits granted for every 100 Stars package.
	// Default: 3 credits
	CreditsPer100Stars int

	// CreditsCoinsPerCredit is the Airdrop Coins cost to exchange for exactly 1 Intel Credit.
	// Intentionally expensive to keep direct Stars purchase the attractive path.
	// Default: 50000 coins
	CreditsCoinsPerCredit int

	// CreditPack1Stars is the Stars price of a single Intel Credit.
	// Default: 100 Stars
	CreditPack1Stars int

	// CreditPack3P1Stars is the Stars price of the 3+1 bonus credit pack (4 credits total).
	// Default: 250 Stars
	CreditPack3P1Stars int

	// CreditPack10P3Stars is the Stars price of the 10+3 bonus credit pack (13 credits total).
	// Default: 800 Stars
	CreditPack10P3Stars int

	// CreditBatchExpiryDays is the validity window granted to purchased credit batches.
	// Default: 90 days
	CreditBatchExpiryDays int
}

var Economics = loadEconomics()

func loadEconomics() EconomicsConfig {
	return EconomicsConfig{
		CoinsPerStar:            getEnvInt("COINS_PER_STAR", 1032),
		ProValuationStars:       getEnvInt("PRO_VALUATION_STARS", 249),
		ProValuationDuration:    time.Duration(getEnvInt("PRO_VALUATION_DAYS", 30)) * 24 * time.Hour,
		SingleValuationDuration: time.Duration(getEnvInt("SINGLE_VALUATION_HOURS", 24)) * time.Hour,
		DailyProValuationQuota:  getEnvInt("DAILY_PRO_VALUATION_QUOTA", 3),
		ReportPriceStars:        getEnvInt("REPORT_PRICE_STARS", 100),
		CreditsPer100Stars:      getEnvInt("CREDITS_PER_100_STARS", 3),
		CreditsCoinsPerCredit:   getEnvInt("COINS_PER_CREDIT", 50000),
		CreditPack1Stars:        getEnvInt("CREDIT_PACK_1_STARS", 100),
		CreditPack3P1Stars:      getEnvInt("CREDIT_PACK_3P1_STARS", 250),
		CreditPack10P3Stars:     getEnvInt("CREDIT_PACK_10P3_STARS", 800),
		CreditBatchExpiryDays:   getEnvInt("CREDIT_BATCH_EXPIRY_DAYS", 90),
	}
}

// CalculateRequiredCoinsForDiscount calculates how many Airdrop Coins must be deducted
// when a user applies a discount percentage on a Stars invoice.
//
// Formula:
//
//	savedStars = (baseStars * discountPercent) / 100
//	requiredCoins = savedStars * CoinsPerStar
func CalculateRequiredCoinsForDiscount(baseStars int, discountPercent int) (savedStars int, requiredCoins float64) {
	if discountPercent <= 0 || baseStars <= 0 {
		return 0, 0
	}
	if discountPercent > 100 {
		discountPercent = 100
	}
	savedStars = (baseStars * discountPercent) / 100
	requiredCoins = float64(savedStars * Economics.CoinsPerStar)
	return savedStars, requiredCoins
}

func getEnvInt(key string, fallback int) int {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return n
}
