package service

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"
	"strconv"
	"time"

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
				return &stats, nil
			}
		}
	}

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

	return stats, nil
}

func (s *ProfileService) GetAchievements(ctx context.Context, userID int64) ([]model.UserAchievement, error) {
	// Auto update achievements based on current stats before returning
	stats, err := s.GetStats(ctx, userID)
	if err == nil {
		_ = s.db.UpdateAchievementProgress(ctx, userID, "first_steps", 1)
		_ = s.db.UpdateAchievementProgress(ctx, userID, "tap_novice", stats.TotalTaps)
		_ = s.db.UpdateAchievementProgress(ctx, userID, "mining_machine", stats.TotalTaps)
		_ = s.db.UpdateAchievementProgress(ctx, userID, "first_scan", stats.UsernamesAnalyzed)
		_ = s.db.UpdateAchievementProgress(ctx, userID, "whale_hunter", stats.UsernamesAnalyzed)
		_ = s.db.UpdateAchievementProgress(ctx, userID, "data_scientist", stats.UsernamesAnalyzed)
		_ = s.db.UpdateAchievementProgress(ctx, userID, "group_guardian", stats.GroupsManaged)
		_ = s.db.UpdateAchievementProgress(ctx, userID, "channel_commander", stats.ChannelsManaged)
		_ = s.db.UpdateAchievementProgress(ctx, userID, "empire_builder", stats.GroupsManaged+stats.ChannelsManaged)
		_ = s.db.UpdateAchievementProgress(ctx, userID, "week_warrior", stats.DaysActive)
		_ = s.db.UpdateAchievementProgress(ctx, userID, "month_master", stats.DaysActive)
		_ = s.db.UpdateAchievementProgress(ctx, userID, "legendary", stats.DaysActive)
	}
	return s.db.GetAchievements(ctx, userID)
}

func (s *ProfileService) GetReferralData(ctx context.Context, userID int64) (*model.ReferralHubData, error) {
	return s.db.GetReferralData(ctx, userID)
}

func (s *ProfileService) SetReferralCode(ctx context.Context, userID int64, referrerCode string) error {
	// Register the referrer connection
	updated, err := s.db.SetReferredBy(ctx, userID, referrerCode)
	if err != nil {
		return err
	}
	if !updated {
		return fmt.Errorf("referral already set")
	}

	// Reward the referrer with 10,000 FRG tokens!
	var referrerID int64
	err = s.db.Pool.QueryRow(ctx, "SELECT telegram_id FROM users WHERE referral_code = $1", referrerCode).Scan(&referrerID)
	if err == nil {
		meta, _ := json.Marshal(map[string]interface{}{"referred_user_id": userID})
		_, _ = s.frgRepo.Credit(ctx, referrerID, 10000.0, "admin_credit", meta)
		if s.cache != nil && s.cache.Client != nil {
			s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", referrerID))
		}
	}

	// Reward the referred user with 5,000 FRG tokens as a welcome bonus!
	metaUser, _ := json.Marshal(map[string]interface{}{"referrer_code": referrerCode})
	_, _ = s.frgRepo.Credit(ctx, userID, 5000.0, "admin_credit", metaUser)
	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
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

	var lastActive time.Time
	err := s.db.Pool.QueryRow(ctx, "SELECT last_active_at FROM user_stats WHERE user_id = $1", userID).Scan(&lastActive)
	if err == nil {
		elapsed := time.Since(lastActive)
		if elapsed < 0 {
			elapsed = 0
		}
		minRequiredDuration := time.Duration(taps) * (time.Second / 15) - 200*time.Millisecond
		if elapsed < minRequiredDuration {
			return nil, fmt.Errorf("tapping rate too high (rate limit exceeded)")
		}
	}

	// Award XP (2 XP per tap)
	_, err = s.db.Pool.Exec(ctx, "UPDATE user_stats SET total_taps = total_taps + $1, xp = xp + $2, last_active_at = CURRENT_TIMESTAMP WHERE user_id = $3", taps, taps*2, userID)
	if err != nil {
		return nil, err
	}

	frgEarned := float64(taps) * 0.1
	meta, _ := json.Marshal(map[string]interface{}{"taps": taps})
	_, _ = s.frgRepo.Credit(ctx, userID, frgEarned, "admin_credit", meta)

	var xp, oldLevel int
	_ = s.db.Pool.QueryRow(ctx, "SELECT xp, level FROM user_stats WHERE user_id = $1", userID).Scan(&xp, &oldLevel)
	newLevel := repository.GetLevelFromXP(xp)
	if newLevel > oldLevel {
		_, _ = s.db.Pool.Exec(ctx, "UPDATE user_stats SET level = $1 WHERE user_id = $2", newLevel, userID)
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

	alreadyBought, err := s.db.HasCosmetic(ctx, userID, cosmeticID)
	if err != nil {
		return err
	}
	if alreadyBought {
		return fmt.Errorf("cosmetic already purchased")
	}

	meta, _ := json.Marshal(map[string]interface{}{"cosmetic_id": cosmeticID})
	_, err = s.frgRepo.Debit(ctx, userID, item.Cost, "cosmetic_purchase", meta)
	if err != nil {
		return err
	}

	err = s.db.RecordCosmeticPurchase(ctx, userID, cosmeticID)
	if err != nil {
		return err
	}

	// Referral revenue share (10% Tier 1, 2% Tier 2)
	t1, t2, refErr := s.db.GetReferralChain(ctx, userID)
	if refErr == nil {
		if t1 != 0 {
			metaT1, _ := json.Marshal(map[string]interface{}{"ref_type": "tier1", "from_user_id": userID, "cosmetic_id": cosmeticID})
			_, _ = s.frgRepo.Credit(ctx, t1, item.Cost*0.1, "referral_revenue", metaT1)
			if s.cache != nil && s.cache.Client != nil {
				s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", t1))
			}
		}
		if t2 != 0 {
			metaT2, _ := json.Marshal(map[string]interface{}{"ref_type": "tier2", "from_user_id": userID, "cosmetic_id": cosmeticID})
			_, _ = s.frgRepo.Credit(ctx, t2, item.Cost*0.02, "referral_revenue", metaT2)
			if s.cache != nil && s.cache.Client != nil {
				s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", t2))
			}
		}
	}

	if s.cache != nil && s.cache.Client != nil {
		s.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}
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

