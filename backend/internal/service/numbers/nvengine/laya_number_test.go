package nvengine

import (
	"context"
	"testing"
	"time"
)

func TestLayaNumberEvaluator_EvaluateNumber(t *testing.T) {
	evaluator := NewLayaNumberEvaluator()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	testNumbers := []string{
		"+888 8888 8888",
		"+888 0000 1111",
		"+888 1234 5678",
		"+888 9999 0000",
	}

	for _, num := range testNumbers {
		res := evaluator.EvaluateNumber(ctx, num)
		if res == nil {
			t.Fatalf("Expected non-nil LayaNumberResult for %s", num)
		}

		if res.ScoreChina < 1 || res.ScoreChina > 100 {
			t.Errorf("ScoreChina out of bounds for %s: %d", num, res.ScoreChina)
		}
		if res.ScoreRussia < 1 || res.ScoreRussia > 100 {
			t.Errorf("ScoreRussia out of bounds for %s: %d", num, res.ScoreRussia)
		}
		if res.ScoreMENA < 1 || res.ScoreMENA > 100 {
			t.Errorf("ScoreMENA out of bounds for %s: %d", num, res.ScoreMENA)
		}
		if res.PatternAesthetics < 1 || res.PatternAesthetics > 10 {
			t.Errorf("PatternAesthetics out of bounds for %s: %d", num, res.PatternAesthetics)
		}
		if res.SummaryEn == "" || res.SummaryFa == "" {
			t.Errorf("Expected non-empty summary for %s", num)
		}
	}
}
