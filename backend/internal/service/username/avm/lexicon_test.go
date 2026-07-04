package avm

import (
	"testing"
)

func TestAnalyzeFlow(t *testing.T) {
	tests := []struct {
		word     string
		minScore float64
		maxScore float64
	}{
		// Pronounceable words should have decent flow
		{"apple", 0.5, 1.0},
		{"google", 0.5, 1.0},
		{"rare", 0.5, 1.0},
		// Keyboard smashes should have low flow
		{"ajfklsdj", 0.0, 0.55},
		{"qwrtyp", 0.0, 0.6},
		// Brandable suffix
		{"shopify", 0.6, 1.0},
	}

	for _, tc := range tests {
		score := AnalyzeFlow(tc.word)
		if score < tc.minScore || score > tc.maxScore {
			t.Errorf("AnalyzeFlow(%q) = %v; want between %v and %v", tc.word, score, tc.minScore, tc.maxScore)
		}
	}
}

func TestIsPalindrome(t *testing.T) {
	tests := []struct {
		word string
		want bool
	}{
		{"radar", true},
		{"racecar", true},
		{"hello", false},
		{"ab", false}, // Too short
		{"Aba", true},
		{"12321", true},
	}

	for _, tc := range tests {
		got := IsPalindrome(tc.word)
		if got != tc.want {
			t.Errorf("IsPalindrome(%q) = %v; want %v", tc.word, got, tc.want)
		}
	}
}

func TestIsKeyboardPattern(t *testing.T) {
	tests := []struct {
		word string
		want bool
	}{
		{"qwertyuiop", true},
		{"asdfg", true},
		{"hello", false},
		{"123456", true},
	}

	for _, tc := range tests {
		got := IsKeyboardPattern(tc.word)
		if got != tc.want {
			t.Errorf("IsKeyboardPattern(%q) = %v; want %v", tc.word, got, tc.want)
		}
	}
}
