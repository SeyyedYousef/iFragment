package starsrate

import (
	"math"
)

// StarsParityMetrics models the pricing corridor between Telegram Stars (XTR) in-app and on-chain TON/GRAM
type StarsParityMetrics struct {
	BaseStarsPrice       int     `json:"base_stars_price"`        // Initial in-app Stars mint price
	UpgradeCostStars     int     `json:"upgrade_cost_stars"`      // Telegram fee in Stars to mint as on-chain NFT
	TotalCreationCostUSD float64 `json:"total_creation_cost_usd"` // Total cost in USD to create a new on-chain NFT Gift
	IntrinsicFloorGRAM   float64 `json:"intrinsic_floor_gram"`    // Theoretical floor support in GRAM
	IntrinsicFloorUSD    float64 `json:"intrinsic_floor_usd"`
	ArbitrageOpportunity bool    `json:"arbitrage_opportunity"`   // True if secondary market is cheaper than in-app mint+upgrade
	ArbitrageDiscountPct float64 `json:"arbitrage_discount_pct"`
	DescriptionEn        string  `json:"description_en"`
	DescriptionFa        string  `json:"description_fa"`
}

// CalculateStarsParity computes the intrinsic creation floor and in-app arbitrage spread
func CalculateStarsParity(baseStars int, gramUsdRate float64, currentMarketGRAM float64) StarsParityMetrics {
	if baseStars <= 0 {
		baseStars = 1000
	}
	if gramUsdRate <= 0 {
		gramUsdRate = 5.50
	}

	// 1. Fixed Telegram upgrade fee in Stars (standard 1,000 to 2,000 Stars)
	upgradeStars := 1500
	if baseStars <= 1000 {
		upgradeStars = 750
	} else if baseStars >= 10000 {
		upgradeStars = 2500
	}

	// 2. Average market acquisition rate per Star ($0.019 USD/Star via Telegram/Fragment)
	starUsdRate := 0.019

	totalStars := baseStars + upgradeStars
	totalCostUSD := float64(totalStars) * starUsdRate
	intrinsicFloorGRAM := totalCostUSD / gramUsdRate

	// 3. Evaluate In-App vs On-Chain Secondary Market Arbitrage
	isArb := false
	arbDiscount := 0.0
	if currentMarketGRAM > 0 && currentMarketGRAM < intrinsicFloorGRAM {
		isArb = true
		arbDiscount = ((intrinsicFloorGRAM - currentMarketGRAM) / intrinsicFloorGRAM) * 100.0
	}

	descEn := "Secondary on-chain trading at healthy premium over in-app Stars creation cost."
	descFa := "معاملات آن‌چین در سطحی بالاتر از هزینه تولید و ارتقای درون‌برنامه‌ای استارز انجام می‌شود."

	if isArb {
		descEn = "Positive Arbitrage: Secondary NFT price is cheaper than minting and upgrading with Stars."
		descFa = "فرصت آربیتراژ مثبت: خرید این گیفت در بازار ثانویه ارزان‌تر از خرید استارز و ارتقای درون‌برنامه‌ای است."
	}

	return StarsParityMetrics{
		BaseStarsPrice:       baseStars,
		UpgradeCostStars:     upgradeStars,
		TotalCreationCostUSD: math.Round(totalCostUSD*100.0) / 100.0,
		IntrinsicFloorGRAM:   math.Round(intrinsicFloorGRAM*100.0) / 100.0,
		IntrinsicFloorUSD:    math.Round(totalCostUSD*100.0) / 100.0,
		ArbitrageOpportunity: isArb,
		ArbitrageDiscountPct: math.Round(arbDiscount*10.0) / 10.0,
		DescriptionEn:        descEn,
		DescriptionFa:        descFa,
	}
}
