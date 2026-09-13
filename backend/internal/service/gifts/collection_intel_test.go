package gifts

import (
	"context"
	"strings"
	"testing"

	"ifragment-backend/internal/service/gifts/traits"
)

func TestGetCollectionIntel_All120Collections_TruthfulNilHandling(t *testing.T) {
	svc := &GiftsService{}
	ctx := context.Background()

	allCols := traits.GetGlobalCatalog().GetAllCollections()
	if len(allCols) == 0 {
		t.Fatalf("no canonical collections found")
	}

	for _, col := range allCols {
		intel, err := svc.GetCollectionIntel(ctx, col.ModelID)
		if err != nil {
			t.Errorf("[%s] GetCollectionIntel failed: %v", col.ModelID, err)
			continue
		}
		if intel == nil {
			t.Errorf("[%s] intel is nil", col.ModelID)
			continue
		}
		expectedSlug := strings.ReplaceAll(col.ModelID, "_", "-")
		if intel.CollectionSlug != expectedSlug && intel.CollectionSlug != col.ModelID {
			t.Errorf("[%s] expected CollectionSlug %s, got %s", col.ModelID, expectedSlug, intel.CollectionSlug)
		}

		// When no live venue snapshots or indexer listings are connected,
		// the system MUST NOT fabricate fake floors, fake top floor items, or sin/cos charts.
		if intel.BestFloorGRAM != nil {
			t.Errorf("[%s] expected nil BestFloorGRAM when no snapshots in DB, got %v", col.ModelID, *intel.BestFloorGRAM)
		}
		if intel.FloorItem != nil {
			t.Errorf("[%s] expected nil FloorItem without real listings, got %+v", col.ModelID, intel.FloorItem)
		}
		if len(intel.TopFloorItems) != 0 {
			t.Errorf("[%s] expected 0 TopFloorItems without real listings, got %d", col.ModelID, len(intel.TopFloorItems))
		}
		if len(intel.FloorHistory) != 0 {
			t.Errorf("[%s] expected 0 FloorHistory points without real DB history (no sin/cos), got %d", col.ModelID, len(intel.FloorHistory))
		}
		if intel.DataStatus != "unavailable" {
			t.Errorf("[%s] expected data_status 'unavailable', got %s", col.ModelID, intel.DataStatus)
		}
	}
}
