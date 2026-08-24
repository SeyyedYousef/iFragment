package avm

import (
	"context"
	"io"
	"log/slog"
	"math"
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

type MarketappScrapeResult struct {
	Status          string    `json:"status"` // "success", "parser_failed", "not_found", "network_error"
	ListingPriceTON *float64  `json:"listing_price_ton"`
	SourceURL       string    `json:"source_url"`
	FetchedAt       time.Time `json:"fetched_at"`
	ParserVersion   string    `json:"parser_version"`
}

type cacheEntry struct {
	result  MarketappScrapeResult
	fetched time.Time
}

// ScrapeMarketappDetailed fetches the marketapp.org page for a username and extracts structured listing info.
func ScrapeMarketappDetailed(ctx context.Context, username string) MarketappScrapeResult {
	username = strings.TrimPrefix(username, "@")
	username = strings.ToLower(username)

	url := "https://marketapp.org/collection/EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi/" + username

	// Check cache
	marketappMutex.RLock()
	if entry, exists := marketappCache[username]; exists {
		if time.Since(entry.fetched) < cacheTTL {
			marketappMutex.RUnlock()
			return entry.result
		}
	}
	marketappMutex.RUnlock()

	res := MarketappScrapeResult{
		Status:        "network_error",
		SourceURL:     url,
		FetchedAt:     time.Now(),
		ParserVersion: "marketapp_v3.1",
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		slog.Warn("[MarketappScraper] Failed to create request", "error", err, "username", username)
		return res
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		slog.Warn("[MarketappScraper] Failed to fetch page", "error", err, "username", username)
		return res
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		res.Status = "not_found"
		return res
	}

	if resp.StatusCode != http.StatusOK {
		slog.Warn("[MarketappScraper] Non-200 status code", "status", resp.StatusCode, "username", username)
		return res
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		slog.Warn("[MarketappScraper] Failed to read response body", "error", err)
		res.Status = "parser_failed"
		return res
	}

	html := string(body)

	re := regexp.MustCompile(`(?:icon-ton[^>]*>|>)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(?:</|<span|TON)`)
	matches := re.FindAllStringSubmatch(html, -1)

	var maxPrice float64 = 0
	found := false

	for _, match := range matches {
		if len(match) > 1 {
			priceStr := strings.ReplaceAll(match[1], ",", "")
			priceVal, err := strconv.ParseFloat(priceStr, 64)
			if err == nil && priceVal > maxPrice {
				maxPrice = priceVal
				found = true
			}
		}
	}

	reJson := regexp.MustCompile(`"price":\s*"?([0-9]+(?:\.[0-9]+)?)"?`)
	matchesJson := reJson.FindAllStringSubmatch(html, -1)
	for _, match := range matchesJson {
		if len(match) > 1 {
			priceVal, err := strconv.ParseFloat(match[1], 64)
			if err == nil && priceVal > maxPrice && priceVal < 1000000000 {
				maxPrice = priceVal
				found = true
			} else if err == nil && priceVal >= 1000000000 {
				nanoVal := priceVal / 1000000000
				if nanoVal > maxPrice {
					maxPrice = nanoVal
					found = true
				}
			}
		}
	}

	if found && maxPrice > 0 {
		res.Status = "success"
		res.ListingPriceTON = &maxPrice
	} else {
		res.Status = "parser_failed"
	}

	// Smart Cache Eviction
	marketappMutex.Lock()
	if len(marketappCache) >= 5000 {
		now := time.Now()
		for k, v := range marketappCache {
			if now.Sub(v.fetched) > cacheTTL {
				delete(marketappCache, k)
			}
		}
		if len(marketappCache) >= 5000 {
			marketappCache = make(map[string]cacheEntry)
		}
	}
	marketappCache[username] = cacheEntry{
		result:  res,
		fetched: time.Now(),
	}
	marketappMutex.Unlock()

	return res
}

// ScrapeMarketappMaxPrice legacy wrapper returning float64 (0 if not found/error)
func ScrapeMarketappMaxPrice(ctx context.Context, username string) float64 {
	res := ScrapeMarketappDetailed(ctx, username)
	if res.Status == "success" && res.ListingPriceTON != nil {
		return *res.ListingPriceTON
	}
	return 0
}

// RentYieldDto conveys the rental capitalization intelligence of a username.
type RentYieldDto struct {
	MonthlyMedianTON float64 `json:"monthly_median_ton"`
	CapMonths        float64 `json:"cap_months"`
	RentFloorTON     float64 `json:"rent_floor_ton"`
	Source           string  `json:"source"`
}

// EstimateRentYieldFloor computes the rent yield floor for a username based on its segment, length, and base estimate.
// A rational buyer will not price an asset below its capitalized rental yield over rent_cap_months (default 18 months).
func EstimateRentYieldFloor(charLen int, features MorphFeatures, expectedBaseTON float64, cfg EngineConfig) RentYieldDto {
	capMonths := cfg.RentCapMonths
	if capMonths <= 0 {
		capMonths = 18.0
	}

	if features.IsGibberish || features.HasCheapPrefix || features.HasCheapSuffix || expectedBaseTON <= 0 {
		return RentYieldDto{
			MonthlyMedianTON: 0,
			CapMonths:        capMonths,
			RentFloorTON:     0,
			Source:           "none",
		}
	}

	// Monthly rental rate typically yields 2.5% to 4.5% of asset value
	monthlyRate := 0.035
	if features.IsDictionary {
		monthlyRate = 0.045
	} else if features.HasNumbers || features.HasUnderscore {
		monthlyRate = 0.020
	}

	monthlyRent := expectedBaseTON * monthlyRate
	if monthlyRent < 1.0 && expectedBaseTON >= 25.0 {
		monthlyRent = 1.0
	}

	rentFloor := AestheticRound(monthlyRent * capMonths)

	return RentYieldDto{
		MonthlyMedianTON: math.Round(monthlyRent*100) / 100,
		CapMonths:        capMonths,
		RentFloorTON:     rentFloor,
		Source:           "marketapp_rent_capitalization",
	}
}



