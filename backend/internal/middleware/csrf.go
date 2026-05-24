package middleware

import (
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// CSRF protects against cross-site request forgery by validating the Origin/Referer
// headers for state-mutating requests (POST, PUT, DELETE, PATCH).
func CSRF(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		method := r.Method
		if method == "GET" || method == "HEAD" || method == "OPTIONS" {
			next.ServeHTTP(w, r)
			return
		}

		// Retrieve allowed origins
		allowedStr := os.Getenv("ALLOWED_ORIGINS")
		allowedOrigins := strings.Split(allowedStr, ",")
		if len(allowedOrigins) == 1 && allowedOrigins[0] == "" {
			allowedOrigins = []string{"http://localhost:5173", "http://127.0.0.1:5173"}
		}

		origin := r.Header.Get("Origin")
		referer := r.Header.Get("Referer")

		source := origin
		if source == "" && referer != "" {
			u, err := url.Parse(referer)
			if err == nil {
				source = u.Scheme + "://" + u.Host
			}
		}

		if source != "" {
			matched := false
			for _, allowed := range allowedOrigins {
				allowed = strings.TrimSpace(allowed)
				if allowed == "*" {
					matched = true
					break
				}
				if strings.EqualFold(source, allowed) {
					matched = true
					break
				}
			}

			if !matched {
				slog.Warn("CSRF block: origin/referer mismatch", "source", source, "allowed", allowedStr, "path", r.URL.Path)
				http.Error(w, "Forbidden: CSRF Origin/Referer validation failed", http.StatusForbidden)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}
