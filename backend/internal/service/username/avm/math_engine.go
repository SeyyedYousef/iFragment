package avm

import (
	"math"
	"sort"
	"time"
)

// ComparableSale is the input struct for the math engine.
// Prices must already be normalized via NormalizeSalePrice.
type ComparableSale struct {
	ID       int64
	PriceTON float64 // auction-equivalent normalized price
	SaleDate time.Time
	// Morphology flags for confounder isolation
	HasNumbers    bool
	HasUnderscore bool
	IsDictionary  bool
}

// CalcTimeDecayWeights computes exponential time-decay weights w_i = exp(-λ * days_ago).
// The reference point is the most recent sale's date (or `now` if provided).
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

// CalcEffectiveSampleSize computes n_eff = (Σw_i)² / Σ(w_i²).
// Returns 0 if no weights.
func CalcEffectiveSampleSize(weights []float64) float64 {
	if len(weights) == 0 {
		return 0
	}

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

	// Create sorted index pairs
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

	// Find the weighted median
	var totalWeight float64
	for _, p := range pairs {
		totalWeight += p.weight
	}

	halfWeight := totalWeight / 2.0
	var cumWeight float64
	for i, p := range pairs {
		cumWeight += p.weight
		if cumWeight >= halfWeight {
			// If exact midpoint, average with next
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
	if len(logValues) == 0 {
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
	if nEff+K == 0 {
		return broadMedianLog
	}
	exactWeight := nEff / (nEff + K)
	broadWeight := K / (nEff + K)
	return exactWeight*exactMedianLog + broadWeight*broadMedianLog
}

// LogPrices converts a set of comparable sales to log-space prices.
// Returns the log-prices and the original float64 prices for reference.
func LogPrices(sales []ComparableSale) []float64 {
	logPrices := make([]float64, len(sales))
	for i, s := range sales {
		if s.PriceTON <= 0 {
			logPrices[i] = 0
		} else {
			logPrices[i] = math.Log(s.PriceTON)
		}
	}
	return logPrices
}

// CalcBaseLog computes the Bayesian-shrunk base price in log-space.
// This is the core of the AVM pricing engine.
func CalcBaseLog(
	exactSales []ComparableSale,
	broadSales []ComparableSale,
	cfg EngineConfig,
	now time.Time,
) (baseLog float64, nEff float64, mad float64, saleIDs []int64) {
	// Compute exact match statistics
	exactWeights := CalcTimeDecayWeights(exactSales, cfg.Lambda, now)
	exactLogPrices := LogPrices(exactSales)
	nEff = CalcEffectiveSampleSize(exactWeights)

	exactMedianLog := 0.0
	if len(exactSales) > 0 {
		exactMedianLog = WeightedMedian(exactLogPrices, exactWeights)
	}

	// Compute broad match statistics
	broadWeights := CalcTimeDecayWeights(broadSales, cfg.Lambda, now)
	broadLogPrices := LogPrices(broadSales)

	broadMedianLog := 0.0
	if len(broadSales) > 0 {
		broadMedianLog = WeightedMedian(broadLogPrices, broadWeights)
	}

	// Bayesian shrinkage
	if len(exactSales) == 0 && len(broadSales) == 0 {
		// No data at all — return a minimal fallback
		baseLog = math.Log(5.0) // ~1.6 TON as absolute floor
		return baseLog, 0, 0, nil
	}

	if len(exactSales) == 0 {
		baseLog = broadMedianLog
	} else {
		baseLog = BayesianShrinkage(exactMedianLog, broadMedianLog, nEff, cfg.K)
	}

	// Compute MAD from the better dataset
	if len(exactSales) >= 3 {
		mad = WeightedMAD(exactLogPrices, exactWeights, exactMedianLog)
	} else if len(broadSales) >= 3 {
		mad = WeightedMAD(broadLogPrices, broadWeights, broadMedianLog)
	}

	// Collect comparable sale IDs
	for _, s := range exactSales {
		saleIDs = append(saleIDs, s.ID)
	}

	return baseLog, nEff, mad, saleIDs
}
