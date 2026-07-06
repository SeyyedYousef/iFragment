package avm

const ModelVersion = "avm_v4.1"

// EngineConfig holds all hyperparameters for the AVM math engine.
// These are snapshot-persisted with every valuation run for reproducibility.
type EngineConfig struct {
	// Time-decay parameter for exponential weighting (higher = faster decay)
	Lambda float64 `json:"lambda"`

	// Bayesian maturity threshold — controls shrinkage blend between exact and broad
	K float64 `json:"k"`

	// Morphology stacking clamp bounds (in log-space)
	MorphClampLow  float64 `json:"morph_clamp_low"`  // ln(0.35)
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
	FallbackExact float64 `json:"fallback_exact"`
	FallbackBroad float64 `json:"fallback_broad"`
	FallbackChar4 float64 `json:"fallback_char_4"`
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
		Lambda: 0.01, // ~1% decay per day → 50% weight at ~69 days

		K: 5.0, // Bayesian maturity threshold

		MorphClampLow:  -1.0498, // ln(0.35)
		MorphClampHigh: 4.6051,  // ln(100.0) -> allows up to 100x multiplier

		MomentumClampLow:  -0.2231, // ln(0.8)
		MomentumClampHigh: 0.2231,  // ln(1.25)

		LaplaceAlpha: 1.0,

		MinPct:          0.15, // minimum 15% range width
		UncertaintyMult: 1.5,

		NormFactorAuction: 1.00,
		NormFactorBuyNow:  0.85,
		NormFactorOffer:   1.10,

		FallbackExact: 5000.0,
		FallbackBroad: 200.0,
		FallbackChar4: 20.0,
		FallbackOther: 5.0,

		ClampLowLimit:    50.0,
		ClampLowExpected: 5050.0,
		MorphDamping:     0.1,

		MorphMultipliers: map[string]float64{
			"has_numbers":     0.70, // discount for containing numbers
			"has_underscore":  0.60, // discount for underscore
			"is_dictionary":   2.50, // premium for dictionary words
			"short_4":         3.00, // premium for 4-char
			"short_5":         1.80, // premium for 5-char
			"no_underscore":   1.15, // mild premium for clean names
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
