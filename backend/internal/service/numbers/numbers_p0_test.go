package numbers

import (
	"context"
	"testing"
)

func TestNumbersService_P0_NoSyntheticCatalogueOnOutage(t *testing.T) {
	svc := &NumbersService{
		db:    nil,
		cache: nil,
	}

	// Cancelled context ensures upstream http request immediately fails as an outage
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	params := NumbersListParams{
		Page: 1,
	}

	resp, err := svc.GetNumbersList(ctx, params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// RB-P0-001, DEL-P0-002: Must not fabricate canonical catalogue items
	if resp.DataStatus != "unavailable" {
		t.Errorf("expected DataStatus 'unavailable', got %q", resp.DataStatus)
	}
	if len(resp.Items) != 0 {
		t.Errorf("expected 0 items on outage, got %d", len(resp.Items))
	}
	for _, item := range resp.Items {
		if item.DataStatus == "canonical_catalogue" || item.LastSaleDate == "Telemint Mint" {
			t.Errorf("found forbidden synthetic item: %+v", item)
		}
	}
}

func TestNumbersService_P0_NoSinusoidalChartOnOutage(t *testing.T) {
	svc := &NumbersService{
		db:    nil,
		cache: nil,
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	chartResp, err := svc.GetChartData(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// RB-P0-002, DEL-P0-002, AC-P0-008: Must not generate 181 fake sinusoidal points
	if len(chartResp.Data) != 0 {
		t.Errorf("expected 0 chart points on outage, got %d points", len(chartResp.Data))
	}
}

func TestNumbersService_P0_NoFakeHallOfFame(t *testing.T) {
	svc := &NumbersService{
		db:    nil,
		cache: nil,
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	stats, err := svc.GetNumbersIntel(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// RB-P0-001, DEL-P0-002: Hall of fame must not contain fabricated entries on outage
	for _, h := range stats.HallOfFame {
		if h.PriceTON == 666666.0 || !h.Verified {
			t.Errorf("found forbidden unverified or fake HallOfFame price: %+v", h)
		}
	}
}
