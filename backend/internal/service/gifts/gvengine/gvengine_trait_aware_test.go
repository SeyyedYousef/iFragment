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
