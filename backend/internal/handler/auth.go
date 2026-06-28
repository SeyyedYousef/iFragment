package handler

import (
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"

	"github.com/golang-jwt/jwt/v5"
)

type AuthHandler struct {
	db *repository.Database
}

func NewAuthHandler(db *repository.Database) *AuthHandler {
	return &AuthHandler{db: db}
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

	// Synchronize user profile in the database
	err := h.db.UpsertUser(r.Context(), repository.User{
		TelegramID:   telegramID,
		Username:     username,
		FirstName:    firstName,
		LastName:     lastName,
		LanguageCode: languageCode,
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
				_, err := h.db.SetReferredBy(r.Context(), telegramID, startParam)
				if err != nil {
					slog.Warn("Failed to set referred_by", "user_id", telegramID, "referrer_code", startParam, "error", err)
				}
			}
		}
	}

	claims := middleware.JWTClaims{
		UserID:    telegramID,
		Username:  username,
		TokenType: "user",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		RespondError(w, r, http.StatusInternalServerError, "JWT configuration error", nil)
		return
	}

	signed, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to sign token", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"token": signed})
}
