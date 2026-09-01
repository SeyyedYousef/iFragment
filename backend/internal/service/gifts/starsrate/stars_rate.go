package starsrate

import (
	"math"
)

// Standard Telegram Stars constants (referencing Chapter 13 of Telegram Gifts Encyclopedia)
const (
	// StarsPerUSD is the base peg for Telegram Stars (500 Stars ≈ $10 USD => 50 Stars / $1 USD)
	StarsPerUSD = 500.0 / 10.0 // 50 Stars per $1 USD
)

// StarsRateService handles unified dynamic conversions between Stars, TON (GRAM), and USD
type StarsRateService struct{}

func NewStarsRateService() *StarsRateService {
	return &StarsRateService{}
}

// ConvertStarsToGRAM converts Telegram Stars to TON based on the live TON/USD rate
func ConvertStarsToGRAM(stars int, tonUsdRate float64) float64 {
	if tonUsdRate <= 0 {
		tonUsdRate = 5.50
	}
	// Total USD = stars / StarsPerUSD
	usdVal := float64(stars) / StarsPerUSD
	// GRAM = usdVal / tonUsdRate
	gramVal := usdVal / tonUsdRate
	return math.Round(gramVal*1000.0) / 1000.0
}

// ConvertGRAMToStars converts TON to Telegram Stars based on the live TON/USD rate
func ConvertGRAMToStars(gram float64, tonUsdRate float64) int {
	if tonUsdRate <= 0 {
		tonUsdRate = 5.50
	}
	// Total USD = gram * tonUsdRate
	usdVal := gram * tonUsdRate
	// Stars = usdVal * StarsPerUSD
	stars := int(math.Round(usdVal * StarsPerUSD))
	if stars < 0 {
		stars = 0
	}
	return stars
}

// ConvertStarsToUSD converts Stars to USD value
func ConvertStarsToUSD(stars int) float64 {
	return math.Round((float64(stars)/StarsPerUSD)*100.0) / 100.0
}
