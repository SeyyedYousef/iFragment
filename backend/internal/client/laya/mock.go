package laya

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"strings"
)

// MockEvaluator produces deterministic, calibrated System 1 responses
// simulating Laya (ModernBERT-large / mmBERT-base) without external network calls.
type MockEvaluator struct{}

// NewMockEvaluator creates a new offline mock evaluator for Laya.
func NewMockEvaluator() *MockEvaluator {
	return &MockEvaluator{}
}

// Evaluate provides a deterministic Laya answer for every question based on hashing state + question.
func (m *MockEvaluator) Evaluate(_ context.Context, state any, questions map[string]Question) (*Response, error) {
	stateStr := fmt.Sprintf("%v", state)
	answers := make(map[string]Answer, len(questions))

	for qName, q := range questions {
		h := sha256.Sum256([]byte(stateStr + ":laya:" + qName))
		seed := binary.BigEndian.Uint64(h[:8])

		ans := Answer{
			Type:       q.Type,
			Confidence: 0.88 + float64(seed%12)/100.0, // 0.88 to 0.99
		}

		switch q.Type {
		case TypeChoice:
			keys := make([]string, 0, len(q.Criteria))
			for k := range q.Criteria {
				keys = append(keys, k)
			}
			if len(keys) > 0 {
				ans.Choice = keys[0]
				if _, ok := q.Criteria["aesthetic_elite"]; ok {
					ans.Choice = "aesthetic_elite"
				} else if _, ok := q.Criteria["HOLD"]; ok {
					ans.Choice = "HOLD"
				} else if _, ok := q.Criteria["high_turnover"]; ok {
					ans.Choice = "high_turnover"
				}
				ans.Probabilities = map[string]float64{ans.Choice: 0.92}
			} else {
				ans.Choice = "standard"
			}

		case TypeScore:
			if strings.Contains(strings.ToLower(q.Instructions), "1-100") || strings.Contains(strings.ToLower(q.Instructions), "0-100") {
				ans.Score = 75
			} else {
				ans.Score = 7
			}

		case TypeNoul:
			ans.Noul = 0.05
		}

		answers[qName] = ans
	}

	return &Response{
		Model:   "convai/laya-multilingual-v1",
		Answers: answers,
		Usage: Usage{
			InputTokens:  len(stateStr) / 4,
			OutputTokens: len(questions) * 6,
		},
	}, nil
}
