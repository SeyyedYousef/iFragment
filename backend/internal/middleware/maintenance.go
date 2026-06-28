package middleware

import (
	"net/http"
	"strings"

	"ifragment-backend/internal/repository"
)

func MaintenanceMiddleware(settingsRepo *repository.SettingsRepo) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Do not block owner APIs, webhooks or health checks
			if strings.HasPrefix(r.URL.Path, "/api/v1/owner") ||
				strings.HasPrefix(r.URL.Path, "/api/v1/webhook") ||
				strings.HasPrefix(r.URL.Path, "/api/v1/health") {
				next.ServeHTTP(w, r)
				return
			}

			settings, err := settingsRepo.GetSystemSettings(r.Context())
			if err == nil && settings != nil && settings.MaintenanceMode {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusServiceUnavailable)
				w.Write([]byte(`{"error": "System is currently under maintenance. Please try again later."}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
