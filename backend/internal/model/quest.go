package model

import (
	"encoding/json"
	"time"
)

type Quest struct {
	Key             string          `json:"key"`
	Title           string          `json:"title"`
	Type            string          `json:"type"` // 'channel_join', 'quiz', 'referral', 'campaign', 'link', 'social', etc.
	RewardFrg       float64         `json:"reward_frg"`
	RewardXp        int             `json:"reward_xp"`
	Config          json.RawMessage `json:"config"`
	IsActive        bool            `json:"is_active"`
	ExpiresAt       *time.Time      `json:"expires_at,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	ParentKey       *string         `json:"parent_key,omitempty"` // For grouped tasks (Campaigns)
	ProgressCurrent int             `json:"progress_current,omitempty"` // Dynamically computed
	ProgressTarget  int             `json:"progress_target,omitempty"`  // Dynamically computed
	ActionText      string          `json:"action_text,omitempty"`      // e.g. "@ifragment_channel"
	ActionURL       string          `json:"action_url,omitempty"`       // e.g. "https://t.me/ifragment_channel"
	IsPremiumReq    bool            `json:"is_premium_req,omitempty"`
	IsClanReq       bool            `json:"is_clan_req,omitempty"`
}
