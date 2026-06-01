package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"regexp"
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

var promoCodeRe = regexp.MustCompile(`^[A-Z0-9]{4,20}$`)

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

	// Rate limit: Max 5 failed attempts per 15 minutes per IP and per Telegram ID
	if s.cache != nil && s.cache.Client != nil {
		ipLockKey := fmt.Sprintf("owner:login:attempts:ip:%s", ip)
		userLockKey := fmt.Sprintf("owner:login:attempts:user:%d", telegramUserID)

		attemptsIP, _ := s.cache.Client.Get(ctx, ipLockKey).Int64()
		if attemptsIP >= 5 {
			return "", errors.New("too many login attempts from this IP; locked temporarily for 15 minutes")
		}

		attemptsUser, _ := s.cache.Client.Get(ctx, userLockKey).Int64()
		if attemptsUser >= 5 {
			return "", errors.New("too many login attempts for this account; locked temporarily for 15 minutes")
		}
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
		// Increment failed login counters on failure
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
		return "", errors.New("invalid TOTP code")
	}

	// 6. Prevent TOTP code replay attacks by caching the exact consumed code string in Redis for the drift duration
	if s.cache != nil && s.cache.Client != nil {
		replayKey := fmt.Sprintf("totp:used:%d:%s", telegramUserID, code)
		locked, err := s.cache.Client.SetNX(ctx, replayKey, "used", 90*time.Second).Result()
		if err != nil || !locked {
			return "", errors.New("TOTP code already used; potential replay attack blocked")
		}
		
		// Reset login failure attempts on successful authentication
		ipLockKey := fmt.Sprintf("owner:login:attempts:ip:%s", ip)
		userLockKey := fmt.Sprintf("owner:login:attempts:user:%d", telegramUserID)
		pipe := s.cache.Client.Pipeline()
		pipe.Del(ctx, ipLockKey)
		pipe.Del(ctx, userLockKey)
		_, _ = pipe.Exec(ctx)
	} else {
		// Fallback to database time-step window lock if Redis is unavailable
		window := time.Now().Unix() / 30
		if err := s.repo.MarkTOTPUsed(ctx, telegramUserID, window); err != nil {
			return "", errors.New("TOTP code already used; potential replay attack blocked")
		}
	}

	// 7. Update last login
	now := time.Now()
	o.LastLoginAt = &now
	if err := s.repo.UpsertOwnerRole(ctx, o); err != nil {
		return "", err
	}

	// 8. Generate Owner JWT Token (Valid for 15 minutes with super admin specific claims)
	claims := middleware.JWTClaims{
		UserID:      telegramUserID,
		Username:    "owner",
		Role:        o.Role,
		TokenType:   "owner",
		MFAVerified: true,
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

	// Double approval rule for adjustments > 2/3 of the role limits (bypassed for super_admin as they are the supreme owner)
	if ownerRole.Role != "super_admin" && absAmount > (2.0/3.0)*maxLimit {
		return 0, fmt.Errorf("adjustment amount %.2f exceeds role safety limit (%.2f); dual approval required", absAmount, (2.0/3.0)*maxLimit)
	}

	// Begin atomic transaction
	tx, err := s.frgRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	// Fetch current balance to compute diff in audit log
	bal, err := s.frgRepo.GetBalance(ctx, targetUserID)
	if err != nil {
		return 0, err
	}

	var frgTx *repository.FRGTransaction
	meta, _ := json.Marshal(map[string]interface{}{
		"adjusted_by": ownerID,
		"reason":      reason,
	})

	if amount >= 0 {
		frgTx, err = s.frgRepo.CreditTx(ctx, tx, targetUserID, amount, "admin_adjustment", meta)
	} else {
		frgTx, err = s.frgRepo.DebitTx(ctx, tx, targetUserID, -amount, "admin_adjustment", meta)
	}

	if err != nil {
		return 0, err
	}

	// Log Audit Event INSIDE the same transaction
	payload, _ := json.Marshal(map[string]interface{}{
		"amount":         amount,
		"reason":         reason,
		"balance_before": bal.Balance,
		"balance_after":  frgTx.BalanceAfter,
	})
	
	auditLog := &model.OwnerAuditLog{
		OwnerID:      ownerID,
		Action:       "frg_adjust",
		TargetUserID: &targetUserID,
		Payload:      payload,
		IPAddress:    ip,
		UserAgent:    ua,
	}
	if err := s.repo.LogOwnerAuditTx(ctx, tx, auditLog); err != nil {
		return 0, err
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}

	return frgTx.BalanceAfter, nil
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

	// Begin atomic transaction
	tx, err := s.frgRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := s.repo.SetUserBanTx(ctx, tx, ban); err != nil {
		return err
	}

	// Log Audit Event INSIDE the same transaction
	payload, _ := json.Marshal(map[string]interface{}{
		"ban_type":  banType,
		"reason":    reason,
		"expires":   expiresAt,
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
	// Begin atomic transaction
	tx, err := s.frgRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := s.repo.RemoveUserBanTx(ctx, tx, targetUserID); err != nil {
		return err
	}

	// Log Audit Event INSIDE the same transaction
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

func (s *OwnerService) ImpersonateUser(ctx context.Context, ownerID int64, targetUserID int64, ip string, ua string) (string, error) {
	// Block impersonating another owner/administrator of the bot
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
	// Domain bounds validation for promo code reward and usage limits (Defense-in-Depth)
	if !promoCodeRe.MatchString(strings.ToUpper(code)) {
		return errors.New("code must be 4-20 alphanumeric characters")
	}
	if amount <= 0 || amount > 100000 {
		return errors.New("reward_amount must be between 0 and 100000")
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

	// Begin atomic transaction
	tx, err := s.frgRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := s.repo.CreatePromoCodeTx(ctx, tx, p); err != nil {
		return err
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"code":          code,
		"reward_amount": amount,
		"max_uses":      maxUses,
		"expires_at":    expiresAt,
	})
	
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
	// Begin atomic transaction
	tx, err := s.frgRepo.DB().Pool.Begin(ctx)
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
	return s.repo.RedeemPromoCodeTx(ctx, code, userID, s.frgRepo)
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

	// Validate type
	validTypes := map[string]bool{
		"channel_join":         true,
		"quiz":                 true,
		"referral":             true,
		"first_username_scan": true,
		"register_first_bot":   true,
	}
	if !validTypes[q.Type] {
		return fmt.Errorf("invalid quest type: %s", q.Type)
	}

	// For quiz types, if raw answer is passed in config, let's hash it on the server
	if q.Type == "quiz" {
		var config struct {
			Answer         string `json:"answer,omitempty"`
			QuizAnswerHash string `json:"quiz_answer_hash,omitempty"`
		}
		_ = json.Unmarshal(q.Config, &config)
		if config.Answer != "" {
			cleaned := strings.ToLower(strings.TrimSpace(config.Answer))
			hash := sha256.New()
			hash.Write([]byte(cleaned))
			config.QuizAnswerHash = hex.EncodeToString(hash.Sum(nil))
			config.Answer = "" // clear raw answer for security
			q.Config, _ = json.Marshal(config)
		}
	}

	// Begin atomic transaction
	tx, err := s.frgRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Check if already exists
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
	if q.RewardFrg < 0 || q.RewardXp < 0 {
		return errors.New("rewards cannot be negative")
	}

	// Validate type
	validTypes := map[string]bool{
		"channel_join":         true,
		"quiz":                 true,
		"referral":             true,
		"first_username_scan": true,
		"register_first_bot":   true,
	}
	if !validTypes[q.Type] {
		return fmt.Errorf("invalid quest type: %s", q.Type)
	}

	// For quiz types, if raw answer is passed in config, let's hash it on the server
	if q.Type == "quiz" {
		var config struct {
			Answer         string `json:"answer,omitempty"`
			QuizAnswerHash string `json:"quiz_answer_hash,omitempty"`
		}
		_ = json.Unmarshal(q.Config, &config)
		if config.Answer != "" {
			cleaned := strings.ToLower(strings.TrimSpace(config.Answer))
			hash := sha256.New()
			hash.Write([]byte(cleaned))
			config.QuizAnswerHash = hex.EncodeToString(hash.Sum(nil))
			config.Answer = "" // clear raw answer for security
			q.Config, _ = json.Marshal(config)
		}
	}

	// Begin atomic transaction
	tx, err := s.frgRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Verify exists
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
	// Begin atomic transaction
	tx, err := s.frgRepo.DB().Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Verify exists
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



