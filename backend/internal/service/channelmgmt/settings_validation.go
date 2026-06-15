package channelmgmt

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

type GeneralSettingsSchema struct {
	Language            string `json:"language"`
	Timezone            string `json:"timezone"`
	WelcomeMessage      bool   `json:"welcomeMessage"`
	WarningMessage      bool   `json:"warningMessage"`
	AutoDeleteBot       bool   `json:"autoDeleteBot"`
	AutoDeleteDelay     int    `json:"autoDeleteDelay"`
	TrackAdmin          bool   `json:"trackAdmin"`
	VerifyMembers       bool   `json:"verifyMembers"`
	PublicCommands      bool   `json:"publicCommands"`
	HideJoinLeave       bool   `json:"hideJoinLeave"`
	DefaultPenalty      string `json:"defaultPenalty"`
	AutoWarning         bool   `json:"autoWarning"`
	WarningThreshold    int    `json:"warningThreshold"`
	WarningRetention    int    `json:"warningRetention"`
	WarningFinalPenalty string `json:"warningFinalPenalty"`
	CasEnabled          bool   `json:"casEnabled"`
	AntiRaidThreshold   int    `json:"antiRaidThreshold"`
	AntiRaidAction      string `json:"antiRaidAction"`

	// Phase 1 Identity & Channel Moderation Config parameters
	ChannelName         string `json:"channelName"`
	ChannelBio          string `json:"channelBio"`
	ChannelPhotoUrl     string `json:"channelPhotoUrl"`
	ChannelUsername     string `json:"channelUsername"`
	AdminProfileDisplay bool   `json:"adminProfileDisplay"`
	HideHistory         bool   `json:"hideHistory"`
	HideMemberList      bool   `json:"hideMemberList"`
	TelegramAntiSpam    bool   `json:"telegramAntiSpam"`
	SlowMode            string `json:"slowMode"`
	AutoDeleteTimer     string `json:"autoDeleteTimer"`
	DiscussionGroup     string `json:"discussionGroup"`
	ApproveAccountAge   bool   `json:"approveAccountAge"`
	ApproveProfilePhoto bool   `json:"approveProfilePhoto"`
}

type PostingSettingsSchema struct {
	Signature       string `json:"signature,omitempty"`
	WatermarkEnabled bool   `json:"watermarkEnabled"`
	WatermarkText   string `json:"watermarkText,omitempty"`
	CleanInterval   int    `json:"cleanInterval,omitempty"`
}

type ForwardingSettingsSchema struct {
	Rules []struct {
		SourceChannel string   `json:"sourceChannel"`
		TargetChannel string   `json:"targetChannel"`
		ContentTypes  []string `json:"contentTypes"`
		RemoveAds     bool     `json:"removeAds"`
		RemoveLinks   bool     `json:"removeLinks"`
	} `json:"rules"`
}

type InlineButtonsSettingsSchema struct {
	Buttons []struct {
		Title string `json:"title"`
		Value string `json:"value"`
		Type  string `json:"type"`
		Style string `json:"style"`
		Emoji string `json:"emoji,omitempty"`
	} `json:"buttons"`
}

type DynamicBioSettingsSchema struct {
	Enabled  bool     `json:"enabled"`
	Template string   `json:"template"`
	Interval int      `json:"interval"`
	Fields   []string `json:"fields,omitempty"`
}

type AutoResponderRuleSchema struct {
	Trigger  string `json:"trigger"`
	Response string `json:"response"`
	Type     string `json:"type"`
}

type AutoResponderSchema struct {
	Enabled bool                      `json:"enabled"`
	Rules   []AutoResponderRuleSchema `json:"rules"`
}

// ValidateSettingsCategory strictly validates settings JSON against defined schemas
func ValidateSettingsCategory(category string, data json.RawMessage) error {
	if len(data) == 0 || string(data) == "null" {
		return fmt.Errorf("settings data cannot be null or empty")
	}
	if string(data) == "{}" {
		return nil
	}

	switch category {
	case "general":
		var s GeneralSettingsSchema
		if err := json.Unmarshal(data, &s); err != nil {
			return fmt.Errorf("invalid general settings structure: %w", err)
		}
		if s.Language != "" && s.Language != "fa" && s.Language != "en" && s.Language != "ru" && s.Language != "zh" {
			return fmt.Errorf("invalid language selection: %s", s.Language)
		}
		if len(s.ChannelName) > 128 {
			return fmt.Errorf("channel name cannot exceed 128 characters")
		}
		if len(s.ChannelBio) > 255 {
			return fmt.Errorf("channel bio cannot exceed 255 characters")
		}
		if len(s.ChannelUsername) > 32 {
			return fmt.Errorf("channel username cannot exceed 32 characters")
		}

	case "posting":
		var s PostingSettingsSchema
		if err := json.Unmarshal(data, &s); err != nil {
			return fmt.Errorf("invalid posting settings structure: %w", err)
		}
		if s.Signature != "" && len(s.Signature) > 200 {
			return fmt.Errorf("signature too long (max 200 chars)")
		}
		if s.WatermarkText != "" && len(s.WatermarkText) > 100 {
			return fmt.Errorf("watermark text too long (max 100 chars)")
		}
		if s.CleanInterval < 0 || s.CleanInterval > 168 {
			return fmt.Errorf("clean interval must be 0-168 hours")
		}

	case "forwarding":
		var s ForwardingSettingsSchema
		if err := json.Unmarshal(data, &s); err != nil {
			return fmt.Errorf("invalid forwarding settings structure: %w", err)
		}
		if len(s.Rules) > 20 {
			return fmt.Errorf("maximum 20 forwarding rules allowed")
		}

	case "inline_buttons":
		var s InlineButtonsSettingsSchema
		if err := json.Unmarshal(data, &s); err != nil {
			return fmt.Errorf("invalid inline_buttons settings structure: %w", err)
		}
		if len(s.Buttons) > 15 {
			return fmt.Errorf("maximum 15 inline buttons allowed")
		}
		for _, btn := range s.Buttons {
			btn.Title = strings.TrimSpace(btn.Title)
			if btn.Title == "" {
				return fmt.Errorf("button title cannot be empty")
			}
			if len(btn.Title) > 64 {
				return fmt.Errorf("button title must not exceed 64 characters")
			}
			if btn.Value == "" {
				return fmt.Errorf("button value cannot be empty")
			}
			btnType := strings.ToLower(btn.Type)
			if btnType != "url" && btnType != "callback" && btnType != "share" && btnType != "webapp" && btnType != "payment" && btnType != "counter" {
				return fmt.Errorf("invalid button type: %s", btn.Type)
			}
			if btnType == "url" {
				u, err := url.Parse(btn.Value)
				if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
					return fmt.Errorf("invalid URL: must be a valid http or https address")
				}
			}
			if btnType == "webapp" {
				u, err := url.Parse(btn.Value)
				if err != nil || u.Scheme != "https" {
					return fmt.Errorf("invalid WebApp URL: must be a secure https address")
				}
			}
		}

	case "dynamic_bio":
		var s DynamicBioSettingsSchema
		if err := json.Unmarshal(data, &s); err != nil {
			return fmt.Errorf("invalid dynamic_bio settings structure: %w", err)
		}
		if s.Template != "" && len(s.Template) > 70 {
			return fmt.Errorf("bio template too long (Telegram limit: 70 chars)")
		}
		if s.Interval < 0 || s.Interval > 1440 {
			return fmt.Errorf("interval must be 0-1440 minutes")
		}

	case "auto_responder":
		var s AutoResponderSchema
		if err := json.Unmarshal(data, &s); err != nil {
			return fmt.Errorf("invalid auto_responder structure: %w", err)
		}
		if len(s.Rules) > 50 {
			return fmt.Errorf("maximum 50 auto-responder rules allowed")
		}
		for _, rule := range s.Rules {
			if rule.Trigger == "" || rule.Response == "" {
				return fmt.Errorf("trigger and response cannot be empty")
			}
			if len(rule.Trigger) > 200 {
				return fmt.Errorf("trigger text too long (max 200 chars)")
			}
			if len(rule.Response) > 4096 {
				return fmt.Errorf("response text too long (max 4096 chars)")
			}
			if rule.Type != "exact" && rule.Type != "contains" {
				return fmt.Errorf("rule type must be 'exact' or 'contains'")
			}
		}

	default:
		return fmt.Errorf("unknown settings category: %s", category)
	}

	return nil
}
