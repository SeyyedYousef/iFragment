package service

import (
	"testing"
)

func TestLevelCalculation(t *testing.T) {
	// Formula: Level N requires base * N^1.5 or similar curve
	calcLevel := func(coins int64) int {
		if coins < 1000 {
			return 1
		}
		if coins < 5000 {
			return 2
		}
		if coins < 20000 {
			return 3
		}
		return 4
	}

	tests := []struct {
		coins    int64
		expected int
	}{
		{0, 1},
		{500, 1},
		{1000, 2},
		{4999, 2},
		{5000, 3},
		{25000, 4},
	}

	for _, tt := range tests {
		got := calcLevel(tt.coins)
		if got != tt.expected {
			t.Errorf("calcLevel(%d) = %d; want %d", tt.coins, got, tt.expected)
		}
	}
}

func TestTapValidation(t *testing.T) {
	validateTapCount := func(count int, elapsedMs int64) bool {
		if count <= 0 || elapsedMs <= 0 {
			return false
		}
		// Max allowed tap rate: 20 taps per second (1 tap per 50ms)
		maxAllowed := (elapsedMs / 50) + 5 // +5 tolerance
		return int64(count) <= maxAllowed
	}

	if !validateTapCount(10, 1000) {
		t.Errorf("expected 10 taps in 1000ms to be valid")
	}
	if validateTapCount(100, 1000) {
		t.Errorf("expected 100 taps in 1000ms to be rejected (bot tapping)")
	}
}
