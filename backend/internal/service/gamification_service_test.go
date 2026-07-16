package service

import (
	"math"
	"testing"
)

func TestCalculateDiminishingEarnings(t *testing.T) {
	sessionCap := 5000.0 // e.g. maxEnergy (500) * multitap (10)
	baseRate := 1.0       // 1 coin/sec

	// Tier boundaries:
	// Tier 1 (100% rate): 0 to 2500 coins (takes 2500s)
	// Tier 2 (50% rate): 2500 to 3750 coins (1250 coins @ 0.5/s takes 2500s)
	// Tier 3 (25% rate): 3750 to 5000 coins (1250 coins @ 0.25/s takes 5000s)

	tests := []struct {
		name       string
		elapsedSec float64
		expected   float64
	}{
		{
			name:       "Zero elapsed time",
			elapsedSec: 0,
			expected:   0,
		},
		{
			name:       "Within Tier 1 (1000s)",
			elapsedSec: 1000,
			expected:   1000,
		},
		{
			name:       "Exact end of Tier 1 (2500s)",
			elapsedSec: 2500,
			expected:   2500,
		},
		{
			name:       "Mid Tier 2 (2500s + 1000s)",
			elapsedSec: 3500,
			expected:   2500 + (1000 * 0.5), // 3000
		},
		{
			name:       "Exact end of Tier 2 (2500s + 2500s = 5000s)",
			elapsedSec: 5000,
			expected:   3750,
		},
		{
			name:       "Mid Tier 3 (5000s + 2000s)",
			elapsedSec: 7000,
			expected:   3750 + (2000 * 0.25), // 4250
		},
		{
			name:       "Reaching full cap (5000s + 5000s = 10000s)",
			elapsedSec: 10000,
			expected:   5000,
		},
		{
			name:       "Exceeding total cap time (15000s)",
			elapsedSec: 15000,
			expected:   5000,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := calculateDiminishingEarnings(tt.elapsedSec, baseRate, sessionCap)
			if math.Abs(got-tt.expected) > 0.001 {
				t.Errorf("calculateDiminishingEarnings(%v, %v, %v) = %v; want %v",
					tt.elapsedSec, baseRate, sessionCap, got, tt.expected)
			}
		})
	}
}
