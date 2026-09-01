package core

import (
	"math"
	"testing"
	"time"
)

func TestCore_WeightedMedianAndMAD(t *testing.T) {
	values := []float64{10.0, 20.0, 30.0, 40.0, 50.0}
	weights := []float64{1.0, 1.0, 1.0, 1.0, 1.0}

	med := WeightedMedian(values, weights)
	if med != 30.0 {
		t.Errorf("expected median 30.0, got %.2f", med)
	}

	logValues := []float64{math.Log(10), math.Log(20), math.Log(30), math.Log(40), math.Log(50)}
	mad := WeightedMAD(logValues, weights, math.Log(30))
	if mad <= 0 {
		t.Errorf("expected positive MAD, got %.4f", mad)
	}
}

func TestCore_BayesianShrinkage(t *testing.T) {
	exactLog := math.Log(1000.0)
	broadLog := math.Log(100.0)

	// nEff = 0 -> should equal broadLog
	shrunk0 := BayesianShrinkage(exactLog, broadLog, 0, 10.0)
	if math.Abs(shrunk0-broadLog) > 1e-6 {
		t.Errorf("expected broadLog for nEff=0, got %.4f vs %.4f", shrunk0, broadLog)
	}

	// High nEff -> should approach exactLog
	shrunkHigh := BayesianShrinkage(exactLog, broadLog, 990.0, 10.0)
	expectedHigh := 0.99*exactLog + 0.01*broadLog
	if math.Abs(shrunkHigh-expectedHigh) > 1e-6 {
		t.Errorf("expected %.4f, got %.4f", expectedHigh, shrunkHigh)
	}
}

func TestCore_WinsorizeComparables(t *testing.T) {
	sales := []ComparableSale{
		{PriceTON: 10.0},
		{PriceTON: 20.0},
		{PriceTON: 30.0},
		{PriceTON: 40.0},
		{PriceTON: 50.0},
		{PriceTON: 1000.0}, // extreme outlier
	}

	winsorized := WinsorizeComparables(sales, 0.05, 0.95)
	if len(winsorized) != len(sales) {
		t.Fatalf("length mismatch")
	}

	maxPrice := winsorized[len(winsorized)-1].PriceTON
	if maxPrice >= 1000.0 {
		t.Errorf("extreme outlier was not clamped: got %.2f", maxPrice)
	}
}

func TestCore_MarketAppreciation(t *testing.T) {
	now := time.Now()
	twoYearsAgo := now.Add(-2 * 365 * 24 * time.Hour)
	sales := []ComparableSale{
		{PriceTON: 1000.0, RawPriceTON: 1000.0, SaleDate: twoYearsAgo},
	}

	ApplyMarketAppreciation(sales, 0.20, now) // 20% annual CAGR
	// 1000 * 1.20^2 = 1440 (approx)
	if sales[0].PriceTON < 1400.0 || sales[0].PriceTON > 1460.0 {
		t.Errorf("expected appreciated price around 1440 TON, got %.2f", sales[0].PriceTON)
	}
}

func TestCore_UncertaintyBounds(t *testing.T) {
	low, high := ComputeUncertaintyBounds(100.0, 0.15, 1.25, 0.10, 0.40)
	if low >= 100.0 || high <= 100.0 {
		t.Errorf("bounds violated: Low (%.2f) < Expected (100.0) < High (%.2f)", low, high)
	}
}
