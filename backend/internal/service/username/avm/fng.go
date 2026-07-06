package avm

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"sync"
	"time"
)

type FnGResponse struct {
	Data []struct {
		Value               string `json:"value"`
		ValueClassification string `json:"value_classification"`
	} `json:"data"`
}

var (
	fngCache      float64 = 1.0
	fngLastUpdate time.Time
	fngMutex      sync.RWMutex
	fngHttp       = &http.Client{Timeout: 5 * time.Second}
)

// GetFearAndGreedMultiplier fetches the global crypto Fear & Greed index and maps it to a valuation multiplier.
func GetFearAndGreedMultiplier() (float64, string) {
	fngMutex.RLock()
	cached := fngCache
	lastUpdate := fngLastUpdate
	fngMutex.RUnlock()

	// Cache for 12 hours since the index updates daily
	if time.Since(lastUpdate) < 12*time.Hour {
		return cached, "cached_fng"
	}

	resp, err := fngHttp.Get("https://api.alternative.me/fng/")
	if err != nil {
		slog.Warn("FnG API fetch failed", "error", err)
		return cached, "cached_error_fallback"
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return cached, "cached_error_fallback"
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return cached, "cached_error_fallback"
	}

	var parsed FnGResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return cached, "cached_error_fallback"
	}

	if len(parsed.Data) == 0 {
		return cached, "cached_error_fallback"
	}

	valStr := parsed.Data[0].Value
	val, err := strconv.Atoi(valStr)
	if err != nil {
		return cached, "cached_error_fallback"
	}

	var multiplier float64 = 1.0
	if val >= 75 {
		multiplier = 1.20 // Extreme Greed -> +20% premium
	} else if val >= 55 {
		multiplier = 1.10 // Greed -> +10% premium
	} else if val <= 25 {
		multiplier = 0.90 // Extreme Fear -> -10% discount (user requested not dropping too low)
	} else if val <= 45 {
		multiplier = 0.95 // Fear -> -5% discount
	}

	fngMutex.Lock()
	fngCache = multiplier
	fngLastUpdate = time.Now()
	fngMutex.Unlock()

	return multiplier, parsed.Data[0].ValueClassification
}
