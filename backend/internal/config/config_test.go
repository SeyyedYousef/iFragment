package config

import (
	"os"
	"testing"
)

func TestConfig_LoadAndGet(t *testing.T) {
	os.Setenv("APP_ENV", "development")
	os.Setenv("PORT", "9090")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected load error: %v", err)
	}

	if cfg.App.Port != "9090" {
		t.Errorf("expected port 9090, got %s", cfg.App.Port)
	}

	if cfg.App.IsProduction() {
		t.Errorf("expected development environment, got production")
	}

	got := Get()
	if got != cfg {
		t.Errorf("expected Get() to return singleton instance")
	}
}
