package avm

import (
	"math"
	"testing"
	"time"
)

func TestCalcTimeDecayWeights(t *testing.T) {
	now := time.Date(2025, 7, 1, 0, 0, 0, 0, time.UTC)
	lambda := 0.01

	sales := []ComparableSale{
		{SaleDate: now},                    // 0 days ago
		{SaleDate: now.AddDate(0, 0, -30)}, // 30 days ago
		{SaleDate: now.AddDate(0, 0, -69)}, // ~69 days ago (half-life)
	}

	weights := CalcTimeDecayWeights(sales, lambda, now)

	if math.Abs(weights[0]-1.0) > 1e-10 {
		t.Errorf("w[0] should be 1.0, got %v", weights[0])
	}

	// At 30 days: exp(-0.01 * 30) ≈ 0.7408
	if math.Abs(weights[1]-math.Exp(-0.3)) > 1e-4 {
		t.Errorf("w[1] should be ~0.7408, got %v", weights[1])
	}

	// At 69 days: exp(-0.01 * 69) ≈ 0.5016
	if math.Abs(weights[2]-math.Exp(-0.69)) > 1e-4 {
		t.Errorf("w[2] should be ~0.5016, got %v", weights[2])
	}
}

func TestCalcEffectiveSampleSize(t *testing.T) {
	tests := []struct {
		name    string
		weights []float64
		want    float64
		tol     float64
	}{
		{"empty", nil, 0, 0},
		{"single", []float64{1.0}, 1.0, 1e-10},
		{"uniform_3", []float64{1.0, 1.0, 1.0}, 3.0, 1e-10},
		// [1.0, 0.5, 0.25]: sum=1.75, sum²=3.0625, sumSq=1+0.25+0.0625=1.3125
		// n_eff = 3.0625/1.3125 ≈ 2.333
		{"decaying_3", []float64{1.0, 0.5, 0.25}, 2.333, 0.01},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalcEffectiveSampleSize(tt.weights)
			if math.Abs(got-tt.want) > tt.tol {
				t.Errorf("CalcEffectiveSampleSize(%v) = %v, want %v", tt.weights, got, tt.want)
			}
		})
	}
}

func TestWeightedMedian(t *testing.T) {
	tests := []struct {
		name    string
		values  []float64
		weights []float64
		want    float64
	}{
		{"empty", nil, nil, 0},
		{"single", []float64{10.0}, []float64{1.0}, 10.0},
		{"uniform_odd", []float64{1, 2, 3}, []float64{1, 1, 1}, 2.0},
		// Weighted: heavy weight on 3.0
		{"heavy_last", []float64{1, 2, 3}, []float64{1, 1, 10}, 3.0},
		{"heavy_first", []float64{1, 2, 3}, []float64{10, 1, 1}, 1.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := WeightedMedian(tt.values, tt.weights)
			if math.Abs(got-tt.want) > 1e-10 {
				t.Errorf("WeightedMedian(%v, %v) = %v, want %v", tt.values, tt.weights, got, tt.want)
			}
		})
	}
}

func TestWeightedMAD(t *testing.T) {
	// All same values → MAD should be 0
	logValues := []float64{2.0, 2.0, 2.0}
	weights := []float64{1.0, 1.0, 1.0}
	got := WeightedMAD(logValues, weights, 2.0)
	if got != 0 {
		t.Errorf("WeightedMAD with constant values should be 0, got %v", got)
	}

	// Spread values
	logValues = []float64{1.0, 2.0, 3.0}
	weights = []float64{1.0, 1.0, 1.0}
	// deviations from median 2.0: [1, 0, 1], median of [0, 1, 1] = 1.0
	got = WeightedMAD(logValues, weights, 2.0)
	if math.Abs(got-1.0) > 1e-10 {
		t.Errorf("WeightedMAD expected 1.0, got %v", got)
	}
}

func TestBayesianShrinkage(t *testing.T) {
	exactMedian := 5.0
	broadMedian := 3.0
	K := 5.0

	tests := []struct {
		name string
		nEff float64
		want float64
	}{
		// n_eff=0 → fully broad
		{"no_exact_data", 0, 3.0},
		// n_eff=5 → 50/50 blend: (5/10)*5 + (5/10)*3 = 4.0
		{"equal_blend", 5.0, 4.0},
		// n_eff=20 → mostly exact: (20/25)*5 + (5/25)*3 = 4.6
		{"mostly_exact", 20.0, 4.6},
		// n_eff=100 → almost fully exact
		{"strong_exact", 100.0, (100.0/105.0)*5.0 + (5.0/105.0)*3.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BayesianShrinkage(exactMedian, broadMedian, tt.nEff, K)
			if math.Abs(got-tt.want) > 1e-6 {
				t.Errorf("BayesianShrinkage(exact=%v, broad=%v, nEff=%v, K=%v) = %v, want %v",
					exactMedian, broadMedian, tt.nEff, K, got, tt.want)
			}
		})
	}
}

func TestLogPrices(t *testing.T) {
	sales := []ComparableSale{
		{PriceTON: 1.0},
		{PriceTON: math.E},
		{PriceTON: 100.0},
		{PriceTON: 0.0}, // edge case: zero price
	}

	logPrices := LogPrices(sales)

	if math.Abs(logPrices[0]-0.0) > 1e-10 {
		t.Errorf("log(1) should be 0, got %v", logPrices[0])
	}
	if math.Abs(logPrices[1]-1.0) > 1e-10 {
		t.Errorf("log(e) should be 1, got %v", logPrices[1])
	}
	if math.Abs(logPrices[2]-math.Log(100)) > 1e-10 {
		t.Errorf("log(100) should be %v, got %v", math.Log(100), logPrices[2])
	}
	if logPrices[3] != 0 {
		t.Errorf("log(0) should be clamped to 0, got %v", logPrices[3])
	}
}

func TestCalcBaseLog_NoData(t *testing.T) {
	cfg := DefaultEngineConfig()
	// Expect baseLog to fallback to ln(5.0) which is approx 1.609
	baseLog, nEff, mad, ids := CalcBaseLog(nil, nil, nil, cfg, MorphFeatures{CharLength: 0}, time.Now())

	if math.Abs(baseLog-math.Log(cfg.FallbackOther)) > 1e-10 {
		t.Errorf("expected fallback baseLog=ln(%f), got %v", cfg.FallbackOther, baseLog)
	}
	if nEff != 0 {
		t.Errorf("expected nEff=0, got %v", nEff)
	}
	if mad != 0 {
		t.Errorf("expected mad=0, got %v", mad)
	}
	if len(ids) != 0 {
		t.Errorf("expected no sale IDs, got %v", ids)
	}
}

func TestCalcBaseLog_ExactOnly(t *testing.T) {
	cfg := DefaultEngineConfig()
	now := time.Date(2025, 7, 1, 0, 0, 0, 0, time.UTC)

	exact := []ComparableSale{
		{ID: 1, PriceTON: 100.0, SaleDate: now},
		{ID: 2, PriceTON: 120.0, SaleDate: now.AddDate(0, 0, -10)},
		{ID: 3, PriceTON: 80.0, SaleDate: now.AddDate(0, 0, -20)},
	}

	baseLog, nEff, _, ids := CalcBaseLog(nil, exact, nil, cfg, MorphFeatures{CharLength: 0}, now)

	// With no broad sales, broad median=0 → shrinkage pulls toward broad(0)
	// But exact has data, so n_eff should be >0
	if nEff <= 0 {
		t.Errorf("expected positive nEff, got %v", nEff)
	}
	if baseLog == 0 {
		t.Error("expected non-zero baseLog")
	}
	if len(ids) != 3 {
		t.Errorf("expected 3 sale IDs, got %d", len(ids))
	}
}
