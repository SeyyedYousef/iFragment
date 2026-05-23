package middleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/repository"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// ValidateTelegramInitData is a middleware that validates Telegram Mini App InitData
type ContextKey string

const (
	UserContextKey ContextKey = "tg_user"
)

func ValidateTelegramInitData(cache *repository.Cache) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			initData := r.Header.Get("X-Telegram-Init-Data")
			if initData == "" {
				http.Error(w, "Unauthorized: Missing X-Telegram-Init-Data header", http.StatusUnauthorized)
				return
			}

			botToken := os.Getenv("BOT_TOKEN")
			if botToken == "" {
				http.Error(w, "Internal Server Error: Security configuration missing", http.StatusInternalServerError)
				return
			}

			ip := r.RemoteAddr
			var userID string
			values, parseErr := url.ParseQuery(initData)
			if parseErr == nil {
				userData := values.Get("user")
				if userData != "" {
					var user struct {
						ID int64 `json:"id"`
					}
					if json.Unmarshal([]byte(userData), &user) == nil && user.ID != 0 {
						userID = strconv.FormatInt(user.ID, 10)
					}
				}
			}

			ctx := r.Context()
			if cache != nil && cache.Client != nil {
				// Check IP lock
				if exists, _ := cache.Client.Exists(ctx, "brute_lock:ip:"+ip).Result(); exists > 0 {
					http.Error(w, "Too many failed authentication attempts. IP temporarily locked.", http.StatusTooManyRequests)
					return
				}
				// Check User lock
				if userID != "" {
					if exists, _ := cache.Client.Exists(ctx, "brute_lock:user:"+userID).Result(); exists > 0 {
						http.Error(w, "Too many failed authentication attempts. User temporarily locked.", http.StatusTooManyRequests)
						return
					}
				}
			}

			if allowDevBypass && initData == "dev-user" {
				// Bypass for local testing
				ctx := context.WithValue(r.Context(), UserContextKey, map[string]interface{}{"id": int64(12345), "username": "testuser"})
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			if err := validate(initData, botToken); err != nil {
				if cache != nil && cache.Client != nil {
					pipe := cache.Client.Pipeline()
					ipFailKey := "brute_fail:ip:" + ip
					incrIP := pipe.Incr(ctx, ipFailKey)
					pipe.Expire(ctx, ipFailKey, 1*time.Hour)

					var incrUser *redis.IntCmd
					var userFailKey string
					if userID != "" {
						userFailKey = "brute_fail:user:" + userID
						incrUser = pipe.Incr(ctx, userFailKey)
						pipe.Expire(ctx, userFailKey, 1*time.Hour)
					}

					_, _ = pipe.Exec(ctx)

					fails, _ := incrIP.Result()
					if fails >= 10 {
						cache.Client.Set(ctx, "brute_lock:ip:"+ip, "locked", 24*time.Hour)
					}

					if incrUser != nil {
						ufails, _ := incrUser.Result()
						if ufails >= 10 {
							cache.Client.Set(ctx, "brute_lock:user:"+userID, "locked", 24*time.Hour)
						}
					}
				}

				http.Error(w, fmt.Sprintf("Unauthorized: %v", err), http.StatusUnauthorized)
				return
			}

			// Validation succeeded: reset failed counters
			if cache != nil && cache.Client != nil {
				pipe := cache.Client.Pipeline()
				pipe.Del(ctx, "brute_fail:ip:"+ip)
				if userID != "" {
					pipe.Del(ctx, "brute_fail:user:"+userID)
				}
				_, _ = pipe.Exec(ctx)
			}

			// Inject user data into context
			userData := values.Get("user")
			if userData != "" {
				var user map[string]interface{}
				if err := json.Unmarshal([]byte(userData), &user); err == nil {
					ctx = context.WithValue(ctx, UserContextKey, user)
				}
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func validate(initData, botToken string) error {
	values, err := url.ParseQuery(initData)
	if err != nil {
		return fmt.Errorf("invalid init data format")
	}

	hash := values.Get("hash")
	if hash == "" {
		return fmt.Errorf("missing hash")
	}

	// Create data-check-string
	var keys []string
	for k := range values {
		if k != "hash" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	var dataCheckArr []string
	for _, k := range keys {
		dataCheckArr = append(dataCheckArr, fmt.Sprintf("%s=%s", k, values.Get(k)))
	}
	dataCheckString := strings.Join(dataCheckArr, "\n")

	// HMAC-SHA256 validation
	// 1. Secret Key = HMAC-SHA256("WebAppData", BotToken)
	h := hmac.New(sha256.New, []byte("WebAppData"))
	h.Write([]byte(botToken))
	secretKey := h.Sum(nil)

	// 2. Hash = HMAC-SHA256(Secret Key, DataCheckString)
	h2 := hmac.New(sha256.New, secretKey)
	h2.Write([]byte(dataCheckString))
	calculatedHash := hex.EncodeToString(h2.Sum(nil))

	if subtle.ConstantTimeCompare([]byte(calculatedHash), []byte(hash)) != 1 {
		return fmt.Errorf("hash mismatch")
	}

	// Check auth_date for replay attacks (max 24h)
	authDateStr := values.Get("auth_date")
	if authDateStr != "" {
		var authDate int64
		fmt.Sscanf(authDateStr, "%d", &authDate)
		now := time.Now().Unix()
		if now-authDate > 86400 {
			return fmt.Errorf("init data expired")
		}
	}

	return nil
}
