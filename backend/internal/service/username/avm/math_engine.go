package avm

import (
	"math"
	"sort"
	"time"
)

type ComparableSale struct {
	ID            int64
	PriceTON      float64 // auction-equivalent normalized price
	SaleDate      time.Time
	CharLength    int
	// Morphology flags for confounder isolation
	HasNumbers    bool
	HasUnderscore bool
	IsDictionary  bool
}


// ApplyMarketAppreciation inflates the PriceTON of older sales based on a compounded annual growth rate.
// For example, if annualRate is 0.40 (40%), a sale from 2 years ago is multiplied by 1.40^2 = 1.96.
func ApplyMarketAppreciation(sales []ComparableSale, annualRate float64, now time.Time) {
	if annualRate <= 0 {
		return
	}
	for i, s := range sales {
		yearsAgo := now.Sub(s.SaleDate).Hours() / (24.0 * 365.25)
		if yearsAgo > 0 {
			multiplier := math.Pow(1.0+annualRate, yearsAgo)
			sales[i].PriceTON = s.PriceTON * multiplier
		}
	}
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

func fallbackForLength(length int, cfg EngineConfig) float64 {
	if length > 0 && length <= 3 {
		return cfg.FallbackLen4 * 6.0 // 1,500 TON baseline for 3-letter words
	}
	switch length {
	case 4:
		return cfg.FallbackLen4
	case 5:
		return cfg.FallbackLen5
	case 6:
		return cfg.FallbackLen6
	default:
		return cfg.FallbackOther
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
func DenormalizeFromLength5(price float64, targetLength int, cfg EngineConfig) float64 {
	if price <= 0 {
		return 0
	}
	f := fallbackForLength(targetLength, cfg)
	return price * (f / cfg.FallbackLen5)
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

	// Normalize all prices to 5-letter equivalent before calculating median
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

	targetSalesCopy := make([]ComparableSale, len(targetSales))
	for i, s := range targetSales {
		targetSalesCopy[i] = s
		targetSalesCopy[i].PriceTON = NormalizeToLength5(s.PriceTON, s.CharLength, cfg)
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
		if weight < 0.0 { weight = 0.0 }
		if weight > 1.0 { weight = 1.0 }
		
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

	// Shrink exact towards broad
	shrunkExact := broadMedianLog
	if len(exactSalesCopy) > 0 {
		shrunkExact = BayesianShrinkage(exactMedianLog, broadMedianLog, nEff, cfg.K)
	} else {
		nEff = 0.0 // broad only
	}

	// Shrink target towards shrunkExact
	if len(targetSalesCopy) > 0 {
		// We trust the target sale highly, but KTarget controls target shrinkage rate
		baseLog = BayesianShrinkage(targetMedianLog, shrunkExact, targetNEff, cfg.KTarget)
	} else {
		baseLog = shrunkExact
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

	// Denormalize computed baseLog (which is in 5-letter log-space) back to the target's length
	baseLog = math.Log(DenormalizeFromLength5(math.Exp(baseLog), features.CharLength, cfg))

	return baseLog, nEff, mad, saleIDs
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
	return math.Floor(n)
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
