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

type OwnerDashboardStats struct {
	DAU            int            `json:"dau"`
	MAU            int            `json:"mau"`
	TotalUsers     int            `json:"total_users"`
	FrgCirculation float64        `json:"frg_circulation"`
	TonVolume      float64        `json:"ton_volume"`
	RecentActivity []OwnerAuditLog `json:"recent_activity"`
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
