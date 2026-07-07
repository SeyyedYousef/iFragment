package avm

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"
)

type ClearbitCompany struct {
	Name   string `json:"name"`
	Domain string `json:"domain"`
	Logo   string `json:"logo"`
}

var (
	brandCache = make(map[string]int)
	brandMutex sync.RWMutex
	brandHttp  = &http.Client{Timeout: 3 * time.Second}
)

// CheckGlobalBrand uses Clearbit Autocomplete API to detect if the username is a global corporate brand.
// Returns a gradient score: 100 = exact match, 50 = partial match (related companies), 0 = no match.
func CheckGlobalBrand(username string) int {
	lower := strings.ToLower(strings.TrimSpace(username))
	if len(lower) < 3 {
		return 0 // Brands usually have 3+ characters
	}

	brandMutex.RLock()
	cachedScore, exists := brandCache[lower]
	brandMutex.RUnlock()
	if exists {
		return cachedScore
	}

	url := fmt.Sprintf("https://autocomplete.clearbit.com/v1/companies/suggest?query=%s", lower)
	resp, err := brandHttp.Get(url)
	if err != nil {
		slog.Warn("Clearbit API fetch failed", "username", lower, "error", err)
		return 0
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return 0
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0
	}

	var companies []ClearbitCompany
	if err := json.Unmarshal(body, &companies); err != nil {
		return 0
	}

	score := 0
	for _, c := range companies {
		// Exact match check (either name or primary domain prefix)
		cName := strings.ToLower(strings.ReplaceAll(c.Name, " ", ""))
		cDomain := strings.ToLower(c.Domain)
		if idx := strings.Index(cDomain, "."); idx > 0 {
			cDomain = cDomain[:idx]
		}

		if cName == lower || cDomain == lower {
			score = 100
			break
		}
	}

	// If no exact match but companies were returned, give partial credit
	// ONLY if username is at least 4 chars long to prevent random 3-letter junk from getting brand points
	if score == 0 && len(companies) > 0 && len(lower) >= 4 {
		score = 50 // Related brand exists
	}

	brandMutex.Lock()
	brandCache[lower] = score
	brandMutex.Unlock()

	return score
}
