package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMigration000094_SyntaxAndContent(t *testing.T) {
	upPath := filepath.Join("..", "..", "migrations", "000094_schema_p0_events_and_snapshots.up.sql")
	upBytes, err := os.ReadFile(upPath)
	if err != nil {
		t.Fatalf("failed to read 000094 up migration: %v", err)
	}
	upContent := string(upBytes)

	downPath := filepath.Join("..", "..", "migrations", "000094_schema_p0_events_and_snapshots.down.sql")
	downBytes, err := os.ReadFile(downPath)
	if err != nil {
		t.Fatalf("failed to read 000094 down migration: %v", err)
	}
	downContent := string(downBytes)

	// 1. Transaction wrapping & basic SQL syntax validation
	t.Run("TransactionWrapping", func(t *testing.T) {
		if !strings.Contains(upContent, "BEGIN;") || !strings.Contains(upContent, "COMMIT;") {
			t.Errorf("migration 000094 up must be wrapped in a transaction (BEGIN ... COMMIT)")
		}
		if !strings.Contains(downContent, "BEGIN;") || !strings.Contains(downContent, "COMMIT;") {
			t.Errorf("migration 000094 down must be wrapped in a transaction (BEGIN ... COMMIT)")
		}
	})

	// 2. Check constraint on assets.vertical (SCHEMA-P0-001)
	t.Run("AssetsVerticalConstraint", func(t *testing.T) {
		if !strings.Contains(upContent, "chk_assets_vertical") {
			t.Errorf("migration 000094 up must define constraint chk_assets_vertical")
		}
		if !strings.Contains(upContent, "CHECK (vertical IN ('username', 'number', 'gift'))") {
			t.Errorf("migration 000094 up must check that vertical is in ('username', 'number', 'gift')")
		}
		if !strings.Contains(upContent, "ALTER TABLE assets ADD CONSTRAINT chk_assets_vertical") {
			t.Errorf("migration 000094 up must alter table assets to add chk_assets_vertical")
		}
	})

	// 3. Market events table & constraints (SCHEMA-P0-004)
	t.Run("MarketEventsTableAndConstraints", func(t *testing.T) {
		if !strings.Contains(upContent, "CREATE TABLE IF NOT EXISTS market_events") {
			t.Errorf("migration 000094 up must create market_events table")
		}

		// Constraint chk_market_events_price_positive (price_minor > 0)
		if !strings.Contains(upContent, "CONSTRAINT chk_market_events_price_positive CHECK (price_minor > 0)") {
			t.Errorf("migration 000094 up must include chk_market_events_price_positive constraint (price_minor > 0)")
		}

		// Constraint chk_market_events_sale_evidence
		if !strings.Contains(upContent, "CONSTRAINT chk_market_events_sale_evidence CHECK") {
			t.Errorf("migration 000094 up must include chk_market_events_sale_evidence constraint")
		}
		if !strings.Contains(upContent, "event_type != 'sale' OR (verification_status = 'verified' AND settlement_tx_hash IS NOT NULL)") {
			t.Errorf("migration 000094 up chk_market_events_sale_evidence must require verified status and settlement_tx_hash for sale events")
		}

		// Foreign Keys
		if !strings.Contains(upContent, "REFERENCES assets(id) ON DELETE CASCADE") {
			t.Errorf("migration 000094 up market_events must reference assets(id) ON DELETE CASCADE")
		}
		if !strings.Contains(upContent, "REFERENCES observations(id) ON DELETE SET NULL") {
			t.Errorf("migration 000094 up market_events must reference observations(id) ON DELETE SET NULL")
		}

		// Indexes
		if !strings.Contains(upContent, "CREATE INDEX IF NOT EXISTS idx_market_events_asset_time ON market_events(asset_id, observed_at DESC);") {
			t.Errorf("migration 000094 up must create idx_market_events_asset_time index")
		}
		if !strings.Contains(upContent, "CREATE INDEX IF NOT EXISTS idx_market_events_venue_type ON market_events(venue, event_type);") {
			t.Errorf("migration 000094 up must create idx_market_events_venue_type index")
		}
	})

	// 4. Rate snapshots table & constraints (SCHEMA-P0-005)
	t.Run("RateSnapshotsTableAndConstraints", func(t *testing.T) {
		if !strings.Contains(upContent, "CREATE TABLE IF NOT EXISTS rate_snapshots") {
			t.Errorf("migration 000094 up must create rate_snapshots table")
		}

		// Constraint chk_rate_snapshots_rate_positive (rate_decimal > 0)
		if !strings.Contains(upContent, "CONSTRAINT chk_rate_snapshots_rate_positive CHECK (rate_decimal > 0)") {
			t.Errorf("migration 000094 up must include chk_rate_snapshots_rate_positive constraint (rate_decimal > 0)")
		}

		// Index
		if !strings.Contains(upContent, "CREATE INDEX IF NOT EXISTS idx_rate_snapshots_pair_time ON rate_snapshots(base_currency, quote_currency, observed_at DESC);") {
			t.Errorf("migration 000094 up must create idx_rate_snapshots_pair_time index")
		}
	})

	// 5. Down migration assertions
	t.Run("DownMigration", func(t *testing.T) {
		if !strings.Contains(downContent, "DROP TABLE IF EXISTS rate_snapshots CASCADE;") {
			t.Errorf("migration 000094 down must drop rate_snapshots table with CASCADE")
		}
		if !strings.Contains(downContent, "DROP TABLE IF EXISTS market_events CASCADE;") {
			t.Errorf("migration 000094 down must drop market_events table with CASCADE")
		}
		if !strings.Contains(downContent, "ALTER TABLE assets DROP CONSTRAINT chk_assets_vertical;") {
			t.Errorf("migration 000094 down must drop constraint chk_assets_vertical from assets table")
		}
	})
}
