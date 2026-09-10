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
	"ifragment-backend/internal/service/username/avm"
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

func TestValuateAccessControl(t *testing.T) {
	mockMTProto := mtproto.NewMockClient()
	aggService := username.NewAggregatorService(nil, nil)
	reportService := username.NewAnalysisService(context.Background(), nil, nil, nil, mockMTProto)
	avmService := &avm.ValuationService{}
	h := NewUsernameHandler(aggService, reportService, mockMTProto, nil, avmService, nil, nil)

	// Unauthenticated request to /valuate must be rejected with 401 Unauthorized
	req := httptest.NewRequest("GET", "/api/v1/usernames/valuate?u=polymarket", nil)
	w := httptest.NewRecorder()
	h.Valuate(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("Expected 401 Unauthorized for unauthenticated request, got %d", w.Code)
	}
}

func TestUsernameHandler_VerifyEndpoint(t *testing.T) {
	mockMTProto := mtproto.NewMockClient()
	aggService := username.NewAggregatorService(nil, nil)
	reportService := username.NewAnalysisService(context.Background(), nil, nil, nil, mockMTProto)
	h := NewUsernameHandler(aggService, reportService, mockMTProto, nil, nil, nil, nil)

	// 1. Missing username
	req := httptest.NewRequest("GET", "/api/v1/usernames/verify", nil)
	w := httptest.NewRecorder()
	h.Verify(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for missing param, got %d", w.Code)
	}

	// 2. Invalid username format
	req = httptest.NewRequest("GET", "/api/v1/usernames/verify?u=bad!char", nil)
	w = httptest.NewRecorder()
	h.Verify(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for verdict response, got %d", w.Code)
	}
	var resInvalid username.UsernameVerificationResult
	if err := json.NewDecoder(w.Body).Decode(&resInvalid); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if resInvalid.FormatValid {
		t.Errorf("expected format_valid false, got true")
	}
	if resInvalid.VerificationState != "invalid_format" {
		t.Errorf("expected verification_state invalid_format, got %s", resInvalid.VerificationState)
	}

	// 3. Valid 4-character collectible username
	req = httptest.NewRequest("GET", "/api/v1/usernames/verify?u=@rare", nil)
	w = httptest.NewRecorder()
	h.Verify(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for valid username, got %d", w.Code)
	}
	var resRare username.UsernameVerificationResult
	if err := json.NewDecoder(w.Body).Decode(&resRare); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if !resRare.FormatValid {
		t.Errorf("expected format_valid true, got false")
	}
	if !resRare.IsCollectibleLength {
		t.Errorf("expected is_collectible_length true for 4-char handle, got false")
	}
	if resRare.Username != "rare" {
		t.Errorf("expected canonical username rare, got %s", resRare.Username)
	}
	if resRare.DataBadges == nil || resRare.DataBadges["standard"] != "TEP-62 (Telemint)" {
		t.Errorf("expected TEP-62 standard badge, got %v", resRare.DataBadges)
	}
}


