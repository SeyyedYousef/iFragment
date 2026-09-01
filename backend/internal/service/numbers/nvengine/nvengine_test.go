package nvengine

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
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
	if gate.DataSourcesCount <= 0 {
		t.Errorf("expected positive data sources count, got %d", gate.DataSourcesCount)
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

func TestValuationEngine_Genesis4DigitValuation(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	// 1. Test +888 8001 (Genesis 4-digit number with leading 8)
	val8001, err := engine.Valuate(ctx, "+888 8001")
	if err != nil {
		t.Fatalf("valuation failed for +888 8001: %v", err)
	}

	exp8001, _ := val8001.ExpectedTON.Float64()
	if exp8001 < 100000.0 {
		t.Errorf("expected +888 8001 valuation to be >= 100,000 TON, got %.2f TON", exp8001)
	}
	if val8001.GlobalRank > 1000 {
		t.Errorf("expected genesis number to be ranked <= 1000, got %d", val8001.GlobalRank)
	}
	if !val8001.Features.IsGenesis4Digit {
		t.Errorf("expected IsGenesis4Digit to be true for +888 8001")
	}
	if val8001.Features.EffectiveMaxRun < 4 {
		t.Errorf("expected EffectiveMaxRun >= 4 for +888 8001 (prefix 888 + leading 8), got %d", val8001.Features.EffectiveMaxRun)
	}

	// 2. Test +888 8888 (Genesis holy grail ATH)
	val8888, err := engine.Valuate(ctx, "+888 8888")
	if err != nil {
		t.Fatalf("valuation failed for +888 8888: %v", err)
	}
	exp8888, _ := val8888.ExpectedTON.Float64()
	if exp8888 < 300000.0 {
		t.Errorf("expected +888 8888 valuation to be >= 300,000 TON, got %.2f TON", exp8888)
	}
	if val8888.GlobalRank != 1 {
		t.Errorf("expected +888 8888 GlobalRank to be 1, got %d", val8888.GlobalRank)
	}
}

func TestValuationEngine_ConcurrentRaceSafety(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			num := fmt.Sprintf("+888%08d", 80000000+idx)
			_, _ = engine.Valuate(ctx, num)
			_ = engine.getCachedHistograms(ctx)
		}(i)
	}
	wg.Wait()
}
