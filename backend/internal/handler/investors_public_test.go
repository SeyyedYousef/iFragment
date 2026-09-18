package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestInvestorsPublicHandlerEmpty(t *testing.T) {
	h := NewInvestorsPublicHandler(nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/public/investors-page", nil)
	w := httptest.NewRecorder()

	h.GetInvestorsPage(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	cacheControl := w.Header().Get("Cache-Control")
	if cacheControl != "public, max-age=60, stale-while-revalidate=300" {
		t.Errorf("Unexpected Cache-Control header: %s", cacheControl)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}

	if img, exists := resp["image_url"]; !exists || img != "" {
		t.Errorf("Expected empty image_url, got %v", img)
	}
	if updatedAt, exists := resp["updated_at"]; !exists || updatedAt != nil {
		t.Errorf("Expected nil updated_at, got %v", updatedAt)
	}

	// Security: verify no owner settings leaked
	for _, forbiddenKey := range []string{"maintenance_mode", "tap_multiplier", "dashboard_ads", "version", "referral_bonus"} {
		if _, exists := resp[forbiddenKey]; exists {
			t.Errorf("Security violation: endpoint exposed owner setting '%s'", forbiddenKey)
		}
	}
}
