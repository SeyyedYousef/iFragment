package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMigration000095_SyntaxAndContent(t *testing.T) {
	upPath := filepath.Join("..", "..", "migrations", "000095_telegram_webhook_inbox.up.sql")
	upBytes, err := os.ReadFile(upPath)
	if err != nil {
		t.Fatalf("failed to read 000095 up migration: %v", err)
	}
	upContent := string(upBytes)

	downPath := filepath.Join("..", "..", "migrations", "000095_telegram_webhook_inbox.down.sql")
	downBytes, err := os.ReadFile(downPath)
	if err != nil {
		t.Fatalf("failed to read 000095 down migration: %v", err)
	}
	downContent := string(downBytes)

	// 1. Transaction wrapping
	t.Run("TransactionWrapping", func(t *testing.T) {
		if !strings.Contains(upContent, "BEGIN;") || !strings.Contains(upContent, "COMMIT;") {
			t.Errorf("migration 000095 up must be wrapped in a transaction (BEGIN ... COMMIT)")
		}
		if !strings.Contains(downContent, "BEGIN;") || !strings.Contains(downContent, "COMMIT;") {
			t.Errorf("migration 000095 down must be wrapped in a transaction (BEGIN ... COMMIT)")
		}
	})

	// 2. Table and Constraints
	t.Run("TelegramWebhookInboxTableAndConstraints", func(t *testing.T) {
		if !strings.Contains(upContent, "CREATE TABLE IF NOT EXISTS telegram_webhook_inbox") {
			t.Errorf("migration 000095 up must create telegram_webhook_inbox table")
		}
		if !strings.Contains(upContent, "uq_webhook_inbox_bot_update UNIQUE (bot_id, update_id)") {
			t.Errorf("migration 000095 up must define uq_webhook_inbox_bot_update UNIQUE constraint")
		}
		if !strings.Contains(upContent, "chk_webhook_inbox_status CHECK (status IN ('received', 'processing', 'processed', 'failed', 'dlq'))") {
			t.Errorf("migration 000095 up must define chk_webhook_inbox_status constraint")
		}
	})

	// 3. Indexes
	t.Run("Indexes", func(t *testing.T) {
		if !strings.Contains(upContent, "CREATE INDEX IF NOT EXISTS idx_webhook_inbox_status_lease") {
			t.Errorf("migration 000095 up must create idx_webhook_inbox_status_lease index")
		}
		if !strings.Contains(upContent, "CREATE INDEX IF NOT EXISTS idx_webhook_inbox_bot_update") {
			t.Errorf("migration 000095 up must create idx_webhook_inbox_bot_update index")
		}
		if !strings.Contains(upContent, "CREATE INDEX IF NOT EXISTS idx_webhook_inbox_chat") {
			t.Errorf("migration 000095 up must create idx_webhook_inbox_chat index")
		}
	})

	// 4. Down Migration
	t.Run("DownMigration", func(t *testing.T) {
		if !strings.Contains(downContent, "DROP TABLE IF EXISTS telegram_webhook_inbox;") {
			t.Errorf("migration 000095 down must drop telegram_webhook_inbox table")
		}
	})
}
