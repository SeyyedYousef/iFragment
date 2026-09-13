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
		"settings.menu_title",
		"settings.btn_content",
		"settings.btn_limits",
		"settings.btn_quiet",
		"settings.btn_ephemeral",
		"settings.btn_mandatory",
		"settings.btn_welcome",
		"settings.btn_general",
		"settings.btn_refresh",
		"settings.btn_close",
		"settings.btn_back",
		"settings.status_on",
		"settings.status_off",
		"toasts.settings_refreshed",
		"toasts.only_admins",
		"toasts.menu_closed",
		"toasts.link_enabled",
		"toasts.group_locked",
		"admin.info_text",
		"admin.stats_text",
		"admin.clean_success",
		"admin.debug_text",
		"admin.welcome_status",
		"admin.title_success",
		"admin.report_sent",
		"botmgmt.reminder_48h",
		"botmgmt.reminder_24h",
		"botmgmt.reminder_short",
		"botmgmt.expired",
		"gamification.miner_full_title",
		"gamification.miner_full_desc",
		"language.prompt",
	}

	testParams := map[string]interface{}{
		"id":          123456789,
		"name":        "TestUser",
		"error":       "Forbidden",
		"duration":    "24h",
		"count":       3,
		"threshold":   3,
		"seconds":     15,
		"group":       "TestGroup",
		"reason":      "Spam",
		"rules":       "Be respectful",
		"question":    "5 + 3 = ?",
		"start":       "23:00",
		"end":         "07:00",
		"status":      "Active",
		"links":       "✅",
		"forwards":    "❌",
		"cas":         "✅",
		"flood":       "5/10s",
		"slowmode":    "Off",
		"quiet":       "Off",
		"ephemeral":   "Off",
		"mandatory":   "Off",
		"welcome":     "On",
		"captcha":     "On",
		"title":       "Group",
		"chat_id":     -100123,
		"bot_username": "TestBot",
		"expires":     "2026-10-01",
		"members":     100,
		"messages":    500,
		"new_members": 10,
		"left_members": 2,
		"spam_blocked": 5,
		"active_users": 50,
		"db_status":   "UP",
		"cache_status": "UP",
		"latency":     12,
		"bot_id":      12345,
		"perms":       "All",
		"link":        "t.me/test",
		"fj":          "Off",
		"eph":         "Off",
		"sub_status":  "Active",
		"template":    "Welcome",
		"reporter_id": 111,
		"target_id":   222,
		"msg_id":      333,
		"remaining":   "6h",
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

func TestNoPersianDigitsInDicts(t *testing.T) {
	dicts := map[string]map[string]interface{}{
		"en": enDict,
		"fa": faDict,
		"ru": ruDict,
		"zh": zhDict,
		"ar": arDict,
	}

	persianDigits := "۰۱۲۳۴۵۶۷۸۹"
	arabicDigits := "٠١٢٣٤٥٦٧٨٩"

	var checkValue func(lang, path string, val interface{})
	checkValue = func(lang, path string, val interface{}) {
		switch v := val.(type) {
		case string:
			if strings.ContainsAny(v, persianDigits) {
				t.Errorf("[%s] Key %q contains Persian digits: %q", lang, path, v)
			}
			if strings.ContainsAny(v, arabicDigits) {
				t.Errorf("[%s] Key %q contains Arabic digits: %q", lang, path, v)
			}
		case map[string]interface{}:
			for k, subVal := range v {
				checkValue(lang, path+"."+k, subVal)
			}
		case map[string]string:
			for k, subVal := range v {
				checkValue(lang, path+"."+k, subVal)
			}
		}
	}

	for lang, dict := range dicts {
		for k, val := range dict {
			checkValue(lang, k, val)
		}
	}
}

func TestToEnglishDigits(t *testing.T) {
	inputPersian := "شماره ۱۲۳۴۵۶۷۸۹۰ در تاریخ ۱۴۰۳/۰۶/۲۴"
	expected := "شماره 1234567890 در تاریخ 1403/06/24"
	got := ToEnglishDigits(inputPersian)
	if got != expected {
		t.Errorf("ToEnglishDigits(%q) = %q, want %q", inputPersian, got, expected)
	}

	inputArabic := "العدد ١٢٣٤٥٦٧٨٩٠"
	expectedArabic := "العدد 1234567890"
	gotArabic := ToEnglishDigits(inputArabic)
	if gotArabic != expectedArabic {
		t.Errorf("ToEnglishDigits(%q) = %q, want %q", inputArabic, gotArabic, expectedArabic)
	}

	// Test T() automatically converts arguments containing Persian digits
	res := T("fa", "moderation.purged_count", map[string]interface{}{"count": "۲۵"})
	if strings.Contains(res, "۲۵") {
		t.Errorf("Expected T to convert argument digits to English, but got: %s", res)
	}
	if !strings.Contains(res, "25") {
		t.Errorf("Expected T to contain '25', got: %s", res)
	}
}

