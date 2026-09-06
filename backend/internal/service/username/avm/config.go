package avm

// ModelVersion defines the active mathematical model version for the AVM engine.
// Bumped to v8.1 Master Calibrated: includes empirical anchor unification, 5D KNN floor expansion,
// length-aware multiplier limits, guaranteed comparables enrichment, and full-fidelity semantic mapping.
const ModelVersion = "avm_v8.1_master_calibrated"

// EngineConfig holds all hyperparameters for the AVM math engine.
// Every parameter is documented with its mathematical purpose, econometric rationale,
// and calibration method. These are snapshot-persisted with every valuation run for full auditability.
type EngineConfig struct {
	// Lambda: Time-decay parameter for exponential weighting w_i = exp(-lambda * days_ago).
	// Calibrated so that sales from ~138 days ago receive 50% weight (half-life).
	Lambda float64 `json:"lambda"`

	// K: Bayesian maturity threshold for blending exact and broad segment comparables.
	// Controls shrinkage: exactWeight = n_eff / (n_eff + K). Higher K demands more comps before trusting exact.
	K float64 `json:"k"`

	// KTarget: Target Bayesian shrinkage threshold for exact username past sales.
	// Low value (0.08) reflects very high econometric trust in the asset's own transaction record.
	KTarget float64 `json:"k_target"`

	// AppreciationRate: Annual market appreciation rate (CAGR) for TON usernames.
	// Standardized at 20% annualized growth based on Fragment volume indices.
	AppreciationRate float64 `json:"appreciation_rate"`

	// MaxAppreciationYears: Maximum time horizon (years) for compounding appreciation.
	// Prevents explosive runaway valuations on very old historical anchors (e.g. capped at 8 years).
	MaxAppreciationYears float64 `json:"max_appreciation_years"`

	// Morphology stacking clamp bounds (in log-space)
	MorphClampLow  float64 `json:"morph_clamp_low"`  // ln(0.20) -> max 80% discount
	MorphClampHigh float64 `json:"morph_clamp_high"` // ln(4.00) -> max 4x multiplier

	// Momentum clamp bounds (in log-space)
	MomentumClampLow  float64 `json:"momentum_clamp_low"`  // ln(0.80) -> max -20% cooldown
	MomentumClampHigh float64 `json:"momentum_clamp_high"` // ln(1.25) -> max +25% surge

	// LaplaceAlpha: Smoothing parameter for momentum transaction rate calculation (avoids divide-by-zero).
	LaplaceAlpha float64 `json:"laplace_alpha"`

	// MinPct: Minimum percentage width guard for confidence intervals (0.15 = 15%).
	MinPct float64 `json:"min_pct"`

	// UncertaintyMult: MAD multiplier for log-space uncertainty width.
	// Adaptively tuned by the calibration loop within bounds [1.0, 1.5].
	UncertaintyMult float64 `json:"uncertainty_mult"`

	// Sale type normalization factors: auction = 1.0 is the reference standard
	NormFactorAuction float64 `json:"norm_factor_auction"`
	NormFactorBuyNow  float64 `json:"norm_factor_buy_now"` // 0.85 = buy-now ask premium discount
	NormFactorOffer   float64 `json:"norm_factor_offer"`   // 1.10 = low-ball offer discount normalization

	// Fallback anchor values (official Fragment protocol baselines)
	FallbackLen3  float64 `json:"fallback_len_3"`  // 10,000 TON
	FallbackLen4  float64 `json:"fallback_len_4"`  // 5,050 TON
	FallbackLen5  float64 `json:"fallback_len_5"`  // 1,000 TON
	FallbackLen6  float64 `json:"fallback_len_6"`  // 100 TON
	FallbackOther float64 `json:"fallback_other"` // 25 TON

	// Clamps and dampings
	ClampLowLimit    float64 `json:"clamp_low_limit"`
	ClampLowExpected float64 `json:"clamp_low_expected"`
	MorphDamping     float64 `json:"morph_damping"`
	DatabaseDamping  float64 `json:"database_damping"`

	// Rent Yield Floor hyperparameters
	// RentCapMonths: Multiplier for monthly median rent (18 months of rent = rational purchase floor)
	RentCapMonths float64 `json:"rent_cap_months"`

	// Winsorization percentiles to mitigate outlier skew in comparable buckets
	WinsorizeP5  float64 `json:"winsorize_p5"`  // 0.05 (5th percentile lower clamp)
	WinsorizeP95 float64 `json:"winsorize_p95"` // 0.95 (95th percentile upper clamp)

	// Fear & Greed Segment Elasticity parameters
	FnGElasticityDefensive   float64 `json:"fng_elasticity_defensive"`   // 0.50 for dictionary/brands
	FnGElasticitySpeculative float64 `json:"fng_elasticity_speculative"` // 1.00 for hype/speculative
	FnGClampLow              float64 `json:"fng_clamp_low"`              // 0.90 (-10% maximum market discount)
	FnGClampHigh             float64 `json:"fng_clamp_high"`             // 1.10 (+10% maximum market premium)

	// Confidence Band Blending
	BandBlendNEffThreshold float64 `json:"band_blend_neff_threshold"` // 8.0 n_eff threshold for blending
	BandBlendMADWeight     float64 `json:"band_blend_mad_weight"`      // 0.70 empirical MAD weight
	BandBlendFixedWeight   float64 `json:"band_blend_fixed_weight"`    // 0.30 fixed band weight

	// Morphology premium multipliers (PiT calibrated)
	MorphMultipliers map[string]float64 `json:"morph_multipliers"`
}

// DefaultEngineConfig returns production-grade defaults calibrated on Fragment sales.
func DefaultEngineConfig() EngineConfig {
	return EngineConfig{
		Lambda: 0.005, // ~0.5% decay per day -> 50% weight at ~138 days

		K:                    10.0, // Bayesian maturity threshold
		KTarget:              0.08, // Target Bayesian shrinkage — high trust in actual sale history
		AppreciationRate:     0.20, // CAGR for TON usernames (20%)
		MaxAppreciationYears: 8.0,  // Max 8-year appreciation clamp horizon

		MorphClampLow:  -1.6094379, // ln(0.20)
		MorphClampHigh: 1.3862944,  // ln(4.0) -> capped at 4x multiplier

		MomentumClampLow:  -0.2231, // ln(0.80)
		MomentumClampHigh: 0.2231,  // ln(1.25)

		LaplaceAlpha: 1.0,

		MinPct:          0.15, // minimum 15% range width
		UncertaintyMult: 1.5,

		NormFactorAuction: 1.00,
		NormFactorBuyNow:  0.85,
		NormFactorOffer:   1.10,

		FallbackLen3:  10000.0, // Fragment official 3-character starting bid baseline
		FallbackLen4:  5050.0,  // Fragment official 4-character starting bid baseline
		FallbackLen5:  1000.0,  // Fragment official 5-character starting bid baseline
		FallbackLen6:  100.0,
		FallbackOther: 25.0,

		ClampLowLimit:    5.0,
		ClampLowExpected: 50.0,
		MorphDamping:     0.1,
		DatabaseDamping:  0.70,

		RentCapMonths: 18.0, // 18 months rent capitalization floor

		WinsorizeP5:  0.05,
		WinsorizeP95: 0.95,

		FnGElasticityDefensive:   0.50,
		FnGElasticitySpeculative: 1.00,
		FnGClampLow:              0.90,
		FnGClampHigh:             1.10,

		BandBlendNEffThreshold: 8.0,
		BandBlendMADWeight:     0.70,
		BandBlendFixedWeight:   0.30,

		MorphMultipliers: map[string]float64{
			"has_numbers":                  0.40, // 60% discount for containing numbers
			"has_underscore":               0.35, // 65% discount for containing underscore
			"fake_suffix":                  0.15, // 85% discount for fake copycat suffixes (_official, _admin, _bot)
			"fake_prefix":                  0.20, // 80% discount for fake copycat prefixes (real_, the_)
			"repetition_penalty":           0.60, // 40% discount for 3+ consecutive repeating chars
			"symmetric_repetition_premium": 1.50, // premium for repeating single char words like xxxx
			"num_underscore_combo":         0.25, // 75% discount for both numbers and underscore
			"flow_high":                    1.30, // premium for high pronounceability
			"flow_low":                     0.50, // 50% penalty for unpronounceable names
			"no_underscore":                1.15, // mild premium for clean names

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

