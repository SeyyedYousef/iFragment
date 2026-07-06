package username

import (
	"context"
	"math"
	"sort"
	"strings"
	"sync"
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
}

func (s *AnalysisService) FindSimilarUsernames(ctx context.Context, username string, limit int) ([]SimilarUsername, error) {
	if !ValidateUsername(username) {
		return nil, nil
	}
	if limit <= 0 || limit > 25 {
		limit = 10
	}

	base := strings.ToLower(username)
	pool := similarCandidatePool(base)
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
		if score < 0.35 {
			continue
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

	if s.tonClient != nil {
		var wg sync.WaitGroup
		sem := make(chan struct{}, 5) // limit to 5 concurrent TON API calls
		for i := range results {
			wg.Add(1)
			sem <- struct{}{}
			go func(idx int) {
				defer wg.Done()
				defer func() { <-sem }()
				nft, err := s.tonClient.GetNFTByDNS(ctx, results[idx].Username)
				if err == nil && nft != nil && nft.Owner.Address != "" {
					results[idx].OwnerAddress = nft.Owner.Address
				}
			}(i)
		}
		wg.Wait()
	}

	return results, nil
}

func similarCandidatePool(username string) []string {
	candidates := []string{
		"meta", "crypto", "bitcoin", "ton", "news",
		"bank", "wallet", "money", "auto", "cars",
		"apple", "tesla", "google", "ai", "tech",
		"game", "bet", "shop", "pay", "coin",
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
