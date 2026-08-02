package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"

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

	if s.db == nil || s.db.Pool == nil {
		return nil, fmt.Errorf("no database connection")
	}

	var encryptedToken []byte
	err := s.db.Pool.QueryRow(ctx, "SELECT bot_token_encrypted FROM managed_bots WHERE status = 'active' LIMIT 1").Scan(&encryptedToken)
	if err == nil && len(encryptedToken) > 0 {
		token, err := botmgmt.DecryptToken(encryptedToken)
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
					token, decryptErr := botmgmt.DecryptToken(encryptedToken)
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
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Set(ctx, cacheKey, "none", 2*time.Minute)
	}
	slog.Debug("[GetUserProfilePhotoPath] No avatar path found", "user_id", userID)
	return "", "", nil
}

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

	tg := telegram.NewBotAPIClient(botToken)

	fileURL := fmt.Sprintf("%s/file/bot%s/%s", tg.BaseURL(), tg.Token(), path)
	slog.Debug("[GetAvatarStream] Downloading from Telegram", "base_url", tg.BaseURL(), "path", path)

	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fileURL, nil)
	if err != nil {
		return nil, "", 0, err
	}

	resp, err := client.Do(req)
	if err != nil {
		slog.Debug("[GetAvatarStream] Telegram request failed", "user_id", userID, "error", err)
		return nil, "", 0, err
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		slog.Debug("[GetAvatarStream] Telegram file server returned error", "status_code", resp.StatusCode, "user_id", userID)
		return nil, "", 0, fmt.Errorf("telegram returned status %d", resp.StatusCode)
	}

	contentLength, _ := strconv.ParseInt(resp.Header.Get("Content-Length"), 10, 64)
	slog.Debug("[GetAvatarStream] Stream initialized", "user_id", userID, "size_bytes", contentLength, "content_type", resp.Header.Get("Content-Type"))
	return resp.Body, resp.Header.Get("Content-Type"), contentLength, nil
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
				avatarPath, _, err := s.GetUserProfilePhotoPath(ctx, userID)
				if err == nil && avatarPath != "" {
					stats.PhotoURL = fmt.Sprintf("/api/v1/profile/avatar/%d", userID)
				}
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

	avatarPath, _, err := s.GetUserProfilePhotoPath(ctx, userID)
	if err == nil && avatarPath != "" {
		stats.PhotoURL = fmt.Sprintf("/api/v1/profile/avatar/%d", userID)
	}

	if s.cache != nil && s.cache.Client != nil {
		data, err := json.Marshal(stats)
		if err == nil {
			s.cache.Client.Set(ctx, cacheKey, data, 30*time.Second)
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
				{ID: "group_guardian", Progress: stats.GroupsManaged},
				{ID: "channel_commander", Progress: stats.ChannelsManaged},
				{ID: "empire_builder", Progress: stats.GroupsManaged + stats.ChannelsManaged},
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
	var totalEarned float64
	// FRG transactions completely removed.
	totalEarned = 0

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
	// 4) Issue rewards INSIDE tx via shared connection
	if rewardReferrer {
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
	}
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

func (s *ProfileService) AddTaps(ctx context.Context, userID int64, taps int, multiplier int) (*model.ProfileStats, error) {
	if taps <= 0 {
		return nil, fmt.Errorf("invalid tap count")
	}

	const maxTapsPerRequest = 500
	if taps > maxTapsPerRequest {
		return nil, fmt.Errorf("tap count exceeds maximum limit per request")
	}

	// Fetch current boost levels and current energy status from user_stats and user_boosts
	var multitapLevel, energyLimitLevel int
	var storedEnergy int
	var energyUpdatedAt time.Time

	err := s.db.Pool.QueryRow(ctx, `
		SELECT 
			COALESCE(b.multitap_level, 1), 
			COALESCE(b.energy_limit_level, 1),
			COALESCE(s.energy, 500),
			COALESCE(s.energy_updated_at, now())
		FROM user_stats s
		LEFT JOIN user_boosts b ON s.user_id = b.user_id
		WHERE s.user_id = $1
	`, userID).Scan(&multitapLevel, &energyLimitLevel, &storedEnergy, &energyUpdatedAt)
	if err != nil {
		multitapLevel = 1
		energyLimitLevel = 1
		storedEnergy = 500
		energyUpdatedAt = time.Now()
	}

	// Calculate regenerated energy since energy_updated_at
	maxEnergy := 500 + (energyLimitLevel-1)*250
	regen := int(time.Since(energyUpdatedAt).Seconds())
	currentEnergy := storedEnergy
	if regen > 0 {
		currentEnergy += regen
		if currentEnergy > maxEnergy {
			currentEnergy = maxEnergy
		}
	}

	// Calculate energy consumed by these taps
	energyConsumed := 0
	if multiplier != 5 { // multiplier = 5 represents Turbo boost where no energy is consumed
		energyConsumed = taps * multitapLevel
		if currentEnergy < energyConsumed {
			taps = currentEnergy / multitapLevel
			energyConsumed = taps * multitapLevel
			if taps <= 0 {
				return nil, fmt.Errorf("not enough energy")
			}
		}
	}

	// Save the decremented energy and update total taps in the database
	newEnergy := currentEnergy - energyConsumed
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE user_stats
		SET energy = $1,
		    energy_updated_at = now(),
		    last_active_at = now(),
		    total_taps = COALESCE(total_taps, 0) + $2
		WHERE user_id = $3
	`, newEnergy, taps, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to update energy: %w", err)
	}

	coinsEarned := float64(taps * multitapLevel * multiplier)
	redisFailed := false

	if s.cache != nil && s.cache.Client != nil {
		userIDStr := strconv.FormatInt(userID, 10)

		// Batch taps in Redis
		err := s.cache.Client.HIncrBy(ctx, "profile:taps:batch", userIDStr, int64(coinsEarned)).Err()
		if err != nil {
			slog.Error("Redis HIncrBy failed in AddTaps, falling back to DB", "user", userID, "err", err)
			redisFailed = true
		} else {
			// Invalidate local profile cache
			s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
		}
	}

	if s.cache == nil || s.cache.Client == nil || redisFailed {
		// Fallback to direct DB update if Redis is unavailable or failed (e.g. Upstash daily request limit exceeded)
		_, err = s.db.Pool.Exec(ctx, `
			UPDATE user_stats
			SET total_taps = COALESCE(total_taps, 0) + $1,
			    xp = COALESCE(xp, 0) + $2,
			    airdrop_coins = COALESCE(airdrop_coins, 0) + $3,
			    total_coins_earned = COALESCE(total_coins_earned, 0) + $3
			WHERE user_id = $4`,
			taps, int(coinsEarned), coinsEarned, userID,
		)
		if err != nil {
			slog.Error("Direct DB update fallback failed in AddTaps", "user", userID, "err", err)
		}
	}

	// Fetch updated stats to return to frontend
	stats, err := s.GetStats(ctx, userID)
	if err != nil {
		return nil, err
	}

	if s.cache != nil && s.cache.Client != nil && !redisFailed {
		stats.AirdropCoins += coinsEarned
		stats.XP += int(coinsEarned)
		stats.TotalTaps += taps
	}

	return stats, nil
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
			}
			if t2 > 0 {
				_, _ = s.db.AdjustAirdropCoins(bgCtx, t2, item.Cost*0.05)
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

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}
	return nil
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
		_, _ = pipe.Exec(ctx)
	}

	return nil
}
