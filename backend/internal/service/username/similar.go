package username

import (
	"context"
	"fmt"
	"ifragment-backend/internal/client/fragment"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username/avm"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
)

var levenshteinPool = sync.Pool{
	New: func() any {
		s := make([]int, 64)
		return &s
	},
}

type SimilarUsername struct {
	Username     string  `json:"username"`
	Score        float64 `json:"score"`
	Reason       string  `json:"reason"`
	RarityScore  int     `json:"rarity_score"`
	FragmentURL  string  `json:"fragment_url"`
	OwnerAddress string  `json:"owner_address,omitempty"`
	Status       string  `json:"status,omitempty"`          // "sold", "available", "on_sale", "on_auction", "non_nft"
	SalePrice    float64 `json:"sale_price,omitempty"`      // Last sale price in TON
	SalePriceUSD float64 `json:"sale_price_usd,omitempty"` // Last sale price in USD
	SaleDate     string  `json:"sale_date,omitempty"`       // Date of last sale
}

func (s *AnalysisService) FindSimilarUsernames(ctx context.Context, username string, limit int) ([]SimilarUsername, error) {
	if !ValidateUsername(username) {
		return nil, nil
	}
	if limit <= 0 || limit > 25 {
		limit = 10
	}

	base := strings.ToLower(username)
	pool := getCandidatePool(ctx, s.db, base)
	results := make([]SimilarUsername, 0, limit)
	seen := map[string]bool{base: true}

	for _, candidate := range pool {
		select {
		case <-ctx.Done():
			return results, ctx.Err()
		default:
		}

		candidate = strings.ToLower(strings.TrimSpace(candidate))
		if seen[candidate] || !ValidateUsername(candidate) {
			continue
		}
		seen[candidate] = true

		score, reason := similarityScore(base, candidate)
		// Bypass similarity threshold if it's an AI suggestion
		isAI := false
		maxIdx := 5
		if len(pool) < maxIdx {
			maxIdx = len(pool)
		}
		for _, aiSug := range pool[:maxIdx] {
			if aiSug == candidate {
				isAI = true
				break
			}
		}
		
		if !isAI && score < 0.35 {
			continue
		}
		
		// Boost score artificially for AI suggestions to ensure they appear at the top
		if isAI {
			score = 0.95
			reason = "Semantic AI Alternative"
		}
		
		results = append(results, SimilarUsername{
			Username:    candidate,
			Score:       roundFeature(score),
			Reason:      reason,
			RarityScore: s.CalculateRarity(candidate),
			FragmentURL: "https://fragment.com/username/" + candidate,
		})
	}

	sort.Slice(results, func(i, j int) bool {
		if results[i].Score == results[j].Score {
			return results[i].RarityScore > results[j].RarityScore
		}
		return results[i].Score > results[j].Score
	})
	if len(results) > limit {
		results = results[:limit]
	}

	tonRate, _ := s.GetTONRate(ctx)
	if tonRate <= 0 {
		tonRate = 7.25
	}

	fragClient := fragment.NewClient()
	var wg sync.WaitGroup
	sem := make(chan struct{}, 5) // limit concurrency
	for i := range results {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int) {
			defer wg.Done()
			defer func() { <-sem }()
			uName := results[idx].Username
			lowerName := strings.ToLower(uName)

			// 1. Check AVM HistoricalSales map first for exact sold prices
			if histPrice, exists := avm.HistoricalSales[lowerName]; exists && histPrice > 0 {
				results[idx].Status = "sold"
				results[idx].SalePrice = histPrice
			}

			// 2. Check local Postgres database
			if s.db != nil {
				if sales, dbErr := s.db.GetSalesByUsername(ctx, uName); dbErr == nil && len(sales) > 0 {
					latest := sales[0]
					results[idx].Status = "sold"
					fPrice, _ := latest.SalePriceTON.Float64()
					if fPrice > 0 {
						results[idx].SalePrice = fPrice
					}
					if !latest.SaleDate.IsZero() {
						results[idx].SaleDate = latest.SaleDate.Format(time.RFC3339)
					}
					if latest.BuyerAddress != nil && *latest.BuyerAddress != "" {
						results[idx].OwnerAddress = *latest.BuyerAddress
					}
				}
			}

			// 3. Fetch live NFT info via GetNFTByDNS (if TON client is available)
			if s.tonClient != nil {
				nft, err := s.tonClient.GetNFTByDNS(ctx, uName)
				if err == nil && nft != nil {
					if nft.Owner.Address != "" {
						results[idx].OwnerAddress = nft.Owner.Address
					}
					if nft.Sale != nil && nft.Sale.Price.Value != "" {
						results[idx].Status = "on_sale"
						var val float64
						if _, sErr := fmt.Sscanf(nft.Sale.Price.Value, "%f", &val); sErr == nil {
							tokenName := strings.ToLower(nft.Sale.Price.TokenName)
							if tokenName == "ton" || tokenName == "nanoton" || tokenName == "" {
								val = val / 1e9
							}
							results[idx].SalePrice = val
						}
					} else if results[idx].Status == "" {
						results[idx].Status = "sold"
					}
				}
			}

			// 4. Fragment Web Scraper check if status is still unknown or missing sale price
			if results[idx].Status == "" || results[idx].Status == "available" || (results[idx].Status == "sold" && results[idx].SalePrice == 0) {
				fStatus, fErr := fragClient.CheckUsername(ctx, uName)
				if fErr == nil {
					switch fStatus {
					case fragment.StatusSale:
						results[idx].Status = "on_sale"
					case fragment.StatusAuction:
						results[idx].Status = "on_auction"
					case fragment.StatusSold:
						results[idx].Status = "sold"
					case fragment.StatusAvailable:
						results[idx].Status = "available"
					}
				}

				if (results[idx].Status == "sold" || results[idx].Status == "on_sale") && results[idx].SalePrice == 0 {
					scrapedSales, sErr := fragClient.GetHistoricalSales(ctx, uName)
					if sErr == nil && len(scrapedSales) > 0 {
						results[idx].SalePrice = scrapedSales[0].PriceTON
						if !scrapedSales[0].SaleDate.IsZero() {
							results[idx].SaleDate = scrapedSales[0].SaleDate.Format(time.RFC3339)
						}
						// Cache scraped sale into local DB
						if s.db != nil {
							_, _ = s.db.InsertSale(ctx, repository.Sale{
								Username:     uName,
								SalePriceTON: decimal.NewFromFloat(scrapedSales[0].PriceTON),
								SaleType:     "auction",
								SaleDate:     scrapedSales[0].SaleDate,
								Source:       "fragment_scrape",
							})
						}
					}
				}
			}

			// 5. Fallback heuristics if status is still missing
			if results[idx].Status == "" {
				if len(lowerName) <= 5 || isDictionaryWord(lowerName) {
					results[idx].Status = "sold"
				} else {
					results[idx].Status = "available"
				}
			}

			// 6. Calculate USD sale price
			if results[idx].SalePrice > 0 {
				results[idx].SalePriceUSD = math.Round(results[idx].SalePrice*tonRate*100) / 100
			}
		}(i)
	}
	wg.Wait()

	return results, nil
}

func getCandidatePool(ctx context.Context, db *repository.Database, username string) []string {
	// First, fetch AI suggestions
	suggestions := avm.GetAISuggestions(ctx, db, username)
	
	// Fallback to static pool if AI fails or returns empty
	candidates := []string{
		"meta", "crypto", "bitcoin", "ton", "news",
		"bank", "wallet", "money", "auto", "cars",
		"apple", "tesla", "google", "ai", "tech",
		"game", "bet", "shop", "pay", "coin",
	}

	if len(suggestions) > 0 {
		// Use AI suggestions, but also append some static ones to ensure variety
		candidates = append(suggestions, candidates...)
	}

	highValueSuffixes := []string{"app", "bot", "pro", "x", "ai", "tech", "pay", "coin", "news"}
	highValuePrefixes := []string{"the", "my", "get", "go", "crypto", "meta", "ton"}

	appendSafe := func(base, ext string) string {
		if len(base)+len(ext) <= 32 {
			return base + ext
		}
		return base[:32-len(ext)] + ext
	}

	for _, suffix := range highValueSuffixes {
		candidates = append(candidates, appendSafe(username, suffix))
	}
	for _, prefix := range highValuePrefixes {
		cand := prefix + username
		if len(cand) > 32 {
			cand = prefix + username[:32-len(prefix)]
		}
		candidates = append(candidates, cand)
	}

	if len(username) > 4 {
		candidates = append(candidates, username[:len(username)-1])
	}
	if len(username) >= 4 {
		trunc := username[:len(username)-1]
		candidates = append(candidates, appendSafe(trunc, "x"), appendSafe(trunc, "pro"))
	}
	if len(username) >= 4 {
		candidates = append(candidates, appendSafe(username, "s"), appendSafe(username, "hq"), appendSafe(username, "vip"))
	}
	return candidates
}

func similarityScore(base, candidate string) (float64, string) {
	baseRunes := []rune(base)
	candidateRunes := []rune(candidate)
	maxLen := math.Max(float64(len(baseRunes)), float64(len(candidateRunes)))
	if maxLen == 0 {
		return 0, "empty"
	}

	distanceScore := 1 - float64(levenshtein(baseRunes, candidateRunes))/maxLen
	prefixScore := commonPrefixScore(baseRunes, candidateRunes)
	keywordScore := 0.0
	reason := "shape_match"

	switch {
	case isHighValueMarketKeyword(base) && isHighValueMarketKeyword(candidate):
		keywordScore = 0.35
		reason = "same_market_category"
	case isBrandLikeKeyword(base) && isBrandLikeKeyword(candidate):
		keywordScore = 0.30
		reason = "brand_keyword"
	case strings.HasSuffix(candidate, "ai") || strings.HasSuffix(candidate, "bot") || strings.HasSuffix(candidate, "pro"):
		keywordScore = 0.25
		reason = "premium_suffix"
	case strings.Contains(candidate, base) || strings.Contains(base, candidate):
		keywordScore = 0.2
		reason = "contains_root"
	}

	lengthPenalty := math.Abs(float64(len(baseRunes)-len(candidateRunes))) * 0.03
	score := distanceScore*0.58 + prefixScore*0.22 + keywordScore - lengthPenalty
	if score < 0 {
		score = 0
	}
	if score > 1 {
		score = 1
	}
	return score, reason
}

func commonPrefixScore(a, b []rune) float64 {
	limit := len(a)
	if len(b) < limit {
		limit = len(b)
	}
	if limit == 0 {
		return 0
	}
	var matches int
	for i := 0; i < limit; i++ {
		if a[i] != b[i] {
			break
		}
		matches++
	}
	maxLen := len(a)
	if len(b) > maxLen {
		maxLen = len(b)
	}
	return float64(matches) / float64(maxLen)
}

func levenshtein(a, b []rune) int {
	if len(a) == 0 {
		return len(b)
	}
	if len(b) == 0 {
		return len(a)
	}

	needed := len(b) + 1

	var prev, curr []int
	var pPtr, cPtr *[]int

	if needed <= 64 {
		pPtr = levenshteinPool.Get().(*[]int)
		cPtr = levenshteinPool.Get().(*[]int)
		prev = (*pPtr)[:needed]
		curr = (*cPtr)[:needed]
		defer func() {
			levenshteinPool.Put(pPtr)
			levenshteinPool.Put(cPtr)
		}()
	} else {
		prev = make([]int, needed)
		curr = make([]int, needed)
	}

	for j := range prev {
		prev[j] = j
	}

	for i := 1; i <= len(a); i++ {
		curr[0] = i
		for j := 1; j <= len(b); j++ {
			cost := 0
			if a[i-1] != b[j-1] {
				cost = 1
			}
			curr[j] = minThree(curr[j-1]+1, prev[j]+1, prev[j-1]+cost)
		}
		prev, curr = curr, prev
	}
	return prev[len(b)]
}

func minThree(a, b, c int) int {
	if a < b {
		if a < c {
			return a
		}
		return c
	}
	if b < c {
		return b
	}
	return c
}

func roundFeature(v float64) float64 {
	return math.Round(v*1000) / 1000
}
