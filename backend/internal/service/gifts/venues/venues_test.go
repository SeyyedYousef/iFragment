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

	tonnel := NewTonnelAdapter()
	if tonnel.ID() != VenueTonnel || tonnel.Name() != "Tonnel Network" {
		t.Errorf("Tonnel adapter ID or Name incorrect")
	}
	if tonnel.ProtocolFeePct().InexactFloat64() != 3.0 {
		t.Errorf("Tonnel fee must be 3.0%%")
	}

	portals := NewPortalsAdapter()
	if portals.ID() != VenuePortals || portals.Name() != "Portals" {
		t.Errorf("Portals adapter ID or Name incorrect")
	}
	if portals.ProtocolFeePct().InexactFloat64() != 2.5 {
		t.Errorf("Portals fee must be 2.5%%")
	}

	mrkt := NewMRKTAdapter()
	if mrkt.ID() != VenueMRKT || mrkt.Name() != "MRKT" {
		t.Errorf("MRKT adapter ID or Name incorrect")
	}
	if !mrkt.ProtocolFeePct().IsZero() {
		t.Errorf("MRKT fee must be 0%%")
	}

	stars := NewTelegramStarsAdapter(nil)
	if stars.ID() != VenueTelegramStars || stars.Name() != "Telegram Stars" {
		t.Errorf("Stars adapter ID or Name incorrect")
	}

	// Test Snapshot worker initializes all 7 adapters
	worker := NewVenueSnapshotWorker(nil, nil, 0)
	if len(worker.adapters) != 7 {
		t.Errorf("Expected snapshot worker to have 7 adapters, got %d", len(worker.adapters))
	}
}
