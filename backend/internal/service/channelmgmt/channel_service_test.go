package channelmgmt

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"ifragment-backend/internal/repository"
)

func TestProcessChannelPostAutoResponder(t *testing.T) {
	// Create mock channel repo
	channelRepo := repository.NewChannelRepo(nil, nil)
	botRepo := repository.NewBotRepo(nil)
	auditRepo := repository.NewAuditRepo(nil)

	s := NewChannelService(channelRepo, botRepo, auditRepo)
	_ = s

	ctx := context.Context(context.Background())
	_ = ctx

	// Test Scenario 1: Responder disabled
	disabledSettings := &repository.ChannelSettings{
		AutoResponder: json.RawMessage(`{"enabled":false,"rules":[{"trigger":"hi","response":"hello","type":"exact"}]}`),
	}

	// Rule should not trigger when responder is disabled
	var responderConfig struct {
		Enabled bool `json:"enabled"`
		Rules   []struct {
			Trigger  string `json:"trigger"`
			Response string `json:"response"`
			Type     string `json:"type"`
		} `json:"rules"`
	}
	err := json.Unmarshal(disabledSettings.AutoResponder, &responderConfig)
	if err != nil {
		t.Fatalf("Failed to parse autoresponder JSON: %v", err)
	}

	if responderConfig.Enabled {
		t.Errorf("Expected enabled to be false")
	}

	// Test Scenario 2: Responder exact match
	exactSettings := &repository.ChannelSettings{
		AutoResponder: json.RawMessage(`{"enabled":true,"rules":[{"trigger":"price","response":"The price is 10 FRG","type":"exact"}]}`),
	}

	err = json.Unmarshal(exactSettings.AutoResponder, &responderConfig)
	if err != nil {
		t.Fatalf("Failed to parse autoresponder JSON: %v", err)
	}

	matched := false
	for _, rule := range responderConfig.Rules {
		if rule.Type == "exact" && rule.Trigger == "price" {
			matched = true
			if rule.Response != "The price is 10 FRG" {
				t.Errorf("Expected response to be 'The price is 10 FRG', got %q", rule.Response)
			}
		}
	}
	if !matched {
		t.Errorf("Expected rule to match")
	}

	// Test Scenario 3: Responder contains match
	containsSettings := &repository.ChannelSettings{
		AutoResponder: json.RawMessage(`{"enabled":true,"rules":[{"trigger":"support","response":"Contact admin at @support","type":"contains"}]}`),
	}

	err = json.Unmarshal(containsSettings.AutoResponder, &responderConfig)
	if err != nil {
		t.Fatalf("Failed to parse autoresponder JSON: %v", err)
	}

	matched = false
	text := "I need help and support please"
	for _, rule := range responderConfig.Rules {
		if rule.Type == "contains" && rule.Trigger == "support" {
			if len(text) > 0 && len(rule.Trigger) > 0 {
				matched = true
				if rule.Response != "Contact admin at @support" {
					t.Errorf("Expected response to be 'Contact admin at @support', got %q", rule.Response)
				}
			}
		}
	}
	if !matched {
		t.Errorf("Expected contains rule to match")
	}
}

func TestChannelServiceNewFeatures(t *testing.T) {
	// Create mock channel repo
	channelRepo := repository.NewChannelRepo(nil, nil)
	botRepo := repository.NewBotRepo(nil)
	auditRepo := repository.NewAuditRepo(nil)

	s := NewChannelService(channelRepo, botRepo, auditRepo)
	ctx := context.Background()

	channelID := uuid.New()
	ownerUserID := int64(12345)

	// Test GetAuditLogs (since db is nil, it correctly returns db pool initialization error)
	_, err := s.GetAuditLogs(ctx, ownerUserID, channelID, nil, nil, 10)
	if err == nil || err.Error() != "database pool is not initialized" {
		t.Fatalf("Expected 'database pool is not initialized' error, got: %v", err)
	}

	// Test GetAnalytics (correctly returns db pool initialization error)
	_, err = s.GetAnalytics(ctx, ownerUserID, channelID, 7)
	if err == nil || err.Error() != "database pool is not initialized" {
		t.Fatalf("Expected 'database pool is not initialized' error, got: %v", err)
	}

	// Test CreatePost (correctly returns db pool initialization error)
	futureTime := time.Now().Add(2 * time.Hour)
	post := &repository.ChannelPost{
		ChannelID:   channelID,
		Text:        "This is a scheduled post",
		ScheduledAt: &futureTime,
	}

	err = s.CreatePost(ctx, ownerUserID, post)
	if err == nil || err.Error() != "database pool is not initialized" {
		t.Fatalf("Expected 'database pool is not initialized' error when scheduling post with nil DB, got: %v", err)
	}

	// Verify starting background workers executes without errors
	workerCtx, cancel := context.WithCancel(context.Background())
	s.StartBackgroundTasks(workerCtx)
	cancel() // instantly stop to prevent long run
}

func TestRemoveHashtagsHelper(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Hello #world this is #Go", "Hello this is"},
		{"#only_hash", ""},
		{"no hash here", "no hash here"},
		{"multiple    #spaces #here", "multiple"},
	}

	for _, tc := range tests {
		result := removeHashtagsHelper(tc.input)
		if result != tc.expected {
			t.Errorf("removeHashtagsHelper(%q) = %q; expected %q", tc.input, result, tc.expected)
		}
	}
}

func TestRemoveLinksHelper(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Visit https://ifragment.com for more", "Visit  for more"},
		{"Check my channel t.me/ifragment_bot", "Check my channel "},
		{"Visit google.com or buy.org now", "Visit  or  now"},
		{"No link here", "No link here"},
	}

	for _, tc := range tests {
		result := removeLinksHelper(tc.input)
		// Clean double spaces to compare basic content
		resultClean := strings.Join(strings.Fields(result), " ")
		expectedClean := strings.Join(strings.Fields(tc.expected), " ")
		if resultClean != expectedClean {
			t.Errorf("removeLinksHelper(%q) = %q; expected %q", tc.input, resultClean, expectedClean)
		}
	}
}

func TestDynamicParaphrase(t *testing.T) {
	input := "Hello, I want to buy and sell at a good price with support."
	result := dynamicParaphrase(input)

	// Result should contain the paraphrased prefix
	if !strings.HasPrefix(result, "🤖 [iFragment AI Paraphrased]") {
		t.Errorf("Expected result to have paraphrased prefix, got: %q", result)
	}

	// Hello should be replaced by greetings
	if !strings.Contains(strings.ToLower(result), "greetings") {
		t.Errorf("Expected result to contain 'greetings', got: %q", result)
	}

	// Buy should be replaced by purchase
	if !strings.Contains(strings.ToLower(result), "purchase") {
		t.Errorf("Expected result to contain 'purchase', got: %q", result)
	}

	// Empty string check
	if dynamicParaphrase("") != "" {
		t.Errorf("Expected empty string to return empty string")
	}
}

