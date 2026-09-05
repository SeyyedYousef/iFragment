package gifts

import (
	"context"
	"testing"

	"ifragment-backend/internal/service/gifts/traits"
)

func TestGetCollectionIntel_All120Collections(t *testing.T) {
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
		if intel.FloorItem == nil {
			t.Errorf("[%s] FloorItem is nil", col.ModelID)
		}
		if len(intel.TopFloorItems) != 10 {
			t.Errorf("[%s] TopFloorItems expected 10, got %d", col.ModelID, len(intel.TopFloorItems))
		}
		if intel.OnSaleStats.TotalCount <= 0 {
			t.Errorf("[%s] OnSaleStats.TotalCount should be > 0", col.ModelID)
		}
	}
}
