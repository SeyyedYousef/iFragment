package handler

import (
	"encoding/json"
	"testing"
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

