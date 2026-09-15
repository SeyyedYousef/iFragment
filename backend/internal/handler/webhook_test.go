package handler

import (
	"encoding/json"
	"testing"

	"ifragment-backend/internal/service/raffle"
)

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

func TestIsFragmentInvestorsGroup(t *testing.T) {
	tests := []struct {
		title    string
		username string
		expected bool
	}{
		{"Fragment Investors", "", true},
		{"fragmentinvestors", "", true},
		{"Some Other Chat", "FragmentInvestors", true},
		{"Some Other Chat", "fragment_investors", true},
		{"Random Chat", "random_chat", false},
	}

	for _, tt := range tests {
		got := raffle.IsFragmentInvestorsGroup(tt.title, tt.username)
		if got != tt.expected {
			t.Errorf("IsFragmentInvestorsGroup(%q, %q) = %v; want %v", tt.title, tt.username, got, tt.expected)
		}
	}
}
