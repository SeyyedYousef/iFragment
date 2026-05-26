package middleware

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"
)

type Permission string

const (
	PermViewDashboard Permission = "dashboard:view"
	PermSearchUsers   Permission = "users:search"
	PermAdjustFRG     Permission = "frg:adjust"
	PermBanUser       Permission = "users:ban"
	PermImpersonate   Permission = "users:impersonate"
	PermPromoManage   Permission = "promo:manage"
	PermPromoView     Permission = "promo:view"
	PermAuditView     Permission = "audit:view"
)

var rolePermissions = map[string]map[Permission]bool{
	"support": {
		PermViewDashboard: true,
		PermSearchUsers:   true,
		PermPromoView:     true,
	},
	"moderator": {
		PermViewDashboard: true,
		PermSearchUsers:   true,
		PermBanUser:       true,
		PermPromoView:     true,
	},
	"admin": {
		PermViewDashboard: true,
		PermSearchUsers:   true,
		PermBanUser:       true,
		PermAdjustFRG:     true,
		PermPromoManage:   true,
		PermPromoView:     true,
		PermAuditView:     true,
	},
	"super_admin": {
		PermViewDashboard: true,
		PermSearchUsers:   true,
		PermBanUser:       true,
		PermAdjustFRG:     true,
		PermPromoManage:   true,
		PermPromoView:     true,
		PermAuditView:     true,
		PermImpersonate:   true,
	},
}

// RequirePermission ensures the authenticated owner possesses the necessary fine-grained RBAC permission
func RequirePermission(p Permission) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
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
			if role == "" {
				http.Error(w, "Forbidden: Role not assigned", http.StatusForbidden)
				return
			}

			perms, ok := rolePermissions[role]
			if !ok || !perms[p] {
				slog.Warn("SECURITY ALERT: Insufficient permissions for owner action",
					"user_id", user["id"],
					"role", role,
					"required_permission", p,
					"ip", getRealIP(r),
				)
				http.Error(w, "Forbidden: Insufficient privileges to perform this action", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

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
				"ip", getRealIP(r),
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

			// NOT an owner! Honeypot triggered! Auto-ban the user with 24 hours expiry!
			clientIP := getRealIP(r)
			slog.Warn("🚨 HONEYPOT TRIGGERED! 24-hour automated ban initiated",
				"user_id", userID,
				"username", user["username"],
				"ip", clientIP,
				"path", r.URL.Path,
			)

			banReason := "Security violation: Unauthorized attempt to access admin panel honeypot."
			expiresAt := time.Now().Add(24 * time.Hour)
			ban := &model.UserBan{
				UserID:    userID,
				BanType:   "full",
				Reason:    banReason,
				BannedBy:  0, // Automated security system (stored as NULL via SetUserBan)
				BannedAt:  time.Now(),
				ExpiresAt: &expiresAt,
			}

			_ = repo.SetUserBan(r.Context(), ban)

			// Clean up audit logs
			payload, _ := json.Marshal(map[string]string{
				"triggered_path": r.URL.Path,
				"action":         "automated_24h_ban",
			})
			_ = repo.LogOwnerAudit(r.Context(), &model.OwnerAuditLog{
				OwnerID:      0, // Security System (stored as NULL via SetUserBan)
				Action:       "honeypot_ban",
				TargetUserID: &userID,
				Payload:      payload,
				IPAddress:    clientIP,
				UserAgent:    r.UserAgent(),
			})

			http.Error(w, "Forbidden: Security violation. Temporary 24-hour ban initiated.", http.StatusForbidden)
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
