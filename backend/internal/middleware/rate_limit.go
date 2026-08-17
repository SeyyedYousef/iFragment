package middleware

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"log/slog"

	"ifragment-backend/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
)

var slidingWindowScript = redis.NewScript(`
	local key = KEYS[1]
	local now = tonumber(ARGV[1])
	local clearBefore = tonumber(ARGV[2])
	local limit = tonumber(ARGV[3])
	local ttl = tonumber(ARGV[4])
	local member = ARGV[5]

	redis.call("ZREMRANGEBYSCORE", key, "-inf", clearBefore)
	local count = redis.call("ZCARD", key)

	if count < limit then
		redis.call("ZADD", key, now, member)
		redis.call("EXPIRE", key, ttl)
		return {count + 1, 1}
	else
		return {count, 0}
	end
`)

var incrExpireScript = redis.NewScript(`
	local key = KEYS[1]
	local limit = tonumber(ARGV[1])
	local ttl = tonumber(ARGV[2])
	local current = redis.call("INCR", key)
	if current == 1 then
		redis.call("EXPIRE", key, ttl)
	end
	return current
`)



type rateLimiter struct {
	ips map[string][]time.Time
	mu  sync.Mutex
}

func getUserID(r *http.Request) string {
	rawUser := r.Context().Value(UserContextKey)
	if rawUser == nil {
		// Try to parse from Authorization header if AuthMiddleware hasn't run yet
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			secret := os.Getenv("JWT_SECRET")
			if secret != "" {
				token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
					if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
						return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
					}
					return []byte(secret), nil
				})
				if err == nil && token.Valid {
					if claims, ok := token.Claims.(*JWTClaims); ok {
						return fmt.Sprintf("%d", claims.UserID)
					}
				}
			}
		}
		return ""
	}

	if user, ok := rawUser.(map[string]interface{}); ok {
		if id, ok := user["id"].(int64); ok {
			return fmt.Sprintf("%d", id)
		} else if id, ok := user["id"].(float64); ok {
			return fmt.Sprintf("%d", int64(id))
		} else if id, ok := user["id"].(int); ok {
			return fmt.Sprintf("%d", id)
		}
	}
	return ""
}

var (
	trustedProxies     []string
	trustedProxyCIDRs  []*net.IPNet
	trustedProxiesOnce sync.Once
)

func initTrustedProxies() {
	proxiesStr := os.Getenv("TRUSTED_PROXIES")
	if proxiesStr == "" || proxiesStr == "*" {
		return
	}
	for _, p := range strings.Split(proxiesStr, ",") {
		p = strings.TrimSpace(p)
		if _, ipNet, err := net.ParseCIDR(p); err == nil {
			trustedProxyCIDRs = append(trustedProxyCIDRs, ipNet)
		} else if p != "" {
			trustedProxies = append(trustedProxies, p)
		}
	}
}

func GetRealIP(r *http.Request) string {
	remoteIP, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		remoteIP = r.RemoteAddr
	}

	// Only trust headers if direct RemoteIP is loopback or in TRUSTED_PROXIES list
	isTrusted := remoteIP == "127.0.0.1" || remoteIP == "::1"
	if !isTrusted {
		proxiesStr := os.Getenv("TRUSTED_PROXIES")
		if proxiesStr == "*" {
			isTrusted = true
		} else if proxiesStr != "" {
			trustedProxiesOnce.Do(initTrustedProxies)
			for _, p := range trustedProxies {
				if p == remoteIP {
					isTrusted = true
					break
				}
			}
			if !isTrusted {
				if ip := net.ParseIP(remoteIP); ip != nil {
					for _, ipNet := range trustedProxyCIDRs {
						if ipNet.Contains(ip) {
							isTrusted = true
							break
						}
					}
				}
			}
		}
	}

	if isTrusted {
		if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
			return strings.TrimSpace(xrip)
		}
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			if len(parts) > 0 {
				ip := strings.TrimSpace(parts[0])
				if ip != "" {
					return ip
				}
			}
		}
	}

	return remoteIP
}

func NewRateLimiter(ctx context.Context, cache *repository.Cache) func(http.Handler) http.Handler {
	rl := &rateLimiter{
		ips: make(map[string][]time.Time),
	}

	// P1-P3: Background cleanup every 5 minutes linked to context cancellation to prevent memory leaks
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				rl.mu.Lock()
				now := time.Now()
				for ip, times := range rl.ips {
					var valid []time.Time
					for _, t := range times {
						if now.Sub(t) < time.Minute {
							valid = append(valid, t)
						}
					}
					if len(valid) == 0 {
						delete(rl.ips, ip)
					} else {
						rl.ips[ip] = valid
					}
				}
				rl.mu.Unlock()
			}
		}
	}()
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Dedicated high-capacity rate limiting for webhook endpoints (1200 requests/min to prevent flooding)
			if strings.HasPrefix(r.URL.Path, "/api/v1/webhook/") {
				if cache != nil && cache.Client != nil && !cache.IsQuotaExceeded() {
					key := "rate_limit:webhook:" + GetRealIP(r)
					count, err := incrExpireScript.Run(r.Context(), cache.Client, []string{key}, 1200, 60).Int64()
					if err == nil && count > 1200 {
						slog.Warn("Webhook rate limit exceeded (Redis)", "key", key, "count", count)
						http.Error(w, "Webhook rate limit exceeded", http.StatusTooManyRequests)
						return
					}
				}
				next.ServeHTTP(w, r)
				return
			}

			ip := GetRealIP(r)
			userID := getUserID(r)

			// Try Redis-based rate limiting first if Redis is healthy and quota not exceeded
			if cache != nil && cache.Client != nil && !cache.IsQuotaExceeded() {
				ctx := r.Context()
				var key string
				var limit int64 = 180

				if userID != "" {
					key = "rate_limit:user:" + userID
				} else {
					key = "rate_limit:ip:" + ip
					limit = 30
				}

				count, err := incrExpireScript.Run(ctx, cache.Client, []string{key}, limit, 60).Int64()
				if err == nil {
					if count > limit {
						slog.Warn("Rate limit exceeded (Redis)", "key", key, "count", count)
						http.Error(w, "Rate limit exceeded. Please try again later.", http.StatusTooManyRequests)
						return
					}
					next.ServeHTTP(w, r)
					return
				} else {
					if !cache.HandleError(err) {
						slog.Warn("Redis rate limit Lua script error", "error", err)
					}
				}
			}

			// In-memory fallback (per-IP rate limiting)
			rl.mu.Lock()

			// Safety net: prevent OOM if flooded with unique IPs
			if len(rl.ips) > 100000 {
				rl.ips = make(map[string][]time.Time)
			}

			now := time.Now()
			// Clean old requests
			var valid []time.Time
			for _, t := range rl.ips[ip] {
				if now.Sub(t) < time.Minute {
					valid = append(valid, t)
				}
			}

			if len(valid) >= 300 {
				rl.mu.Unlock()
				slog.Warn("Rate limit exceeded (Memory)", "ip", ip)
				http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
				return
			}

			rl.ips[ip] = append(valid, now)
			rl.mu.Unlock()

			next.ServeHTTP(w, r)
		})
	}
}

func NewChannelRateLimiter(cache *repository.Cache) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := GetRealIP(r)
			userID := getUserID(r)

			if cache != nil && cache.Client != nil && !cache.IsQuotaExceeded() {
				ctx := r.Context()
				var key string
				limit := int64(300)
				window := 60 * time.Second

				if userID != "" {
					key = "rate_limit:channel:user:" + userID
				} else {
					key = "rate_limit:channel:ip:" + ip
				}

				now := time.Now()
				nowMs := now.UnixNano() / int64(time.Millisecond)
				clearBefore := now.Add(-window).UnixNano() / int64(time.Millisecond)
				// Use pointer address to ensure uniqueness if UnixNano collides
				uniqueMember := fmt.Sprintf("%d:%p:%s", now.UnixNano(), r, ip)

				res, err := slidingWindowScript.Run(ctx, cache.Client, []string{key}, nowMs, clearBefore, limit, 65, uniqueMember).Result()
				if err == nil {
					resSlice, ok := res.([]interface{})
					if ok && len(resSlice) == 2 {
						var count int64
						var allowed int64

						if val, ok := resSlice[0].(int64); ok {
							count = val
						}
						if val, ok := resSlice[1].(int64); ok {
							allowed = val
						}

						remaining := limit - count
						if remaining < 0 {
							remaining = 0
						}
						w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))

						if allowed == 0 {
							slog.Warn("Channel rate limit exceeded (Redis sliding window)", "key", key, "count", count)
							w.Header().Set("Retry-After", "60")
							http.Error(w, "Rate limit exceeded. Please try again in a minute.", http.StatusTooManyRequests)
							return
						}
						next.ServeHTTP(w, r)
						return
					}
				} else {
					if !cache.HandleError(err) {
						slog.Warn("Redis rate limit Lua script error", "error", err)
					}
				}
			}

			// Fallback: Continue without rate limiting if Redis is down
			next.ServeHTTP(w, r)
		})
	}
}
