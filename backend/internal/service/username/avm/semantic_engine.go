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
		
		if rank == 0 {
			// Try CamelCase split for compound words (e.g., CryptoKing)
			parts := splitCamelCase(username)
			if len(parts) > 1 {
				totalRank := 0
				allExist := true
				for _, p := range parts {
					r := RankWord(p)
					if r == 0 {
						allExist = false
						break
					}
					totalRank += r
				}
				if allExist {
					rank = totalRank / len(parts)
				}
			}
		}

		if rank > 0 {
			// Piecewise scaling for word frequency score:
			// Rank 1-1000 -> 90 - 100
			// Rank 1000-5000 -> 70 - 90
			// Rank 5000-10000 -> 50 - 70
			if rank <= 1000 {
				wordFreqScore = 100.0 - (float64(rank)/1000.0)*10.0
			} else if rank <= 5000 {
				wordFreqScore = 90.0 - (float64(rank-1000)/4000.0)*20.0
			} else {
				wordFreqScore = 70.0 - (float64(rank-5000)/5000.0)*30.0
			}
			wordFreqScore = math.Max(10, math.Min(100, wordFreqScore))
		} else {
			// Priority 2: Datamuse API (catches words not in top 10K)
			freq := GetWordFrequency(username)
			if freq > 0 {
				wordFreqScore = math.Min(50, math.Log10(freq+1)*15) // Cap at 50 for non-local words
			} else {
				// Try CamelCase on Datamuse
				parts := splitCamelCase(username)
				if len(parts) > 1 {
					totalFreq := 0.0
					allExist := true
					for _, p := range parts {
						f := GetWordFrequency(p)
						if f <= 0 {
							allExist = false
							break
						}
						totalFreq += f
					}
					if allExist {
						avgFreq := totalFreq / float64(len(parts))
						wordFreqScore = math.Min(50, math.Log10(avgFreq+1)*15)
					}
				}
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
	
	if wikiScore > 60.0 {
		tags = append(tags, "wiki_popular")
	}
	
	if brandScore > 0.0 {
		tags = append(tags, "brand_verified")
	}
	
	lowerName := strings.ToLower(username)
	cleanName := strings.ReplaceAll(lowerName, "_", "")
	
	// Slang premium
	slangs := []string{"hodl", "wagmi", "ngmi", "fomo", "yolo", "based", "shill", "degen", "rekt"}
	for _, s := range slangs {
		if cleanName == s {
			tags = append(tags, "internet_slang")
			break
		}
	}
	
	// Color premium
	colors := []string{"blue", "pink", "gold", "black", "white", "green", "red", "silver", "scarlet"}
	for _, c := range colors {
		if cleanName == c {
			tags = append(tags, "color_premium")
			break
		}
	}
	
	// Geo premium
	geos := []string{"dubai", "tokyo", "paris", "london", "iran", "istanbul", "newyork", "china", "japan"}
	for _, g := range geos {
		if cleanName == g {
			tags = append(tags, "geo_premium")
			break
		}
	}
	
	// Emoji equivalent
	emojis := []string{"fire", "rocket", "diamond", "whale", "crown", "star", "heart", "moon"}
	for _, e := range emojis {
		if cleanName == e {
			tags = append(tags, "emoji_word")
			break
		}
	}

	// Crypto / Web3 Ultra Premium
	cryptoWeb3 := []string{"wallet", "crypto", "bitcoin", "ton", "toncoin", "blockchain", "defi", "nft", "dex", "swap", "coin", "token", "web3", "pay", "bank", "trade", "market", "money", "whale"}
	for _, c := range cryptoWeb3 {
		if cleanName == c {
			tags = append(tags, "crypto_ultra_premium")
			break
		}
	}

	// General Ultra Premium
	generalUltra := []string{"ai", "chat", "news", "music", "video", "shop", "store", "buy", "sell", "cloud", "data", "tech", "art", "auto", "car", "travel", "hotel", "food", "pizza", "burger", "gold", "silver", "app", "bot"}
	for _, g := range generalUltra {
		if cleanName == g {
			tags = append(tags, "general_ultra_premium")
			break
		}
	}

	// Weighted combination (25% frequency, 30% wiki, 30% AI; treat brand as 15% bonus)
	baseScore := (wordFreqScore * 0.25) +
		(wikiScore * 0.30) +
		(aiScore * 0.30)

	brandBonus := (float64(brandScore) / 100.0) * 15.0
	totalScore := baseScore + brandBonus

	// Boost total score directly for ultra-premium keywords to escape the penalty zone
	for _, t := range tags {
		if t == "crypto_ultra_premium" {
			totalScore += 40.0 // Massive boost to push into high multiplier curve
		}
		if t == "general_ultra_premium" {
			totalScore += 30.0
		}
	}

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
	isDict := isDictionaryWord(username) || isDictionaryWord(strings.ToLower(username))
	multiplier := e.scoreToMultiplier(totalScore, len(username), tags, isDict)

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
func (e *SemanticEngine) scoreToMultiplier(score float64, length int, tags []string, isDict bool) float64 {
	var multiplier float64

	// Penalty zone: scale from 0.1x to 1.0x
	if score < 45.0 {
		normalized := score / 45.0
		multiplier = 0.1 + math.Pow(normalized, 3.0)*0.9
		// Dictionary words should never be penalized below 1.0x
		if isDict && multiplier < 1.0 {
			multiplier = 1.0
		}
	} else {
		// Premium zone: scale from 1.0x (at score 45) to 200.0x (at score 100)
		normalized := (score - 45.0) / 55.0
		multiplier = 1.0 + math.Pow(normalized, 2.0)*199.0
	}

	// Tag-Based Pricing
	tagMultiplier := 1.0
	for _, t := range tags {
		tag := strings.ToLower(t)
		if strings.Contains(tag, "crypto") || strings.Contains(tag, "web3") || strings.Contains(tag, "blockchain") {
			tagMultiplier *= 1.8
		} else if tag == "brand" || strings.HasPrefix(tag, "brand:") || strings.Contains(tag, "company") || strings.Contains(tag, "startup") {
			tagMultiplier *= 1.6
		} else if strings.Contains(tag, "country") || strings.Contains(tag, "location") || strings.Contains(tag, "city") {
			tagMultiplier *= 1.5
		} else if strings.Contains(tag, "gaming") || strings.Contains(tag, "game") || strings.Contains(tag, "esports") {
			tagMultiplier *= 1.3
		}
		
		if tag == "wiki_popular" {
			tagMultiplier *= 1.5
		}
		if tag == "brand_verified" {
			tagMultiplier *= 2.0
		}
		if tag == "internet_slang" {
			tagMultiplier *= 1.50
		}
		if tag == "color_premium" {
			tagMultiplier *= 1.25
		}
		if tag == "geo_premium" {
			tagMultiplier *= 1.40
		}
		if tag == "emoji_word" {
			tagMultiplier *= 1.20
		}
		if tag == "crypto_ultra_premium" {
			tagMultiplier *= 4.00
		}
		if tag == "general_ultra_premium" {
			tagMultiplier *= 3.00
		}
	}
	
	// Hard cap on Tag-Based Multiplier stacking
	if tagMultiplier > 10.0 {
		tagMultiplier = 10.0
	}
	multiplier *= tagMultiplier

	// Cultural Significance / Mega-Entity Boost
	// If a word is long but STILL scores legendary (70+), it means it's a massive global 
	// entity (like a country, megabrand). We boost it so its price can rival short words.
	if score >= 70.0 && length >= 6 {
		multiplier *= 1.5
	}

	// Cap at maximum 200x after tag adjustments
	return math.Min(multiplier, 200.0)
}

// splitCamelCase splits a string into words based on CamelCase.
// Example: "CryptoKing" -> ["Crypto", "King"]
func splitCamelCase(s string) []string {
	var words []string
	var current []rune

	for i, r := range s {
		if i > 0 && r >= 'A' && r <= 'Z' {
			words = append(words, string(current))
			current = []rune{r}
		} else {
			current = append(current, r)
		}
	}
	if len(current) > 0 {
		words = append(words, string(current))
	}
	return words
}
