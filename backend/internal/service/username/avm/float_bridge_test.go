package avm

import (
	"math"
	"testing"

	"github.com/shopspring/decimal"
)

func TestToFloat64(t *testing.T) {
	tests := []struct {
		name string
		in   decimal.Decimal
		want float64
	}{
		{"zero", decimal.Zero, 0.0},
		{"positive", decimal.NewFromFloat(123.4567), 123.4567},
		{"small", decimal.NewFromFloat(0.0001), 0.0001},
		{"large", decimal.NewFromFloat(999999.9999), 999999.9999},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ToFloat64(tt.in)
			if math.Abs(got-tt.want) > 1e-8 {
				t.Errorf("ToFloat64(%v) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

func TestFromFloat64(t *testing.T) {
	tests := []struct {
		name string
		in   float64
		want string // decimal string representation
	}{
		{"zero", 0.0, "0"},
		{"rounds_down", 123.45671, "123.4567"},
		{"rounds_up", 123.45675, "123.4568"},
		{"negative", -50.12345, "-50.1235"},
		{"very_small", 0.00001, "0"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := FromFloat64(tt.in)
			if got.String() != tt.want {
				t.Errorf("FromFloat64(%v) = %v, want %v", tt.in, got.String(), tt.want)
			}
		})
	}
}

func TestRoundTrip(t *testing.T) {
	original := decimal.NewFromFloat(42.1234)
	f := ToFloat64(original)
	back := FromFloat64(f)
	if !back.Equal(original) {
		t.Errorf("round-trip failed: %v -> %v -> %v", original, f, back)
	}
}

func TestNormalizeSalePrice(t *testing.T) {
	cfg := DefaultEngineConfig()
	price := decimal.NewFromFloat(100.0)

	tests := []struct {
		saleType string
		want     string
	}{
		{"auction", "100"},
		{"buy_now", "85"},
		{"offer", "110"},
		{"unknown", "100"},
	}
	for _, tt := range tests {
		t.Run(tt.saleType, func(t *testing.T) {
			got := NormalizeSalePrice(price, tt.saleType, cfg)
			if !got.Equal(decimal.RequireFromString(tt.want)) {
				t.Errorf("NormalizeSalePrice(100, %q) = %v, want %v", tt.saleType, got, tt.want)
			}
		})
	}
}
