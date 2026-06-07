package middleware

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/repository"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ValidateTelegramInitData is a middleware that validates Telegram Mini App InitData
type ContextKey string

const (
	UserContextKey ContextKey = "tg_user"
)

var (
	cryptoKey  []byte
	cryptoOnce sync.Once
)

func getCryptoKey() []byte {
	cryptoOnce.Do(func() {
		keyStr := os.Getenv("BOT_TOKEN_KEY")
		if keyStr == "" {
			if os.Getenv("APP_ENV") != "production" {
				keyStr = "dev_bot_token_key_32_characters_"
			} else {
				panic("CRITICAL: BOT_TOKEN_KEY environment variable is not set")
			}
		}
		key := []byte(keyStr)
		if len(key) != 32 {
			if os.Getenv("APP_ENV") != "production" {
				// Pad or truncate to 32 bytes for dev
				temp := make([]byte, 32)
				copy(temp, key)
				key = temp
			} else {
				panic("CRITICAL: BOT_TOKEN_KEY must be exactly 32 bytes/characters long")
			}
		}
		cryptoKey = key
	})
	return cryptoKey
}

func DecryptTokenHelper(ciphertext []byte) (string, error) {
	key := getCryptoKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	if len(ciphertext) < gcm.NonceSize() {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonceSize := gcm.NonceSize()
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

func ValidateTelegramInitData(db *repository.Database, cache *repository.Cache) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			initData := r.Header.Get("X-Telegram-Init-Data")
			if initData == "" {
				http.Error(w, "Unauthorized: Missing X-Telegram-Init-Data header", http.StatusUnauthorized)
				return
			}

			botToken := os.Getenv("BOT_TOKEN")
			if botToken == "" {
				botToken = os.Getenv("TELEGRAM_BOT_TOKEN")
			}
			if botToken == "" {
				http.Error(w, "Internal Server Error: Security configuration missing (BOT_TOKEN)", http.StatusInternalServerError)
				return
			}

			// Standardize using secure trusted proxy ClientIP extraction
			ip := GetRealIP(r)

			ctx := r.Context()
			if cache != nil && cache.Client != nil {
				// Check IP lock first (prevents brute force of signatures)
				if exists, _ := cache.Client.Exists(ctx, "brute_lock:ip:"+ip).Result(); exists > 0 {
					http.Error(w, "Too many failed authentication attempts. IP temporarily locked.", http.StatusTooManyRequests)
					return
				}
			}

			// Development bypass check
			isDevEnv := os.Getenv("APP_ENV") != "production"
			if isDevEnv {
				// Attempt to parse query parameters directly in dev environment.
				// This allows using mock, clock-skewed, or expired user data without failing cryptographic validation.
				if values, err := url.ParseQuery(initData); err == nil {
					userData := values.Get("user")
					if userData != "" {
						var userObj map[string]interface{}
						if err := json.Unmarshal([]byte(userData), &userObj); err == nil {
							ctx := context.WithValue(r.Context(), UserContextKey, userObj)
							next.ServeHTTP(w, r.WithContext(ctx))
							return
						}
					}
				}
				if initData == "dev-user" {
					ctx := context.WithValue(r.Context(), UserContextKey, map[string]interface{}{"id": int64(12345), "username": "testuser"})
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}

			// Perform Cryptographic Verification FIRST before reading untrusted parameters
			err := validate(initData, botToken)
			if err != nil {
				// Try custom bots fallback if main verification fails
				customBotsSuccess := false
				if db != nil && db.Pool != nil {
					rows, queryErr := db.Pool.Query(ctx, "SELECT bot_token_encrypted FROM managed_bots WHERE status = 'active'")
					if queryErr == nil {
						defer rows.Close()
						for rows.Next() {
							var encryptedToken []byte
							if scanErr := rows.Scan(&encryptedToken); scanErr == nil && len(encryptedToken) > 0 {
								token, decryptErr := DecryptTokenHelper(encryptedToken)
								if decryptErr == nil && token != "" {
									if validate(initData, token) == nil {
										customBotsSuccess = true
										err = nil // Clear the error since validation succeeded
										break
									}
								}
							}
						}
					}
				}

				if !customBotsSuccess {
					// Failed signature verification: lock IP ONLY
					slog.Warn("SECURITY EVENT: Telegram InitData signature check failed",
						"ip", ip,
						"error", err.Error(),
						"user_agent", r.UserAgent(),
					)

					if cache != nil && cache.Client != nil {
						pipe := cache.Client.Pipeline()
						ipFailKey := "brute_fail:ip:" + ip
						incrIP := pipe.Incr(ctx, ipFailKey)
						pipe.Expire(ctx, ipFailKey, 1*time.Hour)
						_, _ = pipe.Exec(ctx)

						fails, _ := incrIP.Result()
						if fails >= 10 {
							cache.Client.Set(ctx, "brute_lock:ip:"+ip, "locked", 24*time.Hour)
						}
					}

					http.Error(w, fmt.Sprintf("Unauthorized: Signature verification failed (%s)", err.Error()), http.StatusUnauthorized)
					return
				}
			}

			// SECURE PARAMETER EXTRACTION: Parse query values ONLY after signature is verified
			values, _ := url.ParseQuery(initData)
			var userID string
			var userObj map[string]interface{}
			userData := values.Get("user")
			if userData != "" {
				if err := json.Unmarshal([]byte(userData), &userObj); err == nil {
					if idVal, ok := userObj["id"]; ok {
						switch v := idVal.(type) {
						case float64:
							userID = strconv.FormatInt(int64(v), 10)
						case int64:
							userID = strconv.FormatInt(v, 10)
						case int:
							userID = strconv.FormatInt(int64(v), 10)
						}
					}
				}
			}

			// Check verified user lockout in Redis
			if userID != "" && cache != nil && cache.Client != nil {
				if exists, _ := cache.Client.Exists(ctx, "brute_lock:user:"+userID).Result(); exists > 0 {
					http.Error(w, "Too many failed authentication attempts. User temporarily locked.", http.StatusTooManyRequests)
					return
				}
			}

			// Authentication succeeded: reset failed counters
			if cache != nil && cache.Client != nil {
				pipe := cache.Client.Pipeline()
				pipe.Del(ctx, "brute_fail:ip:"+ip)
				if userID != "" {
					pipe.Del(ctx, "brute_fail:user:"+userID)
				}
				_, _ = pipe.Exec(ctx)
			}

			// Inject user into context
			if userObj != nil {
				ctx = context.WithValue(ctx, UserContextKey, userObj)
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
	if authDateStr == "" {
		return fmt.Errorf("missing auth_date")
	}
	var authDate int64
	if _, err := fmt.Sscanf(authDateStr, "%d", &authDate); err != nil {
		return fmt.Errorf("invalid auth_date")
	}
	now := time.Now().Unix()
	if now-authDate > 86400 || authDate-now > 86400 {
		return fmt.Errorf("init data expired (max 24h) or invalid clock skew")
	}

	return nil
}

// VerifyInitDataAndExtractUserID cryptographically validates Telegram's initData signature using BOT_TOKEN and returns the user ID.
func VerifyInitDataAndExtractUserID(initData string) (int64, error) {
	// Development bypass check
	isDevEnv := os.Getenv("APP_ENV") != "production"
	if isDevEnv {
		if values, err := url.ParseQuery(initData); err == nil {
			userData := values.Get("user")
			if userData != "" {
				var user struct {
					ID int64 `json:"id"`
				}
				if err := json.Unmarshal([]byte(userData), &user); err == nil && user.ID != 0 {
					return user.ID, nil
				}
			}
		}
		if initData == "dev-user" {
			return 12345, nil
		}
	}

	botToken := os.Getenv("BOT_TOKEN")
	if botToken == "" {
		botToken = os.Getenv("TELEGRAM_BOT_TOKEN")
	}
	if botToken == "" {
		return 0, fmt.Errorf("security configuration missing: BOT_TOKEN or TELEGRAM_BOT_TOKEN not set")
	}

	if err := validate(initData, botToken); err != nil {
		return 0, err
	}

	values, err := url.ParseQuery(initData)
	if err != nil {
		return 0, fmt.Errorf("failed to parse init data query parameters")
	}

	userData := values.Get("user")
	if userData == "" {
		return 0, fmt.Errorf("missing user block in init data")
	}

	var user struct {
		ID int64 `json:"id"`
	}
	if err := json.Unmarshal([]byte(userData), &user); err != nil || user.ID == 0 {
		return 0, fmt.Errorf("invalid user structure in init data")
	}

	return user.ID, nil
}
