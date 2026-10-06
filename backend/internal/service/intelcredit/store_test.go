package intelcredit

import (
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

func TestStoreService_GetConfig(t *testing.T) {
	svc := &StoreService{repo: nil}
	cfg := svc.GetConfig()
	if cfg.CreditsPerReport != 1 {
		t.Errorf("expected CreditsPerReport = 1, got %d", cfg.CreditsPerReport)
	}
	if len(cfg.Packs) == 0 {
		t.Errorf("expected non-empty packs in store config")
	}
}
