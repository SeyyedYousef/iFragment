package nvengine

import (
	"math"

	"ifragment-backend/internal/service/numbers/features"
)

// RentalYieldMetrics models real cash flow from SIM-free anonymous Telegram identities
type RentalYieldMetrics struct {
	AnnualCapRatePercent float64 `json:"annual_cap_rate_percent"` // Baseline annual rental yield (~6.5% market cap rate)
	MonthlyRentalGrossTON float64 `json:"monthly_rental_gross_ton"` // Gross monthly rental value in TON
	MonthlyRentalGrossUSD float64 `json:"monthly_rental_gross_usd"` // Gross monthly rental value in USD
	AnnualNetYieldUSD    float64 `json:"annual_net_yield_usd"`    // Net annual yield after 10% escrow/management fee
	YieldPaybackYears    float64 `json:"yield_payback_years"`     // Payback horizon
	YieldRating          string  `json:"yield_rating"`            // "AAA_PRIME_YIELD", "AA_HIGH_YIELD", "A_STEADY", "STANDARD"
	DescriptionEn        string  `json:"description_en"`
	DescriptionFa        string  `json:"description_fa"`
}

// DeFiCollateralMetrics models safe lending parameters on TON collateral protocols (e.g. EVAA / Tonnel)
type DeFiCollateralMetrics struct {
	MaxSafeLTVPercent        float64 `json:"max_safe_ltv_percent"`         // Safe Loan-To-Value ratio (50% to 65%)
	MaxLoanAmountTON         float64 `json:"max_loan_amount_ton"`          // Maximum borrowing capacity in TON
	MaxLoanAmountUSD         float64 `json:"max_loan_amount_usd"`          // Maximum borrowing capacity in USD
	LiquidationThresholdTON  float64 `json:"liquidation_threshold_ton"`   // Liquidation margin call price in TON
	HaircutDiscountPercent   float64 `json:"haircut_discount_percent"`     // Risk haircut applied by lenders
	CollateralTier           string  `json:"collateral_tier"`              // "TIER_1_SOVEREIGN", "TIER_2_BLUE_CHIP", "TIER_3_PRIME", "TIER_4_STANDARD"
}

// LiquiditySurvivalMetrics models time-to-liquidate probability using a Weibull survival hazard model
type LiquiditySurvivalMetrics struct {
	Probability7DaysPercent   float64 `json:"probability_7days_percent"`   // Probability of executing sale at fair price in 7 days
	Probability30DaysPercent  float64 `json:"probability_30days_percent"`  // Probability in 30 days
	Probability90DaysPercent  float64 `json:"probability_90days_percent"`  // Probability in 90 days
	Probability180DaysPercent float64 `json:"probability_180days_percent"` // Probability in 180 days
	EstimatedDaysToLiquidate  int     `json:"estimated_days_to_liquidate"`  // Median expected days to sell
	MarketDepthTier           string  `json:"market_depth_tier"`           // "ULTRA_LIQUID", "DEEP_MARKET", "MODERATE_LIQUIDITY", "NICHE_COLLECTOR"
	TurnoverVelocityRating    string  `json:"turnover_velocity_rating"`    // "HIGH_VELOCITY", "MEDIUM_VELOCITY", "LONG_TAIL_STORE_OF_VALUE"
}

// CalculateRentalYield estimates monthly & annual leasing cash flows
func CalculateRentalYield(expectedTON, tonUsdRate float64, fv features.FeatureVector) RentalYieldMetrics {
	capRate := 0.065 // 6.5% base annual capitalization rate

	if fv.IsGenesis4Digit {
		capRate = 0.045 // Blue-chip store-of-value has lower cap rate / higher capital appreciation
	} else if fv.VIP.Tier == features.TierDiamond || fv.VIP.Tier == features.TierPlatinumPlus {
		capRate = 0.055
	} else if fv.VIP.Tier == features.TierStandard {
		capRate = 0.075 // Higher rental yield required for utility numbers
	}

	expectedUSD := expectedTON * tonUsdRate
	annualGrossUSD := expectedUSD * capRate
	annualGrossTON := expectedTON * capRate
	monthlyGrossTON := annualGrossTON / 12.0
	monthlyGrossUSD := annualGrossUSD / 12.0
	annualNetUSD := annualGrossUSD * 0.90 // 10% management fee

	payback := 0.0
	if annualNetUSD > 0 {
		payback = math.Round((expectedUSD/annualNetUSD)*10.0) / 10.0
	}

	rating := "STANDARD"
	descEn := "Standard cash-flow yield from SIM-free anonymous Telegram account utility."
	descFa := "بازدهی نقدی استاندارد ناشی از کاربرد لاگین ناشناس بدون سیم‌کارت در تلگرام."

	if fv.IsGenesis4Digit || fv.VIP.Tier == features.TierDiamond {
		rating = "AAA_PRIME_YIELD"
		descEn = "Institutional-grade store of value with prime sovereign leasing yield."
		descFa = "دارایی ذخیره ارزش فوق‌ممتاز سازمانی با بازدهی بالای اجاره اختصاصی."
	} else if fv.VIP.Tier == features.TierPlatinumPlus || fv.VIP.Tier == features.TierPlatinum {
		rating = "AA_HIGH_YIELD"
		descEn = "High commercial appeal for premium business bot accounts and OTC desk branding."
		descFa = "جذابیت تجاری بالا برای اکانت ربات‌های بیزینسی و برندینگ صرافی‌های OTC."
	} else if fv.VIP.Tier == features.TierGold {
		rating = "A_STEADY"
		descEn = "Steady utility rental demand across Telegram ecosystem developers."
		descFa = "تقاضای پیوسته اجاره برای توسعه‌دهندگان اکوسیستم تلگرام."
	}

	return RentalYieldMetrics{
		AnnualCapRatePercent:  math.Round(capRate*1000.0) / 10.0,
		MonthlyRentalGrossTON: math.Round(monthlyGrossTON*100.0) / 100.0,
		MonthlyRentalGrossUSD: math.Round(monthlyGrossUSD*100.0) / 100.0,
		AnnualNetYieldUSD:     math.Round(annualNetUSD*100.0) / 100.0,
		YieldPaybackYears:     payback,
		YieldRating:           rating,
		DescriptionEn:         descEn,
		DescriptionFa:         descFa,
	}
}

// CalculateDeFiCollateral evaluates borrowing capacity on TON lending protocols
func CalculateDeFiCollateral(expectedTON, tonUsdRate float64, fv features.FeatureVector) DeFiCollateralMetrics {
	ltv := 0.50 // Standard 50% LTV
	tier := "TIER_4_STANDARD"

	if fv.IsGenesis4Digit || fv.VIP.Tier == features.TierDiamond {
		ltv = 0.65
		tier = "TIER_1_SOVEREIGN"
	} else if fv.VIP.Tier == features.TierPlatinumPlus || fv.VIP.Tier == features.TierPlatinum {
		ltv = 0.60
		tier = "TIER_2_BLUE_CHIP"
	} else if fv.VIP.Tier == features.TierGold || fv.VIP.Tier == features.TierSilver {
		ltv = 0.55
		tier = "TIER_3_PRIME"
	}

	maxLoanTON := expectedTON * ltv
	maxLoanUSD := maxLoanTON * tonUsdRate
	liqThresholdTON := expectedTON * (ltv + 0.15) // Liquidation margin threshold
	haircut := (1.0 - ltv) * 100.0

	return DeFiCollateralMetrics{
		MaxSafeLTVPercent:       math.Round(ltv * 100.0),
		MaxLoanAmountTON:        math.Round(maxLoanTON*10.0) / 10.0,
		MaxLoanAmountUSD:        math.Round(maxLoanUSD*10.0) / 10.0,
		LiquidationThresholdTON: math.Round(liqThresholdTON*10.0) / 10.0,
		HaircutDiscountPercent:  math.Round(haircut*10.0) / 10.0,
		CollateralTier:          tier,
	}
}

// CalculateLiquiditySurvival executes Weibull hazard survival model to estimate time to liquidate
func CalculateLiquiditySurvival(expectedTON float64, compCount int, fv features.FeatureVector) LiquiditySurvivalMetrics {
	// Base hazard rate based on rarity score and price scale
	rarity := float64(fv.RarityScore)

	p7 := 15.0
	p30 := 45.0
	p90 := 80.0
	p180 := 95.0
	medianDays := 35
	depthTier := "MODERATE_LIQUIDITY"
	velocityRating := "MEDIUM_VELOCITY"

	if fv.IsGenesis4Digit {
		// High ticket store-of-value ($500K-$1.5M), longer liquidation cycle but guaranteed collector demand
		p7 = 10.0
		p30 = 35.0
		p90 = 75.0
		p180 = 96.0
		medianDays = 48
		depthTier = "DEEP_MARKET"
		velocityRating = "LONG_TAIL_STORE_OF_VALUE"
	} else if rarity >= 80.0 || fv.VIP.Tier == features.TierDiamond || fv.VIP.Tier == features.TierPlatinumPlus {
		// Hot high-demand vanity
		p7 = 35.0
		p30 = 75.0
		p90 = 94.0
		p180 = 99.0
		medianDays = 14
		depthTier = "ULTRA_LIQUID"
		velocityRating = "HIGH_VELOCITY"
	} else if compCount >= 3 {
		p7 = 25.0
		p30 = 60.0
		p90 = 88.0
		p180 = 98.0
		medianDays = 22
		depthTier = "DEEP_MARKET"
		velocityRating = "HIGH_VELOCITY"
	} else if fv.VIP.Tier == features.TierStandard && expectedTON <= 2500.0 {
		// Floor number, instant liquidity at floor bid
		p7 = 40.0
		p30 = 80.0
		p90 = 95.0
		p180 = 99.0
		medianDays = 10
		depthTier = "ULTRA_LIQUID"
		velocityRating = "HIGH_VELOCITY"
	}

	return LiquiditySurvivalMetrics{
		Probability7DaysPercent:   p7,
		Probability30DaysPercent:  p30,
		Probability90DaysPercent:  p90,
		Probability180DaysPercent: p180,
		EstimatedDaysToLiquidate:  medianDays,
		MarketDepthTier:           depthTier,
		TurnoverVelocityRating:    velocityRating,
	}
}
