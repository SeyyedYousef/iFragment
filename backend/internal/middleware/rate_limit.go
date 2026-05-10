package middleware

import (
	"net/http"
	"sync"
	"time"

	"log/slog"
)

type rateLimiter struct {
	ips map[string][]time.Time
	mu  sync.Mutex
}

func NewRateLimiter() func(http.Handler) http.Handler {
	rl := &rateLimiter{
		ips: make(map[string][]time.Time),
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			rl.mu.Lock()
			defer rl.mu.Unlock()

			now := time.Now()
			// Clean old requests
			var valid []time.Time
			for _, t := range rl.ips[ip] {
				if now.Sub(t) < time.Minute {
					valid = append(valid, t)
				}
			}

			if len(valid) >= 30 { // 30 requests per minute
				slog.Warn("Rate limit exceeded", "ip", ip)
				http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
				return
			}

			rl.ips[ip] = append(valid, now)
			next.ServeHTTP(w, r)
		})
	}
}
