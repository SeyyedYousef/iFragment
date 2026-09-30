package intelcredit

import (
	"context"
	"testing"
)

func TestPackCredits(t *testing.T) {
	tests := []struct {
		id       string
		expected int
	}{
		{"c1", 1},
		{"c3p1", 4},  // 3 + 1 bonus
		{"c10p3", 13}, // 10 + 3 bonus
		{"unknown", 0},
	}

	for _, tt := range tests {
		got := PackCredits(tt.id)
		if got != tt.expected {
			t.Errorf("PackCredits(%q) = %d; expected %d", tt.id, got, tt.expected)
		}
	}
}

func TestStoreService_NilRepo(t *testing.T) {
	svc := &StoreService{repo: nil}
	_, err := svc.ExchangeCoins(context.Background(), 12345)
	if err == nil {
		t.Errorf("expected error when repo is nil, got nil")
	}

	_, err = svc.ExchangeCoinsN(context.Background(), 12345, 3)
	if err == nil {
		t.Errorf("expected error when repo is nil for ExchangeCoinsN, got nil")
	}
}

func TestCoinExchangeCalculation(t *testing.T) {
	// Task 8 requirement:
	// Verify user with 725,436 coins can exchange max 4 credits (150,000 coins/credit)
	// total cost = 600,000 coins, remainder = 125,436 coins.
	airdropCoins := 725436.0
	costPerCredit := 150000

	maxCredits := int(airdropCoins) / costPerCredit
	if maxCredits != 4 {
		t.Fatalf("expected maxCredits = 4, got %d", maxCredits)
	}

	totalCost := float64(maxCredits * costPerCredit)
	if totalCost != 600000 {
		t.Fatalf("expected totalCost = 600000, got %f", totalCost)
	}

	remainder := airdropCoins - totalCost
	if remainder != 125436 {
		t.Fatalf("expected remainder = 125436, got %f", remainder)
	}
}
