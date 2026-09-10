package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"ifragment-backend/internal/config"
	"ifragment-backend/internal/service/botmgmt"
)

// TestAddTaps_SecurityValidation tests nonce length and timestamp freshness rules.
func TestAddTaps_SecurityValidation(t *testing.T) {
	svc := &ProfileService{}
	ctx := context.Background()

	// 1. Missing or short nonce
	_, err := svc.AddTaps(ctx, 12345, 10, 1, "short", time.Now().Unix())
	if err == nil || !strings.Contains(err.Error(), "invalid_nonce") {
		t.Fatalf("expected invalid_nonce error for short nonce, got: %v", err)
	}

	_, err = svc.AddTaps(ctx, 12345, 10, 1, "", time.Now().Unix())
	if err == nil || !strings.Contains(err.Error(), "invalid_nonce") {
		t.Fatalf("expected invalid_nonce error for empty nonce, got: %v", err)
	}

	validNonce := "abcdef1234567890abcdef"

	// 2. Zero or negative timestamp
	_, err = svc.AddTaps(ctx, 12345, 10, 1, validNonce, 0)
	if err == nil || !strings.Contains(err.Error(), "invalid_timestamp") {
		t.Fatalf("expected invalid_timestamp error for 0 timestamp, got: %v", err)
	}

	// 3. Stale timestamp (skew > 30s)
	oldTS := time.Now().Add(-45 * time.Second).Unix()
	_, err = svc.AddTaps(ctx, 12345, 10, 1, validNonce, oldTS)
	if err == nil || !strings.Contains(err.Error(), "clock_skew") {
		t.Fatalf("expected clock_skew error for >30s past timestamp, got: %v", err)
	}

	// 4. Future timestamp (skew > 30s)
	futureTS := time.Now().Add(45 * time.Second).Unix()
	_, err = svc.AddTaps(ctx, 12345, 10, 1, validNonce, futureTS)
	if err == nil || !strings.Contains(err.Error(), "clock_skew") {
		t.Fatalf("expected clock_skew error for >30s future timestamp, got: %v", err)
	}
}

// TestDailyRewards_Alignment verifies that Day 1 to Day 7 rewards are strictly synchronized
// with the frontend definition: [500, 1000, 2500, 5000, 10000, 15000, 25000].
func TestDailyRewards_Alignment(t *testing.T) {
	expectedRewards := map[int]float64{
		1: 500,
		2: 1000,
		3: 2500,
		4: 5000,
		5: 10000,
		6: 15000,
		7: 25000,
	}

	for day, expected := range expectedRewards {
		r, exists := dailyRewards[day]
		if !exists {
			t.Fatalf("missing daily reward config for day %d", day)
		}
		if r.Frg != expected {
			t.Errorf("day %d: expected %f coins, got %f", day, expected, r.Frg)
		}
	}
}

// TestEconomy_ArbitrageElimination proves mathematically that the 200,000 Coin arbitrage is solved.
// With 1 Credit = 150,000 Coins:
// 1 Month Channel/Group subscription:
// Direct Coin cost: 350,000 Coins
// Indirect Credit cost: 3 Credits * 150,000 Coins = 450,000 Coins.
// Converting Coins to Credits no longer bypasses the 350,000 Coin direct price!
func TestEconomy_ArbitrageElimination(t *testing.T) {
	coinsPerCredit := config.Economics.CreditsCoinsPerCredit
	if coinsPerCredit != 150000 {
		t.Fatalf("expected CreditsCoinsPerCredit to be 150000, got %d", coinsPerCredit)
	}

	pkg1Month := botmgmt.Packages[0]
	if pkg1Month.ID != "1_month" {
		t.Fatalf("expected first package to be 1_month, got %s", pkg1Month.ID)
	}

	directCoinPrice := pkg1Month.PriceCoins                                        // 350,000
	indirectCoinCostViaCredits := float64(pkg1Month.PriceCredits * coinsPerCredit) // 3 * 150,000 = 450,000

	if indirectCoinCostViaCredits < directCoinPrice {
		t.Errorf("ARBITRAGE DETECTED: indirect cost via credits (%f) is lower than direct price (%f)",
			indirectCoinCostViaCredits, directCoinPrice)
	}
}

// TestCalculateRequiredCoinsForDiscount verifies discount deduction calculation using CoinsPerStar.
func TestCalculateRequiredCoinsForDiscount(t *testing.T) {
	baseStars := 150
	discountPercent := 50 // 50% off -> savedStars = 75

	savedStars, requiredCoins := config.CalculateRequiredCoinsForDiscount(baseStars, discountPercent)
	if savedStars != 75 {
		t.Errorf("expected 75 saved stars, got %d", savedStars)
	}

	expectedCoins := float64(75 * config.Economics.CoinsPerStar)
	if requiredCoins != expectedCoins {
		t.Errorf("expected %f required coins, got %f", expectedCoins, requiredCoins)
	}
}
