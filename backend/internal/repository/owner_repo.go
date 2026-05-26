package repository

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"ifragment-backend/internal/model"

	"github.com/jackc/pgx/v5"
)

type OwnerRepo struct {
	db *Database
}

func NewOwnerRepo(db *Database) *OwnerRepo {
	return &OwnerRepo{db: db}
}

func (r *OwnerRepo) GetOwnerRole(ctx context.Context, tgID int64) (*model.OwnerRole, error) {
	query := `
		SELECT id, telegram_user_id, role, totp_secret, ip_whitelist, created_at, last_login_at
		FROM owner_roles
		WHERE telegram_user_id = $1
	`
	var o model.OwnerRole
	err := r.db.Pool.QueryRow(ctx, query, tgID).Scan(
		&o.ID, &o.TelegramUserID, &o.Role, &o.TotpSecret, &o.IPWhitelist, &o.CreatedAt, &o.LastLoginAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &o, nil
}

func (r *OwnerRepo) UpsertOwnerRole(ctx context.Context, o *model.OwnerRole) error {
	query := `
		INSERT INTO owner_roles (telegram_user_id, role, totp_secret, ip_whitelist, last_login_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (telegram_user_id) DO UPDATE SET
			role = EXCLUDED.role,
			totp_secret = EXCLUDED.totp_secret,
			ip_whitelist = EXCLUDED.ip_whitelist,
			last_login_at = EXCLUDED.last_login_at
	`
	_, err := r.db.Pool.Exec(ctx, query, o.TelegramUserID, o.Role, o.TotpSecret, o.IPWhitelist, o.LastLoginAt)
	return err
}

func (r *OwnerRepo) LogOwnerAudit(ctx context.Context, log *model.OwnerAuditLog) error {
	query := `
		INSERT INTO owner_audit_logs (owner_id, action, target_user_id, payload, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`
	err := r.db.Pool.QueryRow(ctx, query,
		log.OwnerID, log.Action, log.TargetUserID, log.Payload, log.IPAddress, log.UserAgent,
	).Scan(&log.ID, &log.CreatedAt)
	return err
}

func (r *OwnerRepo) GetOwnerAuditLogs(ctx context.Context, limit, offset int) ([]model.OwnerAuditLog, error) {
	query := `
		SELECT id, owner_id, action, target_user_id, payload, ip_address, user_agent, created_at
		FROM owner_audit_logs
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []model.OwnerAuditLog
	for rows.Next() {
		var l model.OwnerAuditLog
		err := rows.Scan(
			&l.ID, &l.OwnerID, &l.Action, &l.TargetUserID, &l.Payload, &l.IPAddress, &l.UserAgent, &l.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

func (r *OwnerRepo) SetUserBan(ctx context.Context, ban *model.UserBan) error {
	query := `
		INSERT INTO user_bans (user_id, ban_type, reason, banned_by, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id) DO UPDATE SET
			ban_type = EXCLUDED.ban_type,
			reason = EXCLUDED.reason,
			banned_by = EXCLUDED.banned_by,
			banned_at = CURRENT_TIMESTAMP,
			expires_at = EXCLUDED.expires_at
	`
	_, err := r.db.Pool.Exec(ctx, query, ban.UserID, ban.BanType, ban.Reason, ban.BannedBy, ban.ExpiresAt)
	return err
}

func (r *OwnerRepo) GetUserBan(ctx context.Context, userID int64) (*model.UserBan, error) {
	query := `
		SELECT user_id, ban_type, reason, banned_by, banned_at, expires_at
		FROM user_bans
		WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
	`
	var b model.UserBan
	err := r.db.Pool.QueryRow(ctx, query, userID).Scan(
		&b.UserID, &b.BanType, &b.Reason, &b.BannedBy, &b.BannedAt, &b.ExpiresAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &b, nil
}

func (r *OwnerRepo) RemoveUserBan(ctx context.Context, userID int64) error {
	query := `DELETE FROM user_bans WHERE user_id = $1`
	_, err := r.db.Pool.Exec(ctx, query, userID)
	return err
}

func (r *OwnerRepo) CreateImpersonationSession(ctx context.Context, sess *model.ImpersonationSession) error {
	query := `
		INSERT INTO impersonation_sessions (id, owner_id, target_user_id, started_at)
		VALUES ($1, $2, $3, $4)
	`
	_, err := r.db.Pool.Exec(ctx, query, sess.ID, sess.OwnerID, sess.TargetUserID, sess.StartedAt)
	return err
}

func (r *OwnerRepo) EndImpersonationSession(ctx context.Context, id string, actions []string) error {
	actionsJSON, _ := json.Marshal(actions)
	query := `
		UPDATE impersonation_sessions
		SET ended_at = CURRENT_TIMESTAMP, actions_taken = $1
		WHERE id = $2
	`
	_, err := r.db.Pool.Exec(ctx, query, actionsJSON, id)
	return err
}

func (r *OwnerRepo) GetDashboardStats(ctx context.Context) (*model.OwnerDashboardStats, error) {
	var stats model.OwnerDashboardStats

	// 1. Get DAU (Users active in last 24h)
	err := r.db.Pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT user_id) FROM user_stats WHERE last_active_at > now() - interval '24 hours'
	`).Scan(&stats.DAU)
	if err != nil {
		stats.DAU = 0
	}

	// 2. Get MAU (Users active in last 30d)
	err = r.db.Pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT user_id) FROM user_stats WHERE last_active_at > now() - interval '30 days'
	`).Scan(&stats.MAU)
	if err != nil {
		stats.MAU = 0
	}

	// 3. Get Total Users
	err = r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&stats.TotalUsers)
	if err != nil {
		stats.TotalUsers = 0
	}

	// 4. Get FRG Circulation (Sum of balances)
	err = r.db.Pool.QueryRow(ctx, `SELECT COALESCE(SUM(balance), 0.0) FROM frg_balances`).Scan(&stats.FrgCirculation)
	if err != nil {
		stats.FrgCirculation = 0
	}

	// 5. Get TON Volume (Order sum for completed payments in stars to ton approximate or TON coin transactions)
	// We'll calculate a mock/aggregate TON volume from stars purchases (approx 1 TON = 100 Stars)
	var starsVolume float64
	err = r.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount), 0.0) FROM orders WHERE status = 'paid'
	`).Scan(&starsVolume)
	if err != nil {
		starsVolume = 0
	}
	stats.TonVolume = starsVolume / 100.0 // Approximate conversion for demonstration

	// 6. Get Recent Owner Activities (last 5)
	recentLogs, err := r.GetOwnerAuditLogs(ctx, 5, 0)
	if err == nil {
		stats.RecentActivity = recentLogs
	} else {
		stats.RecentActivity = []model.OwnerAuditLog{}
	}

	return &stats, nil
}

type SearchUserResult struct {
	TelegramID   int64     `json:"telegram_id"`
	Username     string    `json:"username"`
	FirstName    string    `json:"first_name"`
	LastName     string    `json:"last_name"`
	LanguageCode string    `json:"language_code"`
	CreatedAt    time.Time `json:"created_at"`
	Balance      float64   `json:"balance"`
	IsPremium    bool      `json:"is_premium"`
}

func (r *OwnerRepo) SearchUsers(ctx context.Context, searchQuery string) ([]SearchUserResult, error) {
	query := `
		SELECT u.telegram_id, COALESCE(u.username, ''), COALESCE(u.first_name, ''), COALESCE(u.last_name, ''), COALESCE(u.language_code, ''), u.created_at, COALESCE(fb.balance, 0.0), u.is_premium
		FROM users u
		LEFT JOIN frg_balances fb ON u.telegram_id = fb.user_id
		WHERE u.username ILIKE '%' || $1 || '%'
		   OR u.first_name ILIKE '%' || $1 || '%'
		   OR u.last_name ILIKE '%' || $1 || '%'
		   OR u.telegram_id::text = $1
		ORDER BY u.created_at DESC
		LIMIT 50
	`
	rows, err := r.db.Pool.Query(ctx, query, searchQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SearchUserResult
	for rows.Next() {
		var s SearchUserResult
		err := rows.Scan(&s.TelegramID, &s.Username, &s.FirstName, &s.LastName, &s.LanguageCode, &s.CreatedAt, &s.Balance, &s.IsPremium)
		if err != nil {
			return nil, err
		}
		results = append(results, s)
	}
	return results, nil
}

func (r *OwnerRepo) CreatePromoCode(ctx context.Context, p model.PromoCode) error {
	query := `
		INSERT INTO promo_codes (code, reward_amount, max_uses, expires_at)
		VALUES ($1, $2, $3, $4)
	`
	_, err := r.db.Pool.Exec(ctx, query, strings.ToUpper(p.Code), p.RewardAmount, p.MaxUses, p.ExpiresAt)
	return err
}

func (r *OwnerRepo) GetPromoCode(ctx context.Context, code string) (*model.PromoCode, error) {
	query := `
		SELECT code, reward_amount, max_uses, uses_count, expires_at, created_at
		FROM promo_codes
		WHERE code = $1
	`
	var p model.PromoCode
	err := r.db.Pool.QueryRow(ctx, query, strings.ToUpper(code)).Scan(
		&p.Code, &p.RewardAmount, &p.MaxUses, &p.UsesCount, &p.ExpiresAt, &p.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *OwnerRepo) DeletePromoCode(ctx context.Context, code string) error {
	query := `DELETE FROM promo_codes WHERE code = $1`
	_, err := r.db.Pool.Exec(ctx, query, strings.ToUpper(code))
	return err
}

func (r *OwnerRepo) ListPromoCodes(ctx context.Context) ([]model.PromoCode, error) {
	query := `
		SELECT code, reward_amount, max_uses, uses_count, expires_at, created_at
		FROM promo_codes
		ORDER BY created_at DESC
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.PromoCode
	for rows.Next() {
		var p model.PromoCode
		err := rows.Scan(&p.Code, &p.RewardAmount, &p.MaxUses, &p.UsesCount, &p.ExpiresAt, &p.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, nil
}

func (r *OwnerRepo) HasUserRedeemedPromo(ctx context.Context, code string, userID int64) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM promo_redemptions WHERE code = $1 AND user_id = $2)`
	err := r.db.Pool.QueryRow(ctx, query, strings.ToUpper(code), userID).Scan(&exists)
	return exists, err
}

func (r *OwnerRepo) RedeemPromoCodeTx(ctx context.Context, code string, userID int64, frgRepo *FRGRepo) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	codeUpper := strings.ToUpper(code)

	// Lock the promo code row
	var rewardAmount float64
	var maxUses, usesCount int
	var expiresAt *time.Time
	err = tx.QueryRow(ctx, `
		SELECT reward_amount, max_uses, uses_count, expires_at
		FROM promo_codes
		WHERE code = $1 FOR UPDATE
	`, codeUpper).Scan(&rewardAmount, &maxUses, &usesCount, &expiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("promo code does not exist")
		}
		return err
	}

	// Validation
	if expiresAt != nil && expiresAt.Before(time.Now()) {
		return errors.New("promo code has expired")
	}

	if usesCount >= maxUses {
		return errors.New("promo code has reached its maximum usage limit")
	}

	// Check if user has already redeemed it
	var alreadyRedeemed bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM promo_redemptions WHERE code = $1 AND user_id = $2)
	`, codeUpper, userID).Scan(&alreadyRedeemed)
	if err != nil {
		return err
	}
	if alreadyRedeemed {
		return errors.New("you have already redeemed this promo code")
	}

	// Increment usage count
	_, err = tx.Exec(ctx, `UPDATE promo_codes SET uses_count = uses_count + 1 WHERE code = $1`, codeUpper)
	if err != nil {
		return err
	}

	// Insert redemption record
	_, err = tx.Exec(ctx, `
		INSERT INTO promo_redemptions (code, user_id)
		VALUES ($1, $2)
	`, codeUpper, userID)
	if err != nil {
		return err
	}

	// Credit the user with FRG
	var balanceBefore float64
	err = tx.QueryRow(ctx,
		`SELECT balance FROM frg_balances WHERE user_id = $1 FOR UPDATE`, userID,
	).Scan(&balanceBefore)
	if err == pgx.ErrNoRows {
		// Initialize balance row
		_, initErr := tx.Exec(ctx, `INSERT INTO frg_balances (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, userID)
		if initErr != nil {
			return initErr
		}
		balanceBefore = 0
	} else if err != nil {
		return err
	}

	balanceAfter := balanceBefore + rewardAmount
	_, err = tx.Exec(ctx,
		`UPDATE frg_balances SET balance = $1, total_earned = total_earned + $2, updated_at = now() WHERE user_id = $3`,
		balanceAfter, rewardAmount, userID,
	)
	if err != nil {
		return err
	}

	meta, _ := json.Marshal(map[string]string{"promo_code": codeUpper})
	_, err = tx.Exec(ctx,
		`INSERT INTO frg_transactions (user_id, type, amount, balance_before, balance_after, metadata)
		VALUES ($1, 'promo_redemption', $2, $3, $4, $5)`,
		userID, rewardAmount, balanceBefore, balanceAfter, meta,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}


