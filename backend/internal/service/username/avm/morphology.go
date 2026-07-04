package avm

import "math"

// MorphFeatures describes the morphological properties of a username
// used for multiplier stacking and confounder isolation.
type MorphFeatures struct {
	HasNumbers    bool
	HasUnderscore bool
	IsDictionary  bool
	CharLength    int
}

// CalcMorphologyLog computes the clamped sum of log-multipliers.
//
// Confounder isolation: When calculating the premium for a flag,
// overlapping flags are excluded. For example, when `has_numbers=true`
// AND `is_dictionary=true`, the `has_numbers` discount is suppressed
// because the dictionary premium already accounts for value.
//
// Stacking clamp: max(ln(0.35), min(Morph_log, ln(4.0)))
func CalcMorphologyLog(features MorphFeatures, multipliers map[string]float64, cfg EngineConfig) float64 {
	var morphLog float64

	// Dictionary word premium (strongest signal)
	if features.IsDictionary {
		if m, ok := multipliers["is_dictionary"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}

	// has_numbers discount — ONLY if NOT a dictionary word (confounder isolation)
	if features.HasNumbers && !features.IsDictionary {
		if m, ok := multipliers["has_numbers"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}

	// has_underscore discount
	if features.HasUnderscore {
		if m, ok := multipliers["has_underscore"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}

	// Length-based premiums (mutually exclusive)
	switch {
	case features.CharLength == 4:
		if m, ok := multipliers["short_4"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	case features.CharLength == 5:
		if m, ok := multipliers["short_5"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}

	// Clean name premium (no underscore)
	if !features.HasUnderscore {
		if m, ok := multipliers["no_underscore"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}

	// Clamp the total morph log
	return clamp(morphLog, cfg.MorphClampLow, cfg.MorphClampHigh)
}

// CalcSmoothedMomentum computes smoothed volume-weighted momentum with Laplace smoothing.
//
// R_vol = (count_30 + α) / 30.0 / ((count_31_90 + 2α) / 60.0)
// Momentum_log = ln(R_vol * PriceTrend)
// Clamped to [ln(0.8), ln(1.25)]
//
// PriceTrend is the ratio of recent median price to older median price (default 1.0 if unknown).
func CalcSmoothedMomentum(count30, count31_90 int, priceTrend float64, cfg EngineConfig) float64 {
	alpha := cfg.LaplaceAlpha

	// Volume rate with Laplace smoothing
	recentRate := (float64(count30) + alpha) / 30.0
	olderRate := (float64(count31_90) + 2*alpha) / 60.0

	var rVol float64
	if olderRate > 0 {
		rVol = recentRate / olderRate
	} else {
		rVol = 1.0
	}

	// If price trend is not provided or invalid, default to neutral
	if priceTrend <= 0 {
		priceTrend = 1.0
	}

	momentumLog := math.Log(rVol * priceTrend)

	return clamp(momentumLog, cfg.MomentumClampLow, cfg.MomentumClampHigh)
}

// CalcRangeLog computes the expected value and range bounds in log-space.
//
//	Expected_log = Base_log + Morph_log + Momentum_log
//	W_min = ln(1 + min_pct)
//	Width = max(WeightedMAD * UncertaintyMult, W_min)
//	Low  = exp(Expected_log - Width)
//	High = exp(Expected_log + Width)
func CalcRangeLog(baseLog, morphLog, momentumLog, mad float64, cfg EngineConfig) (expectedTON, lowTON, highTON float64) {
	expectedLog := baseLog + morphLog + momentumLog

	// Width guard
	wMin := math.Log(1 + cfg.MinPct)
	width := math.Max(mad*cfg.UncertaintyMult, wMin)

	expectedTON = math.Exp(expectedLog)
	lowTON = math.Exp(expectedLog - width)
	highTON = math.Exp(expectedLog + width)

	// Sanity: low must not be negative
	if lowTON < 0 {
		lowTON = 0
	}

	return expectedTON, lowTON, highTON
}

// clamp restricts a value to [low, high].
func clamp(v, low, high float64) float64 {
	if v < low {
		return low
	}
	if v > high {
		return high
	}
	return v
}
