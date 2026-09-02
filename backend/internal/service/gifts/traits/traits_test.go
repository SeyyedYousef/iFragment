package traits

import (
	"testing"
)

func TestCanonicalCollections120(t *testing.T) {
	// Must contain official 120 upgradable Telegram gifts
	if len(CanonicalCollections) != 120 {
		t.Fatalf("expected 120 canonical collections, got %d", len(CanonicalCollections))
	}

	// Verify iconic sovereign pioneer gifts exist
	iconicKeys := []string{
		"plush_pepe",
		"durov_cap",
		"precious_peach",
		"signet_ring",
		"santa_hat",
		"snoop_dogg",
		"astral_shard",
		"swiss_watch",
	}

	for _, k := range iconicKeys {
		col, ok := ResolveCollection(k)
		if !ok || col.ModelID != k {
			t.Errorf("expected canonical collection %s to resolve correctly", k)
		}
		if col.TotalSupply <= 0 {
			t.Errorf("expected collection %s to have positive total supply", k)
		}
	}

	// Verify invented/fake gifts are NOT present in canonical catalog
	inventedKeys := []string{
		"cyber_heart",
		"phoenix_feather",
		"crypto_whale",
		"genesis_scroll",
		"golden_star",
		"golden_piggy",
	}

	for _, k := range inventedKeys {
		if _, ok := CanonicalCollections[k]; ok {
			t.Errorf("invented gift %s should NOT exist in CanonicalCollections", k)
		}
	}
}

func TestResolveCollectionNormalization(t *testing.T) {
	// Kebab-case, uppercase, spaces should all resolve canonical item
	tests := []struct {
		input       string
		expectedID  string
		shouldExist bool
	}{
		{"plush-pepe", "plush_pepe", true},
		{"Plush Pepe", "plush_pepe", true},
		{"DUROV_CAP", "durov_cap", true},
		{"Durov's Cap", "durov_cap", true},
		{"santa-hat", "santa_hat", true},
		{"non_existent_fake_xyz_123", "", false},
	}

	for _, tt := range tests {
		col, ok := ResolveCollection(tt.input)
		if ok != tt.shouldExist {
			t.Errorf("ResolveCollection(%q) exists = %v, expected %v", tt.input, ok, tt.shouldExist)
		}
		if tt.shouldExist && col.ModelID != tt.expectedID {
			t.Errorf("ResolveCollection(%q) ModelID = %s, expected %s", tt.input, col.ModelID, tt.expectedID)
		}
	}
}

func TestClassifyRarityTier6Levels(t *testing.T) {
	tests := []struct {
		percentile   float64
		expectedTier string
	}{
		{0.05, "Mythic"},
		{0.10, "Mythic"},
		{0.30, "Legendary"},
		{0.50, "Legendary"},
		{1.20, "Epic"},
		{2.00, "Epic"},
		{3.50, "Rare"},
		{5.00, "Rare"},
		{10.0, "Uncommon"},
		{15.0, "Uncommon"},
		{20.0, "Common"},
		{55.0, "Common"},
	}

	for _, tt := range tests {
		tier := ClassifyRarityTier(tt.percentile)
		if tier != tt.expectedTier {
			t.Errorf("ClassifyRarityTier(%.2f) = %s, expected %s", tt.percentile, tier, tt.expectedTier)
		}
	}
}

func TestCalculateSerialPercentileAndElite(t *testing.T) {
	// Test Serial #1 out of 1500 (Plush Pepe)
	pct, isElite, text := CalculateSerialPercentile(1, 1500)
	if !isElite {
		t.Errorf("Serial #1 must be elite")
	}
	if pct != (1.0/1500.0)*100.0 {
		t.Errorf("expected exact percentile %.4f, got %.4f", (1.0/1500.0)*100.0, pct)
	}
	if text == "" {
		t.Errorf("rankText should not be empty")
	}

	// Test special numbers (77, 777, 888, 121 palindrome)
	if !IsEliteSerial(7) {
		t.Errorf("Serial 7 should be elite")
	}
	if !IsEliteSerial(77) {
		t.Errorf("Serial 77 should be elite")
	}
	if !IsEliteSerial(777) {
		t.Errorf("Serial 777 should be elite")
	}
	if !IsEliteSerial(121) {
		t.Errorf("Palindrome 121 should be elite")
	}
	if IsEliteSerial(482) {
		t.Errorf("Random serial 482 should not be elite")
	}
}
