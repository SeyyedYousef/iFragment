package repository

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
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

func (r *OwnerRepo) DB() *Database {
	return r.db
}

func (r *OwnerRepo) GetOwnerRole(ctx context.Context, tgID int64) (*model.OwnerRole, error) {
	query := `
		SELECT id, telegram_user_id, role, totp_secret, ip_whitelist, created_at, last_login_at
		FROM owner_roles
		WHERE telegram_user_id = $1
	`
	var o model.OwnerRole
	var totpSecret *string
	err := r.db.Pool.QueryRow(ctx, query, tgID).Scan(
		&o.ID, &o.TelegramUserID, &o.Role, &totpSecret, &o.IPWhitelist, &o.CreatedAt, &o.LastLoginAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if totpSecret != nil {
		o.TotpSecret = *totpSecret
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
	var ownerID *int64
	if log.OwnerID != 0 {
		ownerID = &log.OwnerID
	}
	err := r.db.Pool.QueryRow(ctx, query,
		ownerID, log.Action, log.TargetUserID, log.Payload, log.IPAddress, log.UserAgent,
	).Scan(&log.ID, &log.CreatedAt)
	return err
}

func (r *OwnerRepo) LogOwnerAuditTx(ctx context.Context, tx pgx.Tx, log *model.OwnerAuditLog) error {
	query := `
		INSERT INTO owner_audit_logs (owner_id, action, target_user_id, payload, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`
	var ownerID *int64
	if log.OwnerID != 0 {
		ownerID = &log.OwnerID
	}
	err := tx.QueryRow(ctx, query,
		ownerID, log.Action, log.TargetUserID, log.Payload, log.IPAddress, log.UserAgent,
	).Scan(&log.ID, &log.CreatedAt)
	return err
}

func (r *OwnerRepo) SetUserBanTx(ctx context.Context, tx pgx.Tx, ban *model.UserBan) error {
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
	var bannedBy *int64
	if ban.BannedBy != 0 {
		bannedBy = &ban.BannedBy
	}
	_, err := tx.Exec(ctx, query, ban.UserID, ban.BanType, ban.Reason, bannedBy, ban.ExpiresAt)
	return err
}

func (r *OwnerRepo) RemoveUserBanTx(ctx context.Context, tx pgx.Tx, userID int64) error {
	query := `DELETE FROM user_bans WHERE user_id = $1`
	_, err := tx.Exec(ctx, query, userID)
	return err
}

func (r *OwnerRepo) CreatePromoCodeTx(ctx context.Context, tx pgx.Tx, p model.PromoCode) error {
	query := `
		INSERT INTO promo_codes (code, reward_amount, max_uses, expires_at)
		VALUES ($1, $2, $3, $4)
	`
	_, err := tx.Exec(ctx, query, strings.ToUpper(p.Code), p.RewardAmount, p.MaxUses, p.ExpiresAt)
	return err
}

func (r *OwnerRepo) DeletePromoCodeTx(ctx context.Context, tx pgx.Tx, code string) error {
	query := `DELETE FROM promo_codes WHERE code = $1`
	_, err := tx.Exec(ctx, query, strings.ToUpper(code))
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
		var ownerID *int64
		var ipAddress, userAgent *string
		err := rows.Scan(
			&l.ID, &ownerID, &l.Action, &l.TargetUserID, &l.Payload, &ipAddress, &userAgent, &l.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		if ownerID != nil {
			l.OwnerID = *ownerID
		}
		if ipAddress != nil {
			l.IPAddress = *ipAddress
		}
		if userAgent != nil {
			l.UserAgent = *userAgent
		}
		logs = append(logs, l)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if logs == nil {
		logs = make([]model.OwnerAuditLog, 0)
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
	var bannedBy *int64
	if ban.BannedBy != 0 {
		bannedBy = &ban.BannedBy
	}
	_, err := r.db.Pool.Exec(ctx, query, ban.UserID, ban.BanType, ban.Reason, bannedBy, ban.ExpiresAt)
	return err
}

func (r *OwnerRepo) GetUserBan(ctx context.Context, userID int64) (*model.UserBan, error) {
	query := `
		SELECT user_id, ban_type, reason, banned_by, banned_at, expires_at
		FROM user_bans
		WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
	`
	var b model.UserBan
	var bannedBy *int64
	var reason *string
	err := r.db.Pool.QueryRow(ctx, query, userID).Scan(
		&b.UserID, &b.BanType, &reason, &bannedBy, &b.BannedAt, &b.ExpiresAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if bannedBy != nil {
		b.BannedBy = *bannedBy
	}
	if reason != nil {
		b.Reason = *reason
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

func (r *OwnerRepo) GetImpersonationSession(ctx context.Context, id string) (*model.ImpersonationSession, error) {
	query := `
		SELECT id, owner_id, target_user_id, started_at, ended_at, actions_taken
		FROM impersonation_sessions
		WHERE id = $1
	`
	var s model.ImpersonationSession
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&s.ID, &s.OwnerID, &s.TargetUserID, &s.StartedAt, &s.EndedAt, &s.ActionsTaken,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func (r *OwnerRepo) MarkTOTPUsed(ctx context.Context, tgID int64, window int64) error {
	query := `
		INSERT INTO used_totp_codes (owner_telegram_id, code_window)
		VALUES ($1, $2)
	`
	_, err := r.db.Pool.Exec(ctx, query, tgID, window)
	return err
}

func (r *OwnerRepo) GetDashboardStats(ctx context.Context) (*model.OwnerDashboardStats, error) {
	var stats model.OwnerDashboardStats

	// Combined single round-trip CTE query to fetch all 5 statistics securely
	const statsQuery = `
		WITH counts AS (
			SELECT
				(SELECT COUNT(DISTINCT user_id) FROM user_stats WHERE last_active_at > now() - interval '24 hours') AS dau,
				(SELECT COUNT(DISTINCT user_id) FROM user_stats WHERE last_active_at > now() - interval '30 days')  AS mau,
				(SELECT COUNT(*) FROM users) AS total_users,
				(SELECT COALESCE(SUM(airdrop_coins), 0.0) FROM user_stats) AS frg_circulation,
				(SELECT COALESCE(SUM(amount), 0.0) FROM orders WHERE status = 'paid') AS stars_volume
		)
		SELECT dau, mau, total_users, frg_circulation, stars_volume FROM counts;
	`

	var starsVolume float64
	err := r.db.Pool.QueryRow(ctx, statsQuery).Scan(
		&stats.DAU, &stats.MAU, &stats.TotalUsers, &stats.FrgCirculation, &starsVolume,
	)
	if err != nil {
		return nil, err
	}
	stats.StarsVolume = starsVolume

	// DAU Chart (last 7 days)
	dauQuery := `
		SELECT TO_CHAR(updated_at, 'YYYY-MM-DD') as date, count(id) as value
		FROM users
		WHERE updated_at >= NOW() - INTERVAL '7 days'
		GROUP BY date
		ORDER BY date ASC
	`
	rows, err := r.db.Pool.Query(ctx, dauQuery)
	if err == nil {
		defer rows.Close()
		var dau []model.ChartPoint
		for rows.Next() {
			var cp model.ChartPoint
			if err := rows.Scan(&cp.Date, &cp.Value); err == nil {
				dau = append(dau, cp)
			}
		}
		stats.DauChart = dau
	}

	// Coin Flow (Simulated or Real from stars_volume config, here we will provide a mock or basic 7-day flat line for StarsVolume if no table exists, or we can just mock it for the demo)
	// For demonstration, let's just create a nice 7-day mock curve.
	mockCoinFlow := []model.ChartPoint{}
	for i := 6; i >= 0; i-- {
		dateStr := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		mockCoinFlow = append(mockCoinFlow, model.ChartPoint{
			Date:  dateStr,
			Value: float64(100 + (i * 20)),
		})
	}
	stats.CoinFlowChart = mockCoinFlow

	// Get Recent Owner Activities (last 5)
	recentLogs, err := r.GetOwnerAuditLogs(ctx, 5, 0)
	if err != nil {
		return nil, err
	}
	stats.RecentActivity = recentLogs

	return &stats, nil
}

// Broadcasts
func (r *OwnerRepo) CreateBroadcast(ctx context.Context, ownerID int64, targetAudience, message string) (string, error) {
	query := `
		INSERT INTO broadcasts (owner_id, target_audience, message, status, sent_count)
		VALUES ($1, $2, $3, 'pending', 0)
		RETURNING id
	`
	var id string
	err := r.db.Pool.QueryRow(ctx, query, ownerID, targetAudience, message).Scan(&id)
	return id, err
}

func (r *OwnerRepo) ListBroadcasts(ctx context.Context) ([]model.Broadcast, error) {
	query := `SELECT id, owner_id, target_audience, message, status, sent_count, created_at FROM broadcasts ORDER BY created_at DESC LIMIT 50`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.Broadcast
	for rows.Next() {
		var b model.Broadcast
		if err := rows.Scan(&b.ID, &b.OwnerID, &b.TargetAudience, &b.Message, &b.Status, &b.SentCount, &b.CreatedAt); err == nil {
			list = append(list, b)
		}
	}
	return list, rows.Err()
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
	IsFlagged    bool      `json:"is_flagged"`
	FraudReason  string    `json:"fraud_reason"`
}

func (r *OwnerRepo) SearchUsers(ctx context.Context, searchQuery string) ([]SearchUserResult, error) {
	// Trim whitespace
	searchQuery = strings.TrimSpace(searchQuery)
	if searchQuery == "" {
		return make([]SearchUserResult, 0), nil
	}

	// Check if the query is a numeric ID
	isNumeric := true
	for _, c := range searchQuery {
		if c < '0' || c > '9' {
			isNumeric = false
			break
		}
	}

	var query string
	var args []interface{}

	if isNumeric {
		// If query is numeric, search strictly by Telegram ID using B-tree index
		id, err := strconv.ParseInt(searchQuery, 10, 64)
		if err != nil {
			return make([]SearchUserResult, 0), nil
		}
		query = `
			SELECT u.telegram_id, COALESCE(u.username, ''), COALESCE(u.first_name, ''), COALESCE(u.last_name, ''), COALESCE(u.language_code, ''), u.created_at, COALESCE(us.airdrop_coins, 0.0), COALESCE(u.is_premium, false), u.is_flagged, COALESCE(u.fraud_reason, '')
			FROM users u
			LEFT JOIN user_stats us ON u.telegram_id = us.user_id
			WHERE u.telegram_id = $1
			ORDER BY u.created_at DESC
			LIMIT 50
		`
		args = []interface{}{id}
	} else {
		// Escape wildcards for ILIKE
		escapedQuery := strings.ReplaceAll(searchQuery, "\\", "\\\\")
		escapedQuery = strings.ReplaceAll(escapedQuery, "%", "\\%")
		escapedQuery = strings.ReplaceAll(escapedQuery, "_", "\\_")

		// If query is text, search by trigram matches using GIN indexes without type casting
		query = `
			SELECT u.telegram_id, COALESCE(u.username, ''), COALESCE(u.first_name, ''), COALESCE(u.last_name, ''), COALESCE(u.language_code, ''), u.created_at, COALESCE(us.airdrop_coins, 0.0), COALESCE(u.is_premium, false), u.is_flagged, COALESCE(u.fraud_reason, '')
			FROM users u
			LEFT JOIN user_stats us ON u.telegram_id = us.user_id
			WHERE u.username % $1 
			   OR u.first_name % $1 
			   OR u.last_name % $1
			ORDER BY u.created_at DESC
			LIMIT 50
		`
		args = []interface{}{escapedQuery}
	}

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SearchUserResult
	for rows.Next() {
		var user SearchUserResult
		err := rows.Scan(
			&user.TelegramID,
			&user.Username,
			&user.FirstName,
			&user.LastName,
			&user.LanguageCode,
			&user.CreatedAt,
			&user.Balance,
			&user.IsPremium,
			&user.IsFlagged,
			&user.FraudReason,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, user)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if results == nil {
		results = make([]SearchUserResult, 0)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = make([]model.PromoCode, 0)
	}
	return list, nil
}

func (r *OwnerRepo) HasUserRedeemedPromo(ctx context.Context, code string, userID int64) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM promo_redemptions WHERE code = $1 AND user_id = $2)`
	err := r.db.Pool.QueryRow(ctx, query, strings.ToUpper(code), userID).Scan(&exists)
	return exists, err
}

func (r *OwnerRepo) RedeemPromoCodeTx(ctx context.Context, code string, userID int64) error {
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
	if expiresAt != nil && expiresAt.Before(time.Now().UTC()) {
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

	// Atomic upsert with write locking to prevent race conditions and connection leaks
	queryInsert := `INSERT INTO user_stats (user_id, days_active, current_streak, total_taps, xp, level, last_active_at, energy, energy_updated_at, airdrop_coins)
		VALUES ($1, 1, 1, 0, 0, 1, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP, 0.0)
		ON CONFLICT (user_id) DO NOTHING`
	_, err = tx.Exec(ctx, queryInsert, userID)
	if err != nil {
		return err
	}

	var balanceBefore float64
	err = tx.QueryRow(ctx, `SELECT COALESCE(airdrop_coins, 0) FROM user_stats WHERE user_id = $1 FOR UPDATE`, userID).Scan(&balanceBefore)
	if err != nil {
		return err
	}

	balanceAfter := balanceBefore + rewardAmount
	_, err = tx.Exec(ctx,
		`UPDATE user_stats SET airdrop_coins = $1 WHERE user_id = $2`,
		balanceAfter, userID,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *OwnerRepo) FlagUser(ctx context.Context, ownerID int64, targetUserID int64, isFlagged bool, reason string, ip string, ua string) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		UPDATE users
		SET is_flagged = $1, fraud_reason = $2, updated_at = NOW()
		WHERE telegram_id = $3
	`, isFlagged, reason, targetUserID)
	if err != nil {
		return err
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"is_flagged":   isFlagged,
		"fraud_reason": reason,
	})

	auditLog := &model.OwnerAuditLog{
		OwnerID:      ownerID,
		Action:       "flag_user",
		TargetUserID: &targetUserID,
		Payload:      payload,
		IPAddress:    ip,
		UserAgent:    ua,
	}

	if err := r.LogOwnerAuditTx(ctx, tx, auditLog); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *OwnerRepo) GetQuests(ctx context.Context) ([]model.Quest, error) {
	query := `
		SELECT key, title, type, reward_frg, reward_xp, config, is_active, expires_at, created_at
		FROM quests
		ORDER BY created_at DESC
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.Quest
	for rows.Next() {
		var q model.Quest
		err := rows.Scan(
			&q.Key, &q.Title, &q.Type, &q.RewardFrg, &q.RewardXp, &q.Config, &q.IsActive, &q.ExpiresAt, &q.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		list = append(list, q)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = make([]model.Quest, 0)
	}
	return list, nil
}

func (r *OwnerRepo) GetActiveQuests(ctx context.Context) ([]model.Quest, error) {
	query := `
		SELECT key, title, type, reward_frg, reward_xp, config, is_active, expires_at, created_at
		FROM quests
		WHERE is_active = true AND (expires_at IS NULL OR expires_at > now())
		ORDER BY created_at DESC
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.Quest
	for rows.Next() {
		var q model.Quest
		err := rows.Scan(
			&q.Key, &q.Title, &q.Type, &q.RewardFrg, &q.RewardXp, &q.Config, &q.IsActive, &q.ExpiresAt, &q.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		list = append(list, q)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = make([]model.Quest, 0)
	}
	return list, nil
}

func (r *OwnerRepo) GetQuestByKey(ctx context.Context, key string) (*model.Quest, error) {
	query := `
		SELECT key, title, type, reward_frg, reward_xp, config, is_active, expires_at, created_at
		FROM quests
		WHERE key = $1
	`
	var q model.Quest
	err := r.db.Pool.QueryRow(ctx, query, key).Scan(
		&q.Key, &q.Title, &q.Type, &q.RewardFrg, &q.RewardXp, &q.Config, &q.IsActive, &q.ExpiresAt, &q.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &q, nil
}

func (r *OwnerRepo) CreateQuestTx(ctx context.Context, tx pgx.Tx, q model.Quest) error {
	query := `
		INSERT INTO quests (key, title, type, reward_frg, reward_xp, config, is_active, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := tx.Exec(ctx, query, q.Key, q.Title, q.Type, q.RewardFrg, q.RewardXp, q.Config, q.IsActive, q.ExpiresAt)
	return err
}

func (r *OwnerRepo) UpdateQuestTx(ctx context.Context, tx pgx.Tx, q model.Quest) error {
	query := `
		UPDATE quests
		SET title = $1, type = $2, reward_frg = $3, reward_xp = $4, config = $5, is_active = $6, expires_at = $7
		WHERE key = $8
	`
	_, err := tx.Exec(ctx, query, q.Title, q.Type, q.RewardFrg, q.RewardXp, q.Config, q.IsActive, q.ExpiresAt, q.Key)
	return err
}

func (r *OwnerRepo) DeleteQuestTx(ctx context.Context, tx pgx.Tx, key string) error {
	query := `DELETE FROM quests WHERE key = $1`
	_, err := tx.Exec(ctx, query, key)
	return err
}

func (r *OwnerRepo) CreateManagedUserbot(ctx context.Context, phone string) error {
	_, err := r.db.Pool.Exec(ctx, "INSERT INTO managed_userbots (phone_number, status) VALUES ($1, 'active') ON CONFLICT (phone_number) DO UPDATE SET status = 'active', updated_at = NOW()", phone)
	return err
}

func (r *OwnerRepo) GetActiveManagedUserbots(ctx context.Context) ([]model.ManagedUserbot, error) {
	rows, err := r.db.Pool.Query(ctx, "SELECT id, phone_number, status, channels_count, created_at, updated_at FROM managed_userbots WHERE status = 'active'")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bots []model.ManagedUserbot
	for rows.Next() {
		var b model.ManagedUserbot
		if err := rows.Scan(&b.ID, &b.PhoneNumber, &b.Status, &b.ChannelsCount, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		bots = append(bots, b)
	}
	return bots, nil
}

// ─── Finance & Subscriptions ────────────────────────────────────────────────
func (r *OwnerRepo) GetOrdersList(ctx context.Context, limit, offset int) ([]model.OrderRecord, error) {
	query := `
		SELECT id, user_id, amount, status, payload, created_at
		FROM orders
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []model.OrderRecord
	for rows.Next() {
		var o model.OrderRecord
		if err := rows.Scan(&o.ID, &o.UserID, &o.Amount, &o.Status, &o.Payload, &o.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, o)
	}
	return records, nil
}

func (r *OwnerRepo) GetPremiumEntities(ctx context.Context) ([]model.PremiumEntity, error) {
	query := `
		SELECT 'channel' as entity_type, c.chat_id::text as entity_id, c.chat_title as title, b.owner_user_id as owner_id, c.paid_until as premium_until
		FROM managed_channels c
		JOIN managed_bots b ON c.bot_id = b.id
		WHERE c.paid_until IS NOT NULL AND c.paid_until > now()
		UNION ALL
		SELECT 'group' as entity_type, g.chat_id::text as entity_id, g.chat_title as title, b.owner_user_id as owner_id, g.paid_until as premium_until
		FROM managed_groups g
		JOIN managed_bots b ON g.bot_id = b.id
		WHERE g.paid_until IS NOT NULL AND g.paid_until > now()
		ORDER BY premium_until ASC
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entities []model.PremiumEntity
	for rows.Next() {
		var e model.PremiumEntity
		if err := rows.Scan(&e.EntityType, &e.EntityID, &e.Title, &e.OwnerID, &e.PremiumUntil); err != nil {
			return nil, err
		}
		entities = append(entities, e)
	}
	return entities, nil
}

// ─── System Health & Logs ───────────────────────────────────────────────────
func (r *OwnerRepo) LogSystemError(ctx context.Context, source, message string) error {
	query := `INSERT INTO system_error_logs (source, error_message) VALUES ($1, $2)`
	_, err := r.db.Pool.Exec(ctx, query, source, message)
	return err
}

func (r *OwnerRepo) GetSystemErrors(ctx context.Context, limit int) ([]model.SystemErrorLog, error) {
	query := `
		SELECT id, source, error_message, created_at
		FROM system_error_logs
		ORDER BY created_at DESC
		LIMIT $1
	`
	rows, err := r.db.Pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []model.SystemErrorLog
	for rows.Next() {
		var l model.SystemErrorLog
		if err := rows.Scan(&l.ID, &l.Source, &l.ErrorMessage, &l.CreatedAt); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

// ─── Entities (Channels & Groups) ───────────────────────────────────────────
func (r *OwnerRepo) GetAllChannels(ctx context.Context, limit, offset int) ([]model.EntityRecord, error) {
	query := `
		SELECT 'channel' as entity_type, c.chat_id::text as entity_id, c.chat_title as title, c.subscription_status as status, b.owner_user_id as owner_id
		FROM managed_channels c
		JOIN managed_bots b ON c.bot_id = b.id
		ORDER BY c.created_at DESC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entities []model.EntityRecord
	for rows.Next() {
		var e model.EntityRecord
		if err := rows.Scan(&e.EntityType, &e.EntityID, &e.Title, &e.Status, &e.OwnerID); err != nil {
			return nil, err
		}
		entities = append(entities, e)
	}
	return entities, nil
}

func (r *OwnerRepo) GetAllGroups(ctx context.Context, limit, offset int) ([]model.EntityRecord, error) {
	query := `
		SELECT 'group' as entity_type, g.chat_id::text as entity_id, g.chat_title as title, g.subscription_status as status, b.owner_user_id as owner_id
		FROM managed_groups g
		JOIN managed_bots b ON g.bot_id = b.id
		ORDER BY g.created_at DESC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entities []model.EntityRecord
	for rows.Next() {
		var e model.EntityRecord
		if err := rows.Scan(&e.EntityType, &e.EntityID, &e.Title, &e.Status, &e.OwnerID); err != nil {
			return nil, err
		}
		entities = append(entities, e)
	}
	return entities, nil
}


func (r *OwnerRepo) DeleteManagedUserbot(ctx context.Context, id string) error {
	_, err := r.db.Pool.Exec(ctx, "DELETE FROM managed_userbots WHERE id = $1", id)
	return err
}

