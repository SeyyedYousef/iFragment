package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/totp"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type OwnerService struct {
	repo    *repository.OwnerRepo
	frgRepo *repository.FRGRepo
	cache   *repository.Cache
}

func NewOwnerService(repo *repository.OwnerRepo, frgRepo *repository.FRGRepo, cache *repository.Cache) *OwnerService {
	return &OwnerService{
		repo:    repo,
		frgRepo: frgRepo,
		cache:   cache,
	}
}

// Authenticate verifies the TOTP code and generates a JWT token for the owner
func (s *OwnerService) Authenticate(ctx context.Context, telegramUserID int64, code string, ip string, ua string) (string, error) {
	// 1. Verify if user is in OWNER_TELEGRAM_IDS
	ownerIDsStr := os.Getenv("OWNER_TELEGRAM_IDS")
	if ownerIDsStr == "" {
		return "", errors.New("admin panel security not configured on server (missing OWNER_TELEGRAM_IDS)")
	}

	isAllowed := false
	for _, idStr := range strings.Split(ownerIDsStr, ",") {
		idStr = strings.TrimSpace(idStr)
		if id, err := strconv.ParseInt(idStr, 10, 64); err == nil && id == telegramUserID {
			isAllowed = true
			break
		}
	}

	if !isAllowed {
		return "", errors.New("unauthorized: telegram user is not registered as owner")
	}

	// 2. Throw critical configuration error if OWNER_TOTP_SECRET env is missing (no fallback secret)
	totpSecret := os.Getenv("OWNER_TOTP_SECRET")
	if totpSecret == "" {
		return "", errors.New("OWNER_TOTP_SECRET is not configured on the server; refusing to authenticate")
	}

	// 3. Fetch owner role (throw error if role is not pre-registered in DB - no auto-seeding)
	o, err := s.repo.GetOwnerRole(ctx, telegramUserID)
	if err != nil {
		return "", err
	}

	if o == nil {
		return "", errors.New("owner role not provisioned in database; contact security team")
	}

	// 4. IP whitelist validation
	if len(o.IPWhitelist) > 0 {
		clientIP := ip
		if idx := strings.LastIndex(clientIP, ":"); idx != -1 {
			clientIP = clientIP[:idx]
		}
		allowed := false
		for _, cidr := range o.IPWhitelist {
			if _, ipnet, parseErr := net.ParseCIDR(cidr); parseErr == nil {
				if ipnet.Contains(net.ParseIP(clientIP)) {
					allowed = true
					break
				}
			} else if cidr == clientIP { // exact IP match
				allowed = true
				break
			}
		}
		if !allowed {
			return "", errors.New("IP address not allowed by IP whitelist")
		}
	}

	// 5. Verify TOTP Code
	if !totp.ValidateTOTP(code, o.TotpSecret) {
		return "", errors.New("invalid TOTP code")
	}

	// 6. Prevent TOTP code replay attacks (register the code for the 30-second window in the database)
	window := time.Now().Unix() / 30
	if err := s.repo.MarkTOTPUsed(ctx, telegramUserID, window); err != nil {
		return "", errors.New("TOTP code already used; potential replay attack blocked")
	}

	// 7. Update last login
	now := time.Now()
	o.LastLoginAt = &now
	if err := s.repo.UpsertOwnerRole(ctx, o); err != nil {
		return "", err
	}

	// 8. Generate Owner JWT Token (Valid for 15 minutes)
	claims := middleware.JWTClaims{
		UserID:   telegramUserID,
		Username: "owner",
		Role:     o.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return "", err
	}

	// 9. Log Audit Event
	payload, _ := json.Marshal(map[string]interface{}{"ip": ip, "user_agent": ua})
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:   telegramUserID,
		Action:    "login",
		Payload:   payload,
		IPAddress: ip,
		UserAgent: ua,
	})

	return signed, nil
}

func (s *OwnerService) GetDashboardStats(ctx context.Context) (*model.OwnerDashboardStats, error) {
	// Redis caching layer (30 seconds) to prevent heavy database load on dashboard refresh
	if s.cache != nil && s.cache.Client != nil {
		cached, err := s.cache.Client.Get(ctx, "owner_dashboard_stats").Result()
		if err == nil && cached != "" {
			var stats model.OwnerDashboardStats
			if json.Unmarshal([]byte(cached), &stats) == nil {
				return &stats, nil
			}
		}
	}

	stats, err := s.repo.GetDashboardStats(ctx)
	if err != nil {
		return nil, err
	}

	if s.cache != nil && s.cache.Client != nil {
		data, err := json.Marshal(stats)
		if err == nil {
			s.cache.Client.Set(ctx, "owner_dashboard_stats", data, 30*time.Second)
		}
	}

	return stats, nil
}

func (s *OwnerService) AdjustFRG(ctx context.Context, ownerID int64, targetUserID int64, amount float64, reason string, ip string, ua string) (float64, error) {
	if reason == "" {
		return 0, errors.New("reason is required for audit logs")
	}

	// Fetch owner's role to enforce role limits
	ownerRole, err := s.repo.GetOwnerRole(ctx, ownerID)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch owner role: %v", err)
	}
	if ownerRole == nil {
		return 0, errors.New("unauthorized: caller is not a registered owner")
	}

	var maxLimit float64
	switch ownerRole.Role {
	case "support":
		maxLimit = 100.0
	case "moderator":
		maxLimit = 1000.0
	case "admin":
		maxLimit = 100000.0
	case "super_admin":
		maxLimit = 10000000.0
	default:
		return 0, errors.New("forbidden: invalid owner role")
	}

	absAmount := amount
	if absAmount < 0 {
		absAmount = -amount
	}

	if absAmount > maxLimit {
		return 0, fmt.Errorf("adjustment amount %.2f exceeds maximum limit %.2f for role %s", absAmount, maxLimit, ownerRole.Role)
	}

	// Double approval rule for adjustments > 2/3 of the role limits
	if absAmount > (2.0/3.0)*maxLimit {
		return 0, fmt.Errorf("adjustment amount %.2f exceeds role safety limit (%.2f); dual approval required", absAmount, (2.0/3.0)*maxLimit)
	}

	// Fetch current balance to compute diff in audit log
	bal, err := s.frgRepo.GetBalance(ctx, targetUserID)
	if err != nil {
		return 0, err
	}

	var tx *repository.FRGTransaction
	meta, _ := json.Marshal(map[string]interface{}{
		"adjusted_by": ownerID,
		"reason":      reason,
	})

	if amount >= 0 {
		tx, err = s.frgRepo.Credit(ctx, targetUserID, amount, "admin_adjustment", meta)
	} else {
		tx, err = s.frgRepo.Debit(ctx, targetUserID, -amount, "admin_adjustment", meta)
	}

	if err != nil {
		return 0, err
	}

	// Log Audit Event
	payload, _ := json.Marshal(map[string]interface{}{
		"amount":         amount,
		"reason":         reason,
		"balance_before": bal.Balance,
		"balance_after":  tx.BalanceAfter,
	})
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:      ownerID,
		Action:       "frg_adjust",
		TargetUserID: &targetUserID,
		Payload:      payload,
		IPAddress:    ip,
		UserAgent:    ua,
	})

	return tx.BalanceAfter, nil
}

func (s *OwnerService) SetUserBan(ctx context.Context, ownerID int64, targetUserID int64, banType string, reason string, durationSeconds int64, ip string, ua string) error {
	var expiresAt *time.Time
	if durationSeconds > 0 {
		exp := time.Now().Add(time.Duration(durationSeconds) * time.Second)
		expiresAt = &exp
	}

	ban := &model.UserBan{
		UserID:    targetUserID,
		BanType:   banType,
		Reason:    reason,
		BannedBy:  ownerID,
		BannedAt:  time.Now(),
		ExpiresAt: expiresAt,
	}

	if err := s.repo.SetUserBan(ctx, ban); err != nil {
		return err
	}

	// Log Audit Event
	payload, _ := json.Marshal(map[string]interface{}{
		"ban_type":  banType,
		"reason":    reason,
		"expires":   expiresAt,
	},
	)
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:      ownerID,
		Action:       "ban_user",
		TargetUserID: &targetUserID,
		Payload:      payload,
		IPAddress:    ip,
		UserAgent:    ua,
	})

	return nil
}

func (s *OwnerService) RemoveUserBan(ctx context.Context, ownerID int64, targetUserID int64, ip string, ua string) error {
	if err := s.repo.RemoveUserBan(ctx, targetUserID); err != nil {
		return err
	}

	// Log Audit Event
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:      ownerID,
		Action:       "unban_user",
		TargetUserID: &targetUserID,
		IPAddress:    ip,
		UserAgent:    ua,
	})

	return nil
}

func (s *OwnerService) ImpersonateUser(ctx context.Context, ownerID int64, targetUserID int64, ip string, ua string) (string, error) {
	// Create database impersonation session
	sessionID := uuid.NewString()
	sess := &model.ImpersonationSession{
		ID:           sessionID,
		OwnerID:      ownerID,
		TargetUserID: targetUserID,
		StartedAt:    time.Now(),
	}

	if err := s.repo.CreateImpersonationSession(ctx, sess); err != nil {
		return "", err
	}

	// Generate Impersonated JWT Token (Valid for 15 minutes)
	claims := middleware.JWTClaims{
		UserID:   targetUserID,
		Username: fmt.Sprintf("impersonated_user_%d", targetUserID),
		Role:     "user", // Standard user role
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        sessionID, // Link token directly to session
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return "", err
	}

	// Log Audit Event
	payload, _ := json.Marshal(map[string]interface{}{"session_id": sessionID})
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:      ownerID,
		Action:       "impersonate",
		TargetUserID: &targetUserID,
		Payload:      payload,
		IPAddress:    ip,
		UserAgent:    ua,
	})

	return signed, nil
}

func (s *OwnerService) GetAuditLogs(ctx context.Context, limit, offset int) ([]model.OwnerAuditLog, error) {
	return s.repo.GetOwnerAuditLogs(ctx, limit, offset)
}

func (s *OwnerService) SearchUsers(ctx context.Context, query string) ([]repository.SearchUserResult, error) {
	return s.repo.SearchUsers(ctx, query)
}

func (s *OwnerService) CreatePromoCode(ctx context.Context, ownerID int64, code string, amount float64, maxUses int, expiresAt *time.Time, ip string, ua string) error {
	p := model.PromoCode{
		Code:         code,
		RewardAmount: amount,
		MaxUses:      maxUses,
		ExpiresAt:    expiresAt,
	}

	if err := s.repo.CreatePromoCode(ctx, p); err != nil {
		return err
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"code":          code,
		"reward_amount": amount,
		"max_uses":      maxUses,
		"expires_at":    expiresAt,
	})
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:   ownerID,
		Action:    "create_promo",
		Payload:   payload,
		IPAddress: ip,
		UserAgent: ua,
	})

	return nil
}

func (s *OwnerService) DeletePromoCode(ctx context.Context, ownerID int64, code string, ip string, ua string) error {
	if err := s.repo.DeletePromoCode(ctx, code); err != nil {
		return err
	}

	payload, _ := json.Marshal(map[string]string{"code": code})
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:   ownerID,
		Action:    "delete_promo",
		Payload:   payload,
		IPAddress: ip,
		UserAgent: ua,
	})

	return nil
}

func (s *OwnerService) ListPromoCodes(ctx context.Context) ([]model.PromoCode, error) {
	return s.repo.ListPromoCodes(ctx)
}

func (s *OwnerService) RedeemPromoCode(ctx context.Context, userID int64, code string) error {
	return s.repo.RedeemPromoCodeTx(ctx, code, userID, s.frgRepo)
}


