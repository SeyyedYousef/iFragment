package nvengine

import (
	"context"
	"fmt"
	"math/rand"
	"testing"
)

func TestValuationEngine_CuriosityGate_NoLeak(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	rawNum := "+888 8888 8888"
	gate, err := engine.GenerateCuriosityGate(ctx, rawNum)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gate.SignalsAnalyzed <= 0 {
		t.Errorf("expected positive signals analyzed, got %d", gate.SignalsAnalyzed)
	}
	if gate.DataSourcesCount != 4 {
		t.Errorf("expected 4 data sources, got %d", gate.DataSourcesCount)
	}
}

func TestValuationEngine_ValuationInvariants(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()
	r := rand.New(rand.NewSource(99))

	testNumbers := []string{
		"+888 8888 8888", // ATH
		"+888 0123 4567", // Sequential
		"+888 1234 4321", // Palindrome
		"+888 0000 0001", // Quad Zero
	}

	// Add 50 randomized numbers
	for i := 0; i < 50; i++ {
		testNumbers = append(testNumbers, fmt.Sprintf("+888%08d", r.Intn(100000000)))
	}

	for _, num := range testNumbers {
		val, err := engine.Valuate(ctx, num)
		if err != nil {
			t.Fatalf("valuation failed for %s: %v", num, err)
		}

		low, _ := val.LowTON.Float64()
		exp, _ := val.ExpectedTON.Float64()
		high, _ := val.HighTON.Float64()

		// Invariant 1: Low <= Expected <= High
		if low > exp || exp > high {
			t.Errorf("invariant violated: Low (%.2f) <= Expected (%.2f) <= High (%.2f) failed for %s", low, exp, high, num)
		}

		// Invariant 2: Confidence score in [0, 100]
		if val.ConfidenceScore < 0 || val.ConfidenceScore > 100 {
			t.Errorf("invalid confidence score: %d for %s", val.ConfidenceScore, num)
		}

		// Invariant 3: Net payout must be less than Expected TON (due to 5% fee)
		if val.Economics.NetPayoutTON > exp {
			t.Errorf("net payout %.2f cannot exceed expected TON %.2f for %s", val.Economics.NetPayoutTON, exp, num)
		}

		// Invariant 4: Rarity DNA must contain at least 5 bars
		if len(val.RarityDNA) < 5 {
			t.Errorf("insufficient rarity DNA bars: %d for %s", len(val.RarityDNA), num)
		}

		// Invariant 5: Cultural radar must have all 3 regions
		if len(val.CulturalRadar) != 3 {
			t.Errorf("cultural radar must contain 3 regions, got %d for %s", len(val.CulturalRadar), num)
		}
	}
}
