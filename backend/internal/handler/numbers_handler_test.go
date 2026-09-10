package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"ifragment-backend/internal/service/numbers"
)

func TestNumbersHandler_PaywallGateEnforcement(t *testing.T) {
	svc := numbers.NewNumbersService(nil, nil, nil, nil)
	h := NewNumbersHandler(svc)

	// 1. Guest request to Valuate must be rejected with 403 Forbidden
	req := httptest.NewRequest("GET", "/api/v1/numbers/valuate?n=%2B888%208888%208888", nil)
	w := httptest.NewRecorder()

	h.Valuate(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for unpaid guest valuate request, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response JSON: %v", err)
	}

	if resp["error"] != "report_not_unlocked" {
		t.Errorf("expected error 'report_not_unlocked', got %v", resp["error"])
	}

	if resp["curiosity_gate"] == nil {
		t.Errorf("expected curiosity_gate to be included in 403 response")
	}

	// 2. Curiosity Gate endpoint must be accessible for free without leaking financial valuation prices
	reqGate := httptest.NewRequest("GET", "/api/v1/numbers/gate?n=%2B888%208888%208888", nil)
	wGate := httptest.NewRecorder()

	h.GetCuriosityGate(wGate, reqGate)

	if wGate.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for free curiosity gate, got %d", wGate.Code)
	}

	var gateResp map[string]interface{}
	if err := json.NewDecoder(wGate.Body).Decode(&gateResp); err != nil {
		t.Fatalf("failed to decode gate response: %v", err)
	}

	if _, hasFair := gateResp["expected_ton"]; hasFair {
		t.Errorf("curiosity gate leaked expected_ton price!")
	}
	if _, hasLow := gateResp["low_ton"]; hasLow {
		t.Errorf("curiosity gate leaked low_ton price!")
	}
}

func TestNumbersHandler_VerifyEndpoint(t *testing.T) {
	svc := numbers.NewNumbersService(nil, nil, nil, nil)
	h := NewNumbersHandler(svc)

	req := httptest.NewRequest("GET", "/api/v1/numbers/verify?n=%2B888%208000", nil)
	w := httptest.NewRecorder()

	h.Verify(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for verify endpoint, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode verify response: %v", err)
	}

	if resp["format_valid"] != true {
		t.Errorf("expected format_valid=true, got %v", resp["format_valid"])
	}
	if resp["collection_verified"] != true {
		t.Errorf("expected collection_verified=true for Genesis number, got %v", resp["collection_verified"])
	}
}
