package model

import "time"

type Clan struct {
	ID                string    `json:"id"`
	TelegramChannelID int64     `json:"telegram_channel_id"`
	ChannelUsername   string    `json:"channel_username"`
	ChannelPhoto      string    `json:"channel_photo,omitempty"`
	ChatTitle         string    `json:"chat_title"`
	MembersCount      int       `json:"members_count"`
	TotalScore        float64   `json:"total_score,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
}

type UserClanDetails struct {
	Clan     *Clan      `json:"clan,omitempty"`
	IsMember bool       `json:"is_member"`
	JoinedAt *time.Time `json:"joined_at,omitempty"`
}
