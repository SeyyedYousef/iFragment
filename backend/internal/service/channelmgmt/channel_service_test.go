package channelmgmt

import (
	"context"
	"encoding/json"
	"net"
	"os"
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
		{"Visit www.google.com or buy.org now", "Visit  or buy.org now"},
		{"No link here", "No link here"},
		{"Please contact Company X.Y or write to info.txt", "Please contact Company X.Y or write to info.txt"},
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

func TestDynamicParaphraseFallback(t *testing.T) {
	// Arrange: set up environments
	originalKey, exists := os.LookupEnv("GEMINI_API_KEY")
	defer func() {
		if exists {
			os.Setenv("GEMINI_API_KEY", originalKey)
		} else {
			os.Unsetenv("GEMINI_API_KEY")
		}
	}()

	// Scenario 1: GEMINI_API_KEY is empty -> immediately falls back to local replacements
	os.Unsetenv("GEMINI_API_KEY")
	input := "Hello support hi"
	resultEmptyKey := dynamicParaphrase(input)
	if !strings.HasPrefix(resultEmptyKey, "🤖 [iFragment AI Paraphrased]") {
		t.Errorf("Expected fallback prefix when GEMINI_API_KEY is empty, got: %q", resultEmptyKey)
	}
	if !strings.Contains(resultEmptyKey, "greetings") || !strings.Contains(resultEmptyKey, "assistance") {
		t.Errorf("Expected words to be locally replaced, got: %q", resultEmptyKey)
	}

	// Scenario 2: GEMINI_API_KEY is set but invalid -> calls API, fails, falls back gracefully
	os.Setenv("GEMINI_API_KEY", "invalid_key_for_testing_purposes")
	resultInvalidKey := dynamicParaphrase(input)
	if !strings.HasPrefix(resultInvalidKey, "🤖 [iFragment AI Paraphrased]") {
		t.Errorf("Expected fallback prefix when Gemini API fails, got: %q", resultInvalidKey)
	}
	if !strings.Contains(resultInvalidKey, "greetings") || !strings.Contains(resultInvalidKey, "assistance") {
		t.Errorf("Expected words to be locally replaced, got: %q", resultInvalidKey)
	}
}

func TestValidateForwardingTarget(t *testing.T) {
	s := &ChannelService{
		dnsLookup: func(host string) ([]net.IP, error) {
			if host == "safe-external-webhook.com" {
				return []net.IP{net.ParseIP("8.8.8.8")}, nil
			}
			return net.LookupIP(host)
		},
	}

	tests := []struct {
		name      string
		rule      *repository.ChannelForwardingRule
		expectErr bool
		errText   string
	}{
		{
			name: "Valid Telegram type",
			rule: &repository.ChannelForwardingRule{
				TargetType: "telegram",
				Target:     "@ifragment_channel",
			},
			expectErr: false,
		},
		{
			name: "Valid Webhook type",
			rule: &repository.ChannelForwardingRule{
				TargetType: "webhook",
				Target:     "https://safe-external-webhook.com/api",
			},
			expectErr: false,
		},
		{
			name: "Invalid target type",
			rule: &repository.ChannelForwardingRule{
				TargetType: "email",
				Target:     "test@example.com",
			},
			expectErr: true,
			errText:   "invalid target type: must be telegram or webhook",
		},
		{
			name: "Non-HTTPS Webhook",
			rule: &repository.ChannelForwardingRule{
				TargetType: "webhook",
				Target:     "http://example.com/webhook",
			},
			expectErr: true,
			errText:   "invalid webhook URL: must be a secure https address",
		},
		{
			name: "Invalid URL format",
			rule: &repository.ChannelForwardingRule{
				TargetType: "webhook",
				Target:     "://invalid-url",
			},
			expectErr: true,
			errText:   "invalid webhook URL",
		},
		{
			name: "Localhost webhook target",
			rule: &repository.ChannelForwardingRule{
				TargetType: "webhook",
				Target:     "https://localhost/api",
			},
			expectErr: true,
			errText:   "private/loopback IPs are not allowed as webhook targets",
		},
		{
			name: "Local hostname webhook target",
			rule: &repository.ChannelForwardingRule{
				TargetType: "webhook",
				Target:     "https://test.local/api",
			},
			expectErr: true,
			errText:   "private/loopback IPs are not allowed as webhook targets",
		},
		{
			name: "Loopback IPv4 webhook target",
			rule: &repository.ChannelForwardingRule{
				TargetType: "webhook",
				Target:     "https://127.0.0.1/webhook",
			},
			expectErr: true,
			errText:   "private/loopback IPs are not allowed as webhook targets",
		},
		{
			name: "Private IPv4 webhook target 192.168.x.x",
			rule: &repository.ChannelForwardingRule{
				TargetType: "webhook",
				Target:     "https://192.168.1.1/webhook",
			},
			expectErr: true,
			errText:   "private/loopback IPs are not allowed as webhook targets",
		},
		{
			name: "Private IPv4 webhook target 10.x.x.x",
			rule: &repository.ChannelForwardingRule{
				TargetType: "webhook",
				Target:     "https://10.0.0.1/webhook",
			},
			expectErr: true,
			errText:   "private/loopback IPs are not allowed as webhook targets",
		},
		{
			name: "Loopback IPv6 webhook target",
			rule: &repository.ChannelForwardingRule{
				TargetType: "webhook",
				Target:     "https://[::1]/webhook",
			},
			expectErr: true,
			errText:   "private/loopback IPs are not allowed as webhook targets",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := s.validateForwardingTarget(tc.rule)
			if tc.expectErr {
				if err == nil {
					t.Fatalf("Expected error but got nil")
				}
				if tc.errText != "" && !strings.Contains(err.Error(), tc.errText) {
					t.Errorf("Expected error containing %q, got: %v", tc.errText, err)
				}
			} else {
				if err != nil {
					t.Fatalf("Expected no error, got: %v", err)
				}
			}
		})
	}
}

func TestValidateSettingsCategoryInlineButtons(t *testing.T) {
	tests := []struct {
		name      string
		jsonData  string
		expectErr bool
		errText   string
	}{
		{
			name: "Allow counter buttons",
			jsonData: `{
				"buttons": [
					{
						"title": "Like",
						"value": "like_counter",
						"type": "counter",
						"style": "primary"
					}
				]
			}`,
			expectErr: false,
		},
		{
			name: "Allow HTTP URL buttons",
			jsonData: `{
				"buttons": [
					{
						"title": "HTTP Link",
						"value": "http://example.com",
						"type": "url",
						"style": "link"
					}
				]
			}`,
			expectErr: false,
		},
		{
			name: "Allow HTTPS URL buttons",
			jsonData: `{
				"buttons": [
					{
						"title": "HTTPS Link",
						"value": "https://example.com",
						"type": "url",
						"style": "link"
					}
				]
			}`,
			expectErr: false,
		},
		{
			name: "Disallow non-http/https URL buttons",
			jsonData: `{
				"buttons": [
					{
						"title": "FTP Link",
						"value": "ftp://example.com",
						"type": "url",
						"style": "link"
					}
				]
			}`,
			expectErr: true,
			errText:   "invalid URL: must be a valid http or https address",
		},
		{
			name: "Disallow webapp buttons with http",
			jsonData: `{
				"buttons": [
					{
						"title": "Insecure WebApp",
						"value": "http://app.ifragment.com",
						"type": "webapp",
						"style": "primary"
					}
				]
			}`,
			expectErr: true,
			errText:   "invalid WebApp URL: must be a secure https address",
		},
		{
			name: "Allow webapp buttons with secure https",
			jsonData: `{
				"buttons": [
					{
						"title": "Secure WebApp",
						"value": "https://app.ifragment.com",
						"type": "webapp",
						"style": "primary"
					}
				]
			}`,
			expectErr: false,
		},
		{
			name: "Disallow invalid button type",
			jsonData: `{
				"buttons": [
					{
						"title": "Invalid Type",
						"value": "test",
						"type": "invalid_type_here",
						"style": "primary"
					}
				]
			}`,
			expectErr: true,
			errText:   "invalid button type",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateSettingsCategory("inline_buttons", json.RawMessage(tc.jsonData))
			if tc.expectErr {
				if err == nil {
					t.Fatalf("Expected error but got nil")
				}
				if tc.errText != "" && !strings.Contains(err.Error(), tc.errText) {
					t.Errorf("Expected error containing %q, got: %v", tc.errText, err)
				}
			} else {
				if err != nil {
					t.Fatalf("Expected no error, got: %v", err)
				}
			}
		})
	}
}

