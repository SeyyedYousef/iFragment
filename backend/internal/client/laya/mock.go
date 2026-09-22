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
				idx := int(seed % uint64(len(keys)))
				ans.Choice = keys[idx]

				probs := make(map[string]float64, len(keys))
				sum := 0.0
				for _, k := range keys {
					p := 0.1 + float64((seed^uint64(len(k)))%80)/100.0
					probs[k] = p
					sum += p
				}
				for k := range probs {
					probs[k] = float64(int((probs[k]/sum)*100)) / 100.0
				}
				ans.Probabilities = probs
			} else {
				ans.Choice = "standard"
			}

		case TypeScore:
			if strings.Contains(strings.ToLower(q.Instructions), "1-100") || strings.Contains(strings.ToLower(q.Instructions), "0-100") {
				ans.Score = 45 + int(seed%52) // 45-96
			} else {
				ans.Score = 5 + int(seed%6) // 5-10
			}

		case TypeNoul:
			ans.Noul = float64(seed%100) / 100.0
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
