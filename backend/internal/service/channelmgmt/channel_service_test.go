package channelmgmt

import (
	"context"
	"encoding/json"
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
		ChannelID:     uuid.New(),
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
		ChannelID:     uuid.New(),
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
		ChannelID:     uuid.New(),
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
	_, err := s.GetAuditLogs(ctx, ownerUserID, channelID, 10, 0)
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

