package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestAllAPIRoutePaths(t *testing.T) {
	r := chi.NewRouter()

	healthOK := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "ok"}`))
	}
	r.Get("/health", healthOK)
	r.Get("/healthz", healthOK)

	RegisterAPIRoutes(r, Config{})

	pathsToTest := []struct {
		method string
		path   string
	}{
		{"GET", "/health"},
		{"GET", "/healthz"},
		{"GET", "/api/v1/health"},
		{"GET", "/api/v1/healthz/ready"},
		{"GET", "/api/v1/profile/stats"},
		{"GET", "/api/v1/profile/assets"},
		{"GET", "/api/v1/profile/ledger"},
		{"GET", "/api/v1/leaderboard/group"},
		{"GET", "/api/v1/usernames/quick"},
		{"GET", "/api/v1/usernames/history"},
		{"GET", "/api/v1/usernames/contact"},
		{"GET", "/api/v1/usernames/portfolio"},
		{"GET", "/api/v1/usernames/collection/stats"},
		{"GET", "/api/v1/usernames/collection/history"},
		{"GET", "/api/v1/numbers/collection-overview"},
		{"GET", "/api/v1/gifts/collections"},
		{"POST", "/api/v1/webhook/telegram/123"},
		{"POST", "/api/v1/owner/auth/login"},
		{"POST", "/api/v1/owner/auth/totp/verify"},
		{"GET", "/api/v1/owner/dashboard/stats"},
		{"POST", "/api/v1/owner/users/adjust-credits"},
		{"GET", "/api/v1/owner/health/external"},
		{"POST", "/api/v1/owner/cache/clear"},
		{"GET", "/api/v1/intel/credits"},
		{"GET", "/api/v1/public/investors-page"},
	}

	for _, tt := range pathsToTest {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			req, _ := http.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			defer func() {
				_ = recover()
				if w.Code == http.StatusNotFound {
					t.Errorf("path %s %s was NOT matched by router (returned 404 Not Found)", tt.method, tt.path)
				}
			}()

			r.ServeHTTP(w, req)
		})
	}
}
