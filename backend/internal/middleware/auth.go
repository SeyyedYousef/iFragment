package middleware

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"ifragment-backend/internal/repository"

	"github.com/golang-jwt/jwt/v5"
)

type JWTClaims struct {
	UserID   int64  `json:"uid"`
	Username string `json:"username"`
	Role     string `json:"role,omitempty"`
	jwt.RegisteredClaims
}

var ownerRepo *repository.OwnerRepo

// InitAuthMiddleware initializes the repository used by AuthMiddleware for revocation checks
func InitAuthMiddleware(repo *repository.OwnerRepo) {
	ownerRepo = repo
}

// GetUserID parses user ID from request context safely
func GetUserID(ctx context.Context) (int64, error) {
	raw := ctx.Value(UserContextKey)
	if raw == nil {
		return 0, errors.New("unauthorized: missing user context")
	}
	if user, ok := raw.(map[string]interface{}); ok {
		if idVal, ok := user["id"]; ok {
			switch v := idVal.(type) {
			case int64:
				return v, nil
			case float64:
				return int64(v), nil
			case int:
				return int64(v), nil
			default:
				return 0, fmt.Errorf("invalid user id type: %T", idVal)
			}
		}
	}
	return 0, errors.New("unauthorized: invalid user context format")
}

// AuthMiddleware validates JWT and sets UserContextKey
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "Unauthorized: Missing or invalid Authorization header", http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			slog.Error("JWT_SECRET environment variable is not configured")
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "Unauthorized: Invalid token", http.StatusUnauthorized)
			return
		}

		if claims, ok := token.Claims.(*JWTClaims); ok {
			// If this is an impersonated token (RegisteredClaims.ID is set to session ID),
			// verify that the impersonation session is still active in the database (ended_at is NULL).
			if claims.ID != "" && ownerRepo != nil {
				sess, sessErr := ownerRepo.GetImpersonationSession(r.Context(), claims.ID)
				if sessErr != nil || sess == nil || sess.EndedAt != nil {
					http.Error(w, "Unauthorized: Impersonation session has been revoked or ended", http.StatusUnauthorized)
					return
				}
			}

			user := map[string]interface{}{
				"id":           claims.UserID,
				"username":     claims.Username,
				"role":         claims.Role,
				"impersonated": claims.ID != "", // If ID exists, this is an impersonation session
			}
			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		http.Error(w, "Unauthorized: Invalid claims", http.StatusUnauthorized)
	})
}

