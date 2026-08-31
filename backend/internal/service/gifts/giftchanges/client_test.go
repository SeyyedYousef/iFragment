package giftchanges

import (
	"context"
	"testing"
	"time"
)

func TestGiftChangesClient_GetTotal(t *testing.T) {
	client := NewClient()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	stats, err := client.GetTotal(ctx)
	if err != nil {
		t.Logf("Warning: Live API call failed (might be offline/rate-limited): %v", err)
		return
	}

	if stats.Gifts.Total <= 0 {
		t.Errorf("Expected Total gifts > 0, got %d", stats.Gifts.Total)
	}
	if stats.Models <= 0 {
		t.Errorf("Expected Models > 0, got %d", stats.Models)
	}
}

func TestGiftChangesClient_GetGifts(t *testing.T) {
	client := NewClient()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	gifts, err := client.GetGifts(ctx)
	if err != nil {
		t.Logf("Warning: Live API call failed: %v", err)
		return
	}

	if len(gifts) == 0 {
		t.Errorf("Expected non-empty gifts list")
	}
}
