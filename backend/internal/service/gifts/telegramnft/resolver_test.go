package telegramnft

import (
	"testing"
)

func TestFormatPascalName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"plush_pepe", "PlushPepe"},
		{"durov_cap", "DurovsBlackCap"},
		{"santa_hat", "SantaHat"},
		{"golden_star", "CelestialStar"},
	}

	for _, tt := range tests {
		got := FormatPascalName(tt.input)
		if got != tt.expected {
			t.Errorf("FormatPascalName(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}
