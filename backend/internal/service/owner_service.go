package service

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/broadcaster"
	"ifragment-backend/internal/service/media"
	"ifragment-backend/internal/service/totp"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

var (
	promoCodeRe     = regexp.MustCompile(`^[A-Z0-9]{4,20}$`)
	serverStartTime = time.Now()
)

type OwnerService struct {
	repo            *repository.OwnerRepo
	cache           *repository.Cache
	settingsRepo    *repository.SettingsRepo
	ubManager       *mtproto.UserbotManager
	broadcastWorker *broadcaster.BroadcastWorker
}

func NewOwnerService(
	repo *repository.OwnerRepo,
	cache *repository.Cache,
	settingsRepo *repository.SettingsRepo,
	ubManager *mtproto.UserbotManager,
) *OwnerService {
	botToken := os.Getenv("BOT_TOKEN")
	if botToken == "" {
		botToken = os.Getenv("TELEGRAM_BOT_TOKEN")
	}
	var rClient *redis.Client
	if cache != nil {
		rClient = cache.Client
	}
	worker := broadcaster.NewBroadcastWorker(repo, rClient, botToken)

	return &OwnerService{
		repo:            repo,
		cache:           cache,
		settingsRepo:    settingsRepo,
		ubManager:       ubManager,
		broadcastWorker: worker,
	}
}

func (s *OwnerService) GetBroadcastWorker() *broadcaster.BroadcastWorker {
	return s.broadcastWorker
}

// ─── P0.1 Server-Side Secret Redaction ───────────────────────────────────────
var sensitiveKeyPatterns = []string{
	"password", "token", "secret", "key", "authorization",
	"cookie", "session", "api_key", "phone", "init_data", "initdata", "auth",
}

func isSensitiveKey(k string) bool {
	lower := strings.ToLower(k)
	for _, p := range sensitiveKeyPatterns {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
}

func redactValue(v interface{}) interface{} {
	if v == nil {
		return nil
	}
	switch val := v.(type) {
	case string:
		if len(val) <= 4 {
			return "***[REDACTED]"
		}
		return "***" + val[len(val)-4:]
	case map[string]interface{}:
		return redactMap(val)
	case []interface{}:
		res := make([]interface{}, len(val))
		for i, elem := range val {
			res[i] = redactValue(elem)
		}
		return res
	default:
		return "***[REDACTED]"
	}
}

func redactMap(m map[string]interface{}) map[string]interface{} {
	if m == nil {
		return nil
	}
	res := make(map[string]interface{}, len(m))
	for k, v := range m {
		if isSensitiveKey(k) {
			res[k] = redactValue(v)
		} else if subMap, ok := v.(map[string]interface{}); ok {
			res[k] = redactMap(subMap)
		} else if subSlice, ok := v.([]interface{}); ok {
			res[k] = redactValue(subSlice)
		} else {
			res[k] = v
		}
	}
	return res
}

func (s *OwnerService) RedactAuditPayload(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}
	var data map[string]interface{}
	if err := json.Unmarshal(raw, &data); err != nil {
		var sliceData []interface{}
		if err := json.Unmarshal(raw, &sliceData); err != nil {
			return json.RawMessage(`{"sanitized": "***[REDACTED]"}`)
		}
		redactedSlice := redactValue(sliceData)
		resBytes, _ := json.Marshal(redactedSlice)
		return resBytes
	}
	redacted := redactMap(data)
	resBytes, _ := json.Marshal(redacted)
	return resBytes
}

func (s *OwnerService) SanitizeAuditLogs(logs []model.OwnerAuditLog) []model.OwnerAuditLog {
	for i := range logs {
		if len(logs[i].Payload) > 0 {
			logs[i].Payload = s.RedactAuditPayload(logs[i].Payload)
		}
	}
	return logs
}

// ─── P0.2 & P0.3 Authentication & TOTP ──────────────────────────────────────
type AuthResult struct {
	Token          string `json:"token,omitempty"`
	MFARequired    bool   `json:"mfa_required"`
	TempToken      string `json:"temp_token,omitempty"`
	TotpEnabled    bool   `json:"totp_enabled"`
	GraceDaysLeft  int    `json:"grace_days_left,omitempty"`
}

func (s *OwnerService) Authenticate(ctx context.Context, telegramUserID int64, password string, ip string, ua string) (*AuthResult, error) {
	// 1. Verify if user is in OWNER_TELEGRAM_IDS
	ownerIDsStr := os.Getenv("OWNER_TELEGRAM_IDS")
	if ownerIDsStr == "" {
		return nil, errors.New("admin panel security not configured on server (missing OWNER_TELEGRAM_IDS)")
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
		return nil, errors.New("unauthorized: telegram user is not registered as owner")
	}

	// Rate limit: Max 5 failed attempts per 15 minutes per IP and per Telegram ID
	if s.cache != nil && s.cache.Client != nil {
		ipLockKey := fmt.Sprintf("owner:login:attempts:ip:%s", ip)
		userLockKey := fmt.Sprintf("owner:login:attempts:user:%d", telegramUserID)

		pipe := s.cache.Client.Pipeline()
		ipGet := pipe.Get(ctx, ipLockKey)
		userGet := pipe.Get(ctx, userLockKey)
		_, _ = pipe.Exec(ctx)

		if val, err := ipGet.Int(); err == nil && val >= 5 {
			return nil, errors.New("too many login attempts from this IP; locked temporarily for 15 minutes")
		}
		if val, err := userGet.Int(); err == nil && val >= 5 {
			return nil, errors.New("too many login attempts for this account; locked temporarily for 15 minutes")
		}
	}

	incrLoginAttempts := func() {
		if s.cache != nil && s.cache.Client != nil {
			ipLockKey := fmt.Sprintf("owner:login:attempts:ip:%s", ip)
			userLockKey := fmt.Sprintf("owner:login:attempts:user:%d", telegramUserID)

			pipe := s.cache.Client.Pipeline()
			pipe.Incr(ctx, ipLockKey)
			pipe.Expire(ctx, ipLockKey, 15*time.Minute)
			pipe.Incr(ctx, userLockKey)
			pipe.Expire(ctx, userLockKey, 15*time.Minute)
			_, _ = pipe.Exec(ctx)
		}
	}

	// 2. Validate OWNER_PASSWORD / OWNER_PASSWORD_HASH
	ownerPassword := os.Getenv("OWNER_PASSWORD")
	ownerPasswordHash := os.Getenv("OWNER_PASSWORD_HASH")

	if ownerPassword == "" && ownerPasswordHash == "" {
		incrLoginAttempts()
		return nil, errors.New("OWNER_PASSWORD is not configured on the server; refusing to authenticate")
	}

	// Constant-time password verification
	passwordValid := false
	if ownerPasswordHash != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(ownerPasswordHash), []byte(password)); err == nil {
			passwordValid = true
		}
	}
	if !passwordValid && ownerPassword != "" {
		if subtle.ConstantTimeCompare([]byte(password), []byte(ownerPassword)) == 1 {
			passwordValid = true
		}
	}

	if !passwordValid {
		incrLoginAttempts()
		return nil, errors.New("invalid password")
	}

	// 3. Fetch or seed owner role
	o, err := s.repo.GetOwnerRole(ctx, telegramUserID)
	if err != nil {
		incrLoginAttempts()
		return nil, err
	}

	if o == nil {
		o = &model.OwnerRole{
			TelegramUserID: telegramUserID,
			Role:           "super_admin",
			TotpSecret:     "",
			TotpEnabled:    false,
		}
		if err := s.repo.UpsertOwnerRole(ctx, o); err != nil {
			incrLoginAttempts()
			return nil, fmt.Errorf("failed to auto-seed owner role: %w", err)
		}
	}

	// 4. IP whitelist validation
	if len(o.IPWhitelist) > 0 {
		clientIP := ip
		if host, _, err := net.SplitHostPort(clientIP); err == nil {
			clientIP = host
		}
		allowed := false
		for _, cidr := range o.IPWhitelist {
			if _, ipnet, parseErr := net.ParseCIDR(cidr); parseErr == nil {
				if ipnet.Contains(net.ParseIP(clientIP)) {
					allowed = true
					break
				}
			} else if cidr == clientIP {
				allowed = true
				break
			}
		}
		if !allowed {
			incrLoginAttempts()
			return nil, errors.New("IP address not allowed by IP whitelist")
		}
	}

	// 5. Reset login failure attempts
	if s.cache != nil && s.cache.Client != nil {
		ipLockKey := fmt.Sprintf("owner:login:attempts:ip:%s", ip)
		userLockKey := fmt.Sprintf("owner:login:attempts:user:%d", telegramUserID)
		pipe := s.cache.Client.Pipeline()
		pipe.Del(ctx, ipLockKey)
		pipe.Del(ctx, userLockKey)
		_, _ = pipe.Exec(ctx)
	}

	// 6. Check TOTP Multi-Factor Authentication requirement
	if o.TotpEnabled && o.TotpSecret != "" {
		// Generate temporary pre-auth challenge token (valid for 5 minutes, TokenType="owner_preauth")
		tempClaims := middleware.JWTClaims{
			UserID:      telegramUserID,
			Username:    "owner",
			Role:        o.Role,
			TokenType:   "owner_preauth",
			MFAVerified: false,
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
			},
		}
		tempTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, tempClaims)
		tempToken, err := tempTokenObj.SignedString([]byte(os.Getenv("JWT_SECRET")))
		if err != nil {
			return nil, err
		}

		return &AuthResult{
			MFARequired: true,
			TempToken:   tempToken,
			TotpEnabled: true,
		}, nil
	}

	// Grace period check for initial TOTP enrollment (7 days from creation)
	graceDaysLeft := 7
	if !o.CreatedAt.IsZero() {
		daysSinceCreation := int(time.Since(o.CreatedAt).Hours() / 24)
		graceDaysLeft = 7 - daysSinceCreation
		if graceDaysLeft < 0 {
			graceDaysLeft = 0
		}
	}

	// Update last login
	now := time.Now()
	o.LastLoginAt = &now
	_ = s.repo.UpsertOwnerRole(ctx, o)

	// Issue final Owner JWT Token (15 minutes, MFAVerified=false if in grace period)
	claims := middleware.JWTClaims{
		UserID:      telegramUserID,
		Username:    "owner",
		Role:        o.Role,
		TokenType:   "owner",
		MFAVerified: true, // Allowed in grace period
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return nil, err
	}

	// Log Audit Event
	payload, _ := json.Marshal(map[string]interface{}{
		"ip":              ip,
		"user_agent":      ua,
		"grace_days_left": graceDaysLeft,
	})
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:   telegramUserID,
		Action:    "login",
		Payload:   payload,
		IPAddress: ip,
		UserAgent: ua,
	})

	return &AuthResult{
		Token:         signed,
		MFARequired:   false,
		TotpEnabled:   false,
		GraceDaysLeft: graceDaysLeft,
	}, nil
}

// VerifyTOTPLogin verifies the 6-digit TOTP code or a single-use recovery code
func (s *OwnerService) VerifyTOTPLogin(ctx context.Context, tempToken string, code string, ip, ua string) (string, error) {
	// Parse tempToken
	claims := &middleware.JWTClaims{}
	parsed, err := jwt.ParseWithClaims(tempToken, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
	if err != nil || !parsed.Valid || claims.TokenType != "owner_preauth" {
		return "", errors.New("invalid or expired pre-authentication session; please login again with password")
	}

	o, err := s.repo.GetOwnerRole(ctx, claims.UserID)
	if err != nil || o == nil {
		return "", errors.New("owner not found")
	}

	cleanedCode := strings.TrimSpace(code)

	// Case 1: Check 6-digit TOTP code
	if len(cleanedCode) == 6 {
		valid, codeWindow := totp.ValidateTOTPAndGetWindow(cleanedCode, o.TotpSecret)
		if !valid {
			return "", errors.New("invalid 6-digit TOTP verification code")
		}

		// Replay protection: check if window is already used
		used, err := s.repo.IsTOTPWindowUsed(ctx, o.TelegramUserID, codeWindow)
		if err != nil || used {
			return "", errors.New("this TOTP code has already been used; please wait for the next 30-second code")
		}
		_ = s.repo.MarkTOTPUsed(ctx, o.TelegramUserID, codeWindow)
	} else {
		// Case 2: Check 8-10 char Recovery Code
		matched, remainingHashes := totp.ValidateAndConsumeRecoveryCode(cleanedCode, o.RecoveryCodesHashes)
		if !matched {
			return "", errors.New("invalid TOTP code or recovery code")
		}
		_ = s.repo.ConsumeRecoveryCode(ctx, o.TelegramUserID, remainingHashes)
		slog.Warn("Owner consumed recovery code for login", "user_id", o.TelegramUserID)
	}

	// Update last login
	now := time.Now()
	o.LastLoginAt = &now
	_ = s.repo.UpsertOwnerRole(ctx, o)

	// Issue final Owner JWT Token
	finalClaims := middleware.JWTClaims{
		UserID:      o.TelegramUserID,
		Username:    "owner",
		Role:        o.Role,
		TokenType:   "owner",
		MFAVerified: true,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	finalToken := jwt.NewWithClaims(jwt.SigningMethodHS256, finalClaims)
	signed, err := finalToken.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return "", err
	}

	// Audit log
	payload, _ := json.Marshal(map[string]interface{}{
		"ip":         ip,
		"user_agent": ua,
		"mfa_method": "totp",
	})
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:   o.TelegramUserID,
		Action:    "totp_login_success",
		Payload:   payload,
		IPAddress: ip,
		UserAgent: ua,
	})

	return signed, nil
}

type TOTPSetupResponse struct {
	Secret        string   `json:"secret"`
	ProvisioningURI string `json:"provisioning_uri"`
	RecoveryCodes []string `json:"recovery_codes"`
}

func (s *OwnerService) SetupTOTP(ctx context.Context, tgID int64) (*TOTPSetupResponse, error) {
	secret, err := totp.GenerateSecret()
	if err != nil {
		return nil, err
	}

	plainRecovery, hashedRecovery, err := totp.GenerateRecoveryCodes(10)
	if err != nil {
		return nil, err
	}

	// Temporarily store secret in cache for verification step (10 minutes TTL)
	if s.cache != nil && s.cache.Client != nil {
		setupData, _ := json.Marshal(map[string]interface{}{
			"secret":         secret,
			"recovery_hashes": hashedRecovery,
		})
		s.cache.Client.Set(ctx, fmt.Sprintf("owner:totp:setup:%d", tgID), string(setupData), 10*time.Minute)
	}

	uri := totp.GetProvisioningURI(secret, fmt.Sprintf("owner_%d", tgID), "iFragment")

	return &TOTPSetupResponse{
		Secret:          secret,
		ProvisioningURI: uri,
		RecoveryCodes:   plainRecovery,
	}, nil
}

func (s *OwnerService) VerifyTOTPSetup(ctx context.Context, tgID int64, code string) error {
	var setupData struct {
		Secret         string   `json:"secret"`
		RecoveryHashes []string `json:"recovery_hashes"`
	}

	if s.cache != nil && s.cache.Client != nil {
		val, err := s.cache.Client.Get(ctx, fmt.Sprintf("owner:totp:setup:%d", tgID)).Result()
		if err != nil || val == "" {
			return errors.New("TOTP setup session expired; please generate a new QR code")
		}
		_ = json.Unmarshal([]byte(val), &setupData)
	}

	if setupData.Secret == "" {
		return errors.New("invalid TOTP setup session")
	}

	valid, codeWindow := totp.ValidateTOTPAndGetWindow(code, setupData.Secret)
	if !valid {
		return errors.New("invalid 6-digit TOTP code; please ensure your authenticator app time is synced")
	}

	_ = s.repo.MarkTOTPUsed(ctx, tgID, codeWindow)
	err := s.repo.UpdateOwnerTOTP(ctx, tgID, true, setupData.Secret, setupData.RecoveryHashes)
	if err != nil {
		return err
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("owner:totp:setup:%d", tgID))
	}

	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID: tgID,
		Action:  "totp_enabled",
		Payload: json.RawMessage(`{"status": "enabled"}`),
	})

	return nil
}

func (s *OwnerService) DisableTOTP(ctx context.Context, tgID int64, currentCode string) error {
	o, err := s.repo.GetOwnerRole(ctx, tgID)
	if err != nil || o == nil {
		return errors.New("owner not found")
	}

	if !o.TotpEnabled {
		return errors.New("TOTP is already disabled")
	}

	valid := totp.ValidateTOTP(currentCode, o.TotpSecret)
	if !valid {
		return errors.New("invalid current TOTP code; refusing to disable MFA")
	}

	err = s.repo.UpdateOwnerTOTP(ctx, tgID, false, "", []string{})
	if err != nil {
		return err
	}

	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID: tgID,
		Action:  "totp_disabled",
		Payload: json.RawMessage(`{"status": "disabled"}`),
	})

	return nil
}

// ─── P0.4 Impersonation ─────────────────────────────────────────────────────
func (s *OwnerService) ImpersonateUser(ctx context.Context, ownerID int64, targetUserID int64, ip string, ua string) (string, error) {
	// Block impersonating another owner/administrator
	isTargetAdmin, err := s.repo.GetOwnerRole(ctx, targetUserID)
	if err == nil && isTargetAdmin != nil {
		return "", errors.New("forbidden: administrators cannot be impersonated under any circumstances")
	}

	ownerIDsStr := os.Getenv("OWNER_TELEGRAM_IDS")
	if ownerIDsStr != "" {
		for _, idStr := range strings.Split(ownerIDsStr, ",") {
			idStr = strings.TrimSpace(idStr)
			if id, err := strconv.ParseInt(idStr, 10, 64); err == nil && id == targetUserID {
				return "", errors.New("forbidden: administrators cannot be impersonated under any circumstances")
			}
		}
	}

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

	// Generate Impersonated JWT Token (15 minutes)
	claims := middleware.JWTClaims{
		UserID:   targetUserID,
		Username: fmt.Sprintf("impersonated_user_%d", targetUserID),
		Role:     "user",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        sessionID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return "", err
	}

	payload, _ := json.Marshal(map[string]interface{}{"session_id": sessionID})
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:      ownerID,
		Action:       "impersonate_start",
		TargetUserID: &targetUserID,
		Payload:      payload,
		IPAddress:    ip,
		UserAgent:    ua,
	})

	return signed, nil
}

func (s *OwnerService) EndImpersonation(ctx context.Context, ownerID int64, sessionID string, actions []string) error {
	err := s.repo.EndImpersonationSession(ctx, sessionID, actions)
	if err != nil {
		return err
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"session_id":    sessionID,
		"actions_count": len(actions),
	})
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID: ownerID,
		Action:  "impersonate_end",
		Payload: payload,
	})

	return nil
}

// ─── Dashboard Stats & Audit Logs ───────────────────────────────────────────
func (s *OwnerService) GetDashboardStats(ctx context.Context, ownerID int64) (*model.OwnerDashboardStats, error) {
	if s.cache != nil && s.cache.Client != nil {
		cached, err := s.cache.Client.Get(ctx, "owner_dashboard_stats").Result()
		if err == nil && cached != "" {
			var stats model.OwnerDashboardStats
			if json.Unmarshal([]byte(cached), &stats) == nil {
				stats.RecentActivity = s.SanitizeAuditLogs(stats.RecentActivity)
				return &stats, nil
			}
		}
	}

	stats, err := s.repo.GetDashboardStats(ctx)
	if err != nil {
		return nil, err
	}

	// Attach owner's TOTP status
	if o, err := s.repo.GetOwnerRole(ctx, ownerID); err == nil && o != nil {
		stats.TotpEnabled = o.TotpEnabled
		if !o.CreatedAt.IsZero() {
			daysSince := int(time.Since(o.CreatedAt).Hours() / 24)
			stats.TotpGraceDays = max(0, 7-daysSince)
		}
	}

	stats.RecentActivity = s.SanitizeAuditLogs(stats.RecentActivity)

	if s.cache != nil && s.cache.Client != nil {
		data, err := json.Marshal(stats)
		if err == nil {
			s.cache.Client.Set(ctx, "owner_dashboard_stats", data, 30*time.Second)
		}
	}

	return stats, nil
}

func (s *OwnerService) GetAuditLogsFiltered(ctx context.Context, limit, offset int, action, search string) ([]model.OwnerAuditLog, int64, error) {
	logs, total, err := s.repo.GetOwnerAuditLogsFiltered(ctx, limit, offset, action, search)
	if err != nil {
		return nil, 0, err
	}
	return s.SanitizeAuditLogs(logs), total, nil
}

func (s *OwnerService) GetAuditLogs(ctx context.Context, limit, offset int) ([]model.OwnerAuditLog, error) {
	logs, err := s.repo.GetOwnerAuditLogs(ctx, limit, offset)
	if err != nil {
		return nil, err
	}
	return s.SanitizeAuditLogs(logs), nil
}

// ─── Users Search & User Actions ────────────────────────────────────────────
func (s *OwnerService) SearchUsersPaginated(ctx context.Context, query string, limit, offset int, filter string) ([]model.SearchedUser, int64, error) {
	return s.repo.SearchUsersPaginated(ctx, query, limit, offset, filter)
}

func (s *OwnerService) SearchUsers(ctx context.Context, query string) ([]model.SearchedUser, error) {
	return s.repo.SearchUsers(ctx, query)
}

func (s *OwnerService) FlagUser(ctx context.Context, ownerID int64, targetUserID int64, isFlagged bool, reason string, ip string, ua string) error {
	return s.repo.FlagUser(ctx, ownerID, targetUserID, isFlagged, reason, ip, ua)
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

	tx, err := s.repo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := s.repo.SetUserBanTx(ctx, tx, ban); err != nil {
		return err
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"ban_type": banType,
		"reason":   reason,
		"expires":  expiresAt,
	})

	auditLog := &model.OwnerAuditLog{
		OwnerID:      ownerID,
		Action:       "ban_user",
		TargetUserID: &targetUserID,
		Payload:      payload,
		IPAddress:    ip,
		UserAgent:    ua,
	}
	if err := s.repo.LogOwnerAuditTx(ctx, tx, auditLog); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *OwnerService) RemoveUserBan(ctx context.Context, ownerID int64, targetUserID int64, ip string, ua string) error {
	tx, err := s.repo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := s.repo.RemoveUserBanTx(ctx, tx, targetUserID); err != nil {
		return err
	}

	auditLog := &model.OwnerAuditLog{
		OwnerID:      ownerID,
		Action:       "unban_user",
		TargetUserID: &targetUserID,
		IPAddress:    ip,
		UserAgent:    ua,
	}
	if err := s.repo.LogOwnerAuditTx(ctx, tx, auditLog); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

type AdjustAirdropCoinsRequest struct {
	UserID int64   `json:"user_id"`
	Amount float64 `json:"amount"`
	Reason string  `json:"reason"`
}

func (s *OwnerService) AdjustAirdropCoins(ctx context.Context, req AdjustAirdropCoinsRequest, adminID int64, ip string) (float64, error) {
	if req.UserID == 0 {
		return 0, errors.New("user_id is required")
	}
	if math.IsNaN(req.Amount) || math.IsInf(req.Amount, 0) {
		return 0, errors.New("invalid adjustment amount")
	}

	newBalance, err := s.repo.DB().AdjustAirdropCoins(ctx, req.UserID, req.Amount)
	if err != nil {
		return 0, err
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", req.UserID))
	}

	slog.Info("Owner adjusted user airdrop coins", "user_id", req.UserID, "amount", req.Amount, "reason", req.Reason, "admin_id", adminID)

	payloadBytes, _ := json.Marshal(map[string]interface{}{
		"amount": req.Amount,
		"reason": req.Reason,
	})

	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:      adminID,
		Action:       "adjust_airdrop_coins",
		TargetUserID: &req.UserID,
		Payload:      payloadBytes,
		IPAddress:    ip,
	})

	return newBalance, nil
}

// ─── Phase 1.1 Broadcasts ───────────────────────────────────────────────────
func (s *OwnerService) CreateBroadcast(ctx context.Context, ownerID int64, targetAudience, message string, scheduledAt *time.Time, ip, ua string) (string, error) {
	if targetAudience == "" || strings.TrimSpace(message) == "" {
		return "", errors.New("target_audience and message are required")
	}

	id, err := s.repo.CreateBroadcastWithSchedule(ctx, ownerID, targetAudience, message, scheduledAt)
	if err != nil {
		return "", err
	}

	payloadBytes, _ := json.Marshal(map[string]interface{}{
		"broadcast_id":    id,
		"target_audience": targetAudience,
		"scheduled_at":    scheduledAt,
	})
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:   ownerID,
		Action:    "create_broadcast",
		Payload:   payloadBytes,
		IPAddress: ip,
		UserAgent: ua,
	})

	return id, nil
}

func (s *OwnerService) ListBroadcasts(ctx context.Context) ([]model.Broadcast, error) {
	return s.repo.ListBroadcasts(ctx)
}

func (s *OwnerService) GetAudienceCount(ctx context.Context, audience string) (int64, error) {
	cacheKey := fmt.Sprintf("broadcast:audience_count:%s", audience)
	if s.cache != nil && s.cache.Client != nil {
		val, err := s.cache.Client.Get(ctx, cacheKey).Int64()
		if err == nil {
			return val, nil
		}
	}

	count, err := s.repo.GetAudienceCount(ctx, audience)
	if err != nil {
		return 0, err
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Set(ctx, cacheKey, count, 5*time.Minute)
	}

	return count, nil
}

func (s *OwnerService) PauseBroadcast(ctx context.Context, id string, ownerID int64) error {
	paused := s.broadcastWorker.PauseBroadcast(id)
	if !paused {
		_ = s.repo.UpdateBroadcastStatus(ctx, id, "paused")
	}
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID: ownerID,
		Action:  "pause_broadcast",
		Payload: json.RawMessage(fmt.Sprintf(`{"broadcast_id": "%s"}`, id)),
	})
	return nil
}

func (s *OwnerService) ResumeBroadcast(ctx context.Context, id string, ownerID int64) error {
	err := s.broadcastWorker.ResumeBroadcast(ctx, id)
	if err != nil {
		return err
	}
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID: ownerID,
		Action:  "resume_broadcast",
		Payload: json.RawMessage(fmt.Sprintf(`{"broadcast_id": "%s"}`, id)),
	})
	return nil
}

func (s *OwnerService) CancelBroadcast(ctx context.Context, id string, ownerID int64) error {
	s.broadcastWorker.CancelBroadcast(id)
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID: ownerID,
		Action:  "cancel_broadcast",
		Payload: json.RawMessage(fmt.Sprintf(`{"broadcast_id": "%s"}`, id)),
	})
	return nil
}

// ─── Phase 1.2 Entities (Extend Subscription vs Grant Coins) ────────────────
func (s *OwnerService) GetAllChannels(ctx context.Context, limit, offset int) ([]model.EntityRecord, error) {
	return s.repo.GetAllChannels(ctx, limit, offset)
}

func (s *OwnerService) GetAllGroups(ctx context.Context, limit, offset int) ([]model.EntityRecord, error) {
	return s.repo.GetAllGroups(ctx, limit, offset)
}

func (s *OwnerService) ExtendEntitySubscription(ctx context.Context, entityType, entityID string, days int, reason string, adminID int64, ip string) (*time.Time, error) {
	if days <= 0 || days > 3650 {
		return nil, errors.New("days must be between 1 and 3650")
	}
	if strings.TrimSpace(reason) == "" {
		return nil, errors.New("reason is required for audit ledger")
	}

	var newUntil *time.Time
	var err error
	if entityType == "channel" {
		newUntil, err = s.repo.AddChannelSubscriptionDays(ctx, entityID, days)
	} else if entityType == "group" {
		newUntil, err = s.repo.AddGroupSubscriptionDays(ctx, entityID, days)
	} else {
		return nil, fmt.Errorf("invalid entity type: %s", entityType)
	}

	if err != nil {
		return nil, err
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"entity_type": entityType,
		"entity_id":   entityID,
		"days_added":  days,
		"new_until":   newUntil,
		"reason":      reason,
	})
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:   adminID,
		Action:    "extend_entity_subscription",
		Payload:   payload,
		IPAddress: ip,
	})

	return newUntil, nil
}

func (s *OwnerService) GrantEntityCoins(ctx context.Context, entityType, entityID string, coins float64, reason string, adminID int64, ip string) (float64, error) {
	if coins <= 0 || coins > 100000000 {
		return 0, errors.New("coins must be between 1 and 100,000,000")
	}
	if strings.TrimSpace(reason) == "" {
		return 0, errors.New("reason is required for audit ledger")
	}

	var newBalance float64
	var err error
	if entityType == "channel" {
		newBalance, err = s.repo.AddChannelCoins(ctx, entityID, coins)
	} else if entityType == "group" {
		newBalance, err = s.repo.AddGroupCoins(ctx, entityID, coins)
	} else {
		return 0, fmt.Errorf("invalid entity type: %s", entityType)
	}

	if err != nil {
		return 0, err
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"entity_type": entityType,
		"entity_id":   entityID,
		"coins_added": coins,
		"new_balance": newBalance,
		"reason":      reason,
	})
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:   adminID,
		Action:    "grant_entity_coins",
		Payload:   payload,
		IPAddress: ip,
	})

	return newBalance, nil
}

// ─── Phase 1.3 Finance Summary & Orders ─────────────────────────────────────
func (s *OwnerService) GetOrdersList(ctx context.Context, limit, offset int) ([]model.OrderRecord, error) {
	return s.repo.GetOrdersList(ctx, limit, offset)
}

func (s *OwnerService) GetFinanceSummary(ctx context.Context) (*model.FinanceSummary, error) {
	cacheKey := "owner:finance:summary"
	if s.cache != nil && s.cache.Client != nil {
		val, err := s.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil && val != "" {
			var summary model.FinanceSummary
			if json.Unmarshal([]byte(val), &summary) == nil {
				return &summary, nil
			}
		}
	}

	summary, err := s.repo.GetFinanceSummary(ctx)
	if err != nil {
		return nil, err
	}

	if s.cache != nil && s.cache.Client != nil {
		data, _ := json.Marshal(summary)
		s.cache.Client.Set(ctx, cacheKey, string(data), 60*time.Second)
	}

	return summary, nil
}

func (s *OwnerService) GetPremiumEntities(ctx context.Context) ([]model.PremiumEntity, error) {
	return s.repo.GetPremiumEntities(ctx)
}

// ─── Phase 1.5 Userbot MTProto Real LogOut ──────────────────────────────────
func (s *OwnerService) UserbotSendCode(ctx context.Context, phone string) (string, error) {
	return mtproto.AuthSendCode(ctx, phone)
}

func (s *OwnerService) UserbotVerifyCode(ctx context.Context, phone, code, hash string) error {
	err := mtproto.AuthSignIn(ctx, phone, code, hash)
	if err != nil {
		return err
	}

	if s.ubManager != nil {
		if err := s.ubManager.AddClient(ctx, phone); err != nil {
			return err
		}
	}

	return s.repo.CreateManagedUserbot(ctx, phone)
}

func (s *OwnerService) ListUserbots(ctx context.Context) ([]model.ManagedUserbot, error) {
	return s.repo.GetActiveManagedUserbots(ctx)
}

func (s *OwnerService) DeleteUserbot(ctx context.Context, id string, ownerID int64, ip string) error {
	bot, err := s.repo.GetManagedUserbotByID(ctx, id)
	if err == nil && bot != nil {
		// Stop client in pool and cleanup session
		if s.ubManager != nil {
			s.ubManager.RemoveClient(bot.PhoneNumber)
		}
		sessionDir, dirErr := mtproto.EnsureSessionDir()
		if dirErr == nil {
			sessionPath := filepath.Join(sessionDir, fmt.Sprintf("userbot_%s.session", bot.PhoneNumber))
			_ = os.Remove(sessionPath)
		}
	}

	err = s.repo.DeleteManagedUserbot(ctx, id)
	if err != nil {
		return err
	}

	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:   ownerID,
		Action:    "delete_userbot",
		Payload:   json.RawMessage(fmt.Sprintf(`{"userbot_id": "%s"}`, id)),
		IPAddress: ip,
	})

	return nil
}

// ─── Phase 2 Ads Campaign & Media Pipeline ──────────────────────────────────
func (s *OwnerService) UploadAdImage(ctx context.Context, r io.Reader, slot string, ownerID int64, ip string) (*media.ProcessedImage, error) {
	processed, err := media.ProcessAndStoreAdImage(r, slot)
	if err != nil {
		return nil, err
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"filename":   processed.Filename,
		"url":        processed.URL,
		"size_bytes": processed.SizeBytes,
		"slot":       slot,
	})
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:   ownerID,
		Action:    "upload_ad_image",
		Payload:   payload,
		IPAddress: ip,
	})

	return processed, nil
}

func (s *OwnerService) CreateAdCampaign(ctx context.Context, ad *model.AdCampaign, ownerID int64, ip string) error {
	if strings.TrimSpace(ad.Title) == "" || strings.TrimSpace(ad.ImageURL) == "" {
		return errors.New("title and image_url are required")
	}
	if ad.TargetURL != "" && !strings.HasPrefix(ad.TargetURL, "https://") && !strings.HasPrefix(ad.TargetURL, "http://") && !strings.HasPrefix(ad.TargetURL, "t.me/") && !strings.HasPrefix(ad.TargetURL, "@") {
		return errors.New("target_url must be a valid HTTPS URL or Telegram handle")
	}

	err := s.repo.CreateAdCampaign(ctx, ad)
	if err != nil {
		return err
	}

	payload, _ := json.Marshal(ad)
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:   ownerID,
		Action:    "create_ad_campaign",
		Payload:   payload,
		IPAddress: ip,
	})
	return nil
}

func (s *OwnerService) ListAdCampaigns(ctx context.Context, slot string) ([]model.AdCampaign, error) {
	return s.repo.ListAdCampaigns(ctx, slot)
}

func (s *OwnerService) ListActiveAdCampaigns(ctx context.Context, slot string) ([]model.AdCampaign, error) {
	return s.repo.ListActiveAdCampaigns(ctx, slot)
}

func (s *OwnerService) UpdateAdCampaign(ctx context.Context, ad *model.AdCampaign, ownerID int64, ip string) error {
	err := s.repo.UpdateAdCampaign(ctx, ad)
	if err != nil {
		return err
	}

	payload, _ := json.Marshal(ad)
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:   ownerID,
		Action:    "update_ad_campaign",
		Payload:   payload,
		IPAddress: ip,
	})
	return nil
}

func (s *OwnerService) DeleteAdCampaign(ctx context.Context, id string, ownerID int64, ip string) error {
	err := s.repo.DeleteAdCampaign(ctx, id)
	if err != nil {
		return err
	}

	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:   ownerID,
		Action:    "delete_ad_campaign",
		Payload:   json.RawMessage(fmt.Sprintf(`{"ad_id": "%s"}`, id)),
		IPAddress: ip,
	})
	return nil
}

func (s *OwnerService) TrackAdImpression(ctx context.Context, id string) error {
	return s.repo.TrackAdImpression(ctx, id)
}

func (s *OwnerService) TrackAdClick(ctx context.Context, id string) error {
	return s.repo.TrackAdClick(ctx, id)
}

// ─── Settings & Optimistic Locking ──────────────────────────────────────────
func (s *OwnerService) GetSystemSettings(ctx context.Context) (*model.SystemSettings, error) {
	settings, err := s.settingsRepo.GetSystemSettings(ctx)
	if err != nil {
		return nil, err
	}

	// Always overlay real DB ad campaigns onto dashboard_ads for backward compatibility
	if campaigns, cErr := s.repo.ListAdCampaigns(ctx, "dashboard_banner"); cErr == nil && len(campaigns) > 0 {
		var dashAds []model.DashboardAd
		for _, c := range campaigns {
			dashAds = append(dashAds, model.DashboardAd{
				ID:        c.ID,
				Slot:      c.Slot,
				Title:     c.Title,
				AltText:   c.AltText,
				ImageURL:  c.ImageURL,
				TargetURL: c.TargetURL,
				Target:    c.TargetURL,
				IsActive:  c.IsActive,
				Priority:  c.Priority,
				StartDate: c.StartDate,
				EndDate:   c.EndDate,
			})
		}
		settings.DashboardAds = dashAds
	}

	return settings, nil
}

func (s *OwnerService) UpdateSystemSettings(ctx context.Context, settings *model.SystemSettings, ownerID int64, ip, ua string) error {
	oldSettings, _ := s.settingsRepo.GetSystemSettings(ctx)

	// Sacred Rule 8: Preserve existing ads if none passed
	if len(settings.DashboardAds) == 0 && oldSettings != nil && len(oldSettings.DashboardAds) > 0 {
		settings.DashboardAds = oldSettings.DashboardAds
	}

	err := s.settingsRepo.UpdateSystemSettings(ctx, settings)
	if err != nil {
		return err
	}

	payload := map[string]interface{}{
		"old": oldSettings,
		"new": settings,
	}
	payloadBytes, _ := json.Marshal(payload)
	_ = s.repo.LogOwnerAudit(ctx, &model.OwnerAuditLog{
		OwnerID:   ownerID,
		Action:    "update_system_settings",
		Payload:   payloadBytes,
		IPAddress: ip,
		UserAgent: ua,
	})

	return nil
}

// ─── System Health & Metrics ────────────────────────────────────────────────
func (s *OwnerService) LogSystemError(ctx context.Context, source, message string) error {
	return s.repo.LogSystemError(ctx, source, message)
}

func (s *OwnerService) GetSystemErrors(ctx context.Context, limit int) ([]model.SystemErrorLog, error) {
	return s.repo.GetSystemErrors(ctx, limit)
}

func (s *OwnerService) GetSystemHealthMetrics(ctx context.Context) (model.SystemHealthMetrics, error) {
	var metrics model.SystemHealthMetrics

	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	metrics.AllocatedMB = m.Alloc / 1024 / 1024
	metrics.TotalSysMB = m.Sys / 1024 / 1024
	metrics.MemoryUsedMB = metrics.AllocatedMB
	metrics.Goroutines = runtime.NumGoroutine()
	metrics.ActiveGoroutines = metrics.Goroutines
	metrics.UptimeSeconds = int64(time.Since(serverStartTime).Seconds())
	metrics.CPUUsagePercent = math.Min(100.0, float64(metrics.ActiveGoroutines)*0.8)

	// DB Ping & Latency
	dbStart := time.Now()
	if err := s.repo.DB().Pool.Ping(ctx); err != nil {
		metrics.DBStatus = "down"
		metrics.DBLatencyMS = 0
	} else {
		metrics.DBStatus = "ok"
		lat := time.Since(dbStart).Milliseconds()
		if lat <= 0 {
			lat = 1
		}
		metrics.DBLatencyMS = lat
	}

	// Redis Ping
	if s.cache != nil && s.cache.Client != nil {
		if err := s.cache.Client.Ping(ctx).Err(); err != nil {
			metrics.RedisStatus = "down"
		} else {
			metrics.RedisStatus = "ok"
		}
	} else {
		metrics.RedisStatus = "down"
	}

	if errs, err := s.repo.GetSystemErrors(ctx, 100); err == nil {
		metrics.RecentErrorsCount = len(errs)
	}

	return metrics, nil
}

// ─── Combos & Promos & Quests ───────────────────────────────────────────────
func (s *OwnerService) AdminListCombos(ctx context.Context) ([]repository.DailyCombo, error) {
	return s.repo.DB().AdminListCombos(ctx)
}

func (s *OwnerService) AdminCreateCombo(ctx context.Context, dateStr string, word string, reward int64) error {
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return fmt.Errorf("invalid date format: %v", err)
	}
	return s.repo.DB().AdminUpsertCombo(ctx, date, word, reward)
}

func (s *OwnerService) CreatePromoCode(ctx context.Context, ownerID int64, code string, amount float64, maxUses int, expiresAt *time.Time, ip string, ua string) error {
	code = strings.ToUpper(code)
	if !promoCodeRe.MatchString(code) {
		return errors.New("code must be 4-20 alphanumeric characters")
	}
	if math.IsNaN(amount) || math.IsInf(amount, 0) || amount <= 0 || amount > 100000 {
		return errors.New("reward_amount must be valid and between 0 and 100000")
	}
	if maxUses <= 0 || maxUses > 1000000 {
		return errors.New("max_uses must be between 0 and 1000000")
	}

	p := model.PromoCode{
		Code:         code,
		RewardAmount: amount,
		MaxUses:      maxUses,
		ExpiresAt:    expiresAt,
	}

	tx, err := s.repo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := s.repo.CreatePromoCodeTx(ctx, tx, p); err != nil {
		return err
	}

	payload, _ := json.Marshal(p)
	auditLog := &model.OwnerAuditLog{
		OwnerID:   ownerID,
		Action:    "create_promo",
		Payload:   payload,
		IPAddress: ip,
		UserAgent: ua,
	}
	if err := s.repo.LogOwnerAuditTx(ctx, tx, auditLog); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *OwnerService) DeletePromoCode(ctx context.Context, ownerID int64, code string, ip string, ua string) error {
	code = strings.ToUpper(code)
	tx, err := s.repo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := s.repo.DeletePromoCodeTx(ctx, tx, code); err != nil {
		return err
	}

	payload, _ := json.Marshal(map[string]string{"code": code})
	auditLog := &model.OwnerAuditLog{
		OwnerID:   ownerID,
		Action:    "delete_promo",
		Payload:   payload,
		IPAddress: ip,
		UserAgent: ua,
	}
	if err := s.repo.LogOwnerAuditTx(ctx, tx, auditLog); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *OwnerService) ListPromoCodes(ctx context.Context) ([]model.PromoCode, error) {
	return s.repo.ListPromoCodes(ctx)
}

func (s *OwnerService) RedeemPromoCode(ctx context.Context, userID int64, code string) error {
	code = strings.ToUpper(code)
	if err := s.repo.RedeemPromoCodeTx(ctx, code, userID); err != nil {
		return err
	}
	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}
	return nil
}

func (s *OwnerService) ListAllQuests(ctx context.Context) ([]model.Quest, error) {
	return s.repo.GetQuests(ctx)
}

func (s *OwnerService) CreateQuest(ctx context.Context, ownerID int64, q model.Quest, ip string, ua string) error {
	if q.Key == "" || q.Title == "" || q.Type == "" {
		return errors.New("quest key, title, and type are required")
	}
	if q.RewardFrg < 0 || q.RewardXp < 0 {
		return errors.New("rewards cannot be negative")
	}

	tx, err := s.repo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	existing, err := s.repo.GetQuestByKey(ctx, q.Key)
	if err != nil {
		return err
	}
	if existing != nil {
		return fmt.Errorf("quest with key %s already exists", q.Key)
	}

	if err := s.repo.CreateQuestTx(ctx, tx, q); err != nil {
		return err
	}

	payload, _ := json.Marshal(q)
	auditLog := &model.OwnerAuditLog{
		OwnerID:   ownerID,
		Action:    "create_quest",
		Payload:   payload,
		IPAddress: ip,
		UserAgent: ua,
	}
	if err := s.repo.LogOwnerAuditTx(ctx, tx, auditLog); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *OwnerService) UpdateQuest(ctx context.Context, ownerID int64, q model.Quest, ip string, ua string) error {
	if q.Key == "" || q.Title == "" || q.Type == "" {
		return errors.New("quest key, title, and type are required")
	}

	tx, err := s.repo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	existing, err := s.repo.GetQuestByKey(ctx, q.Key)
	if err != nil {
		return err
	}
	if existing == nil {
		return fmt.Errorf("quest with key %s not found", q.Key)
	}

	if err := s.repo.UpdateQuestTx(ctx, tx, q); err != nil {
		return err
	}

	payload, _ := json.Marshal(q)
	auditLog := &model.OwnerAuditLog{
		OwnerID:   ownerID,
		Action:    "update_quest",
		Payload:   payload,
		IPAddress: ip,
		UserAgent: ua,
	}
	if err := s.repo.LogOwnerAuditTx(ctx, tx, auditLog); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *OwnerService) DeleteQuest(ctx context.Context, ownerID int64, key string, ip string, ua string) error {
	tx, err := s.repo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	existing, err := s.repo.GetQuestByKey(ctx, key)
	if err != nil {
		return err
	}
	if existing == nil {
		return fmt.Errorf("quest with key %s not found", key)
	}

	if err := s.repo.DeleteQuestTx(ctx, tx, key); err != nil {
		return err
	}

	payload, _ := json.Marshal(map[string]string{"key": key})
	auditLog := &model.OwnerAuditLog{
		OwnerID:   ownerID,
		Action:    "delete_quest",
		Payload:   payload,
		IPAddress: ip,
		UserAgent: ua,
	}
	if err := s.repo.LogOwnerAuditTx(ctx, tx, auditLog); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// ─── Health & Telemetry ─────────────────────────────────────────────────────

func (s *OwnerService) PingDB(ctx context.Context) error {
	if s.repo == nil || s.repo.DB() == nil || s.repo.DB().Pool == nil {
		return fmt.Errorf("db pool is nil")
	}
	return s.repo.DB().Pool.Ping(ctx)
}

func (s *OwnerService) PingCache(ctx context.Context) error {
	if s.cache == nil || s.cache.Client == nil {
		return fmt.Errorf("redis cache client is nil")
	}
	return s.cache.Client.Ping(ctx).Err()
}

func (s *OwnerService) GetHealthMetrics(ctx context.Context, dbStatus string, dbLatencyMs int64, redisStatus string) map[string]interface{} {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	goroutines := runtime.NumGoroutine()
	memUsedMB := float64(m.Alloc) / 1024 / 1024
	totalSysMB := float64(m.Sys) / 1024 / 1024

	// Count recent DLQ errors
	recentErrorsCount := int64(0)
	if s.cache != nil && s.cache.Client != nil {
		if webhookLen, err := s.cache.Client.XLen(ctx, "webhook:dlq").Result(); err == nil {
			recentErrorsCount += webhookLen
		}
		if paymentLen, err := s.cache.Client.XLen(ctx, "payment:dlq").Result(); err == nil {
			recentErrorsCount += paymentLen
		}
	}

	return map[string]interface{}{
		"db_status":           dbStatus,
		"db_latency_ms":       dbLatencyMs,
		"redis_status":        redisStatus,
		"active_goroutines":   goroutines,
		"memory_used_mb":      memUsedMB,
		"allocated_mb":        memUsedMB,
		"total_sys_mb":        totalSysMB,
		"uptime_seconds":      time.Since(serverStartTime).Seconds(),
		"recent_errors_count": recentErrorsCount,
	}
}

func (s *OwnerService) GetSystemErrorsDLQ(ctx context.Context, limit int) ([]map[string]interface{}, error) {
	var result []map[string]interface{}
	if s.cache != nil && s.cache.Client != nil {
		// Read last entries from payment:dlq and webhook:dlq
		streams := []string{"payment:dlq", "webhook:dlq"}
		for _, stream := range streams {
			entries, err := s.cache.Client.XRevRangeN(ctx, stream, "+", "-", int64(limit)).Result()
			if err == nil {
				for _, entry := range entries {
					item := map[string]interface{}{
						"id":         entry.ID,
						"source":     stream,
						"created_at": entry.Values["timestamp"],
						"level":      "error",
					}
					if errVal, ok := entry.Values["error"]; ok {
						item["error_message"] = fmt.Sprintf("%v", errVal)
					}
					if reasonVal, ok := entry.Values["reason"]; ok {
						item["reason"] = fmt.Sprintf("%v", reasonVal)
					}
					result = append(result, item)
				}
			}
		}
	}
	return result, nil
}
