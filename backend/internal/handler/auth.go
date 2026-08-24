package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type AuthHandler struct {
	db             *repository.Database
	cache          *repository.Cache
	profileService *service.ProfileService
}

func NewAuthHandler(db *repository.Database, cache *repository.Cache, profileService *service.ProfileService) *AuthHandler {
	return &AuthHandler{
		db:             db,
		cache:          cache,
		profileService: profileService,
	}
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (h *AuthHandler) IssueToken(w http.ResponseWriter, r *http.Request) {
	rawUser := r.Context().Value(middleware.UserContextKey)
	if rawUser == nil {
		RespondError(w, r, http.StatusUnauthorized, "User context missing", nil)
		return
	}

	user, ok := rawUser.(map[string]interface{})
	if !ok {
		RespondError(w, r, http.StatusInternalServerError, "Invalid user context format", nil)
		return
	}

	var telegramID int64
	switch v := user["id"].(type) {
	case float64:
		telegramID = int64(v)
	case int64:
		telegramID = v
	case int32:
		telegramID = int64(v)
	case int:
		telegramID = int64(v)
	case string:
		var err error
		if telegramID, err = strconv.ParseInt(v, 10, 64); err != nil {
			RespondError(w, r, http.StatusUnauthorized, "Invalid user ID format (string)", err)
			return
		}
	default:
		RespondError(w, r, http.StatusUnauthorized, "Invalid user ID format", nil)
		return
	}

	if telegramID <= 0 {
		RespondError(w, r, http.StatusUnauthorized, "Invalid Telegram user ID", nil)
		return
	}

	username, _ := user["username"].(string)
	firstName, _ := user["first_name"].(string)
	lastName, _ := user["last_name"].(string)
	languageCode, _ := user["language_code"].(string)
	isPremium, _ := user["is_premium"].(bool)
	photoURL, _ := user["photo_url"].(string)
	if photoURL == "" {
		photoURL, _ = user["photoUrl"].(string)
	}

	// Synchronize user profile in the database
	err := h.db.UpsertUser(r.Context(), repository.User{
		TelegramID:   telegramID,
		Username:     username,
		FirstName:    firstName,
		LastName:     lastName,
		LanguageCode: languageCode,
		IsPremium:    isPremium,
		PhotoURL:     photoURL,
	})
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to synchronize user profile", err)
		return
	}

	// Try to process referral if start_param is present
	initData := r.Header.Get("X-Telegram-Init-Data")
	if initData != "" {
		if values, err := url.ParseQuery(initData); err == nil {
			startParam := values.Get("start_param")
			if startParam != "" {
				err := h.profileService.SetReferralCode(r.Context(), telegramID, startParam)
				if err != nil {
					slog.Warn("Failed to set referred_by", "user_id", telegramID, "referrer_code", startParam, "error", err)
				}
			}
		}
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		RespondError(w, r, http.StatusInternalServerError, "JWT configuration error", nil)
		return
	}

	// 1. Access Token (15 minutes expiry)
	accessClaims := middleware.JWTClaims{
		UserID:    telegramID,
		Username:  username,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}
	accessTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessToken, err := accessTokenObj.SignedString([]byte(jwtSecret))
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to sign access token", err)
		return
	}

	// 2. Refresh Token (7 days expiry with rotation)
	refreshClaims := middleware.JWTClaims{
		UserID:    telegramID,
		Username:  username,
		TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}
	refreshTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken, err := refreshTokenObj.SignedString([]byte(jwtSecret))
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to sign refresh token", err)
		return
	}

	// 3. Store SHA-256 hash in Redis
	if h.cache != nil && h.cache.Client != nil {
		tokenHash := hashToken(refreshToken)
		sessionData, _ := json.Marshal(map[string]interface{}{
			"user_id":    telegramID,
			"username":   username,
			"created_at": time.Now().UTC().Format(time.RFC3339),
			"ip":         r.RemoteAddr,
			"ua":         r.Header.Get("User-Agent"),
		})
		h.cache.Client.Set(r.Context(), fmt.Sprintf("user_refresh:%d:%s", telegramID, tokenHash), sessionData, 7*24*time.Hour)
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"token":         accessToken, // backwards compatibility
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

// RefreshToken handles rotating refresh token and issuing a fresh 15m access token + new refresh token
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.RefreshToken) == "" {
		RespondError(w, r, http.StatusBadRequest, "Invalid refresh token payload", nil)
		return
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		RespondError(w, r, http.StatusInternalServerError, "JWT configuration error", nil)
		return
	}

	claims := &middleware.JWTClaims{}
	token, err := jwt.ParseWithClaims(req.RefreshToken, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	if err != nil || !token.Valid || claims.TokenType != "refresh" {
		RespondError(w, r, http.StatusUnauthorized, "Invalid or expired refresh token", nil)
		return
	}

	// Verify token hash in Redis
	tokenHash := hashToken(req.RefreshToken)
	redisKey := fmt.Sprintf("user_refresh:%d:%s", claims.UserID, tokenHash)

	if h.cache != nil && h.cache.Client != nil {
		exists, err := h.cache.Client.Exists(r.Context(), redisKey).Result()
		if err != nil || exists == 0 {
			RespondError(w, r, http.StatusUnauthorized, "Refresh token has been revoked or expired", nil)
			return
		}

		// One-time use: Delete old refresh token from Redis
		h.cache.Client.Del(r.Context(), redisKey)
	}

	// Generate new Access Token (15m)
	newAccessClaims := middleware.JWTClaims{
		UserID:    claims.UserID,
		Username:  claims.Username,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}
	newAccessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, newAccessClaims).SignedString([]byte(jwtSecret))
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to sign new access token", err)
		return
	}

	// Generate new rotated Refresh Token (7d)
	newRefreshClaims := middleware.JWTClaims{
		UserID:    claims.UserID,
		Username:  claims.Username,
		TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}
	newRefreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, newRefreshClaims).SignedString([]byte(jwtSecret))
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to sign new refresh token", err)
		return
	}

	// Store new token hash in Redis
	if h.cache != nil && h.cache.Client != nil {
		newTokenHash := hashToken(newRefreshToken)
		sessionData, _ := json.Marshal(map[string]interface{}{
			"user_id":    claims.UserID,
			"username":   claims.Username,
			"created_at": time.Now().UTC().Format(time.RFC3339),
			"ip":         r.RemoteAddr,
			"ua":         r.Header.Get("User-Agent"),
		})
		h.cache.Client.Set(r.Context(), fmt.Sprintf("user_refresh:%d:%s", claims.UserID, newTokenHash), sessionData, 7*24*time.Hour)
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"token":         newAccessToken,
		"access_token":  newAccessToken,
		"refresh_token": newRefreshToken,
	})
}

// GetSessions returns active session metadata for the current user
func (h *AuthHandler) GetSessions(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil || userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	activeCount := 1
	var sessions []map[string]interface{}

	if h.cache != nil && h.cache.Client != nil {
		pattern := fmt.Sprintf("user_refresh:%d:*", userID)
		keys, err := h.cache.Client.Keys(r.Context(), pattern).Result()
		if err == nil {
			activeCount = len(keys)
			for _, k := range keys {
				val, err := h.cache.Client.Get(r.Context(), k).Result()
				if err == nil && val != "" {
					var item map[string]interface{}
					if json.Unmarshal([]byte(val), &item) == nil {
						sessions = append(sessions, item)
					}
				}
			}
		}
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"active_sessions_count": activeCount,
		"sessions":              sessions,
	})
}

// RevokeAllSessions invalidates all refresh tokens for the authenticated user
func (h *AuthHandler) RevokeAllSessions(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil || userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	if h.cache != nil && h.cache.Client != nil {
		pattern := fmt.Sprintf("user_refresh:%d:*", userID)
		keys, err := h.cache.Client.Keys(r.Context(), pattern).Result()
		if err == nil && len(keys) > 0 {
			h.cache.Client.Del(r.Context(), keys...)
		}
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "All other sessions have been successfully terminated",
	})
}
