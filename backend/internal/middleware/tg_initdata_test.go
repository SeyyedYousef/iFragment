package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"testing"
	"time"
)

func TestValidateTelegramInitData_ValidHash(t *testing.T) {
	botToken := "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
	now := time.Now().Unix()

	// Build raw parameters
	userJSON := `{"id":123456,"first_name":"TestUser","username":"testuser"}`
	authDate := fmt.Sprintf("%d", now)
	queryID := "AAH12345"

	// 1. Construct data_check_string (sorted key=value pairs)
	dataCheckString := fmt.Sprintf("auth_date=%s\nquery_id=%s\nuser=%s", authDate, queryID, userJSON)

	// 2. Secret Key = HMAC-SHA256("WebAppData", botToken)
	hSecret := hmac.New(sha256.New, []byte("WebAppData"))
	hSecret.Write([]byte(botToken))
	secretKey := hSecret.Sum(nil)

	// 3. Hash = Hex(HMAC-SHA256(secretKey, dataCheckString))
	hHash := hmac.New(sha256.New, secretKey)
	hHash.Write([]byte(dataCheckString))
	expectedHash := hex.EncodeToString(hHash.Sum(nil))

	// Construct initData string (as sent by Telegram client)
	initData := fmt.Sprintf("query_id=%s&user=%s&auth_date=%s&hash=%s",
		queryID,
		url.QueryEscape(userJSON),
		authDate,
		expectedHash,
	)

	// Perform validation
	err := validate(initData, botToken)
	if err != nil {
		t.Fatalf("Expected validation to succeed, got error: %v", err)
	}
}

func TestValidateTelegramInitData_InvalidHash(t *testing.T) {
	botToken := "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
	now := time.Now().Unix()

	initData := fmt.Sprintf("query_id=AAH12345&user=%%7B%%22id%%22%%3A123456%%7D&auth_date=%d&hash=invalidhash123", now)

	err := validate(initData, botToken)
	if err == nil {
		t.Fatalf("Expected validation to fail for invalid hash, but it passed")
	}
}
