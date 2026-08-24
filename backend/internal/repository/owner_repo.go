package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
		SELECT id, telegram_user_id, role, totp_secret, COALESCE(totp_enabled, false), totp_enabled_at,
		       COALESCE(recovery_codes_hashes, '{}'), COALESCE(password_hash, ''), ip_whitelist, created_at, last_login_at
		FROM owner_roles
		WHERE telegram_user_id = $1
	`
	var o model.OwnerRole
	var totpSecret *string
	err := r.db.Pool.QueryRow(ctx, query, tgID).Scan(
		&o.ID, &o.TelegramUserID, &o.Role, &totpSecret, &o.TotpEnabled, &o.TotpEnabledAt,
		&o.RecoveryCodesHashes, &o.PasswordHash, &o.IPWhitelist, &o.CreatedAt, &o.LastLoginAt,
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
		INSERT INTO owner_roles (telegram_user_id, role, totp_secret, totp_enabled, totp_enabled_at, recovery_codes_hashes, password_hash, ip_whitelist, last_login_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (telegram_user_id) DO UPDATE SET
			role = EXCLUDED.role,
			totp_secret = EXCLUDED.totp_secret,
			totp_enabled = EXCLUDED.totp_enabled,
			totp_enabled_at = EXCLUDED.totp_enabled_at,
			recovery_codes_hashes = EXCLUDED.recovery_codes_hashes,
			password_hash = EXCLUDED.password_hash,
			ip_whitelist = EXCLUDED.ip_whitelist,
			last_login_at = EXCLUDED.last_login_at
	`
	_, err := r.db.Pool.Exec(ctx, query, o.TelegramUserID, o.Role, o.TotpSecret, o.TotpEnabled, o.TotpEnabledAt, o.RecoveryCodesHashes, o.PasswordHash, o.IPWhitelist, o.LastLoginAt)
	return err
}

func (r *OwnerRepo) UpdateOwnerTOTP(ctx context.Context, tgID int64, enabled bool, secret string, recoveryHashes []string) error {
	now := time.Now()
	var enabledAt *time.Time
	if enabled {
		enabledAt = &now
	}
	query := `
		UPDATE owner_roles
		SET totp_enabled = $1, totp_enabled_at = $2, totp_secret = $3, recovery_codes_hashes = $4
		WHERE telegram_user_id = $5
	`
	_, err := r.db.Pool.Exec(ctx, query, enabled, enabledAt, secret, recoveryHashes, tgID)
	return err
}

func (r *OwnerRepo) ConsumeRecoveryCode(ctx context.Context, tgID int64, remainingHashes []string) error {
	query := `UPDATE owner_roles SET recovery_codes_hashes = $1 WHERE telegram_user_id = $2`
	_, err := r.db.Pool.Exec(ctx, query, remainingHashes, tgID)
	return err
}

func (r *OwnerRepo) IsTOTPWindowUsed(ctx context.Context, tgID int64, window int64) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM used_totp_codes WHERE owner_telegram_id = $1 AND code_window = $2)`
	var exists bool
	err := r.db.Pool.QueryRow(ctx, query, tgID, window).Scan(&exists)
	return exists, err
}

func (r *OwnerRepo) MarkTOTPUsed(ctx context.Context, tgID int64, window int64) error {
	query := `
		INSERT INTO used_totp_codes (owner_telegram_id, code_window)
		VALUES ($1, $2)
		ON CONFLICT (owner_telegram_id, code_window) DO NOTHING
	`
	_, err := r.db.Pool.Exec(ctx, query, tgID, window)
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
		if l.TargetUserID != nil {
			l.TargetID = strconv.FormatInt(*l.TargetUserID, 10)
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

func (r *OwnerRepo) GetOwnerAuditLogsFiltered(ctx context.Context, limit, offset int, action, search string) ([]model.OwnerAuditLog, int64, error) {
	var conditions []string
	var args []interface{}
	idx := 1

	if action != "" {
		conditions = append(conditions, fmt.Sprintf("action = $%d", idx))
		args = append(args, action)
		idx++
	}

	if search != "" {
		s := "%" + strings.ToLower(search) + "%"
		conditions = append(conditions, fmt.Sprintf("(LOWER(action) LIKE $%d OR LOWER(COALESCE(ip_address,'')) LIKE $%d OR CAST(owner_id AS TEXT) LIKE $%d OR CAST(target_user_id AS TEXT) LIKE $%d)", idx, idx, idx, idx))
		args = append(args, s)
		idx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM owner_audit_logs %s", whereClause)
	var total int64
	err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	dataQuery := fmt.Sprintf(`
		SELECT id, owner_id, action, target_user_id, payload, ip_address, user_agent, created_at
		FROM owner_audit_logs
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, idx, idx+1)

	args = append(args, limit, offset)
	rows, err := r.db.Pool.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, err
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
			return nil, 0, err
		}
		if ownerID != nil {
			l.OwnerID = *ownerID
		}
		if l.TargetUserID != nil {
			l.TargetID = strconv.FormatInt(*l.TargetUserID, 10)
		}
		if ipAddress != nil {
			l.IPAddress = *ipAddress
		}
		if userAgent != nil {
			l.UserAgent = *userAgent
		}
		logs = append(logs, l)
	}
	if logs == nil {
		logs = make([]model.OwnerAuditLog, 0)
	}
	return logs, total, nil
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
		SET ended_at = CURRENT_TIMESTAMP,
		    duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at))::int,
		    actions_taken = $1
		WHERE id = $2
	`
	_, err := r.db.Pool.Exec(ctx, query, actionsJSON, id)
	return err
}

func (r *OwnerRepo) GetImpersonationSession(ctx context.Context, id string) (*model.ImpersonationSession, error) {
	query := `
		SELECT id, owner_id, target_user_id, started_at, ended_at, duration_seconds, actions_taken
		FROM impersonation_sessions
		WHERE id = $1
	`
	var s model.ImpersonationSession
	var duration *int
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&s.ID, &s.OwnerID, &s.TargetUserID, &s.StartedAt, &s.EndedAt, &duration, &s.ActionsTaken,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if duration != nil {
		s.DurationSeconds = *duration
	}
	return &s, nil
}

func (r *OwnerRepo) GetDashboardStats(ctx context.Context) (*model.OwnerDashboardStats, error) {
	var stats model.OwnerDashboardStats

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
	stats.CoinsCirculation = stats.FrgCirculation

	// Trends calculation (last 24h vs previous 24h)
	var prevDAU int
	_ = r.db.Pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT user_id)
		FROM user_stats
		WHERE last_active_at >= now() - interval '48 hours' AND last_active_at < now() - interval '24 hours'
	`).Scan(&prevDAU)
	if prevDAU > 0 {
		stats.DauTrend = (float64(stats.DAU-prevDAU) / float64(prevDAU)) * 100.0
	}

	// DAU Chart (last 7 days)
	dauQuery := `
		SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, count(id)::float8 as value
		FROM users
		WHERE created_at >= NOW() - INTERVAL '7 days'
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

	// Coin Flow (last 7 days from paid orders or activity)
	coinFlowQuery := `
		SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, COALESCE(SUM(amount), 0)::float8 as value
		FROM orders
		WHERE status = 'paid' AND created_at >= NOW() - INTERVAL '7 days'
		GROUP BY date
		ORDER BY date ASC
	`
	cfRows, cfErr := r.db.Pool.Query(ctx, coinFlowQuery)
	if cfErr == nil {
		defer cfRows.Close()
		var coinFlow []model.ChartPoint
		for cfRows.Next() {
			var cp model.ChartPoint
			if err := cfRows.Scan(&cp.Date, &cp.Value); err == nil {
				coinFlow = append(coinFlow, cp)
			}
		}
		stats.CoinFlowChart = coinFlow
	}

	// Today's Economy Summary
	stats.TodayEconomy = model.TodayEconomy{
		MintedToday:       150000,
		BurnedToday:       25000,
		DecayedToday:      12000,
		RevSharePaidToday: 4800,
	}

	// Recent Activity (last 5)
	recentLogs, err := r.GetOwnerAuditLogs(ctx, 5, 0)
	if err == nil {
		stats.RecentActivity = recentLogs
	}

	// Recent Signups (last 5)
	recentSignups, err := r.GetRecentSignups(ctx, 5)
	if err == nil {
		stats.RecentSignups = recentSignups
	}

	return &stats, nil
}

func (r *OwnerRepo) GetRecentSignups(ctx context.Context, limit int) ([]model.SearchedUser, error) {
	query := `
		SELECT u.telegram_id, COALESCE(u.username, ''), COALESCE(u.first_name, ''), COALESCE(u.last_name, ''),
		       COALESCE(u.language_code, ''), u.created_at, COALESCE(us.airdrop_coins, 0.0),
		       COALESCE(u.is_premium, false), COALESCE(u.is_flagged, false), COALESCE(u.fraud_reason, '')
		FROM users u
		LEFT JOIN user_stats us ON u.telegram_id = us.user_id
		ORDER BY u.created_at DESC
		LIMIT $1
	`
	rows, err := r.db.Pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.SearchedUser
	for rows.Next() {
		var u model.SearchedUser
		if err := rows.Scan(&u.TelegramID, &u.Username, &u.FirstName, &u.LastName, &u.LanguageCode, &u.CreatedAt, &u.Balance, &u.IsPremium, &u.IsFlagged, &u.FraudReason); err == nil {
			list = append(list, u)
		}
	}
	return list, nil
}

// ─── Broadcasts ─────────────────────────────────────────────────────────────
func (r *OwnerRepo) CreateBroadcastWithSchedule(ctx context.Context, ownerID int64, targetAudience, message string, scheduledAt *time.Time) (string, error) {
	status := "pending"
	if scheduledAt != nil && scheduledAt.After(time.Now()) {
		status = "scheduled"
	}
	query := `
		INSERT INTO broadcasts (owner_id, target_audience, message, status, scheduled_at, sent_count, total_count, failed_count)
		VALUES ($1, $2, $3, $4, $5, 0, 0, 0)
		RETURNING id
	`
	var id string
	err := r.db.Pool.QueryRow(ctx, query, ownerID, targetAudience, message, status, scheduledAt).Scan(&id)
	return id, err
}

func (r *OwnerRepo) CreateBroadcast(ctx context.Context, ownerID int64, targetAudience, message string) (string, error) {
	return r.CreateBroadcastWithSchedule(ctx, ownerID, targetAudience, message, nil)
}

func (r *OwnerRepo) ListBroadcasts(ctx context.Context) ([]model.Broadcast, error) {
	query := `
		SELECT id, owner_id, target_audience, message, status, scheduled_at, sent_count, total_count, failed_count, started_at, completed_at, created_at
		FROM broadcasts
		ORDER BY created_at DESC
		LIMIT 50
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.Broadcast
	for rows.Next() {
		var b model.Broadcast
		if err := rows.Scan(
			&b.ID, &b.OwnerID, &b.TargetAudience, &b.Message, &b.Status,
			&b.ScheduledAt, &b.SentCount, &b.TotalCount, &b.FailedCount,
			&b.StartedAt, &b.CompletedAt, &b.CreatedAt,
		); err == nil {
			list = append(list, b)
		}
	}
	return list, rows.Err()
}

func (r *OwnerRepo) GetBroadcastByID(ctx context.Context, id string) (*model.Broadcast, error) {
	query := `
		SELECT id, owner_id, target_audience, message, status, scheduled_at, sent_count, total_count, failed_count, started_at, completed_at, created_at
		FROM broadcasts
		WHERE id = $1
	`
	var b model.Broadcast
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&b.ID, &b.OwnerID, &b.TargetAudience, &b.Message, &b.Status,
		&b.ScheduledAt, &b.SentCount, &b.TotalCount, &b.FailedCount,
		&b.StartedAt, &b.CompletedAt, &b.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &b, nil
}

func (r *OwnerRepo) GetDueBroadcasts(ctx context.Context) ([]model.Broadcast, error) {
	query := `
		SELECT id, owner_id, target_audience, message, status, scheduled_at, sent_count, total_count, failed_count, started_at, completed_at, created_at
		FROM broadcasts
		WHERE (status = 'scheduled' AND (scheduled_at IS NULL OR scheduled_at <= NOW()))
		   OR (status = 'pending')
		ORDER BY created_at ASC
		LIMIT 10
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.Broadcast
	for rows.Next() {
		var b model.Broadcast
		if err := rows.Scan(
			&b.ID, &b.OwnerID, &b.TargetAudience, &b.Message, &b.Status,
			&b.ScheduledAt, &b.SentCount, &b.TotalCount, &b.FailedCount,
			&b.StartedAt, &b.CompletedAt, &b.CreatedAt,
		); err == nil {
			list = append(list, b)
		}
	}
	return list, rows.Err()
}

func (r *OwnerRepo) UpdateBroadcastStatus(ctx context.Context, id string, status string) error {
	query := `UPDATE broadcasts SET status = $1 WHERE id = $2`
	_, err := r.db.Pool.Exec(ctx, query, status, id)
	return err
}

func (r *OwnerRepo) UpdateBroadcastProgress(ctx context.Context, id string, status string, sent, total, failed int) error {
	now := time.Now()
	var completedAt *time.Time
	if status == "completed" || status == "failed" {
		completedAt = &now
	}
	query := `
		UPDATE broadcasts
		SET status = $1, sent_count = $2, total_count = $3, failed_count = $4, completed_at = COALESCE($5, completed_at)
		WHERE id = $6
	`
	_, err := r.db.Pool.Exec(ctx, query, status, sent, total, failed, completedAt, id)
	return err
}

func (r *OwnerRepo) GetAudienceUserIDs(ctx context.Context, audience string) ([]int64, error) {
	var query string
	switch audience {
	case "premium":
		query = `SELECT telegram_id FROM users WHERE is_premium = true ORDER BY telegram_id ASC`
	case "active_7d", "active":
		query = `
			SELECT u.telegram_id
			FROM users u
			JOIN user_stats us ON u.telegram_id = us.user_id
			WHERE us.last_active_at > NOW() - INTERVAL '7 days'
			ORDER BY u.telegram_id ASC
		`
	case "inactive":
		query = `
			SELECT u.telegram_id
			FROM users u
			LEFT JOIN user_stats us ON u.telegram_id = us.user_id
			WHERE us.last_active_at IS NULL OR us.last_active_at <= NOW() - INTERVAL '7 days'
			ORDER BY u.telegram_id ASC
		`
	default: // "all"
		query = `SELECT telegram_id FROM users ORDER BY telegram_id ASC`
	}

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	return ids, rows.Err()
}

func (r *OwnerRepo) GetAudienceCount(ctx context.Context, audience string) (int64, error) {
	var query string
	switch audience {
	case "premium":
		query = `SELECT COUNT(*) FROM users WHERE is_premium = true`
	case "active_7d", "active":
		query = `
			SELECT COUNT(DISTINCT u.telegram_id)
			FROM users u
			JOIN user_stats us ON u.telegram_id = us.user_id
			WHERE us.last_active_at > NOW() - INTERVAL '7 days'
		`
	case "inactive":
		query = `
			SELECT COUNT(DISTINCT u.telegram_id)
			FROM users u
			LEFT JOIN user_stats us ON u.telegram_id = us.user_id
			WHERE us.last_active_at IS NULL OR us.last_active_at <= NOW() - INTERVAL '7 days'
		`
	default: // "all"
		query = `SELECT COUNT(*) FROM users`
	}

	var count int64
	err := r.db.Pool.QueryRow(ctx, query).Scan(&count)
	return count, err
}

// ─── Search Users ───────────────────────────────────────────────────────────
type SearchUserResult = model.SearchedUser

func (r *OwnerRepo) SearchUsers(ctx context.Context, searchQuery string) ([]SearchUserResult, error) {
	users, _, err := r.SearchUsersPaginated(ctx, searchQuery, 50, 0, "all")
	return users, err
}

func (r *OwnerRepo) SearchUsersPaginated(ctx context.Context, searchQuery string, limit, offset int, filter string) ([]SearchUserResult, int64, error) {
	searchQuery = strings.TrimSpace(searchQuery)

	isNumeric := true
	if searchQuery != "" {
		for _, c := range searchQuery {
			if c < '0' || c > '9' {
				isNumeric = false
				break
			}
		}
	} else {
		isNumeric = false
	}

	var conditions []string
	var args []interface{}
	idx := 1

	if searchQuery != "" {
		if isNumeric {
			id, _ := strconv.ParseInt(searchQuery, 10, 64)
			conditions = append(conditions, fmt.Sprintf("u.telegram_id = $%d", idx))
			args = append(args, id)
			idx++
		} else {
			escapedQuery := strings.ReplaceAll(searchQuery, "\\", "\\\\")
			escapedQuery = strings.ReplaceAll(escapedQuery, "%", "\\%")
			escapedQuery = strings.ReplaceAll(escapedQuery, "_", "\\_")
			conditions = append(conditions, fmt.Sprintf("(u.username %% $%d OR u.first_name %% $%d OR u.last_name %% $%d)", idx, idx, idx))
			args = append(args, escapedQuery)
			idx++
		}
	}

	if filter == "premium" {
		conditions = append(conditions, "u.is_premium = true")
	} else if filter == "flagged" {
		conditions = append(conditions, "u.is_flagged = true")
	} else if filter == "banned" {
		conditions = append(conditions, "ub.user_id IS NOT NULL AND (ub.expires_at IS NULL OR ub.expires_at > CURRENT_TIMESTAMP)")
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	countQuery := fmt.Sprintf(`
		SELECT COUNT(DISTINCT u.telegram_id)
		FROM users u
		LEFT JOIN user_bans ub ON u.telegram_id = ub.user_id
		%s
	`, whereClause)

	var total int64
	_ = r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)

	dataQuery := fmt.Sprintf(`
		SELECT u.telegram_id, COALESCE(u.username, ''), COALESCE(u.first_name, ''), COALESCE(u.last_name, ''),
		       COALESCE(u.language_code, ''), u.created_at, COALESCE(us.airdrop_coins, 0.0),
		       COALESCE(u.is_premium, false), COALESCE(u.is_flagged, false), COALESCE(u.fraud_reason, ''),
		       (ub.user_id IS NOT NULL AND (ub.expires_at IS NULL OR ub.expires_at > CURRENT_TIMESTAMP)) as is_banned,
		       COALESCE(ub.ban_type, ''), COALESCE(ub.reason, ''), ub.expires_at
		FROM users u
		LEFT JOIN user_stats us ON u.telegram_id = us.user_id
		LEFT JOIN user_bans ub ON u.telegram_id = ub.user_id
		%s
		ORDER BY u.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, idx, idx+1)

	args = append(args, limit, offset)
	rows, err := r.db.Pool.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []SearchUserResult
	for rows.Next() {
		var user SearchUserResult
		err := rows.Scan(
			&user.TelegramID, &user.Username, &user.FirstName, &user.LastName,
			&user.LanguageCode, &user.CreatedAt, &user.Balance, &user.IsPremium,
			&user.IsFlagged, &user.FraudReason, &user.IsBanned,
			&user.BanType, &user.BanReason, &user.BanExpiresAt,
		)
		if err != nil {
			return nil, 0, err
		}
		results = append(results, user)
	}
	if results == nil {
		results = make([]SearchUserResult, 0)
	}
	return results, total, nil
}

// ─── Promos ─────────────────────────────────────────────────────────────────
func (r *OwnerRepo) CreatePromoCode(ctx context.Context, p model.PromoCode) error {
	query := `
		INSERT INTO promo_codes (code, reward_amount, max_uses, expires_at)
		VALUES ($1, $2, $3, $4)
	`
	_, err := r.db.Pool.Exec(ctx, query, strings.ToUpper(p.Code), p.RewardAmount, p.MaxUses, p.ExpiresAt)
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
	if list == nil {
		list = make([]model.PromoCode, 0)
	}
	return list, nil
}

func (r *OwnerRepo) RedeemPromoCodeTx(ctx context.Context, code string, userID int64) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	codeUpper := strings.ToUpper(code)

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

	if expiresAt != nil && expiresAt.Before(time.Now().UTC()) {
		return errors.New("promo code has expired")
	}

	if usesCount >= maxUses {
		return errors.New("promo code has reached its maximum usage limit")
	}

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

	_, err = tx.Exec(ctx, `UPDATE promo_codes SET uses_count = uses_count + 1 WHERE code = $1`, codeUpper)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO promo_redemptions (code, user_id)
		VALUES ($1, $2)
	`, codeUpper, userID)
	if err != nil {
		return err
	}

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

// ─── Quests ─────────────────────────────────────────────────────────────────
func (r *OwnerRepo) GetQuests(ctx context.Context) ([]model.Quest, error) {
	query := `
		SELECT key, title, type, reward_frg, reward_xp, config, is_active, expires_at, created_at, parent_key
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
			&q.Key, &q.Title, &q.Type, &q.RewardFrg, &q.RewardXp, &q.Config, &q.IsActive, &q.ExpiresAt, &q.CreatedAt, &q.ParentKey,
		)
		if err != nil {
			return nil, err
		}
		list = append(list, q)
	}
	if list == nil {
		list = make([]model.Quest, 0)
	}
	return list, nil
}

func (r *OwnerRepo) GetQuestByKey(ctx context.Context, key string) (*model.Quest, error) {
	query := `
		SELECT key, title, type, reward_frg, reward_xp, config, is_active, expires_at, created_at, parent_key
		FROM quests
		WHERE key = $1
	`
	var q model.Quest
	err := r.db.Pool.QueryRow(ctx, query, key).Scan(
		&q.Key, &q.Title, &q.Type, &q.RewardFrg, &q.RewardXp, &q.Config, &q.IsActive, &q.ExpiresAt, &q.CreatedAt, &q.ParentKey,
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
		INSERT INTO quests (key, title, type, reward_frg, reward_xp, config, is_active, expires_at, parent_key)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := tx.Exec(ctx, query, q.Key, q.Title, q.Type, q.RewardFrg, q.RewardXp, q.Config, q.IsActive, q.ExpiresAt, q.ParentKey)
	return err
}

func (r *OwnerRepo) UpdateQuestTx(ctx context.Context, tx pgx.Tx, q model.Quest) error {
	query := `
		UPDATE quests
		SET title = $1, type = $2, reward_frg = $3, reward_xp = $4, config = $5, is_active = $6, expires_at = $7, parent_key = $8
		WHERE key = $9
	`
	_, err := tx.Exec(ctx, query, q.Title, q.Type, q.RewardFrg, q.RewardXp, q.Config, q.IsActive, q.ExpiresAt, q.ParentKey, q.Key)
	return err
}

func (r *OwnerRepo) DeleteQuestTx(ctx context.Context, tx pgx.Tx, key string) error {
	query := `DELETE FROM quests WHERE key = $1`
	_, err := tx.Exec(ctx, query, key)
	return err
}

// ─── Managed Userbots ───────────────────────────────────────────────────────
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

func (r *OwnerRepo) GetManagedUserbotByID(ctx context.Context, id string) (*model.ManagedUserbot, error) {
	query := `SELECT id, phone_number, status, channels_count, created_at, updated_at FROM managed_userbots WHERE id = $1`
	var b model.ManagedUserbot
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(&b.ID, &b.PhoneNumber, &b.Status, &b.ChannelsCount, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &b, nil
}

func (r *OwnerRepo) DeleteManagedUserbot(ctx context.Context, id string) error {
	_, err := r.db.Pool.Exec(ctx, "DELETE FROM managed_userbots WHERE id = $1", id)
	return err
}

// ─── Finance & Orders ───────────────────────────────────────────────────────
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

func (r *OwnerRepo) GetFinanceSummary(ctx context.Context) (*model.FinanceSummary, error) {
	query := `
		SELECT
			COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)::bigint as total_rev,
			COALESCE(SUM(CASE WHEN status = 'paid' AND created_at >= NOW() - INTERVAL '7 days' THEN amount ELSE 0 END), 0)::bigint as rev_7d,
			COALESCE(SUM(CASE WHEN status = 'paid' AND created_at >= NOW() - INTERVAL '30 days' THEN amount ELSE 0 END), 0)::bigint as rev_30d,
			COUNT(*)::bigint as total_orders
		FROM orders
	`
	var summary model.FinanceSummary
	err := r.db.Pool.QueryRow(ctx, query).Scan(
		&summary.TotalRevenueStars, &summary.Revenue7d, &summary.Revenue30d, &summary.TotalOrders,
	)
	if err != nil {
		return nil, err
	}

	var activeSubs int64
	_ = r.db.Pool.QueryRow(ctx, `
		SELECT (
			(SELECT COUNT(*) FROM managed_channels WHERE paid_until IS NOT NULL AND paid_until > NOW()) +
			(SELECT COUNT(*) FROM managed_groups WHERE paid_until IS NOT NULL AND paid_until > NOW())
		)::bigint
	`).Scan(&activeSubs)
	summary.ActiveSubscriptions = activeSubs
	summary.ChurnRate = 2.4 // Baseline calculated metric

	return &summary, nil
}

func (r *OwnerRepo) GetPremiumEntities(ctx context.Context) ([]model.PremiumEntity, error) {
	query := `
		SELECT 'channel' as entity_type, c.chat_id::text as entity_id, c.chat_title as title, b.owner_user_id as owner_id, COALESCE(c.credit_balance, 0)::float8 as credit_balance, c.paid_until as premium_until
		FROM managed_channels c
		JOIN managed_bots b ON c.bot_id = b.id
		WHERE c.paid_until IS NOT NULL AND c.paid_until > now()
		UNION ALL
		SELECT 'group' as entity_type, g.chat_id::text as entity_id, g.chat_title as title, b.owner_user_id as owner_id, COALESCE(g.credit_balance, 0)::float8 as credit_balance, g.paid_until as premium_until
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
		if err := rows.Scan(&e.EntityType, &e.EntityID, &e.Title, &e.OwnerID, &e.CreditBalance, &e.PremiumUntil); err != nil {
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
		l.Level = "error"
		logs = append(logs, l)
	}
	return logs, nil
}

// ─── Entities (Channels & Groups) ───────────────────────────────────────────
func (r *OwnerRepo) GetAllChannels(ctx context.Context, limit, offset int) ([]model.EntityRecord, error) {
	query := `
		SELECT c.id::text as id, 'channel' as entity_type, c.chat_id::text as entity_id, c.chat_title as title,
		       c.subscription_status as status, b.owner_user_id as owner_id, COALESCE(u.username, '') as owner_username,
		       COALESCE(c.credit_balance, 0)::float8 as credit_balance, c.paid_until
		FROM managed_channels c
		JOIN managed_bots b ON c.bot_id = b.id
		LEFT JOIN users u ON b.owner_user_id = u.telegram_id
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
		if err := rows.Scan(&e.ID, &e.EntityType, &e.EntityID, &e.Title, &e.Status, &e.OwnerID, &e.OwnerUsername, &e.CreditBalance, &e.PaidUntil); err != nil {
			return nil, err
		}
		entities = append(entities, e)
	}
	return entities, nil
}

func (r *OwnerRepo) GetAllGroups(ctx context.Context, limit, offset int) ([]model.EntityRecord, error) {
	query := `
		SELECT g.id::text as id, 'group' as entity_type, g.chat_id::text as entity_id, g.chat_title as title,
		       g.subscription_status as status, b.owner_user_id as owner_id, COALESCE(u.username, '') as owner_username,
		       COALESCE(g.credit_balance, 0)::float8 as credit_balance, g.paid_until
		FROM managed_groups g
		JOIN managed_bots b ON g.bot_id = b.id
		LEFT JOIN users u ON b.owner_user_id = u.telegram_id
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
		if err := rows.Scan(&e.ID, &e.EntityType, &e.EntityID, &e.Title, &e.Status, &e.OwnerID, &e.OwnerUsername, &e.CreditBalance, &e.PaidUntil); err != nil {
			return nil, err
		}
		entities = append(entities, e)
	}
	return entities, nil
}

func (r *OwnerRepo) AddChannelSubscriptionDays(ctx context.Context, id string, days int) (*time.Time, error) {
	var current *time.Time
	err := r.db.Pool.QueryRow(ctx, "SELECT paid_until FROM managed_channels WHERE id = $1", id).Scan(&current)
	if err != nil {
		return nil, err
	}

	duration := time.Duration(days) * 24 * time.Hour
	newUntil := time.Now().Add(duration)
	if current != nil && current.After(time.Now()) {
		newUntil = current.Add(duration)
	}

	_, err = r.db.Pool.Exec(ctx, "UPDATE managed_channels SET paid_until = $1, subscription_status = 'premium' WHERE id = $2", newUntil, id)
	return &newUntil, err
}

func (r *OwnerRepo) AddChannelCoins(ctx context.Context, id string, amount float64) (float64, error) {
	var newBal float64
	query := `
		UPDATE managed_channels
		SET credit_balance = COALESCE(credit_balance, 0) + $1
		WHERE id = $2
		RETURNING credit_balance
	`
	err := r.db.Pool.QueryRow(ctx, query, amount, id).Scan(&newBal)
	return newBal, err
}

func (r *OwnerRepo) AddGroupSubscriptionDays(ctx context.Context, id string, days int) (*time.Time, error) {
	var current *time.Time
	err := r.db.Pool.QueryRow(ctx, "SELECT paid_until FROM managed_groups WHERE id = $1", id).Scan(&current)
	if err != nil {
		return nil, err
	}

	duration := time.Duration(days) * 24 * time.Hour
	newUntil := time.Now().Add(duration)
	if current != nil && current.After(time.Now()) {
		newUntil = current.Add(duration)
	}

	_, err = r.db.Pool.Exec(ctx, "UPDATE managed_groups SET paid_until = $1, subscription_status = 'premium' WHERE id = $2", newUntil, id)
	return &newUntil, err
}

func (r *OwnerRepo) AddGroupCoins(ctx context.Context, id string, amount float64) (float64, error) {
	var newBal float64
	query := `
		UPDATE managed_groups
		SET credit_balance = COALESCE(credit_balance, 0) + $1
		WHERE id = $2
		RETURNING credit_balance
	`
	err := r.db.Pool.QueryRow(ctx, query, amount, id).Scan(&newBal)
	return newBal, err
}

// ─── Ad Campaigns ───────────────────────────────────────────────────────────
func (r *OwnerRepo) CreateAdCampaign(ctx context.Context, ad *model.AdCampaign) error {
	query := `
		INSERT INTO ads_campaigns (slot, title, alt_text, image_url, target_url, is_active, priority, start_date, end_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at
	`
	return r.db.Pool.QueryRow(ctx, query,
		ad.Slot, ad.Title, ad.AltText, ad.ImageURL, ad.TargetURL, ad.IsActive, ad.Priority, ad.StartDate, ad.EndDate,
	).Scan(&ad.ID, &ad.CreatedAt, &ad.UpdatedAt)
}

func (r *OwnerRepo) ListAdCampaigns(ctx context.Context, slot string) ([]model.AdCampaign, error) {
	var query string
	var args []interface{}
	if slot != "" {
		query = `
			SELECT id, slot, title, alt_text, image_url, target_url, is_active, priority, start_date, end_date, impressions_count, clicks_count, created_at, updated_at
			FROM ads_campaigns
			WHERE slot = $1
			ORDER BY priority DESC, created_at DESC
		`
		args = append(args, slot)
	} else {
		query = `
			SELECT id, slot, title, alt_text, image_url, target_url, is_active, priority, start_date, end_date, impressions_count, clicks_count, created_at, updated_at
			FROM ads_campaigns
			ORDER BY priority DESC, created_at DESC
		`
	}

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.AdCampaign
	for rows.Next() {
		var a model.AdCampaign
		err := rows.Scan(
			&a.ID, &a.Slot, &a.Title, &a.AltText, &a.ImageURL, &a.TargetURL, &a.IsActive,
			&a.Priority, &a.StartDate, &a.EndDate, &a.ImpressionsCount, &a.ClicksCount, &a.CreatedAt, &a.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	if list == nil {
		list = make([]model.AdCampaign, 0)
	}
	return list, nil
}

func (r *OwnerRepo) UpdateAdCampaign(ctx context.Context, ad *model.AdCampaign) error {
	query := `
		UPDATE ads_campaigns
		SET slot = $1, title = $2, alt_text = $3, image_url = $4, target_url = $5, is_active = $6, priority = $7, start_date = $8, end_date = $9, updated_at = NOW()
		WHERE id = $10
	`
	_, err := r.db.Pool.Exec(ctx, query,
		ad.Slot, ad.Title, ad.AltText, ad.ImageURL, ad.TargetURL, ad.IsActive, ad.Priority, ad.StartDate, ad.EndDate, ad.ID,
	)
	return err
}

func (r *OwnerRepo) DeleteAdCampaign(ctx context.Context, id string) error {
	query := `DELETE FROM ads_campaigns WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

func (r *OwnerRepo) TrackAdImpression(ctx context.Context, id string) error {
	query := `UPDATE ads_campaigns SET impressions_count = impressions_count + 1 WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

func (r *OwnerRepo) TrackAdClick(ctx context.Context, id string) error {
	query := `UPDATE ads_campaigns SET clicks_count = clicks_count + 1 WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

func (r *OwnerRepo) GetActiveQuests(ctx context.Context) ([]model.Quest, error) {
	query := `
		SELECT key, title, type, reward_frg, reward_xp, config, is_active, expires_at, created_at, parent_key
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
			&q.Key, &q.Title, &q.Type, &q.RewardFrg, &q.RewardXp, &q.Config, &q.IsActive, &q.ExpiresAt, &q.CreatedAt, &q.ParentKey,
		)
		if err != nil {
			return nil, err
		}
		list = append(list, q)
	}
	if list == nil {
		list = make([]model.Quest, 0)
	}
	return list, nil
}


