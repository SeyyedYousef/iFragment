package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMigration000090_SyntaxAndContent(t *testing.T) {
	upPath := filepath.Join("..", "..", "migrations", "000090_phase0_provenance_and_schema_fixes.up.sql")
	upBytes, err := os.ReadFile(upPath)
	if err != nil {
		t.Fatalf("failed to read 000090 up migration: %v", err)
	}
	upContent := string(upBytes)

	// Must contain BEGIN and COMMIT
	if !strings.Contains(upContent, "BEGIN;") || !strings.Contains(upContent, "COMMIT;") {
		t.Errorf("migration 000090 up must be wrapped in a transaction (BEGIN ... COMMIT)")
	}

	// Must add id and is_restricted to number_features idempotently
	if !strings.Contains(upContent, "ALTER TABLE number_features ADD COLUMN IF NOT EXISTS id") {
		t.Errorf("migration 000090 up must add id with IF NOT EXISTS")
	}
	if !strings.Contains(upContent, "ALTER TABLE number_features ADD COLUMN IF NOT EXISTS is_restricted") {
		t.Errorf("migration 000090 up must add is_restricted with IF NOT EXISTS")
	}

	// Must quarantine/delete synthetic seed rows
	if !strings.Contains(upContent, "DELETE FROM gift_sales") {
		t.Errorf("migration 000090 up must delete synthetic gift_sales")
	}
	if !strings.Contains(upContent, "DELETE FROM gift_whale_wallets") {
		t.Errorf("migration 000090 up must delete synthetic whale wallets")
	}

	downPath := filepath.Join("..", "..", "migrations", "000090_phase0_provenance_and_schema_fixes.down.sql")
	downBytes, err := os.ReadFile(downPath)
	if err != nil {
		t.Fatalf("failed to read 000090 down migration: %v", err)
	}
	downContent := string(downBytes)

	if !strings.Contains(downContent, "DROP COLUMN IF EXISTS id") || !strings.Contains(downContent, "DROP COLUMN IF EXISTS is_restricted") {
		t.Errorf("migration 000090 down must drop the added columns safely")
	}
}
