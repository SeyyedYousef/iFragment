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
	fngIndexCache int     = 50
	fngClassCache string  = "Neutral"
	fngLastUpdate time.Time
	fngMutex      sync.RWMutex
	fngHttp       = &http.Client{Timeout: 5 * time.Second}
)

// GetFearAndGreedMultiplier fetches the global crypto Fear & Greed index and maps it to a valuation multiplier.
func GetFearAndGreedMultiplier() (float64, string, int) {
	fngMutex.RLock()
	cached := fngCache
	cachedIdx := fngIndexCache
	cachedClass := fngClassCache
	lastUpdate := fngLastUpdate
	fngMutex.RUnlock()

	// Cache for 12 hours since the index updates daily
	if time.Since(lastUpdate) < 12*time.Hour {
		return cached, cachedClass, cachedIdx
	}

	resp, err := fngHttp.Get("https://api.alternative.me/fng/")
	if err != nil {
		slog.Warn("FnG API fetch failed", "error", err)
		return cached, cachedClass, cachedIdx
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return cached, cachedClass, cachedIdx
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return cached, cachedClass, cachedIdx
	}

	var parsed FnGResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return cached, cachedClass, cachedIdx
	}

	if len(parsed.Data) == 0 {
		return cached, cachedClass, cachedIdx
	}

	valStr := parsed.Data[0].Value
	val, err := strconv.Atoi(valStr)
	if err != nil {
		return cached, cachedClass, cachedIdx
	}

	// Linear Scaling Formula: 0.85 + (val / 100.0) * 0.35
	// If val = 10 -> 0.85 + 0.035 = 0.885 (-11.5%)
	// If val = 50 -> 0.85 + 0.175 = 1.025 (+2.5%)
	// If val = 90 -> 0.85 + 0.315 = 1.165 (+16.5%)
	var multiplier float64 = 0.85 + (float64(val)/100.0)*0.35

	fngMutex.Lock()
	fngCache = multiplier
	fngIndexCache = val
	fngClassCache = parsed.Data[0].ValueClassification
	fngLastUpdate = time.Now()
	fngMutex.Unlock()

	return multiplier, parsed.Data[0].ValueClassification, val
}
