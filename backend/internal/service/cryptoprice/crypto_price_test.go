package cryptoprice

import (
	"testing"
	"time"
)

func TestCryptoPriceService_StaleDetection(t *testing.T) {
	svc := NewCryptoPriceService(nil)

	// Before any fetch
	_, ok, isStale, _ := svc.GetPriceWithFreshness("the-open-network")
	if ok {
		t.Fatalf("expected ok=false before any fetch")
	}
	if !isStale {
		t.Fatalf("expected isStale=true before any fetch")
	}

	// Set price fetched 20 minutes ago (stale, but valid)
	svc.mu.Lock()
	svc.prices["the-open-network"] = 4.25
	svc.lastFetch = time.Now().Add(-20 * time.Minute)
	svc.mu.Unlock()

	price, ok, isStale, _ := svc.GetPriceWithFreshness("the-open-network")
	if !ok || price != 4.25 {
		t.Fatalf("expected price 4.25, got %v", price)
	}
	if !isStale {
		t.Fatalf("expected price to be marked stale after 20 minutes")
	}

	// Extreme staleness (> 2 hours) should fail closed in GetFloatPrice
	svc.mu.Lock()
	svc.lastFetch = time.Now().Add(-3 * time.Hour)
	svc.mu.Unlock()

	_, ok = svc.GetFloatPrice("the-open-network")
	if ok {
		t.Fatalf("expected GetFloatPrice to fail closed for price older than 2 hours")
	}
}
