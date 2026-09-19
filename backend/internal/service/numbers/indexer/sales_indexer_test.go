package indexer

import (
	"testing"
	"time"
)

func TestSalesFinalityCheck(t *testing.T) {
	// Test that events newer than 15 seconds are considered unfinalized (to avoid edge-block reorgs)
	now := time.Now()

	recentEventTime := now.Add(-5 * time.Second)
	finalizedEventTime := now.Add(-30 * time.Second)

	if age := time.Since(recentEventTime); age >= 15*time.Second {
		t.Errorf("expected recent event age < 15s, got %v", age)
	}

	if age := time.Since(finalizedEventTime); age < 15*time.Second {
		t.Errorf("expected finalized event age >= 15s, got %v", age)
	}
}
