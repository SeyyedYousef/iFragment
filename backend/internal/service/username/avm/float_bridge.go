package avm

import (
	"github.com/shopspring/decimal"
)

// precision is the number of decimal places for financial rounding.
const precision = 4

// ToFloat64 converts a decimal.Decimal to float64 for log-space math.
// This is the ONLY sanctioned entry point into float64 land.
func ToFloat64(d decimal.Decimal) float64 {
	f, _ := d.Float64()
	return f
}

// FromFloat64 converts a float64 back to decimal.Decimal,
// rounding to 4 decimal places to prevent arbitrary precision loss.
func FromFloat64(f float64) decimal.Decimal {
	return decimal.NewFromFloat(f).Round(int32(precision))
}

// NormalizeSalePrice applies sale-type normalization to convert
// a raw sale price to its auction-equivalent base.
// P_normalized = P_raw * C_sale_type
func NormalizeSalePrice(priceTON decimal.Decimal, saleType string, cfg EngineConfig) decimal.Decimal {
	factor := decimal.NewFromFloat(cfg.NormFactor(saleType))
	return priceTON.Mul(factor).Round(int32(precision))
}
