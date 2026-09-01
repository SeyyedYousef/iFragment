package nvengine

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"testing"

	"ifragment-backend/internal/service/numbers/features"
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
		"+888 8888 8888", // Diamond
		"+888 8888 0000", // Platinum Plus
		"+888 8080 8080", // Platinum Binary
		"+888 1234 1234", // Gold Quad
		"+888 1234 5678", // Silver Ladder
		"+888 1234 4321", // Silver Palindrome
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

		// Invariant 6: Financial Rental Metrics must be populated
		if val.RentalMetrics.MonthlyRentalGrossTON <= 0 {
			t.Errorf("expected positive monthly rental TON for %s", num)
		}

		// Invariant 7: DeFi Collateral LTV must be between 50% and 65%
		if val.CollateralMetrics.MaxSafeLTVPercent < 50.0 || val.CollateralMetrics.MaxSafeLTVPercent > 65.0 {
			t.Errorf("invalid collateral LTV %.1f for %s", val.CollateralMetrics.MaxSafeLTVPercent, num)
		}
	}
}

func TestValuationEngine_Genesis7TierHierarchy(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	// 1. Tier 0: Godhead (+888 8888)
	val8888, err := engine.Valuate(ctx, "+888 8888")
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	exp8888, _ := val8888.ExpectedTON.Float64()
	if exp8888 < 300000.0 {
		t.Errorf("expected +888 8888 >= 300,000 TON, got %.2f", exp8888)
	}
	if val8888.GlobalRank != 1 {
		t.Errorf("expected +888 8888 GlobalRank == 1, got %d", val8888.GlobalRank)
	}
	if val8888.Features.Genesis.TierKey != "GENESIS_GODHEAD_8888" {
		t.Errorf("expected GENESIS_GODHEAD_8888, got %s", val8888.Features.Genesis.TierKey)
	}

	// 2. Tier 1: Anchor King (+888 8000)
	val8000, _ := engine.Valuate(ctx, "+888 8000")
	exp8000, _ := val8000.ExpectedTON.Float64()
	if exp8000 < 160000.0 {
		t.Errorf("expected +888 8000 >= 160,000 TON, got %.2f", exp8000)
	}
	if exp8000 >= exp8888 {
		t.Errorf("expected +888 8888 > +888 8000")
	}

	// 3. Tier 2: Symmetric Pair (+888 8118)
	val8118, _ := engine.Valuate(ctx, "+888 8118")
	exp8118, _ := val8118.ExpectedTON.Float64()
	if exp8118 < 120000.0 {
		t.Errorf("expected +888 8118 >= 120,000 TON, got %.2f", exp8118)
	}
	if exp8118 >= exp8000 {
		t.Errorf("expected +888 8000 > +888 8118")
	}

	// 4. Tier 3: Ladder Sequence (+888 8123)
	val8123, _ := engine.Valuate(ctx, "+888 8123")
	exp8123, _ := val8123.ExpectedTON.Float64()
	if exp8123 < 95000.0 {
		t.Errorf("expected +888 8123 >= 95,000 TON, got %.2f", exp8123)
	}

	// 5. Tier 5: Single Offset (+888 8001)
	val8001, _ := engine.Valuate(ctx, "+888 8001")
	exp8001, _ := val8001.ExpectedTON.Float64()
	if exp8001 < 80000.0 {
		t.Errorf("expected +888 8001 >= 80,000 TON, got %.2f", exp8001)
	}
}

func TestValuationEngine_VIPTaxonomyAndDialPad(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	// 1. Diamond Monodigit
	valDiamond, _ := engine.Valuate(ctx, "+888 8888 8888")
	if valDiamond.Features.VIP.Tier != features.TierDiamond {
		t.Errorf("expected TierDiamond for 88888888, got %s", valDiamond.Features.VIP.Tier)
	}
	if valDiamond.Features.DialPad.FingerTravelDistance != 0.0 {
		t.Errorf("expected FingerTravelDistance 0.0 for 88888888, got %.2f", valDiamond.Features.DialPad.FingerTravelDistance)
	}

	// 2. Platinum Plus Block
	valPlatPlus, _ := engine.Valuate(ctx, "+888 8888 0000")
	if valPlatPlus.Features.VIP.Tier != features.TierPlatinumPlus {
		t.Errorf("expected TierPlatinumPlus for 88880000, got %s", valPlatPlus.Features.VIP.Tier)
	}

	// 3. Platinum Binary Alternating
	valPlat, _ := engine.Valuate(ctx, "+888 8080 8080")
	if valPlat.Features.VIP.Tier != features.TierPlatinum {
		t.Errorf("expected TierPlatinum for 80808080, got %s", valPlat.Features.VIP.Tier)
	}
	if !valPlat.Features.BinaryVanity {
		t.Errorf("expected BinaryVanity to be true for 80808080")
	}

	// 4. Grand Ascending Ladder
	valLadder, _ := engine.Valuate(ctx, "+888 1234 5678")
	if valLadder.Features.VIP.Tier != features.TierSilver {
		t.Errorf("expected TierSilver for ladder, got %s", valLadder.Features.VIP.Tier)
	}
	if !valLadder.Features.DialPad.IsRowPattern {
		t.Errorf("expected IsRowPattern to be true for 12345678")
	}
}

func TestValuationEngine_FinancialMetricsCalculation(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	val, err := engine.Valuate(ctx, "+888 8888 0000")
	if err != nil {
		t.Fatalf("valuation failed: %v", err)
	}

	exp, _ := val.ExpectedTON.Float64()

	// Rental Yield tests
	if val.RentalMetrics.MonthlyRentalGrossTON <= 0 {
		t.Errorf("expected positive monthly rental TON")
	}
	if val.RentalMetrics.MonthlyRentalGrossUSD <= 0 {
		t.Errorf("expected positive monthly rental USD")
	}
	if val.RentalMetrics.YieldPaybackYears <= 0 || val.RentalMetrics.YieldPaybackYears > 30 {
		t.Errorf("unexpected payback years: %.1f", val.RentalMetrics.YieldPaybackYears)
	}

	// DeFi Collateral tests
	if val.CollateralMetrics.MaxLoanAmountTON <= 0 || val.CollateralMetrics.MaxLoanAmountTON > exp {
		t.Errorf("invalid max loan amount TON: %.2f (expected: %.2f)", val.CollateralMetrics.MaxLoanAmountTON, exp)
	}
	if val.CollateralMetrics.LiquidationThresholdTON <= val.CollateralMetrics.MaxLoanAmountTON {
		t.Errorf("liquidation threshold must exceed max loan amount")
	}

	// Liquidity Survival tests
	if val.SurvivalMetrics.Probability30DaysPercent <= 0 || val.SurvivalMetrics.Probability30DaysPercent > 100 {
		t.Errorf("invalid 30d probability: %.1f", val.SurvivalMetrics.Probability30DaysPercent)
	}
	if val.SurvivalMetrics.EstimatedDaysToLiquidate <= 0 {
		t.Errorf("invalid estimated days to liquidate: %d", val.SurvivalMetrics.EstimatedDaysToLiquidate)
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
