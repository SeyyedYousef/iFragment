package avm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"ifragment-backend/internal/repository"
)

// SemanticProvider defines the interface for AI-based username scoring
type SemanticProvider interface {
	Score(ctx context.Context, username string) (*GeminiResult, error)
}

type GeminiResult struct {
	Score     int      `json:"score"`
	Reason    string   `json:"reason"`
	Tags      []string `json:"tags"`
	Available bool     `json:"available"`
}

// GeminiScorer orchestrates AI scoring via Groq or Gemini providers based on configuration.
type GeminiScorer struct {
	provider     SemanticProvider
	projectKey   string
	db           *repository.Database
	keyIndex     uint64
	cache        map[string]*GeminiResult
	cacheMutex   sync.RWMutex
	cacheTime    map[string]time.Time
	cacheTTL     time.Duration
	userKeys     []string
	userKeysMu   sync.RWMutex
	userKeysTime time.Time
	userKeysTTL  time.Duration
	httpClient   *http.Client
}

// NewGeminiScorer creates a new AI scorer with provider auto-detection.
func NewGeminiScorer(db *repository.Database) *GeminiScorer {
	key := os.Getenv("GROQ_API_KEY")
	if key == "" {
		key = os.Getenv("GEMINI_API_KEY")
	}
	return &GeminiScorer{
		projectKey:  key,
		db:          db,
		cache:       make(map[string]*GeminiResult),
		cacheTime:   make(map[string]time.Time),
		cacheTTL:    12 * time.Hour,
		userKeysTTL: 5 * time.Minute,
		httpClient:  &http.Client{Timeout: 8 * time.Second},
	}
}

const geminiScorerPrompt = `Rate the desirability of the Telegram username "@%s" as a premium digital asset on a scale of 1-100.

Consider ALL of these factors:
- Brand value: Is it a known company, game, product, or service?
- Cultural significance: Is it a globally recognized word, concept, or trend?
- Memorability: Is it easy to remember and type?
- Pronounceability: Does it sound good when spoken aloud?
- Emotional appeal: Does it evoke power, wealth, exclusivity, or desire?
- Market demand: Would people pay a premium for this username?
- Length bonus: Shorter meaningful words are exponentially more valuable.

Respond with ONLY a raw JSON object. Do not use markdown backticks.
{"score": <number>, "reason": "<one-line explanation>", "tags": ["crypto", "premium", "noun", "4-letter"]}`

// Score returns the AI desirability score for a username.
// If AI is unavailable or fails, Available is set to false and Score is 0 so valuations are NEVER artificially inflated!
func (g *GeminiScorer) Score(ctx context.Context, username string) *GeminiResult {
	lower := strings.ToLower(strings.TrimSpace(username))

	// 1. Check cache
	g.cacheMutex.RLock()
	cached, exists := g.cache[lower]
	cachedAt := g.cacheTime[lower]
	g.cacheMutex.RUnlock()

	if exists && time.Since(cachedAt) < g.cacheTTL {
		return cached
	}

	// 2. Try scoring with available keys
	prompt := fmt.Sprintf(geminiScorerPrompt, lower)
	result := g.callWithFallback(ctx, prompt)

	// 3. Cache result with bounds safety
	g.cacheMutex.Lock()
	if len(g.cache) >= 5000 {
		g.cache = make(map[string]*GeminiResult)
		g.cacheTime = make(map[string]time.Time)
	}
	g.cache[lower] = result
	g.cacheTime[lower] = time.Now()
	g.cacheMutex.Unlock()

	return result
}

// callWithFallback tries project key first, then user keys. Returns Available=false on failure.
func (g *GeminiScorer) callWithFallback(ctx context.Context, prompt string) *GeminiResult {
	// Tier 1: Project key
	if g.projectKey != "" {
		result, err := g.callAIProvider(ctx, prompt, g.projectKey)
		if err == nil && result != nil {
			result.Available = true
			slog.Info("AI scored successfully via project key", "score", result.Score, "reason", result.Reason)
			return result
		}
		slog.Warn("AI project key FAILED", "error", err)
	}

	// Tier 2: User keys (round-robin)
	keys := g.getUserKeys(ctx)
	if len(keys) == 0 {
		slog.Warn("AI scorer: NO API keys available. Returning uninflated zero result.")
		return &GeminiResult{Score: 0, Reason: "no API keys available, AI signal excluded", Available: false}
	}

	maxAttempts := 3
	if maxAttempts > len(keys) {
		maxAttempts = len(keys)
	}

	for i := 0; i < maxAttempts; i++ {
		idx := atomic.AddUint64(&g.keyIndex, 1) % uint64(len(keys))
		key := keys[idx]

		result, err := g.callAIProvider(ctx, prompt, key)
		if err == nil && result != nil {
			result.Available = true
			slog.Info("AI scored successfully via user key", "score", result.Score, "reason", result.Reason)
			return result
		}
	}

	// Tier 3: All failed — return Available=false, Score=0 to avoid artificial inflation
	slog.Warn("ALL AI API keys exhausted! Returning uninflated zero result.")
	return &GeminiResult{Score: 0, Reason: "all API keys exhausted, AI signal excluded", Available: false}
}

// callAIProvider dispatches request to Groq or Gemini endpoints based on API key prefix.
func (g *GeminiScorer) callAIProvider(ctx context.Context, prompt, apiKey string) (*GeminiResult, error) {
	// Auto-detect Gemini vs Groq
	if strings.HasPrefix(apiKey, "AIzaSy") || strings.EqualFold(os.Getenv("SEMANTIC_PROVIDER"), "gemini") {
		return g.callGeminiDirect(ctx, prompt, apiKey)
	}
	return g.callGroqDirect(ctx, prompt, apiKey)
}

func (g *GeminiScorer) callGroqDirect(ctx context.Context, prompt, apiKey string) (*GeminiResult, error) {
	apiURL := "https://api.groq.com/openai/v1/chat/completions"

	reqBody := map[string]any{
		"model": "llama-3.3-70b-versatile",
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"temperature": 0.1,
		"max_tokens":  300,
		"response_format": map[string]string{
			"type": "json_object",
		},
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

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("groq status %d: %s", resp.StatusCode, string(body[:min(len(body), 200)]))
	}

	var groqResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil || len(groqResp.Choices) == 0 {
		return nil, fmt.Errorf("failed to decode groq response: %w", err)
	}

	content := strings.TrimSpace(groqResp.Choices[0].Message.Content)
	var res GeminiResult
	if err := json.Unmarshal([]byte(content), &res); err != nil {
		return nil, fmt.Errorf("failed to parse groq JSON content: %w", err)
	}
	return &res, nil
}

func (g *GeminiScorer) callGeminiDirect(ctx context.Context, prompt, apiKey string) (*GeminiResult, error) {
	apiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=%s", apiKey)

	reqBody := map[string]any{
		"contents": []map[string]any{
			{"parts": []map[string]string{{"text": prompt}}},
		},
		"generationConfig": map[string]any{
			"responseMimeType": "application/json",
			"temperature":      0.1,
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gemini status %d: %s", resp.StatusCode, string(body[:min(len(body), 200)]))
	}

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil || len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("failed to decode gemini response: %w", err)
	}

	text := strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
	var res GeminiResult
	if err := json.Unmarshal([]byte(text), &res); err != nil {
		return nil, fmt.Errorf("failed to parse gemini JSON content: %w", err)
	}
	return &res, nil
}

// getUserKeys fetches and caches API keys from user channel settings.
func (g *GeminiScorer) getUserKeys(ctx context.Context) []string {
	g.userKeysMu.RLock()
	if time.Since(g.userKeysTime) < g.userKeysTTL && len(g.userKeys) > 0 {
		keys := g.userKeys
		g.userKeysMu.RUnlock()
		return keys
	}
	g.userKeysMu.RUnlock()

	// Fetch from DB
	keys := g.fetchUserKeysFromDB(ctx)

	g.userKeysMu.Lock()
	g.userKeys = keys
	g.userKeysTime = time.Now()
	g.userKeysMu.Unlock()

	return keys
}

// fetchUserKeysFromDB queries the channel_settings table for unique API keys.
func (g *GeminiScorer) fetchUserKeysFromDB(ctx context.Context) []string {
	if g.db == nil {
		return nil
	}

	query := `
		SELECT DISTINCT posting->>'apiKey' AS api_key
		FROM channel_settings
		WHERE posting->>'apiKey' IS NOT NULL
		  AND posting->>'apiKey' != ''
		LIMIT 100
	`

	rows, err := g.db.Pool.Query(ctx, query)
	if err != nil {
		slog.Warn("Failed to fetch user API keys for Gemini scorer", "error", err)
		return nil
	}
	defer rows.Close()

	var keys []string
	seen := make(map[string]bool)
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err == nil && key != "" && !seen[key] {
			seen[key] = true
			keys = append(keys, key)
		}
	}

	slog.Info("Loaded user Gemini API keys for AVM scorer", "count", len(keys))
	return keys
}

// extractScoreFromText tries to extract a numeric score from a malformed AI response.
func extractScoreFromText(text string) (int, error) {
	// Look for "score": <number>
	idx := strings.Index(strings.ToLower(text), `"score":`)
	if idx != -1 {
		part := text[idx+8:]
		var numStr string
		for _, ch := range part {
			if ch >= '0' && ch <= '9' {
				numStr += string(ch)
			} else if len(numStr) > 0 {
				break
			}
		}
		if n, err := strconv.Atoi(numStr); err == nil && n >= 1 && n <= 100 {
			return n, nil
		}
	}

	// Fallback: just find the first valid number between 1 and 100
	for _, word := range strings.Fields(strings.ReplaceAll(text, "\"", "")) {
		word = strings.TrimFunc(word, func(r rune) bool {
			return r < '0' || r > '9'
		})
		if n, err := strconv.Atoi(word); err == nil && n >= 1 && n <= 100 {
			return n, nil
		}
	}
	return 0, fmt.Errorf("no numeric score found in text")
}
