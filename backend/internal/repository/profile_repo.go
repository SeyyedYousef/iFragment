package repository

import (
	"context"
	"crypto/rand"
	"database/sql"
	"fmt"
	"math/big"
	"strings"
	"time"

	"ifragment-backend/internal/model"

	"github.com/jackc/pgx/v5"
	"golang.org/x/sync/errgroup"
)

// EnsureStatsExists inserts default stats for the user if they don't exist
func (db *Database) EnsureStatsExists(ctx context.Context, userID int64) error {
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
			SELECT created_at, is_premium, premium_until FROM users WHERE telegram_id = $1
		),
		reports_count AS (
			SELECT COUNT(*) as count FROM username_reports WHERE user_id = $1
		),
		managed_counts AS (
			SELECT 
				COALESCE(SUM(CASE WHEN chat_type IN ('group', 'supergroup') THEN 1 ELSE 0 END), 0) as groups,
				COALESCE(SUM(CASE WHEN chat_type = 'channel' THEN 1 ELSE 0 END), 0) as channels
			FROM managed_groups mg
			JOIN managed_bots mb ON mg.bot_id = mb.id
			WHERE mb.owner_user_id = $1
		),
		frg_info AS (
			SELECT balance, total_earned, total_spent FROM frg_balances WHERE user_id = $1
		),
		stats_info AS (
			SELECT days_active, current_streak, total_taps, xp, level, last_active_at,
			       COALESCE(emoji_status, '') as emoji_status,
			       COALESCE(equipped_border, '') as equipped_border,
			       COALESCE(equipped_skin, '') as equipped_skin,
			       airdrop_coins,
			       energy,
			       energy_updated_at
			FROM user_stats WHERE user_id = $1
		)
		SELECT 
			ui.created_at,
			rc.count,
			mc.groups,
			mc.channels,
			COALESCE(fi.balance, 0.0),
			COALESCE(fi.total_earned, 0.0),
			COALESCE(fi.total_spent, 0.0),
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
			si.energy,
			si.energy_updated_at
		FROM stats_info si
		CROSS JOIN user_info ui
		CROSS JOIN reports_count rc
		CROSS JOIN managed_counts mc
		LEFT JOIN frg_info fi ON true
	`

	var memberSince time.Time
	var usernamesAnalyzed, groupsManaged, channelsManaged int
	var frgBalance, totalFrgEarned, totalFrgSpent float64
	var daysActive, currentStreak, totalTaps, xp, level int
	var lastActiveAt time.Time
	var isPremium bool
	var premiumUntil *time.Time
	var emojiStatus, equippedBorder, equippedSkin string
	var airdropCoins float64
	var energy int
	var energyUpdatedAt time.Time

	err := db.Pool.QueryRow(ctx, query, userID).Scan(
		&memberSince, &usernamesAnalyzed, &groupsManaged, &channelsManaged,
		&frgBalance, &totalFrgEarned, &totalFrgSpent,
		&daysActive, &currentStreak, &totalTaps, &xp, &level, &lastActiveAt,
		&isPremium, &premiumUntil, &emojiStatus, &equippedBorder, &equippedSkin, &airdropCoins,
		&energy, &energyUpdatedAt,
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

	return &model.ProfileStats{
		UsernamesAnalyzed: usernamesAnalyzed,
		GroupsManaged:     groupsManaged,
		ChannelsManaged:   channelsManaged,
		DaysActive:        daysActive,
		CurrentStreak:     currentStreak,
		GlobalRank:        0,
		TotalTaps:         totalTaps,
		TotalFrgEarned:    totalFrgEarned,
		TotalFrgSpent:     totalFrgSpent,
		FrgBalance:        frgBalance,
		MemberSince:       memberSince,
		Level:             level,
		XP:                xp,
		XPToNextLevel:     GetXPToNextLevel(level),
		IsPremium:         isPremium,
		PremiumUntil:      premiumUntil,
		EmojiStatus:       emojiStatus,
		EquippedBorder:    equippedBorder,
		EquippedSkin:      equippedSkin,
		AirdropCoins:      airdropCoins,
		Energy:            energy,
		EnergyUpdatedAt:   energyUpdatedAt,
	}, nil
}

func (db *Database) GetGlobalRankFromDB(ctx context.Context, xp int) (int, error) {
	var globalRank int
	rankQuery := "SELECT COUNT(*) + 1 FROM user_stats WHERE xp > $1"
	err := db.Pool.QueryRow(ctx, rankQuery, xp).Scan(&globalRank)
	return globalRank, err
}

var PredefinedAchievements = map[string]int{
	"first_steps":        1,
	"home_base":          1,
	"tap_novice":         1000,
	"mining_machine":     100000,
	"frg_millionaire":    1000000,
	"first_scan":         1,
	"whale_hunter":       100,
	"data_scientist":     500,
	"social_butterfly":   5,
	"army_builder":       50,
	"network_king":       200,
	"group_guardian":     1,
	"channel_commander":  1,
	"empire_builder":     10,
	"week_warrior":       7,
	"month_master":       30,
	"legendary":          100,
	"early_adopter":      1,
	"premium_user":       1,
	"bug_hunter":         1,
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

	achievementsList := []model.UserAchievement{}
	// Order by achievement name to match frontend mock expectations
	keys := []string{
		"first_steps", "home_base", "tap_novice", "mining_machine", "frg_millionaire",
		"first_scan", "whale_hunter", "data_scientist", "social_butterfly", "army_builder",
		"network_king", "group_guardian", "channel_commander", "empire_builder", "week_warrior",
		"month_master", "legendary", "early_adopter", "premium_user", "bug_hunter",
	}

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

// MaintainUserStats maintains user streak and days active atomically.
func (db *Database) MaintainUserStats(ctx context.Context, userID int64) error {
	if err := db.EnsureStatsExists(ctx, userID); err != nil {
		return err
	}

	query := `
		UPDATE user_stats SET
			current_streak = CASE
				WHEN now() - last_active_at > interval '48 hours' THEN 1
				WHEN now() - last_active_at > interval '24 hours' THEN current_streak + 1
				ELSE current_streak
			END,
			days_active = CASE
				WHEN now() - last_active_at > interval '24 hours'
				THEN days_active + 1
				ELSE days_active
			END,
			last_active_at = CASE
				WHEN now() - last_active_at > interval '24 hours'
				THEN now()
				ELSE last_active_at
			END
		WHERE user_id = $1
	`
	_, err := db.Pool.Exec(ctx, query, userID)
	return err
}

// ExpirePremiumSubscriptions updates all expired premium subscriptions bulk.
func (db *Database) ExpirePremiumSubscriptions(ctx context.Context) error {
	query := `
		UPDATE users SET is_premium = FALSE
		WHERE is_premium = TRUE AND premium_until < now()
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
		var refCode sql.NullString
		err := db.Pool.QueryRow(ctx, "SELECT referral_code FROM users WHERE telegram_id = $1", userID).Scan(&refCode)
		if err != nil {
			return err
		}
		code = refCode.String
		if !refCode.Valid || code == "" {
			var err error
			code, err = generateSecureReferralCode(8)
			if err != nil {
				return err
			}
			_, err = db.Pool.Exec(ctx, "UPDATE users SET referral_code = $1 WHERE telegram_id = $2", code, userID)
			if err != nil {
				return err
			}
		}
		return nil
	})

	var friends []model.ReferralFriend
	var totalInvited int
	var totalEarned float64

	g.Go(func() error {
		friendsQuery := `
			SELECT u.telegram_id, COALESCE(u.username, u.first_name), u.created_at, COALESCE(fb.total_earned, 0)
			FROM users u
			LEFT JOIN frg_balances fb ON u.telegram_id = fb.user_id
			WHERE u.referred_by = $1
			ORDER BY u.created_at DESC
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
			if err := rows.Scan(&friendID, &name, &joinedAt, &earned); err == nil {
				friends = append(friends, model.ReferralFriend{
					ID:       friendID,
					Name:     name,
					JoinedAt: joinedAt,
					Earned:   earned,
				})
				totalInvited++
				totalEarned += 10.0 // referrer gets 10 FRG per friend visually for metrics
			}
		}
		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	return &model.ReferralHubData{
		ReferralCode: code,
		TotalInvited: totalInvited,
		TotalEarned:  totalEarned,
		Friends:      friends,
	}, nil
}

func (db *Database) SetReferredBy(ctx context.Context, userID int64, referrerCode string) (bool, error) {
	// Find referrer by referral_code
	var referrerID int64
	err := db.Pool.QueryRow(ctx, "SELECT telegram_id FROM users WHERE referral_code = $1", referrerCode).Scan(&referrerID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return false, fmt.Errorf("invalid referral code")
		}
		return false, err
	}

	if referrerID == userID {
		return false, fmt.Errorf("cannot refer yourself")
	}

	// Update user's referred_by if it is currently NULL
	cmdTag, err := db.Pool.Exec(ctx, `
		UPDATE users 
		SET referred_by = $1 
		WHERE telegram_id = $2 AND referred_by IS NULL
	`, referrerID, userID)
	if err != nil {
		return false, err
	}
	return cmdTag.RowsAffected() == 1, nil
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
	0,      // Level 1
	500,    // Level 2
	1500,   // Level 3
	3500,   // Level 4
	7000,   // Level 5
	12000,  // Level 6
	20000,  // Level 7
	35000,  // Level 8
	55000,  // Level 9
	80000,  // Level 10
	120000, // Level 11
	200000, // Level 12
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
	{ID: "gold_shimmer", Type: "border", Name: "Gold Shimmer", Cost: 10.0, BorderClass: "border-gold-shimmer"},
	{ID: "cyber_glow", Type: "border", Name: "Cyber Glow", Cost: 25.0, BorderClass: "border-cyber-glow"},
	{ID: "rainbow_wave", Type: "border", Name: "Rainbow Wave", Cost: 50.0, BorderClass: "border-rainbow-wave"},
	{ID: "cosmic_void", Type: "skin", Name: "Cosmic Void", Cost: 20.0, SkinClass: "bg-cosmic-void"},
	{ID: "neon_matrix", Type: "skin", Name: "Neon Matrix", Cost: 35.0, SkinClass: "bg-neon-matrix"},
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

