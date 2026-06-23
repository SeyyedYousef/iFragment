package model

import "time"

type ProfileStats struct {
	UsernamesAnalyzed int        `json:"usernamesAnalyzed"`
	GroupsManaged     int        `json:"groupsManaged"`
	ChannelsManaged   int        `json:"channelsManaged"`
	DaysActive        int        `json:"daysActive"`
	CurrentStreak     int        `json:"currentStreak"`
	GlobalRank        int        `json:"globalRank"`
	TotalTaps         int        `json:"totalTaps"`
	TotalFrgEarned    float64    `json:"totalFrgEarned"`
	TotalFrgSpent     float64    `json:"totalFrgSpent"`
	FrgBalance        float64    `json:"frgBalance"`
	MemberSince       time.Time  `json:"memberSince"`
	Level             int        `json:"level"`
	XP                int        `json:"xp"`
	XPToNextLevel     int        `json:"xpToNextLevel"`
	IsPremium           bool       `json:"isPremium"`
	DailyTappedCoins    float64    `json:"dailyTappedCoins"`
	DailyTurboUsed      int        `json:"dailyTurboUsed"`
	DailyFullEnergyUsed int        `json:"dailyFullEnergyUsed"`
	PremiumUntil        *time.Time `json:"premiumUntil,omitempty"`
	EmojiStatus       string     `json:"emojiStatus"`
	EquippedBorder    string     `json:"equippedBorder"`
	EquippedSkin      string     `json:"equippedSkin"`
	AirdropCoins      float64    `json:"airdropCoins"`
	Energy            int        `json:"energy"`
	EnergyUpdatedAt   time.Time  `json:"energyUpdatedAt"`
	ServerNow         int64      `json:"serverNow"`
	PhotoURL          string     `json:"photoUrl,omitempty"`
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
}

type ReferralHubData struct {
	ReferralCode string           `json:"referralCode"`
	TotalInvited int              `json:"totalInvited"`
	TotalEarned  float64          `json:"totalEarned"`
	Friends      []ReferralFriend `json:"friends"`
}

type AchievementDef struct {
	ID     string `json:"id"`
	Target int    `json:"target"`
}

type CosmeticItem struct {
	ID          string  `json:"id"`
	Type        string  `json:"type"` // "border" or "skin"
	Name        string  `json:"name"`
	Cost        float64 `json:"cost"` // in FRG
	Purchased   bool    `json:"purchased"`
	BorderClass string  `json:"borderClass,omitempty"` // CSS class name for styling
	SkinClass   string  `json:"skinClass,omitempty"`   // CSS class name for styling
}
