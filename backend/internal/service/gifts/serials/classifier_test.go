package serials

import (
	"testing"
)

func TestClassifySerial(t *testing.T) {
	baseFloor := 100.0

	tests := []struct {
		name         string
		serial       int
		expectedCat  Category
		minMult      float64
	}{
		{"Genesis #1", 1, CategorySingleDigit, 30.0},
		{"Lucky #7", 7, CategorySingleDigit, 20.0},
		{"Two Digit #42", 42, CategoryTwoDigit, 4.0},
		{"Two Digit #69", 69, CategoryTwoDigit, 7.0},
		{"Repeating #777", 777, CategoryRepDigit, 10.0},
		{"Repeating #888", 888, CategoryRepDigit, 9.0},
		{"Repeating #1111", 1111, CategoryRepDigit, 6.0},
		{"Palindrome #1221", 1221, CategoryPalindrome, 2.5},
		{"Palindrome #5005", 5005, CategoryPalindrome, 2.5},
		{"Round #1000", 1000, CategoryRoundNumber, 2.0},
		{"Round #500", 500, CategoryRoundNumber, 1.8},
		{"Early Mint #150", 150, CategoryEarlyMint, 1.4},
		{"Standard #8247", 8247, CategoryStandard, 1.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := ClassifySerial(tt.serial, baseFloor)
			if res.Category != tt.expectedCat {
				t.Errorf("Expected category %s, got %s for serial %d", tt.expectedCat, res.Category, tt.serial)
			}
			if res.Multiplier < tt.minMult {
				t.Errorf("Expected multiplier >= %.1f, got %.1f for serial %d", tt.minMult, res.Multiplier, tt.serial)
			}
			if res.EstimatedFloor < baseFloor*res.Multiplier*0.99 {
				t.Errorf("Estimated floor mismatch: got %.2f, expected around %.2f", res.EstimatedFloor, baseFloor*res.Multiplier)
			}
		})
	}
}
