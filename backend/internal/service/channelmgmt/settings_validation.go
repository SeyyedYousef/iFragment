package channelmgmt

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type GeneralSettingsSchema struct {
	Language string `json:"language,omitempty"`
	Timezone string `json:"timezone,omitempty"`

	// Canonical Channel Identity & Configuration
	Name              string `json:"name,omitempty"`
	Description       string `json:"description,omitempty"`
	Photo             string `json:"photo,omitempty"`
	Username          string `json:"username,omitempty"`
	SignMessages      bool   `json:"signMessages"`
	CustomSignature   string `json:"customSignature,omitempty"`
	ProtectContent    bool   `json:"protectContent"`
	DiscussionGroupID string `json:"discussionGroupId,omitempty"`

	// Legacy alias compatibility fields
	ChannelName     string `json:"channelName,omitempty"`
	ChannelBio      string `json:"channelBio,omitempty"`
	ChannelPhotoUrl string `json:"channelPhotoUrl,omitempty"`
	ChannelUsername string `json:"channelUsername,omitempty"`
	DiscussionGroup string `json:"discussionGroup,omitempty"`
}

type PostingSettingsSchema struct {
	Signature        string `json:"signature,omitempty"`
	WatermarkEnabled bool   `json:"watermarkEnabled"`
	WatermarkText    string `json:"watermarkText,omitempty"`
	CleanInterval    int    `json:"cleanInterval,omitempty"`

	AiProvider          string `json:"aiProvider,omitempty"`
	ApiKey              string `json:"apiKey,omitempty"`
	AiModel             string `json:"aiModel,omitempty"`
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
	} `json:"rules,omitempty"`
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
	} `json:"buttons,omitempty"`
}

type DynamicBioSettingsSchema struct {
	Enabled           bool        `json:"enabled"`
	Template          string      `json:"template,omitempty"`
	BioTemplate       string      `json:"bioTemplate,omitempty"`
	DisplayInName     bool        `json:"displayInName"`
	NameTemplate      string      `json:"nameTemplate,omitempty"`
	Interval          interface{} `json:"interval,omitempty"`
	EnableCountdown   bool        `json:"enableCountdown"`
	EventName         string      `json:"eventName,omitempty"`
	TargetDate        string      `json:"targetDate,omitempty"`
	CountdownLocation string      `json:"countdownLocation,omitempty"`
	PostExpiryText    string      `json:"postExpiryText,omitempty"`
	Fields            []string    `json:"fields,omitempty"`
}

type AutoResponderRuleSchema struct {
	ID        string `json:"id,omitempty"`
	Keys      string `json:"keys"`
	ReplyText string `json:"replyText"`
	Match     string `json:"match"` // "exact", "contains", "regex", "keyword", "ai"
	Enabled   *bool  `json:"enabled,omitempty"`
	UseAI     bool   `json:"useAi,omitempty"`
	Trigger   string `json:"trigger,omitempty"`
	Response  string `json:"response,omitempty"`
	Type      string `json:"type,omitempty"`
}

type AutoResponderSchema struct {
	Enabled          bool                      `json:"enabled"`
	AutoFirstComment bool                      `json:"autoFirstComment,omitempty"`
	CommentMode      string                    `json:"commentMode,omitempty"` // "fixed", "rotating", "ai"
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
		if utf8.RuneCountInString(channelName) > 128 {
			return fmt.Errorf("channel name cannot exceed 128 characters")
		}
		if utf8.RuneCountInString(channelBio) > 255 {
			return fmt.Errorf("channel bio cannot exceed 255 characters")
		}
		if utf8.RuneCountInString(channelUsername) > 32 {
			return fmt.Errorf("channel username cannot exceed 32 characters")
		}

	case "posting":
		var s PostingSettingsSchema
		if err := json.Unmarshal(data, &s); err != nil {
			return fmt.Errorf("invalid posting settings structure: %w", err)
		}
		if s.Signature != "" && utf8.RuneCountInString(s.Signature) > 200 {
			return fmt.Errorf("signature too long (max 200 chars)")
		}
		if s.WatermarkText != "" && utf8.RuneCountInString(s.WatermarkText) > 100 {
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
		if len(s.Rules) > 50 {
			return fmt.Errorf("maximum 50 forwarding rules allowed")
		}

	case "inline_buttons":
		var s InlineButtonsSettingsSchema
		if err := json.Unmarshal(data, &s); err != nil {
			return fmt.Errorf("invalid inline_buttons settings structure: %w", err)
		}
		if len(s.Buttons) > 25 {
			return fmt.Errorf("maximum 25 inline buttons allowed")
		}
		for _, btn := range s.Buttons {
			btn.Title = strings.TrimSpace(btn.Title)
			if btn.Title == "" {
				return fmt.Errorf("button title cannot be empty")
			}
			if utf8.RuneCountInString(btn.Title) > 64 {
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
		if bioTemplate != "" && utf8.RuneCountInString(bioTemplate) > 255 {
			return fmt.Errorf("bio template too long (Telegram limit: 255 chars)")
		}
		if s.NameTemplate != "" && utf8.RuneCountInString(s.NameTemplate) > 128 {
			return fmt.Errorf("name template too long (Telegram limit: 128 chars)")
		}
		interval, err := normalizeDynamicBioInterval(s.Interval)
		if err != nil {
			return fmt.Errorf("invalid dynamic bio interval: %w", err)
		}
		if interval < 0 {
			return fmt.Errorf("dynamic bio interval must be positive")
		}
		if interval > 0 && interval < 10 {
			return fmt.Errorf("dynamic bio interval must be at least 10 minutes (or 0 to disable)")
		}

	case "auto_responder":
		var s AutoResponderSchema
		if err := json.Unmarshal(data, &s); err != nil {
			return fmt.Errorf("invalid auto_responder settings structure: %w", err)
		}
		if len(s.Rules) > 100 {
			return fmt.Errorf("maximum 100 auto-responder rules allowed")
		}
		for _, r := range s.Rules {
			key := firstNonEmpty(r.Keys, r.Trigger)
			val := firstNonEmpty(r.ReplyText, r.Response)
			if key == "" && r.Match != "ai" {
				return fmt.Errorf("trigger key cannot be empty for rule")
			}
			if val == "" && !r.UseAI && r.Match != "ai" {
				return fmt.Errorf("reply text cannot be empty for rule")
			}
		}

	default:
		return fmt.Errorf("unknown settings category: %s", category)
	}

	return nil
}
