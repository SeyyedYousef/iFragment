package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMigration000092_SyntaxAndContent(t *testing.T) {
	upPath := filepath.Join("..", "..", "migrations", "000092_phase1_p1_checkpoints_and_contracts.up.sql")
	upBytes, err := os.ReadFile(upPath)
	if err != nil {
		t.Fatalf("failed to read 000092 up migration: %v", err)
	}
	upContent := string(upBytes)

	// Must contain BEGIN and COMMIT
	if !strings.Contains(upContent, "BEGIN;") || !strings.Contains(upContent, "COMMIT;") {
		t.Errorf("migration 000092 up must be wrapped in a transaction (BEGIN ... COMMIT)")
	}

	// Must add is_reorged to number_sales and gift_sales
	if !strings.Contains(upContent, "is_reorged") {
		t.Errorf("migration 000092 up must add is_reorged column")
	}

	// Must add idempotency_key to orders
	if !strings.Contains(upContent, "idempotency_key") {
		t.Errorf("migration 000092 up must add idempotency_key to orders")
	}

	downPath := filepath.Join("..", "..", "migrations", "000092_phase1_p1_checkpoints_and_contracts.down.sql")
	downBytes, err := os.ReadFile(downPath)
	if err != nil {
		t.Fatalf("failed to read 000092 down migration: %v", err)
	}
	downContent := string(downBytes)

	if !strings.Contains(downContent, "DROP COLUMN IF EXISTS is_reorged") {
		t.Errorf("migration 000092 down must safely drop is_reorged")
	}
	if !strings.Contains(downContent, "DROP COLUMN IF EXISTS idempotency_key") {
		t.Errorf("migration 000092 down must safely drop idempotency_key")
	}
}
