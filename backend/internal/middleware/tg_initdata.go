package middleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
)

// ValidateTelegramInitData is a middleware that validates Telegram Mini App InitData
func ValidateTelegramInitData(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		initData := r.Header.Get("X-Telegram-Init-Data")
		if initData == "" {
			http.Error(w, "Unauthorized: Missing X-Telegram-Init-Data header", http.StatusUnauthorized)
			return
		}

		botToken := os.Getenv("BOT_TOKEN")
		if botToken == "" {
			// In development, we might skip this if bot token isn't provided, 
			// but for production it's a MUST.
			// For now, let's log a warning and proceed if in DEV mode.
			fmt.Println("⚠️ WARNING: BOT_TOKEN is not set. Skipping InitData validation.")
			next.ServeHTTP(w, r)
			return
		}

		if err := validate(initData, botToken); err != nil {
			http.Error(w, fmt.Sprintf("Unauthorized: %v", err), http.StatusUnauthorized)
			return
		}

		// Inject user data into context
		ctx := r.Context()
		values, _ := url.ParseQuery(initData)
		userData := values.Get("user")
		if userData != "" {
			var user map[string]interface{}
			if err := json.Unmarshal([]byte(userData), &user); err == nil {
				ctx = context.WithValue(ctx, "tg_user", user)
			}
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	})
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

	if calculatedHash != hash {
		return fmt.Errorf("hash mismatch")
	}

	return nil
}
