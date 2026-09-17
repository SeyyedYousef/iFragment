package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMigration000093_SyntaxAndContent(t *testing.T) {
	upPath := filepath.Join("..", "..", "migrations", "000093_phase2_to_phase4_entitlements_and_observability.up.sql")
	upBytes, err := os.ReadFile(upPath)
	if err != nil {
		t.Fatalf("failed to read 000093 up migration: %v", err)
	}
	upContent := string(upBytes)

	// Must be wrapped in a transaction
	if !strings.Contains(upContent, "BEGIN;") || !strings.Contains(upContent, "COMMIT;") {
		t.Errorf("migration 000093 up must be wrapped in a transaction (BEGIN ... COMMIT)")
	}

	// Must create logical assets table (SCHEMA-P0-001)
	if !strings.Contains(upContent, "CREATE TABLE IF NOT EXISTS assets") {
		t.Errorf("migration 000093 up must create assets table")
	}

	// Must create observations table (SCHEMA-P0-002)
	if !strings.Contains(upContent, "CREATE TABLE IF NOT EXISTS observations") {
		t.Errorf("migration 000093 up must create observations table")
	}

	// Must create chain_events table (SCHEMA-P0-003)
	if !strings.Contains(upContent, "CREATE TABLE IF NOT EXISTS chain_events") {
		t.Errorf("migration 000093 up must create chain_events table")
	}

	// Must create valuation_runs table (SCHEMA-P0-006)
	if !strings.Contains(upContent, "CREATE TABLE IF NOT EXISTS valuation_runs") {
		t.Errorf("migration 000093 up must create valuation_runs table")
	}

	// Must create report_entitlements table (SCHEMA-P0-006, SEC-P0-002)
	if !strings.Contains(upContent, "CREATE TABLE IF NOT EXISTS report_entitlements") {
		t.Errorf("migration 000093 up must create report_entitlements table")
	}

	// Must create ingestion_dlq table (ING-P1-005, ADD-P1-002)
	if !strings.Contains(upContent, "CREATE TABLE IF NOT EXISTS ingestion_dlq") {
		t.Errorf("migration 000093 up must create ingestion_dlq table")
	}

	downPath := filepath.Join("..", "..", "migrations", "000093_phase2_to_phase4_entitlements_and_observability.down.sql")
	downBytes, err := os.ReadFile(downPath)
	if err != nil {
		t.Fatalf("failed to read 000093 down migration: %v", err)
	}
	downContent := string(downBytes)

	if !strings.Contains(downContent, "DROP TABLE IF EXISTS report_entitlements") {
		t.Errorf("migration 000093 down must drop report_entitlements")
	}
	if !strings.Contains(downContent, "DROP TABLE IF EXISTS observations") {
		t.Errorf("migration 000093 down must drop observations")
	}
}
