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
				ans.Choice = keys[int(seed%uint64(len(keys)))]
				if _, ok := q.Criteria["aesthetic_elite"]; ok {
					ans.Choice = "aesthetic_elite"
				} else if _, ok := q.Criteria["HOLD"]; ok {
					ans.Choice = "HOLD"
				} else if _, ok := q.Criteria["high_turnover"]; ok {
					ans.Choice = "high_turnover"
				} else if _, ok := q.Criteria["safe"]; ok {
					ans.Choice = "safe"
				}
				ans.Probabilities = map[string]float64{ans.Choice: 0.92}
			} else {
				ans.Choice = "standard"
			}

		case TypeScore:
			instLower := strings.ToLower(q.Instructions)
			if strings.Contains(instLower, "1-100") || strings.Contains(instLower, "0-100") || strings.Contains(instLower, "1 to 100") || strings.Contains(instLower, "0 to 100") {
				ans.Score = 62 + int(seed%34) // 62 to 95
			} else {
				ans.Score = 6 + int(seed%4) // 6 to 9
			}

		case TypeNoul:
			if strings.Contains(strings.ToLower(qName), "risk") || strings.Contains(strings.ToLower(qName), "anomaly") {
				ans.Noul = 0.03 + float64(seed%10)/100.0
			} else {
				ans.Noul = 0.65 + float64(seed%30)/100.0
			}
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
