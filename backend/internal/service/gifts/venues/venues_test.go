package venues

import (
	"context"
	"testing"
)

func TestVenues_ExitPlannerCalculations(t *testing.T) {
	ctx := context.Background()
	targetPrice := 100.0 // 100 GRAM
	gramUsdRate := 5.50

	plan := ComputeExitPlan(ctx, targetPrice, gramUsdRate, 100)

	if len(plan.Options) != 7 {
		t.Fatalf("Expected 7 exit venue options, got %d", len(plan.Options))
	}

	// Verify options are strictly sorted descending by NetPayoutGRAM
	for i := 1; i < len(plan.Options); i++ {
		prev := plan.Options[i-1]
		curr := plan.Options[i]
		if prev.NetPayoutGRAM < curr.NetPayoutGRAM {
			t.Errorf("Exit options not sorted descending: #%d (%.2f) < #%d (%.2f)", prev.Rank, prev.NetPayoutGRAM, curr.Rank, curr.NetPayoutGRAM)
		}
	}

	// Verify Fragment has KYC flag
	var fragmentOpt *ExitOption
	for _, opt := range plan.Options {
		if opt.VenueID == VenueFragment {
			fragmentOpt = &opt
			break
		}
	}
	if fragmentOpt == nil || !fragmentOpt.RequiresKYC {
		t.Error("Fragment exit option must require KYC")
	}

	// Verify MRKT has 0% fee
	var mrktOpt *ExitOption
	for _, opt := range plan.Options {
		if opt.VenueID == VenueMRKT {
			mrktOpt = &opt
			break
		}
	}
	if mrktOpt == nil || mrktOpt.FeePercent != 0.0 {
		t.Error("MRKT must have 0% fee")
	}
}

func TestVenues_AdaptersRegistry(t *testing.T) {
	frag := NewFragmentAdapter()
	if frag.ID() != VenueFragment || frag.Name() != "Fragment" {
		t.Errorf("Fragment adapter ID or Name incorrect")
	}
	if frag.ProtocolFeePct().InexactFloat64() != 5.0 {
		t.Errorf("Fragment fee must be 5.0%%")
	}

	gems := NewGetgemsAdapter()
	if gems.ID() != VenueGetgems || gems.Name() != "Getgems" {
		t.Errorf("Getgems adapter ID or Name incorrect")
	}

	marketApp := NewMarketAppAdapter()
	if marketApp.ID() != VenueMarketApp {
		t.Errorf("MarketApp adapter ID incorrect")
	}
}
