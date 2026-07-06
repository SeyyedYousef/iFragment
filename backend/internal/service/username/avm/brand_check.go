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
	brandCache = make(map[string]bool)
	brandMutex sync.RWMutex
	brandHttp  = &http.Client{Timeout: 3 * time.Second}
)

// CheckGlobalBrand uses Clearbit Autocomplete API to detect if the username is a global corporate brand.
func CheckGlobalBrand(username string) bool {
	lower := strings.ToLower(strings.TrimSpace(username))
	if len(lower) < 3 {
		return false // Brands usually have 3+ characters
	}

	brandMutex.RLock()
	isBrand, exists := brandCache[lower]
	brandMutex.RUnlock()
	if exists {
		return isBrand
	}

	url := fmt.Sprintf("https://autocomplete.clearbit.com/v1/companies/suggest?query=%s", lower)
	resp, err := brandHttp.Get(url)
	if err != nil {
		slog.Warn("Clearbit API fetch failed", "username", lower, "error", err)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return false
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false
	}

	var companies []ClearbitCompany
	if err := json.Unmarshal(body, &companies); err != nil {
		return false
	}

	foundBrand := false
	for _, c := range companies {
		// Exact match check (either name or primary domain prefix)
		cName := strings.ToLower(strings.ReplaceAll(c.Name, " ", ""))
		cDomain := strings.ToLower(c.Domain)
		if idx := strings.Index(cDomain, "."); idx > 0 {
			cDomain = cDomain[:idx]
		}

		if cName == lower || cDomain == lower {
			foundBrand = true
			break
		}
	}

	brandMutex.Lock()
	brandCache[lower] = foundBrand
	brandMutex.Unlock()

	return foundBrand
}
