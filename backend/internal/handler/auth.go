package handler

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"ifragment-backend/internal/middleware"
)

type AuthHandler struct{}

func NewAuthHandler() *AuthHandler {
	return &AuthHandler{}
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

	idFloat, ok := user["id"].(float64)
	if !ok {
		idInt, ok := user["id"].(int64)
		if !ok {
			idInt32, ok := user["id"].(int32)
			if ok {
				idFloat = float64(idInt32)
			} else {
				RespondError(w, r, http.StatusInternalServerError, "Invalid user ID format", nil)
				return
			}
		} else {
			idFloat = float64(idInt)
		}
	}
	
	username, _ := user["username"].(string)

	claims := middleware.JWTClaims{
		UserID:   int64(idFloat),
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to sign token", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": signed})
}
