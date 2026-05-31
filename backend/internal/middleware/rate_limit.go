package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"log/slog"

	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"ifragment-backend/internal/repository"
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
		// Try to parse from X-Telegram-Init-Data header
		initData := r.Header.Get("X-Telegram-Init-Data")
		if initData != "" {
			values, err := url.ParseQuery(initData)
			if err == nil {
				userData := values.Get("user")
				if userData != "" {
					var user struct {
						ID int64 `json:"id"`
					}
					if err := json.Unmarshal([]byte(userData), &user); err == nil && user.ID != 0 {
						return fmt.Sprintf("%d", user.ID)
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

func getRealIP(r *http.Request) string {
	remoteIP, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		remoteIP = r.RemoteAddr
	}

	// Only trust headers if direct RemoteIP is loopback or in TRUSTED_PROXIES list
	isTrusted := remoteIP == "127.0.0.1" || remoteIP == "::1"
	if !isTrusted {
		proxiesStr := os.Getenv("TRUSTED_PROXIES")
		if proxiesStr != "" {
			for _, p := range strings.Split(proxiesStr, ",") {
				p = strings.TrimSpace(p)
				if p == remoteIP {
					isTrusted = true
					break
				}
				if _, ipNet, err := net.ParseCIDR(p); err == nil {
					if ip := net.ParseIP(remoteIP); ip != nil && ipNet.Contains(ip) {
						isTrusted = true
						break
					}
				}
			}
		}
	}

	if isTrusted {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			if len(parts) > 0 {
				ip := strings.TrimSpace(parts[0])
				if ip != "" {
					return ip
				}
			}
		}
		if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
			return strings.TrimSpace(xrip)
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
			ip := getRealIP(r)
			userID := getUserID(r)

			// Try Redis-based rate limiting first
			if cache != nil && cache.Client != nil {
				ctx := r.Context()
				var key string
				var limit int64 = 45

				if userID != "" {
					key = "rate_limit:user:" + userID
				} else {
					key = "rate_limit:ip:" + ip
					limit = 30
				}

				pipe := cache.Client.TxPipeline()
				incrCmd := pipe.Incr(ctx, key)
				ttlCmd := pipe.TTL(ctx, key)
				_, err := pipe.Exec(ctx)
				if err == nil {
					count := incrCmd.Val()
					if ttlCmd.Val() < 0 {
						cache.Client.Expire(ctx, key, time.Minute)
					}
					if count > limit {
						slog.Warn("Rate limit exceeded (Redis)", "key", key, "count", count)
						http.Error(w, "Rate limit exceeded. Please try again later.", http.StatusTooManyRequests)
						return
					}
					next.ServeHTTP(w, r)
					return
				}
			}

			// In-memory fallback (per-IP rate limiting)
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

			if len(valid) >= 30 {
				slog.Warn("Rate limit exceeded (Memory)", "ip", ip)
				http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
				return
			}

			rl.ips[ip] = append(valid, now)
			next.ServeHTTP(w, r)
		})
	}
}

func NewChannelRateLimiter(cache *repository.Cache) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getRealIP(r)
			userID := getUserID(r)

			if cache != nil && cache.Client != nil {
				ctx := r.Context()
				var key string
				limit := int64(60)
				window := 60 * time.Second

				if userID != "" {
					key = "rate_limit:channel:user:" + userID
				} else {
					key = "rate_limit:channel:ip:" + ip
				}

				now := time.Now()
				nowMs := now.UnixNano() / int64(time.Millisecond)
				clearBefore := now.Add(-window).UnixNano() / int64(time.Millisecond)
				uniqueMember := fmt.Sprintf("%d:%d", nowMs, now.UnixNano())

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
					slog.Warn("Redis rate limit Lua script error", "error", err)
				}
			}

			// Fallback: Continue without rate limiting if Redis is down
			next.ServeHTTP(w, r)
		})
	}
}
