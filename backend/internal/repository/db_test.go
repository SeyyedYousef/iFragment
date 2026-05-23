package repository

import (
	"os"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func TestDatabaseMigrations(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("Skipping migration integration test; DATABASE_URL is not set")
	}

	// Initialize migrator using migration files in backend/migrations folder
	m, err := migrate.New("file://../../migrations", dbURL)
	if err != nil {
		t.Fatalf("Failed to initialize migrator: %v", err)
	}
	defer m.Close()

	// 1. Rollback any existing schema (clean start)
	t.Log("Rolling back existing schema...")
	err = m.Down()
	if err != nil && err != migrate.ErrNoChange {
		t.Fatalf("Failed to run migrations Down: %v", err)
	}

	// 2. Migrate Up
	t.Log("Applying migrations (Up)...")
	err = m.Up()
	if err != nil {
		t.Fatalf("Failed to run migrations Up: %v", err)
	}

	// 3. Migrate Down (Rollback test)
	t.Log("Reverting all migrations (Down)...")
	err = m.Down()
	if err != nil && err != migrate.ErrNoChange {
		t.Fatalf("Failed to rollback migrations Down: %v", err)
	}

	// 4. Migrate back Up to leave the database clean
	t.Log("Re-applying migrations (Up) to restore state...")
	err = m.Up()
	if err != nil {
		t.Fatalf("Failed to re-apply migrations Up: %v", err)
	}
}
