package mtproto

import (
	"context"
	"os"
	"testing"
)

func TestInitClient_ProductionFailsWithoutCredentials(t *testing.T) {
	origAppEnv := os.Getenv("APP_ENV")
	origAppID := os.Getenv("TG_APP_ID")
	origAppHash := os.Getenv("TG_APP_HASH")
	origBotToken := os.Getenv("BOT_TOKEN")

	defer func() {
		os.Setenv("APP_ENV", origAppEnv)
		os.Setenv("TG_APP_ID", origAppID)
		os.Setenv("TG_APP_HASH", origAppHash)
		os.Setenv("BOT_TOKEN", origBotToken)
	}()

	os.Setenv("APP_ENV", "production")
	os.Setenv("TG_APP_ID", "")
	os.Setenv("TG_APP_HASH", "")
	os.Setenv("BOT_TOKEN", "")

	ctx := context.Background()
	client, err := InitClient(ctx)
	if err == nil {
		t.Fatalf("expected error in production when credentials are missing, got nil client: %v", client)
	}
}

func TestInitClient_DevelopmentAllowsMock(t *testing.T) {
	origAppEnv := os.Getenv("APP_ENV")
	origAppID := os.Getenv("TG_APP_ID")
	origAppHash := os.Getenv("TG_APP_HASH")
	origBotToken := os.Getenv("BOT_TOKEN")

	defer func() {
		os.Setenv("APP_ENV", origAppEnv)
		os.Setenv("TG_APP_ID", origAppID)
		os.Setenv("TG_APP_HASH", origAppHash)
		os.Setenv("BOT_TOKEN", origBotToken)
	}()

	os.Setenv("APP_ENV", "development")
	os.Setenv("TG_APP_ID", "")
	os.Setenv("TG_APP_HASH", "")
	os.Setenv("BOT_TOKEN", "")

	ctx := context.Background()
	client, err := InitClient(ctx)
	if err != nil {
		t.Fatalf("expected mock client to be permitted in development, got err: %v", err)
	}
	if client == nil {
		t.Fatalf("expected non-nil mock client in development")
	}
}
