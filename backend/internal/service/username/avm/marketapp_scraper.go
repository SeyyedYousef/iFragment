package avm

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	// marketappCache stores recently scraped max prices
	marketappCache = make(map[string]cacheEntry)
	marketappMutex sync.RWMutex
	// Cache TTL set to 1 hour to prevent spamming
	cacheTTL = 1 * time.Hour
)

type cacheEntry struct {
	maxPrice float64
	fetched  time.Time
}

// ScrapeMarketappMaxPrice fetches the marketapp.org page for a username and extracts the highest TON price found.
func ScrapeMarketappMaxPrice(ctx context.Context, username string) float64 {
	username = strings.TrimPrefix(username, "@")
	username = strings.ToLower(username)

	// Check cache
	marketappMutex.RLock()
	if entry, exists := marketappCache[username]; exists {
		if time.Since(entry.fetched) < cacheTTL {
			marketappMutex.RUnlock()
			return entry.maxPrice
		}
	}
	marketappMutex.RUnlock()

	url := "https://marketapp.org/collection/EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi/" + username

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		slog.Warn("[MarketappScraper] Failed to create request", "error", err, "username", username)
		return 0
	}

	// Add some headers to pretend we are a browser, often helps with scraping
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		slog.Warn("[MarketappScraper] Failed to fetch page", "error", err, "username", username)
		return 0
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		slog.Warn("[MarketappScraper] Non-200 status code", "status", resp.StatusCode, "username", username)
		return 0
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		slog.Warn("[MarketappScraper] Failed to read response body", "error", err)
		return 0
	}

	html := string(body)

	// Regex looking for numbers inside elements that likely represent price (e.g. `<div ... icon-ton">1,500</div>`, `>1500<`)
	// We make it broad enough to catch standard formatting of numbers in TON on NFT marketplaces
	re := regexp.MustCompile(`(?:icon-ton[^>]*>|>)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(?:</|<span|TON)`)
	matches := re.FindAllStringSubmatch(html, -1)

	var maxPrice float64 = 0

	for _, match := range matches {
		if len(match) > 1 {
			priceStr := strings.ReplaceAll(match[1], ",", "")
			priceVal, err := strconv.ParseFloat(priceStr, 64)
			if err == nil && priceVal > maxPrice {
				maxPrice = priceVal
			}
		}
	}

	// A fallback regex specifically for marketapp's potential JSON data in <script> tags or other hidden fields
	reJson := regexp.MustCompile(`"price":\s*"?([0-9]+(?:\.[0-9]+)?)"?`)
	matchesJson := reJson.FindAllStringSubmatch(html, -1)
	for _, match := range matchesJson {
		if len(match) > 1 {
			priceVal, err := strconv.ParseFloat(match[1], 64)
			// sometimes prices in JSON are in nanoTON (10^9), let's ignore huge numbers as we just want normal TON values
			if err == nil && priceVal > maxPrice && priceVal < 1000000000 {
				maxPrice = priceVal
			} else if err == nil && priceVal >= 1000000000 { // Convert from nanoTon
				nanoVal := priceVal / 1000000000
				if nanoVal > maxPrice {
					maxPrice = nanoVal
				}
			}
		}
	}

	// Update cache with bounds safety
	marketappMutex.Lock()
	if len(marketappCache) >= 5000 {
		marketappCache = make(map[string]cacheEntry)
	}
	marketappCache[username] = cacheEntry{
		maxPrice: maxPrice,
		fetched:  time.Now(),
	}
	marketappMutex.Unlock()

	return maxPrice
}
