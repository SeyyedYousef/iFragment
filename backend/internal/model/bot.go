package model

import (
	"time"

	"github.com/google/uuid"
)

type ManagedBot struct {
	ID                 uuid.UUID `json:"id"`
	OwnerUserID        int64     `json:"owner_user_id"`
	BotTokenEncrypted  []byte    `json:"-"`
	BotUsername        string    `json:"bot_username"`
	BotName            string    `json:"bot_name"`
	BotID              int64     `json:"bot_id"`
	Status             string    `json:"status"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
	ManagedGroupsCount int       `json:"managed_groups_count"`
	SubscriptionStatus string    `json:"subscription_status"`
	WebhookSecretToken string    `json:"webhook_secret_token"`
}

type BillingSubscription struct {
	ID          uuid.UUID `json:"id"`
	UserID      int64     `json:"user_id"`
	GroupID     uuid.UUID `json:"group_id"`
	PackageID   string    `json:"package_id"`
	GroupsLimit int       `json:"groups_limit"`
	AmountFRG   float64   `json:"amount_frg"`
	Period      string    `json:"period"`
	Status      string    `json:"status"`
	StartsAt    time.Time `json:"starts_at"`
	ExpiresAt   time.Time `json:"expires_at"`
}

type ManagedGroup struct {
	ID                 uuid.UUID  `json:"id"`
	BotID              uuid.UUID  `json:"bot_id"`
	ChatID             int64      `json:"chat_id"`
	ChatTitle          string     `json:"chat_title"`
	ChatType           string     `json:"chat_type"`
	MembersCount       int        `json:"members_count"`
	PhotoURL           string     `json:"photo_url,omitempty"`
	SubscriptionStatus string     `json:"subscription_status"`
	TrialEndsAt        time.Time  `json:"trial_ends_at"`
	PaidUntil          *time.Time `json:"paid_until,omitempty"`
	ConnectedByUserID  *int64     `json:"connected_by_user_id,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}
