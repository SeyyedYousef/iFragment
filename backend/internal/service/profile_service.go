package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/crypto"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"

	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

type ProfileService struct {
	db    *repository.Database
	cache *repository.Cache
}

func NewProfileService(db *repository.Database, cache *repository.Cache) *ProfileService {
	return &ProfileService{
		db:    db,
		cache: cache,
	}
}


// FlushUserPendingTaps is a no-op stub retained for backward compatibility
func (s *ProfileService) FlushUserPendingTaps(ctx context.Context, userID int64) error {
	return nil
}

// UpdateLanguage manually updates the user's language setting
func (s *ProfileService) UpdateLanguage(ctx context.Context, telegramID int64, lang string) error {
	return s.db.UpdateUserLanguage(ctx, telegramID, lang)
}

func (s *ProfileService) getGlobalRank(ctx context.Context, userID int64, xp int) int {
	if s.cache == nil || s.cache.Client == nil {
		rank, err := s.db.GetGlobalRankFromDB(ctx, xp)
		if err != nil {
			return 1
		}
		return rank
	}

	userIDStr := strconv.FormatInt(userID, 10)
	rank, err := s.cache.Client.ZRevRank(ctx, "leaderboard", userIDStr).Result()
	if err == redis.Nil {
		// Populate user in sorted set
		s.cache.Client.ZAdd(ctx, "leaderboard", redis.Z{
			Score:  float64(xp),
			Member: userIDStr,
		})
		rank, err = s.cache.Client.ZRevRank(ctx, "leaderboard", userIDStr).Result()
		if err != nil {
			dbRank, dbErr := s.db.GetGlobalRankFromDB(ctx, xp)
			if dbErr != nil {
				return 1
			}
			return dbRank
		}
	} else if err != nil {
		dbRank, dbErr := s.db.GetGlobalRankFromDB(ctx, xp)
		if dbErr != nil {
			return 1
		}
		return dbRank
	}

	return int(rank) + 1
}

func (s *ProfileService) getBotAPIClient(ctx context.Context) (*telegram.BotAPIClient, error) {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		token = os.Getenv("BOT_TOKEN")
	}
	if token != "" {
		return telegram.NewBotAPIClient(token), nil
	}

	if s.db == nil {
		return nil, fmt.Errorf("no database connection")
	}

	botRepo := repository.NewBotRepo(s.db)
	encryptedToken, err := botRepo.GetActiveBotEncryptedToken(ctx)
	if err == nil && len(encryptedToken) > 0 {
		token, err := crypto.DecryptToken(encryptedToken)
		if err == nil {
			return telegram.NewBotAPIClient(token), nil
		}
	}

	return nil, fmt.Errorf("no active telegram bot client found or configured")
}

type CachedAvatar struct {
	Path     string `json:"path"`
	BotToken string `json:"bot_token"`
}

func (s *ProfileService) cacheAvatar(ctx context.Context, cacheKey, path, token string) {
	if s.cache == nil || s.cache.Client == nil {
		return
	}
	cached := CachedAvatar{
		Path:     path,
		BotToken: token,
	}
	if data, err := json.Marshal(cached); err == nil {
		s.cache.Client.Set(ctx, cacheKey, string(data), 1*time.Hour)
	}
}

func (s *ProfileService) GetUserProfilePhotoPath(ctx context.Context, userID int64) (string, string, error) {
	cacheKey := fmt.Sprintf("user:avatar:path:%d", userID)
	if s.cache != nil && s.cache.Client != nil {
		val, err := s.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			if val == "none" {
				slog.Debug("[GetUserProfilePhotoPath] Cache hit 'none'", "user_id", userID)
				return "", "", nil
			}
			var cached CachedAvatar
			if err := json.Unmarshal([]byte(val), &cached); err == nil {
				slog.Debug("[GetUserProfilePhotoPath] Cache hit path", "path", cached.Path, "user_id", userID)
				return cached.Path, cached.BotToken, nil
			}
		}
	}

	// 1. Try main bot first
	mainToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if mainToken == "" {
		mainToken = os.Getenv("BOT_TOKEN")
	}

	if mainToken != "" {
		tg := telegram.NewBotAPIClient(mainToken)
		path, err := tg.GetUserProfilePhotoURL(ctx, userID)
		if err == nil && path != "" {
			s.cacheAvatar(ctx, cacheKey, path, mainToken)
			slog.Debug("[GetUserProfilePhotoPath] Successfully retrieved path via main bot", "path", path, "user_id", userID)
			return path, mainToken, nil
		}
	}

	// 2. Try custom bots fallback
	if s.db != nil && s.db.Pool != nil {
		rows, err := s.db.Pool.Query(ctx, "SELECT bot_token_encrypted FROM managed_bots WHERE status = 'active'")
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var encryptedToken []byte
				if err := rows.Scan(&encryptedToken); err == nil && len(encryptedToken) > 0 {
					token, decryptErr := crypto.DecryptToken(encryptedToken)
					if decryptErr == nil && token != "" {
						tgCustom := telegram.NewBotAPIClient(token)
						path, err := tgCustom.GetUserProfilePhotoURL(ctx, userID)
						if err == nil && path != "" {
							s.cacheAvatar(ctx, cacheKey, path, token)
							slog.Debug("[GetUserProfilePhotoPath] Successfully retrieved path via custom bot", "path", path, "user_id", userID)
							return path, token, nil
						}
					}
				}
			}
		}

		// 3. Fallback to photo_url stored in users database table
		var dbPhotoURL string
		if queryErr := s.db.Pool.QueryRow(ctx, "SELECT COALESCE(photo_url, '') FROM users WHERE telegram_id = $1", userID).Scan(&dbPhotoURL); queryErr == nil && dbPhotoURL != "" {
			s.cacheAvatar(ctx, cacheKey, dbPhotoURL, "")
			slog.Debug("[GetUserProfilePhotoPath] Successfully retrieved path via DB photo_url", "photo_url", dbPhotoURL, "user_id", userID)
			return dbPhotoURL, "", nil
		}
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Set(ctx, cacheKey, "none", 15*time.Second)
	}
	slog.Debug("[GetUserProfilePhotoPath] No avatar path found", "user_id", userID)
	return "", "", nil
}

type safeReadCloser struct {
	io.Reader
	io.Closer
}

var privateIPBlocks []*net.IPNet

func init() {
	for _, cidr := range []string{
		"127.0.0.0/8",     // IPv4 loopback
		"10.0.0.0/8",      // RFC1918
		"172.16.0.0/12",   // RFC1918
		"192.168.0.0/16",  // RFC1918
		"169.254.0.0/16",  // RFC3927 link-local
		"0.0.0.0/8",       // RFC1122 current network
		"100.64.0.0/10",   // RFC6598 carrier-grade NAT
		"192.0.0.0/24",    // RFC6890 IETF protocol assignments
		"192.0.2.0/24",    // RFC5737 TEST-NET-1
		"198.51.100.0/24", // RFC5737 TEST-NET-2
		"203.0.113.0/24",  // RFC5737 TEST-NET-3
		"224.0.0.0/4",     // RFC5771 multicast
		"240.0.0.0/4",     // RFC1112 reserved
		"::1/128",         // IPv6 loopback
		"fc00::/7",        // IPv6 unique local addr (ULA)
		"fe80::/10",       // IPv6 link-local unicast
		"::/128",          // IPv6 unspecified
		"ff00::/8",        // IPv6 multicast
	} {
		_, block, err := net.ParseCIDR(cidr)
		if err == nil {
			privateIPBlocks = append(privateIPBlocks, block)
		}
	}
}

func isSafeIP(ip net.IP) bool {
	if ip == nil {
		return false
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsInterfaceLocalMulticast() || ip.IsUnspecified() {
		return false
	}
	for _, block := range privateIPBlocks {
		if block.Contains(ip) {
			return false
		}
	}
	return true
}

func createSafeAvatarHTTPClient() *http.Client {
	dialer := &net.Dialer{
		Timeout:   3 * time.Second,
		KeepAlive: 30 * time.Second,
	}

	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(addr)
			if err != nil {
				return nil, fmt.Errorf("invalid address: %w", err)
			}

			ips, err := net.DefaultResolver.LookupIP(ctx, "ip", host)
			if err != nil {
				return nil, fmt.Errorf("failed to resolve host %s: %w", host, err)
			}
			if len(ips) == 0 {
				return nil, fmt.Errorf("no IP found for host %s", host)
			}

			var chosenIP net.IP
			for _, ip := range ips {
				if isSafeIP(ip) {
					chosenIP = ip
					break
				}
			}

			if chosenIP == nil {
				return nil, fmt.Errorf("connection to host %s rejected: resolves to restricted or private IP addresses", host)
			}

			// Connect directly to the validated IP to defeat DNS rebinding attacks
			return dialer.DialContext(ctx, network, net.JoinHostPort(chosenIP.String(), port))
		},
		MaxIdleConns:          50,
		IdleConnTimeout:       30 * time.Second,
		TLSHandshakeTimeout:   3 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	return &http.Client{
		Transport: transport,
		Timeout:   5 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return fmt.Errorf("stopped after 3 redirects")
			}
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return fmt.Errorf("unsupported protocol in redirect: %s", req.URL.Scheme)
			}
			return nil
		},
	}
}

const maxAvatarBytes = 5 * 1024 * 1024 // 5 MB limit (SEC-P1-002)

func (s *ProfileService) GetAvatarStream(ctx context.Context, userID int64) (io.ReadCloser, string, int64, error) {
	slog.Debug("[GetAvatarStream] Starting avatar stream download", "user_id", userID)
	path, botToken, err := s.GetUserProfilePhotoPath(ctx, userID)
	if err != nil {
		slog.Debug("[GetAvatarStream] GetUserProfilePhotoPath failed", "user_id", userID, "error", err)
		return nil, "", 0, err
	}
	if path == "" {
		slog.Debug("[GetAvatarStream] No photo path returned (user has no photo or restricted visibility)", "user_id", userID)
		return nil, "", 0, fmt.Errorf("no avatar found")
	}

	var targetURL string
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		targetURL = path
		slog.Debug("[GetAvatarStream] Downloading direct URL", "url", path, "user_id", userID)
	} else if botToken != "" {
		tg := telegram.NewBotAPIClient(botToken)
		targetURL = fmt.Sprintf("%s/file/bot%s/%s", tg.BaseURL(), tg.Token(), path)
		slog.Debug("[GetAvatarStream] Downloading from Telegram", "base_url", tg.BaseURL(), "path", path)
	} else {
		return nil, "", 0, fmt.Errorf("invalid avatar source")
	}

	parsedURL, err := url.Parse(targetURL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		return nil, "", 0, fmt.Errorf("invalid avatar URL scheme")
	}

	client := createSafeAvatarHTTPClient()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, "", 0, err
	}

	resp, err := client.Do(req)
	if err != nil {
		slog.Debug("[GetAvatarStream] Remote avatar request failed", "user_id", userID, "error", err)
		return nil, "", 0, err
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		slog.Debug("[GetAvatarStream] Remote file server returned error", "status_code", resp.StatusCode, "user_id", userID)
		return nil, "", 0, fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	contentLength, _ := strconv.ParseInt(resp.Header.Get("Content-Length"), 10, 64)
	if contentLength > maxAvatarBytes {
		resp.Body.Close()
		return nil, "", 0, fmt.Errorf("avatar exceeds maximum size limit of 5MB")
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/jpeg"
	}
	slog.Debug("[GetAvatarStream] Stream initialized", "user_id", userID, "size_bytes", contentLength, "content_type", contentType)
	safeBody := safeReadCloser{
		Reader: io.LimitReader(resp.Body, maxAvatarBytes),
		Closer: resp.Body,
	}
	return safeBody, contentType, contentLength, nil
}

func (s *ProfileService) GetStats(ctx context.Context, userID int64) (*model.ProfileStats, error) {
	cacheKey := fmt.Sprintf("profile:stats:%d", userID)

	if s.cache != nil && s.cache.Client != nil {
		val, err := s.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var stats model.ProfileStats
			if json.Unmarshal([]byte(val), &stats) == nil {
				stats.GlobalRank = s.getGlobalRank(ctx, userID, stats.XP)
				stats.ServerNow = time.Now().UnixNano() / int64(time.Millisecond)
				stats.PhotoURL = fmt.Sprintf("/api/v1/profile/avatar/%d", userID)
				return &stats, nil
			}
		}
	}

	// Perform atomic maintenance upon cache miss
	_ = s.db.MaintainUserStats(ctx, userID)

	stats, err := s.db.GetProfileStats(ctx, userID)
	if err != nil {
		return nil, err
	}

	stats.GlobalRank = s.getGlobalRank(ctx, userID, stats.XP)

	// Enrich with server-authoritative UTC booster reset timestamp (Next 00:00:00 UTC in ms)
	nowUTC := time.Now().UTC()
	nextMidnightUTC := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day()+1, 0, 0, 0, 0, time.UTC)
	stats.BoosterResetAt = nextMidnightUTC.UnixMilli()

	// Compute server-authoritative fatigue multiplier & remaining tier cap
	if stats.DailyTappedCoins > 30000 {
		stats.DailyFatigueMultiplier = 0.10
		stats.DailyFatigueLimitRemaining = 0
	} else if stats.DailyTappedCoins > 15000 {
		stats.DailyFatigueMultiplier = 0.25
		stats.DailyFatigueLimitRemaining = 30000 - stats.DailyTappedCoins
	} else if stats.DailyTappedCoins > 5000 {
		stats.DailyFatigueMultiplier = 0.50
		stats.DailyFatigueLimitRemaining = 15000 - stats.DailyTappedCoins
	} else {
		stats.DailyFatigueMultiplier = 1.0
		stats.DailyFatigueLimitRemaining = 5000 - stats.DailyTappedCoins
	}

	// Check active turbo boost on server
	if s.db.Pool != nil {
		var turboExpiresAt *time.Time
		_ = s.db.Pool.QueryRow(ctx, `SELECT turbo_expires_at FROM user_daily_boosts WHERE user_id = $1 AND day = CURRENT_DATE`, userID).Scan(&turboExpiresAt)
		if turboExpiresAt != nil && turboExpiresAt.After(time.Now()) {
			stats.TurboExpiresAt = turboExpiresAt
		}

		// Fetch wallet expiry summary
		if expirySummary, err := s.db.GetWalletExpirySummary(ctx, userID); err == nil && expirySummary != nil {
			stats.EarliestExpiringCoins = expirySummary.EarliestExpiringCoins
			stats.EarliestExpiringDays = expirySummary.EarliestDaysLeft
		}
	}

	// Add pending batched taps from Redis to ensure immediate UI updates upon page refresh
	if s.cache != nil && s.cache.Client != nil {
		userIDStr := strconv.FormatInt(userID, 10)
		var pendingTaps int64
		if val, err := s.cache.Client.HGet(ctx, "profile:taps:batch", userIDStr).Result(); err == nil {
			if p, err := strconv.ParseInt(val, 10, 64); err == nil {
				pendingTaps += p
			}
		}
		if valProc, err := s.cache.Client.HGet(ctx, "profile:taps:batch:processing", userIDStr).Result(); err == nil {
			if p, err := strconv.ParseInt(valProc, 10, 64); err == nil {
				pendingTaps += p
			}
		}
		if pendingTaps > 0 {
			stats.AirdropCoins += float64(pendingTaps)
			stats.XP += int(pendingTaps)
		}
	}

	stats.PhotoURL = fmt.Sprintf("/api/v1/profile/avatar/%d", userID)

	if s.cache != nil && s.cache.Client != nil {
		data, err := json.Marshal(stats)
		if err == nil {
			s.cache.Client.Set(ctx, cacheKey, data, 15*time.Second)
		}
	}

	stats.ServerNow = time.Now().UnixNano() / int64(time.Millisecond)
	return stats, nil
}

func (s *ProfileService) shouldSyncAchievements(ctx context.Context, userID int64) bool {
	if s.cache == nil || s.cache.Client == nil {
		return true
	}
	key := fmt.Sprintf("ach:sync:%d", userID)
	set, err := s.cache.Client.SetNX(ctx, key, 1, 5*time.Minute).Result()
	if err != nil {
		return true
	}
	return set
}

func (s *ProfileService) GetAchievements(ctx context.Context, userID int64) ([]model.UserAchievement, error) {
	if s.shouldSyncAchievements(ctx, userID) {
		stats, err := s.GetStats(ctx, userID)
		if err == nil {
			items := []repository.AchievementProgress{
				{ID: "first_steps", Progress: 1},
				{ID: "tap_novice", Progress: stats.TotalTaps},
				{ID: "mining_machine", Progress: stats.TotalTaps},
				{ID: "first_scan", Progress: stats.UsernamesAnalyzed},
				{ID: "whale_hunter", Progress: stats.UsernamesAnalyzed},
				{ID: "data_scientist", Progress: stats.UsernamesAnalyzed},
				{ID: "gift_connoisseur", Progress: stats.GiftsAppraised},
				{ID: "rare_collector", Progress: stats.GiftsAppraised},
				{ID: "week_warrior", Progress: stats.DaysActive},
				{ID: "month_master", Progress: stats.DaysActive},
				{ID: "legendary", Progress: stats.DaysActive},
			}
			_ = s.db.BatchUpdateAchievements(ctx, userID, items)
		}
	}
	return s.db.GetAchievements(ctx, userID)
}

func (s *ProfileService) GetReferralData(ctx context.Context, userID int64) (*model.ReferralHubData, error) {
	cacheKey := fmt.Sprintf("profile:referral:%d", userID)
	if s.cache != nil && s.cache.Client != nil {
		val, err := s.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var data model.ReferralHubData
			if json.Unmarshal([]byte(val), &data) == nil {
				return &data, nil
			}
		}
	}

	data, err := s.db.GetReferralData(ctx, userID)
	if err != nil {
		return nil, err
	}

	if s.cache != nil && s.cache.Client != nil {
		bytes, _ := json.Marshal(data)
		s.cache.Client.Set(ctx, cacheKey, bytes, 60*time.Second)
	}

	return data, nil
}

func (s *ProfileService) SetReferralCode(ctx context.Context, userID int64, referrerCode string) error {
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1) Resolve referrer + self/circular checks atomically WITH LOCK
	var referrerID int64
	var referrerReferredBy *int64

	parsedID := int64(0)
	if strings.HasPrefix(referrerCode, "ref_") {
		idStr := strings.TrimPrefix(referrerCode, "ref_")
		if id, err := strconv.ParseInt(idStr, 10, 64); err == nil {
			parsedID = id
		}
	}

	if parsedID > 0 {
		err = tx.QueryRow(ctx, `
			SELECT telegram_id, referred_by
			FROM users
			WHERE telegram_id = $1
			FOR UPDATE`, parsedID).Scan(&referrerID, &referrerReferredBy)
	} else {
		err = tx.QueryRow(ctx, `
			SELECT telegram_id, referred_by
			FROM users
			WHERE referral_code = $1
			FOR UPDATE`, referrerCode).Scan(&referrerID, &referrerReferredBy)
	}

	if err != nil {
		return fmt.Errorf("invalid referral code")
	}
	if referrerID == userID {
		return fmt.Errorf("cannot refer yourself")
	}
	if referrerReferredBy != nil && *referrerReferredBy == userID {
		return fmt.Errorf("circular referral not allowed")
	}

	// 2) Set referred_by only if NULL — atomic
	cmdTag, err := tx.Exec(ctx, `
		UPDATE users SET referred_by = $1
		WHERE telegram_id = $2 AND referred_by IS NULL`,
		referrerID, userID,
	)
	if err != nil {
		return err
	}
	if cmdTag.RowsAffected() != 1 {
		return fmt.Errorf("referral already set")
	}

	// 3) Daily/total caps — using *atomic* counter with rollback-on-deny
	const (
		MaxReferralRewardPerDay = 20000.0
		MaxReferralRewardTotal  = 1000000.0
		ReferrerReward          = 10000.0
		ReferredReward          = 10000.0
	)
	var totalReferrals int
	_ = tx.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE referred_by = $1", referrerID).Scan(&totalReferrals)
	totalEarned := float64(totalReferrals) * ReferrerReward

	rewardReferrer := totalEarned < MaxReferralRewardTotal
	if rewardReferrer {
		if s.cache != nil && s.cache.Client != nil {
			todayKey := fmt.Sprintf("referral:daily:%d:%s", referrerID, time.Now().UTC().Format("2006-01-02"))
			// ✅ check-first pattern: GET-then-INCR, with rollback if over cap
			dailyTotal, errIncr := s.cache.Client.IncrByFloat(ctx, todayKey, ReferrerReward).Result()
			if errIncr == nil {
				s.cache.Client.Expire(ctx, todayKey, 24*time.Hour)
				if dailyTotal > MaxReferralRewardPerDay {
					// rollback the increment so future callers see correct state
					s.cache.Client.IncrByFloat(ctx, todayKey, -ReferrerReward)
					rewardReferrer = false
				}
			} else {
				// Failed to increment cache, deny reward
				rewardReferrer = false
			}
		} else {
			// Cache is down, deny reward to prevent exploit
			rewardReferrer = false
		}
	}

	// 4) Issue rewards INSIDE tx via shared connection
	if rewardReferrer {
		var refBeforeCoins float64
		_ = tx.QueryRow(ctx, "SELECT COALESCE(airdrop_coins, 0) FROM user_stats WHERE user_id = $1", referrerID).Scan(&refBeforeCoins)
		refAfterCoins := refBeforeCoins + ReferrerReward

		_, err = tx.Exec(ctx, `
			INSERT INTO user_stats (user_id, days_active, current_streak, total_taps, xp, level, last_active_at, energy, energy_updated_at, airdrop_coins, total_coins_earned)
			VALUES ($1, 1, 1, 0, 0, 1, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP, $2, $2)
			ON CONFLICT (user_id) DO UPDATE SET 
				airdrop_coins = COALESCE(user_stats.airdrop_coins, 0.0) + $2,
				total_coins_earned = COALESCE(user_stats.total_coins_earned, 0.0) + $2`,
			referrerID, ReferrerReward,
		)
		if err != nil {
			return err
		}

		_, _ = tx.Exec(ctx, `
			INSERT INTO user_ledger_events (
				user_id, category, event_type, amount, balance_before, balance_after,
				title, reference_id, metadata, created_at
			) VALUES (
				$1, 'coins', 'earn_referral_reward', $2, $3, $4,
				'Referral Bonus (Friend Joined)', 'ref_invite_' || $5::text,
				'{"source": "referral_invite"}'::jsonb, CURRENT_TIMESTAMP
			)
		`, referrerID, ReferrerReward, refBeforeCoins, refAfterCoins, userID)

		_, _ = tx.Exec(ctx, `
			INSERT INTO user_credit_batches (user_id, amount, remaining_amount, source, earned_at, expires_at, is_expired)
			VALUES ($1, $2, $2, 'referral_invite', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', FALSE)
		`, referrerID, ReferrerReward)

		// Task 1: When referrer reaches every 3rd referral (totalReferrals % 3 == 0), grant 1 Intel Credit
		if totalReferrals > 0 && totalReferrals%3 == 0 {
			milestone := totalReferrals
			refID := fmt.Sprintf("ref:%d:%d", referrerID, milestone)
			var batchID string
			grantErr := tx.QueryRow(ctx, `
				INSERT INTO intel_credit_batches (user_id, kind, amount, remaining, source, reference_id, expires_at, created_at)
				VALUES ($1, 'intel_report', 1, 1, 'referral', $2, NULL, now())
				ON CONFLICT (source, reference_id) DO NOTHING
				RETURNING id::text
			`, referrerID, refID).Scan(&batchID)
			if grantErr == nil && batchID != "" {
				_, _ = tx.Exec(ctx, `
					INSERT INTO intel_credit_ledger (user_id, delta, reason, entity, batch_id, created_at)
					VALUES ($1, 1, 'grant:referral', $2, $3::uuid, now())
				`, referrerID, refID, batchID)
			}
		}
	}

	var userBeforeCoins float64
	_ = tx.QueryRow(ctx, "SELECT COALESCE(airdrop_coins, 0) FROM user_stats WHERE user_id = $1", userID).Scan(&userBeforeCoins)
	userAfterCoins := userBeforeCoins + ReferredReward

	_, err = tx.Exec(ctx, `
		INSERT INTO user_stats (user_id, days_active, current_streak, total_taps, xp, level, last_active_at, energy, energy_updated_at, airdrop_coins, total_coins_earned)
		VALUES ($1, 1, 1, 0, 0, 1, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP, $2, $2)
		ON CONFLICT (user_id) DO UPDATE SET 
			airdrop_coins = COALESCE(user_stats.airdrop_coins, 0.0) + $2,
			total_coins_earned = COALESCE(user_stats.total_coins_earned, 0.0) + $2`,
		userID, ReferredReward,
	)
	if err != nil {
		return err
	}

	_, _ = tx.Exec(ctx, `
		INSERT INTO user_ledger_events (
			user_id, category, event_type, amount, balance_before, balance_after,
			title, reference_id, metadata, created_at
		) VALUES (
			$1, 'coins', 'earn_referred_welcome', $2, $3, $4,
			'Welcome Referral Bonus', 'ref_welcome_' || $5::text,
			'{"source": "referral_welcome"}'::jsonb, CURRENT_TIMESTAMP
		)
	`, userID, ReferredReward, userBeforeCoins, userAfterCoins, referrerID)

	_, _ = tx.Exec(ctx, `
		INSERT INTO user_credit_batches (user_id, amount, remaining_amount, source, earned_at, expires_at, is_expired)
		VALUES ($1, $2, $2, 'referral_welcome', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', FALSE)
	`, userID, ReferredReward)

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// cache invalidation post-commit
	if s.cache != nil && s.cache.Client != nil {
		pipe := s.cache.Client.Pipeline()
		pipe.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
		pipe.Del(ctx, fmt.Sprintf("profile:stats:%d", referrerID))
		_, _ = pipe.Exec(ctx)
	}
	return nil
}

// GetWalletExpirySummary returns wallet coin expiration details for user
func (s *ProfileService) GetWalletExpirySummary(ctx context.Context, userID int64) (*model.WalletExpirySummary, error) {
	return s.db.GetWalletExpirySummary(ctx, userID)
}

func (s *ProfileService) GetCosmetics(ctx context.Context, userID int64) ([]model.CosmeticItem, error) {
	return s.db.GetCosmetics(ctx, userID)
}

func (s *ProfileService) PurchaseCosmetic(ctx context.Context, userID int64, cosmeticID string) error {
	var item *model.CosmeticItem
	for _, it := range repository.PredefinedCosmetics {
		if it.ID == cosmeticID {
			item = &it
			break
		}
	}
	if item == nil {
		return fmt.Errorf("cosmetic item not found")
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Lock balance + check
	var balance float64
	err = tx.QueryRow(ctx,
		`SELECT COALESCE(airdrop_coins, 0) FROM user_stats WHERE user_id = $1 FOR UPDATE`,
		userID,
	).Scan(&balance)
	if err == pgx.ErrNoRows {
		return fmt.Errorf("insufficient balance: need %.0f, have 0", item.Cost)
	} else if err != nil {
		return err
	}

	if balance < item.Cost {
		return fmt.Errorf("insufficient balance: have %.0f, need %.0f", balance, item.Cost)
	}

	// 2. Check not already owned (within tx)
	var exists bool
	err = tx.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM user_cosmetics WHERE user_id = $1 AND cosmetic_id = $2)`,
		userID, cosmeticID,
	).Scan(&exists)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("cosmetic already purchased")
	}

	// 3. Debit coins
	_, err = tx.Exec(ctx,
		`UPDATE user_stats SET airdrop_coins = airdrop_coins - $1 WHERE user_id = $2`,
		item.Cost, userID,
	)
	if err != nil {
		return err
	}

	// 4. Record purchase
	_, err = tx.Exec(ctx,
		`INSERT INTO user_cosmetics (user_id, cosmetic_id) VALUES ($1, $2)`,
		userID, cosmeticID,
	)
	if err != nil {
		return err
	}

	// 5. Log transaction
	// Cosmetics purchase logging can be handled elsewhere or omitted if not critical

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// Referral revenue share (outside critical tx, async-safe)
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		t1, t2, refErr := s.db.GetReferralChain(bgCtx, userID)
		if refErr == nil {
			if t1 > 0 {
				_, _ = s.db.AdjustAirdropCoins(bgCtx, t1, item.Cost*0.10)
				_ = s.db.AddCreditBatch(bgCtx, t1, item.Cost*0.10, "referral_cosmetic_t1")
			}
			if t2 > 0 {
				_, _ = s.db.AdjustAirdropCoins(bgCtx, t2, item.Cost*0.05)
				_ = s.db.AddCreditBatch(bgCtx, t2, item.Cost*0.05, "referral_cosmetic_t2")
			}
		}

		if s.cache != nil && s.cache.Client != nil {
			pipe := s.cache.Client.Pipeline()
			pipe.Del(bgCtx, fmt.Sprintf("profile:stats:%d", userID))
			if refErr == nil {
				if t1 != 0 {
					pipe.Del(bgCtx, fmt.Sprintf("profile:stats:%d", t1))
				}
				if t2 != 0 {
					pipe.Del(bgCtx, fmt.Sprintf("profile:stats:%d", t2))
				}
			}
			_, _ = pipe.Exec(bgCtx)
		}
	}()

	return nil
}

func (s *ProfileService) EquipCosmetic(ctx context.Context, userID int64, cosmeticID string, cosmeticType string) error {
	// 1. Validate type whitelist
	if cosmeticType != "border" && cosmeticType != "skin" {
		return fmt.Errorf("invalid cosmetic type: must be 'border' or 'skin'")
	}

	// 2. Unequip path: empty cosmeticID + valid type is allowed
	if cosmeticID == "" {
		if err := s.db.EquipCosmetic(ctx, userID, "", cosmeticType); err != nil {
			return err
		}
		s.invalidateProfileCache(ctx, userID)
		return nil
	}

	// 3. Validate cosmetic exists AND its declared type matches request
	var def *model.CosmeticItem
	for _, it := range repository.PredefinedCosmetics {
		if it.ID == cosmeticID {
			it := it
			def = &it
			break
		}
	}
	if def == nil {
		return fmt.Errorf("cosmetic %s not found", cosmeticID)
	}
	if def.Type != cosmeticType {
		// 🛡️ blocks SEC-01: skin → border type confusion
		return fmt.Errorf("type mismatch: cosmetic %s is %q, not %q", cosmeticID, def.Type, cosmeticType)
	}

	// 4. Ownership check
	has, err := s.db.HasCosmetic(ctx, userID, cosmeticID)
	if err != nil {
		return err
	}
	if !has {
		return fmt.Errorf("cosmetic not owned")
	}

	if err := s.db.EquipCosmetic(ctx, userID, cosmeticID, cosmeticType); err != nil {
		return err
	}
	s.invalidateProfileCache(ctx, userID)
	return nil
}

func (s *ProfileService) invalidateProfileCache(ctx context.Context, userID int64) {
	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}
}

func (s *ProfileService) SetEmojiStatus(ctx context.Context, userID int64, emoji string) error {
	stats, err := s.GetStats(ctx, userID)
	if err != nil {
		return err
	}
	if !stats.IsPremium && emoji != "" {
		return fmt.Errorf("emoji status is a premium-only feature")
	}

	err = s.db.SetEmojiStatus(ctx, userID, emoji)
	if err != nil {
		return err
	}

	// Push the status to Telegram itself (Bot API setUserEmojiStatus).
	// Previously this was DB-only — the badge never actually appeared on the
	// user's profile. Best-effort: a Telegram-side failure must not roll back
	// the DB state (the webhook retry loop can re-apply later).
	s.pushEmojiStatusToTelegram(ctx, userID, emoji)

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}
	return nil
}

// pushEmojiStatusToTelegram applies the emoji via the main bot. The main bot
// token comes from env; managed bots have no cross-user emoji rights.
func (s *ProfileService) pushEmojiStatusToTelegram(ctx context.Context, userID int64, emoji string) {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		token = os.Getenv("BOT_TOKEN")
	}
	if token == "" {
		slog.Warn("emoji status push skipped: no main bot token configured")
		return
	}
	tg := telegram.NewBotAPIClient(token)
	if err := tg.SetUserEmojiStatus(ctx, userID, emoji); err != nil {
		slog.Warn("setUserEmojiStatus failed (user may need to allow the bot)",
			"user", userID, "error", err)
	} else if emoji != "" {
		slog.Info("emoji status applied on Telegram profile", "user", userID)
	}
}

func (s *ProfileService) DeleteUserDataGDPR(ctx context.Context, userID int64) error {
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin GDPR deletion tx: %w", err)
	}
	defer tx.Rollback(ctx)

	tables := []struct {
		table  string
		column string
	}{
		{"user_ledger_events", "user_id"},
		{"user_emoji_rewards", "user_id"},
		{"user_credit_batches", "user_id"},
		{"user_cosmetics", "user_id"},
		{"user_boosts", "user_id"},
		{"user_tasks", "user_id"},
		{"user_daily_claims", "user_id"},
		{"user_achievements", "user_id"},
		{"clan_members", "user_id"},
		{"promo_redemptions", "user_id"},
		{"search_logs", "user_id"},
		{"user_stats", "user_id"},
		{"users", "telegram_id"},
	}

	for _, t := range tables {
		_, err = tx.Exec(ctx, fmt.Sprintf("DELETE FROM %s WHERE %s = $1", t.table, t.column), userID)
		if err != nil {
			return fmt.Errorf("GDPR: failed to delete from %s: %w", t.table, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("GDPR deletion commit failed: %w", err)
	}

	if s.cache != nil && s.cache.Client != nil {
		userIDStr := strconv.FormatInt(userID, 10)
		pipe := s.cache.Client.Pipeline()
		pipe.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
		pipe.ZRem(ctx, "leaderboard", userIDStr)
		pipe.Del(ctx, fmt.Sprintf("referrals:%d", userID))
		pipe.Del(ctx, fmt.Sprintf("achievements:%d", userID))
		pipe.Del(ctx, fmt.Sprintf("daily:%d", userID))
		pipe.Del(ctx, fmt.Sprintf("tasks:%d", userID))
		pipe.Del(ctx, fmt.Sprintf("boosts:%d", userID))
		pipe.Del(ctx, fmt.Sprintf("profile:assets:%d", userID))
		_, _ = pipe.Exec(ctx)

		// Purge all user refresh sessions from Redis via SCAN
		pattern := fmt.Sprintf("user_refresh:%d:*", userID)
		var cursor uint64
		for {
			batch, nextCursor, err := s.cache.Client.Scan(ctx, cursor, pattern, 50).Result()
			if err != nil {
				break
			}
			if len(batch) > 0 {
				s.cache.Client.Del(ctx, batch...)
			}
			cursor = nextCursor
			if cursor == 0 {
				break
			}
		}
	}

	return nil
}

func (s *ProfileService) GetLedger(ctx context.Context, userID int64, category string, limit int, cursor string) (*model.LedgerResponse, error) {
	return s.db.GetLedgerEvents(ctx, userID, category, limit, cursor)
}

func (s *ProfileService) getLiveTonRate(ctx context.Context) float64 {
	if s.cache != nil && s.cache.Client != nil {
		if val, err := s.cache.Client.Get(ctx, "crypto:prices").Result(); err == nil && val != "" {
			var prices map[string]float64
			if err := json.Unmarshal([]byte(val), &prices); err == nil {
				if r, ok := prices["the-open-network"]; ok && r > 0 {
					return r
				}
			}
		}
		if val, err := s.cache.Client.Get(ctx, "cryptoprice:the-open-network").Result(); err == nil && val != "" {
			if r, err := strconv.ParseFloat(val, 64); err == nil && r > 0 {
				return r
			}
		}
	}
	return 0.0
}

func (s *ProfileService) GetMyAssets(ctx context.Context, userID int64) (*model.MyAssetsResponse, error) {
	resp, err := s.db.GetMyAssets(ctx, userID)
	if err != nil || resp == nil {
		return resp, err
	}
	tonRate := s.getLiveTonRate(ctx)
	for i := range resp.Gifts {
		if resp.Gifts[i].EstimatedValGRAM > 0 && tonRate > 0 {
			resp.Gifts[i].EstimatedValUSD = math.Round(resp.Gifts[i].EstimatedValGRAM*tonRate*100) / 100
		} else {
			resp.Gifts[i].EstimatedValUSD = 0
		}
	}
	return resp, nil
}

func (s *ProfileService) ClaimEmojiStatusReward(ctx context.Context, userID int64) (*model.EmojiRewardResponse, error) {
	resp, err := s.db.ClaimEmojiStatusReward(ctx, userID)
	if err != nil {
		return nil, err
	}
	if resp.Rewarded {
		s.invalidateProfileCache(ctx, userID)
	}
	return resp, nil
}

