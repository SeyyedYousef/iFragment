package i18n

import (
	"strings"
	"testing"
)

func TestDetectLanguage(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"fa", "fa"},
		{"fa-IR", "fa"},
		{"ir", "fa"},
		{"ru", "ru"},
		{"ru-RU", "ru"},
		{"zh", "zh"},
		{"zh-CN", "zh"},
		{"zh-Hans", "zh"},
		{"ar", "ar"},
		{"ar-SA", "ar"},
		{"en", "en"},
		{"en-US", "en"},
		{"fr", "en"}, // fallback to en
		{"", "en"},
	}

	for _, tt := range tests {
		got := DetectLanguage(tt.input)
		if got != tt.expected {
			t.Errorf("DetectLanguage(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestModerationAndVerificationKeysInAllLanguages(t *testing.T) {
	languages := []string{"fa", "en", "ru", "zh"}

	keys := []string{
		"moderation.no_ban_perm",
		"moderation.user_banned",
		"moderation.no_unban_perm",
		"moderation.user_unbanned",
		"moderation.no_mute_perm",
		"moderation.user_muted",
		"moderation.no_unmute_perm",
		"moderation.user_unmuted",
		"moderation.no_rules",
		"moderation.rules_title",
		"moderation.deleted_notice",
		"moderation.fail_ban",
		"moderation.fail_unban",
		"moderation.fail_kick",
		"moderation.fail_mute",
		"moderation.fail_unmute",
		"moderation.user_kicked",
		"moderation.warns_cleared",
		"moderation.group_locked",
		"moderation.group_unlocked",
		"moderation.user_muted_dur",
		"moderation.user_warns_count",
		"moderation.warned_by_admin",
		"moderation.ephemeral_disabled",
		"moderation.ephemeral_enabled",
		"moderation.purge_reply_req",
		"moderation.purged_count",
		"moderation.setrules_usage",
		"moderation.rules_updated",
		"moderation.antispam_enabled",
		"moderation.antispam_disabled",
		"moderation.quiet_hours_disabled",
		"moderation.quiet_hours_set",
		"moderation.quiet_hours_usage",
		"moderation.quiet_hours_status",
		"verification.pv_prompt",
		"verification.captcha_expired",
		"verification.captcha_incorrect",
		"verification.captcha_success",
		"verification.captcha_prompt",
	}

	testParams := map[string]interface{}{
		"id":        123456789,
		"name":      "TestUser",
		"error":     "Forbidden",
		"duration":  "24h",
		"count":     3,
		"threshold": 3,
		"seconds":   15,
		"group":     "TestGroup",
		"reason":    "Spam",
		"rules":     "Be respectful",
		"question":  "5 + 3 = ?",
		"start":     "23:00",
		"end":       "07:00",
		"status":    "Active",
	}

	for _, lang := range languages {
		t.Run("Language_"+lang, func(t *testing.T) {
			for _, key := range keys {
				result := T(lang, key, testParams)
				// Result must not equal key (which indicates missing translation)
				if result == key {
					t.Errorf("Language %q missing key %q (returned raw key)", lang, key)
				}
				// Result must not be empty
				if strings.TrimSpace(result) == "" {
					t.Errorf("Language %q has empty translation for key %q", lang, key)
				}
			}
		})
	}
}

func TestTemplateInterpolation(t *testing.T) {
	// Map replacement
	res := T("en", "moderation.fail_ban", map[string]interface{}{"error": "Access Denied"})
	if !strings.Contains(res, "Access Denied") {
		t.Errorf("Expected interpolation of error, got: %s", res)
	}

	// Positional fallback
	resPos := T("en", "onboarding.thanks", "Elite Traders")
	if !strings.Contains(resPos, "Elite Traders") {
		t.Errorf("Expected positional replacement of {arg0}, got: %s", resPos)
	}
}
