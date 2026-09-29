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
