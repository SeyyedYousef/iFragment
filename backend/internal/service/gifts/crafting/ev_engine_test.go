package crafting

import (
	"context"
	"testing"
)

func TestCraftingEV_MonteCarloDeterminism(t *testing.T) {
	ctx := context.Background()

	inputs := []CraftInputItem{
		{GiftID: "pepe-42", ModelID: "plush_pepe", Name: "Plush Pepe #42", EstimatedValueGRAM: 120, CraftChancePermille: 250},
		{GiftID: "pepe-7", ModelID: "plush_pepe", Name: "Plush Pepe #7", EstimatedValueGRAM: 240, CraftChancePermille: 250},
	}

	// Two runs with the exact same seed must produce identical outputs
	seed := int64(1337)
	res1, err1 := CalculateCraftingEV(ctx, inputs, 5.50, seed)
	if err1 != nil {
		t.Fatalf("Run 1 failed: %v", err1)
	}

	res2, err2 := CalculateCraftingEV(ctx, inputs, 5.50, seed)
	if err2 != nil {
		t.Fatalf("Run 2 failed: %v", err2)
	}

	if res1.NetEVGRAM != res2.NetEVGRAM {
		t.Errorf("Seed determinism failed: Run1 EV=%.2f != Run2 EV=%.2f", res1.NetEVGRAM, res2.NetEVGRAM)
	}
	if res1.DistributionP50 != res2.DistributionP50 {
		t.Errorf("Distribution P50 mismatch: %.2f vs %.2f", res1.DistributionP50, res2.DistributionP50)
	}
	if res1.SuccessProbability != 45.0 {
		t.Errorf("Expected 45%% success rate for 2 items, got %.1f%%", res1.SuccessProbability)
	}
}

func TestCraftingEV_CapSuccessAt100Percent(t *testing.T) {
	ctx := context.Background()

	// 4 inputs exceeding 1000 permille sum
	inputs := []CraftInputItem{
		{GiftID: "1", EstimatedValueGRAM: 50, CraftChancePermille: 400},
		{GiftID: "2", EstimatedValueGRAM: 50, CraftChancePermille: 400},
		{GiftID: "3", EstimatedValueGRAM: 50, CraftChancePermille: 400},
	}

	res, err := CalculateCraftingEV(ctx, inputs, 5.50, 42)
	if err != nil {
		t.Fatalf("Calculation failed: %v", err)
	}

	if res.SuccessProbability > 100.0 {
		t.Errorf("Success probability cannot exceed 100%%, got %.1f%%", res.SuccessProbability)
	}
}

func TestCraftingEV_BurnWarningPresent(t *testing.T) {
	ctx := context.Background()

	inputs := []CraftInputItem{
		{GiftID: "1", EstimatedValueGRAM: 100, CraftChancePermille: 500},
	}

	res, err := CalculateCraftingEV(ctx, inputs, 5.50, 42)
	if err != nil {
		t.Fatalf("Calculation failed: %v", err)
	}

	if res.BurnWarningNotice == "" {
		t.Error("Burn warning notice must be clearly present")
	}
}
