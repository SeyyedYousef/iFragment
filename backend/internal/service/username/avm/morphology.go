package avm

import "math"

// MorphFeatures describes the morphological properties of a username
// used for multiplier stacking and confounder isolation.
type MorphFeatures struct {
	HasNumbers        bool
	HasUnderscore     bool
	HasCheapSuffix    bool
	HasCheapPrefix    bool
	HasRepetition     bool
	IsDictionary      bool
	CharLength        int
	FlowScore         float64
	IsPalindrome      bool
	IsKeyboardPattern bool
	IsCombo           bool
	ComboValue        float64
	IsTechPattern     bool
	HasGoldenYear     bool
	AffixBonus        float64
	TierMultiplier    float64
	FrequencyRank     int
	IsHyped           bool
	EuphonyScore      float64
	IsAesthetic       bool
	HasBrandableSuffix bool
	IsAcronym         bool
	IsUnderscoreCompound bool
	VisualSymmetry    float64
	IsABAB            bool
	IsAABB            bool
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
	if features.HasUnderscore {
		if m, ok := multipliers["has_underscore"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}
	
	// Double Penalty for Number + Underscore Combo
	if features.HasNumbers && features.HasUnderscore {
		if m, ok := multipliers["num_underscore_combo"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}
	
	// Underscore Compound Recovery
	if features.IsUnderscoreCompound && features.HasUnderscore {
		if m, ok := multipliers["has_underscore"]; ok && m > 0 {
			// Restore half of the penalty
			penaltyLog := math.Log(m)
			morphLog -= (penaltyLog / 2.0)
		}
	}

	// Fake/Cheap Suffix Penalty (anti-copycat)
	if features.HasCheapSuffix {
		if m, ok := multipliers["fake_suffix"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	} else if features.HasBrandableSuffix {
		if m, ok := multipliers["brandable_suffix"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}

	// Fake/Cheap Prefix Penalty
	if features.HasCheapPrefix {
		if m, ok := multipliers["fake_prefix"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}

	// Repetition Penalty (e.g. coooool)
	if features.HasRepetition {
		if m, ok := multipliers["repetition_penalty"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}
	
	// Pronounceability Premium/Penalty
	if features.FlowScore > 0.70 {
		if m, ok := multipliers["flow_high"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	} else if features.FlowScore < 0.30 {
		if m, ok := multipliers["flow_low"]; ok && m > 0 {
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
	case (features.CharLength == 6 || features.CharLength == 7) && features.IsDictionary:
		if m, ok := multipliers["dict_6_7_char"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}

	// Clean name premium (no underscore)
	if !features.HasUnderscore {
		if m, ok := multipliers["no_underscore"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}

	// Lexicon: Structure Bonus
	if features.IsPalindrome {
		morphLog += math.Log(1.5) // 50% bump for palindromes
	}
	if features.IsKeyboardPattern {
		morphLog += math.Log(1.5) // 50% bump for keyboard patterns
	}
	if features.IsTechPattern {
		morphLog += math.Log(2.0) // 100% bump for tech patterns
	}
	if features.HasGoldenYear {
		morphLog += math.Log(1.3) // 30% bump
	}
	if features.AffixBonus > 1.0 {
		morphLog += math.Log(features.AffixBonus)
	}

	// Lexicon: Tier & Combo Multipliers
	if features.IsCombo {
		// Scale down large multipliers so they stack nicely in log-space
		morphLog += math.Log(1.0 + features.ComboValue/5.0) 
	} else if features.TierMultiplier > 1.0 {
		morphLog += math.Log(1.0 + features.TierMultiplier/5.0)
	}
	
	// Phase 4 premiums
	if features.IsAcronym {
		if m, ok := multipliers["known_acronym"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}
	if features.IsABAB {
		if m, ok := multipliers["pattern_abab"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	} else if features.IsAABB {
		if m, ok := multipliers["pattern_aabb"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}
	if features.VisualSymmetry > 0.6 {
		if m, ok := multipliers["visual_symmetry"]; ok && m > 0 {
			morphLog += math.Log(m)
		}
	}

	// AI God-Tier: Social Hype & Aesthetics
	if features.IsHyped {
		morphLog += math.Log(10.0) // 10x multiplier for extremely hyped internet slang
	}
	if features.IsAesthetic {
		morphLog += math.Log(1.0 + features.EuphonyScore) // Smooth names get an aesthetic premium
	}

	// AI God-Tier: Word Popularity (N-gram Frequency)
	if features.FrequencyRank > 0 {
		if features.FrequencyRank <= 100 {
			morphLog += math.Log(10.0) // Top 100 words (e.g. 'the', 'time')
		} else if features.FrequencyRank <= 1000 {
			morphLog += math.Log(5.0)  // Top 1000 words (e.g. 'game', 'love')
		} else if features.FrequencyRank <= 5000 {
			morphLog += math.Log(2.0)  // Top 5000 words
		} else {
			morphLog += math.Log(1.5)  // Rest of top 10k
		}
	}

	// Lexicon: Garbage Penalty (Keyboard smashes)
	// If the name is unpronounceable and NOT a dictionary word/pure numeric, penalize it heavily.
	if features.FlowScore < 0.5 && !features.IsDictionary && features.CharLength > 4 && !features.HasNumbers && !features.HasUnderscore {
		morphLog -= 1.0 // Slashing the price by ~63%
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
func CalcRangeLog(baseLog, morphLog, momentumLog, semanticLog, mad float64, charLen int, cfg EngineConfig) (expectedTON, lowTON, highTON float64) {
	// Base expected log
	finalLog := baseLog + morphLog + momentumLog + semanticLog

	// Guard against absurdly low final logs
	if finalLog < 0 {
		finalLog = 0 // ~1 TON
	}
	
	// Width guard
	wMin := math.Log(1 + cfg.MinPct)
	width := math.Max(mad*cfg.UncertaintyMult, wMin)

	expectedTON = math.Exp(finalLog)
	lowTON = math.Exp(finalLog - width)
	highTON = math.Exp(finalLog + width)

	// Hard floors based on length
	if charLen == 4 && expectedTON < cfg.ClampLowExpected {
		expectedTON = cfg.ClampLowExpected
	}
	if charLen == 5 && expectedTON < cfg.ClampLowLimit {
		expectedTON = cfg.ClampLowLimit
	}

	// Floor safety
	if lowTON < 0 {
		lowTON = 0
	}
	if highTON < expectedTON {
		highTON = expectedTON * 1.5
	}
	if lowTON > expectedTON {
		lowTON = expectedTON * 0.5
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
