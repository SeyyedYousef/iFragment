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
	cryptoErr  error
)

func getCryptoKey() ([]byte, error) {
	cryptoOnce.Do(func() {
		keyStr := os.Getenv("BOT_TOKEN_KEY")
		if keyStr == "" {
			jwtSecret := os.Getenv("JWT_SECRET")
			if jwtSecret != "" {
				hash := sha256.Sum256([]byte(jwtSecret))
				cryptoKey = hash[:]
				return
			}
			if allowDevBypass && os.Getenv("APP_ENV") != "production" {
				keyStr = "dev_bot_token_key_32_characters_"
			} else {
				cryptoErr = fmt.Errorf("CRITICAL: BOT_TOKEN_KEY and JWT_SECRET environment variables are not set")
				return
			}
		}
		key := []byte(keyStr)
		if len(key) != 32 {
			if allowDevBypass && os.Getenv("APP_ENV") != "production" {
				// Pad or truncate to 32 bytes for dev
				temp := make([]byte, 32)
				copy(temp, key)
				key = temp
			} else {
				cryptoErr = fmt.Errorf("CRITICAL: BOT_TOKEN_KEY must be exactly 32 bytes/characters long")
				return
			}
		}
		cryptoKey = key
	})
	return cryptoKey, cryptoErr
}

// DecryptTokenHelper is a public helper to decrypt a token using the AES key
func DecryptTokenHelper(ciphertext []byte) (string, error) {
	key, err := getCryptoKey()
	if err != nil {
		return "", err
	}
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

			// Development bypass check (Strictly disabled in production)
			if (allowDevBypass || os.Getenv("BYPASS_TELEGRAM_AUTH") == "true") && os.Getenv("APP_ENV") != "production" {
				// Attempt to parse query parameters directly.
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
				if strings.HasPrefix(initData, "dev-user") {
					idPart := strings.TrimPrefix(initData, "dev-user-")
					id := int64(12345) // default owner
					if idPart != "" && idPart != "dev-user" {
						if parsed, err := strconv.ParseInt(idPart, 10, 64); err == nil {
							id = parsed
						}
					}
					ctx := context.WithValue(r.Context(), UserContextKey, map[string]interface{}{"id": id, "username": fmt.Sprintf("testuser_%d", id)})
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
					var botTokens []string
					cacheKey := "cached_active_bot_tokens"
					if cache != nil && cache.Client != nil {
						if cachedVal, err := cache.Client.Get(ctx, cacheKey).Result(); err == nil && cachedVal != "" {
							_ = json.Unmarshal([]byte(cachedVal), &botTokens)
						}
					}

					if len(botTokens) == 0 {
						rows, queryErr := db.Pool.Query(ctx, "SELECT bot_token_encrypted FROM managed_bots WHERE status = 'active'")
						if queryErr == nil {
							defer rows.Close()
							for rows.Next() {
								var encryptedToken []byte
								if scanErr := rows.Scan(&encryptedToken); scanErr == nil && len(encryptedToken) > 0 {
									token, decryptErr := DecryptTokenHelper(encryptedToken)
									if decryptErr == nil && token != "" {
										botTokens = append(botTokens, token)
									}
								}
							}
							if cache != nil && cache.Client != nil && len(botTokens) > 0 {
								tokensJSON, _ := json.Marshal(botTokens)
								cache.Client.Set(ctx, cacheKey, string(tokensJSON), 10*time.Minute)
							}
						}
					}

					for _, token := range botTokens {
						if validate(initData, token) == nil {
							customBotsSuccess = true
							err = nil // Clear the error since validation succeeded
							break
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

			// Authentication succeeded: failure keys expire automatically via 1h TTL, no need to issue DEL write commands on every request

			// Inject user into context
			if userObj != nil {
				ctx = context.WithValue(ctx, UserContextKey, userObj)
				if isPrem, ok := userObj["is_premium"].(bool); ok && isPrem && db != nil && db.Pool != nil && userID != "" {
					if uid, err := strconv.ParseInt(userID, 10, 64); err == nil && uid > 0 {
						go func(uID int64) {
							bgCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
							defer cancel()
							_, _ = db.Pool.Exec(bgCtx, "UPDATE users SET is_premium = TRUE WHERE telegram_id = $1 AND is_premium = FALSE", uID)
						}(uid)
					}
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

	// Create data-check-string from raw initData pairs for encoding robustness.
	// url.ParseQuery() silently converts '+' to spaces which can break hash verification
	// when user data contains '+' characters. Instead, split raw pairs and decode explicitly.
	rawPairs := strings.Split(initData, "&")
	var filteredPairs []string
	for _, pair := range rawPairs {
		eqIdx := strings.Index(pair, "=")
		if eqIdx == -1 {
			continue
		}
		key, _ := url.QueryUnescape(pair[:eqIdx])
		if key == "hash" {
			continue
		}
		val, _ := url.QueryUnescape(pair[eqIdx+1:])
		filteredPairs = append(filteredPairs, key+"="+val)
	}
	sort.Strings(filteredPairs)
	dataCheckString := strings.Join(filteredPairs, "\n")

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
	if authDate <= 0 {
		return fmt.Errorf("invalid auth_date value")
	}
	now := time.Now().Unix()
	if now-authDate > 86400 || authDate-now > 86400 {
		return fmt.Errorf("init data expired (max 24h) or invalid clock skew")
	}

	return nil
}

// VerifyInitDataAndExtractUserID cryptographically validates Telegram's initData signature using BOT_TOKEN and returns the user ID.
func VerifyInitDataAndExtractUserID(initData string) (int64, error) {
	// Development bypass check or explicit environment override
	if (allowDevBypass && os.Getenv("APP_ENV") != "production") || os.Getenv("BYPASS_TELEGRAM_AUTH") == "true" {
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
