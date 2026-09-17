package gvengine

import (
	"context"
	"testing"
)

func TestGVEngine_P0_IdentityGate_UnknownCollection(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	// RB-P0-003, AC-P0-002: Unknown collection must be rejected by identity gate
	_, err := engine.Valuate(ctx, "nonexistent_fake_collection-1")
	if err == nil {
		t.Fatalf("expected error for unknown collection, got nil")
	}
}

func TestGVEngine_P0_IdentityGate_ExceedSupply(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	// Plush Pepe has total supply of 2450. Serial 2451 must fail identity gate
	_, err := engine.Valuate(ctx, "plush_pepe-2451")
	if err == nil {
		t.Fatalf("expected error for serial exceeding total supply, got nil")
	}
}
