package service

import (
	"context"
	"time"

	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"

	"github.com/google/uuid"
)

// ProfileRepository defines data access methods required for user profile operations
type ProfileRepository interface {
	EnsureStatsExists(ctx context.Context, userID int64) error
	GetProfileStats(ctx context.Context, userID int64) (*model.ProfileStats, error)
	UpdateUserLanguage(ctx context.Context, telegramID int64, lang string) error
	GetGlobalRankFromDB(ctx context.Context, xp int) (int, error)
	GetUserReferrals(ctx context.Context, userID int64) (*model.ReferralHubData, error)
	GetCosmeticItems(ctx context.Context, userID int64) ([]model.CosmeticItem, error)
	EquipCosmetic(ctx context.Context, userID int64, itemID string, itemType string) error
	PurchaseCosmetic(ctx context.Context, userID int64, itemID string, cost float64, itemType string) error
	UpdateEmojiStatus(ctx context.Context, userID int64, emojiStatus string) error
	GetTopUsers(ctx context.Context, limit int) ([]model.ProfileStats, error)
	UpsertUser(ctx context.Context, user repository.User) error
	UpdateUserBioData(ctx context.Context, telegramID int64, username, firstName, lastName, languageCode string, isPremium bool, photoURL string) error
}

// GamificationRepository defines data access methods required for gamification, taps, and quests
type GamificationRepository interface {
	GetDailyClaimState(ctx context.Context, userID int64) (*model.DailyClaimState, error)
	ClaimDailyReward(ctx context.Context, userID int64, streak int) error
	GetUserBoosts(ctx context.Context, userID int64) (*model.UserBoosts, error)
	UpgradeBoost(ctx context.Context, userID int64, boostType string, cost float64) (*model.UserBoosts, error)
	GetUserTasks(ctx context.Context, userID int64) ([]model.UserTask, error)
	CompleteUserTask(ctx context.Context, userID int64, taskKey string, rewardCoins float64, rewardXP int) error
	RecordTapBatch(ctx context.Context, userID int64, taps int, frgEarned float64, xpEarned int) error
	GetActiveQuests(ctx context.Context) ([]model.Quest, error)
}

// BotRepository defines data access methods for Telegram bot management and moderation
type BotRepository interface {
	GetActiveBotEncryptedToken(ctx context.Context) ([]byte, error)
	GetBotByID(ctx context.Context, id uuid.UUID) (*model.ManagedBot, error)
	GetBotByTelegramID(ctx context.Context, botID int64) (*model.ManagedBot, error)
	ListBotsByOwner(ctx context.Context, ownerID int64) ([]model.ManagedBot, error)
	SaveBot(ctx context.Context, bot *model.ManagedBot) error
	DeleteBot(ctx context.Context, id uuid.UUID, ownerID int64) error
	GetManagedGroup(ctx context.Context, groupID uuid.UUID) (*model.ManagedGroup, error)
	ListManagedGroups(ctx context.Context, botID uuid.UUID) ([]model.ManagedGroup, error)
	SaveManagedGroup(ctx context.Context, group *model.ManagedGroup) error
	DeleteManagedGroup(ctx context.Context, groupID uuid.UUID) error
}

// LeaderboardCacheStore abstracts leaderboard caching operations
type LeaderboardCacheStore interface {
	GetRank(ctx context.Context, key string, member string) (int64, error)
	SetScore(ctx context.Context, key string, member string, score float64) error
	GetTop(ctx context.Context, key string, start, stop int64) ([]string, error)
}

// CacheStore abstracts general key-value and distributed caching operations
type CacheStore interface {
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error
	Del(ctx context.Context, keys ...string) error
	IsQuotaExceeded() bool
}
