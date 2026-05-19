package service

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/repository"
)

type ProfileService struct {
	db      *repository.Database
	frgRepo *repository.FRGRepo
}

func NewProfileService(db *repository.Database) *ProfileService {
	return &ProfileService{
		db:      db,
		frgRepo: repository.NewFRGRepo(db),
	}
}

func (s *ProfileService) GetStats(ctx context.Context, userID int64) (*repository.ProfileStats, error) {
	return s.db.GetProfileStats(ctx, userID)
}

func (s *ProfileService) GetAchievements(ctx context.Context, userID int64) ([]repository.UserAchievement, error) {
	// Auto update achievements based on current stats before returning
	stats, err := s.db.GetProfileStats(ctx, userID)
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

func (s *ProfileService) GetReferralData(ctx context.Context, userID int64) (*repository.ReferralHubData, error) {
	return s.db.GetReferralData(ctx, userID)
}

func (s *ProfileService) SetReferralCode(ctx context.Context, userID int64, referrerCode string) error {
	// Register the referrer connection
	err := s.db.SetReferredBy(ctx, userID, referrerCode)
	if err != nil {
		return err
	}

	// Reward the referrer with 10,000 FRG tokens!
	var referrerID int64
	err = s.db.Pool.QueryRow(ctx, "SELECT telegram_id FROM users WHERE referral_code = $1", referrerCode).Scan(&referrerID)
	if err == nil {
		meta, _ := json.Marshal(map[string]interface{}{"referred_user_id": userID})
		_, _ = s.frgRepo.Credit(ctx, referrerID, 10000.0, "admin_credit", meta)
	}

	// Reward the referred user with 5,000 FRG tokens as a welcome bonus!
	metaUser, _ := json.Marshal(map[string]interface{}{"referrer_code": referrerCode})
	_, _ = s.frgRepo.Credit(ctx, userID, 5000.0, "admin_credit", metaUser)

	return nil
}

func (s *ProfileService) AddTaps(ctx context.Context, userID int64, taps int) (*repository.ProfileStats, error) {
	if taps <= 0 {
		return nil, fmt.Errorf("invalid tap count")
	}

	if err := s.db.EnsureStatsExists(ctx, userID); err != nil {
		return nil, err
	}

	// Award XP (2 XP per tap)
	_, err := s.db.Pool.Exec(ctx, "UPDATE user_stats SET total_taps = total_taps + $1, xp = xp + $2 WHERE user_id = $3", taps, taps*2, userID)
	if err != nil {
		return nil, err
	}

	// Award FRG for taps (0.1 FRG per tap)
	frgEarned := float64(taps) * 0.1
	meta, _ := json.Marshal(map[string]interface{}{"taps": taps})
	_, _ = s.frgRepo.Credit(ctx, userID, frgEarned, "admin_credit", meta)

	// Level up calculation
	var xp, level int
	_ = s.db.Pool.QueryRow(ctx, "SELECT xp, level FROM user_stats WHERE user_id = $1", userID).Scan(&xp, &level)
	nextLevelXP := level * 3000
	if xp >= nextLevelXP {
		level++
		_, _ = s.db.Pool.Exec(ctx, "UPDATE user_stats SET level = $1 WHERE user_id = $2", level, userID)
	}

	return s.db.GetProfileStats(ctx, userID)
}
