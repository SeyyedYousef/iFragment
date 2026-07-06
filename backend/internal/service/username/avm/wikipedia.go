package avm

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"
)

// WikipediaResult holds the cultural significance data from Wikipedia.
type WikipediaResult struct {
	Exists      bool
	PageLength  int     // character count of the article
	Score       float64 // normalized 0-100
	Description string
}

var (
	wikiCache      = make(map[string]*WikipediaResult)
	wikiCacheMutex sync.RWMutex
	wikiCacheTTL   = 24 * time.Hour
	wikiCacheTime  = make(map[string]time.Time)
	wikiHTTP       = &http.Client{Timeout: 4 * time.Second}
)

// GetWikipediaScore checks if a word/phrase has a Wikipedia article and scores its cultural significance.
// Uses the Wikipedia REST API (no key needed).
// Returns a score from 0 to 100:
//   - 0: No Wikipedia page
//   - 1-30: Minor article (stub, short)
//   - 31-60: Moderate article
//   - 61-100: Major cultural/brand entity (long, significant article)
func GetWikipediaScore(term string) *WikipediaResult {
	term = strings.ToLower(strings.TrimSpace(term))
	if len(term) == 0 {
		return &WikipediaResult{}
	}

	// 1. Check cache
	wikiCacheMutex.RLock()
	cached, exists := wikiCache[term]
	cachedAt := wikiCacheTime[term]
	wikiCacheMutex.RUnlock()

	if exists && time.Since(cachedAt) < wikiCacheTTL {
		return cached
	}

	result := &WikipediaResult{}

	// 2. Try the term as-is first, then try splitting camelCase/compound words
	candidates := []string{term}

	// Split compound words: "clashofclans" -> "clash of clans"
	if len(term) > 6 && !strings.Contains(term, " ") {
		spaced := splitCompoundWord(term)
		if spaced != term {
			candidates = append(candidates, spaced)
		}
	}

	for _, candidate := range candidates {
		r := queryWikipedia(candidate)
		if r.Exists && r.Score > result.Score {
			result = r
		}
	}

	// 3. Cache result
	wikiCacheMutex.Lock()
	wikiCache[term] = result
	wikiCacheTime[term] = time.Now()
	wikiCacheMutex.Unlock()

	return result
}

// queryWikipedia queries the Wikipedia API for a single term.
func queryWikipedia(term string) *WikipediaResult {
	// Use the Wikipedia REST summary API
	title := strings.ReplaceAll(strings.Title(term), " ", "_")
	url := fmt.Sprintf("https://en.wikipedia.org/api/rest_v1/page/summary/%s", title)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return &WikipediaResult{}
	}
	req.Header.Set("User-Agent", "iFragment/1.0 (Telegram Mini App)")

	resp, err := wikiHTTP.Do(req)
	if err != nil {
		slog.Debug("Wikipedia API fetch failed", "term", term, "error", err)
		return &WikipediaResult{}
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return &WikipediaResult{Exists: false}
	}
	if resp.StatusCode != http.StatusOK {
		return &WikipediaResult{}
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &WikipediaResult{}
	}

	var wikiResp struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Extract     string `json:"extract"`
		ContentURLs struct {
			Desktop struct {
				Page string `json:"page"`
			} `json:"desktop"`
		} `json:"content_urls"`
		Type string `json:"type"` // "standard", "disambiguation", "no-extract"
	}

	if err := json.Unmarshal(body, &wikiResp); err != nil {
		return &WikipediaResult{}
	}

	// Disambiguation pages are less valuable, but still indicate cultural significance
	if wikiResp.Type == "no-extract" || wikiResp.Extract == "" {
		return &WikipediaResult{Exists: false}
	}

	pageLength := len(wikiResp.Extract)

	// Score based on extract length (proxy for article importance)
	// Short stubs (<200 chars) = low score, long articles (>2000 chars) = high score
	var score float64
	switch {
	case pageLength > 3000:
		score = 90 // Major entity
	case pageLength > 2000:
		score = 75
	case pageLength > 1000:
		score = 60
	case pageLength > 500:
		score = 45
	case pageLength > 200:
		score = 30
	default:
		score = 15 // Minor stub, but exists
	}

	// Disambiguation pages are common words (extra bonus)
	if wikiResp.Type == "disambiguation" {
		score = math.Min(score+10, 95)
	}

	return &WikipediaResult{
		Exists:      true,
		PageLength:  pageLength,
		Score:       score,
		Description: wikiResp.Description,
	}
}

// splitCompoundWord attempts to split compound words into separate English words.
// "clashofclans" -> "clash of clans", "chatgpt" -> "chatgpt" (no split possible)
func splitCompoundWord(word string) string {
	// Common joining words to try splitting on
	joiners := []string{"of", "and", "the", "for", "in", "on", "by", "to", "at"}
	for _, j := range joiners {
		idx := strings.Index(word, j)
		if idx > 0 && idx+len(j) < len(word) {
			left := word[:idx]
			right := word[idx+len(j):]
			if len(left) >= 2 && len(right) >= 2 {
				return left + " " + j + " " + right
			}
		}
	}
	return word
}
