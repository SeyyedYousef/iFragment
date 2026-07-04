package avm

import (
	"math"
	"testing"
)

func TestCalcMorphologyLog_DictionaryWord(t *testing.T) {
	cfg := DefaultEngineConfig()

	features := MorphFeatures{
		IsDictionary: true,
		HasNumbers:   false,
		CharLength:   5,
	}

	morphLog := CalcMorphologyLog(features, cfg.MorphMultipliers, cfg)

	// Should include: is_dictionary(2.5) + short_5(1.8) + no_underscore(1.15)
	// = ln(2.5) + ln(1.8) + ln(1.15) = ln(5.175) ≈ 1.6438
	// However, this exceeds the MorphClampHigh of ln(4.0) ≈ 1.3863, so it should be clamped.
	expected := cfg.MorphClampHigh
	if math.Abs(morphLog-expected) > 1e-6 {
		t.Errorf("morphLog = %v, want %v (clamped to MorphClampHigh)", morphLog, expected)
	}
}

func TestCalcMorphologyLog_ConfounderIsolation(t *testing.T) {
	cfg := DefaultEngineConfig()

	// has_numbers=true AND is_dictionary=true
	// → has_numbers discount should be SUPPRESSED
	features := MorphFeatures{
		IsDictionary: true,
		HasNumbers:   true,
		CharLength:   6,
	}

	morphLog := CalcMorphologyLog(features, cfg.MorphMultipliers, cfg)

	// Should NOT include has_numbers(0.70) discount
	// Should include: is_dictionary(2.5) + no_underscore(1.15)
	expected := math.Log(2.5) + math.Log(1.15)
	if math.Abs(morphLog-expected) > 1e-6 {
		t.Errorf("confounder isolation failed: morphLog = %v, want %v", morphLog, expected)
	}
}

func TestCalcMorphologyLog_NumbersOnly(t *testing.T) {
	cfg := DefaultEngineConfig()

	features := MorphFeatures{
		HasNumbers:   true,
		IsDictionary: false,
		CharLength:   8,
	}

	morphLog := CalcMorphologyLog(features, cfg.MorphMultipliers, cfg)

	// has_numbers(0.70) + no_underscore(1.15)
	expected := math.Log(0.70) + math.Log(1.15)
	if math.Abs(morphLog-expected) > 1e-6 {
		t.Errorf("morphLog = %v, want %v", morphLog, expected)
	}
}

func TestCalcMorphologyLog_Clamping(t *testing.T) {
	cfg := DefaultEngineConfig()

	// Force extreme low by stacking multiple discounts
	features := MorphFeatures{
		HasNumbers:    true,
		HasUnderscore: true,
		IsDictionary:  false,
		CharLength:    15,
	}

	morphLog := CalcMorphologyLog(features, cfg.MorphMultipliers, cfg)

	// has_numbers(0.70) + has_underscore(0.60) = ln(0.70) + ln(0.60) ≈ -0.356 + -0.511 = -0.867
	// Should NOT be clamped since -0.867 > ln(0.35) ≈ -1.0498
	expected := math.Log(0.70) + math.Log(0.60)
	if math.Abs(morphLog-expected) > 1e-6 {
		t.Errorf("morphLog = %v, want %v (should not be clamped)", morphLog, expected)
	}
}

func TestCalcSmoothedMomentum_Neutral(t *testing.T) {
	cfg := DefaultEngineConfig()

	// Equal volume in both windows → neutral momentum
	mom := CalcSmoothedMomentum(30, 60, 1.0, cfg)

	// recentRate = (30+1)/30 = 1.033
	// olderRate = (60+2)/60 = 1.033
	// rVol = 1.0, ln(1.0 * 1.0) = 0
	if math.Abs(mom) > 0.01 {
		t.Errorf("neutral momentum should be ~0, got %v", mom)
	}
}

func TestCalcSmoothedMomentum_Bullish(t *testing.T) {
	cfg := DefaultEngineConfig()

	// Much more recent activity
	mom := CalcSmoothedMomentum(50, 10, 1.0, cfg)

	if mom <= 0 {
		t.Errorf("bullish momentum should be positive, got %v", mom)
	}
	// Should be clamped to ln(1.25) ≈ 0.2231
	if mom > cfg.MomentumClampHigh+1e-10 {
		t.Errorf("momentum should be clamped at %v, got %v", cfg.MomentumClampHigh, mom)
	}
}

func TestCalcSmoothedMomentum_Bearish(t *testing.T) {
	cfg := DefaultEngineConfig()

	// Much less recent activity
	mom := CalcSmoothedMomentum(1, 100, 1.0, cfg)

	if mom >= 0 {
		t.Errorf("bearish momentum should be negative, got %v", mom)
	}
	// Should be clamped to ln(0.8) ≈ -0.2231
	if mom < cfg.MomentumClampLow-1e-10 {
		t.Errorf("momentum should be clamped at %v, got %v", cfg.MomentumClampLow, mom)
	}
}

func TestCalcSmoothedMomentum_ZeroCounts(t *testing.T) {
	cfg := DefaultEngineConfig()

	// Zero counts in both windows → Laplace smoothing prevents division by zero
	mom := CalcSmoothedMomentum(0, 0, 1.0, cfg)

	// recentRate = (0+1)/30 = 0.0333
	// olderRate = (0+2)/60 = 0.0333
	// rVol = 1.0 → mom ≈ 0
	if math.Abs(mom) > 0.01 {
		t.Errorf("zero-count momentum should be ~0 (Laplace), got %v", mom)
	}
}

func TestCalcRangeLog(t *testing.T) {
	cfg := DefaultEngineConfig()

	// Base price = 100 TON → log(100) ≈ 4.605
	baseLog := math.Log(100.0)
	morphLog := 0.0    // neutral
	momentumLog := 0.0  // neutral
	mad := 0.3          // moderate spread

	expected, low, high := CalcRangeLog(baseLog, morphLog, momentumLog, mad, cfg)

	if math.Abs(expected-100.0) > 0.1 {
		t.Errorf("expected ≈ 100 TON, got %v", expected)
	}
	if low >= expected {
		t.Errorf("low (%v) should be < expected (%v)", low, expected)
	}
	if high <= expected {
		t.Errorf("high (%v) should be > expected (%v)", high, expected)
	}
	// Width = max(0.3*1.5, ln(1.15)) = max(0.45, 0.1398) = 0.45
	wantLow := math.Exp(baseLog - 0.45)
	wantHigh := math.Exp(baseLog + 0.45)
	if math.Abs(low-wantLow) > 0.1 {
		t.Errorf("low = %v, want ≈ %v", low, wantLow)
	}
	if math.Abs(high-wantHigh) > 0.1 {
		t.Errorf("high = %v, want ≈ %v", high, wantHigh)
	}
}

func TestCalcRangeLog_MinWidthGuard(t *testing.T) {
	cfg := DefaultEngineConfig()

	baseLog := math.Log(50.0)
	// Very small MAD → should use W_min = ln(1 + 0.15) ≈ 0.1398
	expected, low, high := CalcRangeLog(baseLog, 0, 0, 0.01, cfg)

	spread := (high - low) / expected
	if spread < 0.25 { // at least ~25% total spread
		t.Errorf("min width guard failed: spread ratio = %v", spread)
	}
}
