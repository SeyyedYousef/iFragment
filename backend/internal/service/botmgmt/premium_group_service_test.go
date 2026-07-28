package botmgmt

import (
	"context"
	"testing"
)

func TestIsFragmentInvestorsGroup(t *testing.T) {
	tests := []struct {
		title    string
		username string
		expected bool
	}{
		{"Fragment Investors", "@FragmentInvestors", true},
		{"Fragment Investors", "FragmentInvestors", true},
		{"@FragmentInvestors", "", true},
		{"FragmentInvestors", "", true},
		{"Official Fragment Investors Group", "some_username", true},
		{"General Discussion", "@GeneralGroup", false},
		{"Crypto Chat", "", false},
	}

	for _, tt := range tests {
		got := IsFragmentInvestorsGroup(tt.title, tt.username)
		if got != tt.expected {
			t.Errorf("IsFragmentInvestorsGroup(%q, %q) = %v; want %v", tt.title, tt.username, got, tt.expected)
		}
	}
}

func TestProcessMemberJoinRealtime_AllowedUsers(t *testing.T) {
	svc := NewPremiumGroupService(nil, nil)
	ctx := context.Background()

	// 1. Premium User -> should be allowed without any action
	premiumUser := UserCompact{
		ID:        1001,
		IsBot:     false,
		FirstName: "Alice",
		Username:  "alice_premium",
		IsPremium: true,
	}
	err := svc.ProcessMemberJoinRealtime(ctx, nil, 12345, premiumUser)
	if err != nil {
		t.Errorf("Expected nil error for premium user, got %v", err)
	}

	// 2. Bot User -> should be allowed without any action
	botUser := UserCompact{
		ID:        2002,
		IsBot:     true,
		FirstName: "Helper Bot",
		Username:  "helper_bot",
		IsPremium: false,
	}
	err = svc.ProcessMemberJoinRealtime(ctx, nil, 12345, botUser)
	if err != nil {
		t.Errorf("Expected nil error for bot user, got %v", err)
	}
}
