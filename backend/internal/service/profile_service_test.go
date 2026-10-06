package service

import (
	"testing"

	"ifragment-backend/internal/config"
)



// TestEconomy_ArbitrageElimination verifies economics configuration integrity.
func TestEconomy_ArbitrageElimination(t *testing.T) {
	coinsPerCredit := config.Economics.CreditsCoinsPerCredit
	if coinsPerCredit != 150000 {
		t.Fatalf("expected CreditsCoinsPerCredit to be 150000, got %d", coinsPerCredit)
	}

	coinsPerStar := config.Economics.CoinsPerStar
	if coinsPerStar <= 0 {
		t.Fatalf("expected CoinsPerStar to be positive, got %d", coinsPerStar)
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
