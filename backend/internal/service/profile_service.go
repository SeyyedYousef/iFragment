package service

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

type ProfileService struct {
	db      *repository.Database
	frgRepo *repository.FRGRepo
	cache   *repository.Cache
}

func NewProfileService(db *repository.Database, cache *repository.Cache) *ProfileService {
	return &ProfileService{
		db:      db,
		frgRepo: repository.NewFRGRepo(db),
		cache:   cache,
	}
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

func (s *ProfileService) GetStats(ctx context.Context, userID int64) (*model.ProfileStats, error) {
	cacheKey := fmt.Sprintf("profile:stats:%d", userID)

	if s.cache != nil && s.cache.Client != nil {
		val, err := s.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var stats model.ProfileStats
			if json.Unmarshal([]byte(val), &stats) == nil {
				stats.GlobalRank = s.getGlobalRank(ctx, userID, stats.XP)
				stats.ServerNow = time.Now().UnixNano() / int64(time.Millisecond)
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
	return s.db.GetReferralData(ctx, userID)
}

func (s *ProfileService) SetReferralCode(ctx context.Context, userID int64, referrerCode string) error {
	var referrerID int64
	err := s.db.Pool.QueryRow(ctx, "SELECT telegram_id FROM users WHERE referral_code = $1", referrerCode).Scan(&referrerID)
	if err != nil {
		return fmt.Errorf("invalid referral code")
	}

	// 1) Prevent self-referral
	if referrerID == userID {
		return fmt.Errorf("cannot refer yourself")
	}

	// 2) Prevent circular referral A -> B -> A
	var referrerReferredBy *int64
	_ = s.db.Pool.QueryRow(ctx, "SELECT referred_by FROM users WHERE telegram_id = $1", referrerID).Scan(&referrerReferredBy)
	if referrerReferredBy != nil && *referrerReferredBy == userID {
		return fmt.Errorf("circular referral not allowed")
	}

	// Register the referrer connection
	updated, err := s.db.SetReferredBy(ctx, userID, referrerCode)
	if err != nil {
		return err
	}
	if !updated {
		return fmt.Errorf("referral already set")
	}

	// Reward the referrer with 10,000 FRG tokens!
	meta, _ := json.Marshal(map[string]interface{}{"referred_user_id": userID})

		// Enforce caps on referral rewards
		const (
			MaxReferralRewardPerDay = 50000.0
			MaxReferralRewardTotal  = 500000.0
		)

		var totalReferralEarned float64
		sumQuery := `SELECT COALESCE(SUM(amount), 0) FROM frg_transactions WHERE user_id = $1 AND type = 'admin_credit' AND metadata->>'referred_user_id' IS NOT NULL`
		_ = s.db.Pool.QueryRow(ctx, sumQuery, referrerID).Scan(&totalReferralEarned)

		if totalReferralEarned < MaxReferralRewardTotal {
			allowed := true
			if s.cache != nil && s.cache.Client != nil {
				todayKey := fmt.Sprintf("referral:daily:%d:%s", referrerID, time.Now().Format("2006-01-02"))
				dailyTotal, errIncr := s.cache.Client.IncrByFloat(ctx, todayKey, 10000.0).Result()
				if errIncr == nil {
					s.cache.Client.Expire(ctx, todayKey, 24*time.Hour)
					if dailyTotal > MaxReferralRewardPerDay {
						allowed = false
					}
				}
			}
			if allowed {
				_, _ = s.frgRepo.Credit(ctx, referrerID, 10000.0, "admin_credit", meta)
			}
		}

	// Reward the referred user with 5,000 FRG tokens as a welcome bonus!
	metaUser, _ := json.Marshal(map[string]interface{}{"referrer_code": referrerCode})
	_, _ = s.frgRepo.Credit(ctx, userID, 5000.0, "admin_credit", metaUser)

	if s.cache != nil && s.cache.Client != nil {
		pipe := s.cache.Client.Pipeline()
		pipe.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
		if err == nil {
			pipe.Del(ctx, fmt.Sprintf("profile:stats:%d", referrerID))
		}
		_, _ = pipe.Exec(ctx)
	}

	return nil
}

func (s *ProfileService) AddTaps(ctx context.Context, userID int64, taps int) (*model.ProfileStats, error) {
	if taps <= 0 {
		return nil, fmt.Errorf("invalid tap count")
	}

	const maxTapsPerRequest = 200
	if taps > maxTapsPerRequest {
		return nil, fmt.Errorf("tap count exceeds maximum limit per request")
	}

	if err := s.db.EnsureStatsExists(ctx, userID); err != nil {
		return nil, err
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Lock user's stats row + read energy, energy_updated_at, multitap, energy limit level
	var energy, multitapLevel, energyLimitLevel int
	var energyUpdatedAt time.Time
	err = tx.QueryRow(ctx, `
		SELECT us.energy, us.energy_updated_at,
		       COALESCE(b.multitap_level, 1), COALESCE(b.energy_limit_level, 1)
		FROM user_stats us
		LEFT JOIN user_boosts b ON b.user_id = us.user_id
		WHERE us.user_id = $1
		FOR UPDATE OF us`, userID).
		Scan(&energy, &energyUpdatedAt, &multitapLevel, &energyLimitLevel)
	if err != nil {
		return nil, fmt.Errorf("failed to lock user energy: %w", err)
	}

	// Server-side source of truth for maximum energy capacity & recovery
	maxEnergy := 500 + (energyLimitLevel-1)*250
	const recoveryPerSec = 1
	regen := int(time.Since(energyUpdatedAt).Seconds()) * recoveryPerSec
	if regen > 0 {
		energy = min(maxEnergy, energy+regen)
	}

	// Dynamic energy verification prevents infinite tap farming
	if taps > energy {
		taps = energy // only accept taps up to available energy
	}
	if taps <= 0 {
		return nil, fmt.Errorf("not enough energy")
	}

	coinsEarned := float64(taps) * float64(multitapLevel)
	newEnergy := energy - taps

	_, err = tx.Exec(ctx, `
		UPDATE user_stats
		SET total_taps = total_taps + $1,
		    xp = xp + $2,
		    airdrop_coins = airdrop_coins + $3,
		    energy = $4,
		    energy_updated_at = now(),
		    last_active_at = now()
		WHERE user_id = $5`,
		taps, taps*2, coinsEarned, newEnergy, userID,
	)
	if err != nil {
		return nil, err
	}

	// Retrieve updated XP and Level inside same transaction to prevent read-modify-write lost update
	var xp, oldLevel int
	err = tx.QueryRow(ctx, "SELECT xp, level FROM user_stats WHERE user_id = $1 FOR UPDATE", userID).Scan(&xp, &oldLevel)
	if err != nil {
		return nil, err
	}
	newLevel := repository.GetLevelFromXP(xp)
	if newLevel > oldLevel {
		_, err = tx.Exec(ctx, "UPDATE user_stats SET level = $1 WHERE user_id = $2", newLevel, userID)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.ZAdd(ctx, "leaderboard", redis.Z{
			Score:  float64(xp),
			Member: strconv.FormatInt(userID, 10),
		})
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	return s.GetStats(ctx, userID)
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
		`SELECT balance FROM frg_balances WHERE user_id = $1 FOR UPDATE`,
		userID,
	).Scan(&balance)
	if err == pgx.ErrNoRows {
		return fmt.Errorf("insufficient FRG balance: need %.4f, have 0", item.Cost)
	} else if err != nil {
		return err
	}

	if balance < item.Cost {
		return fmt.Errorf("insufficient FRG balance: have %.4f, need %.4f", balance, item.Cost)
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

	// 3. Debit
	_, err = tx.Exec(ctx,
		`UPDATE frg_balances SET balance = balance - $1, total_spent = total_spent + $1,
		 updated_at = now() WHERE user_id = $2`,
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
	meta, _ := json.Marshal(map[string]interface{}{"cosmetic_id": cosmeticID})
	_, err = tx.Exec(ctx,
		`INSERT INTO frg_transactions (user_id, type, amount, balance_before, balance_after, metadata)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		userID, "cosmetic_purchase", -item.Cost, balance, balance-item.Cost, meta,
	)
	if err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// Referral revenue share (outside critical tx, async-safe)
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		t1, t2, refErr := s.db.GetReferralChain(bgCtx, userID)
		if refErr == nil {
			if t1 != 0 {
				metaT1, _ := json.Marshal(map[string]interface{}{"ref_type": "tier1", "from_user_id": userID, "cosmetic_id": cosmeticID})
				_, _ = s.frgRepo.Credit(bgCtx, t1, item.Cost*0.1, "referral_revenue", metaT1)
			}
			if t2 != 0 {
				metaT2, _ := json.Marshal(map[string]interface{}{"ref_type": "tier2", "from_user_id": userID, "cosmetic_id": cosmeticID})
				_, _ = s.frgRepo.Credit(bgCtx, t2, item.Cost*0.02, "referral_revenue", metaT2)
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
	if cosmeticID != "" {
		has, err := s.db.HasCosmetic(ctx, userID, cosmeticID)
		if err != nil {
			return err
		}
		if !has {
			return fmt.Errorf("cosmetic not owned")
		}
	}

	err := s.db.EquipCosmetic(ctx, userID, cosmeticID, cosmeticType)
	if err != nil {
		return err
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}
	return nil
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
		{"user_bans", "user_id"},
		{"frg_transactions", "user_id"},
		{"frg_balances", "user_id"},
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

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

