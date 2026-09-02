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
	fngHttp       = &http.Client{Timeout: 1 * time.Second}

	// DisableFnGNetwork can be toggled in unit tests to prevent network I/O latency & non-determinism
	DisableFnGNetwork = false
)

// GetFearAndGreedMultiplier fetches the global crypto Fear & Greed index and maps it to a valuation multiplier.
func GetFearAndGreedMultiplier() (float64, string, int) {
	if DisableFnGNetwork || DisableDatamuseNetwork {
		return 1.0, "Neutral", 50
	}

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
		fngMutex.Lock()
		fngLastUpdate = time.Now().Add(-11 * time.Hour) // Retry in 1 hour rather than immediately
		fngMutex.Unlock()
		return cached, cachedClass, cachedIdx
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		fngMutex.Lock()
		fngLastUpdate = time.Now().Add(-11 * time.Hour)
		fngMutex.Unlock()
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

// GetCalibratedFnGMultiplier computes the market sentiment multiplier adjusted for asset segment elasticity.
// Dictionary & established brand names exhibit defensive asset properties (elasticity = 0.50),
// whereas speculative, meme, or hype handles exhibit higher market beta (elasticity = 1.00).
// The resulting multiplier is strictly clamped to [0.90, 1.10] (maximum +/-10% influence).
func GetCalibratedFnGMultiplier(isDefensive bool, cfg EngineConfig) (adjustedMultiplier float64, rawClass string, rawIndex int) {
	rawMult, class, idx := GetFearAndGreedMultiplier()

	elasticity := cfg.FnGElasticitySpeculative
	if isDefensive {
		elasticity = cfg.FnGElasticityDefensive
	}

	// Delta from neutral (1.0) scaled by elasticity
	delta := (rawMult - 1.0) * elasticity
	adj := 1.0 + delta

	// Strict bounding to [FnGClampLow, FnGClampHigh]
	if adj < cfg.FnGClampLow {
		adj = cfg.FnGClampLow
	}
	if adj > cfg.FnGClampHigh {
		adj = cfg.FnGClampHigh
	}

	return adj, class, idx
}

