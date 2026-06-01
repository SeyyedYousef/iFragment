package botmgmt

import (
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/repository"
	"net/url"
	"regexp"
)

var hhmmRegex = regexp.MustCompile(`^(?:[01]\d|2[0-3]):[0-5]\d$`)

// ValidateSettingsCategory performs deep validation on the raw settings JSON based on the category.
func ValidateSettingsCategory(category string, raw json.RawMessage) error {
	if len(raw) > 128*1024 {
		return fmt.Errorf("settings payload exceeds maximum allowed size")
	}

	switch category {
	case "general":
		var g repository.SettingsGeneral
		if err := json.Unmarshal(raw, &g); err != nil {
			return fmt.Errorf("invalid general settings payload: %w", err)
		}
		if g.AutoDeleteDelay < 0 || g.AutoDeleteDelay > 86400 {
			return fmt.Errorf("autoDeleteDelay must be between 0 and 86400 seconds")
		}
		if g.WarningThreshold < 0 || g.WarningThreshold > 100 {
			return fmt.Errorf("warningThreshold must be between 0 and 100")
		}
		if g.WarningRetention < 0 || g.WarningRetention > 43200 { // 30 days
			return fmt.Errorf("warningRetention must be between 0 and 43200 minutes")
		}
		if g.AntiRaidThreshold < 0 || g.AntiRaidThreshold > 1000 {
			return fmt.Errorf("antiRaidThreshold must be between 0 and 1000")
		}
		if len(g.Language) > 10 {
			return fmt.Errorf("language code too long")
		}
		if len(g.Timezone) > 50 {
			return fmt.Errorf("timezone string too long")
		}

	case "content_restrictions":
		var c repository.SettingsContentRestrictions
		if err := json.Unmarshal(raw, &c); err != nil {
			return fmt.Errorf("invalid content restrictions payload: %w", err)
		}
		restrictions := []repository.RestrictionDetail{
			c.RemoveLinks, c.BlockBots, c.RemoveBotInviters, c.BlockDomains,
			c.BlockUsernames, c.BlockHashtags, c.BlockTextPatterns, c.BlockEmojis,
			c.BlockEmojiOnly, c.BlockPhoneNumbers, c.BlockPhotos, c.BlockStickers,
			c.BlockLocations, c.BlockAudio, c.BlockVoiceMessages, c.BlockFiles,
			c.BlockGifs, c.BlockCaptionless, c.BlockForwards, c.RestrictChannelForwards,
			c.BlockAppMessages, c.BlockPolls, c.BlockInlineKeyboards, c.BlockGames,
			c.BlockSlashCommands, c.BlockUserReplies, c.BlockCrossChatReplies,
			c.BlockLatinLetters, c.BlockPersianArabicLetters, c.BlockCyrillicLetters,
			c.BlockChineseCharacters,
		}
		for _, r := range restrictions {
			if r.Enabled {
				if r.Window != "Always" && r.Window != "QuietHours" && r.Window != "Custom" {
					return fmt.Errorf("invalid restriction window: %s", r.Window)
				}
				if r.Window == "Custom" {
					if !hhmmRegex.MatchString(r.Start) || !hhmmRegex.MatchString(r.End) {
						return fmt.Errorf("invalid custom window time format (HH:MM expected): start=%s, end=%s", r.Start, r.End)
					}
				}
				validPenalties := map[string]bool{"none": true, "delete": true, "warn": true, "mute_1h": true, "mute_24h": true, "kick": true, "ban": true}
				if r.Penalty != "" && !validPenalties[r.Penalty] {
					return fmt.Errorf("invalid restriction penalty: %s", r.Penalty)
				}
			}
		}
		if len(c.ForwardWhitelist) > 1000 || len(c.BannedKeywords) > 1000 || len(c.RequiredKeywords) > 1000 {
			return fmt.Errorf("whitelists and keywords lists exceed maximum allowed length of 1000 items")
		}
		for _, kw := range c.BannedKeywords {
			if len(kw) > 256 {
				return fmt.Errorf("keyword exceeds maximum length of 256 characters")
			}
		}

	case "limits":
		var l repository.SettingsLimits
		if err := json.Unmarshal(raw, &l); err != nil {
			return fmt.Errorf("invalid limits payload: %w", err)
		}
		if l.MinLen < 0 || l.MinLen > 4096 || l.MaxLen < 0 || l.MaxLen > 4096 {
			return fmt.Errorf("message length bounds must be between 0 and 4096")
		}
		if l.MaxLen > 0 && l.MinLen > l.MaxLen {
			return fmt.Errorf("minimum message length cannot exceed maximum message length")
		}
		if l.FloodMsgs < 0 || l.FloodMsgs > 1000 {
			return fmt.Errorf("floodMessages must be between 0 and 1000")
		}
		if l.FloodWin < 0 || l.FloodWin > 86400 {
			return fmt.Errorf("floodWindow must be between 0 and 86400 seconds")
		}
		if l.DupCount < 0 || l.DupCount > 1000 {
			return fmt.Errorf("duplicateCount must be between 0 and 1000")
		}
		if l.DupWin < 0 || l.DupWin > 1440 {
			return fmt.Errorf("duplicateWindow must be between 0 and 1440 minutes")
		}

	case "quiet_hours":
		var q repository.SettingsQuietHours
		if err := json.Unmarshal(raw, &q); err != nil {
			return fmt.Errorf("invalid quiet hours payload: %w", err)
		}
		if len(q.Periods) > 10 {
			return fmt.Errorf("cannot configure more than 10 quiet periods")
		}
		for _, p := range q.Periods {
			if !hhmmRegex.MatchString(p.Start) || !hhmmRegex.MatchString(p.End) {
				return fmt.Errorf("invalid quiet hours period format (HH:MM expected): start=%s, end=%s", p.Start, p.End)
			}
		}

	case "mandatory_membership":
		var m repository.SettingsMandatoryMembership
		if err := json.Unmarshal(raw, &m); err != nil {
			return fmt.Errorf("invalid mandatory membership payload: %w", err)
		}
		if m.ForcedAddCount < 0 || m.ForcedAddCount > 100 {
			return fmt.Errorf("forcedAddCount must be between 0 and 100")
		}
		if len(m.RequiredChannels) > 10 {
			return fmt.Errorf("cannot require membership in more than 10 channels")
		}
		if len(m.Exemptions) > 100 {
			return fmt.Errorf("exemptions list cannot exceed 100 items")
		}

	case "custom_texts":
		var c repository.SettingsCustomTexts
		if err := json.Unmarshal(raw, &c); err != nil {
			return fmt.Errorf("invalid custom texts payload: %w", err)
		}
		texts := []string{c.WelcomeText, c.WarningText, c.SilenceStartText, c.SilenceEndText, c.RulesText, c.ForceJoinText, c.ForceAddText}
		for _, t := range texts {
			if len(t) > 4096 {
				return fmt.Errorf("custom text fields must not exceed 4096 characters")
			}
		}
		if len(c.InlineButtons) > 10 {
			return fmt.Errorf("cannot configure more than 10 inline buttons")
		}
		for _, b := range c.InlineButtons {
			if len(b.Title) > 64 {
				return fmt.Errorf("inline button title must not exceed 64 characters")
			}
			if len(b.URL) > 512 {
				return fmt.Errorf("inline button URL must not exceed 512 characters")
			}
			if b.URL != "" {
				if _, err := url.ParseRequestURI(b.URL); err != nil {
					return fmt.Errorf("invalid URL in inline button: %s", b.URL)
				}
			}
		}

	default:
		return fmt.Errorf("unknown settings category: %s", category)
	}

	return nil
}
