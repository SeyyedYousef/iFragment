package avm

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// DatamuseResponse represents a single word match from the Datamuse API
type DatamuseResponse struct {
	Word  string   `json:"word"`
	Score int      `json:"score"`
	Tags  []string `json:"tags"`
	Defs  []string `json:"defs,omitempty"`
}

var (
	// In-memory cache to avoid repeated HTTP calls for the same username
	wordCache  = make(map[string]float64)
	cacheMutex sync.RWMutex
	httpClient = &http.Client{Timeout: 500 * time.Millisecond}

	// DisableDatamuseNetwork can be toggled in unit tests to prevent network I/O latency
	DisableDatamuseNetwork = false
)

// GetWordFrequency queries the Datamuse API to check if a word is an English dictionary word
// and returns its frequency score (occurrences per million words).
// If the word is not found or is a gibberish string, it returns 0.
func GetWordFrequency(word string) float64 {
	word = strings.ToLower(strings.TrimSpace(word))
	if len(word) == 0 {
		return 0
	}

	// English dictionary words never contain numbers or underscores
	if strings.ContainsAny(word, "0123456789_") {
		return 0
	}

	// 1. Check local frequency table first
	if rank := RankWord(word); rank > 0 {
		return math.Max(5.0, 5000.0/float64(rank))
	}

	// 2. Check Cache
	cacheMutex.RLock()
	freq, exists := wordCache[word]
	cacheMutex.RUnlock()
	if exists {
		return freq
	}

	if DisableDatamuseNetwork {
		return 0
	}


	// 3. Fetch from Datamuse with negative caching
	url := fmt.Sprintf("https://api.datamuse.com/words?sp=%s&max=1&md=f", word)
	resp, err := httpClient.Get(url)
	if err != nil {
		slog.Warn("Datamuse API fetch failed", "word", word, "error", err)
		cacheMutex.Lock()
		wordCache[word] = 0
		cacheMutex.Unlock()
		return 0
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		slog.Warn("Datamuse API returned non-200", "word", word, "status", resp.StatusCode)
		cacheMutex.Lock()
		wordCache[word] = 0
		cacheMutex.Unlock()
		return 0
	}


	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0
	}

	var results []DatamuseResponse
	if err := json.Unmarshal(body, &results); err != nil {
		return 0
	}

	var frequency float64 = 0

	// Check if we got a match and it exactly matches the requested word
	if len(results) > 0 && strings.ToLower(results[0].Word) == word {
		// Parse the frequency tag e.g., "f:123.45"
		for _, tag := range results[0].Tags {
			if strings.HasPrefix(tag, "f:") {
				valStr := strings.TrimPrefix(tag, "f:")
				if parsed, err := strconv.ParseFloat(valStr, 64); err == nil {
					frequency = parsed
					break
				}
			}
		}
	}

	// 3. Update Cache with bounds safety
	cacheMutex.Lock()
	if len(wordCache) >= 5000 {
		wordCache = make(map[string]float64)
	}
	wordCache[word] = frequency
	cacheMutex.Unlock()

	return frequency
}

// CalculateSemanticMultiplier evaluates the Datamuse frequency and returns a price multiplier.
// Returns multiplier and is_dictionary bool.
func CalculateSemanticMultiplier(word string) (float64, bool) {
	freq := GetWordFrequency(word)

	if freq == 0 {
		// Not a dictionary word, or extremely rare
		return 1.0, false
	}

	// Frequency ranges:
	// "the" might be 40000.0 (top word)
	// "time" might be 1500.0
	// "king" might be 100.0
	// "music" might be 150.0
	// "apple" might be 30.0
	// "syzygy" might be 0.1

	// Base multiplier for being a real word
	baseDictMultiplier := 2.0

	// Add bonus for common words (logarithmic scaling)
	// Example: freq=100 -> log10(100) = 2. freq=10000 -> log10(10000) = 4
	freqBonus := 0.0
	if freq > 1.0 {
		freqBonus = math.Log10(freq) * 0.5 // up to +2.0 for top words
	}

	totalMultiplier := baseDictMultiplier + freqBonus

	// Cap at 4.5x multiplier
	if totalMultiplier > 4.5 {
		totalMultiplier = 4.5
	}

	return totalMultiplier, true
}

type DictionaryDetails struct {
	IsWord       bool
	PartOfSpeech string
	Definition   string
}

// GetDictionaryDetails queries Datamuse for md=d,p to get definition and POS
func GetDictionaryDetails(word string) DictionaryDetails {
	word = strings.ToLower(strings.TrimSpace(word))
	res := DictionaryDetails{IsWord: false}

	if len(word) == 0 {
		return res
	}

	url := fmt.Sprintf("https://api.datamuse.com/words?sp=%s&max=1&md=d,p", word)
	resp, err := httpClient.Get(url)
	if err != nil {
		return res
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return res
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return res
	}

	var results []DatamuseResponse
	if err := json.Unmarshal(body, &results); err != nil {
		return res
	}

	if len(results) > 0 && strings.ToLower(results[0].Word) == word {
		res.IsWord = true

		// Map part of speech
		posMap := map[string]string{
			"n":   "Noun",
			"v":   "Verb",
			"adj": "Adjective",
			"adv": "Adverb",
			"u":   "Unknown",
		}

		for _, tag := range results[0].Tags {
			if fullPos, ok := posMap[tag]; ok {
				res.PartOfSpeech = fullPos
				break
			}
		}

		if len(results[0].Defs) > 0 {
			// Defs are typically formatted like "n\ta pocket-size case"
			defStr := results[0].Defs[0]
			parts := strings.SplitN(defStr, "\t", 2)
			if len(parts) == 2 {
				res.Definition = parts[1]
			} else {
				res.Definition = defStr
			}
		}
	}

	return res
}
