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
