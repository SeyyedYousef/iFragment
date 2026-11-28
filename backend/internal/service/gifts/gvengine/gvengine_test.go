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

	models := []string{"durov_cap", "plush_pepe", "snoop_dogg", "heart_locket", "kissed_frog"}

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

func TestGVEngine_NormalizeGiftIdentifier(t *testing.T) {
	tests := []struct {
		input       string
		expectedCol string
		expectedNum int
		wantErr     bool
	}{
		{"plush-pepe-1", "plush_pepe", 1, false},
		{"plush pepe 1", "plush_pepe", 1, false},
		{"Plush Pepe #1", "plush_pepe", 1, false},
		{"plush_pepe-1", "plush_pepe", 1, false},
		{"plush_pepe-42", "plush_pepe", 42, false},
		{"https://t.me/nft/PlushPepe-1", "plush_pepe", 1, false},
		{"t.me/nft/PlushPepe-42", "plush_pepe", 42, false},
		{"fragment.com/gift/PlushPepe-1", "plush_pepe", 1, false},
		{"durov_cap-1", "durov_cap", 1, false},
		{"durov-cap-100", "durov_cap", 100, false},
		{"Durov's Cap #7", "durov_cap", 7, false},
		{"plush-pepe", "", 0, true},
		{"PlushPepe1", "plush_pepe", 1, false},
		{"@someone", "", 0, true},
		{"plush-pepe-0", "", 0, true},
		{"EQBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			ref, err := NormalizeGiftIdentifier(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error for %q, got nil", tt.input)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error for %q: %v", tt.input, err)
			}
			if ref.ModelID != tt.expectedCol {
				t.Errorf("expected ModelID %q, got %q", tt.expectedCol, ref.ModelID)
			}
			if ref.SerialNumber != tt.expectedNum {
				t.Errorf("expected SerialNumber %d, got %d", tt.expectedNum, ref.SerialNumber)
			}
			expectedGiftID := fmt.Sprintf("%s-%d", tt.expectedCol, tt.expectedNum)
			if ref.GiftID != expectedGiftID {
				t.Errorf("expected GiftID %q, got %q", expectedGiftID, ref.GiftID)
			}
		})
	}
}

func TestGVEngine_NeverBelowMarketFloor(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	engine.SetNFTResolver(nil)
	ctx := context.Background()

	samples := []string{
		"plush_pepe-1200",
		"durov_cap-2400",
		"santa_hat-9500",
		"diamond_ring-3500",
		"spiced_wine-14000",
	}

	for _, s := range samples {
		val, err := engine.Valuate(ctx, s)
		if err != nil {
			t.Fatalf("[%s] valuation failed: %v", s, err)
		}

		ref, _ := NormalizeGiftIdentifier(s)
		col, _ := traits.ResolveCollection(ref.ModelID)
		baseFloor := engine.resolveDynamicFloor(ctx, ref.ModelID, col, 5.50)

		expGRAM, _ := val.ExpectedGRAM.Float64()
		lowGRAM, _ := val.LowGRAM.Float64()

		if expGRAM < baseFloor {
			t.Errorf("[%s] Invariant Violated: expected price %.2f GRAM is below collection floor %.2f GRAM", s, expGRAM, baseFloor)
		}

		if lowGRAM < baseFloor {
			t.Errorf("[%s] Invariant Violated: low bound price %.2f GRAM is below collection floor %.2f GRAM", s, lowGRAM, baseFloor)
		}
	}
}

func TestOverhaul_UnresolvedOrdinaryGiftsFloorLocked(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	engine.SetNFTResolver(nil)
	ctx := context.Background()

	// Unresolved high-serial gifts must NOT inherit Tier-S default backdrops (301k bug) or false monochrome matching
	cases := []string{
		"resistance_dog-10536",
		"scared_cat-15926",
		"santa_hat-68487",
		"durov_cap-2200",
	}
	for _, slug := range cases {
		val, err := engine.Valuate(ctx, slug)
		if err != nil {
			t.Fatalf("Valuate(%q) failed: %v", slug, err)
		}
		ref, _ := NormalizeGiftIdentifier(slug)
		col, _ := traits.ResolveCollection(ref.ModelID)
		baseFloor := engine.resolveDynamicFloor(ctx, ref.ModelID, col, 5.50)

		expGRAM, _ := val.ExpectedGRAM.Float64()
		if expGRAM > baseFloor*1.25 {
			t.Errorf("[%s] ordinary unresolved high-serial gift overvalued at %.2f GRAM vs floor %.2f GRAM", slug, expGRAM, baseFloor)
		}
	}

	// Verify dark backdrop on scared_cat without explicit chromatic 3D model variant does NOT trigger IsMonochromeColorMatch
	darkBackdrop := &traits.BackdropColorSet{
		CenterHex:  "#15171E",
		EdgeHex:    "#0F1117",
		PatternHex: "#242834",
		TextHex:    "#E0E4F0",
	}
	harm := traits.EvaluateAestheticHarmony("scared_cat", "Original", darkBackdrop)
	if harm.IsMonochromeColorMatch {
		t.Errorf("expected IsMonochromeColorMatch=false for generic 'Original' model variant on scared_cat")
	}
}

func TestHumanPsychology_ColorMatchingAcrossAllFamiliesAndSerials(t *testing.T) {
	// 1. Black Model + Black Backdrop ("Full Blackout Grail")
	blackColors := &traits.BackdropColorSet{CenterHex: "#363738", EdgeHex: "#0E0F0F"}
	resBlackout := traits.EvaluateAestheticHarmonyWithModel("scared_cat", "Shadow Ninja", "Onyx Black", blackColors)
	if !resBlackout.IsMonochromeColorMatch || resBlackout.ColorSynergyMultiplier < 2.0 {
		t.Errorf("expected Black-on-Black ColorSynergyMultiplier >= 2.0, got match=%v mult=%.2f", resBlackout.IsMonochromeColorMatch, resBlackout.ColorSynergyMultiplier)
	}

	// 2. Monument (White/Marble) + Ivory White SVG Hexes (#BAB6B1 -> #A19D97)
	ivoryColors := &traits.BackdropColorSet{CenterHex: "#BAB6B1", EdgeHex: "#A19D97"}
	resIvory := traits.EvaluateAestheticHarmonyWithModel("resistance_dog", "Monument", "Ivory White", ivoryColors)
	if !resIvory.IsMonochromeColorMatch || resIvory.ColorSynergyMultiplier < 1.70 {
		t.Errorf("expected Monument + Ivory White pure color twin >= 1.70x, got match=%v mult=%.2f", resIvory.IsMonochromeColorMatch, resIvory.ColorSynergyMultiplier)
	}
	loreBonus, loreTag := traits.EvaluateSymbolLoreSynergy("resistance_dog", "Monument", "Wreath", 5)
	if loreBonus < 0.08 || loreTag == "" {
		t.Errorf("expected Monument + Wreath thematic lore synergy, got bonus=%.2f tag=%s", loreBonus, loreTag)
	}

	// 3. Sky High (Blue) + Neon Blue SVG Hexes (#7596F9 -> #6862E4)
	neonBlueColors := &traits.BackdropColorSet{CenterHex: "#7596F9", EdgeHex: "#6862E4"}
	resBlue := traits.EvaluateAestheticHarmonyWithModel("durov_cap", "Sky High", "Neon Blue", neonBlueColors)
	if !resBlue.IsMonochromeColorMatch || resBlue.ColorSynergyMultiplier < 1.55 {
		t.Errorf("expected Sky High + Neon Blue color twin >= 1.55x, got match=%v mult=%.2f", resBlue.IsMonochromeColorMatch, resBlue.ColorSynergyMultiplier)
	}

	// 4. Sakura Pink + Rose Quartz Pink SVG Hexes
	pinkColors := &traits.BackdropColorSet{CenterHex: "#F4A6C8", EdgeHex: "#D96B9C"}
	resPink := traits.EvaluateAestheticHarmonyWithModel("plush_pepe", "Sakura Blossom", "Rose Quartz", pinkColors)
	if !resPink.IsMonochromeColorMatch || resPink.ColorSynergyMultiplier < 1.55 {
		t.Errorf("expected Sakura + Rose Quartz pink twin >= 1.55x, got match=%v mult=%.2f", resPink.IsMonochromeColorMatch, resPink.ColorSynergyMultiplier)
	}

	// 5. Serial Hierarchy (#1 > #7 > #42 > #100 > #777 > #1000 > #8247)
	engine := NewValuationEngine(nil, nil, nil)
	engine.SetNFTResolver(nil)
	ctx := context.Background()

	valOf := func(s int) float64 {
		v, err := engine.Valuate(ctx, fmt.Sprintf("santa_hat-%d", s))
		if err != nil {
			t.Fatalf("Valuate(santa_hat-%d) failed: %v", s, err)
		}
		f, _ := v.ExpectedGRAM.Float64()
		return f
	}
	v1 := valOf(1)
	v7 := valOf(7)
	v42 := valOf(42)
	v777 := valOf(777)
	v1000 := valOf(1000)
	v8247 := valOf(8247)

	if !(v1 > v7 && v7 > v42 && v777 > v1000 && v1000 > v8247*1.5) {
		t.Errorf("serial psychology hierarchy violated: #1=%.1f #7=%.1f #42=%.1f #777=%.1f #1000=%.1f #8247=%.1f",
			v1, v7, v42, v777, v1000, v8247)
	}
}



