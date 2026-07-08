package avm

const ModelVersion = "avm_v5.1"

// EngineConfig holds all hyperparameters for the AVM math engine.
// These are snapshot-persisted with every valuation run for reproducibility.
type EngineConfig struct {
	// Time-decay parameter for exponential weighting (higher = faster decay)
	Lambda float64 `json:"lambda"`

	// Bayesian maturity threshold — controls shrinkage blend between exact and broad
	K float64 `json:"k"`

	// Bayesian target shrinkage threshold
	KTarget float64 `json:"k_target"`

	// Annual market appreciation rate
	AppreciationRate float64 `json:"appreciation_rate"`

	// Morphology stacking clamp bounds (in log-space)
	MorphClampLow  float64 `json:"morph_clamp_low"`  // ln(0.20)
	MorphClampHigh float64 `json:"morph_clamp_high"` // ln(4.0)

	// Momentum clamp bounds (in log-space)
	MomentumClampLow  float64 `json:"momentum_clamp_low"`  // ln(0.8)
	MomentumClampHigh float64 `json:"momentum_clamp_high"` // ln(1.25)

	// Laplace smoothing alpha for momentum volume rates
	LaplaceAlpha float64 `json:"laplace_alpha"`

	// Minimum percentage for range width guard
	MinPct float64 `json:"min_pct"`

	// MAD multiplier for uncertainty width
	UncertaintyMult float64 `json:"uncertainty_mult"`

	// Sale type normalization factors: auction=1.0 is the reference
	NormFactorAuction float64 `json:"norm_factor_auction"`
	NormFactorBuyNow  float64 `json:"norm_factor_buy_now"`
	NormFactorOffer   float64 `json:"norm_factor_offer"`

	// Fallback anchor values
	FallbackLen4 float64 `json:"fallback_len_4"`
	FallbackLen5 float64 `json:"fallback_len_5"`
	FallbackLen6 float64 `json:"fallback_len_6"`
	FallbackOther float64 `json:"fallback_other"`

	// Clamps and dampings
	ClampLowLimit    float64 `json:"clamp_low_limit"`
	ClampLowExpected float64 `json:"clamp_low_expected"`
	MorphDamping     float64 `json:"morph_damping"`

	// Morphology premium multipliers (PiT calibrated)
	MorphMultipliers map[string]float64 `json:"morph_multipliers"`
}

// DefaultEngineConfig returns production-grade defaults.
func DefaultEngineConfig() EngineConfig {
	return EngineConfig{
		Lambda: 0.005, // ~0.5% decay per day → 50% weight at ~138 days

		K: 10.0, // Bayesian maturity threshold
		KTarget: 0.4, // Target Bayesian shrinkage threshold
		AppreciationRate: 0.20, // CAGR for TON usernames (20%)

		MorphClampLow:  -1.6094379, // ln(0.20)
		MorphClampHigh: 1.3862944,  // ln(4.0) -> capped at 4x multiplier

		MomentumClampLow:  -0.2231, // ln(0.8)
		MomentumClampHigh: 0.2231,  // ln(1.25)

		LaplaceAlpha: 1.0,

		MinPct:          0.15, // minimum 15% range width
		UncertaintyMult: 1.5,

		NormFactorAuction: 1.00,
		NormFactorBuyNow:  0.85,
		NormFactorOffer:   1.10,

		FallbackLen4: 250.0,
		FallbackLen5: 50.0,
		FallbackLen6: 15.0,
		FallbackOther: 5.0,

		ClampLowLimit:    5.0,
		ClampLowExpected: 100.0,
		MorphDamping:     0.1,

		MorphMultipliers: map[string]float64{
			"has_numbers":          0.70, // discount for containing numbers
			"has_underscore":       0.60, // discount for underscore
			"fake_suffix":          0.20, // heavy discount for fake copycat suffixes (80% drop)
			"fake_prefix":          0.30, // discount for fake prefixes like real_ (70% drop)
			"repetition_penalty":   0.65, // discount for 3+ consecutive repeating chars (35% drop)
			"symmetric_repetition_premium": 1.50, // premium for repeating single char words like xxxx
			"num_underscore_combo": 0.50, // extra penalty for having both numbers and underscore
			"flow_high":            1.30, // premium for high pronounceability
			"flow_low":             0.60, // penalty for unpronounceable names
			"no_underscore":        1.15, // mild premium for clean names
			
			// Phase 4 New Multipliers
			"brandable_suffix": 1.40,
			"known_acronym":    1.80,
			"visual_symmetry":  1.15,
			"mobile_typing":    1.10,
			"pattern_abab":     1.25,
			"pattern_aabb":     1.10,
		},
	}
}

// NormFactor returns the sale type normalization factor for a given sale type.
func (c EngineConfig) NormFactor(saleType string) float64 {
	switch saleType {
	case "auction":
		return c.NormFactorAuction
	case "buy_now":
		return c.NormFactorBuyNow
	case "offer":
		return c.NormFactorOffer
	default:
		return 1.0
	}
}
