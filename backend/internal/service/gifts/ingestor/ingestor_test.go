package ingestor

import (
	"context"
	"testing"
	"time"
)

func TestIngestionEngine_Instantiation(t *testing.T) {
	eng := NewIngestionEngine(nil, nil, nil, 6*time.Hour)
	if eng == nil {
		t.Fatal("Expected non-nil IngestionEngine")
	}

	slugs := eng.resolveCollectionSlugs(context.Background())
	if len(slugs) == 0 {
		t.Fatal("Expected collection slugs from canonical catalog fallback, got 0")
	}

	foundPepe := false
	for _, s := range slugs {
		if s == "plush-pepe" || s == "plush_pepe" {
			foundPepe = true
			break
		}
	}
	if !foundPepe {
		t.Errorf("Expected to find iconic plush-pepe in resolved slugs list")
	}
}
