package username

import (
	"context"
	"math"
	"sort"
	"strings"
)

type SimilarUsername struct {
	Username    string  `json:"username"`
	Score       float64 `json:"score"`
	Reason      string  `json:"reason"`
	RarityScore int     `json:"rarity_score"`
	FragmentURL string  `json:"fragment_url"`
}

func (s *ReportService) FindSimilarUsernames(ctx context.Context, username string, limit int) ([]SimilarUsername, error) {
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
	return results, nil
}

func similarCandidatePool(username string) []string {
	candidates := []string{
		"news", "dailynews", "thenews", "worldnews", "newshub",
		"auto", "autos", "cars", "carhub", "autohub",
		"crypto", "bitcoin", "ton", "wallet", "money", "bank",
		"apple", "tesla", "nike", "meta", "google", "amazon",
	}

	suffixes := []string{"app", "bot", "hub", "hq", "io", "pro", "ton", "vip", "x"}
	prefixes := []string{"get", "go", "my", "the", "try"}
	for _, suffix := range suffixes {
		candidates = append(candidates, username+suffix)
	}
	for _, prefix := range prefixes {
		candidates = append(candidates, prefix+username)
	}
	if len(username) > 4 {
		candidates = append(candidates, username[:len(username)-1], username[:len(username)-1]+"x")
	}
	if len(username) >= 4 {
		candidates = append(candidates, username+"s", username+"1")
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
		keywordScore = 0.28
		reason = "same_market_category"
	case isBrandLikeKeyword(base) && isBrandLikeKeyword(candidate):
		keywordScore = 0.24
		reason = "brand_keyword"
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
	return float64(matches) / float64(limit)
}

func levenshtein(a, b []rune) int {
	if len(a) == 0 {
		return len(b)
	}
	if len(b) == 0 {
		return len(a)
	}

	prev := make([]int, len(b)+1)
	curr := make([]int, len(b)+1)
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
			curr[j] = minInt(curr[j-1]+1, prev[j]+1, prev[j-1]+cost)
		}
		prev, curr = curr, prev
	}
	return prev[len(b)]
}

func minInt(values ...int) int {
	min := values[0]
	for _, value := range values[1:] {
		if value < min {
			min = value
		}
	}
	return min
}
