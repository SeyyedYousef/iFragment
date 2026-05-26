package middleware

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"
)

// ValidateOwnerAdmin ensures the authenticated user is an owner admin
func ValidateOwnerAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawUser := r.Context().Value(UserContextKey)
		if rawUser == nil {
			http.Error(w, "Unauthorized: Owner session required", http.StatusUnauthorized)
			return
		}

		user, ok := rawUser.(map[string]interface{})
		if !ok {
			http.Error(w, "Internal Server Error: Invalid user format", http.StatusInternalServerError)
			return
		}

		role, _ := user["role"].(string)
		if role == "" || (role != "super_admin" && role != "admin" && role != "moderator" && role != "support") {
			slog.Warn("SECURITY ALERT: Non-owner attempted to access owner endpoint",
				"user_id", user["id"],
				"username", user["username"],
				"ip", r.RemoteAddr,
			)
			http.Error(w, "Forbidden: Owner access denied", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// BlockImpersonatedWrites prevents write operations if the user session is impersonated (read-only mode)
func BlockImpersonatedWrites(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet || r.Method == http.MethodOptions || r.Method == http.MethodHead {
			next.ServeHTTP(w, r)
			return
		}

		rawUser := r.Context().Value(UserContextKey)
		if rawUser != nil {
			if user, ok := rawUser.(map[string]interface{}); ok {
				if imp, ok := user["impersonated"].(bool); ok && imp {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusForbidden)
					_ = json.NewEncoder(w).Encode(map[string]string{
						"error": "Forbidden: Write operations are blocked in user impersonation mode.",
					})
					return
				}
			}
		}

		next.ServeHTTP(w, r)
	})
}

// HoneypotMiddleware automatically bans any unauthorized user who attempts to hit endpoints decorated with it
func HoneypotMiddleware(repo *repository.OwnerRepo) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rawUser := r.Context().Value(UserContextKey)
			if rawUser == nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			user, ok := rawUser.(map[string]interface{})
			if !ok {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			userIDVal := user["id"]
			var userID int64
			switch v := userIDVal.(type) {
			case int64:
				userID = v
			case float64:
				userID = int64(v)
			default:
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Check if they are actually an owner in the database
			o, err := repo.GetOwnerRole(r.Context(), userID)
			if err == nil && o != nil {
				// They are an actual owner! Let them pass
				next.ServeHTTP(w, r)
				return
			}

			// NOT an owner! Honeypot triggered! Auto-ban the user permanently!
			slog.Warn("🚨 HONEYPOT TRIGGERED! Permanent ban initiated",
				"user_id", userID,
				"username", user["username"],
				"ip", r.RemoteAddr,
				"path", r.URL.Path,
			)

			banReason := "Security violation: Unauthorized attempt to access admin panel honeypot."
			ban := &model.UserBan{
				UserID:   userID,
				BanType:  "full",
				Reason:   banReason,
				BannedBy: 0, // Automated security system
				BannedAt: time.Now(),
			}

			_ = repo.SetUserBan(r.Context(), ban)

			// Clean up audit logs
			payload, _ := json.Marshal(map[string]string{
				"triggered_path": r.URL.Path,
				"action":         "automated_permanent_ban",
			})
			_ = repo.LogOwnerAudit(r.Context(), &model.OwnerAuditLog{
				OwnerID:      0, // Security System
				Action:       "honeypot_ban",
				TargetUserID: &userID,
				Payload:      payload,
				IPAddress:    r.RemoteAddr,
				UserAgent:    r.UserAgent(),
			})

			http.Error(w, "Forbidden: Security violation. Permanent ban initiated.", http.StatusForbidden)
		})
	}
}

// UserBanCheckMiddleware rejects requests from users who are currently banned
func UserBanCheckMiddleware(repo *repository.OwnerRepo) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rawUser := r.Context().Value(UserContextKey)
			if rawUser == nil {
				next.ServeHTTP(w, r)
				return
			}

			user, ok := rawUser.(map[string]interface{})
			if !ok {
				next.ServeHTTP(w, r)
				return
			}

			userIDVal := user["id"]
			var userID int64
			switch v := userIDVal.(type) {
			case int64:
				userID = v
			case float64:
				userID = int64(v)
			}

			if userID != 0 {
				ban, err := repo.GetUserBan(r.Context(), userID)
				if err == nil && ban != nil {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusForbidden)
					_ = json.NewEncoder(w).Encode(map[string]interface{}{
						"error":    "Forbidden: Your account is temporarily suspended.",
						"ban_type": ban.BanType,
						"reason":   ban.Reason,
						"expires":  ban.ExpiresAt,
					})
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}
