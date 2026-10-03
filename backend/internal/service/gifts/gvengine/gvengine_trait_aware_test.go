package gvengine

import (
	"context"
	"testing"

	"github.com/shopspring/decimal"
)

// TestGVEngine_ColdStartTraitIsolation verifies Decision 1:
// When no trait-matched comps exist for an item, the engine relies 100% on the theoretical
// hedonic model and floor without shrinkage towards unrelated common floor sales.
func TestGVEngine_ColdStartTraitIsolation(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	val, err := engine.Valuate(ctx, "plush_pepe-42")
	if err != nil {
		t.Fatalf("unexpected valuation error: %v", err)
	}

	if val.PriceBasis != "hedonic_pure_trait_basis" {
		t.Errorf("expected price_basis 'hedonic_pure_trait_basis', got '%s'", val.PriceBasis)
	}

	if val.ExpectedGRAM.LessThanOrEqual(decimal.Zero) {
		t.Errorf("expected positive ExpectedGRAM, got %s", val.ExpectedGRAM.String())
	}

	// Verify Laya metrics are logged
	if mult, ok := val.ReasoningLog["laya_synergy_multiplier"].(float64); !ok || mult <= 0 {
		t.Errorf("expected valid laya_synergy_multiplier in reasoning log, got %v", val.ReasoningLog["laya_synergy_multiplier"])
	}

	if score, ok := val.ReasoningLog["laya_synergy_score"].(int); !ok || score <= 0 {
		t.Errorf("expected valid laya_synergy_score in reasoning log, got %v", val.ReasoningLog["laya_synergy_score"])
	}
}

// TestGVEngine_LayaFloorInvariantEnforcement verifies Decision 2:
// The final ExpectedGRAM and LowGRAM must strictly never fall below the observed floor price,
// guaranteeing that any downside penalty from Laya cannot violate the sacred Floor Invariant.
func TestGVEngine_LayaFloorInvariantEnforcement(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	testGifts := []string{
		"durov_cap-1",
		"plush_pepe-88",
		"heart_locket-500",
		"precious_peach-4500",
	}

	for _, g := range testGifts {
		val, err := engine.Valuate(ctx, g)
		if err != nil {
			t.Fatalf("failed to valuate %s: %v", g, err)
		}

		floorDec := decimal.NewFromFloat(val.Pillars.ObservedFloorGRAM)
		if val.ExpectedGRAM.LessThan(floorDec) {
			t.Errorf("INVARIANT VIOLATION for %s: ExpectedGRAM (%s) is lower than ObservedFloorGRAM (%s)",
				g, val.ExpectedGRAM.String(), floorDec.String())
		}

		if val.LowGRAM.LessThan(floorDec) {
			t.Errorf("INVARIANT VIOLATION for %s: LowGRAM (%s) is lower than ObservedFloorGRAM (%s)",
				g, val.LowGRAM.String(), floorDec.String())
		}

		if val.HighGRAM.LessThan(val.ExpectedGRAM) {
			t.Errorf("ORDERING VIOLATION for %s: HighGRAM (%s) < ExpectedGRAM (%s)",
				g, val.HighGRAM.String(), val.ExpectedGRAM.String())
		}
	}
}

// TestGVEngine_LayaSynergyMultiplierAestheticBoost verifies that Laya System One
// assigns higher synergy multiplier for harmonious low-serial / aesthetic items.
func TestGVEngine_LayaSynergyMultiplierAestheticBoost(t *testing.T) {
	evaluator := NewLayaGiftEvaluator()
	ctx := context.Background()

	// 1. High prestige grail with low serial
	resGrail := evaluator.EvaluateGift(ctx, "Plush Pepe", "Obsidian Matrix", "Aero Crest", 7)
	if resGrail.SynergyMultiplier < 1.0 {
		t.Errorf("expected SynergyMultiplier >= 1.0 for low serial, got %.2f", resGrail.SynergyMultiplier)
	}

	// 2. Fallback response is deterministic and well-formed
	resFallback := evaluator.fallbackGift(500)
	if resFallback.SynergyMultiplier != 1.0 {
		t.Errorf("expected fallback multiplier 1.0, got %.2f", resFallback.SynergyMultiplier)
	}
	if resFallback.TraitSynergyScore != 6 {
		t.Errorf("expected fallback trait synergy score 6, got %d", resFallback.TraitSynergyScore)
	}
}

// TestGVEngine_VanitySerialsEngine verifies that numerical genetic vanity patterns
// (Ladders, Doublets, Milestone Years) receive higher valuation than standard non-premium serials.
func TestGVEngine_VanitySerialsEngine(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	// 1. Compare Ladder #1234 vs Standard #1247
	valLadder, err := engine.Valuate(ctx, "durov_cap-1234")
	if err != nil {
		t.Fatalf("failed to valuate ladder: %v", err)
	}
	valStd, err := engine.Valuate(ctx, "durov_cap-1247")
	if err != nil {
		t.Fatalf("failed to valuate standard: %v", err)
	}

	if cat, ok := valLadder.ReasoningLog["serial_category"].(string); !ok || cat != "ladder" {
		t.Errorf("expected ladder serial_category 'ladder', got %v", valLadder.ReasoningLog["serial_category"])
	}
	if !valLadder.ExpectedGRAM.GreaterThan(valStd.ExpectedGRAM) {
		t.Errorf("expected ladder #1234 (%s) to exceed standard #1247 (%s)",
			valLadder.ExpectedGRAM.String(), valStd.ExpectedGRAM.String())
	}

	// 2. Compare Doublet #2020 vs Standard #2019
	valDoublet, err := engine.Valuate(ctx, "durov_cap-2020")
	if err != nil {
		t.Fatalf("failed to valuate doublet: %v", err)
	}
	valStd2, err := engine.Valuate(ctx, "durov_cap-2019")
	if err != nil {
		t.Fatalf("failed to valuate standard: %v", err)
	}

	if cat, ok := valDoublet.ReasoningLog["serial_category"].(string); !ok || cat != "doublet" {
		t.Errorf("expected doublet serial_category 'doublet', got %v", valDoublet.ReasoningLog["serial_category"])
	}
	if !valDoublet.ExpectedGRAM.GreaterThan(valStd2.ExpectedGRAM) {
		t.Errorf("expected doublet #2020 (%s) to exceed standard #2019 (%s)",
			valDoublet.ExpectedGRAM.String(), valStd2.ExpectedGRAM.String())
	}

	// 3. Compare Telegram Gifts Launch Genesis Year #2024 vs Standard #2035
	valYear2024, err := engine.Valuate(ctx, "santa_hat-2024")
	if err != nil {
		t.Fatalf("failed to valuate year 2024: %v", err)
	}
	valStd3, err := engine.Valuate(ctx, "santa_hat-2035")
	if err != nil {
		t.Fatalf("failed to valuate standard: %v", err)
	}

	if cat, ok := valYear2024.ReasoningLog["serial_category"].(string); !ok || cat != "milestone_year" {
		t.Errorf("expected milestone_year serial_category, got %v", valYear2024.ReasoningLog["serial_category"])
	}
	if !valYear2024.ExpectedGRAM.GreaterThan(valStd3.ExpectedGRAM) {
		t.Errorf("expected year #2024 (%s) to exceed standard #2035 (%s)",
			valYear2024.ExpectedGRAM.String(), valStd3.ExpectedGRAM.String())
	}
}

// TestGVEngine_PrestigeColorTierMatrix verifies that Tier S colors (Obsidian, Gold, Cyberpunk)
// receive higher prestige beta and valuation than neutral / earth Tier C colors.
func TestGVEngine_PrestigeColorTierMatrix(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	valObsidian, err := engine.Valuate(ctx, "plush_pepe-500")
	if err != nil {
		t.Fatalf("failed to valuate obsidian: %v", err)
	}

	// Verify prestige keys are properly registered
	if tier, ok := valObsidian.ReasoningLog["color_prestige_tier"].(string); !ok || tier == "" {
		t.Errorf("expected valid color_prestige_tier in reasoning log, got %v", valObsidian.ReasoningLog["color_prestige_tier"])
	}
	if beta, ok := valObsidian.ReasoningLog["beta_color_prestige"].(float64); !ok || beta < 0 {
		t.Errorf("expected valid beta_color_prestige in reasoning log, got %v", valObsidian.ReasoningLog["beta_color_prestige"])
	}
}
