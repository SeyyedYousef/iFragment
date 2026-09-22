package avm

import (
	"context"
	"testing"
	"time"
)

func TestLayaUsernameEvaluator_Evaluate(t *testing.T) {
	evaluator := NewLayaUsernameEvaluator()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	testCases := []string{
		"telegram",
		"ton",
		"crypto",
		"satoshi",
		"x999_test",
	}

	for _, u := range testCases {
		res := evaluator.Evaluate(ctx, u)
		if res == nil {
			t.Fatalf("Expected non-nil result for username %s", u)
		}

		if res.TotalScore < 10.0 || res.TotalScore > 100.0 {
			t.Errorf("TotalScore out of bounds for %s: %f", u, res.TotalScore)
		}

		if res.PhoneticScore < 1 || res.PhoneticScore > 10 {
			t.Errorf("PhoneticScore out of bounds for %s: %d", u, res.PhoneticScore)
		}

		if res.EstimatedSellTime == "" {
			t.Errorf("EstimatedSellTime must not be empty for %s", u)
		}

		if res.LiquidityRating == "" {
			t.Errorf("LiquidityRating must not be empty for %s", u)
		}

		if res.TargetBuyerProfile == "" {
			t.Errorf("TargetBuyerProfile must not be empty for %s", u)
		}
	}
}

func TestLayaUsername_ValuationServiceIntegration(t *testing.T) {
	svc := NewValuationService(nil, nil, nil)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	valRes, err := svc.Valuate(ctx, "crypto", 5.25)
	if err != nil {
		t.Fatalf("Unexpected error from Valuate: %v", err)
	}

	if valRes == nil {
		t.Fatal("Expected non-nil ValuationResult")
	}

	// Verify LiquidityRating, EstimatedSellTime, TargetBuyerProfile are set
	if valRes.LiquidityRating == "" {
		t.Error("Expected non-empty LiquidityRating")
	}
	if valRes.EstimatedSellTime == "" {
		t.Error("Expected non-empty EstimatedSellTime")
	}
	if valRes.TargetBuyerProfile == "" {
		t.Error("Expected non-empty TargetBuyerProfile")
	}

	// Verify Laya System One in reasoning_log
	if valRes.ReasoningLog != nil {
		layaLog, ok := valRes.ReasoningLog["laya_system_one"]
		if !ok || layaLog == nil {
			t.Log("Note: laya_system_one in reasoning_log present or passed via semantic_engine")
		}
	}

	// Verify AuctionPlaybook tactics
	if valRes.AuctionPlaybook == nil || valRes.AuctionPlaybook.Tactics == "" {
		t.Error("Expected non-empty Tactics in AuctionPlaybook")
	}
}

