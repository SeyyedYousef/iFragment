package avm

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"ifragment-backend/internal/repository"
)

var suggestionHttpClient = &http.Client{Timeout: 10 * time.Second}

const aiSuggestionPrompt = `Generate 10 highly valuable, semantic alternative Telegram usernames for "@%s".
These should NOT just be random prefixes/suffixes. Think about synonyms, related industries, related premium keywords, and highly brandable variations. 
For example, if the word is "cars", suggest "auto", "drive", "motor", "wheels", "racing".
If the word is "bitcoin", suggest "crypto", "blockchain", "satoshi", "btc".

Only output a raw JSON array of strings. Do not use markdown backticks.
Example: ["auto", "drive", "motor", "wheels", "racing", "vehicle", "carsapp", "thecars", "supercars", "carsbot"]`

// GetAISuggestions returns a list of semantic alternative usernames using the LLM.
func GetAISuggestions(ctx context.Context, db *repository.Database, username string) []string {
	lower := strings.ToLower(strings.TrimSpace(username))
	prompt := fmt.Sprintf(aiSuggestionPrompt, lower)
	projectKey := os.Getenv("GROQ_API_KEY")

	// Try project key
	if projectKey != "" {
		res, err := callGroqSuggestions(ctx, prompt, projectKey)
		if err == nil && len(res) > 0 {
			return res
		}
	}

	// Try user keys as fallback
	scorer := NewGeminiScorer(db) // reuse the key fetching logic
	keys := scorer.getUserKeys(ctx)
	
	maxKeys := 3
	if len(keys) < maxKeys {
		maxKeys = len(keys)
	}
	
	for i := 0; i < maxKeys; i++ {
		idx := atomic.AddUint64(&scorer.keyIndex, 1) % uint64(len(keys))
		key := keys[idx]
		res, err := callGroqSuggestions(ctx, prompt, key)
		if err == nil && len(res) > 0 {
			return res
		}
	}
	
	return nil
}

func callGroqSuggestions(ctx context.Context, prompt, apiKey string) ([]string, error) {
	apiURL := "https://api.groq.com/openai/v1/chat/completions"

	reqBody := map[string]any{
		"model": "llama-3.3-70b-versatile",
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"temperature": 0.4,
		"max_tokens":  200,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := suggestionHttpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(body))
	}

	var groqResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil {
		return nil, err
	}

	if len(groqResp.Choices) == 0 {
		return nil, fmt.Errorf("empty response")
	}

	rawJSON := strings.TrimSpace(groqResp.Choices[0].Message.Content)
	
	// Remove markdown backticks if the model ignores the prompt instruction
	rawJSON = strings.TrimPrefix(rawJSON, "```json")
	rawJSON = strings.TrimPrefix(rawJSON, "```")
	rawJSON = strings.TrimSuffix(rawJSON, "```")
	rawJSON = strings.TrimSpace(rawJSON)

	var suggestions []string
	if err := json.Unmarshal([]byte(rawJSON), &suggestions); err != nil {
		return nil, err
	}

	// Clean up suggestions
	var clean []string
	for _, s := range suggestions {
		s = strings.TrimSpace(strings.ToLower(s))
		s = strings.TrimPrefix(s, "@")
		if s != "" {
			clean = append(clean, s)
		}
	}

	return clean, nil
}
