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
	},
	'0': {
		{'o', "letter 'o' (looks like '0')"},
	},
	'l': {
		{'1', "digit '1' (looks like 'l')"},
		{'i', "letter 'i' (looks like 'l')"},
	},
	'i': {
		{'1', "digit '1' (looks like 'i')"},
		{'l', "lowercase 'l' (looks like 'i')"},
	},
	'1': {
		{'l', "letter 'l' (looks like '1')"},
		{'i', "letter 'i' (looks like '1')"},
	},
	'e': {
		{'3', "digit '3' (leet for 'e')"},
	},
	'3': {
		{'e', "letter 'e' (looks like '3')"},
	},
	'a': {
		{'4', "digit '4' (leet for 'a')"},
	},
	'4': {
		{'a', "letter 'a' (looks like '4')"},
	},
	's': {
		{'5', "digit '5' (leet for 's')"},
	},
	'5': {
		{'s', "letter 's' (looks like '5')"},
	},
	't': {
		{'7', "digit '7' (leet for 't')"},
	},
	'7': {
		{'t', "letter 't' (looks like '7')"},
	},
	'b': {
		{'8', "digit '8' (looks like 'b')"},
	},
	'8': {
		{'b', "letter 'b' (looks like '8')"},
	},
	'g': {
		{'9', "digit '9' (looks like 'g')"},
		{'q', "letter 'q' (looks like 'g')"},
	},
	'9': {
		{'g', "letter 'g' (looks like '9')"},
	},
	'z': {
		{'2', "digit '2' (leet for 'z')"},
	},
	'2': {
		{'z', "letter 'z' (looks like '2')"},
	},
}

var (
	twinCache = make(map[string][]HomoglyphTwinDto)
	twinMu    sync.RWMutex
)

// isValidTelegramCandidate ensures generated twins are legally registrable on Telegram & Fragment:
// length 4-32, must start with a letter [a-z], and only contain [a-z0-9_].
func isValidTelegramCandidate(u string) bool {
	if len(u) < 4 || len(u) > 32 {
		return false
	}
	if u[0] < 'a' || u[0] > 'z' {
		return false
	}
	for _, r := range u {
		if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_') {
			return false
		}
	}
	return true
}

// GenerateHomoglyphTwins creates a list of dangerous visual spoofing twins for a given username.
// It enumerates single and multi-character confusable substitutions (e.g. paypa1, g00gle, vv/w).
// Every generated twin is guaranteed to be a valid, legally registrable Telegram handle.
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
				if !seen[candidate] && isValidTelegramCandidate(candidate) {
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
			if !seen[candidate] && isValidTelegramCandidate(candidate) {
				seen[candidate] = true
				twins = append(twins, buildTwinDto(candidate, "ligature 'vv' for 'w'"))
			}
		}
		if strings.Contains(raw, "vv") && len(twins) < maxCount {
			candidate := strings.ReplaceAll(raw, "vv", "w")
			if !seen[candidate] && isValidTelegramCandidate(candidate) {
				seen[candidate] = true
				twins = append(twins, buildTwinDto(candidate, "ligature 'w' for 'vv'"))
			}
		}
		if strings.Contains(raw, "m") && len(twins) < maxCount {
			candidate := strings.ReplaceAll(raw, "m", "rn")
			if !seen[candidate] && isValidTelegramCandidate(candidate) {
				seen[candidate] = true
				twins = append(twins, buildTwinDto(candidate, "ligature 'rn' for 'm'"))
			}
		}
		if strings.Contains(raw, "rn") && len(twins) < maxCount {
			candidate := strings.ReplaceAll(raw, "rn", "m")
			if !seen[candidate] && isValidTelegramCandidate(candidate) {
				seen[candidate] = true
				twins = append(twins, buildTwinDto(candidate, "ligature 'm' for 'rn'"))
			}
		}
	}

	// 3. Multi-character digit substitution (e.g. google -> g00gle)
	if len(twins) < maxCount && strings.Contains(raw, "o") {
		candidate := strings.ReplaceAll(raw, "o", "0")
		if !seen[candidate] && isValidTelegramCandidate(candidate) {
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

	return HomoglyphTwinDto{
		Twin:       "@" + twinName,
		Status:     status,
		PriceTON:   pricePtr,
		RiskLevel:  risk,
		Similarity: fmt.Sprintf("Visual confusable via %s", reason),
	}
}
