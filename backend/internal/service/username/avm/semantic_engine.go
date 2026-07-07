package avm

import (
	"context"
	"log/slog"
	"math"
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
	TotalScore      float64 `json:"total_score"`       // 0-100 combined score
	Multiplier      float64 `json:"multiplier"`        // Price multiplier (1x - 200x)
	WordFreqScore   float64 `json:"word_freq_score"`   // 0-100 from Datamuse
	WikiScore       float64 `json:"wiki_score"`        // 0-100 from Wikipedia
	AIScore         float64 `json:"ai_score"`          // 0-100 from Gemini
	BrandScore      float64 `json:"brand_score"`       // 0 or 100 from Clearbit
	AIReason        string  `json:"ai_reason"`         // One-line AI explanation
	WikiDescription string  `json:"wiki_description"`  // Wikipedia article description
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
		brandScore float64
		aiReason   string
		wikiDesc   string
	)

	if wikiResult != nil && wikiResult.Exists {
		wikiScore = wikiResult.Score
		wikiDesc = wikiResult.Description
	}

	if geminiResult != nil {
		aiScore = float64(geminiResult.Score)
		aiReason = geminiResult.Reason
	}

	brandScore = float64(brandResult) // 0, 50, or 100

	// Weighted combination:
	// AI gets the most weight because it understands context best
	totalScore := (wordFreqScore * 0.20) +
		(wikiScore * 0.20) +
		(aiScore * 0.40) +
		(brandScore * 0.20)

	// Clamp to 0-100
	totalScore = math.Max(0, math.Min(100, totalScore))

	// 4. Convert score to price multiplier
	multiplier := scoreToMultiplier(totalScore)

	result := &SemanticResult{
		TotalScore:      math.Round(totalScore*100) / 100,
		Multiplier:      math.Round(multiplier*100) / 100,
		WordFreqScore:   math.Round(wordFreqScore*100) / 100,
		WikiScore:       wikiScore,
		AIScore:         aiScore,
		BrandScore:      brandScore,
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
	)

	// 5. Cache
	e.mu.Lock()
	e.cache[username] = result
	e.times[username] = time.Now()
	e.mu.Unlock()

	return result
}

// scoreToMultiplier converts a 0-100 semantic score to a price multiplier.
//
// The curve is exponential to reward truly premium usernames:
//   - Score 0-20:   ×1.0 - ×1.5  (worthless / gibberish)
//   - Score 21-40:  ×1.5 - ×5    (low-value real words)
//   - Score 41-60:  ×5   - ×25   (moderate value, common words)
//   - Score 61-80:  ×25  - ×120  (high value, popular concepts)
//   - Score 81-100: ×120 - ×500  (legendary: news, sport, bitcoin)
func scoreToMultiplier(score float64) float64 {
	if score <= 0 {
		return 1.0
	}

	// Exponential curve: mult = 1 + (score/100)^5.0 * 499
	// This gives a steep S-curve heavily punishing low/medium scores but rewarding top scores
	normalized := score / 100.0
	multiplier := 1.0 + math.Pow(normalized, 5.0)*499.0

	return math.Min(multiplier, 500.0)
}
