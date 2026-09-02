package core

import (
	"math"
	"sort"
	"time"
)

// ComparableSale represents a generic historical transaction across usernames, numbers, or gifts.
type ComparableSale struct {
	ID            int64
	ItemKey       string
	PriceTON      float64   // auction-equivalent normalized price (appreciated)
	RawPriceTON   float64   // un-appreciated original historical purchase price
	SaleDate      time.Time
	CharLength    int
	Weight        float64
	HasNumbers    bool
	HasUnderscore bool
	IsDictionary  bool
	Category      string
}

// ApplyMarketAppreciation inflates the PriceTON of older sales based on a compounded annual growth rate.
// Time horizon is bounded to 8 years maximum to prevent unrealistic runaway appreciation.
func ApplyMarketAppreciation(sales []ComparableSale, annualRate float64, now time.Time) {
	ApplyMarketAppreciationWithHorizon(sales, annualRate, 8.0, now)
}

// ApplyMarketAppreciationWithHorizon inflates older sales with an explicit maximum years clamp.
func ApplyMarketAppreciationWithHorizon(sales []ComparableSale, annualRate float64, maxYears float64, now time.Time) {
	if annualRate <= 0 {
		return
	}
	if maxYears <= 0 {
		maxYears = 8.0
	}
	for i, s := range sales {
		if sales[i].RawPriceTON == 0 {
			sales[i].RawPriceTON = s.PriceTON
		}
		yearsAgo := now.Sub(s.SaleDate).Hours() / (24.0 * 365.25)
		if yearsAgo > 0 {
			if yearsAgo > maxYears {
				yearsAgo = maxYears
			}
			multiplier := math.Pow(1.0+annualRate, yearsAgo)
			sales[i].PriceTON = sales[i].RawPriceTON * multiplier
		}
	}
}

// WinsorizeComparables clamps extreme outliers in a set of comparable sales
// to the [pLow, pHigh] percentiles (default 5th and 95th percentiles).
// This mitigates the influence of wash sales, manipulative bids, or extreme lowball transactions.
func WinsorizeComparables(sales []ComparableSale, pLow, pHigh float64) []ComparableSale {
	if len(sales) < 5 {
		return sales
	}
	if pLow <= 0 {
		pLow = 0.05
	}
	if pHigh >= 1.0 || pHigh <= pLow {
		pHigh = 0.95
	}

	prices := make([]float64, len(sales))
	for i, s := range sales {
		prices[i] = s.PriceTON
	}
	sort.Float64s(prices)

	n := float64(len(prices) - 1)
	lowIdx := int(math.Floor(n * pLow))
	highIdx := int(math.Floor(n * pHigh))
	if lowIdx < 0 {
		lowIdx = 0
	}
	if highIdx >= len(prices) {
		highIdx = len(prices) - 1
	}
	if highIdx <= lowIdx {
		highIdx = len(prices) - 1
	}

	minVal := prices[lowIdx]
	maxVal := prices[highIdx]

	out := make([]ComparableSale, len(sales))
	for i, s := range sales {
		out[i] = s
		if out[i].PriceTON < minVal {
			out[i].PriceTON = minVal
		} else if out[i].PriceTON > maxVal {
			out[i].PriceTON = maxVal
		}
	}
	return out
}

// CalcTimeDecayWeights computes exponential time decay weights: w_i = exp(-lambda * days_ago)
func CalcTimeDecayWeights(sales []ComparableSale, lambda float64, now time.Time) []float64 {
	weights := make([]float64, len(sales))
	for i, s := range sales {
		daysAgo := now.Sub(s.SaleDate).Hours() / 24.0
		if daysAgo < 0 {
			daysAgo = 0
		}
		weights[i] = math.Exp(-lambda * daysAgo)
	}
	return weights
}

// CalcEffectiveSampleSize computes Kish's Effective Sample Size:
// n_eff = (sum w_i)^2 / sum(w_i^2)
func CalcEffectiveSampleSize(weights []float64) float64 {
	var sumW, sumW2 float64
	for _, w := range weights {
		sumW += w
		sumW2 += w * w
	}
	if sumW2 == 0 {
		return 0
	}
	return (sumW * sumW) / sumW2
}

// WeightedMedian computes the weighted median of values with corresponding weights.
// Values and weights must have the same length.
func WeightedMedian(values, weights []float64) float64 {
	if len(values) == 0 || len(values) != len(weights) {
		return 0
	}

	type pair struct {
		value  float64
		weight float64
	}
	pairs := make([]pair, len(values))
	for i := range values {
		pairs[i] = pair{values[i], weights[i]}
	}
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].value < pairs[j].value
	})

	var totalWeight float64
	for _, p := range pairs {
		totalWeight += p.weight
	}
	if totalWeight <= 0 {
		return pairs[0].value
	}

	halfWeight := totalWeight / 2.0
	var cumWeight float64
	for i, p := range pairs {
		cumWeight += p.weight
		if cumWeight >= halfWeight {
			if cumWeight == halfWeight && i+1 < len(pairs) {
				return (p.value + pairs[i+1].value) / 2.0
			}
			return p.value
		}
	}
	return pairs[len(pairs)-1].value
}

// WeightedMAD computes the Weighted Median Absolute Deviation in log-space.
// MAD = WeightedMedian(|log(x_i) - median_log|, w_i)
func WeightedMAD(logValues, weights []float64, medianLog float64) float64 {
	if len(logValues) == 0 || len(logValues) != len(weights) {
		return 0
	}

	absDevs := make([]float64, len(logValues))
	for i, lv := range logValues {
		absDevs[i] = math.Abs(lv - medianLog)
	}

	return WeightedMedian(absDevs, weights)
}

// BayesianShrinkage blends the exact-match estimate with the broad prior
// using effective sample size:
//
//	Base_log = (n_eff / (n_eff + K)) * Median_exact + (K / (n_eff + K)) * Median_broad
func BayesianShrinkage(exactMedianLog, broadMedianLog, nEff, K float64) float64 {
	if nEff+K <= 0 {
		return broadMedianLog
	}
	exactWeight := nEff / (nEff + K)
	broadWeight := K / (nEff + K)
	return exactWeight*exactMedianLog + broadWeight*broadMedianLog
}

// LogPrices converts a set of comparable sales to log-space prices, skipping invalid non-positive prices.
func LogPrices(sales []ComparableSale) []float64 {
	logPrices := make([]float64, 0, len(sales))
	for _, s := range sales {
		if s.PriceTON > 0 {
			logPrices = append(logPrices, math.Log(s.PriceTON))
		}
	}
	return logPrices
}

// AestheticRound rounds prices to clean numbers mimicking human appraisal
func AestheticRound(n float64) float64 {
	if n >= 10000 {
		return math.Round(n/1000) * 1000
	}
	if n >= 1000 {
		return math.Round(n/100) * 100
	}
	if n >= 100 {
		return math.Round(n/10) * 10
	}
	if n >= 10 {
		return math.Round(n)
	}
	return math.Round(n*100) / 100
}
