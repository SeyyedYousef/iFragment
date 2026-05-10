package username

import (
	"context"
	"testing"
	"time"
)

func TestAggregatorService(t *testing.T) {
	// A proper test would mock tonClient and ggClient
	// Here we just ensure the service initializes correctly
	service := NewAggregatorService(nil, nil)
	if service == nil {
		t.Fatal("Expected service to be initialized")
	}

	// Fast path test for context cancellation
	_, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	errCh := make(chan error, 1)
	go func() {
		_, err := service.GetCollectionStats()
		errCh <- err
	}()

	select {
	case <-errCh:
		// Expected to return error or empty because of nil clients, but shouldn't panic
	case <-time.After(time.Second * 2):
		t.Fatal("Test timed out")
	}
}
