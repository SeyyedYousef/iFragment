package seeder

import (
	"testing"
)

func TestCanonicalModels(t *testing.T) {
	pepeModels := getCanonicalModels("plush_pepe")
	if len(pepeModels) == 0 {
		t.Fatalf("expected plush_pepe models, got 0")
	}

	capModels := getCanonicalModels("durov_cap")
	if len(capModels) == 0 {
		t.Fatalf("expected durov_cap models, got 0")
	}

	defaultModels := getCanonicalModels("unknown_gift")
	if len(defaultModels) == 0 {
		t.Fatalf("expected default models, got 0")
	}
}
