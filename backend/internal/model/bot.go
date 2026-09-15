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
	SubscriptionStatus string    `json:"subscription_status"`
	WebhookSecretToken string    `json:"webhook_secret_token"`
}
