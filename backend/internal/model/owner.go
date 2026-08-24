package model

import (
	"encoding/json"
	"time"
)

type OwnerRole struct {
	ID                  int        `json:"id"`
	TelegramUserID      int64      `json:"telegram_user_id"`
	Role                string     `json:"role"` // 'super_admin', 'admin', 'moderator', 'support'
	TotpSecret          string     `json:"-"`
	TotpEnabled         bool       `json:"totp_enabled"`
	TotpEnabledAt       *time.Time `json:"totp_enabled_at,omitempty"`
	RecoveryCodesHashes []string   `json:"-"`
	PasswordHash        string     `json:"-"`
	IPWhitelist         []string   `json:"ip_whitelist"`
	CreatedAt           time.Time  `json:"created_at"`
	LastLoginAt         *time.Time `json:"last_login_at"`
}

type OwnerAuditLog struct {
	ID           int64           `json:"id"`
	OwnerID      int64           `json:"owner_id"`
	Action       string          `json:"action"`
	TargetUserID *int64          `json:"target_user_id,omitempty"`
	TargetID     string          `json:"target_id,omitempty"`
	Payload      json.RawMessage `json:"payload,omitempty"`
	IPAddress    string          `json:"ip_address,omitempty"`
	UserAgent    string          `json:"user_agent,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}

type UserBan struct {
	UserID    int64      `json:"user_id"`
	BanType   string     `json:"ban_type"` // 'full', 'shadow', 'wallet_freeze'
	Reason    string     `json:"reason,omitempty"`
	BannedBy  int64      `json:"banned_by"`
	BannedAt  time.Time  `json:"banned_at"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

type ImpersonationSession struct {
	ID              string          `json:"id"`
	OwnerID         int64           `json:"owner_id"`
	TargetUserID    int64           `json:"target_user_id"`
	StartedAt       time.Time       `json:"started_at"`
	EndedAt         *time.Time      `json:"ended_at,omitempty"`
	DurationSeconds int             `json:"duration_seconds,omitempty"`
	ActionsTaken    json.RawMessage `json:"actions_taken,omitempty"`
}

type ChartPoint struct {
	Date  string  `json:"date"`
	Value float64 `json:"value"`
}

type TodayEconomy struct {
	MintedToday       float64 `json:"minted_today"`
	BurnedToday       float64 `json:"burned_today"`
	DecayedToday      float64 `json:"decayed_today"`
	RevSharePaidToday float64 `json:"rev_share_paid_today"`
}

type OwnerDashboardStats struct {
	DAU              int             `json:"dau"`
	MAU              int             `json:"mau"`
	TotalUsers       int             `json:"total_users"`
	FrgCirculation   float64         `json:"frg_circulation"`
	CoinsCirculation float64         `json:"coins_circulation"`
	StarsVolume      float64         `json:"stars_volume"`
	DauTrend         float64         `json:"dau_trend"`
	MauTrend         float64         `json:"mau_trend"`
	RevenueTrend     float64         `json:"revenue_trend"`
	CirculationTrend float64         `json:"circulation_trend"`
	TodayEconomy     TodayEconomy    `json:"today_economy"`
	TotpEnabled      bool            `json:"totp_enabled"`
	TotpGraceDays    int             `json:"totp_grace_days_left"`
	RecentActivity   []OwnerAuditLog `json:"recent_activity"`
	DauChart         []ChartPoint    `json:"dau_chart"`
	CoinFlowChart    []ChartPoint    `json:"coin_flow_chart"`
	RecentSignups    []SearchedUser  `json:"recent_signups,omitempty"`
}

type SearchedUser struct {
	TelegramID   int64     `json:"telegram_id"`
	Username     string    `json:"username"`
	FirstName    string    `json:"first_name"`
	LastName     string    `json:"last_name"`
	LanguageCode string    `json:"language_code"`
	Balance      float64   `json:"balance"`
	IsPremium    bool      `json:"is_premium"`
	IsFlagged    bool      `json:"is_flagged"`
	FraudReason  string    `json:"fraud_reason,omitempty"`
	IsBanned     bool      `json:"is_banned"`
	BanType      string    `json:"ban_type,omitempty"`
	BanReason    string    `json:"ban_reason,omitempty"`
	BanExpiresAt *time.Time `json:"ban_expires_at,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type PromoCode struct {
	Code         string     `json:"code"`
	RewardAmount float64    `json:"reward_amount"`
	MaxUses      int        `json:"max_uses"`
	UsesCount    int        `json:"uses_count"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

type PromoRedemption struct {
	ID         int       `json:"id"`
	Code       string    `json:"code"`
	UserID     int64     `json:"user_id"`
	RedeemedAt time.Time `json:"redeemed_at"`
}

type ManagedUserbot struct {
	ID            string    `json:"id"`
	PhoneNumber   string    `json:"phone_number"`
	Status        string    `json:"status"`
	ChannelsCount int       `json:"channels_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type DashboardAd struct {
	ID        string     `json:"id"`
	Slot      string     `json:"slot,omitempty"`
	Title     string     `json:"title"`
	AltText   string     `json:"alt_text,omitempty"`
	ImageURL  string     `json:"image_url"`
	TargetURL string     `json:"target_url,omitempty"`
	Target    string     `json:"target,omitempty"` // legacy alias
	IsActive  bool       `json:"is_active"`
	Priority  int        `json:"priority,omitempty"`
	StartDate *time.Time `json:"start_date,omitempty"`
	EndDate   *time.Time `json:"end_date,omitempty"`
}

type AdCampaign struct {
	ID               string     `json:"id"`
	Slot             string     `json:"slot"`
	Title            string     `json:"title"`
	AltText          string     `json:"alt_text"`
	ImageURL         string     `json:"image_url"`
	TargetURL        string     `json:"target_url"`
	IsActive         bool       `json:"is_active"`
	Priority         int        `json:"priority"`
	StartDate        *time.Time `json:"start_date,omitempty"`
	EndDate          *time.Time `json:"end_date,omitempty"`
	ImpressionsCount int64      `json:"impressions_count"`
	ClicksCount      int64      `json:"clicks_count"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type SystemSettings struct {
	MaintenanceMode      bool          `json:"maintenance_mode"`
	TapMultiplier        float64       `json:"tap_multiplier"`
	ReferralBonus        int           `json:"referral_bonus"`
	DailyRewardBase      int           `json:"daily_reward_base"`
	FatigueThreshold1    int           `json:"fatigue_threshold_1,omitempty"`
	FatigueThreshold2    int           `json:"fatigue_threshold_2,omitempty"`
	FatigueThreshold3    int           `json:"fatigue_threshold_3,omitempty"`
	TapBotCapSeconds     int           `json:"tap_bot_cap_seconds,omitempty"`
	ReferralRevSharePct  float64       `json:"referral_rev_share_pct,omitempty"`
	CoinDecayPct         float64       `json:"coin_decay_pct,omitempty"`
	CoinExpiryDays       int           `json:"coin_expiry_days,omitempty"`
	TurboDurationSeconds int           `json:"turbo_duration_seconds,omitempty"`
	InflationCap         float64       `json:"inflation_cap,omitempty"`
	DashboardAds         []DashboardAd `json:"dashboard_ads,omitempty"`
	Version              int           `json:"version"`
}

type Broadcast struct {
	ID             string     `json:"id"`
	OwnerID        int64      `json:"owner_id"`
	TargetAudience string     `json:"target_audience"` // 'all', 'premium', 'active_7d', 'inactive'
	Message        string     `json:"message"`
	Status         string     `json:"status"` // 'draft', 'scheduled', 'sending', 'completed', 'failed', 'paused'
	ScheduledAt    *time.Time `json:"scheduled_at,omitempty"`
	SentCount      int        `json:"sent_count"`
	TotalCount     int        `json:"total_count"`
	FailedCount    int        `json:"failed_count"`
	StartedAt      *time.Time `json:"started_at,omitempty"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type OrderRecord struct {
	ID        string    `json:"id"`
	UserID    int64     `json:"user_id"`
	Amount    int       `json:"amount"`
	Status    string    `json:"status"`
	Payload   string    `json:"payload"`
	CreatedAt time.Time `json:"created_at"`
}

type FinanceSummary struct {
	TotalRevenueStars   int64   `json:"total_revenue_stars"`
	Revenue7d           int64   `json:"revenue_7d"`
	Revenue30d          int64   `json:"revenue_30d"`
	TotalOrders         int64   `json:"total_orders"`
	ActiveSubscriptions int64   `json:"active_subscriptions"`
	ChurnRate           float64 `json:"churn_rate"`
}

type PremiumEntity struct {
	EntityType    string     `json:"entity_type"` // "channel" or "group"
	EntityID      string     `json:"entity_id"`
	Title         string     `json:"title"`
	OwnerID       int64      `json:"owner_id"`
	CreditBalance float64    `json:"credit_balance"`
	PremiumUntil  *time.Time `json:"premium_until"`
}

type SystemErrorLog struct {
	ID           string    `json:"id"`
	Source       string    `json:"source"`
	ErrorMessage string    `json:"error_message"`
	Level        string    `json:"level,omitempty"` // "error", "warn", "info"
	CreatedAt    time.Time `json:"created_at"`
}

type SystemHealthMetrics struct {
	DBStatus          string `json:"db_status"`
	DBLatencyMS       int64  `json:"db_latency_ms"`
	RedisStatus       string `json:"redis_status"`
	ActiveGoroutines  int    `json:"active_goroutines"`
	MemoryUsedMB      uint64 `json:"memory_used_mb"`
	AllocatedMB       uint64 `json:"allocated_mb"`
	TotalSysMB        uint64 `json:"total_sys_mb"`
	CPUUsagePercent   float64 `json:"cpu_usage_percent"`
	UptimeSeconds     int64  `json:"uptime_seconds"`
	RecentErrorsCount int    `json:"recent_errors_count"`
	Goroutines        int    `json:"goroutines,omitempty"`
}

type EntityRecord struct {
	ID            string     `json:"id"`
	EntityType    string     `json:"entity_type"`
	EntityID      string     `json:"entity_id"`
	Title         string     `json:"title"`
	Status        string     `json:"status"`
	OwnerID       int64      `json:"owner_id"`
	OwnerUsername string     `json:"owner_username,omitempty"`
	CreditBalance float64    `json:"credit_balance"`
	PaidUntil     *time.Time `json:"paid_until,omitempty"`
}
