package gvengine

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"testing"

	"ifragment-backend/internal/service/gifts/crafting"
	"ifragment-backend/internal/service/gifts/starsrate"
	"ifragment-backend/internal/service/gifts/traits"
)

func TestGVEngine_CuriosityGate_NoLeak(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	gate, err := engine.GenerateCuriosityGate(ctx, "durov_cap-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gate.SignalsAnalyzed <= 0 {
		t.Errorf("expected positive signals analyzed, got %d", gate.SignalsAnalyzed)
	}
	if gate.DataSourcesCount <= 0 {
		t.Errorf("expected positive data sources count, got %d", gate.DataSourcesCount)
	}
	if gate.ModelName == "" {
		t.Errorf("expected model name to be populated")
	}
}

func TestGVEngine_AestheticDeltaEHarmony(t *testing.T) {
	// 1. Test Monochromatic Gold & Emerald Velvet
	goldColors := &traits.BackdropColorSet{
		CenterHex:  "#FFD700",
		EdgeHex:    "#DAA520",
		PatternHex: "#FFF8DC",
		TextHex:    "#8B6508",
	}
	resGold := traits.EvaluateAestheticHarmony("durov_cap", "Astral Gold", goldColors)
	if resGold.HarmonyClass != "MONOCHROMATIC_GOLD" {
		t.Errorf("expected MONOCHROMATIC_GOLD, got %s", resGold.HarmonyClass)
	}
	if resGold.ThemeMatchRating != "PERFECT_MATCH" {
		t.Errorf("expected PERFECT_MATCH for durov_cap with gold, got %s", resGold.ThemeMatchRating)
	}
	if resGold.BetaAesthetic < 0.25 {
		t.Errorf("expected BetaAesthetic >= 0.25, got %.2f", resGold.BetaAesthetic)
	}

	// 2. Test Emerald Velvet on Plush Pepe
	emeraldColors := &traits.BackdropColorSet{
		CenterHex:  "#006400",
		EdgeHex:    "#004d00",
		PatternHex: "#2E8B57",
		TextHex:    "#98FB98",
	}
	resEmerald := traits.EvaluateAestheticHarmony("plush_pepe", "Emerald Velvet", emeraldColors)
	if resEmerald.HarmonyClass != "EMERALD_VELVET" {
		t.Errorf("expected EMERALD_VELVET, got %s", resEmerald.HarmonyClass)
	}
	if resEmerald.ThemeMatchRating != "PERFECT_MATCH" {
		t.Errorf("expected PERFECT_MATCH for plush_pepe with emerald, got %s", resEmerald.ThemeMatchRating)
	}
}

func TestGVEngine_JointStatisticalRarity(t *testing.T) {
	// 1. Triple God-Tier Grail (Total supply 2500, Serial #1, Backdrop 5/1000, Symbol 10/1000)
	resTriple := traits.ComputeJointRarity(2500, 1, 5, 10, false)
	if resTriple.RarityClass != "TRIPLE_GOD_TIER" {
		t.Errorf("expected TRIPLE_GOD_TIER, got %s", resTriple.RarityClass)
	}
	if resTriple.BetaSynergy < 0.50 {
		t.Errorf("expected BetaSynergy >= 0.50, got %.2f", resTriple.BetaSynergy)
	}
	if resTriple.SurprisalBits < 25.0 {
		t.Errorf("expected high SurprisalBits >= 25.0, got %.2f", resTriple.SurprisalBits)
	}

	// 2. Standard Floor Item (Total supply 500,000, Serial #250,000, Backdrop 500/1000, Symbol 500/1000)
	resFloor := traits.ComputeJointRarity(500000, 250000, 500, 500, false)
	if resFloor.RarityClass != "STANDARD_FLOOR" {
		t.Errorf("expected STANDARD_FLOOR, got %s", resFloor.RarityClass)
	}
	if resFloor.BetaSynergy != 0.0 {
		t.Errorf("expected BetaSynergy == 0.0 for floor, got %.2f", resFloor.BetaSynergy)
	}
}

func TestGVEngine_StarsFloorParity(t *testing.T) {
	// Durov Cap: Base 15,000 Stars, Rate = $5.50 / GRAM
	parity := starsrate.CalculateStarsParity(15000, 5.50, 50.0)
	if parity.IntrinsicFloorGRAM <= 0 {
		t.Errorf("expected positive intrinsic floor in GRAM")
	}
	if parity.IntrinsicFloorUSD <= 0 {
		t.Errorf("expected positive intrinsic floor in USD")
	}
	// At 50 GRAM ($275 USD), but creation cost is 17,500 Stars * 0.019 = $332.5 USD (~60.45 GRAM), so secondary at 50 is an arbitrage discount!
	if !parity.ArbitrageOpportunity {
		t.Errorf("expected ArbitrageOpportunity to be true for 50 GRAM vs 60.45 GRAM intrinsic floor")
	}
}

func TestGVEngine_MonteCarloCraftingSimulation(t *testing.T) {
	res := crafting.RunMonteCarloCraftingSimulation(100.0, 150.0, 400)
	if res.TrialsCount != 5000 {
		t.Errorf("expected 5000 trials, got %d", res.TrialsCount)
	}
	if res.ExpectedNetProfitGRAM <= 0 {
		t.Errorf("expected positive expected net profit for 150 floor vs 100 cost")
	}
	if res.ProbabilityOfProfitPct <= 0 || res.ProbabilityOfProfitPct > 100 {
		t.Errorf("invalid profit probability: %.1f", res.ProbabilityOfProfitPct)
	}
	if res.KellyFractionPercent <= 0 || res.KellyFractionPercent > 50 {
		t.Errorf("invalid Kelly fraction: %.1f", res.KellyFractionPercent)
	}
}

func TestGVEngine_ValuationInvariantsAndMonotonicity(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	engine.SetNFTResolver(nil) // Deterministic isolated traits for pure monotonicity proof
	ctx := context.Background()

	models := []string{"durov_cap", "plush_pepe", "snoop_dogg", "golden_star", "cyber_heart"}

	for _, model := range models {
		// Test Serial Monotonicity: #1 must be strictly > #10 > #100 > #1000
		val1, err1 := engine.Valuate(ctx, fmt.Sprintf("%s-1", model))
		val10, err2 := engine.Valuate(ctx, fmt.Sprintf("%s-10", model))
		val100, err3 := engine.Valuate(ctx, fmt.Sprintf("%s-100", model))
		val1000, err4 := engine.Valuate(ctx, fmt.Sprintf("%s-1000", model))

		if err1 != nil || err2 != nil || err3 != nil || err4 != nil {
			t.Fatalf("valuation failed: %v", err1)
		}

		exp1, _ := val1.ExpectedGRAM.Float64()
		exp10, _ := val10.ExpectedGRAM.Float64()
		exp100, _ := val100.ExpectedGRAM.Float64()
		exp1000, _ := val1000.ExpectedGRAM.Float64()

		if exp1 <= exp10 {
			t.Errorf("monotonicity violated: #1 (%.2f) must exceed #10 (%.2f) for %s", exp1, exp10, model)
		}
		if exp10 <= exp100 {
			t.Errorf("monotonicity violated: #10 (%.2f) must exceed #100 (%.2f) for %s", exp10, exp100, model)
		}
		if exp100 <= exp1000 {
			t.Errorf("monotonicity violated: #100 (%.2f) must exceed #1000 (%.2f) for %s", exp100, exp1000, model)
		}

		// Mathematical Invariant: Low <= Expected <= High
		low1, _ := val1.LowGRAM.Float64()
		high1, _ := val1.HighGRAM.Float64()
		if low1 > exp1 || exp1 > high1 {
			t.Errorf("invariant violated: Low (%.2f) <= Expected (%.2f) <= High (%.2f) for %s #1", low1, exp1, high1, model)
		}

		// Confidence score in [0, 100]
		if val1.ConfidenceScore < 0 || val1.ConfidenceScore > 100 {
			t.Errorf("invalid confidence score: %d for %s #1", val1.ConfidenceScore, model)
		}

		// Social Profile Flex must be populated
		if val1.ProfileFlex.ProfileFlexScore <= 0 {
			t.Errorf("expected positive profile flex score for %s #1", model)
		}
		if val1.ProfileFlex.FlexTier != "SOVEREIGN_WHALE" {
			t.Errorf("expected SOVEREIGN_WHALE for %s #1, got %s", model, val1.ProfileFlex.FlexTier)
		}
	}
}

func TestGVEngine_ConcurrentRaceSafety(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()
	r := rand.New(rand.NewSource(42))

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			serial := r.Intn(1000) + 1
			_, _ = engine.Valuate(ctx, fmt.Sprintf("plush_pepe-%d", serial))
		}(i)
	}
	wg.Wait()
}
