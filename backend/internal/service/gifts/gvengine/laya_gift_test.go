package gvengine

import (
	"context"
	"testing"
	"time"
)

func TestLayaGiftEvaluator_EvaluateGift(t *testing.T) {
	evaluator := NewLayaGiftEvaluator()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	testGifts := []struct {
		model    string
		backdrop string
		symbol   string
		serial   int
	}{
		{"Plush Pepe", "Matrix Green", "Diamond", 42},
		{"Spicy Chili", "Volcano Orange", "Fire", 1001},
		{"Golden Star", "Celestial Blue", "Crown", 7},
		{"Heart Balloon", "Neon Pink", "Rose", 888},
	}

	for _, g := range testGifts {
		res := evaluator.EvaluateGift(ctx, g.model, g.backdrop, g.symbol, g.serial)
		if res == nil {
			t.Fatalf("Expected non-nil LayaGiftResult for %s", g.model)
		}

		if res.TraitSynergyScore < 1 || res.TraitSynergyScore > 10 {
			t.Errorf("TraitSynergyScore out of bounds for %s: %d", g.model, res.TraitSynergyScore)
		}

		if res.SynergyMultiplier < 0.85 || res.SynergyMultiplier > 1.80 {
			t.Errorf("SynergyMultiplier out of bounds for %s: %f", g.model, res.SynergyMultiplier)
		}

		if res.ActionRecommendation == "" {
			t.Errorf("ActionRecommendation must not be empty for %s", g.model)
		}

		if res.CollectorAppeal == "" {
			t.Errorf("CollectorAppeal must not be empty for %s", g.model)
		}

		if res.VerdictSummaryEn == "" || res.VerdictSummaryFa == "" {
			t.Errorf("Expected non-empty summaries for %s", g.model)
		}
	}
}
