package gvengine

import (
	"context"
	"strings"
	"testing"

	"ifragment-backend/internal/service/valuation/core"
)

// T-P1-006 / AC-P1-002: Down-market responsiveness in GV Engine
func TestGVEngine_P1_DownMarketResponsiveness(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	// Valuate valid gift (Plush Pepe serial 42) with no database comps
	val, err := engine.Valuate(ctx, "plush_pepe-42")
	if err != nil {
		t.Fatalf("valuation failed: %v", err)
	}

	exp, _ := val.ExpectedGRAM.Float64()
	low, _ := val.LowGRAM.Float64()
	high, _ := val.HighGRAM.Float64()

	if exp <= 0 {
		t.Errorf("expected positive ExpectedGRAM, got %.2f", exp)
	}

	// Verify price invariant: Low <= Expected <= High
	if low > exp {
		t.Errorf("invariant violation: LowGRAM (%.2f) > ExpectedGRAM (%.2f)", low, exp)
	}
	if high < exp {
		t.Errorf("invariant violation: HighGRAM (%.2f) < ExpectedGRAM (%.2f)", high, exp)
	}
}

// AC-P1-003: Confidence sample sparse labeling
func TestGVEngine_P1_UncalibratedLabeling(t *testing.T) {
	// With 0 or sparse comps, score must be capped and labeled uncalibrated
	score, note := core.GetCalibratedConfidenceScore(95, 0, ModelVersion)
	if score > 50 {
		t.Errorf("expected capped score <= 50 for n=0 comps, got %d", score)
	}
	if !strings.Contains(strings.ToLower(note), "uncalibrated") {
		t.Errorf("expected note to contain 'uncalibrated', got %q", note)
	}

	score2, note2 := core.GetCalibratedConfidenceScore(95, 2, ModelVersion)
	if score2 > 50 {
		t.Errorf("expected capped score <= 50 for n=2 comps, got %d", score2)
	}
	if !strings.Contains(strings.ToLower(note2), "uncalibrated") {
		t.Errorf("expected note to contain 'uncalibrated', got %q", note2)
	}
}
