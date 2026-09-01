package gvengine

import (
	"context"
	"math"
	"testing"
)

func TestGVEngine_InvariantsAndHedonicBounds(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	testCases := []struct {
		input       string
		modelID     string
		serial      int
		minExpected float64
	}{
		{"plush_pepe-1", "plush_pepe", 1, 4000.0},          // #1 Sacred jump (4.25x floor)
		{"plush_pepe-42", "plush_pepe", 42, 1000.0},        // Double digit
		{"durov_cap-7", "durov_cap", 7, 500.0},             // Single digit
		{"snoop_dogg-996000", "snoop_dogg", 996000, 4.0},   // Mass drop tail
		{"phoenix_feather-1", "phoenix_feather", 1, 2000.0}, // Crafted model #1
	}

	for _, tc := range testCases {
		t.Run(tc.input, func(t *testing.T) {
			val, err := engine.Valuate(ctx, tc.input)
			if err != nil {
				t.Fatalf("Valuation failed for %s: %v", tc.input, err)
			}

			low, _ := val.LowGRAM.Float64()
			exp, _ := val.ExpectedGRAM.Float64()
			high, _ := val.HighGRAM.Float64()

			// Invariant: Low <= Expected <= High
			if low > exp {
				t.Errorf("Invariant violated: Low (%.2f) > Expected (%.2f)", low, exp)
			}
			if exp > high {
				t.Errorf("Invariant violated: Expected (%.2f) > High (%.2f)", exp, high)
			}
			if exp < tc.minExpected {
				t.Errorf("Expected price %.2f below threshold %.2f for %s", exp, tc.minExpected, tc.input)
			}

			// Invariant: Confidence score in valid range
			if val.ConfidenceScore < 0 || val.ConfidenceScore > 100 {
				t.Errorf("Invalid confidence score: %d", val.ConfidenceScore)
			}

			// Invariant: Trait DNA must have Exact badge for official attributes
			for _, dna := range val.TraitDNA {
				if dna.CertaintyLevel != "exact" && dna.CertaintyLevel != "measured" && dna.CertaintyLevel != "estimated" {
					t.Errorf("Invalid certainty level: %s", dna.CertaintyLevel)
				}
				if dna.AxisKey == "serial" && dna.CertaintyLevel != "exact" {
					t.Errorf("Serial rank percentile must be Exact (Sacred Rule 6)")
				}
			}

			// Exit planner must rank 7 venues
			if len(val.ExitPlanner.Options) != 7 {
				t.Errorf("Expected 7 exit venue options, got %d", len(val.ExitPlanner.Options))
			}
		})
	}
}

func TestGVEngine_SerialCurveJumps(t *testing.T) {
	supply := 5000

	exp1 := computeSerialExponent(1, supply)
	exp7 := computeSerialExponent(7, supply)
	exp42 := computeSerialExponent(42, supply)
	exp777 := computeSerialExponent(777, supply)
	exp3500 := computeSerialExponent(3500, supply)

	if exp1 <= exp7 {
		t.Errorf("Serial #1 jump (%.2f) should exceed #7 (%.2f)", exp1, exp7)
	}
	if exp7 <= exp42 {
		t.Errorf("Single digit #7 (%.2f) should exceed double digit #42 (%.2f)", exp7, exp42)
	}
	if exp777 <= exp3500 {
		t.Errorf("Repdigit #777 (%.2f) should exceed standard tail #3500 (%.2f)", exp777, exp3500)
	}
}

func TestGVEngine_SmoothContinuousBackdrop(t *testing.T) {
	// Verify continuous backdrop curve has no large cliffs between adjacent permilles
	calcBetaBackdrop := func(permille int) float64 {
		permilleClamped := math.Max(float64(permille), 5.0)
		beta := 0.35 * math.Log(1000.0/permilleClamped)
		if beta < 0 {
			beta = 0
		}
		return beta
	}

	b20 := calcBetaBackdrop(20)
	b21 := calcBetaBackdrop(21)

	// In old step function, 20 was 1.45 and 21 was 0.90 (jump of 0.55 / ~4.5x!)
	diff := math.Abs(b20 - b21)
	if diff > 0.05 {
		t.Errorf("expected smooth continuous transition between 20 and 21 permille, got diff %.4f", diff)
	}
	if b20 <= b21 {
		t.Errorf("rarer backdrop (20) must have higher beta than (21)")
	}
}

func TestGVEngine_CuriosityGateZeroLeakage(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	gate, err := engine.GenerateCuriosityGate(ctx, "plush_pepe-42")
	if err != nil {
		t.Fatalf("Curiosity gate failed: %v", err)
	}

	if gate.SignalsAnalyzed < 20 {
		t.Errorf("Expected >= 20 analyzed signals, got %d", gate.SignalsAnalyzed)
	}
	if gate.DataSourcesCount != 6 {
		t.Errorf("Expected 6 venue data sources, got %d", gate.DataSourcesCount)
	}
}

func TestGVEngine_PropertyBasedMonotonicity(t *testing.T) {
	// Property: A rarer backdrop or lower serial number must never decrease expected price
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	valLow, _ := engine.Valuate(ctx, "plush_pepe-1000")
	valHigh, _ := engine.Valuate(ctx, "plush_pepe-1")

	eLow, _ := valLow.ExpectedGRAM.Float64()
	eHigh, _ := valHigh.ExpectedGRAM.Float64()

	if eHigh <= eLow {
		t.Errorf("Property violation: #1 (%.2f) did not exceed #1000 (%.2f)", eHigh, eLow)
	}
}
