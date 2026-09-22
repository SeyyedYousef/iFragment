package laya

import (
	"context"
	"testing"
	"time"
)

func TestLayaClient_OfflineMockEvaluation(t *testing.T) {
	client := NewClient()

	questions := map[string]Question{
		"category": {
			Type:         TypeChoice,
			Instructions: "Select the cultural category",
			Criteria: map[string]string{
				"crypto": "Web3 or crypto terms",
				"gaming": "Video game references",
				"brand":  "Commercial entity",
			},
		},
		"phonetic_score": {
			Type:         TypeScore,
			Instructions: "Rate pronounceability from 1 to 10",
		},
		"commercial_intent": {
			Type:         TypeNoul,
			Instructions: "Is there high commercial intent?",
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	resp, err := client.Evaluate(ctx, map[string]string{"username": "telegram"}, questions)
	if err != nil {
		t.Fatalf("Evaluate failed: %v", err)
	}

	if resp == nil {
		t.Fatal("Expected non-nil response")
	}

	if len(resp.Answers) != 3 {
		t.Fatalf("Expected 3 answers, got %d", len(resp.Answers))
	}

	catAns, exists := resp.Answers["category"]
	if !exists || catAns.Choice == "" {
		t.Errorf("Expected choice answer for category, got: %+v", catAns)
	}

	scoreAns, exists := resp.Answers["phonetic_score"]
	if !exists || scoreAns.Score < 1 || scoreAns.Score > 10 {
		t.Errorf("Expected valid score (1-10) for phonetic_score, got: %+v", scoreAns)
	}

	noulAns, exists := resp.Answers["commercial_intent"]
	if !exists || noulAns.Noul < 0.0 || noulAns.Noul > 1.0 {
		t.Errorf("Expected valid noul (0.0-1.0) for commercial_intent, got: %+v", noulAns)
	}
}
