package avm

import (
	"bytes"
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

var suggestionHttpClient = &http.Client{Timeout: 8 * time.Second}

const suggestionCacheTTL = 6 * time.Hour

type suggestionCacheEntry struct {
	names     []string
	expiresAt time.Time
}

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
	if len(suggestionCache) > 5000 {
		suggestionCache = make(map[string]suggestionCacheEntry, 512)
	}
	suggestionCache[key] = suggestionCacheEntry{names: names, expiresAt: time.Now().Add(suggestionCacheTTL)}
}

const aiSuggestionPrompt = `Generate 8-10 high-value, genuine semantic synonyms and conceptual peers for the Telegram username "@%s".
CRITICAL RULES:
1. Return ONLY true synonyms, concept equivalents, and single-word industry peers.
2. NEVER add trivial prefixes or suffixes (ABSOLUTELY NO 'app', 'bot', 'pro', 'hq', 'vip', 'x', 's', 'the', 'my', 'real', 'official').
3. Examples:
   - For "rare": ["unique", "uncommon", "scarce", "singular", "exclusive", "limited", "grail", "precious"]
   - For "cars": ["auto", "vehicle", "motors", "wheels", "drive", "racing", "supercar", "ride"]
   - For "bitcoin": ["ethereum", "solana", "crypto", "satoshi", "blockchain", "token", "wallet"]
4. Each item must be a valid lowercase alphanumeric handle (3-15 chars) without @.
5. Output ONLY a raw JSON array of strings: ["synonym1", "synonym2", ...]`

// GetAISuggestions returns a list of semantic alternative usernames using Gemini, Groq, or Thesaurus.
func GetAISuggestions(ctx context.Context, db *repository.Database, username string) []string {
	lower := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(username, "@")))
	if cached, ok := cachedSuggestions(lower); ok {
		return cached
	}

	prompt := fmt.Sprintf(aiSuggestionPrompt, lower)
	geminiKey := os.Getenv("GEMINI_API_KEY")
	groqKey := os.Getenv("GROQ_API_KEY")

	var res []string
	var err error

	// 1. Try Gemini First (fastest & highest quality)
	if geminiKey != "" {
		res, err = callGeminiSuggestions(ctx, prompt, geminiKey)
		if err == nil && len(res) > 0 {
			clean := sanitizeSuggestions(lower, res)
			if len(clean) > 0 {
				storeSuggestions(lower, clean)
				return clean
			}
		}
	}

	// 2. Try Groq Second
	if groqKey != "" {
		res, err = callGroqSuggestions(ctx, prompt, groqKey)
		if err == nil && len(res) > 0 {
			clean := sanitizeSuggestions(lower, res)
			if len(clean) > 0 {
				storeSuggestions(lower, clean)
				return clean
			}
		}
	}

	// 3. Fallback to Local Semantic Thesaurus
	thesaurusPicks := GetSemanticSynonyms(lower)
	if len(thesaurusPicks) > 0 {
		picks := make([]string, 0, len(thesaurusPicks))
		for _, item := range thesaurusPicks {
			if item.Username != lower {
				picks = append(picks, item.Username)
			}
		}
		if len(picks) > 0 {
			storeSuggestions(lower, picks)
			return picks
		}
	}

	return nil
}

func sanitizeSuggestions(base string, list []string) []string {
	forbiddenAffixes := []string{"app", "bot", "pro", "hq", "vip", "official", "real"}
	seen := map[string]bool{base: true}
	var clean []string

	for _, raw := range list {
		s := strings.TrimSpace(strings.ToLower(raw))
		s = strings.TrimPrefix(s, "@")
		if s == "" || len(s) < 3 || len(s) > 32 || seen[s] {
			continue
		}

		// Reject cheap affix spam like base+"x", base+"s", base+"hq", "the"+base
		if strings.HasPrefix(s, base) && len(s) > len(base) {
			suffix := s[len(base):]
			if suffix == "s" || suffix == "x" || suffix == "hq" || suffix == "app" || suffix == "bot" || suffix == "pro" {
				continue
			}
		}
		if strings.HasSuffix(s, base) && len(s) > len(base) {
			prefix := s[:len(s)-len(base)]
			if prefix == "the" || prefix == "my" || prefix == "get" || prefix == "real" {
				continue
			}
		}

		// Reject generic bad affixes on the word
		isJunk := false
		for _, aff := range forbiddenAffixes {
			if strings.HasSuffix(s, aff) && len(s) > len(aff)+2 && !isWhitelistedRoot(s) {
				isJunk = true
				break
			}
		}
		if isJunk {
			continue
		}

		seen[s] = true
		clean = append(clean, s)
	}
	return clean
}

func isWhitelistedRoot(s string) bool {
	// Words that naturally end in 'pro' or 'app' like 'approach'
	whitelist := map[string]bool{
		"apple": true, "application": true, "prophet": true, "proper": true,
	}
	return whitelist[s]
}

func callGeminiSuggestions(ctx context.Context, prompt, apiKey string) ([]string, error) {
	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = "gemini-2.5-flash"
	}
	apiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)

	reqBody := map[string]any{
		"contents": []map[string]any{
			{"parts": []map[string]string{{"text": prompt}}},
		},
		"generationConfig": map[string]any{
			"responseMimeType": "application/json",
			"temperature":      0.2,
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

	resp, err := suggestionHttpClient.Do(req)
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

	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil || len(geminiResp.Candidates) == 0 {
		return nil, fmt.Errorf("failed to decode gemini response: %w", err)
	}

	parts := geminiResp.Candidates[0].Content.Parts
	if len(parts) == 0 {
		return nil, fmt.Errorf("gemini response has no parts")
	}

	rawJSON := strings.TrimSpace(parts[0].Text)
	rawJSON = strings.TrimPrefix(rawJSON, "```json")
	rawJSON = strings.TrimPrefix(rawJSON, "```")
	rawJSON = strings.TrimSuffix(rawJSON, "```")
	rawJSON = strings.TrimSpace(rawJSON)

	var suggestions []string
	if err := json.Unmarshal([]byte(rawJSON), &suggestions); err != nil {
		return nil, fmt.Errorf("failed to unmarshal gemini json: %w", err)
	}
	return suggestions, nil
}

func callGroqSuggestions(ctx context.Context, prompt, apiKey string) ([]string, error) {
	apiURL := "https://api.groq.com/openai/v1/chat/completions"

	reqBody := map[string]any{
		"model": "llama-3.3-70b-versatile",
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"temperature": 0.2,
		"max_tokens":  250,
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

	if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil || len(groqResp.Choices) == 0 {
		return nil, fmt.Errorf("empty response from groq")
	}

	rawJSON := strings.TrimSpace(groqResp.Choices[0].Message.Content)
	rawJSON = strings.TrimPrefix(rawJSON, "```json")
	rawJSON = strings.TrimPrefix(rawJSON, "```")
	rawJSON = strings.TrimSuffix(rawJSON, "```")
	rawJSON = strings.TrimSpace(rawJSON)

	var suggestions []string
	if err := json.Unmarshal([]byte(rawJSON), &suggestions); err != nil {
		return nil, err
	}
	return suggestions, nil
}
