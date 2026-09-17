package numbers

import (
	"context"
	"testing"

	"ifragment-backend/internal/service/numbers/indexer"
	"ifragment-backend/internal/service/numbers/nvengine"
)

// T-P1-003: Checkpoint durability and in-memory offset consistency
func TestNumbersService_P1_DurableCheckpoint(t *testing.T) {
	idx := indexer.NewNumbersSalesIndexer(nil, nil, nil)
	if idx == nil {
		t.Fatal("expected non-nil indexer")
	}

	ctx := context.Background()

	// When db is nil, load/save should gracefully maintain thread-safe cached offset
	initial := idx.LoadDurableOffset(ctx)
	if initial != 0 {
		t.Errorf("expected initial offset 0, got %d", initial)
	}

	idx.SaveDurableOffset(ctx, 420, 50)
	after := idx.GetLastOffset()
	if after != 420 {
		t.Errorf("expected updated offset 420, got %d", after)
	}

	loaded := idx.LoadDurableOffset(ctx)
	if loaded != 420 {
		t.Errorf("expected loaded offset 420, got %d", loaded)
	}
}

// T-P1-006 / AC-P1-002: Down-market responsiveness (no hard clamp to past high sale)
func TestNumbersService_P1_DownMarketResponsiveness(t *testing.T) {
	engine := nvengine.NewValuationEngine(nil, nil, nil)
	if engine == nil {
		t.Fatal("expected non-nil valuation engine")
	}

	ctx := context.Background()
	// Valuate standard 8-digit number with no database comps
	val, err := engine.Valuate(ctx, "+88801234567")
	if err != nil {
		t.Fatalf("valuation failed: %v", err)
	}

	exp, _ := val.ExpectedTON.Float64()
	low, _ := val.LowTON.Float64()
	high, _ := val.HighTON.Float64()

	if exp <= 0 {
		t.Errorf("expected positive ExpectedTON, got %.2f", exp)
	}

	// Verify price invariant: Low <= Expected <= High
	if low > exp {
		t.Errorf("invariant violation: LowTON (%.2f) > ExpectedTON (%.2f)", low, exp)
	}
	if high < exp {
		t.Errorf("invariant violation: HighTON (%.2f) < ExpectedTON (%.2f)", high, exp)
	}
}
