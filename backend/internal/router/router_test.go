package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestAllAPIRoutePaths(t *testing.T) {
	r := chi.NewRouter()

	// Register top level health endpoints as in main.go
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
		{"GET", "/api/v1/profile/stats"},
		{"GET", "/api/v1/profile/boosts"},
		{"GET", "/api/v1/profile/clan"},
		{"GET", "/api/v1/profile/daily"},
		{"GET", "/api/v1/usernames/quick"},
		{"POST", "/api/v1/webhook/telegram/123"},
		{"POST", "/owner/auth/totp"},
		{"GET", "/owner/dashboard/stats"},
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
