package username

import (
	"context"
	"fmt"
	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username/avm"
	"io"
	"math"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
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
	Status       string  `json:"status,omitempty"`         // "sold", "available", "on_sale", "on_auction", "taken", "non_nft"
	SalePrice    float64 `json:"sale_price,omitempty"`     // Last sale price in TON
	SalePriceUSD float64 `json:"sale_price_usd,omitempty"` // Last sale price in USD
	SaleDate     string  `json:"sale_date,omitempty"`      // Date of last sale
	PriceSource  string  `json:"price_source,omitempty"`   // "archive_anchor", "db_sale", "onchain_listing"
}

func checkTelegramWebStatus(ctx context.Context, username string) string {
	client := &http.Client{Timeout: 3 * time.Second}
	req, err := http.NewRequestWithContext(ctx, "GET", "https://t.me/"+username, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return "available"
	}
	if resp.StatusCode != http.StatusOK {
		return ""
	}

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	if err != nil {
		return ""
	}
	html := string(bodyBytes)

	// Check if page contains active user/channel/bot profile elements
	if strings.Contains(html, "extra_actions") || strings.Contains(html, "tgme_page_title") || strings.Contains(html, "tgme_page_extra") || strings.Contains(html, "View in Telegram") {
		return "taken"
	}
	if strings.Contains(html, "right away") || strings.Contains(html, "you can contact") {
		return "available"
	}

	return ""
}

// ResolveOccupancy reports whether each of the given usernames is currently
// taken, listed for sale, or free to register. It exists so the "concept similar"
// list stops labelling obviously-registered handles (auto, bitcoin, vehicle …) as
// "available" just because no sale record was found for them.
//
// The whole batch shares one deadline; names that cannot be resolved in time are
// simply omitted from the returned map so callers can leave the status unknown
// rather than guess.
func (s *AnalysisService) ResolveOccupancy(ctx context.Context, names []string) map[string]string {
	statuses := make(map[string]string, len(names))
	if len(names) == 0 {
		return statuses
	}

	fastCtx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer cancel()

	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 8)

	for _, raw := range names {
		name := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(raw, "@")))
		if name == "" {
			continue
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(uName string) {
			defer wg.Done()
			defer func() { <-sem }()

			status := ""
			if s.mtprotoClient != nil && fastCtx.Err() == nil {
				if mtStatus, err := s.mtprotoClient.CheckUsername(fastCtx, uName); err == nil {
					switch mtStatus {
					case mtproto.StatusOccupied:
						status = "taken"
					case mtproto.StatusPurchase:
						status = "on_sale"
					case mtproto.StatusAvailable:
						status = "available"
					}
				}
			}
			// Fall back to the public t.me page when MTProto is unavailable or
			// rate limited.
			if status == "" && fastCtx.Err() == nil {
				status = checkTelegramWebStatus(fastCtx, uName)
			}
			if status == "" {
				return
			}

			mu.Lock()
			statuses[uName] = status
			mu.Unlock()
		}(name)
	}
	wg.Wait()

	return statuses
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

	for _, candidate := range pool.names {
		select {
		case <-ctx.Done():
			return results, ctx.Err()
		default:
		}

		score, reason := similarityScore(base, candidate)
		isAI := pool.ai[candidate]

		// AI suggestions are semantic (not spelling-based), so the Levenshtein
		// threshold does not apply to them — but everything else must actually
		// look like the queried username to earn a slot.
		if !isAI && score < 0.35 {
			continue
		}
		if isAI {
			// Keep semantic/AI picks on top while preserving their relative ordering.
			score = math.Max(score, 0.92)
			if reason == "Close spelling match" || reason == "" {
				reason = "Semantic Concept Peer"
			}
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

	// Enforce strict fast timeout of 1.2s for similar username enrichment to ensure ultra-fast response times
	fastCtx, cancelFast := context.WithTimeout(ctx, 1200*time.Millisecond)
	defer cancelFast()

	var wg sync.WaitGroup
	sem := make(chan struct{}, 10) // higher concurrency
	for i := range results {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int) {
			defer wg.Done()
			defer func() { <-sem }()
			uName := results[idx].Username
			lowerName := strings.ToLower(uName)

			// 1. Check AVM HistoricalSales map first for exact sold prices (instant)
			if histPrice, exists := avm.HistoricalSales[lowerName]; exists && histPrice > 0 {
				results[idx].Status = "sold"
				results[idx].SalePrice = histPrice
				results[idx].PriceSource = "archive_anchor"
			}

			// 2. Check local Postgres database (instant)
			if s.db != nil {
				if sales, dbErr := s.db.GetSalesByUsername(fastCtx, uName); dbErr == nil && len(sales) > 0 {
					latest := sales[0]
					results[idx].Status = "sold"
					fPrice, _ := latest.SalePriceTON.Float64()
					if fPrice > 0 {
						results[idx].SalePrice = fPrice
						results[idx].PriceSource = "db_sale"
					}
					if !latest.SaleDate.IsZero() {
						results[idx].SaleDate = latest.SaleDate.Format(time.RFC3339)
					}
					if latest.BuyerAddress != nil && *latest.BuyerAddress != "" {
						results[idx].OwnerAddress = *latest.BuyerAddress
					}
				}
			}

			// If status and price are already known from local DB or memory, short-circuit further network calls!
			if results[idx].Status != "" && results[idx].SalePrice > 0 {
				if results[idx].SalePrice > 0 {
					results[idx].SalePriceUSD = math.Round(results[idx].SalePrice*tonRate*100) / 100
				}
				return
			}

			// 3. Fast MTProto check
			if s.mtprotoClient != nil && fastCtx.Err() == nil {
				mtStatus, mtErr := s.mtprotoClient.CheckUsername(fastCtx, uName)
				if mtErr == nil {
					switch mtStatus {
					case mtproto.StatusOccupied:
						if results[idx].Status == "" {
							results[idx].Status = "taken"
						}
					case mtproto.StatusPurchase:
						if results[idx].Status == "" || results[idx].Status == "available" {
							results[idx].Status = "on_sale"
						}
					case mtproto.StatusAvailable:
						if results[idx].Status == "" {
							results[idx].Status = "available"
						}
					}
				}
			}

			// 4. Fetch live NFT info via GetNFTByDNS (if TON client is available and context alive)
			if s.tonClient != nil && fastCtx.Err() == nil && results[idx].Status == "" {
				nft, err := s.tonClient.GetNFTByDNS(fastCtx, uName)
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
							results[idx].PriceSource = "onchain_listing"
						}
					} else if results[idx].Status == "" {
						// An NFT that exists but carries no active listing is owned,
						// not sold — reporting "sold" with a zero price made the card
						// render it as "unsold / available".
						results[idx].Status = "taken"
					}
				}
			}

			// 5. Explicit status when status is unresolved (no fake length/dictionary guessing)
			if results[idx].Status == "" {
				results[idx].Status = "unknown"
			}


			// 6. Calculate USD sale price if a real SalePrice exists
			if results[idx].SalePrice > 0 {
				results[idx].SalePriceUSD = math.Round(results[idx].SalePrice*tonRate*100) / 100
			}
		}(i)
	}
	wg.Wait()

	return results, nil
}

// candidatePool holds similar-username candidates together with the exact subset
// that came from the semantic LLM suggester. Tracking the AI set explicitly is
// what keeps unrelated filler out of the "AI matched" slots — the previous
// implementation guessed by slice position, so whenever the LLM was unavailable
// the first five entries of a hardcoded market list ("meta", "crypto", "bitcoin",
// "ton", "news") were promoted as AI suggestions for every single username.
type candidatePool struct {
	names []string
	ai    map[string]bool
}

func getCandidatePool(ctx context.Context, db *repository.Database, username string) candidatePool {
	pool := candidatePool{
		names: make([]string, 0, 32),
		ai:    make(map[string]bool, 16),
	}
	seen := map[string]bool{username: true}

	add := func(name string, fromAI bool) {
		name = strings.ToLower(strings.TrimSpace(strings.TrimPrefix(name, "@")))
		if name == "" || seen[name] || !ValidateUsername(name) {
			return
		}
		seen[name] = true
		if fromAI {
			pool.ai[name] = true
		}
		pool.names = append(pool.names, name)
	}

	// 1. Curated Semantic Synonyms & Peers from Thesaurus (Primary high-value source)
	for _, item := range avm.GetSemanticSynonyms(username) {
		add(item.Username, true)
	}

	// 2. Fresh AI suggestions from Gemini / Groq (if available)
	for _, suggestion := range avm.GetAISuggestions(ctx, db, username) {
		add(suggestion, true)
	}

	// 3. Natural linguistic inflection (only strip trailing 's' to find singular roots like 'cars' -> 'car')
	if strings.HasSuffix(username, "s") && len(username) > 4 {
		add(strings.TrimSuffix(username, "s"), false)
	}

	// 4. Shorter root forms ONLY for long words (> 6 chars) and ONLY if pool is still small
	if len(pool.names) < 4 && len(username) > 6 {
		trunc := username[:len(username)-1]
		add(trunc, false)
	}

	return pool
}

func similarityScore(base, candidate string) (float64, string) {
	// 1. Exact semantic synonym or concept benchmark match from Thesaurus
	if isSyn, synReason := avm.IsSemanticSynonym(base, candidate); isSyn {
		return 0.96, synReason
	}

	baseRunes := []rune(base)
	candidateRunes := []rune(candidate)
	maxLen := math.Max(float64(len(baseRunes)), float64(len(candidateRunes)))
	if maxLen == 0 {
		return 0, "empty"
	}

	distanceScore := 1 - float64(levenshtein(baseRunes, candidateRunes))/maxLen
	prefixScore := commonPrefixScore(baseRunes, candidateRunes)
	keywordScore := 0.0
	reason := "Close spelling match"

	switch {
	case isHighValueMarketKeyword(base) && isHighValueMarketKeyword(candidate):
		keywordScore = 0.35
		reason = "Same market category"
	case isBrandLikeKeyword(base) && isBrandLikeKeyword(candidate):
		keywordScore = 0.30
		reason = "Comparable brand keyword"
	case strings.HasPrefix(candidate, base):
		keywordScore = 0.22
		reason = "Same root, extended handle"
	case strings.HasPrefix(base, candidate):
		keywordScore = 0.22
		reason = "Shorter root form"
	case strings.HasSuffix(candidate, base):
		keywordScore = 0.20
		reason = "Same root, prefixed handle"
	case strings.Contains(candidate, base) || strings.Contains(base, candidate):
		keywordScore = 0.2
		reason = "Shares the same root"
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
