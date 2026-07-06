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
		isBrand       bool
		wg            sync.WaitGroup
	)

	wg.Add(4)

	// Signal 1: Datamuse Word Frequency
	go func() {
		defer wg.Done()
		freq := GetWordFrequency(username)
		if freq > 0 {
			// Normalize to 0-100 scale
			// freq=0.1 -> ~10, freq=10 -> ~50, freq=1000 -> ~90, freq=10000 -> ~100
			wordFreqScore = math.Min(100, math.Log10(freq+1)*25)
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

	// Signal 4: Clearbit Brand Check
	go func() {
		defer wg.Done()
		isBrand = CheckGlobalBrand(username)
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

	if isBrand {
		brandScore = 100
	}

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
//   - Score 41-60:  ×5   - ×20   (moderate value, common words)
//   - Score 61-80:  ×20  - ×80   (high value, popular concepts)
//   - Score 81-100: ×80  - ×200  (legendary: news, sport, bitcoin)
func scoreToMultiplier(score float64) float64 {
	if score <= 0 {
		return 1.0
	}

	// Exponential curve: mult = e^(score * k) where k scales the growth
	// We want: score=20 -> ~1.5, score=50 -> ~10, score=80 -> ~60, score=100 -> ~200
	// Using: mult = 1 + (score/100)^3.5 * 199
	// This gives a smooth S-curve heavily rewarding high scores
	normalized := score / 100.0
	multiplier := 1.0 + math.Pow(normalized, 3.5)*199.0

	return math.Min(multiplier, 200.0)
}
