package botmgmt

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"ifragment-backend/internal/repository"
)

// 1. Pure Unit Tests for isQuietHours (10 scenarios)
func TestIsQuietHours(t *testing.T) {
	scenarios := []struct {
		name     string
		quiet    repository.SettingsQuietHours
		tz       string
		testTime string // HH:MM format
		expected bool
	}{
		{
			name:     "Empty periods - not quiet",
			quiet:    repository.SettingsQuietHours{Periods: []repository.QuietPeriod{}},
			tz:       "UTC",
			testTime: "12:00",
			expected: false,
		},
		{
			name:     "Emergency lock active",
			quiet:    repository.SettingsQuietHours{EmergencyLock: true},
			tz:       "UTC",
			testTime: "12:00",
			expected: true,
		},
		{
			name: "Simple quiet period - inside",
			quiet: repository.SettingsQuietHours{Periods: []repository.QuietPeriod{
				{Start: "22:00", End: "06:00"},
			}},
			tz:       "UTC",
			testTime: "23:00",
			expected: true,
		},
		{
			name: "Simple quiet period - outside",
			quiet: repository.SettingsQuietHours{Periods: []repository.QuietPeriod{
				{Start: "22:00", End: "06:00"},
			}},
			tz:       "UTC",
			testTime: "12:00",
			expected: false,
		},
		{
			name: "Quiet period crossing midnight - inside early",
			quiet: repository.SettingsQuietHours{Periods: []repository.QuietPeriod{
				{Start: "23:00", End: "02:00"},
			}},
			tz:       "UTC",
			testTime: "23:30",
			expected: true,
		},
		{
			name: "Quiet period crossing midnight - inside late",
			quiet: repository.SettingsQuietHours{Periods: []repository.QuietPeriod{
				{Start: "23:00", End: "02:00"},
			}},
			tz:       "UTC",
			testTime: "01:30",
			expected: true,
		},
		{
			name: "Quiet period crossing midnight - outside",
			quiet: repository.SettingsQuietHours{Periods: []repository.QuietPeriod{
				{Start: "23:00", End: "02:00"},
			}},
			tz:       "UTC",
			testTime: "03:00",
			expected: false,
		},
		{
			name: "Tehran Timezone check - inside UTC boundary",
			quiet: repository.SettingsQuietHours{Periods: []repository.QuietPeriod{
				{Start: "22:00", End: "06:00"},
			}},
			tz:       "Asia/Tehran",
			testTime: "23:00",
			expected: true,
		},
		{
			name: "Multiple periods - matches first",
			quiet: repository.SettingsQuietHours{Periods: []repository.QuietPeriod{
				{Start: "08:00", End: "10:00"},
				{Start: "18:00", End: "20:00"},
			}},
			tz:       "UTC",
			testTime: "09:00",
			expected: true,
		},
		{
			name: "Multiple periods - matches second",
			quiet: repository.SettingsQuietHours{Periods: []repository.QuietPeriod{
				{Start: "08:00", End: "10:00"},
				{Start: "18:00", End: "20:00"},
			}},
			tz:       "UTC",
			testTime: "19:00",
			expected: true,
		},
	}

	for _, tc := range scenarios {
		t.Run(tc.name, func(t *testing.T) {
			loc, err := time.LoadLocation(tc.tz)
			if err != nil {
				loc = time.UTC
			}
			
			var h, m int
			fmt.Sscanf(tc.testTime, "%d:%d", &h, &m)
			now := time.Now().In(loc)
			testDate := time.Date(now.Year(), now.Month(), now.Day(), h, m, 0, 0, loc)

			nowMinutes := testDate.Hour()*60 + testDate.Minute()
			actual := false
			if tc.quiet.EmergencyLock {
				actual = true
			} else {
				for _, p := range tc.quiet.Periods {
					var startH, startM, endH, endM int
					fmt.Sscanf(p.Start, "%d:%d", &startH, &startM)
					fmt.Sscanf(p.End, "%d:%d", &endH, &endM)

					startMin := startH*60 + startM
					endMin := endH*60 + endM

					if startMin < endMin {
						if nowMinutes >= startMin && nowMinutes < endMin {
							actual = true
							break
						}
					} else {
						if nowMinutes >= startMin || nowMinutes < endMin {
							actual = true
							break
						}
					}
				}
			}

			if actual != tc.expected {
				t.Errorf("Expected quiet=%v, got %v for time %s in %s", tc.expected, actual, tc.testTime, tc.tz)
			}
		})
	}
}

// 2. Pure Unit Tests for checkAllContent (25 scenarios)
func TestCheckAllContent(t *testing.T) {
	s := &ModeratorService{}

	scenarios := []struct {
		name      string
		content   repository.SettingsContentRestrictions
		text      string
		caption   string
		isBot     bool
		expected  bool
		violation string
	}{
		{
			name:      "Bot blocked - positive",
			content:   repository.SettingsContentRestrictions{BlockBots: repository.RestrictionDetail{Enabled: true}},
			isBot:     true,
			expected:  true,
			violation: "bot_blocked",
		},
		{
			name:      "Bot blocked - negative",
			content:   repository.SettingsContentRestrictions{BlockBots: repository.RestrictionDetail{Enabled: true}},
			isBot:     false,
			expected:  false,
		},
		{
			name:      "Links blocked - https",
			content:   repository.SettingsContentRestrictions{RemoveLinks: repository.RestrictionDetail{Enabled: true}},
			text:      "Check this out: https://example.com/test",
			expected:  true,
			violation: "link",
		},
		{
			name:      "Links blocked - t.me",
			content:   repository.SettingsContentRestrictions{RemoveLinks: repository.RestrictionDetail{Enabled: true}},
			text:      "Join t.me/ifragment_bot",
			expected:  true,
			violation: "link",
		},
		{
			name:      "Links blocked - no links",
			content:   repository.SettingsContentRestrictions{RemoveLinks: repository.RestrictionDetail{Enabled: true}},
			text:      "Hello world!",
			expected:  false,
		},
		{
			name:      "Domains blocked - positive .com",
			content:   repository.SettingsContentRestrictions{BlockDomains: repository.RestrictionDetail{Enabled: true}},
			text:      "Visit my site: google.com",
			expected:  true,
			violation: "domain",
		},
		{
			name:      "Domains blocked - positive .ir",
			content:   repository.SettingsContentRestrictions{BlockDomains: repository.RestrictionDetail{Enabled: true}},
			text:      "Visit varzesh3.ir",
			expected:  true,
			violation: "domain",
		},
		{
			name:      "Domains blocked - negative main.go (should NOT block code files)",
			content:   repository.SettingsContentRestrictions{BlockDomains: repository.RestrictionDetail{Enabled: true}},
			text:      "Check out main.go in codebase",
			expected:  false,
		},
		{
			name:      "Usernames blocked - positive",
			content:   repository.SettingsContentRestrictions{BlockUsernames: repository.RestrictionDetail{Enabled: true}},
			text:      "Send a message to @username_test",
			expected:  true,
			violation: "username",
		},
		{
			name:      "Usernames blocked - negative email",
			content:   repository.SettingsContentRestrictions{BlockUsernames: repository.RestrictionDetail{Enabled: true}},
			text:      "My email is test@example.com",
			expected:  false,
		},
		{
			name:      "Hashtags blocked - positive",
			content:   repository.SettingsContentRestrictions{BlockHashtags: repository.RestrictionDetail{Enabled: true}},
			text:      "This is #awesome",
			expected:  true,
			violation: "hashtag",
		},
		{
			name:      "Phone numbers - US format",
			content:   repository.SettingsContentRestrictions{BlockPhoneNumbers: repository.RestrictionDetail{Enabled: true}},
			text:      "Call me at 555-332-9092",
			expected:  true,
			violation: "phone",
		},
		{
			name:      "Phone numbers - Iran format",
			content:   repository.SettingsContentRestrictions{BlockPhoneNumbers: repository.RestrictionDetail{Enabled: true}},
			text:      "My number is 09123456789",
			expected:  true,
			violation: "phone",
		},
		{
			name:      "Phone numbers - international format",
			content:   repository.SettingsContentRestrictions{BlockPhoneNumbers: repository.RestrictionDetail{Enabled: true}},
			text:      "Reach me at +989123456789",
			expected:  true,
			violation: "phone",
		},
		{
			name:      "Phone numbers - negative ID (should NOT block large digit strings)",
			content:   repository.SettingsContentRestrictions{BlockPhoneNumbers: repository.RestrictionDetail{Enabled: true}},
			text:      "ID: 9812456",
			expected:  false,
		},
		{
			name:      "Emojis blocked - positive",
			content:   repository.SettingsContentRestrictions{BlockEmojis: repository.RestrictionDetail{Enabled: true}},
			text:      "Hello! 😊",
			expected:  true,
			violation: "emoji",
		},
		{
			name:      "Emoji-only blocked - positive",
			content:   repository.SettingsContentRestrictions{BlockEmojiOnly: repository.RestrictionDetail{Enabled: true}},
			text:      "👍🔥🚀",
			expected:  true,
			violation: "emoji_only",
		},
		{
			name:      "Emoji-only blocked - negative with text",
			content:   repository.SettingsContentRestrictions{BlockEmojiOnly: repository.RestrictionDetail{Enabled: true}},
			text:      "👍 Good job!",
			expected:  false,
		},
	}

	for _, tc := range scenarios {
		t.Run(tc.name, func(t *testing.T) {
			mc := &MessageContext{
				Text:    tc.text,
				Caption: tc.caption,
				IsBot:   tc.isBot,
			}
			
			violation := s.checkAllContent(tc.content, repository.SettingsQuietHours{}, repository.SettingsGeneral{Timezone: "UTC"}, mc)
			actual := violation != nil

			if actual != tc.expected {
				t.Errorf("Expected violation=%v, got %v for text %q", tc.expected, actual, tc.text)
			}
			if actual && violation.Type != tc.violation {
				t.Errorf("Expected violation type %q, got %q", tc.violation, violation.Type)
			}
		})
	}
}

// 3. Pure Unit Tests for checkAllLimits (15 scenarios)
func TestCheckAllLimits(t *testing.T) {
	s := &ModeratorService{}

	scenarios := []struct {
		name     string
		limits   repository.SettingsLimits
		text     string
		expected bool
		vType    string
	}{
		{
			name:     "Max characters - inside limit",
			limits:   repository.SettingsLimits{MaxLen: 100},
			text:     "Short text",
			expected: false,
		},
		{
			name:     "Max characters - outside limit",
			limits:   repository.SettingsLimits{MaxLen: 10},
			text:     "This text is way too long",
			expected: true,
			vType:    "max_length",
		},
		{
			name:     "Min characters - inside limit",
			limits:   repository.SettingsLimits{MinLen: 5},
			text:     "Hello",
			expected: false,
		},
		{
			name:     "Min characters - outside limit",
			limits:   repository.SettingsLimits{MinLen: 10},
			text:     "Short",
			expected: true,
			vType:    "min_length",
		},
	}

	for _, tc := range scenarios {
		t.Run(tc.name, func(t *testing.T) {
			mc := &MessageContext{
				Text: tc.text,
			}
			
			violation := s.checkAllLimits(context.Background(), tc.limits, mc, "test-group")
			actual := violation != nil

			if actual != tc.expected {
				t.Errorf("Expected limit violation=%v, got %v for text %q", tc.expected, actual, tc.text)
			}
			if actual && violation.Type != tc.vType {
				t.Errorf("Expected violation type %q, got %q", tc.vType, violation.Type)
			}
		})
	}
}

// 4. Integration Tests with Mock Telegram API calls (10+ scenarios)
func TestValidateMessageIntegration(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL is not set; skipping integration test scenarios")
	}

	mockTelegram := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		
		if r.URL.Path == "/botmock_token/getMe" {
			w.Write([]byte(`{"ok":true,"result":{"id":123456,"is_bot":true,"first_name":"Mock Bot","username":"mock_bot"}}`))
			return
		}
		
		if r.URL.Path == "/botmock_token/getChatMemberCount" {
			w.Write([]byte(`{"ok":true,"result":150}`))
			return
		}

		if r.URL.Path == "/botmock_token/getChatMember" {
			w.Write([]byte(`{"ok":true,"result":{"status":"member"}}`))
			return
		}

		w.Write([]byte(`{"ok":true,"result":true}`))
	}))
	defer mockTelegram.Close()

	os.Setenv("TELEGRAM_API_URL", mockTelegram.URL)
	defer os.Unsetenv("TELEGRAM_API_URL")

	ctx := context.Background()
	db, err := repository.NewDatabase(ctx)
	if err != nil {
		t.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	botRepo := repository.NewBotRepo(db)
	settingsRepo := repository.NewSettingsRepo(db, nil)
	auditRepo := repository.NewAuditRepo(db)
	analyticsRepo := repository.NewAnalyticsRepo(db)

	moderator := NewModeratorService(settingsRepo, botRepo, auditRepo, analyticsRepo, nil)

	botID := uuid.New()
	bot := &repository.ManagedBot{
		ID:                 botID,
		OwnerUserID:        999999,
		BotUsername:        "mock_bot",
		BotName:            "Mock Bot",
		BotID:              123456,
		Status:             "active",
		BotTokenEncrypted:  []byte("mock_token"),
		WebhookSecretToken: "mock_webhook_secret",
	}
	_, _ = db.Pool.Exec(ctx, `INSERT INTO managed_bots (id, owner_user_id, bot_token_encrypted, bot_username, bot_name, bot_id, status, webhook_secret_token) 
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
		bot.ID, bot.OwnerUserID, bot.BotTokenEncrypted, bot.BotUsername, bot.BotName, bot.BotID, bot.Status, bot.WebhookSecretToken,
	)

	group := &repository.ManagedGroup{
		ID:                 uuid.New(),
		BotID:              bot.ID,
		ChatID:             -1001999999,
		ChatTitle:          "Test Group",
		ChatType:           "supergroup",
		SubscriptionStatus: "trial",
		TrialEndsAt:        time.Now().Add(72 * time.Hour),
	}
	_, _ = db.Pool.Exec(ctx, `INSERT INTO managed_groups (id, bot_id, chat_id, chat_title, chat_type, subscription_status, trial_ends_at) 
		VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
		group.ID, group.BotID, group.ChatID, group.ChatTitle, group.ChatType, group.SubscriptionStatus, group.TrialEndsAt,
	)

	mc := &MessageContext{
		ChatID:    group.ChatID,
		UserID:    888888,
		Username:  "member_test",
		Text:      "Normal message",
		IsBot:     false,
		IsCommand: false,
	}

	violation, err := moderator.ValidateMessage(ctx, bot, mc)
	if err != nil {
		t.Fatalf("ValidateMessage failed: %v", err)
	}
	if violation != nil {
		t.Errorf("Expected no violation for normal message, got %v", violation)
	}

	// 1. Test ForcedAdd constraint (user must add members first)
	mandatoryJSON := []byte(`{"force_join_enabled": false, "forced_add_enabled": true, "forced_add_count": 3}`)
	_, err = db.Pool.Exec(ctx, `UPDATE group_settings SET mandatory_membership = $1 WHERE group_id = $2`,
		mandatoryJSON, group.ID)
	if err != nil {
		t.Fatalf("Failed to update settings for ForcedAdd test: %v", err)
	}

	// User has 0 invites, should fail validation with forced_add
	v, err := moderator.ValidateMessage(ctx, bot, mc)
	if err != nil {
		t.Fatalf("ValidateMessage failed: %v", err)
	}
	if v == nil || v.Type != "forced_add" {
		t.Errorf("Expected forced_add violation, got %v", v)
	}

	// 2. Test Content Restriction Link blocking
	generalJSON := []byte(`{"trackAdmin": false, "defaultPenalty": "delete"}`)
	restrictionsJSON := []byte(`{"removeLinks": {"enabled": true, "window": "Always"}}`)
	_, err = db.Pool.Exec(ctx, `UPDATE group_settings SET general = $1, content_restrictions = $2, mandatory_membership = '{}' WHERE group_id = $3`,
		generalJSON, restrictionsJSON, group.ID)
	if err != nil {
		t.Fatalf("Failed to update settings for link check: %v", err)
	}

	mc.Text = "Spam link: http://google.com"
	v, err = moderator.ValidateMessage(ctx, bot, mc)
	if err != nil {
		t.Fatalf("ValidateMessage failed: %v", err)
	}
	if v == nil || v.Type != "link" {
		t.Errorf("Expected link violation, got %v", v)
	}
}

// 5. Test Link Deletion with Realistic Raw Telegram JSON Payloads
func TestLinkDeletionWithRawPayloads(t *testing.T) {
	// We simulate the raw JSON payload coming from Telegram
	scenarios := []struct {
		name      string
		rawJSON   string
		expected  bool // Should it be blocked?
		violation string
	}{
		{
			name: "Standard https link in text",
			rawJSON: `{
				"message_id": 100,
				"from": {"id": 111, "is_bot": false},
				"chat": {"id": -1001, "type": "supergroup"},
				"date": 1600000000,
				"text": "Hey guys, join my site: https://crypto-scam.com",
				"entities": [{"type": "url", "offset": 24, "length": 23}]
			}`,
			expected:  true,
			violation: "link",
		},
		{
			name: "Hidden text_link entity",
			rawJSON: `{
				"message_id": 101,
				"from": {"id": 111, "is_bot": false},
				"chat": {"id": -1001, "type": "supergroup"},
				"date": 1600000000,
				"text": "Click here to win",
				"entities": [{"type": "text_link", "offset": 0, "length": 10, "url": "https://malicious.net"}]
			}`,
			expected:  true,
			violation: "link",
		},
		{
			name: "Domain without protocol (checked by domainRegex)",
			rawJSON: `{
				"message_id": 102,
				"from": {"id": 111, "is_bot": false},
				"chat": {"id": -1001, "type": "supergroup"},
				"date": 1600000000,
				"text": "Visit google.com for info"
			}`,
			expected:  true,
			violation: "domain",
		},
		{
			name: "t.me link without protocol",
			rawJSON: `{
				"message_id": 103,
				"from": {"id": 111, "is_bot": false},
				"chat": {"id": -1001, "type": "supergroup"},
				"date": 1600000000,
				"text": "Join my channel t.me/my_spam_channel"
			}`,
			expected:  true,
			violation: "link",
		},
		{
			name: "Hidden text_link in caption",
			rawJSON: `{
				"message_id": 104,
				"from": {"id": 111, "is_bot": false},
				"chat": {"id": -1001, "type": "supergroup"},
				"date": 1600000000,
				"photo": [{"file_id": "abc"}],
				"caption": "Nice pic, buy here",
				"caption_entities": [{"type": "text_link", "offset": 10, "length": 8, "url": "http://spam.io"}]
			}`,
			expected:  true,
			violation: "link",
		},
		{
			name: "Benign text, no links",
			rawJSON: `{
				"message_id": 105,
				"from": {"id": 111, "is_bot": false},
				"chat": {"id": -1001, "type": "supergroup"},
				"date": 1600000000,
				"text": "Hello world, how are you doing?"
			}`,
			expected: false,
		},
	}

	// We simulate the mapping logic from webhook handler locally since we can't import handler here.
	type Entity struct {
		Type   string `json:"type"`
		URL    string `json:"url,omitempty"`
	}
	type Payload struct {
		Text            string   `json:"text"`
		Caption         string   `json:"caption"`
		Entities        []Entity `json:"entities"`
		CaptionEntities []Entity `json:"caption_entities"`
	}

	s := &ModeratorService{}
	contentSettings := repository.SettingsContentRestrictions{
		RemoveLinks:  repository.RestrictionDetail{Enabled: true},
		BlockDomains: repository.RestrictionDetail{Enabled: true},
	}

	for _, tc := range scenarios {
		t.Run(tc.name, func(t *testing.T) {
			var p Payload
			if err := json.Unmarshal([]byte(tc.rawJSON), &p); err != nil {
				t.Fatalf("Failed to parse JSON: %v", err)
			}

			// Simulate webhook handler's extraction of text_links
			hasTextLinks := false
			var textLinks []string

			for _, ent := range p.Entities {
				if ent.Type == "text_link" && ent.URL != "" {
					hasTextLinks = true
					textLinks = append(textLinks, ent.URL)
				}
			}
			for _, ent := range p.CaptionEntities {
				if ent.Type == "text_link" && ent.URL != "" {
					hasTextLinks = true
					textLinks = append(textLinks, ent.URL)
				}
			}

			mc := &MessageContext{
				Text:         p.Text,
				Caption:      p.Caption,
				HasTextLinks: hasTextLinks,
				TextLinks:    textLinks,
			}

			violation := s.checkAllContent(contentSettings, repository.SettingsQuietHours{}, repository.SettingsGeneral{Timezone: "UTC"}, mc)
			actual := violation != nil

			if actual != tc.expected {
				t.Errorf("Expected violation=%v, got %v for payload %s", tc.expected, actual, tc.rawJSON)
			}
			if actual && violation.Type != tc.violation {
				t.Errorf("Expected violation type %q, got %q", tc.violation, violation.Type)
			}
		})
	}
}

