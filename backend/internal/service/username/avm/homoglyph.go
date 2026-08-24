package avm

import (
	"fmt"
	"strings"
	"sync"
)

// HomoglyphTwinDto represents a visual confusable twin handle and its phishing/spoofing profile.
type HomoglyphTwinDto struct {
	Twin       string   `json:"twin"`
	Status     string   `json:"status"`               // "taken" | "for_sale" | "available" | "unknown"
	PriceTON   *float64 `json:"price_ton,omitempty"`  // Listed/sale price if on auction or sold
	RiskLevel  string   `json:"risk_level"`          // "critical" | "high" | "moderate"
	Similarity string   `json:"similarity,omitempty"` // Explanation of substitution pattern
}

var confusableMap = map[rune][]struct {
	Replacement rune
	Desc        string
}{
	'o': {
		{'0', "digit '0' (looks like 'o')"},
		{'о', "Cyrillic 'о'"},
	},
	'0': {
		{'o', "letter 'o' (looks like '0')"},
	},
	'l': {
		{'1', "digit '1' (looks like 'l')"},
		{'i', "letter 'i'"},
		{'і', "Cyrillic 'і'"},
	},
	'i': {
		{'1', "digit '1' (looks like 'i')"},
		{'l', "lowercase 'l'"},
		{'і', "Cyrillic 'і'"},
	},
	'1': {
		{'l', "letter 'l' (looks like '1')"},
		{'i', "letter 'i' (looks like '1')"},
	},
	'e': {
		{'3', "digit '3' (leet for 'e')"},
		{'е', "Cyrillic 'е'"},
	},
	'a': {
		{'4', "digit '4' (leet for 'a')"},
		{'а', "Cyrillic 'а'"},
		{'α', "Greek 'α'"},
	},
	's': {
		{'5', "digit '5' (leet for 's')"},
		{'с', "Cyrillic 'с'"},
	},
	'p': {
		{'р', "Cyrillic 'р'"},
		{'ρ', "Greek 'ρ'"},
	},
	'c': {
		{'с', "Cyrillic 'с'"},
	},
	'x': {
		{'х', "Cyrillic 'х'"},
	},
	'y': {
		{'у', "Cyrillic 'у'"},
	},
}

var (
	twinCache = make(map[string][]HomoglyphTwinDto)
	twinMu    sync.RWMutex
)

// GenerateHomoglyphTwins creates a list of dangerous visual spoofing twins for a given username.
// It enumerates single and multi-character confusable substitutions (e.g. paypa1, g00gle, vv/w).
func GenerateHomoglyphTwins(username string, maxCount int) []HomoglyphTwinDto {
	raw := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(username)), "@")
	if len(raw) < 3 {
		return nil
	}

	if maxCount <= 0 || maxCount > 20 {
		maxCount = 6
	}

	twinMu.RLock()
	cached, found := twinCache[raw]
	twinMu.RUnlock()
	if found {
		return cached
	}

	runes := []rune(raw)
	twins := make([]HomoglyphTwinDto, 0, maxCount)
	seen := map[string]bool{raw: true}

	// 1. Single character substitutions
	for i, ch := range runes {
		if alts, ok := confusableMap[ch]; ok {
			for _, alt := range alts {
				mutated := make([]rune, len(runes))
				copy(mutated, runes)
				mutated[i] = alt.Replacement
				candidate := string(mutated)
				if !seen[candidate] {
					seen[candidate] = true
					twins = append(twins, buildTwinDto(candidate, alt.Desc))
					if len(twins) >= maxCount {
						break
					}
				}
			}
		}
		if len(twins) >= maxCount {
			break
		}
	}

	// 2. Ligature spoofing: 'w' -> 'vv', 'm' -> 'rn'
	if len(twins) < maxCount {
		if strings.Contains(raw, "w") {
			candidate := strings.ReplaceAll(raw, "w", "vv")
			if !seen[candidate] && len(candidate) <= 32 {
				seen[candidate] = true
				twins = append(twins, buildTwinDto(candidate, "ligature 'vv' for 'w'"))
			}
		}
		if strings.Contains(raw, "vv") {
			candidate := strings.ReplaceAll(raw, "vv", "w")
			if !seen[candidate] {
				seen[candidate] = true
				twins = append(twins, buildTwinDto(candidate, "ligature 'w' for 'vv'"))
			}
		}
		if strings.Contains(raw, "m") && len(twins) < maxCount {
			candidate := strings.ReplaceAll(raw, "m", "rn")
			if !seen[candidate] && len(candidate) <= 32 {
				seen[candidate] = true
				twins = append(twins, buildTwinDto(candidate, "ligature 'rn' for 'm'"))
			}
		}
		if strings.Contains(raw, "rn") && len(twins) < maxCount {
			candidate := strings.ReplaceAll(raw, "rn", "m")
			if !seen[candidate] {
				seen[candidate] = true
				twins = append(twins, buildTwinDto(candidate, "ligature 'm' for 'rn'"))
			}
		}
	}

	// 3. Multi-character digit substitution (e.g. google -> g00gle)
	if len(twins) < maxCount && strings.Contains(raw, "o") {
		candidate := strings.ReplaceAll(raw, "o", "0")
		if !seen[candidate] {
			seen[candidate] = true
			twins = append(twins, buildTwinDto(candidate, "all 'o' replaced with '0'"))
		}
	}

	twinMu.Lock()
	if len(twinCache) >= 5000 {
		twinCache = make(map[string][]HomoglyphTwinDto)
	}
	twinCache[raw] = twins
	twinMu.Unlock()

	return twins
}

func buildTwinDto(twinName string, reason string) HomoglyphTwinDto {
	status := "taken" // Default assumption for high-profile lookalikes
	risk := "high"

	// Check if this twin exists in HistoricalSales or ValuationAnchors
	var pricePtr *float64
	clean := strings.ToLower(twinName)
	if p, ok := HistoricalSales[clean]; ok && p > 0 {
		pricePtr = &p
		status = "sold"
		risk = "critical"
	} else if p, ok := ValuationAnchors[clean]; ok && p > 0 {
		pricePtr = &p
		status = "taken"
		risk = "critical"
	}

	// Non-ASCII confusables cannot be minted on Fragment, but represent Telegram client-side spoofing threats
	isASCII := true
	for _, r := range twinName {
		if r > 127 {
			isASCII = false
			break
		}
	}

	if !isASCII {
		status = "non_nft_spoof"
		risk = "critical"
	}

	return HomoglyphTwinDto{
		Twin:       "@" + twinName,
		Status:     status,
		PriceTON:   pricePtr,
		RiskLevel:  risk,
		Similarity: fmt.Sprintf("Visual confusable via %s", reason),
	}
}
