package avm

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"sync"
	"time"

	"ifragment-backend/internal/repository"
)

// SemanticEngine combines 4 intelligence signals to produce a holistic
// "Semantic Score" (0-100) for any Telegram username.
//
// Signals:
//  1. Datamuse Word Frequency (20% weight)
//  2. Wikipedia Cultural Significance (20% weight)
//  3. Gemini AI Desirability (40% weight)
//  4. Clearbit Brand Power (20% weight)
type SemanticEngine struct {
	gemini *GeminiScorer
	cache  map[string]*SemanticResult
	mu     sync.RWMutex
	ttl    time.Duration
	times  map[string]time.Time
}

// SemanticResult holds the combined semantic analysis.
type SemanticResult struct {
	TotalScore      float64  `json:"total_score"`       // 0-100 combined score
	Multiplier      float64  `json:"multiplier"`        // Price multiplier (1x - 200x)
	WordFreqScore   float64  `json:"word_freq_score"`   // 0-100 from Datamuse
	WikiScore       float64  `json:"wiki_score"`        // 0-100 from Wikipedia
	AIScore         float64  `json:"ai_score"`          // 0-100 from Gemini
	BrandScore      int      `json:"brand_score"`       // 0 or 100 from Clearbit
	Tags            []string `json:"tags"`              // AI-generated tags
	AIReason        string   `json:"ai_reason"`         // One-line AI explanation
	WikiDescription string   `json:"wiki_description"`  // Wikipedia article description
}

// NewSemanticEngine creates a new semantic analysis engine.
func NewSemanticEngine(db *repository.Database) *SemanticEngine {
	return &SemanticEngine{
		gemini: NewGeminiScorer(db),
		cache:  make(map[string]*SemanticResult),
		ttl:    12 * time.Hour,
		times:  make(map[string]time.Time),
	}
}

// Score runs all 4 intelligence signals in parallel and combines them.
func (e *SemanticEngine) Score(ctx context.Context, username string) *SemanticResult {
	// 1. Check cache
	e.mu.RLock()
	cached, exists := e.cache[username]
	cachedAt := e.times[username]
	e.mu.RUnlock()

	if exists && time.Since(cachedAt) < e.ttl {
		return cached
	}

	// 2. Run all 4 signals in parallel
	var (
		wordFreqScore float64
		wikiResult    *WikipediaResult
		geminiResult  *GeminiResult
		brandResult   int
		wg            sync.WaitGroup
	)

	wg.Add(4)

	// Signal 1: Word Frequency (LOCAL data first, then Datamuse fallback)
	go func() {
		defer wg.Done()

		// Priority 1: Local frequency_data.go (10K words, instant, no HTTP)
		rank := RankWord(username)
		if rank > 0 {
			// Rank 1 (most common) → score ~100, Rank 10000 → score ~10
			// Formula: 100 - (log10(rank) / log10(10000)) * 90
			wordFreqScore = 100 - (math.Log10(float64(rank))/math.Log10(10000))*90
			wordFreqScore = math.Max(10, math.Min(100, wordFreqScore))
		} else {
			// Priority 2: Datamuse API (catches words not in top 10K)
			freq := GetWordFrequency(username)
			if freq > 0 {
				wordFreqScore = math.Min(50, math.Log10(freq+1)*15) // Cap at 50 for non-local words
			}
		}

		// Bonus: Hype/Meme culture dictionary
		if IsHyped(username) {
			wordFreqScore = math.Max(wordFreqScore, 70) // Meme coins/culture = at least 70
		}
	}()

	// Signal 2: Wikipedia Cultural Significance
	go func() {
		defer wg.Done()
		wikiResult = GetWikipediaScore(username)
	}()

	// Signal 3: Gemini AI Desirability
	go func() {
		defer wg.Done()
		geminiResult = e.gemini.Score(ctx, username)
	}()

	// Signal 4: Clearbit Brand Check (gradient: 0/50/100)
	go func() {
		defer wg.Done()
		brandResult = CheckGlobalBrand(username)
	}()

	wg.Wait()

	// 3. Combine signals with weighted average
	var (
		wikiScore  float64
		aiScore    float64
		brandScore = float64(brandResult)
		aiReason   string
		wikiDesc   string
		tags       []string
	)

	if wikiResult != nil && wikiResult.Exists {
		wikiScore = wikiResult.Score
		wikiDesc = wikiResult.Description
	}

	if geminiResult != nil {
		aiScore = float64(geminiResult.Score)
		aiReason = geminiResult.Reason
		tags = geminiResult.Tags
	}

	// Weighted combination
	totalScore := (wordFreqScore * 0.15) +
		(wikiScore * 0.15) +
		(aiScore * 0.50) +
		(brandScore * 0.20)

	// ----------------------------------------------------
	// Pronounceability Penalty (N-Gram / Vowel check)
	// ----------------------------------------------------
	hasVowel := false
	lower := strings.ToLower(username)
	for _, ch := range lower {
		if ch == 'a' || ch == 'e' || ch == 'i' || ch == 'o' || ch == 'u' || ch == 'y' {
			hasVowel = true
			break
		}
	}
	// If it's a completely garbage string of consonants (and not a dictionary word)
	if !hasVowel && wordFreqScore == 0 {
		totalScore = totalScore * 0.5 // Massive 50% penalty for unpronounceable gibberish
	}

	// Clamp to 0-100
	totalScore = math.Max(0, math.Min(100, totalScore))

	// 4. Convert score to price multiplier
	multiplier := e.scoreToMultiplier(totalScore, len(username))

	result := &SemanticResult{
		TotalScore:      math.Round(totalScore*100) / 100,
		Multiplier:      math.Round(multiplier*100) / 100,
		WordFreqScore:   math.Round(wordFreqScore*100) / 100,
		WikiScore:       wikiScore,
		AIScore:         aiScore,
		BrandScore:      brandResult,
		Tags:            tags,
		AIReason:        aiReason,
		WikiDescription: wikiDesc,
	}

	slog.Info("SemanticEngine scored username",
		"username", username,
		"total_score", result.TotalScore,
		"multiplier", result.Multiplier,
		"word_freq", result.WordFreqScore,
		"wiki", result.WikiScore,
		"ai", result.AIScore,
		"brand", result.BrandScore,
		"tags", fmt.Sprintf("%v", tags),
	)

	// 5. Cache
	e.mu.Lock()
	e.cache[username] = result
	e.times[username] = time.Now()
	e.mu.Unlock()

	return result
}

// scoreToMultiplier converts the 0-100 score into a price multiplier.
// Incorporates the Length Multiplier feature.
func (e *SemanticEngine) scoreToMultiplier(score float64, length int) float64 {
	if score <= 10.0 {
		return 1.0
	}

	// Exponential curve: mult = 1 + (score/100)^5.0 * 99
	// This keeps garbage names at 1x, while capping the most legendary names at 100x.
	normalized := score / 100.0
	multiplier := 1.0 + math.Pow(normalized, 5.0)*99.0

	// Length Multiplier
	// Shorter names are exponentially more valuable
	if length == 4 {
		multiplier *= 2.0 // 4-letter boost
	} else if length == 5 {
		multiplier *= 1.5 // 5-letter boost
	} else if length >= 10 {
		multiplier *= 0.8 // Long name penalty
	}

	// Cap at maximum 100x after length adjustments
	return math.Min(multiplier, 100.0)
}
