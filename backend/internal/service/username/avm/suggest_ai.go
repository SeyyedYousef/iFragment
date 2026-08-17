package avm

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"ifragment-backend/internal/repository"
)

var suggestionHttpClient = &http.Client{Timeout: 10 * time.Second}

const suggestionCacheTTL = 6 * time.Hour

type suggestionCacheEntry struct {
	names     []string
	expiresAt time.Time
}

// Semantic alternatives for a given handle are stable for hours, but the
// valuation endpoint used to pay for a fresh Groq round-trip on every single
// request (including cache-busting refreshes).
var (
	suggestionCacheMu sync.RWMutex
	suggestionCache   = map[string]suggestionCacheEntry{}
)

func cachedSuggestions(key string) ([]string, bool) {
	suggestionCacheMu.RLock()
	entry, ok := suggestionCache[key]
	suggestionCacheMu.RUnlock()
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.names, true
}

func storeSuggestions(key string, names []string) {
	suggestionCacheMu.Lock()
	defer suggestionCacheMu.Unlock()
	// Cheap bounded eviction: drop everything once the map grows past a sane size.
	if len(suggestionCache) > 5000 {
		suggestionCache = make(map[string]suggestionCacheEntry, 512)
	}
	suggestionCache[key] = suggestionCacheEntry{names: names, expiresAt: time.Now().Add(suggestionCacheTTL)}
}

const aiSuggestionPrompt = `Generate 10 highly valuable, semantic alternative Telegram usernames for "@%s".
These should NOT just be random prefixes/suffixes. Think about synonyms, related industries, related premium keywords, and highly brandable variations. 
For example, if the word is "cars", suggest "auto", "drive", "motor", "wheels", "racing".
If the word is "bitcoin", suggest "crypto", "blockchain", "satoshi", "btc".

Only output a raw JSON array of strings. Do not use markdown backticks.
Example: ["auto", "drive", "motor", "wheels", "racing", "vehicle", "carsapp", "thecars", "supercars", "carsbot"]`

// GetAISuggestions returns a list of semantic alternative usernames using the LLM.
func GetAISuggestions(ctx context.Context, db *repository.Database, username string) []string {
	lower := strings.ToLower(strings.TrimSpace(username))
	if cached, ok := cachedSuggestions(lower); ok {
		return cached
	}

	prompt := fmt.Sprintf(aiSuggestionPrompt, lower)
	projectKey := os.Getenv("GROQ_API_KEY")

	// Try project key
	if projectKey != "" {
		res, err := callGroqSuggestions(ctx, prompt, projectKey)
		if err == nil && len(res) > 0 {
			storeSuggestions(lower, res)
			return res
		}
	}

	// Return nil if project key fails or is missing
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
