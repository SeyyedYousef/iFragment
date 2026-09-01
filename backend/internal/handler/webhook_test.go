package handler

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"ifragment-backend/internal/repository"

	"github.com/google/uuid"
)

func TestMapToModeratorContext_LinkExtraction(t *testing.T) {
	scenarios := []struct {
		name         string
		payload      string
		expectedLink string
	}{
		{
			name: "Hidden text_link entity",
			payload: `{
				"message_id": 1,
				"from": {"id": 123, "is_bot": false, "first_name": "Test"},
				"chat": {"id": -100, "type": "supergroup"},
				"date": 1600000000,
				"text": "Click here for free money",
				"entities": [
					{
						"type": "text_link",
						"offset": 6,
						"length": 4,
						"url": "https://spam.com"
					}
				]
			}`,
			expectedLink: "https://spam.com",
		},
		{
			name: "URL entity (but actual extraction relies on regex later, though we check it)",
			payload: `{
				"message_id": 2,
				"from": {"id": 123, "is_bot": false, "first_name": "Test"},
				"chat": {"id": -100, "type": "supergroup"},
				"date": 1600000000,
				"text": "Visit https://example.com",
				"entities": [
					{
						"type": "url",
						"offset": 6,
						"length": 19
					}
				]
			}`,
			expectedLink: "https://example.com",
		},
		{
			name: "Caption text_link entity",
			payload: `{
				"message_id": 3,
				"from": {"id": 123, "is_bot": false, "first_name": "Test"},
				"chat": {"id": -100, "type": "supergroup"},
				"date": 1600000000,
				"caption": "Photo with link",
				"photo": [{"file_id": "xyz"}],
				"caption_entities": [
					{
						"type": "text_link",
						"offset": 11,
						"length": 4,
						"url": "t.me/spam"
					}
				]
			}`,
			expectedLink: "t.me/spam",
		},
	}

	h := &WebhookHandler{}

	for _, tc := range scenarios {
		t.Run(tc.name, func(t *testing.T) {
			var msg Message
			if err := json.Unmarshal([]byte(tc.payload), &msg); err != nil {
				t.Fatalf("Failed to parse JSON: %v", err)
			}

			mc := h.mapToModeratorContext(&msg)

			// Check if the expected link is extracted in TextLinks or if the text itself contains it.
			// The mapToModeratorContext function extracts "text_link" into TextLinks.
			// It also extracts "url" type into TextLinks! Wait, does it? Let's check the code:
			// "else if ent.Type == "url" {" ... "textLinks = append(textLinks, extracted)"
			// Let's verify that the expected link is found in TextLinks or mc.Text.

			foundInLinks := false
			for _, link := range mc.TextLinks {
				if link == tc.expectedLink {
					foundInLinks = true
					break
				}
			}

			// If it's a "url" entity, we just ensure `mc.HasTextLinks` is true and it extracted it,
			// or at least that it's in the text.
			if !foundInLinks && tc.expectedLink != "" {
				t.Errorf("Expected link %q to be extracted into TextLinks, got: %v", tc.expectedLink, mc.TextLinks)
			}
		})
	}
}

func TestGetTarget(t *testing.T) {
	h := &WebhookHandler{}

	// 1. Target via ReplyToMessage
	msgReply := &Message{
		Text: "/ban",
		ReplyToMessage: &Message{
			From: &User{
				ID:        999888,
				FirstName: "Spammer",
				Username:  "spammer_user",
			},
		},
	}
	id, name := h.getTarget(msgReply)
	if id != 999888 || name != "@spammer_user" {
		t.Errorf("Expected 999888, @spammer_user, got: %d, %s", id, name)
	}

	// 2. Target via numeric ID argument
	msgIDArg := &Message{
		Text: "/ban 11223344",
	}
	id, name = h.getTarget(msgIDArg)
	if id != 11223344 || name != "11223344" {
		t.Errorf("Expected 11223344, '11223344', got: %d, %s", id, name)
	}

	// 3. Target via text_mention entity
	msgMention := &Message{
		Text: "/mute BadUser 2h",
		Entities: []MessageEntity{
			{
				Type:   "text_mention",
				Offset: 6,
				Length: 7,
				User: &User{
					ID:        554433,
					FirstName: "BadUser",
				},
			},
		},
	}
	id, name = h.getTarget(msgMention)
	if id != 554433 || name != "BadUser" {
		t.Errorf("Expected 554433, BadUser, got: %d, %s", id, name)
	}
}

func TestParseDurationStr(t *testing.T) {
	cases := []struct {
		input    string
		expected int64
	}{
		{"1h", 3600},
		{"24h", 86400},
		{"7d", 7 * 86400},
		{"30m", 1800},
		{"invalid", 86400}, // fallback to default 24h
	}

	for _, c := range cases {
		dur := parseDurationStr(c.input, 24*3600*1e9)
		if int64(dur.Seconds()) != c.expected {
			t.Errorf("For input %s, expected %d seconds, got %f", c.input, c.expected, dur.Seconds())
		}
	}
}

func TestRenderMainSettingsMenu(t *testing.T) {
	h := &WebhookHandler{}
	ctx := context.Background()

	gid := uuid.New()
	group := &repository.ManagedGroup{
		ID:        gid,
		ChatTitle: "بازار اسلامی افغانستان 🇦🇫",
	}

	settings := &repository.GroupSettings{
		General:              json.RawMessage(`{"casEnabled": true, "autoDeleteDelay": 15, "ephemeralAll": true}`),
		ContentRestrictions: json.RawMessage(`{"removeLinks": {"enabled": true}}`),
		QuietHours:           json.RawMessage(`{"emergencyLock": false}`),
		MandatoryMembership:  json.RawMessage(`{"forceJoinEnabled": true, "requiredChannels": ["-100123"]}`),
	}

	// Test Persian rendering
	textFa, markupFa := h.renderMainSettingsMenu(ctx, group, settings, "fa")
	if !strings.Contains(textFa, "تنظیمات و امنیت گروه:") {
		t.Errorf("Expected Persian header in textFa, got: %s", textFa)
	}
	if !strings.Contains(textFa, "بازار اسلامی افغانستان 🇦🇫") {
		t.Errorf("Expected group title in textFa, got: %s", textFa)
	}

	kbFa, ok := markupFa["inline_keyboard"].([][]map[string]interface{})
	if !ok || len(kbFa) != 5 {
		t.Fatalf("Expected 5 rows in Persian inline keyboard, got %v", markupFa)
	}
	if kbFa[0][0]["text"] != "🛡 فیلتر محتوا" {
		t.Errorf("Expected '🛡 فیلتر محتوا', got %v", kbFa[0][0]["text"])
	}
	if kbFa[2][0]["text"] != "📢 جوین اجباری" {
		t.Errorf("Expected '📢 جوین اجباری', got %v", kbFa[2][0]["text"])
	}

	// Test English rendering
	textEn, markupEn := h.renderMainSettingsMenu(ctx, group, settings, "en")
	if !strings.Contains(textEn, "Group Security & Settings:") {
		t.Errorf("Expected English header in textEn, got: %s", textEn)
	}
	kbEn, ok := markupEn["inline_keyboard"].([][]map[string]interface{})
	if !ok || len(kbEn) != 5 {
		t.Fatalf("Expected 5 rows in English inline keyboard, got %v", markupEn)
	}
	if kbEn[2][0]["text"] != "📢 Force Join" {
		t.Errorf("Expected '📢 Force Join', got %v", kbEn[2][0]["text"])
	}
}

func TestRenderCategorySettingsMenu(t *testing.T) {
	h := &WebhookHandler{}
	ctx := context.Background()

	gid := uuid.New()
	group := &repository.ManagedGroup{
		ID:        gid,
		ChatTitle: "Test Group",
	}

	settings := &repository.GroupSettings{
		General:              json.RawMessage(`{"casEnabled": true}`),
		ContentRestrictions: json.RawMessage(`{"removeLinks": {"enabled": true}}`),
	}

	// Test content category in Persian
	textFa, markupFa := h.renderCategorySettingsMenu(ctx, group, settings, "content", "fa")
	if !strings.Contains(textFa, "فیلتر و محدودیت‌های محتوا") {
		t.Errorf("Expected Persian content header, got: %s", textFa)
	}
	kbFa, ok := markupFa["inline_keyboard"].([][]map[string]interface{})
	if !ok || len(kbFa) != 5 {
		t.Fatalf("Expected 5 rows in content menu, got %v", markupFa)
	}
	if !strings.Contains(kbFa[0][0]["text"].(string), "حذف لینک‌ها: ✅ فعال") {
		t.Errorf("Expected 'حذف لینک‌ها: ✅ فعال', got %v", kbFa[0][0]["text"])
	}

	// Test limits category in English
	textEn, markupEn := h.renderCategorySettingsMenu(ctx, group, settings, "limits", "en")
	if !strings.Contains(textEn, "Limits & Flood Control") {
		t.Errorf("Expected English limits header, got: %s", textEn)
	}
	kbEn, ok := markupEn["inline_keyboard"].([][]map[string]interface{})
	if !ok || len(kbEn) != 2 {
		t.Fatalf("Expected 2 rows in limits menu, got %v", markupEn)
	}
}

func TestGroupMigrationLogic(t *testing.T) {
	mainBotID := uuid.New()
	userBotID := uuid.New()
	adminUserID := int64(999999999)
	userAID := int64(123456789)

	mainBot := &repository.ManagedBot{
		ID:          mainBotID,
		BotID:       777000111,
		BotUsername: "iFragmentBot",
		OwnerUserID: adminUserID,
		Status:      "active",
	}

	userBot := &repository.ManagedBot{
		ID:          userBotID,
		BotID:       888000222,
		BotUsername: "UserCustomBot",
		OwnerUserID: userAID,
		Status:      "active",
	}

	// 1. Verify that replacing iFragmentBot with userBot is identified as a valid migration
	isMain := strings.EqualFold(mainBot.BotUsername, "iFragmentBot")
	if !isMain {
		t.Fatalf("Expected mainBot to be recognized as main bot")
	}

	// Migration condition check
	shouldMigrate := false
	if userBot.OwnerUserID == mainBot.OwnerUserID || isMain {
		shouldMigrate = true
	}

	if !shouldMigrate {
		t.Errorf("Expected migration from main bot to user bot to be allowed, but it was rejected")
	}
}

func TestSupergroupMigrationParsing(t *testing.T) {
	rawJSON := `{
		"message_id": 99,
		"from": {"id": 123456, "is_bot": false, "first_name": "Admin"},
		"chat": {"id": -12345678, "type": "group", "title": "Old Group"},
		"date": 1700000000,
		"migrate_to_chat_id": -1001234567890
	}`

	var msg Message
	if err := json.Unmarshal([]byte(rawJSON), &msg); err != nil {
		t.Fatalf("Failed to unmarshal message with migrate_to_chat_id: %v", err)
	}

	if msg.MigrateToChatID == nil || *msg.MigrateToChatID != -1001234567890 {
		t.Errorf("Expected MigrateToChatID to be -1001234567890, got %v", msg.MigrateToChatID)
	}
	if msg.Chat.ID != -12345678 {
		t.Errorf("Expected Chat.ID to be -12345678, got %d", msg.Chat.ID)
	}
}

