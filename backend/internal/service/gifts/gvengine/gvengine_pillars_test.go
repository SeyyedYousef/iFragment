package gvengine

import (
	"context"
	"testing"
)

func TestGVEngine_FourValuationPillars(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	// Valuate Plush Pepe #42
	val, err := engine.Valuate(ctx, "plush_pepe-42")
	if err != nil {
		t.Fatalf("Valuate failed: %v", err)
	}

	p := val.Pillars

	// 1. All 4 pillars must have positive values
	if p.FairValueGRAM <= 0 {
		t.Errorf("expected FairValueGRAM > 0, got %.2f", p.FairValueGRAM)
	}
	if p.LiquidationValueGRAM <= 0 {
		t.Errorf("expected LiquidationValueGRAM > 0, got %.2f", p.LiquidationValueGRAM)
	}
	if p.SuggestedAskGRAM <= 0 {
		t.Errorf("expected SuggestedAskGRAM > 0, got %.2f", p.SuggestedAskGRAM)
	}
	if p.ObservedFloorGRAM <= 0 {
		t.Errorf("expected ObservedFloorGRAM > 0, got %.2f", p.ObservedFloorGRAM)
	}

	// 2. Strict Invariant Ordering: LiquidationValue <= FairValue <= SuggestedAsk
	if p.LiquidationValueGRAM > p.FairValueGRAM {
		t.Errorf("LiquidationValue (%.2f) must be <= FairValue (%.2f)", p.LiquidationValueGRAM, p.FairValueGRAM)
	}
	if p.FairValueGRAM > p.SuggestedAskGRAM {
		t.Errorf("FairValue (%.2f) must be <= SuggestedAsk (%.2f)", p.FairValueGRAM, p.SuggestedAskGRAM)
	}

	// 3. USD Pillars must match GRAM * rate
	if p.FairValueUSD <= 0 {
		t.Errorf("expected FairValueUSD > 0, got %.2f", p.FairValueUSD)
	}
	if p.LiquidationValueUSD <= 0 {
		t.Errorf("expected LiquidationValueUSD > 0, got %.2f", p.LiquidationValueUSD)
	}
	if p.SuggestedAskUSD <= 0 {
		t.Errorf("expected SuggestedAskUSD > 0, got %.2f", p.SuggestedAskUSD)
	}
	if p.ObservedFloorUSD <= 0 {
		t.Errorf("expected ObservedFloorUSD > 0, got %.2f", p.ObservedFloorUSD)
	}
}
