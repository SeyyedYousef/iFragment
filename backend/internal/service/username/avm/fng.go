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

	// Linear Scaling Formula: 0.85 + (val / 100.0) * 0.35
	// If val = 10 -> 0.85 + 0.035 = 0.885 (-11.5%)
	// If val = 50 -> 0.85 + 0.175 = 1.025 (+2.5%)
	// If val = 90 -> 0.85 + 0.315 = 1.165 (+16.5%)
	var multiplier float64 = 0.85 + (float64(val) / 100.0) * 0.35

	fngMutex.Lock()
	fngCache = multiplier
	fngLastUpdate = time.Now()
	fngMutex.Unlock()

	return multiplier, parsed.Data[0].ValueClassification
}
