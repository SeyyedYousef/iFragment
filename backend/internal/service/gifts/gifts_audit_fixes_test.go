package gifts

import (
	"context"
	"testing"

	"ifragment-backend/internal/service/gifts/crafting"
	"ifragment-backend/internal/service/gifts/gvengine"
	"ifragment-backend/internal/service/gifts/risk"
)

// TestAudit_RejectCollectionWithoutSerial verifies that passing a collection name alone (without serial number)
// is rejected with a clear error rather than defaulting to serial #1 (Bug 10).
func TestAudit_RejectCollectionWithoutSerial(t *testing.T) {
	testInputs := []string{
		"plush_pepe",
		"plush-pepe",
		"durov_cap",
		"durov-cap",
		"golden-star",
	}

	for _, input := range testInputs {
		ref, err := gvengine.NormalizeGiftIdentifier(input)
		if err == nil {
			t.Errorf("Expected error for collection-only input %q, but got valid ref: %+v", input, ref)
		}
	}

	// Valid inputs with serial must succeed
	validInputs := []struct {
		input  string
		model  string
		serial int
	}{
		{"plush-pepe-42", "plush_pepe", 42},
		{"PlushPepe1", "plush_pepe", 1},
		{"durov_cap-7", "durov_cap", 7},
	}

	for _, v := range validInputs {
		ref, err := gvengine.NormalizeGiftIdentifier(v.input)
		if err != nil {
			t.Errorf("Unexpected error for valid input %q: %v", v.input, err)
			continue
		}
		if ref.ModelID != v.model || ref.SerialNumber != v.serial {
			t.Errorf("Mismatch for %q: got model=%s, serial=%d; want model=%s, serial=%d",
				v.input, ref.ModelID, ref.SerialNumber, v.model, v.serial)
		}
	}
}

// TestAudit_RiskAuditorContractState verifies that smart contract verification state is honest (Bug 9).
func TestAudit_RiskAuditorContractState(t *testing.T) {
	ctx := context.Background()

	// "plush_pepe" collection has a known TON contract address
	resOfficial := risk.AuditGiftRisk(ctx, "plush_pepe", 1, 50, nil, nil)
	if resOfficial == nil {
		t.Fatalf("AuditGiftRisk returned nil for plush_pepe")
	}

	foundContractCheck := false
	for _, item := range resOfficial.RiskChecklist {
		if item.Key == "smart_contract" {
			foundContractCheck = true
			if !item.Passed {
				t.Errorf("Expected plush_pepe smart_contract check to pass with verified contract, got false")
			}
		}
	}
	if !foundContractCheck {
		t.Errorf("smart_contract risk item not found in checklist")
	}

	// Unofficial / fake collection should have Passed: false
	resFake := risk.AuditGiftRisk(ctx, "non_existent_fake_model", 1, 50, nil, nil)
	for _, item := range resFake.RiskChecklist {
		if item.Key == "smart_contract" {
			if item.Passed {
				t.Errorf("Expected fake model to fail smart_contract verification, got Passed: true")
			}
		}
	}
}

// TestAudit_CraftingEVSafety verifies that CalculateCraftingEV handles 1 to 4 items and calculates valid EV (Bug 6).
func TestAudit_CraftingEVSafety(t *testing.T) {
	ctx := context.Background()

	inputs := []crafting.CraftInputItem{
		{GiftID: "plush_pepe-10", ModelID: "plush_pepe", Name: "Plush Pepe #10", EstimatedValueGRAM: 15.0},
		{GiftID: "plush_pepe-20", ModelID: "plush_pepe", Name: "Plush Pepe #20", EstimatedValueGRAM: 20.0},
	}

	res, err := crafting.CalculateCraftingEV(ctx, inputs, 1.42, 42)
	if err != nil {
		t.Fatalf("CalculateCraftingEV failed: %v", err)
	}

	if res.BurnWarningNotice == "" {
		t.Errorf("Burn warning notice must not be empty")
	}
	if res.SuccessProbability != 45.0 {
		t.Errorf("Expected 45%% success rate for 2 items, got %.1f%%", res.SuccessProbability)
	}
	if res.Recommendation != "YES" && res.Recommendation != "RISKY" && res.Recommendation != "NO" {
		t.Errorf("Unexpected recommendation value: %s", res.Recommendation)
	}
}

// TestAudit_GetEnrichedReport_PaywallEnforced verifies that unpaid users receive curiosity gate without price leakage (Bug 7).
func TestAudit_GetEnrichedReport_PaywallEnforced(t *testing.T) {
	engine := gvengine.NewValuationEngine(nil, nil, nil)
	svc := &GiftsService{engine: engine}
	ctx := context.Background()

	// Guest user (userID 0) or user without purchased report
	report, err := svc.GetEnrichedReport(ctx, 0, "plush_pepe-42")
	if err != nil {
		t.Fatalf("GetEnrichedReport failed: %v", err)
	}

	isUnlocked, ok := report["is_unlocked"].(bool)
	if !ok || isUnlocked {
		t.Errorf("Expected is_unlocked to be false for unpaid user, got %v", report["is_unlocked"])
	}

	requiresUnlock, ok := report["requires_unlock"].(bool)
	if !ok || !requiresUnlock {
		t.Errorf("Expected requires_unlock to be true for unpaid user, got %v", report["requires_unlock"])
	}

	// Ensure zero price leakage: expected_gram, comps, exit_plan must NOT exist in the locked response
	if _, leaked := report["expected_gram"]; leaked {
		t.Errorf("CRITICAL LEAK: expected_gram was leaked to unpaid user in enriched report!")
	}
	if _, leaked := report["comps"]; leaked {
		t.Errorf("CRITICAL LEAK: comps was leaked to unpaid user in enriched report!")
	}
	if _, leaked := report["exit_planner"]; leaked {
		t.Errorf("CRITICAL LEAK: exit_planner was leaked to unpaid user in enriched report!")
	}
}

// TestAudit_DeterministicCertificateHash verifies that identical valuations produce the exact same certificate ID (Bug 8).
func TestAudit_DeterministicCertificateHash(t *testing.T) {
	engine := gvengine.NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	val1, err1 := engine.Valuate(ctx, "plush_pepe-42")
	if err1 != nil {
		t.Fatalf("Valuation 1 failed: %v", err1)
	}

	val2, err2 := engine.Valuate(ctx, "plush_pepe-42")
	if err2 != nil {
		t.Fatalf("Valuation 2 failed: %v", err2)
	}

	if val1.CertificateID == "" {
		t.Errorf("CertificateID is empty")
	}
	if val1.CertificateID != val2.CertificateID {
		t.Errorf("Certificate ID is non-deterministic! First=%s, Second=%s", val1.CertificateID, val2.CertificateID)
	}
}

