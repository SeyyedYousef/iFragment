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
			// Priority 1.5: Try splitting compound words (e.g. cryptoking -> crypto + king)
			w1, w2, isCompound := splitCompoundWordTwo(username)
			if isCompound {
				r1 := RankWord(w1)
				r2 := RankWord(w2)
				if r1 > 0 && r2 > 0 {
					rank = (r1 + r2) / 2
				}
			} else {
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
	cryptoWeb3 := []string{
		"wallet", "crypto", "bitcoin", "ton", "toncoin", "blockchain", "defi", "nft",
		"dex", "swap", "coin", "token", "web3", "pay", "bank", "trade", "market",
		"money", "whale", "binance", "bybit", "okx", "coinbase", "kraken", "kucoin",
		"bitget", "tether", "usdt", "solana", "cardano", "ripple", "xrp", "doge",
		"shiba", "tron", "polkadot", "chainlink", "uniswap", "pancakeswap",
	}
	for _, c := range cryptoWeb3 {
		if cleanName == c {
			tags = append(tags, "crypto_ultra_premium")
			break
		}
	}

	// Exclusivity & Rarity Status Ultra Premium
	statusExclusivity := []string{
		"rare", "apex", "prime", "legend", "vault", "epic", "supreme", "noble",
		"hero", "master", "royal", "lord", "gem", "status", "myth", "god", "aura", "crown", "boss", "king", "rich",
	}
	for _, s := range statusExclusivity {
		if cleanName == s {
			tags = append(tags, "exclusivity_status_premium")
			break
		}
	}

	// Telegram Ecosystem & MiniApp Lexicon
	telegramEcosystem := []string{
		"durov", "notcoin", "dogs", "catizen", "major", "paws", "hamster", "ton", "tether", "stars",
		"memecoin", "channel", "group", "bot", "gift", "trade", "wallet",
	}
	for _, te := range telegramEcosystem {
		if cleanName == te {
			tags = append(tags, "telegram_ecosystem")
			break
		}
	}

	// Compound Word Check (e.g., cryptoking, fastpay)
	if !isDictionaryWord(cleanName) && RankWord(cleanName) == 0 {
		_, _, isCompound := splitCompoundWordTwo(cleanName)
		if isCompound {
			tags = append(tags, "compound_word")
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
	brandBonus := (float64(brandScore) / 100.0) * 15.0
	
	var totalScore float64
	if wikiResult != nil && wikiResult.FetchError {
		// Wikipedia API failed due to network error. Re-allocate weight to Datamuse and AI.
		baseScore := (wordFreqScore * 0.45) + (aiScore * 0.55)
		totalScore = baseScore + brandBonus
		slog.Warn("Wikipedia API failed, re-weighted semantic signals", "username", username)
	} else {
		baseScore := (wordFreqScore * 0.25) + (wikiScore * 0.30) + (aiScore * 0.30)
		totalScore = baseScore + brandBonus
	}

	// Dynamic floor safeguards for common dictionary words
	if wordFreqScore >= 70 && totalScore < 65 {
		totalScore = 65
	} else if wordFreqScore >= 50 && totalScore < 55 {
		totalScore = 55
	} else if wordFreqScore >= 30 && totalScore < 45 {
		totalScore = 45
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
	isDict := isDictionaryWord(username) || isDictionaryWord(strings.ToLower(username)) || wordFreqScore > 20
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

	// 5. Cache with bounds safety
	e.mu.Lock()
	if len(e.cache) >= 5000 {
		e.cache = make(map[string]*SemanticResult)
		e.times = make(map[string]time.Time)
	}
	e.cache[username] = result
	e.times[username] = time.Now()
	e.mu.Unlock()

	return result
}

// scoreToMultiplier converts the 0-100 score into a calibrated price multiplier.
func (e *SemanticEngine) scoreToMultiplier(score float64, length int, tags []string, isDict bool) float64 {
	var multiplier float64

	// Calibrated max multipliers per character length (Ultra-top words 1M+ TON, Mid-tier 100k+ TON)
	maxBaseMultiplier := 80.0
	if length == 4 {
		maxBaseMultiplier = 450.0 // Score 40 -> 1x, Score 70 -> ~45x (~112k TON), Score 90 -> ~280x (~700k TON), Score 100 -> 450x (1.125M TON)
	} else if length == 5 {
		maxBaseMultiplier = 200.0 // Score 40 -> 1x, Score 75 -> ~50x (~50k TON), Score 100 -> 200x (200k TON)
	} else if length <= 3 {
		maxBaseMultiplier = 600.0
	}

	// Penalty zone: scale from 0.05x to 1.0x
	if score < 40.0 {
		normalized := score / 40.0
		multiplier = 0.05 + math.Pow(normalized, 2.5)*0.95
		// Dictionary words should never be penalized below 1.0x
		if isDict && multiplier < 1.0 {
			multiplier = 1.0
		}
	} else {
		// Premium zone: smooth power curve (exponent 3.0)
		normalized := (score - 40.0) / 60.0
		multiplier = 1.0 + math.Pow(normalized, 3.0)*(maxBaseMultiplier-1.0)
	}

	// Tag-Based Pricing (bounded adjustments)
	tagMultiplier := 1.0
	for _, t := range tags {
		tag := strings.ToLower(t)
		if tag == "crypto_ultra_premium" {
			tagMultiplier *= 1.50
		} else if tag == "exclusivity_status_premium" {
			tagMultiplier *= 1.20
		} else if tag == "telegram_ecosystem" {
			tagMultiplier *= 1.80
		} else if tag == "compound_word" {
			tagMultiplier *= 0.35 // Compound words get discount relative to pure single words
		} else if tag == "wiki_popular" {
			tagMultiplier *= 1.15
		} else if tag == "brand_verified" {
			tagMultiplier *= 1.20
		} else if tag == "internet_slang" {
			tagMultiplier *= 1.20
		} else if tag == "color_premium" {
			tagMultiplier *= 1.15
		} else if tag == "geo_premium" {
			tagMultiplier *= 1.20
		}
	}
	
	// Hard cap on Tag-Based Multiplier stacking
	if tagMultiplier > 2.5 {
		tagMultiplier = 2.5
	}
	multiplier *= tagMultiplier

	// Cultural Significance / Mega-Entity Boost
	if score >= 80.0 && length >= 6 {
		multiplier *= 1.2
	}

	// Cap maximum single multiplier
	return math.Min(multiplier, 250.0)
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

// splitCompoundWordTwo attempts to split a lowercase unsegmented compound string into 2 dictionary words.
// Example: "cryptoking" -> ("crypto", "king", true)
func splitCompoundWordTwo(s string) (string, string, bool) {
	lower := strings.ToLower(s)
	if len(lower) < 6 {
		return "", "", false
	}
	for i := 3; i <= len(lower)-3; i++ {
		w1 := lower[:i]
		w2 := lower[i:]
		if (isDictionaryWord(w1) || RankWord(w1) > 0) && (isDictionaryWord(w2) || RankWord(w2) > 0) {
			return w1, w2, true
		}
	}
	return "", "", false
}
