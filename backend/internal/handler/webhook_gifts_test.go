package handler

import (
	"strings"
	"testing"
	"time"

	"github.com/shopspring/decimal"

	"ifragment-backend/internal/service/gifts/gvengine"
	"ifragment-backend/internal/service/gifts/traits"
)

func TestGiftLinkRegex(t *testing.T) {
	testCases := []struct {
		input       string
		expectedRef string
		shouldMatch bool
	}{
		{"https://t.me/nft/CelestialStar-1", "CelestialStar-1", true},
		{"http://t.me/nft/DurovsBlackCap-42", "DurovsBlackCap-42", true},
		{"t.me/nft/PlushPepe-100", "PlushPepe-100", true},
		{"https://fragment.com/gift/CelestialStar-99", "CelestialStar-99", true},
		{"Check this out: fragment.com/gift/plush_pepe-10", "plush_pepe-10", true},
		{"https://example.com/not-a-gift", "", false},
		{"hello world", "", false},
	}

	for _, tc := range testCases {
		t.Run(tc.input, func(t *testing.T) {
			matches := giftLinkRegex.FindStringSubmatch(tc.input)
			if tc.shouldMatch {
				if len(matches) < 2 {
					t.Fatalf("expected match for %s, got none", tc.input)
				}
				if matches[1] != tc.expectedRef {
					t.Fatalf("expected ref %s, got %s", tc.expectedRef, matches[1])
				}
			} else {
				if len(matches) >= 2 {
					t.Fatalf("expected no match for %s, got %s", tc.input, matches[1])
				}
			}
		})
	}
}

func TestFormatNumberWithCommas(t *testing.T) {
	tests := []struct {
		num      int
		expected string
	}{
		{0, "0"},
		{9, "9"},
		{99, "99"},
		{999, "999"},
		{1000, "1,000"},
		{12345, "12,345"},
		{1234567, "1,234,567"},
	}

	for _, tt := range tests {
		got := formatNumberWithCommas(tt.num)
		if got != tt.expected {
			t.Errorf("formatNumberWithCommas(%d) = %s; want %s", tt.num, got, tt.expected)
		}
	}
}

func TestFormatGiftAppraisalMessage(t *testing.T) {
	h := &WebhookHandler{}

	val := &gvengine.GiftValuation{
		GiftID:       "celestial_star-1",
		ModelID:      "celestial_star",
		ModelName:    "Celestial Star",
		DisplayTitle: "Celestial Star #1",
		SerialNumber: 1,
		OwnerName:    "UQTestOwnerWallet12345",
		ExpectedUSD:  271200.0,
		Pillars: gvengine.ValuationPillars{
			FairValueGRAM:        45200.0,
			FairValueUSD:         271200.0,
			ObservedFloorGRAM:    41500.0,
			LiquidationValueGRAM: 36160.0,
			SuggestedAskGRAM:     49720.0,
		},
		TraitDNA: []gvengine.TraitDNABar{
			{
				AxisKey:    "model",
				LabelFa:    "مدل سه‌بعدی",
				Value:      "Celestial Star",
				Percentile: 0.12,
				RarityTier: "Legendary",
			},
			{
				AxisKey:    "backdrop",
				LabelFa:    "پس‌زمینه",
				Value:      "Cosmic Violet",
				Percentile: 0.05,
				RarityTier: "Mythic",
				Colors: &traits.BackdropColorSet{
					CenterHex:  "#2E0854",
					EdgeHex:    "#0B0014",
					PatternHex: "#9B51E0",
					TextHex:    "#FFFFFF",
				},
			},
			{
				AxisKey:    "symbol",
				LabelFa:    "نماد پترن",
				Value:      "Starburst",
				Percentile: 0.34,
				RarityTier: "Rare",
			},
		},
		BasePriceGRAM: decimal.NewFromFloat(41500.0),
		EvaluatedAt:   time.Now(),
	}

	miniAppURL := "https://t.me/iFragmentBot/iFragment"
	msgText, markup := h.formatGiftAppraisalMessage(val, miniAppURL)

	// Verify text contains critical elements
	if !strings.Contains(msgText, "Celestial Star #1") {
		t.Errorf("expected msgText to contain title, got: %s", msgText)
	}
	if !strings.Contains(msgText, "45200.00 TON") {
		t.Errorf("expected msgText to contain fair value TON, got: %s", msgText)
	}
	if !strings.Contains(msgText, "UQTestOwnerWallet12345") {
		t.Errorf("expected msgText to contain owner name, got: %s", msgText)
	}
	if !strings.Contains(msgText, "God Tier #1") {
		t.Errorf("expected msgText to contain serial tier for #1, got: %s", msgText)
	}
	if !strings.Contains(msgText, "مدل سه‌بعدی") || !strings.Contains(msgText, "Cosmic Violet") {
		t.Errorf("expected msgText to contain trait DNA, got: %s", msgText)
	}

	// Verify inline keyboard markup
	kb, ok := markup["inline_keyboard"].([][]map[string]interface{})
	if !ok || len(kb) < 2 {
		t.Fatalf("expected inline keyboard with at least 2 rows, got: %v", markup)
	}

	firstBtn := kb[0][0]
	if !strings.Contains(firstBtn["url"].(string), "startapp=gift_celestial_star-1") {
		t.Errorf("expected mini app deep link in button, got: %v", firstBtn)
	}

	secondBtn := kb[1][0]
	if !strings.Contains(secondBtn["url"].(string), "fragment.com/gift/CelestialStar-1") {
		t.Errorf("expected fragment link in button, got: %v", secondBtn)
	}
}
