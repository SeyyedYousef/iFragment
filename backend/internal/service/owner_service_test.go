package service

import (
	"encoding/json"
	"strings"
	"testing"

	"ifragment-backend/internal/model"
)

func TestSecretRedaction(t *testing.T) {
	svc := &OwnerService{}

	rawPayload := json.RawMessage(`{
		"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive_payload_123456",
		"password": "MySuperSecretPassword2026!",
		"nested": {
			"api_key": "sk-1234567890abcdef1234",
			"phone": "+989123456789",
			"safe_field": "public_data"
		},
		"tags": ["admin", "supersecretkey"]
	}`)

	redacted := svc.RedactAuditPayload(rawPayload)
	var parsed map[string]interface{}
	if err := json.Unmarshal(redacted, &parsed); err != nil {
		t.Fatalf("Failed to parse redacted JSON: %v", err)
	}

	// Verify top-level secrets are masked
	tokenStr, _ := parsed["token"].(string)
	if !strings.HasPrefix(tokenStr, "***") {
		t.Errorf("Expected masked token, got: %v", tokenStr)
	}
	if strings.Contains(tokenStr, "sensitive_payload") {
		t.Errorf("Token still contains plaintext secret: %v", tokenStr)
	}

	pwStr, _ := parsed["password"].(string)
	if !strings.HasPrefix(pwStr, "***") {
		t.Errorf("Expected masked password, got: %v", pwStr)
	}
	if strings.Contains(pwStr, "MySuperSecretPassword") {
		t.Errorf("Password was not redacted: %v", pwStr)
	}

	// Verify nested keys
	nested, ok := parsed["nested"].(map[string]interface{})
	if !ok {
		t.Fatalf("nested map missing or invalid")
	}

	apiKeyStr, _ := nested["api_key"].(string)
	if !strings.HasPrefix(apiKeyStr, "***") {
		t.Errorf("Nested api_key was not redacted: %v", apiKeyStr)
	}

	phoneStr, _ := nested["phone"].(string)
	if !strings.HasPrefix(phoneStr, "***") {
		t.Errorf("Nested phone was not redacted: %v", phoneStr)
	}

	safeField, _ := nested["safe_field"].(string)
	if safeField != "public_data" {
		t.Errorf("Safe field was incorrectly modified: %v", safeField)
	}
}

func TestSanitizeAuditLogs(t *testing.T) {
	svc := &OwnerService{}

	logs := []model.OwnerAuditLog{
		{
			ID:      1,
			OwnerID: 1001,
			Action:  "login",
			Payload: json.RawMessage(`{"token": "secret_session_token_xyz"}`),
		},
	}

	sanitized := svc.SanitizeAuditLogs(logs)
	if strings.Contains(string(sanitized[0].Payload), "secret_session_token") {
		t.Errorf("SanitizeAuditLogs did not redact secret payload")
	}
}
