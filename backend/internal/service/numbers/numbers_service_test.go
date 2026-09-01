package numbers

import (
	"context"
	"testing"

	"ifragment-backend/internal/service/numbers/features"
	"ifragment-backend/internal/service/numbers/registry"
)

func TestNumbersService_GetNumbersIntel_Structure(t *testing.T) {
	svc := NewNumbersService(nil, nil, nil, nil)
	ctx := context.Background()

	intel, err := svc.GetNumbersIntel(ctx)
	if err != nil {
		t.Fatalf("unexpected error getting numbers intel: %v", err)
	}

	if intel.TotalSupply != registry.TotalSupply {
		t.Errorf("expected TotalSupply %d, got %d", registry.TotalSupply, intel.TotalSupply)
	}

	if len(intel.PercentileChart) == 0 {
		t.Errorf("expected PercentileChart to have points, got 0")
	}

	// Verify each chart point has valid P50 <= P68 <= P85
	for _, pt := range intel.PercentileChart {
		if pt.P50 <= 0 || pt.P68 <= 0 || pt.P85 <= 0 {
			t.Errorf("expected positive percentile values, got %+v", pt)
		}
		if pt.P50 > pt.P68 || pt.P68 > pt.P85 {
			t.Errorf("invariant violated: P50 <= P68 <= P85 failed for point %+v", pt)
		}
	}
}

func TestNumbersService_CuriosityGate(t *testing.T) {
	svc := NewNumbersService(nil, nil, nil, nil)
	ctx := context.Background()

	gate, err := svc.GetCuriosityGate(ctx, "+888 8888 8888")
	if err != nil {
		t.Fatalf("unexpected error getting curiosity gate: %v", err)
	}

	if gate.SignalsAnalyzed <= 0 {
		t.Errorf("expected positive signals analyzed, got %d", gate.SignalsAnalyzed)
	}

	if gate.Number != "+88888888888" {
		t.Errorf("expected normalized number +88888888888, got %s", gate.Number)
	}
}

func TestFeatures_NormalizationAndRarity(t *testing.T) {
	testCases := []struct {
		input       string
		expectedNum string
		valid       bool
	}{
		{"+888 8888 8888", "+88888888888", true},
		{"88801234567", "+88801234567", true},
		{"01234567", "+88801234567", true},
		{"invalid", "", false},
	}

	for _, tc := range testCases {
		norm, err := features.NormalizeNumber(tc.input)
		if tc.valid && err != nil {
			t.Errorf("expected valid for %s, got error: %v", tc.input, err)
		}
		if !tc.valid && err == nil {
			t.Errorf("expected error for %s, got %s", tc.input, norm)
		}
		if tc.valid && norm != tc.expectedNum {
			t.Errorf("expected %s, got %s", tc.expectedNum, norm)
		}
	}
}

func TestNumbersService_ScanWalletPortfolio_Empty(t *testing.T) {
	svc := NewNumbersService(nil, nil, nil, nil)
	ctx := context.Background()

	res, err := svc.ScanWalletPortfolio(ctx, "EQBPsG9cmIq0V56Hlkd-7YkR0O1qJcDk1so_nomdKG7GT3gH")
	if err != nil {
		t.Fatalf("unexpected error scanning wallet portfolio: %v", err)
	}

	if res.TotalAssets != 0 {
		t.Errorf("expected 0 assets for mock empty scan, got %d", res.TotalAssets)
	}
	if len(res.Assets) != 0 {
		t.Errorf("expected empty assets list, got %d", len(res.Assets))
	}
}

func TestNumbersService_VerifyNumber(t *testing.T) {
	svc := NewNumbersService(nil, nil, nil, nil)
	ctx := context.Background()

	testCases := []struct {
		input       string
		expectedNum string
		isMinted    bool
		isGenesis   bool
	}{
		{"+888 0000 0000", "+88800000000", true, false},
		{"+888 8888 8888", "+88888888888", true, false},
		{"+888 8004", "+8888004", true, true},
		{"+888 8000", "+8888000", true, true},
		{"+888 123", "", false, false},
	}

	for _, tc := range testCases {
		res, err := svc.VerifyNumber(ctx, tc.input)
		if err != nil {
			t.Fatalf("unexpected error verifying %s: %v", tc.input, err)
		}
		if res.IsMinted != tc.isMinted {
			t.Errorf("for input %s, expected isMinted=%v, got %v (error: %s)", tc.input, tc.isMinted, res.IsMinted, res.Error)
		}
		if tc.isMinted && res.Number != tc.expectedNum {
			t.Errorf("for input %s, expected number %s, got %s", tc.input, tc.expectedNum, res.Number)
		}
		if tc.isGenesis && res.Tier != "4-DIGIT ULTRA (GENESIS)" {
			t.Errorf("for genesis input %s, expected 4-DIGIT ULTRA tier, got %s", tc.input, res.Tier)
		}
	}
}

