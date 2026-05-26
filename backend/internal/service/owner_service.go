package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
}

func NewOwnerService(repo *repository.OwnerRepo, frgRepo *repository.FRGRepo) *OwnerService {
	return &OwnerService{
		repo:    repo,
		frgRepo: frgRepo,
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

	// 2. Fetch or auto-seed owner role
	o, err := s.repo.GetOwnerRole(ctx, telegramUserID)
	if err != nil {
		return "", err
	}

	if o == nil {
		// First time owner login: seed from env or default secret
		totpSecret := os.Getenv("OWNER_TOTP_SECRET")
		if totpSecret == "" {
			// Seed default secure base32 secret
			totpSecret = "ORXW233SMUXW633X" // Seed secret: 'adminsecret' in base32
		}

		o = &model.OwnerRole{
			TelegramUserID: telegramUserID,
			Role:           "super_admin",
			TotpSecret:     totpSecret,
			IPWhitelist:    []string{},
			CreatedAt:      time.Now(),
		}

		if err := s.repo.UpsertOwnerRole(ctx, o); err != nil {
			return "", fmt.Errorf("failed to seed owner role: %v", err)
		}
	}

	// 3. Verify TOTP Code
	if !totp.ValidateTOTP(code, o.TotpSecret) {
		return "", errors.New("invalid TOTP code")
	}

	// 4. Update last login
	now := time.Now()
	o.LastLoginAt = &now
	if err := s.repo.UpsertOwnerRole(ctx, o); err != nil {
		return "", err
	}

	// 5. Generate Owner JWT Token (Valid for 15 minutes)
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

	// 6. Log Audit Event
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
	return s.repo.GetDashboardStats(ctx)
}

func (s *OwnerService) AdjustFRG(ctx context.Context, ownerID int64, targetUserID int64, amount float64, reason string, ip string, ua string) (float64, error) {
	if reason == "" {
		return 0, errors.New("reason is required for audit logs")
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


