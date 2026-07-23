package handler

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/service/username"
)

type mockRoundTripper struct{}

func (m mockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`<div class="tm-section-buy"></div>`)),
		Header:     make(http.Header),
	}, nil
}

func TestCheckAvailability(t *testing.T) {
	// Setup dependencies
	mockMTProto := mtproto.NewMockClient()

	aggService := username.NewAggregatorService(nil, nil)
	reportService := username.NewAnalysisService(context.Background(), nil, nil, nil, mockMTProto)

	// Inject MTProto Mock
	h := NewUsernameHandler(aggService, reportService, mockMTProto, nil, nil, nil, nil)

	// Test case: Invalid username (invalid format)
	req := httptest.NewRequest("GET", "/api/v1/usernames/check?u=invalid!chars", nil)
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

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", w.Code)
	}
}

func TestGetSimilar(t *testing.T) {
	mockMTProto := mtproto.NewMockClient()
	aggService := username.NewAggregatorService(nil, nil)
	reportService := username.NewAnalysisService(context.Background(), nil, nil, nil, mockMTProto)
	h := NewUsernameHandler(aggService, reportService, mockMTProto, nil, nil, nil, nil)

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

func TestGetHistoryEndpoint(t *testing.T) {
	mockMTProto := mtproto.NewMockClient()
	aggService := username.NewAggregatorService(nil, nil)
	reportService := username.NewAnalysisService(context.Background(), nil, nil, nil, mockMTProto)
	h := NewUsernameHandler(aggService, reportService, mockMTProto, nil, nil, nil, nil)

	req := httptest.NewRequest("GET", "/api/v1/usernames/history?u=news", nil)
	w := httptest.NewRecorder()
	h.GetHistory(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["username"] != "news" {
		t.Fatalf("expected username news, got %v", resp["username"])
	}
}

func TestGetContactEndpoint(t *testing.T) {
	mockMTProto := mtproto.NewMockClient()
	aggService := username.NewAggregatorService(nil, nil)
	reportService := username.NewAnalysisService(context.Background(), nil, nil, nil, mockMTProto)
	h := NewUsernameHandler(aggService, reportService, mockMTProto, nil, nil, nil, nil)

	req := httptest.NewRequest("GET", "/api/v1/usernames/contact?u=durov", nil)
	w := httptest.NewRecorder()
	h.GetContact(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["username"] != "durov" {
		t.Fatalf("expected username durov, got %v", resp["username"])
	}
}
