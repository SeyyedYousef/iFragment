package repository

import (
	"context"
	"testing"
)

func TestIsExemptFromAutoLeave_StaticChannels(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		title    string
		chatID   int64
		expected bool
	}{
		{"@Fragmentscommunity", 1001, true},
		{"Fragmentscommunity", 1002, true},
		{"Fragments Community", 1003, true},
		{"@TheGramPrice", 2001, true},
		{"TheGramPrice", 2002, true},
		{"The Gram Price", 2003, true},
		{"@Fragmentinvestort", 3001, true},
		{"Fragmentinvestort", 3002, true},
		{"Fragment Investor T", 3003, true},
		{"@RandomOtherChannel", 4001, false},
		{"General Tech News", 4002, false},
	}

	for _, tt := range tests {
		got := IsExemptFromAutoLeave(ctx, nil, tt.chatID, tt.title)
		if got != tt.expected {
			t.Errorf("IsExemptFromAutoLeave(nil, %d, %q) = %v; want %v", tt.chatID, tt.title, got, tt.expected)
		}
	}
}
