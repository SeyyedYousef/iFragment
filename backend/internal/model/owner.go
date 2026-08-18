package model

import (
	"encoding/json"
	"time"
)

type OwnerRole struct {
	ID             int        `json:"id"`
	TelegramUserID int64      `json:"telegram_user_id"`
	Role           string     `json:"role"` // 'super_admin', 'admin', 'moderator', 'support'
	TotpSecret     string     `json:"-"`
	IPWhitelist    []string   `json:"ip_whitelist"`
	CreatedAt      time.Time  `json:"created_at"`
	LastLoginAt    *time.Time `json:"last_login_at"`
}

type OwnerAuditLog struct {
	ID           int64           `json:"id"`
	OwnerID      int64           `json:"owner_id"`
	Action       string          `json:"action"`
	TargetUserID *int64          `json:"target_user_id,omitempty"`
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
	ID           string          `json:"id"`
	OwnerID      int64           `json:"owner_id"`
	TargetUserID int64           `json:"target_user_id"`
	StartedAt    time.Time       `json:"started_at"`
	EndedAt      *time.Time      `json:"ended_at,omitempty"`
	ActionsTaken json.RawMessage `json:"actions_taken,omitempty"`
}

type ChartPoint struct {
	Date  string  `json:"date"`
	Value float64 `json:"value"`
}

type OwnerDashboardStats struct {
	DAU            int             `json:"dau"`
	MAU            int             `json:"mau"`
	TotalUsers     int             `json:"total_users"`
	FrgCirculation float64         `json:"frg_circulation"`
	StarsVolume    float64         `json:"stars_volume"`
	RecentActivity []OwnerAuditLog `json:"recent_activity"`
	DauChart       []ChartPoint    `json:"dau_chart"`
	CoinFlowChart  []ChartPoint    `json:"coin_flow_chart"`
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
	ID       string `json:"id"`
	Title    string `json:"title"`
	ImageURL string `json:"image_url"`
	Target   string `json:"target"`
	IsActive bool   `json:"is_active"`
}

type SystemSettings struct {
	MaintenanceMode bool          `json:"maintenance_mode"`
	TapMultiplier   float64       `json:"tap_multiplier"`
	ReferralBonus   int           `json:"referral_bonus"`
	DailyRewardBase int           `json:"daily_reward_base"`
	DashboardAds    []DashboardAd `json:"dashboard_ads,omitempty"`
}

type Broadcast struct {
	ID             string    `json:"id"`
	OwnerID        int64     `json:"owner_id"`
	TargetAudience string    `json:"target_audience"` // 'all', 'premium', 'active'
	Message        string    `json:"message"`
	Status         string    `json:"status"` // 'pending', 'processing', 'completed', 'failed'
	SentCount      int       `json:"sent_count"`
	CreatedAt      time.Time `json:"created_at"`
}

type OrderRecord struct {
	ID        string    `json:"id"`
	UserID    int64     `json:"user_id"`
	Amount    int       `json:"amount"`
	Status    string    `json:"status"`
	Payload   string    `json:"payload"`
	CreatedAt time.Time `json:"created_at"`
}

type PremiumEntity struct {
	EntityType   string     `json:"entity_type"` // "channel" or "group"
	EntityID     string     `json:"entity_id"`
	Title        string     `json:"title"`
	OwnerID      int64      `json:"owner_id"`
	PremiumUntil *time.Time `json:"premium_until"`
}

type SystemErrorLog struct {
	ID           string    `json:"id"`
	Source       string    `json:"source"`
	ErrorMessage string    `json:"error_message"`
	CreatedAt    time.Time `json:"created_at"`
}

type SystemHealthMetrics struct {
	DBStatus          string `json:"db_status"`
	DBLatencyMS       int64  `json:"db_latency_ms"`
	RedisStatus       string `json:"redis_status"`
	ActiveGoroutines  int    `json:"active_goroutines"`
	MemoryUsedMB      uint64 `json:"memory_used_mb"`
	UptimeSeconds     int64  `json:"uptime_seconds"`
	RecentErrorsCount int    `json:"recent_errors_count"`
	Goroutines        int    `json:"goroutines,omitempty"`
	AllocatedMB       uint64 `json:"allocated_mb,omitempty"`
	TotalSysMB        uint64 `json:"total_sys_mb,omitempty"`
}

type EntityRecord struct {
	ID         string `json:"id"`
	EntityType string `json:"entity_type"`
	EntityID   string `json:"entity_id"`
	Title      string `json:"title"`
	Status     string `json:"status"`
	OwnerID    int64  `json:"owner_id"`
}
