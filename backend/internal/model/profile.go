package model

import "time"

type ActiveSubscriptionSummary struct {
	Type         string     `json:"type"` // "none", "pro", "enterprise"
	IsActive     bool       `json:"isActive"`
	AutoRenew    bool       `json:"autoRenew"`
	ExpiresAt    *time.Time `json:"expiresAt,omitempty"`
	DaysLeft     int        `json:"daysLeft"`
	PackageTitle string     `json:"packageTitle"`
}

type ProfileStats struct {
	TelegramID                 int64                      `json:"telegramId"`
	Username                   string                     `json:"username"`
	FirstName                  string                     `json:"firstName"`
	LastName                   string                     `json:"lastName"`
	UsernamesAnalyzed          int                        `json:"usernamesAnalyzed"`
	GroupsManaged              int                        `json:"groupsManaged"`
	ChannelsManaged            int                        `json:"channelsManaged"`
	DaysActive                 int                        `json:"daysActive"`
	CurrentStreak              int                        `json:"currentStreak"`
	GlobalRank                 int                        `json:"globalRank"`
	TotalTaps                  int                        `json:"totalTaps"`
	MemberSince                time.Time                  `json:"memberSince"`
	Level                      int                        `json:"level"`
	XP                         int                        `json:"xp"`
	XPToNextLevel              int                        `json:"xpToNextLevel"`
	IsPremium                  bool                       `json:"isPremium"`
	DailyTappedCoins           float64                    `json:"dailyTappedCoins"`
	DailyFatigueMultiplier     float64                    `json:"dailyFatigueMultiplier"`
	DailyFatigueLimitRemaining float64                    `json:"dailyFatigueLimitRemaining"`
	DailyTurboUsed             int                        `json:"dailyTurboUsed"`
	DailyFullEnergyUsed        int                        `json:"dailyFullEnergyUsed"`
	TurboExpiresAt             *time.Time                 `json:"turboExpiresAt,omitempty"`
	BoosterResetAt             int64                      `json:"boosterResetAt"`
	ValuationCredits           int                        `json:"valuationCredits"`
	IntelCredits               int                        `json:"intelCredits"`
	EarliestExpiringCoins       float64                    `json:"earliestExpiringCoins"`
	EarliestExpiringDays        int                        `json:"earliestExpiringDays"`
	PremiumUntil               *time.Time                 `json:"premiumUntil,omitempty"`
	EmojiStatus                string                     `json:"emojiStatus"`
	EquippedBorder             string                     `json:"equippedBorder"`
	EquippedSkin               string                     `json:"equippedSkin"`
	AirdropCoins               float64                    `json:"airdropCoins"`
	CreditExpiresInDays        int                        `json:"creditExpiresInDays"`
	Energy                     int                        `json:"energy"`
	EnergyUpdatedAt            time.Time                  `json:"energyUpdatedAt"`
	ServerNow                  int64                      `json:"serverNow"`
	PhotoURL                   string                     `json:"photoUrl,omitempty"`
	Subscription               *ActiveSubscriptionSummary `json:"subscription,omitempty"`
}

type UserAchievement struct {
	ID         string     `json:"id"`
	Unlocked   bool       `json:"unlocked"`
	UnlockedAt *time.Time `json:"unlockedAt,omitempty"`
	Progress   int        `json:"progress"`
	Target     int        `json:"target"`
}

type ReferralFriend struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	JoinedAt     time.Time `json:"joinedAt"`
	Earned       float64   `json:"earned"`
	AirdropCoins float64   `json:"airdropCoins"`
	FrensCount   int       `json:"frensCount"`
	IsActive     bool      `json:"isActive"`
	Status       string    `json:"status"` // "verified" | "pending"
}

type ReferralHubData struct {
	ReferralCode     string           `json:"referralCode"`
	TotalInvited     int              `json:"totalInvited"`
	TotalEarned      float64          `json:"totalEarned"`
	Tier1Earnings    float64          `json:"tier1Earnings"`
	Tier2Earnings    float64          `json:"tier2Earnings"`
	ValuationCredits int              `json:"valuationCredits"`
	Friends          []ReferralFriend `json:"friends"`
}

type WalletExpirySummary struct {
	TotalCoins            float64    `json:"totalCoins"`
	EarliestExpiringCoins float64    `json:"earliestExpiringCoins"`
	EarliestExpiresAt     *time.Time `json:"earliestExpiresAt,omitempty"`
	EarliestDaysLeft      int        `json:"earliestDaysLeft"`
	ExpiringSoonAmount    float64    `json:"expiringSoonAmount"`
	CreditExpiresInDays   int        `json:"creditExpiresInDays"`
}

type AchievementDef struct {
	ID     string `json:"id"`
	Target int    `json:"target"`
}

type CosmeticItem struct {
	ID          string  `json:"id"`
	Type        string  `json:"type"` // "border" or "skin"
	Name        string  `json:"name"`
	Cost        float64 `json:"cost"` // in AirdropCoins
	Purchased   bool    `json:"purchased"`
	BorderClass string  `json:"borderClass,omitempty"` // CSS class name for styling
	SkinClass   string  `json:"skinClass,omitempty"`   // CSS class name for styling
}

// ─── Unified Ledger Types ───
type LedgerEvent struct {
	ID            string                 `json:"id"`
	UserID        int64                  `json:"userId"`
	Category      string                 `json:"category"` // "coins" | "credits" | "stars" | "subscription"
	EventType     string                 `json:"eventType"`
	Amount        float64                `json:"amount"`
	BalanceBefore float64                `json:"balanceBefore"`
	BalanceAfter  float64                `json:"balanceAfter"`
	Title         string                 `json:"title"`
	ReferenceID   string                 `json:"referenceId"`
	Status        string                 `json:"status"` // "completed", "pending", "failed"
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt     time.Time              `json:"createdAt"`
}

type LedgerResponse struct {
	Events     []LedgerEvent `json:"events"`
	NextCursor string        `json:"nextCursor,omitempty"`
	HasMore    bool          `json:"hasMore"`
	TotalCount int           `json:"totalCount"`
}

// ─── My Assets Types ───
type MyReportsAsset struct {
	Username            string    `json:"username"`
	RarityScore         int       `json:"rarityScore"`
	Status              string    `json:"status"`
	GeneratedAt         time.Time `json:"generatedAt"`
	CertificateURL      string    `json:"certificateUrl"`
	NotificationEnabled bool      `json:"notificationEnabled"`
}

type MyConnectedProperty struct {
	ID                 string     `json:"id"`
	Type               string     `json:"type"` // "channel", "group", "bot"
	Title              string     `json:"title"`
	Username           string     `json:"username"`
	PhotoURL           string     `json:"photoUrl,omitempty"`
	MemberCount        int        `json:"memberCount"`
	SubscriptionStatus string     `json:"subscriptionStatus"`
	PaidUntil          *time.Time `json:"paidUntil,omitempty"`
	DaysLeft           int        `json:"daysLeft"`
	DashboardURL       string     `json:"dashboardUrl"`
}

type MyProjectAsset struct {
	ID                    string     `json:"id"`
	Name                  string     `json:"name"`
	Status                string     `json:"status"`
	SourceChatTitle       string     `json:"sourceChatTitle"`
	TargetChatTitle       string     `json:"targetChatTitle"`
	SourceChatUsername    string     `json:"sourceChatUsername"`
	TargetChatUsername    string     `json:"targetChatUsername"`
	StarsExpiresAt        *time.Time `json:"starsExpiresAt,omitempty"`
	DaysLeft              int        `json:"daysLeft"`
	SubscriptionActive    bool       `json:"subscriptionActive"`
	PipelineEnabled       bool       `json:"pipelineEnabled"`
	AutoRenew             bool       `json:"autoRenew"`
}

type MyBoostersAsset struct {
	MultiTapLevel    int `json:"multitapLevel"`
	EnergyLimitLevel int `json:"energyLimitLevel"`
	TapBotLevel      int `json:"tapBotLevel"`
	TapBotCapHours   int `json:"tapBotCapHours"`
}

type MyGiftAsset struct {
	GiftID              string    `json:"giftId"`
	ModelName           string    `json:"modelName"`
	SerialNumber        int       `json:"serialNumber"`
	EstimatedValGRAM    float64   `json:"estimatedValGram"`
	EstimatedValUSD     float64   `json:"estimatedValUsd"`
	RarityTier          string    `json:"rarityTier"`
	CertificateURL      string    `json:"certificateUrl"`
	PurchasedAt         time.Time `json:"purchasedAt"`
}

type MyAssetsResponse struct {
	Reports     []MyReportsAsset      `json:"reports"`
	Gifts       []MyGiftAsset         `json:"gifts"`
	Properties  []MyConnectedProperty `json:"properties"`
	Projects    []MyProjectAsset      `json:"projects"`
	Boosters    MyBoostersAsset       `json:"boosters"`
	SummaryText string                `json:"summaryText"`
}

type EmojiRewardResponse struct {
	Success bool    `json:"success"`
	Rewarded bool   `json:"rewarded"`
	Amount   float64 `json:"amount"`
	Message  string  `json:"message"`
}
