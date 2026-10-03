package handler

import (
	"context"
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

func TestFragmentInvestors_PremiumGateAndJoinRequest(t *testing.T) {
	h := &WebhookHandler{}
	premiumSvc := raffle.NewPremiumGroupService(nil)
	h.SetPremiumGroupService(premiumSvc)

	ctx := context.Background()

	// 1. Non-nil check and nil safety for ChatJoinRequest
	h.handleChatJoinRequest(ctx, nil, nil)

	// 2. ChatJoinRequest for non-FragmentInvestors group (should be ignored safely)
	reqOther := &ChatJoinRequest{
		Chat: Chat{ID: -100555, Title: "General Group"},
		From: User{ID: 12345, IsPremium: false},
	}
	h.handleChatJoinRequest(ctx, nil, reqOther)

	// 3. ChatMemberUpdated nil safety
	h.handleChatMemberUpdated(ctx, nil, nil)
}
