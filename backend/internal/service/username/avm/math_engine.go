package avm

import (
	"math"
	"sort"
	"time"

	"ifragment-backend/internal/service/valuation/core"
)

type ComparableSale struct {
	ID          int64
	PriceTON    float64 // auction-equivalent normalized price (appreciated)
	RawPriceTON float64 // un-appreciated original historical purchase price
	SaleDate    time.Time
	CharLength  int
	// Morphology flags for confounder isolation
	HasNumbers    bool
	HasUnderscore bool
	IsDictionary  bool
}

// ApplyMarketAppreciation inflates the PriceTON of older sales based on a compounded annual growth rate.
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

// CalcTimeDecayWeights computes exponential time-decay weights w_i = exp(-lambda * days_ago).
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

// CalcEffectiveSampleSize computes n_eff = (Sum w_i)^2 / Sum(w_i^2).
func CalcEffectiveSampleSize(weights []float64) float64 {
	return core.CalcEffectiveSampleSize(weights)
}

// WeightedMedian computes the weighted median of values with corresponding weights.
func WeightedMedian(values, weights []float64) float64 {
	return core.WeightedMedian(values, weights)
}

// WeightedMAD computes the Weighted Median Absolute Deviation in log-space.
func WeightedMAD(logValues, weights []float64, medianLog float64) float64 {
	return core.WeightedMAD(logValues, weights, medianLog)
}

// BayesianShrinkage blends the exact-match estimate with the broad prior
func BayesianShrinkage(exactMedianLog, broadMedianLog, nEff, K float64) float64 {
	return core.BayesianShrinkage(exactMedianLog, broadMedianLog, nEff, K)
}

// AestheticRound rounds prices to clean numbers mimicking human appraisal
func AestheticRound(n float64) float64 {
	return core.AestheticRound(n)
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

func fallbackForLength(length int, cfg EngineConfig) float64 {
	switch length {
	case 3:
		return cfg.FallbackLen3 // 10,000 TON
	case 4:
		return cfg.FallbackLen4 // 5,050 TON
	case 5:
		return cfg.FallbackLen5 // 1,000 TON
	case 6:
		return cfg.FallbackLen6 // 100 TON
	default:
		return cfg.FallbackOther // 25 TON
	}
}

// NormalizeToLength5 normalizes a price from its original length to a 5-letter equivalent.
func NormalizeToLength5(price float64, length int, cfg EngineConfig) float64 {
	if price <= 0 {
		return 0
	}
	f := fallbackForLength(length, cfg)
	if f <= 0 {
		return price
	}
	return price * (cfg.FallbackLen5 / f)
}

// DenormalizeFromLength5 denormalizes a price from a 5-letter equivalent to the target length.
// Damps the length penalty for high semantic score premium names.
func DenormalizeFromLength5(price float64, targetLength int, semanticScore float64, cfg EngineConfig) float64 {
	if price <= 0 {
		return 0
	}
	f := fallbackForLength(targetLength, cfg)
	ratio := f / cfg.FallbackLen5
	if ratio < 1.0 && semanticScore > 0 {
		damp := semanticScore / 100.0
		if damp > 1.0 {
			damp = 1.0
		}
		if damp < 0.0 {
			damp = 0.0
		}
		ratio = damp*1.0 + (1.0-damp)*ratio
	}
	return price * ratio
}

// CalcBaseLog computes the foundational price in log-space using hierarchical Bayesian Shrinkage:
// target -> exact -> broad.
func CalcBaseLog(
	targetSales []ComparableSale,
	exactSales []ComparableSale,
	broadSales []ComparableSale,
	cfg EngineConfig,
	features MorphFeatures,
	now time.Time,
) (baseLog float64, nEff float64, mad float64, saleIDs []int64) {
	saleIDs = []int64{} // Initialize to empty slice to prevent SQL NULL

	// Normalize exact and broad prices to 5-letter equivalent for cross-length comparison
	exactSalesCopy := make([]ComparableSale, len(exactSales))
	for i, s := range exactSales {
		exactSalesCopy[i] = s
		exactSalesCopy[i].PriceTON = NormalizeToLength5(s.PriceTON, s.CharLength, cfg)
	}

	broadSalesCopy := make([]ComparableSale, len(broadSales))
	for i, s := range broadSales {
		broadSalesCopy[i] = s
		broadSalesCopy[i].PriceTON = NormalizeToLength5(s.PriceTON, s.CharLength, cfg)
	}

	// Apply Winsorization to mitigate extreme outlier distortion before weighted medians
	pLow := cfg.WinsorizeP5
	pHigh := cfg.WinsorizeP95
	if pLow <= 0 {
		pLow = 0.05
	}
	if pHigh <= 0 || pHigh >= 1.0 {
		pHigh = 0.95
	}
	exactSalesCopy = WinsorizeComparables(exactSalesCopy, pLow, pHigh)
	broadSalesCopy = WinsorizeComparables(broadSalesCopy, pLow, pHigh)

	// Target sales are for this exact username/length, so keep native TON prices!
	targetSalesCopy := make([]ComparableSale, len(targetSales))
	for i, s := range targetSales {
		targetSalesCopy[i] = s
	}


	// Compute exact match statistics
	exactWeights := CalcTimeDecayWeights(exactSalesCopy, cfg.Lambda, now)
	exactLogPrices := LogPrices(exactSalesCopy)
	nEff = CalcEffectiveSampleSize(exactWeights)

	exactMedianLog := 0.0
	if len(exactSalesCopy) > 0 {
		exactMedianLog = WeightedMedian(exactLogPrices, exactWeights)
	}

	// Compute broad match statistics
	broadWeights := CalcTimeDecayWeights(broadSalesCopy, cfg.Lambda, now)
	broadLogPrices := LogPrices(broadSalesCopy)

	broadMedianLog := 0.0
	if len(broadSalesCopy) > 0 {
		broadMedianLog = WeightedMedian(broadLogPrices, broadWeights)
	}

	// Bayesian Prior Sliding: slide database median to raw length fallback based on semantic score
	if features.SemanticScore > 0 {
		fallbackPrice5 := cfg.FallbackLen5
		fallbackLog5 := math.Log(fallbackPrice5)

		weight := features.SemanticScore / 100.0
		if weight < 0.0 {
			weight = 0.0
		}
		if weight > 1.0 {
			weight = 1.0
		}

		broadMedianLog = weight*broadMedianLog + (1.0-weight)*fallbackLog5
		if exactMedianLog > 0 {
			exactMedianLog = weight*exactMedianLog + (1.0-weight)*fallbackLog5
		}
	}

	// Compute target match statistics (the exact same username)
	targetWeights := CalcTimeDecayWeights(targetSalesCopy, cfg.Lambda, now)
	targetLogPrices := LogPrices(targetSalesCopy)
	targetNEff := CalcEffectiveSampleSize(targetWeights)

	targetMedianLog := 0.0
	if len(targetSalesCopy) > 0 {
		targetMedianLog = WeightedMedian(targetLogPrices, targetWeights)
	}

	// Bayesian shrinkage (Hierarchical)
	if len(targetSalesCopy) == 0 && len(exactSalesCopy) == 0 && len(broadSalesCopy) == 0 {
		// No data at all — return a length-based fallback
		baseLog = math.Log(fallbackForLength(features.CharLength, cfg))
		return baseLog, 0, 0, saleIDs
	}

	// Shrink exact towards broad (in 5-letter normalized space)
	shrunkExact5Log := broadMedianLog
	if len(exactSalesCopy) > 0 {
		shrunkExact5Log = BayesianShrinkage(exactMedianLog, broadMedianLog, nEff, cfg.K)
	} else {
		nEff = 0.0 // broad only
	}

	// Denormalize shrunkExact from 5-letter space to native target length space
	shrunkExact5Price := math.Exp(shrunkExact5Log)
	shrunkExactNativePrice := DenormalizeFromLength5(shrunkExact5Price, features.CharLength, features.SemanticScore, cfg)
	shrunkExactNativeLog := math.Log(shrunkExactNativePrice)

	// Shrink target towards shrunkExact (both in native length space)
	if len(targetSalesCopy) > 0 {
		// We trust the target sale highly, but KTarget controls target shrinkage rate
		baseLog = BayesianShrinkage(targetMedianLog, shrunkExactNativeLog, targetNEff, cfg.KTarget)
	} else {
		baseLog = shrunkExactNativeLog
	}

	// Compute MAD for uncertainty
	mad = WeightedMAD(exactLogPrices, exactWeights, exactMedianLog)

	// Collect sale IDs for auditing
	for _, s := range targetSalesCopy {
		if s.ID > 0 {
			saleIDs = append(saleIDs, s.ID)
		}
	}
	for _, s := range exactSalesCopy {
		if s.ID > 0 {
			saleIDs = append(saleIDs, s.ID)
		}
	}
	for _, s := range broadSalesCopy {
		if s.ID > 0 {
			saleIDs = append(saleIDs, s.ID)
		}
	}

	// NOTE: baseLog is already in native-length log-space after target-vs-exact
	// shrinkage (shrunkExactNativeLog was denormalized at line 295).
	// No second denormalization needed — that was causing Double Denormalization bug.

	return baseLog, nEff, mad, saleIDs
}

// GetTier classifies a username into a rarity tier based on expected TON value
func GetTier(p float64) string {
	if p >= 1000000 {
		return "God Tier"
	}
	if p >= 500000 {
		return "Mythic"
	}
	if p >= 100000 {
		return "Apex"
	}
	if p >= 10000 {
		return "Grand"
	}
	if p >= 1000 {
		return "Uncommon"
	}
	return "Common"
}

// GetStars returns visual star ratings based on price tiers
func GetStars(p float64) string {
	if p >= 100000 {
		return "⭐⭐⭐⭐⭐"
	}
	if p >= 10000 {
		return "⭐⭐⭐"
	}
	return "⭐"
}
