package channelmgmt

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
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
	Name                string `json:"name"`
	Description         string `json:"description"`
	Photo               string `json:"photo"`
	Username            string `json:"username"`
	ShowAdminProfile    bool   `json:"showAdminProfile"`
	HideChatHistory     bool   `json:"hideChatHistory"`
	AntiSpam            bool   `json:"antiSpam"`
	AutoDelete          int    `json:"autoDelete"`
	DiscussionGroupID   string `json:"discussionGroupId"`
	JoinReqAge          int    `json:"joinReqAge"`
	JoinReqPhoto        bool   `json:"joinReqPhoto"`
	ChannelName         string `json:"channelName"`
	ChannelBio          string `json:"channelBio"`
	ChannelPhotoUrl     string `json:"channelPhotoUrl"`
	ChannelUsername     string `json:"channelUsername"`
	AdminProfileDisplay bool   `json:"adminProfileDisplay"`
	HideHistory         bool   `json:"hideHistory"`
	HideMemberList      bool   `json:"hideMemberList"`
	TelegramAntiSpam    bool   `json:"telegramAntiSpam"`
	SlowMode            interface{} `json:"slowMode"`
	AutoDeleteTimer     interface{} `json:"autoDeleteTimer"`
	DiscussionGroup     string `json:"discussionGroup"`
	ApproveAccountAge   bool   `json:"approveAccountAge"`
	ApproveProfilePhoto bool   `json:"approveProfilePhoto"`

	// Missing General Settings Phase 2 UI properties
	SignMessages       bool   `json:"signMessages"`
	ProtectContent     bool   `json:"protectContent"`
	CustomSignature    string `json:"customSignature"`
	AutoForward        bool   `json:"autoForward"`
	ForwardDestination string `json:"forwardDestination"`

	// Join requests UI properties
	JoinRequestsEnabled bool `json:"joinRequestsEnabled"`
	ApprovePremium      bool `json:"approvePremium"`
	ApproveGifts        bool `json:"approveGifts"`
	ApproveCollectibles bool `json:"approveCollectibles"`
}

type PostingSettingsSchema struct {
	Signature        string `json:"signature,omitempty"`
	WatermarkEnabled bool   `json:"watermarkEnabled"`
	WatermarkText    string `json:"watermarkText,omitempty"`
	CleanInterval    int    `json:"cleanInterval,omitempty"`

	AiProvider          string `json:"aiProvider,omitempty"`
	ApiKey              string `json:"apiKey,omitempty"`
	Tone                string `json:"tone,omitempty"`
	AiConfirmBeforeEdit bool   `json:"aiConfirmBeforeEdit,omitempty"`
	AiComposerEnabled   bool   `json:"aiComposerEnabled,omitempty"`
	SelectedSkill       string `json:"selectedSkill,omitempty"`
	CustomSkillPrompt   string `json:"customSkillPrompt,omitempty"`
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
	Enabled *bool  `json:"enabled,omitempty"`
	Preset  string `json:"preset,omitempty"`
	Buttons []struct {
		Title string `json:"title"`
		Value string `json:"value"`
		Type  string `json:"type"`
		Style string `json:"style"`
		Emoji string `json:"emoji,omitempty"`
	} `json:"buttons"`
}

type DynamicBioSettingsSchema struct {
	Enabled           bool        `json:"enabled"`
	Template          string      `json:"template"`
	BioTemplate       string      `json:"bioTemplate"`
	DisplayInName     bool        `json:"displayInName"`
	NameTemplate      string      `json:"nameTemplate"`
	Interval          interface{} `json:"interval"`
	EnableCountdown   bool        `json:"enableCountdown"`
	EventName         string      `json:"eventName"`
	TargetDate        string      `json:"targetDate"`
	CountdownLocation string      `json:"countdownLocation"`
	PostExpiryText    string      `json:"postExpiryText"`
	Fields            []string    `json:"fields,omitempty"`
}

type AutoResponderRuleSchema struct {
	ID        string `json:"id,omitempty"`
	Keys      string `json:"keys"`
	ReplyText string `json:"replyText"`
	Match     string `json:"match"`
	Enabled   *bool  `json:"enabled,omitempty"`
	UseAI     bool   `json:"useAi,omitempty"`
	Trigger   string `json:"trigger"`
	Response  string `json:"response"`
	Type      string `json:"type"`
}

type AutoResponderSchema struct {
	Enabled          bool                      `json:"enabled"`
	AutoFirstComment bool                      `json:"autoFirstComment,omitempty"`
	CommentMode      string                    `json:"commentMode,omitempty"`
	FixedComment     string                    `json:"fixedComment,omitempty"`
	RotatingTexts    []string                  `json:"rotatingTexts,omitempty"`
	AttachButton     string                    `json:"attachButton,omitempty"`
	NewMemberWelcome bool                      `json:"newMemberWelcome,omitempty"`
	WelcomeDelay     string                    `json:"welcomeDelay,omitempty"`
	WelcomeText      string                    `json:"welcomeText,omitempty"`
	Rules            []AutoResponderRuleSchema `json:"rules"`
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func normalizeDynamicBioInterval(value interface{}) (int, error) {
	if value == nil {
		return 0, nil
	}
	switch v := value.(type) {
	case float64:
		return int(v), nil
	case int:
		return v, nil
	case string:
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			return 0, nil
		}
		if minutes, err := strconv.Atoi(trimmed); err == nil {
			return minutes, nil
		}
		duration, err := time.ParseDuration(trimmed)
		if err != nil {
			return 0, fmt.Errorf("invalid interval: %s", trimmed)
		}
		return int(duration.Minutes()), nil
	default:
		return 0, fmt.Errorf("invalid interval type")
	}
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
		channelName := firstNonEmpty(s.Name, s.ChannelName)
		channelBio := firstNonEmpty(s.Description, s.ChannelBio)
		channelUsername := firstNonEmpty(s.Username, s.ChannelUsername)
		if len(channelName) > 128 {
			return fmt.Errorf("channel name cannot exceed 128 characters")
		}
		if len(channelBio) > 255 {
			return fmt.Errorf("channel bio cannot exceed 255 characters")
		}
		if len(channelUsername) > 32 {
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
			if btnType == "url" || btnType == "share" {
				if btnType == "share" && btn.Value == "share" {
					// Allowed literal value for share presets
				} else {
					u, err := url.Parse(btn.Value)
					if err != nil || (u.Scheme != "http" && u.Scheme != "https" && u.Scheme != "tg") {
						return fmt.Errorf("invalid URL: must be a valid http or https address")
					}
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
		bioTemplate := firstNonEmpty(s.BioTemplate, s.Template)
		if bioTemplate != "" && len(bioTemplate) > 255 {
			return fmt.Errorf("bio template too long (Telegram limit: 255 chars)")
		}
		if s.NameTemplate != "" && len(s.NameTemplate) > 128 {
			return fmt.Errorf("name template too long (Telegram limit: 128 chars)")
		}
		interval, err := normalizeDynamicBioInterval(s.Interval)
		if err != nil {
			return err
		}
		if interval < 0 || interval > 1440 {
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
			if rule.Enabled != nil && !*rule.Enabled {
				continue
			}
			trigger := firstNonEmpty(rule.Keys, rule.Trigger)
			response := firstNonEmpty(rule.ReplyText, rule.Response)
			match := firstNonEmpty(rule.Match, rule.Type)
			if trigger == "" || response == "" {
				return fmt.Errorf("trigger and response cannot be empty")
			}
			if len(trigger) > 200 {
				return fmt.Errorf("trigger text too long (max 200 chars)")
			}
			if len(response) > 4096 {
				return fmt.Errorf("response text too long (max 4096 chars)")
			}
			if match != "" && match != "exact" && match != "contains" && match != "regex" && match != "keyword" {
				return fmt.Errorf("rule type must be 'exact', 'contains', 'regex', or 'keyword'")
			}
		}

	default:
		return fmt.Errorf("unknown settings category: %s", category)
	}

	return nil
}
