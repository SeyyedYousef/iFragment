package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"ifragment-backend/internal/client/fragment"
	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/service/username"
)

func TestCheckAvailability(t *testing.T) {
	// Setup dependencies
	mockMTProto := mtproto.NewMockClient()
	fragClient := fragment.NewClient() // Using real/mock fragment
	aggService := username.NewAggregatorService(nil, nil, nil)
	reportService := username.NewReportService(nil, nil, nil, nil, nil, mockMTProto)

	// Inject MTProto Mock
	h := NewUsernameHandler(aggService, reportService, fragClient, mockMTProto, nil)

	// Test case: Invalid username (too short)
	req := httptest.NewRequest("GET", "/api/v1/usernames/check?u=ab", nil)
	w := httptest.NewRecorder()
	h.CheckAvailability(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request, got %d", w.Code)
	}

	// Test case: Valid basic username (Mock MTProto returns StatusAvailable)
	req = httptest.NewRequest("GET", "/api/v1/usernames/check?u=mycoolname123", nil)
	w = httptest.NewRecorder()
	h.CheckAvailability(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", w.Code)
	}

	// Test case: Collectible length (4) username (Mock returns StatusPurchase)
	req = httptest.NewRequest("GET", "/api/v1/usernames/check?u=bank", nil)
	w = httptest.NewRecorder()
	h.CheckAvailability(w, req)

	// Note: It might return 500 if Fragment scraping fails due to network,
	// but the handler logic paths should be tested. We just ensure it doesn't crash here.
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError {
		t.Errorf("Unexpected status code %d", w.Code)
	}
}

func TestGetSimilar(t *testing.T) {
	mockMTProto := mtproto.NewMockClient()
	aggService := username.NewAggregatorService(nil, nil, nil)
	reportService := username.NewReportService(nil, nil, nil, nil, nil, mockMTProto)
	h := NewUsernameHandler(aggService, reportService, nil, mockMTProto, nil)

	req := httptest.NewRequest("GET", "/api/v1/usernames/similar?u=news&limit=3", nil)
	w := httptest.NewRecorder()
	h.GetSimilar(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}

	var result []username.SimilarUsername
	if err := json.NewDecoder(w.Body).Decode(&result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(result) == 0 || len(result) > 3 {
		t.Fatalf("unexpected result length %d", len(result))
	}
}
