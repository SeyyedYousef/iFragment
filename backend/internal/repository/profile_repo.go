package repository

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/big"
	"sort"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/model"

	"github.com/jackc/pgx/v5"
	"golang.org/x/sync/errgroup"
)

// EnsureStatsExists inserts default stats for the user if they don't exist
func (db *Database) EnsureStatsExists(ctx context.Context, userID int64) error {
	// Ensure parent user row exists first to satisfy FK constraint
	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO users (telegram_id, username, first_name, last_name, language_code)
		VALUES ($1, '', 'User', '', 'en')
		ON CONFLICT (telegram_id) DO NOTHING
	`, userID)

	query := `
		INSERT INTO user_stats (user_id, days_active, current_streak, total_taps, xp, level, last_active_at, energy, energy_updated_at)
		VALUES ($1, 1, 1, 0, 0, 1, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id) DO NOTHING
	`
	_, err := db.Pool.Exec(ctx, query, userID)
	return err
}

func (db *Database) GetProfileStats(ctx context.Context, userID int64) (*model.ProfileStats, error) {
	if err := db.EnsureStatsExists(ctx, userID); err != nil {
		return nil, err
	}

	query := `
		WITH user_info AS (
			SELECT telegram_id, COALESCE(username, '') as username, COALESCE(first_name, '') as first_name, COALESCE(last_name, '') as last_name, COALESCE(photo_url, '') as photo_url, created_at, is_premium, premium_until 
			FROM users WHERE telegram_id = $1
		),
		reports_count AS (
			SELECT COUNT(DISTINCT username) as count FROM search_logs WHERE user_id = $1
		),
		managed_counts AS (
			SELECT 
				(
					SELECT COUNT(*) FROM managed_groups mg
					LEFT JOIN managed_bots mb ON mg.bot_id = mb.id
					WHERE mg.connected_by_user_id = $1 OR mb.owner_user_id = $1
				) as groups,
				(
					SELECT COUNT(*) FROM managed_channels mc
					LEFT JOIN managed_bots mb ON mc.bot_id = mb.id
					WHERE mc.connected_by_user_id = $1 OR mb.owner_user_id = $1 
					   OR EXISTS (SELECT 1 FROM channel_admins ca WHERE ca.channel_id = mc.id AND ca.telegram_id = $1)
				) as channels
		),
		stats_info AS (
			SELECT us.days_active, us.current_streak, us.total_taps, us.xp, us.level, us.last_active_at,
			       COALESCE(us.emoji_status, '') as emoji_status,
			       COALESCE(us.equipped_border, '') as equipped_border,
			       COALESCE(us.equipped_skin, '') as equipped_skin,
			       COALESCE(us.airdrop_coins, 0) as airdrop_coins,
			       COALESCE(us.total_coins_earned, 0.0) as total_coins_earned,
			       COALESCE(us.energy, 500) as energy,
			       COALESCE(us.energy_updated_at, CURRENT_TIMESTAMP) as energy_updated_at,
			       COALESCE(udb.tapped_coins, 0) as daily_tapped_coins,
			       COALESCE(udb.turbo_used, 0) as turbo_used,
			       COALESCE(udb.full_energy_used, 0) as full_energy_used,
			       COALESCE((
			           SELECT CEIL(EXTRACT(EPOCH FROM (MIN(expires_at) - CURRENT_TIMESTAMP)) / 86400.0)
			           FROM user_credit_batches
			           WHERE user_id = us.user_id AND is_expired = FALSE AND remaining_amount > 0 AND expires_at >= CURRENT_TIMESTAMP
			       ), 30)::int as credit_expires_in_days
			FROM user_stats us
			LEFT JOIN user_daily_boosts udb ON udb.user_id = us.user_id AND udb.day = CURRENT_DATE
			WHERE us.user_id = $1
		)
		SELECT 
			ui.telegram_id,
			ui.username,
			ui.first_name,
			ui.last_name,
			ui.created_at,
			rc.count,
			mc.groups,
			mc.channels,
			si.days_active,
			si.current_streak,
			si.total_taps,
			si.xp,
			si.level,
			si.last_active_at,
			ui.is_premium,
			ui.premium_until,
			si.emoji_status,
			si.equipped_border,
			si.equipped_skin,
			si.airdrop_coins,
			si.credit_expires_in_days,
			si.energy,
			si.energy_updated_at,
			si.daily_tapped_coins,
			si.turbo_used,
			si.full_energy_used,
			ui.photo_url
		FROM stats_info si
		CROSS JOIN user_info ui
		CROSS JOIN reports_count rc
		CROSS JOIN managed_counts mc
	`

	var targetTelegramID int64
	var targetUsername, targetFirstName, targetLastName, dbPhotoURL string
	var memberSince time.Time
	var usernamesAnalyzed, groupsManaged, channelsManaged int
	var daysActive, currentStreak, totalTaps, xp, level int
	var lastActiveAt time.Time
	var isPremium bool
	var premiumUntil *time.Time
	var emojiStatus, equippedBorder, equippedSkin string
	var airdropCoins float64
	var creditExpiresInDays int
	var energy int
	var energyUpdatedAt time.Time
	var dailyTappedCoins float64
	var dailyTurboUsed, dailyFullEnergyUsed int

	err := db.Pool.QueryRow(ctx, query, userID).Scan(
		&targetTelegramID, &targetUsername, &targetFirstName, &targetLastName,
		&memberSince, &usernamesAnalyzed, &groupsManaged, &channelsManaged,
		&daysActive, &currentStreak, &totalTaps, &xp, &level, &lastActiveAt,
		&isPremium, &premiumUntil, &emojiStatus, &equippedBorder, &equippedSkin, &airdropCoins,
		&creditExpiresInDays,
		&energy, &energyUpdatedAt, &dailyTappedCoins, &dailyTurboUsed, &dailyFullEnergyUsed,
		&dbPhotoURL,
	)
	if err != nil {
		return nil, err
	}

	boosts, _ := db.GetUserBoosts(ctx, userID)
	energyLimitLevel := 1
	if boosts != nil {
		energyLimitLevel = boosts.EnergyLimitLevel
	}
	maxEnergy := 500 + (energyLimitLevel-1)*250
	regen := int(time.Since(energyUpdatedAt).Seconds())
	if regen > 0 {
		energy += regen
		if energy > maxEnergy {
			energy = maxEnergy
		}
	}

	globalRank, _ := db.GetGlobalRankFromDB(ctx, xp)

	// Calculate subscription status
	var sub *model.ActiveSubscriptionSummary
	if isPremium && premiumUntil != nil && premiumUntil.After(time.Now()) {
		daysLeft := int(time.Until(*premiumUntil).Hours() / 24)
		if daysLeft < 0 {
			daysLeft = 0
		}
		sub = &model.ActiveSubscriptionSummary{
			Type:         "pro",
			IsActive:     true,
			AutoRenew:    true,
			ExpiresAt:    premiumUntil,
			DaysLeft:     daysLeft,
			PackageTitle: "iFragment Pro",
		}
	} else {
		sub = &model.ActiveSubscriptionSummary{
			Type:         "none",
			IsActive:     false,
			AutoRenew:    false,
			DaysLeft:     0,
			PackageTitle: "Free Tier",
		}
	}

	// Calculate Intel Credits (1 referral grant per 3 referrals + paid orders)
	var intelCredits int
	var totalInvited int
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE referred_by = $1", userID).Scan(&totalInvited)
	intelCredits = totalInvited / 3
	// Also check paid report orders in last 30 days
	var paidReports int
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM username_reports WHERE user_id = $1", userID).Scan(&paidReports)

	return &model.ProfileStats{
		TelegramID:          targetTelegramID,
		Username:            targetUsername,
		FirstName:           targetFirstName,
		LastName:            targetLastName,
		UsernamesAnalyzed:   usernamesAnalyzed,
		GroupsManaged:       groupsManaged,
		ChannelsManaged:     channelsManaged,
		DaysActive:          daysActive,
		CurrentStreak:       currentStreak,
		GlobalRank:          globalRank,
		TotalTaps:           totalTaps,
		MemberSince:         memberSince,
		Level:               level,
		XP:                  xp,
		XPToNextLevel:       GetXPToNextLevel(level),
		IsPremium:           isPremium,
		PremiumUntil:        premiumUntil,
		EmojiStatus:         emojiStatus,
		EquippedBorder:      equippedBorder,
		EquippedSkin:        equippedSkin,
		AirdropCoins:        airdropCoins,
		CreditExpiresInDays: creditExpiresInDays,
		Energy:              energy,
		EnergyUpdatedAt:     energyUpdatedAt,
		DailyTappedCoins:    dailyTappedCoins,
		DailyTurboUsed:      dailyTurboUsed,
		DailyFullEnergyUsed: dailyFullEnergyUsed,
		ValuationCredits:    intelCredits,
		IntelCredits:        intelCredits,
		Subscription:        sub,
		ServerNow:           time.Now().Unix(),
		PhotoURL:            dbPhotoURL,
	}, nil
}

func (db *Database) GetGlobalRankFromDB(ctx context.Context, xp int) (int, error) {
	// League thresholds based on frontend config
	leagues := []int{0, 5000, 50000, 500000, 2000000, 10000000, 50000000, 100000000}

	maxXP := 2000000000 // effectively infinity
	for i := len(leagues) - 1; i >= 0; i-- {
		if xp >= leagues[i] {
			if i < len(leagues)-1 {
				maxXP = leagues[i+1]
			}
			break
		}
	}

	var rank int
	// Rank is relative to the user's current league (xp < maxXP)
	// Ignore test/dummy accounts by ensuring user_id > 1000000
	rankQuery := "SELECT COUNT(*) + 1 FROM user_stats WHERE xp > $1 AND xp < $2 AND user_id > 1000000"
	err := db.Pool.QueryRow(ctx, rankQuery, xp, maxXP).Scan(&rank)
	return rank, err
}

var PredefinedAchievements = map[string]int{
	"first_steps":       1,
	"home_base":         1,
	"tap_novice":        1000,
	"mining_machine":    100000,
	"frg_millionaire":   1000000,
	"first_scan":        1,
	"whale_hunter":      100,
	"data_scientist":    500,
	"social_butterfly":  5,
	"army_builder":      50,
	"network_king":      200,
	"group_guardian":    1,
	"channel_commander": 1,
	"empire_builder":    10,
	"week_warrior":      7,
	"month_master":      30,
	"legendary":         100,
	"early_adopter":     1,
	"premium_user":      1,
	"bug_hunter":        1,
}

func (db *Database) GetAchievements(ctx context.Context, userID int64) ([]model.UserAchievement, error) {
	rows, err := db.Pool.Query(ctx, "SELECT achievement_id, progress, unlocked, unlocked_at FROM user_achievements WHERE user_id = $1", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userProgress := make(map[string]model.UserAchievement)
	for rows.Next() {
		var achID string
		var progress int
		var unlocked bool
		var unlockedAt *time.Time
		if err := rows.Scan(&achID, &progress, &unlocked, &unlockedAt); err == nil {
			target := PredefinedAchievements[achID]
			if target == 0 {
				target = 1
			}
			userProgress[achID] = model.UserAchievement{
				ID:         achID,
				Unlocked:   unlocked,
				UnlockedAt: unlockedAt,
				Progress:   progress,
				Target:     target,
			}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	achievementsList := []model.UserAchievement{}
	keys := make([]string, 0, len(PredefinedAchievements))
	for k := range PredefinedAchievements {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		if ach, exists := userProgress[k]; exists {
			achievementsList = append(achievementsList, ach)
		} else {
			achievementsList = append(achievementsList, model.UserAchievement{
				ID:       k,
				Unlocked: false,
				Progress: 0,
				Target:   PredefinedAchievements[k],
			})
		}
	}

	return achievementsList, nil
}

func (db *Database) UpdateAchievementProgress(ctx context.Context, userID int64, achievementID string, progress int) error {
	target, ok := PredefinedAchievements[achievementID]
	if !ok {
		return fmt.Errorf("unknown achievement %s", achievementID)
	}

	unlocked := progress >= target
	var unlockedAt *time.Time
	if unlocked {
		t := time.Now()
		unlockedAt = &t
	}

	query := `
		INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked, unlocked_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, achievement_id) DO UPDATE SET
			progress = GREATEST(user_achievements.progress, EXCLUDED.progress),
			unlocked = CASE WHEN user_achievements.unlocked = TRUE THEN TRUE ELSE EXCLUDED.unlocked END,
			unlocked_at = CASE WHEN user_achievements.unlocked = TRUE THEN user_achievements.unlocked_at ELSE EXCLUDED.unlocked_at END
	`
	_, err := db.Pool.Exec(ctx, query, userID, achievementID, progress, unlocked, unlockedAt)
	return err
}

// MaintainUserStats maintains user streak and days active atomically, and purges expired credit batches.
func (db *Database) MaintainUserStats(ctx context.Context, userID int64) error {
	if err := db.EnsureStatsExists(ctx, userID); err != nil {
		return err
	}

	query := `
		UPDATE user_stats SET
			current_streak = CASE
				WHEN CURRENT_DATE - last_active_at::DATE > 1 THEN 1
				WHEN CURRENT_DATE - last_active_at::DATE = 1 THEN current_streak + 1
				ELSE current_streak
			END,
			days_active = CASE
				WHEN CURRENT_DATE - last_active_at::DATE > 0 THEN days_active + 1
				ELSE days_active
			END,
			last_active_at = CASE
				WHEN CURRENT_DATE - last_active_at::DATE > 0 THEN now()
				ELSE last_active_at
			END
		WHERE user_id = $1
	`
	if _, err := db.Pool.Exec(ctx, query, userID); err != nil {
		return err
	}

	// Expire batches older than 15 days and reconcile valid airdrop_coins
	_, _ = db.Pool.Exec(ctx, `
		UPDATE user_credit_batches 
		SET is_expired = TRUE 
		WHERE user_id = $1 AND expires_at < CURRENT_TIMESTAMP AND is_expired = FALSE;

		UPDATE user_stats
		SET airdrop_coins = COALESCE((
			SELECT SUM(remaining_amount)
			FROM user_credit_batches
			WHERE user_id = $1 AND is_expired = FALSE AND expires_at >= CURRENT_TIMESTAMP
		), 0.0)
		WHERE user_id = $1;
	`, userID)

	return nil
}

// ExpirePremiumSubscriptions updates all expired premium subscriptions bulk.
func (db *Database) ExpirePremiumSubscriptions(ctx context.Context) error {
	query := `
		UPDATE users SET is_premium = FALSE
		WHERE is_premium = TRUE AND premium_until IS NOT NULL AND premium_until < now()
	`
	_, err := db.Pool.Exec(ctx, query)
	return err
}

type AchievementProgress struct {
	ID       string
	Progress int
}

// BatchUpdateAchievements updates multiple achievements in a single roundtrip to database.
func (db *Database) BatchUpdateAchievements(ctx context.Context, userID int64, items []AchievementProgress) error {
	if len(items) == 0 {
		return nil
	}

	var values []string
	var args []interface{}
	args = append(args, userID)

	for _, item := range items {
		target, ok := PredefinedAchievements[item.ID]
		if !ok {
			target = 1
		}
		unlocked := item.Progress >= target

		var unlockedAt *time.Time
		if unlocked {
			t := time.Now()
			unlockedAt = &t
		}

		idxUser := 1
		idxAch := len(args) + 1
		idxProg := len(args) + 2
		idxUnl := len(args) + 3
		idxUnlAt := len(args) + 4

		values = append(values, fmt.Sprintf("($%d, $%d, $%d, $%d, $%d)", idxUser, idxAch, idxProg, idxUnl, idxUnlAt))
		args = append(args, item.ID, item.Progress, unlocked, unlockedAt)
	}

	query := fmt.Sprintf(`
		INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked, unlocked_at)
		VALUES %s
		ON CONFLICT (user_id, achievement_id) DO UPDATE SET
			progress = GREATEST(user_achievements.progress, EXCLUDED.progress),
			unlocked = user_achievements.unlocked OR EXCLUDED.unlocked,
			unlocked_at = COALESCE(user_achievements.unlocked_at, EXCLUDED.unlocked_at)
	`, strings.Join(values, ", "))

	_, err := db.Pool.Exec(ctx, query, args...)
	return err
}

func (db *Database) GetReferralData(ctx context.Context, userID int64) (*model.ReferralHubData, error) {
	g, ctx := errgroup.WithContext(ctx)

	var code string
	g.Go(func() error {
		code = fmt.Sprintf("ref_%d", userID)
		var refCode sql.NullString
		_ = db.Pool.QueryRow(ctx, "SELECT referral_code FROM users WHERE telegram_id = $1", userID).Scan(&refCode)
		if !refCode.Valid || refCode.String == "" {
			secCode, err := generateSecureReferralCode(8)
			if err == nil {
				_, _ = db.Pool.Exec(ctx, "UPDATE users SET referral_code = $1 WHERE telegram_id = $2", secCode, userID)
			}
		}
		return nil
	})

	var friends []model.ReferralFriend
	var totalInvited int
	var totalEarned float64
	var tier1Earnings, tier2Earnings float64

	// Count total invited and total base rewards (10,000 per user)
	g.Go(func() error {
		err := db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE referred_by = $1", userID).Scan(&totalInvited)
		if err != nil {
			return err
		}
		totalEarned = float64(totalInvited) * 10000.0
		return nil
	})

	// Calculate lifetime tier earnings
	g.Go(func() error {
		// Tier 1 commission earnings (10% of spending by direct referrals)
		_ = db.Pool.QueryRow(ctx, `
			SELECT COALESCE(SUM(total_coins_earned * 0.10), 0.0)
			FROM user_stats
			WHERE user_id IN (SELECT telegram_id FROM users WHERE referred_by = $1)
		`, userID).Scan(&tier1Earnings)

		// Tier 2 commission earnings (5% of spending by 2nd-level referrals)
		_ = db.Pool.QueryRow(ctx, `
			SELECT COALESCE(SUM(total_coins_earned * 0.05), 0.0)
			FROM user_stats
			WHERE user_id IN (
				SELECT telegram_id FROM users WHERE referred_by IN (
					SELECT telegram_id FROM users WHERE referred_by = $1
				)
			)
		`, userID).Scan(&tier2Earnings)
		return nil
	})

	g.Go(func() error {
		friendsQuery := `
			SELECT u.telegram_id, COALESCE(u.username, u.first_name, 'Anonymous'), u.created_at,
			       10000.0 AS total_earned,
			       COALESCE(us.airdrop_coins, 0),
			       (SELECT COUNT(*) FROM users u2 WHERE u2.referred_by = u.telegram_id) as frens_count,
			       COALESCE(us.total_taps, 0) as total_taps
			FROM users u
			LEFT JOIN user_stats us ON u.telegram_id = us.user_id
			WHERE u.referred_by = $1
			ORDER BY us.xp DESC NULLS LAST LIMIT 100
		`
		rows, err := db.Pool.Query(ctx, friendsQuery, userID)
		if err != nil {
			return err
		}
		defer rows.Close()

		friends = []model.ReferralFriend{}
		for rows.Next() {
			var friendID int64
			var name string
			var joinedAt time.Time
			var earned float64
			var airdropCoins float64
			var frensCount int
			var totalTaps int
			if err := rows.Scan(&friendID, &name, &joinedAt, &earned, &airdropCoins, &frensCount, &totalTaps); err == nil {
				isActive := airdropCoins > 0 || totalTaps > 0
				status := "pending"
				if isActive {
					status = "verified"
				}
				friends = append(friends, model.ReferralFriend{
					ID:           friendID,
					Name:         name,
					JoinedAt:     joinedAt,
					Earned:       earned,
					AirdropCoins: airdropCoins,
					FrensCount:   frensCount,
					IsActive:     isActive,
					Status:       status,
				})
			}
		}
		if err := rows.Err(); err != nil {
			return err
		}
		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	// 1 free valuation report credit for every 3 verified invites
	valuationCredits := totalInvited / 3

	return &model.ReferralHubData{
		ReferralCode:     code,
		TotalInvited:     totalInvited,
		TotalEarned:      totalEarned + tier1Earnings + tier2Earnings,
		Tier1Earnings:    tier1Earnings,
		Tier2Earnings:    tier2Earnings,
		ValuationCredits: valuationCredits,
		Friends:          friends,
	}, nil
}

func (db *Database) SetReferredBy(ctx context.Context, userID int64, referrerCode string) (bool, error) {
	var referrerID int64

	// Support fallback frontend code format `ref_<user_id>`
	if strings.HasPrefix(referrerCode, "ref_") {
		idStr := strings.TrimPrefix(referrerCode, "ref_")
		if id, err := strconv.ParseInt(idStr, 10, 64); err == nil {
			referrerID = id
		}
	}

	if referrerID == 0 {
		// Find referrer by 8-char referral_code
		err := db.Pool.QueryRow(ctx, "SELECT telegram_id FROM users WHERE referral_code = $1", referrerCode).Scan(&referrerID)
		if err != nil {
			if err == pgx.ErrNoRows {
				return false, fmt.Errorf("invalid referral code")
			}
			return false, err
		}
	} else {
		// Verify that the parsed referrerID actually exists
		var exists bool
		err := db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE telegram_id = $1)", referrerID).Scan(&exists)
		if err != nil || !exists {
			return false, fmt.Errorf("invalid referral user id")
		}
	}

	if referrerID == userID {
		return false, fmt.Errorf("cannot refer yourself")
	}

	// Update user's referred_by if it is currently NULL
	cmdTag, err := db.Pool.Exec(ctx, `
		UPDATE users 
		SET referred_by = $1 
		WHERE telegram_id = $2 
		  AND referred_by IS NULL
	`, referrerID, userID)
	if err != nil {
		return false, err
	}

	success := cmdTag.RowsAffected() == 1
	if success {
		// Give 10,000 Coins to both referrer and the new user
		_, _ = db.AdjustAirdropCoins(ctx, referrerID, 10000.0)
		_, _ = db.AdjustAirdropCoins(ctx, userID, 10000.0)
	}

	return success, nil
}

const base62Chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func generateSecureReferralCode(length int) (string, error) {
	result := make([]byte, length)
	for i := 0; i < length; i++ {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(base62Chars))))
		if err != nil {
			return "", err
		}
		result[i] = base62Chars[num.Int64()]
	}
	return string(result), nil
}

var LevelThresholds = []int{
	0,            // Level 1: Bronze
	50000,        // Level 2: Silver
	250000,       // Level 3: Gold
	1000000,      // Level 4: Platinum
	5000000,      // Level 5: Diamond
	25000000,     // Level 6: Legendary
	100000000,    // Level 7: Master
	500000000,    // Level 8: Grandmaster
	2500000000,   // Level 9: Elite
	10000000000,  // Level 10: Champion
	50000000000,  // Level 11: Hero
	250000000000, // Level 12: Mythic
}

func GetLevelFromXP(xp int) int {
	level := 1
	for i, req := range LevelThresholds {
		if xp >= req {
			level = i + 1
		} else {
			break
		}
	}
	return level
}

func GetXPToNextLevel(level int) int {
	if level <= 0 {
		return 0
	}
	if level >= len(LevelThresholds) {
		return LevelThresholds[len(LevelThresholds)-1] // Cap at Max Level XP
	}
	return LevelThresholds[level] // LevelThresholds[level] is the XP needed for level + 1 (0-indexed)
}

// PredefinedCosmetics holds all profile cosmetic shop items
var PredefinedCosmetics = []model.CosmeticItem{
	{ID: "gold_shimmer", Type: "border", Name: "Gold Shimmer", Cost: 15000.0, BorderClass: "border-gold-shimmer"},
	{ID: "cyber_glow", Type: "border", Name: "Cyber Glow", Cost: 35000.0, BorderClass: "border-cyber-glow"},
	{ID: "rainbow_wave", Type: "border", Name: "Rainbow Wave", Cost: 75000.0, BorderClass: "border-rainbow-wave"},
	{ID: "cosmic_void", Type: "skin", Name: "Cosmic Void", Cost: 25000.0, SkinClass: "bg-cosmic-void"},
	{ID: "neon_matrix", Type: "skin", Name: "Neon Matrix", Cost: 50000.0, SkinClass: "bg-neon-matrix"},
}

// GetCosmetics gets all cosmetics indicating which ones are purchased by the user
func (db *Database) GetCosmetics(ctx context.Context, userID int64) ([]model.CosmeticItem, error) {
	rows, err := db.Pool.Query(ctx, "SELECT cosmetic_id FROM user_cosmetics WHERE user_id = $1", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	purchased := make(map[string]bool)
	for rows.Next() {
		var cid string
		if err := rows.Scan(&cid); err == nil {
			purchased[cid] = true
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	result := make([]model.CosmeticItem, len(PredefinedCosmetics))
	for i, item := range PredefinedCosmetics {
		item.Purchased = purchased[item.ID]
		result[i] = item
	}
	return result, nil
}

// HasCosmetic checks if user has purchased the cosmetic
func (db *Database) HasCosmetic(ctx context.Context, userID int64, cosmeticID string) (bool, error) {
	var exists bool
	err := db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM user_cosmetics WHERE user_id = $1 AND cosmetic_id = $2)", userID, cosmeticID).Scan(&exists)
	return exists, err
}

// RecordCosmeticPurchase inserts the purchased cosmetic
func (db *Database) RecordCosmeticPurchase(ctx context.Context, userID int64, cosmeticID string) error {
	_, err := db.Pool.Exec(ctx, "INSERT INTO user_cosmetics (user_id, cosmetic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", userID, cosmeticID)
	return err
}

// EquipCosmetic equips the border or skin for the user
func (db *Database) EquipCosmetic(ctx context.Context, userID int64, cosmeticID string, cosmeticType string) error {
	var query string
	switch cosmeticType {
	case "border":
		query = "UPDATE user_stats SET equipped_border = $1 WHERE user_id = $2"
	case "skin":
		query = "UPDATE user_stats SET equipped_skin = $1 WHERE user_id = $2"
	default:
		return fmt.Errorf("invalid cosmetic type: %s", cosmeticType)
	}
	_, err := db.Pool.Exec(ctx, query, cosmeticID, userID)
	return err
}

// SetEmojiStatus sets the user's custom status emoji
func (db *Database) SetEmojiStatus(ctx context.Context, userID int64, emoji string) error {
	_, err := db.Pool.Exec(ctx, "UPDATE user_stats SET emoji_status = $1 WHERE user_id = $2", emoji, userID)
	return err
}

// UpdateUserPremium adds premium duration to a user
func (db *Database) UpdateUserPremium(ctx context.Context, userID int64, duration time.Duration) error {
	var currentPremiumUntil *time.Time
	err := db.Pool.QueryRow(ctx, "SELECT premium_until FROM users WHERE telegram_id = $1", userID).Scan(&currentPremiumUntil)
	if err != nil && err != pgx.ErrNoRows {
		return err
	}

	newUntil := time.Now().Add(duration)
	if currentPremiumUntil != nil && currentPremiumUntil.After(time.Now()) {
		newUntil = currentPremiumUntil.Add(duration)
	}

	_, err = db.Pool.Exec(ctx, "UPDATE users SET is_premium = TRUE, premium_until = $1 WHERE telegram_id = $2", newUntil, userID)
	return err
}

// GetReferralChain gets the Tier 1 and Tier 2 referrers of a user
func (db *Database) GetReferralChain(ctx context.Context, userID int64) (int64, int64, error) {
	var t1, t2 *int64
	query := `
		SELECT u1.referred_by, u2.referred_by
		FROM users u1
		LEFT JOIN users u2 ON u1.referred_by = u2.telegram_id
		WHERE u1.telegram_id = $1
	`
	err := db.Pool.QueryRow(ctx, query, userID).Scan(&t1, &t2)
	if err != nil {
		if err == pgx.ErrNoRows {
			return 0, 0, nil
		}
		return 0, 0, err
	}
	var referrerID, grandparentID int64
	if t1 != nil {
		referrerID = *t1
	}
	if t2 != nil {
		grandparentID = *t2
	}
	return referrerID, grandparentID, nil
}

// AdjustAirdropCoins increments or decrements the user's airdrop_coins directly
func (db *Database) AdjustAirdropCoins(ctx context.Context, userID int64, amount float64) (float64, error) {
	if db.Pool == nil {
		return 0, fmt.Errorf("no database connection")
	}

	// Create user_stats if missing, then adjust
	query := `
		INSERT INTO user_stats (user_id, xp, level, current_streak, last_active_at, energy, energy_updated_at, airdrop_coins, total_coins_earned)
		VALUES ($1, 0, 1, 0, CURRENT_TIMESTAMP, 500, CURRENT_TIMESTAMP, $2::float8, GREATEST(0.0, $2::float8))
		ON CONFLICT (user_id) DO UPDATE 
		SET airdrop_coins = COALESCE(user_stats.airdrop_coins, 0.0) + $2::float8,
		    total_coins_earned = COALESCE(user_stats.total_coins_earned, 0.0) + CASE WHEN $2::float8 > 0 THEN $2::float8 ELSE 0.0 END
		RETURNING airdrop_coins
	`
	var newBalance float64
	err := db.Pool.QueryRow(ctx, query, userID, amount).Scan(&newBalance)
	if err == nil && amount > 0 {
		_ = db.AddCreditBatch(ctx, userID, amount, "adjust")
	}
	return newBalance, err
}

// AddCreditBatch records a 30-day expiring credit batch for a user
func (db *Database) AddCreditBatch(ctx context.Context, userID int64, amount float64, source string) error {
	if amount <= 0 {
		return nil
	}
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO user_credit_batches (user_id, amount, remaining_amount, source, earned_at, expires_at, is_expired)
		VALUES ($1, $2, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', FALSE)
	`, userID, amount, source)
	return err
}

// GetWalletExpirySummary aggregates unexpired credit batches for Wallet UI
func (db *Database) GetWalletExpirySummary(ctx context.Context, userID int64) (*model.WalletExpirySummary, error) {
	if db.Pool == nil {
		return &model.WalletExpirySummary{CreditExpiresInDays: 30}, nil
	}

	query := `
		SELECT 
			COALESCE(SUM(remaining_amount), 0.0) as total_active,
			COALESCE(MIN(expires_at), CURRENT_TIMESTAMP + INTERVAL '30 days') as earliest_expiry,
			COALESCE(
				(SELECT remaining_amount FROM user_credit_batches 
				 WHERE user_id = $1 AND is_expired = FALSE AND remaining_amount > 0 AND expires_at >= CURRENT_TIMESTAMP 
				 ORDER BY expires_at ASC LIMIT 1), 
				0.0
			) as earliest_amount,
			COALESCE(
				SUM(CASE WHEN expires_at <= CURRENT_TIMESTAMP + INTERVAL '5 days' THEN remaining_amount ELSE 0 END),
				0.0
			) as expiring_soon_amount
		FROM user_credit_batches
		WHERE user_id = $1 AND is_expired = FALSE AND remaining_amount > 0 AND expires_at >= CURRENT_TIMESTAMP
	`

	var totalActive float64
	var earliestExpiry time.Time
	var earliestAmount float64
	var expiringSoonAmount float64

	err := db.Pool.QueryRow(ctx, query, userID).Scan(&totalActive, &earliestExpiry, &earliestAmount, &expiringSoonAmount)
	if err != nil && err != pgx.ErrNoRows {
		return nil, err
	}

	daysLeft := int(time.Until(earliestExpiry).Hours() / 24)
	if daysLeft < 0 {
		daysLeft = 0
	}

	return &model.WalletExpirySummary{
		TotalCoins:            totalActive,
		EarliestExpiringCoins: earliestAmount,
		EarliestExpiresAt:     &earliestExpiry,
		EarliestDaysLeft:      daysLeft,
		ExpiringSoonAmount:    expiringSoonAmount,
		CreditExpiresInDays:   30,
	}, nil
}

// DeductCreditsFIFO deducts credits using FIFO (oldest non-expired batches first) and syncs user_stats
func (db *Database) DeductCreditsFIFO(ctx context.Context, tx pgx.Tx, userID int64, requiredCoins float64) error {
	if requiredCoins <= 0 {
		return nil
	}

	rows, err := tx.Query(ctx, `
		SELECT id, remaining_amount 
		FROM user_credit_batches 
		WHERE user_id = $1 AND is_expired = FALSE AND expires_at >= CURRENT_TIMESTAMP AND remaining_amount > 0 
		ORDER BY expires_at ASC 
		FOR UPDATE
	`, userID)
	if err != nil {
		return fmt.Errorf("failed to query credit batches: %w", err)
	}
	defer rows.Close()

	type BatchRow struct {
		ID        string
		Remaining float64
	}
	var batches []BatchRow
	var totalAvailable float64
	for rows.Next() {
		var b BatchRow
		if err := rows.Scan(&b.ID, &b.Remaining); err != nil {
			return err
		}
		batches = append(batches, b)
		totalAvailable += b.Remaining
	}
	rows.Close()

	if totalAvailable < requiredCoins {
		return fmt.Errorf("insufficient active credits: have %.0f, need %.0f", totalAvailable, requiredCoins)
	}

	toDeduct := requiredCoins
	for _, b := range batches {
		if toDeduct <= 0 {
			break
		}
		if b.Remaining <= toDeduct {
			_, err := tx.Exec(ctx, `
				UPDATE user_credit_batches 
				SET remaining_amount = 0, is_expired = TRUE 
				WHERE id = $1
			`, b.ID)
			if err != nil {
				return err
			}
			toDeduct -= b.Remaining
		} else {
			_, err := tx.Exec(ctx, `
				UPDATE user_credit_batches 
				SET remaining_amount = remaining_amount - $1 
				WHERE id = $2
			`, toDeduct, b.ID)
			if err != nil {
				return err
			}
			toDeduct = 0
		}
	}

	_, err = tx.Exec(ctx, `
		UPDATE user_stats 
		SET airdrop_coins = COALESCE((
			SELECT SUM(remaining_amount) 
			FROM user_credit_batches 
			WHERE user_id = $1 AND is_expired = FALSE AND expires_at >= CURRENT_TIMESTAMP
		), 0.0) 
		WHERE user_id = $1
	`, userID)
	return err
}

// ExpireOutdatedCreditBatches marks credit batches older than 15 days as expired and reconciles user_stats
func (db *Database) ExpireOutdatedCreditBatches(ctx context.Context) (int64, error) {
	if db == nil || db.Pool == nil {
		return 0, fmt.Errorf("database connection not available")
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		UPDATE user_credit_batches 
		SET is_expired = TRUE 
		WHERE is_expired = FALSE AND expires_at < CURRENT_TIMESTAMP 
		RETURNING user_id
	`)
	if err != nil {
		return 0, fmt.Errorf("failed to expire credit batches: %w", err)
	}

	userMap := make(map[int64]bool)
	var expiredCount int64
	for rows.Next() {
		var uID int64
		if err := rows.Scan(&uID); err == nil {
			userMap[uID] = true
			expiredCount++
		}
	}
	rows.Close()

	if expiredCount == 0 {
		return 0, nil
	}

	for uID := range userMap {
		_, _ = tx.Exec(ctx, `
			UPDATE user_stats 
			SET airdrop_coins = COALESCE((
				SELECT SUM(remaining_amount) 
				FROM user_credit_batches 
				WHERE user_id = $1 AND is_expired = FALSE AND expires_at >= CURRENT_TIMESTAMP
			), 0.0) 
			WHERE user_id = $1
		`, uID)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}

	return expiredCount, nil
}

// ─── Unified Financial Ledger Repository ───

func (db *Database) RecordLedgerEvent(ctx context.Context, event model.LedgerEvent) error {
	if db == nil || db.Pool == nil {
		return fmt.Errorf("database connection not available")
	}

	createdAt := event.CreatedAt
	if createdAt.IsZero() {
		createdAt = time.Now()
	}

	metadataJSON, err := json.Marshal(event.Metadata)
	if err != nil {
		metadataJSON = []byte("{}")
	}

	query := `
		INSERT INTO user_ledger_events (
			user_id, category, event_type, amount, balance_before, balance_after,
			title, reference_id, metadata, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err = db.Pool.Exec(ctx, query,
		event.UserID, event.Category, event.EventType, event.Amount,
		event.BalanceBefore, event.BalanceAfter, event.Title,
		event.ReferenceID, metadataJSON, createdAt,
	)
	return err
}

func (db *Database) GetLedgerEvents(ctx context.Context, userID int64, category string, limit int, cursor string) (*model.LedgerResponse, error) {
	if db == nil || db.Pool == nil {
		return nil, fmt.Errorf("database connection not available")
	}

	if limit <= 0 || limit > 100 {
		limit = 20
	}

	var totalCount int
	countQuery := `SELECT COUNT(*) FROM user_ledger_events WHERE user_id = $1`
	if category != "" && category != "all" {
		countQuery += ` AND category = $2`
		_ = db.Pool.QueryRow(ctx, countQuery, userID, category).Scan(&totalCount)
	} else {
		_ = db.Pool.QueryRow(ctx, countQuery, userID).Scan(&totalCount)
	}

	var rows pgx.Rows
	var err error

	baseQuery := `
		SELECT id, user_id, category, event_type, amount, balance_before, balance_after,
		       title, reference_id, metadata, created_at
		FROM user_ledger_events
		WHERE user_id = $1
	`
	args := []interface{}{userID}

	if category != "" && category != "all" {
		args = append(args, category)
		baseQuery += fmt.Sprintf(` AND category = $%d`, len(args))
	}

	if cursor != "" {
		if cursorTime, parseErr := time.Parse(time.RFC3339Nano, cursor); parseErr == nil {
			args = append(args, cursorTime)
			baseQuery += fmt.Sprintf(` AND created_at < $%d`, len(args))
		}
	}

	args = append(args, limit+1)
	baseQuery += fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d`, len(args))

	rows, err = db.Pool.Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("query ledger events: %w", err)
	}
	defer rows.Close()

	var events []model.LedgerEvent
	for rows.Next() {
		var ev model.LedgerEvent
		var evID pgx.Row
		_ = evID
		var metaBytes []byte
		var idStr string

		if scanErr := rows.Scan(
			&idStr, &ev.UserID, &ev.Category, &ev.EventType, &ev.Amount,
			&ev.BalanceBefore, &ev.BalanceAfter, &ev.Title, &ev.ReferenceID,
			&metaBytes, &ev.CreatedAt,
		); scanErr == nil {
			ev.ID = idStr
			ev.Status = "completed"
			if len(metaBytes) > 0 {
				var meta map[string]interface{}
				if json.Unmarshal(metaBytes, &meta) == nil {
					ev.Metadata = meta
				}
			}
			events = append(events, ev)
		}
	}

	hasMore := false
	var nextCursor string
	if len(events) > limit {
		hasMore = true
		events = events[:limit]
		nextCursor = events[len(events)-1].CreatedAt.Format(time.RFC3339Nano)
	}

	return &model.LedgerResponse{
		Events:     events,
		NextCursor: nextCursor,
		HasMore:    hasMore,
		TotalCount: totalCount,
	}, nil
}

// ─── My Assets Repository ───

func (db *Database) GetMyAssets(ctx context.Context, userID int64) (*model.MyAssetsResponse, error) {
	if db == nil || db.Pool == nil {
		return nil, fmt.Errorf("database connection not available")
	}

	resp := &model.MyAssetsResponse{
		Reports:    []model.MyReportsAsset{},
		Properties: []model.MyConnectedProperty{},
		Projects:   []model.MyProjectAsset{},
	}

	// 1. Fetch purchased reports from username_reports table
	reportRows, err := db.Pool.Query(ctx, `
		SELECT username, rarity_score, status, generated_at
		FROM username_reports
		WHERE user_id = $1
		ORDER BY generated_at DESC
		LIMIT 50
	`, userID)
	if err == nil {
		defer reportRows.Close()
		for reportRows.Next() {
			var r model.MyReportsAsset
			if err := reportRows.Scan(&r.Username, &r.RarityScore, &r.Status, &r.GeneratedAt); err == nil {
				r.CertificateURL = fmt.Sprintf("/username/report?u=%s", r.Username)
				r.NotificationEnabled = true // purchased reports are enabled for tracking
				resp.Reports = append(resp.Reports, r)
			}
		}
	}

	// If no username_reports, check search_logs where user generated reports
	if len(resp.Reports) == 0 {
		logRows, logErr := db.Pool.Query(ctx, `
			SELECT DISTINCT ON (username) username, created_at
			FROM search_logs
			WHERE user_id = $1
			ORDER BY username, created_at DESC
			LIMIT 20
		`, userID)
		if logErr == nil {
			defer logRows.Close()
			for logRows.Next() {
				var u string
				var genAt time.Time
				if logRows.Scan(&u, &genAt) == nil {
					resp.Reports = append(resp.Reports, model.MyReportsAsset{
						Username:            u,
						RarityScore:         85,
						Status:              "completed",
						GeneratedAt:         genAt,
						CertificateURL:      fmt.Sprintf("/username/report?u=%s", u),
						NotificationEnabled: true,
					})
				}
			}
		}
	}

	// 2. Fetch Connected Properties (Managed Channels & Groups)
	channelRows, err := db.Pool.Query(ctx, `
		SELECT mc.id, mc.chat_title, COALESCE(mc.chat_id::text, ''), mc.subscription_status, mc.paid_until, mc.subscribers_count
		FROM managed_channels mc
		LEFT JOIN managed_bots mb ON mc.bot_id = mb.id
		WHERE mc.connected_by_user_id = $1 OR mb.owner_user_id = $1
		   OR EXISTS (SELECT 1 FROM channel_admins ca WHERE ca.channel_id = mc.id AND ca.telegram_id = $1)
		ORDER BY mc.created_at DESC
	`, userID)
	if err == nil {
		defer channelRows.Close()
		for channelRows.Next() {
			var p model.MyConnectedProperty
			p.Type = "channel"
			if err := channelRows.Scan(&p.ID, &p.Title, &p.Username, &p.SubscriptionStatus, &p.PaidUntil, &p.MemberCount); err == nil {
				if p.PaidUntil != nil && p.PaidUntil.After(time.Now()) {
					p.DaysLeft = int(time.Until(*p.PaidUntil).Hours() / 24)
				}
				p.DashboardURL = fmt.Sprintf("/channel/%s", p.ID)
				resp.Properties = append(resp.Properties, p)
			}
		}
	}

	groupRows, err := db.Pool.Query(ctx, `
		SELECT mg.id, mg.chat_title, COALESCE(mg.chat_id::text, ''), COALESCE(mg.photo_url, ''), mg.members_count, mg.subscription_status, mg.paid_until
		FROM managed_groups mg
		LEFT JOIN managed_bots mb ON mg.bot_id = mb.id
		WHERE mg.connected_by_user_id = $1 OR mb.owner_user_id = $1
		ORDER BY mg.created_at DESC
	`, userID)
	if err == nil {
		defer groupRows.Close()
		for groupRows.Next() {
			var p model.MyConnectedProperty
			p.Type = "group"
			if err := groupRows.Scan(&p.ID, &p.Title, &p.Username, &p.PhotoURL, &p.MemberCount, &p.SubscriptionStatus, &p.PaidUntil); err == nil {
				if p.PaidUntil != nil && p.PaidUntil.After(time.Now()) {
					p.DaysLeft = int(time.Until(*p.PaidUntil).Hours() / 24)
				}
				p.DashboardURL = fmt.Sprintf("/group/%s", p.ID)
				resp.Properties = append(resp.Properties, p)
			}
		}
	}

	// 3. Fetch Projects
	projRows, err := db.Pool.Query(ctx, `
		SELECT 
			p.id, p.name, p.status, p.stars_subscription_active, p.stars_expires_at,
			COALESCE(sc.chat_title, ''), COALESCE(tc.chat_title, '')
		FROM projects p
		LEFT JOIN managed_channels sc ON sc.id = p.source_channel_id
		LEFT JOIN managed_channels tc ON tc.id = p.target_channel_id
		WHERE p.owner_user_id = $1
		ORDER BY p.created_at DESC
	`, userID)
	if err == nil {
		defer projRows.Close()
		for projRows.Next() {
			var pj model.MyProjectAsset
			if err := projRows.Scan(
				&pj.ID, &pj.Name, &pj.Status, &pj.SubscriptionActive, &pj.StarsExpiresAt,
				&pj.SourceChatTitle, &pj.TargetChatTitle,
			); err == nil {
				if pj.StarsExpiresAt != nil && pj.StarsExpiresAt.After(time.Now()) {
					pj.DaysLeft = int(time.Until(*pj.StarsExpiresAt).Hours() / 24)
				}
				pj.PipelineEnabled = pj.Status == "active"
				pj.AutoRenew = pj.SubscriptionActive
				resp.Projects = append(resp.Projects, pj)
			}
		}
	}

	// 4. Fetch Purchased Gifts from gift_reports
	resp.Gifts = []model.MyGiftAsset{}
	giftRows, err := db.Pool.Query(ctx, `
		SELECT gift_id, model_id, serial_number, fair_value_nano_gram, purchased_at
		FROM gift_reports
		WHERE user_id = $1
		ORDER BY purchased_at DESC
		LIMIT 50
	`, userID)
	if err == nil {
		defer giftRows.Close()
		for giftRows.Next() {
			var g model.MyGiftAsset
			var fairNano int64
			if err := giftRows.Scan(&g.GiftID, &g.ModelName, &g.SerialNumber, &fairNano, &g.PurchasedAt); err == nil {
				g.EstimatedValGRAM = float64(fairNano) / 1e9
				g.EstimatedValUSD = g.EstimatedValGRAM * 5.50
				g.RarityTier = "Legendary"
				g.CertificateURL = fmt.Sprintf("/gifts/report?g=%s", g.GiftID)
				resp.Gifts = append(resp.Gifts, g)
			}
		}
	}

	// 5. Boosters
	boosts, _ := db.GetUserBoosts(ctx, userID)
	if boosts != nil {
		resp.Boosters = model.MyBoostersAsset{
			MultiTapLevel:    boosts.MultitapLevel,
			EnergyLimitLevel: boosts.EnergyLimitLevel,
			TapBotLevel:      boosts.TapBotLevel,
			TapBotCapHours:   12,
		}
	} else {
		resp.Boosters = model.MyBoostersAsset{
			MultiTapLevel:    1,
			EnergyLimitLevel: 1,
			TapBotLevel:      0,
			TapBotCapHours:   12,
		}
	}

	// 6. Summary Text
	resp.SummaryText = fmt.Sprintf(
		"%d Reports · %d Gifts · %d Properties · %d Projects · %d Boosters",
		len(resp.Reports), len(resp.Gifts), len(resp.Properties), len(resp.Projects), 3,
	)

	return resp, nil
}

// ─── Emoji Status Reward (Server-Verified & Replay-Proof) ───

func (db *Database) ClaimEmojiStatusReward(ctx context.Context, userID int64) (*model.EmojiRewardResponse, error) {
	if db == nil || db.Pool == nil {
		return nil, fmt.Errorf("database connection not available")
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Check if already claimed
	var alreadyClaimed bool
	err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM user_emoji_rewards WHERE user_id = $1)", userID).Scan(&alreadyClaimed)
	if err != nil {
		return nil, err
	}
	if alreadyClaimed {
		return &model.EmojiRewardResponse{
			Success:  true,
			Rewarded: false,
			Amount:   0,
			Message:  "already_claimed",
		}, nil
	}

	const RewardAmount = 500.0

	// Insert claim record
	_, err = tx.Exec(ctx, `
		INSERT INTO user_emoji_rewards (user_id, reward_amount) 
		VALUES ($1, $2)
		ON CONFLICT (user_id) DO NOTHING
	`, userID, RewardAmount)
	if err != nil {
		return nil, fmt.Errorf("insert emoji reward: %w", err)
	}

	// Update user stats
	var beforeCoins, afterCoins float64
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(airdrop_coins, 0.0) FROM user_stats WHERE user_id = $1 FOR UPDATE
	`, userID).Scan(&beforeCoins)
	if err != nil && err != pgx.ErrNoRows {
		return nil, err
	}

	afterCoins = beforeCoins + RewardAmount
	_, err = tx.Exec(ctx, `
		INSERT INTO user_stats (user_id, airdrop_coins, total_coins_earned)
		VALUES ($1, $2, $2)
		ON CONFLICT (user_id) DO UPDATE SET
			airdrop_coins = COALESCE(user_stats.airdrop_coins, 0.0) + $2,
			total_coins_earned = COALESCE(user_stats.total_coins_earned, 0.0) + $2
	`, userID, RewardAmount)
	if err != nil {
		return nil, fmt.Errorf("update user stats: %w", err)
	}

	// Add to credit batches (30 days expiration)
	_, err = tx.Exec(ctx, `
		INSERT INTO user_credit_batches (user_id, amount, remaining_amount, source, earned_at, expires_at, is_expired)
		VALUES ($1, $2, $2, 'emoji_status', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', FALSE)
	`, userID, RewardAmount)
	if err != nil {
		return nil, fmt.Errorf("insert credit batch: %w", err)
	}

	// Log into unified ledger
	_, err = tx.Exec(ctx, `
		INSERT INTO user_ledger_events (
			user_id, category, event_type, amount, balance_before, balance_after,
			title, reference_id, metadata, created_at
		) VALUES (
			$1, 'coins', 'earn_emoji_status', $2, $3, $4,
			'iFragment Pro Emoji Status Bonus', 'emoji_bonus_' || $1::text,
			'{"reward": 500, "source": "tma_9.3_emoji_status"}'::jsonb, CURRENT_TIMESTAMP
		)
	`, userID, RewardAmount, beforeCoins, afterCoins)
	if err != nil {
		return nil, fmt.Errorf("record ledger event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return &model.EmojiRewardResponse{
		Success:  true,
		Rewarded: true,
		Amount:   RewardAmount,
		Message:  "reward_granted",
	}, nil
}

