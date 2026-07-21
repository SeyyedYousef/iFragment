package middleware

import (
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
)

var (
	allowedOriginsCache []string
	allowedOriginsOnce  sync.Once
)

func getAllowedOrigins() []string {
	allowedOriginsOnce.Do(func() {
		allowedStr := os.Getenv("ALLOWED_ORIGINS")
		origins := strings.Split(allowedStr, ",")
		if len(origins) == 1 && origins[0] == "" {
			origins = []string{"http://localhost:5173", "http://127.0.0.1:5173"}
		}
		for i, o := range origins {
			origins[i] = strings.TrimSpace(o)
		}
		allowedOriginsCache = origins
	})
	return allowedOriginsCache
}

// CSRF protects against cross-site request forgery by validating the Origin/Referer
// headers for state-mutating requests (POST, PUT, DELETE, PATCH).
func CSRF(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		method := r.Method
		if method == "GET" || method == "HEAD" || method == "OPTIONS" {
			next.ServeHTTP(w, r)
			return
		}

		// Skip CSRF check if Authorization header is present (Bearer tokens are immune to CSRF) (Issue 25)
		if strings.HasPrefix(r.Header.Get("Authorization"), "Bearer ") {
			next.ServeHTTP(w, r)
			return
		}

		// Skip CSRF check for webhook endpoints (Telegram/TonAPI webhooks)
		if strings.HasPrefix(r.URL.Path, "/api/v1/webhook/") {
			next.ServeHTTP(w, r)
			return
		}

		// Skip CSRF for auth token bootstrap (protected by Telegram initData HMAC, not cookies)
		// This endpoint creates the JWT — by definition no Bearer token exists yet,
		// so the Authorization-based exemption above cannot apply.
		if r.URL.Path == "/api/v1/auth/token" {
			next.ServeHTTP(w, r)
			return
		}

		allowedOrigins := getAllowedOrigins()

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
				if allowed == "*" || strings.EqualFold(source, allowed) {
					matched = true
					break
				}
			}

			if !matched {
				slog.Warn("CSRF block: origin/referer mismatch", "source", source, "allowed", os.Getenv("ALLOWED_ORIGINS"), "path", r.URL.Path)
				http.Error(w, "Forbidden: CSRF Origin/Referer validation failed", http.StatusForbidden)
				return
			}
		} else if os.Getenv("APP_ENV") == "production" {
			// P0-S2: In production, block state-changing requests without Origin/Referer
			slog.Warn("CSRF block: missing Origin/Referer header in production", "path", r.URL.Path, "method", method)
			http.Error(w, "Forbidden: Origin or Referer header required", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}
