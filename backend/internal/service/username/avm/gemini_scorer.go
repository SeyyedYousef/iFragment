package avm

import (
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

// GeminiScorer provides AI-powered username desirability scoring using Gemini Flash.
// It implements a 3-tier key strategy:
//  1. Project key (GEMINI_API_KEY env var) — used first
//  2. Fallback to user-provided keys from channel settings — round-robin
//  3. Neutral score (50) if all keys fail
type GeminiScorer struct {
	projectKey   string
	db           *repository.Database
	keyIndex     uint64 // atomic counter for round-robin
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

type GeminiResult struct {
	Score  int      `json:"score"`
	Reason string   `json:"reason"`
	Tags   []string `json:"tags"`
}

// NewGeminiScorer creates a new scorer with project key and DB access for user keys.
func NewGeminiScorer(db *repository.Database) *GeminiScorer {
	key := os.Getenv("GROQ_API_KEY")
	// If GROQ_API_KEY is empty, it will fail gracefully or rely on fallback logic if implemented.
	return &GeminiScorer{
		projectKey: key,
		db:         db,
		cache:      make(map[string]*GeminiResult),
		cacheTime:  make(map[string]time.Time),
		cacheTTL:   12 * time.Hour,
		userKeysTTL: 5 * time.Minute,
		httpClient: &http.Client{Timeout: 8 * time.Second},
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

Calibration examples:
- "news"=99 (Massive global industry, 4-letter, universally understood)
- "sport"=98 (Massive global industry, 5-letter, high commercial value)
- "bitcoin"=99 (Top tier crypto brand, highly liquid asset)
- "tesla"=97 (Top global brand, strong cult following)
- "rare"=88 (4-letter, real English word, evokes exclusivity)
- "king"=85 (4-letter, real English word, evokes power)
- "web3news"=70 (Compound word, niche crypto audience)
- "tonwallet"=60 (Compound word, specific niche, functional)
- "cryptobot"=45 (Compound word, functional but generic)
- "cool"=78 (4-letter, positive meaning, but common)
- "abcd"=15 (4-letter, pattern but no real meaning)
- "xyzw"=3 (Random letters, unpronounceable, no meaning)
- "jkl123"=3 (Random letters + numbers, zero value)
- "a_b_c_d"=2 (Underscores ruin visual appeal, spammy)

CRITICAL: Respond with ONLY a raw JSON object. Do not use markdown backticks. Do not include introductory text.
{"score": <number>, "reason": "<one-line explanation>", "tags": ["crypto", "premium", "noun", "4-letter"]}`

// Score returns the AI desirability score for a username (0-100).
// It uses caching to avoid repeated API calls.
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

// callWithFallback tries project key first, then falls back to user keys.
func (g *GeminiScorer) callWithFallback(ctx context.Context, prompt string) *GeminiResult {
	// Tier 1: Project key
	if g.projectKey != "" {
		result, err := g.callGemini(ctx, prompt, g.projectKey)
		if err == nil {
			slog.Info("Gemini AI scored successfully via project key", "score", result.Score, "reason", result.Reason)
			return result
		}
		slog.Warn("Gemini project key FAILED", "error", err, "key_prefix", g.projectKey[:min(8, len(g.projectKey))]+"...")
	} else {
		slog.Warn("GEMINI_API_KEY env var is NOT SET — skipping project key tier")
	}

	// Tier 2: User keys (round-robin)
	keys := g.getUserKeys(ctx)
	if len(keys) == 0 {
		slog.Warn("Groq scorer: NO API keys available (project=empty, user_keys=0). Returning fallback 60.")
		return &GeminiResult{Score: 60, Reason: "no API keys available, neutral score"}
	}

	maxAttempts := 3
	if maxAttempts > len(keys) {
		maxAttempts = len(keys)
	}

	for i := 0; i < maxAttempts; i++ {
		idx := atomic.AddUint64(&g.keyIndex, 1) % uint64(len(keys))
		key := keys[idx]

		result, err := g.callGemini(ctx, prompt, key)
		if err == nil {
			slog.Info("Groq AI scored successfully", "score", result.Score, "reason", result.Reason)
			return result
		}
		slog.Warn("Groq key FAILED", "attempt", i+1, "error", err, "key_prefix", key[:min(8, len(key))]+"...")
	}

	// Tier 3: All failed — fallback to low score for safety
	slog.Error("ALL Groq API keys exhausted! Returning fallback 60. Fix your API keys!")
	return &GeminiResult{Score: 60, Reason: "all API keys exhausted, fallback"}
}

// callGemini makes a single API call to Groq (Llama-3).
// (Kept function name as callGemini to avoid breaking other files)
func (g *GeminiScorer) callGemini(ctx context.Context, prompt, apiKey string) (*GeminiResult, error) {
	apiURL := "https://api.groq.com/openai/v1/chat/completions"

	reqBody := map[string]any{
		"model": "llama-3.3-70b-versatile", // Highest tier Groq model
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

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("rate limited (429)")
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		bodyStr := string(body[:min(len(body), 500)])
		slog.Error("Gemini API returned non-200", "status", resp.StatusCode, "body", bodyStr)
		return nil, fmt.Errorf("gemini status %d: %s", resp.StatusCode, bodyStr)
	}

	var groqResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}

	if len(groqResp.Choices) == 0 || groqResp.Choices[0].Message.Content == "" {
		return nil, fmt.Errorf("empty response from Groq")
	}

	rawJSON := strings.TrimSpace(groqResp.Choices[0].Message.Content)

	// Parse the score from the JSON response
	var result GeminiResult
	if err := json.Unmarshal([]byte(rawJSON), &result); err != nil {
		// Try extracting score from malformed response
		score, errExt := extractScoreFromText(rawJSON)
		if errExt != nil {
			return nil, fmt.Errorf("failed to parse score from JSON and text. Raw text: %s", rawJSON)
		}
		result = GeminiResult{Score: score, Reason: "parsed from raw", Tags: []string{"fallback"}}
	}

	// Clamp score
	if result.Score < 1 {
		result.Score = 1
	}
	if result.Score > 100 {
		result.Score = 100
	}

	return &result, nil
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
