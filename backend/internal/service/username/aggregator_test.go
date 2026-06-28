package username

import (
	"testing"
)

func TestAggregatorService(t *testing.T) {
	// Ensure the service initializes correctly
	service := NewAggregatorService(nil, nil)
	if service == nil {
		t.Fatal("Expected service to be initialized")
	}

}
