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
	FetchError  bool // New flag indicating a network/API failure
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
		if r.FetchError {
			result.FetchError = true
		}
		if r.Exists && r.Score > result.Score {
			result = r
		}
	}

	// 3. Cache result with memory safety check
	wikiCacheMutex.Lock()
	if len(wikiCache) >= 5000 {
		wikiCache = make(map[string]*WikipediaResult)
		wikiCacheTime = make(map[string]time.Time)
	}
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
		return &WikipediaResult{FetchError: true}
	}
	req.Header.Set("User-Agent", "iFragment/1.0 (Telegram Mini App)")

	resp, err := wikiHTTP.Do(req)
	if err != nil {
		slog.Debug("Wikipedia API fetch failed", "term", term, "error", err)
		return &WikipediaResult{FetchError: true}
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return &WikipediaResult{Exists: false}
	}
	if resp.StatusCode != http.StatusOK {
		return &WikipediaResult{FetchError: true}
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &WikipediaResult{FetchError: true}
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
		Type         string `json:"type"`          // "standard", "disambiguation", "no-extract"
		WikibaseItem string `json:"wikibase_item"` // e.g., "Q131723" — Wikidata entity ID
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
	var score float64
	switch {
	case pageLength > 3000:
		score = 85 // Major entity
	case pageLength > 2000:
		score = 75
	case pageLength > 1000:
		score = 65
	case pageLength > 500:
		score = 55
	case pageLength > 200:
		score = 40
	default:
		score = 20 // Minor stub, but exists
	}

	// Disambiguation pages are common words (extra bonus)
	if wikiResp.Type == "disambiguation" {
		score = math.Min(score+15, 90)
	}

	// Boost score using Wikidata entity (sitelinks = number of language editions)
	if wikiResp.WikibaseItem != "" {
		sitelinks := getWikidataSitelinks(wikiResp.WikibaseItem)
		if sitelinks > 0 {
			// 200+ sitelinks (Bitcoin, Google) → huge boost
			// 100+ sitelinks → strong boost
			// 50+ sitelinks → moderate boost
			var wikiBoost float64
			switch {
			case sitelinks > 200:
				wikiBoost = 15
			case sitelinks > 150:
				wikiBoost = 12
			case sitelinks > 100:
				wikiBoost = 10
			case sitelinks > 50:
				wikiBoost = 7
			case sitelinks > 20:
				wikiBoost = 4
			}
			score = math.Min(score+wikiBoost, 99)
		}
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

// getWikidataSitelinks queries Wikidata for the number of sitelinks (language editions)
// an entity has. More sitelinks = more globally significant.
// Bitcoin (Q131723) has 200+, "xyzqw" has 0.
func getWikidataSitelinks(entityID string) int {
	if entityID == "" {
		return 0
	}

	url := fmt.Sprintf("https://www.wikidata.org/wiki/Special:EntityData/%s.json", entityID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return 0
	}
	req.Header.Set("User-Agent", "iFragment/1.0 (Telegram Mini App)")

	resp, err := wikiHTTP.Do(req)
	if err != nil {
		return 0
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0
	}

	// We only need to count "sitelinks" keys, not parse the full entity
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0
	}

	var data struct {
		Entities map[string]struct {
			Sitelinks map[string]any `json:"sitelinks"`
		} `json:"entities"`
	}

	if err := json.Unmarshal(body, &data); err != nil {
		return 0
	}

	for _, entity := range data.Entities {
		return len(entity.Sitelinks)
	}
	return 0
}
