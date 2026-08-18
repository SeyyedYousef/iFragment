package model

import "time"

type DailyClaimState struct {
	UserID        int64      `json:"user_id"`
	LastClaimedAt *time.Time `json:"last_claimed_at"`
	Streak        int        `json:"streak"`
}

type UserBoosts struct {
	UserID           int64 `json:"user_id"`
	MultitapLevel    int   `json:"multitap_level"`
	EnergyLimitLevel int   `json:"energy_limit_level"`
	TapBotLevel      int   `json:"tap_bot_level"`
}

type UserTask struct {
	TaskKey     string     `json:"task_key"`
	Completed   bool       `json:"completed"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}
