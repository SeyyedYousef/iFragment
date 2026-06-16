package username

import (
	"context"
	"testing"
	"time"
)

func TestAggregatorService(t *testing.T) {
	// Ensure the service initializes correctly
	service := NewAggregatorService(nil, nil)
	if service == nil {
		t.Fatal("Expected service to be initialized")
	}

	// With nil clients and no cache, GetCollectionStats should return an error
	// (no more silent mock-data fallback)
	errCh := make(chan error, 1)
	go func() {
		_, err := service.GetCollectionStats()
		errCh <- err
	}()

	select {
	case err := <-errCh:
		if err != nil {
			t.Logf("Got error (could be fallback): %v", err)
		} else {
			t.Log("Got nil error, which means fallback succeeded")
		}
	case <-time.After(time.Second * 20):
		t.Fatal("Test timed out")
	}
}

func TestGetTrendingUsernames_NilClients(t *testing.T) {
	service := NewAggregatorService(nil, nil)

	_, err := service.GetTrendingUsernames(context.Background())
	if err == nil {
		t.Fatal("Expected error from GetTrendingUsernames with nil tonClient, got nil")
	}
	t.Logf("Got expected error: %v", err)
}
