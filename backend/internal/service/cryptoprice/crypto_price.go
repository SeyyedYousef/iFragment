package cryptoprice

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
)

type CryptoPriceService struct {
	cache      *repository.Cache
	httpClient *http.Client
	mu         sync.RWMutex
	prices     map[string]float64
	lastFetch  time.Time
	lastSource string
}

func NewCryptoPriceService(cache *repository.Cache) *CryptoPriceService {
	return &CryptoPriceService{
		cache: cache,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		prices: make(map[string]float64),
	}
}

// Start runs a background worker to update prices periodically
func (s *CryptoPriceService) Start(ctx context.Context) {
	slog.Info("Starting Crypto Price Worker...")

	// Initial load from redis or API
	s.loadFromRedis()
	if len(s.prices) == 0 {
		s.fetchPrices(ctx)
	}

	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Crypto Price Worker stopped")
			return
		case <-ticker.C:
			s.fetchPrices(ctx)
		}
	}
}

func (s *CryptoPriceService) fetchPrices(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("Recovered from panic in fetchPrices", "panic", r)
		}
	}()

	var usdPrice float64
	var fetchErr error
	var source string

	// 1. Primary: Use TonAPI to fetch official TON rate
	tonClient := tonapi.NewClient()
	usdPrice, fetchErr = tonClient.GetTONRates(ctx)
	if fetchErr == nil && usdPrice > 0 {
		source = "TonAPI"
	}

	// 2. Secondary: If TonAPI fails, fallback to CoinGecko
	if fetchErr != nil || usdPrice <= 0 {
		slog.Warn("TonAPI rate fetch failed, trying CoinGecko fallback...", "error", fetchErr)
		req, err := http.NewRequestWithContext(ctx, "GET", "https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd", nil)
		if err == nil {
			req.Header.Set("User-Agent", "iFragment/1.0")
			resp, httpErr := s.httpClient.Do(req)
			if httpErr == nil && resp.StatusCode == http.StatusOK {
				var cgResp struct {
					TheOpenNetwork struct {
						USD float64 `json:"usd"`
					} `json:"the-open-network"`
				}
				if json.NewDecoder(resp.Body).Decode(&cgResp) == nil && cgResp.TheOpenNetwork.USD > 0 {
					usdPrice = cgResp.TheOpenNetwork.USD
					fetchErr = nil
					source = "CoinGecko"
					slog.Info("Successfully fetched TON rate from CoinGecko fallback", "price", usdPrice)
				}
				resp.Body.Close()
			}
		}
	}

	// 3. Tertiary: Public Exchange TONUSDT ticker fallback (OKX / Binance)
	if fetchErr != nil || usdPrice <= 0 {
		slog.Warn("CoinGecko rate fetch failed, trying OKX TON-USDT public ticker...", "error", fetchErr)
		req, err := http.NewRequestWithContext(ctx, "GET", "https://www.okx.com/api/v5/market/ticker?instId=TON-USDT", nil)
		if err == nil {
			req.Header.Set("User-Agent", "iFragment/1.0")
			resp, httpErr := s.httpClient.Do(req)
			if httpErr == nil && resp.StatusCode == http.StatusOK {
				var okxResp struct {
					Code string `json:"code"`
					Data []struct {
						Last string `json:"last"`
					} `json:"data"`
				}
				if json.NewDecoder(resp.Body).Decode(&okxResp) == nil && len(okxResp.Data) > 0 {
					var p float64
					if _, scanErr := fmt.Sscanf(okxResp.Data[0].Last, "%f", &p); scanErr == nil && p > 0 {
						usdPrice = p
						fetchErr = nil
						source = "OKX (TON/USDT)"
						slog.Info("Successfully fetched TON rate from OKX ticker", "price", usdPrice)
					}
				}
				resp.Body.Close()
			}
		}
	}

	// 4. Binance public ticker fallback
	if fetchErr != nil || usdPrice <= 0 {
		slog.Warn("OKX ticker fetch failed, trying Binance TONUSDT public ticker...", "error", fetchErr)
		req, err := http.NewRequestWithContext(ctx, "GET", "https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT", nil)
		if err == nil {
			req.Header.Set("User-Agent", "iFragment/1.0")
			resp, httpErr := s.httpClient.Do(req)
			if httpErr == nil && resp.StatusCode == http.StatusOK {
				var bnResp struct {
					Price string `json:"price"`
				}
				if json.NewDecoder(resp.Body).Decode(&bnResp) == nil {
					var p float64
					if _, scanErr := fmt.Sscanf(bnResp.Price, "%f", &p); scanErr == nil && p > 0 {
						usdPrice = p
						fetchErr = nil
						source = "Binance (TONUSDT)"
						slog.Info("Successfully fetched TON rate from Binance ticker", "price", usdPrice)
					}
				}
				resp.Body.Close()
			}
		}
	}

	if fetchErr != nil || usdPrice <= 0 {
		slog.Error("Failed to fetch crypto price from all live providers", "error", fetchErr)
		return
	}

	now := time.Now()
	s.mu.Lock()
	s.prices["the-open-network"] = usdPrice
	s.lastSource = source
	s.lastFetch = now
	s.mu.Unlock()

	// Cache to Redis with timestamp and source (without aggressive TTL, 30 days retention)
	if s.cache != nil && s.cache.Client != nil {
		s.mu.RLock()
		cachedData, _ := json.Marshal(s.prices)
		s.mu.RUnlock()
		_ = s.cache.Client.Set(ctx, "crypto:prices", cachedData, 30*24*time.Hour).Err()
		_ = s.cache.Client.Set(ctx, "crypto:prices:ts", now.Unix(), 30*24*time.Hour).Err()
		_ = s.cache.Client.Set(ctx, "crypto:prices:source", source, 30*24*time.Hour).Err()
		_ = s.cache.Client.Set(ctx, "crypto:prices:ton_usdt", fmt.Sprintf("%.6f", usdPrice), 30*24*time.Hour).Err()
	}
}

func (s *CryptoPriceService) loadFromRedis() {
	if s.cache != nil && s.cache.Client != nil {
		val, err := s.cache.Client.Get(context.Background(), "crypto:prices").Result()
		if err == nil {
			var cachedPrices map[string]float64
			if json.Unmarshal([]byte(val), &cachedPrices) == nil {
				s.mu.Lock()
				s.prices = cachedPrices
				if tsStr, tsErr := s.cache.Client.Get(context.Background(), "crypto:prices:ts").Result(); tsErr == nil {
					var tsSec int64
					if n, _ := fmt.Sscanf(tsStr, "%d", &tsSec); n > 0 {
						s.lastFetch = time.Unix(tsSec, 0)
					}
				}
				if srcStr, srcErr := s.cache.Client.Get(context.Background(), "crypto:prices:source").Result(); srcErr == nil && srcStr != "" {
					s.lastSource = srcStr
				}
				s.mu.Unlock()
			}
		}
	}
}

// GetTONUSDT returns the single unified TON rate in USDT/USD, its origin source, fetch timestamp, and staleness.
// If no rate is available anywhere (API and persistence both empty), it returns rate=0, ok=false.
// Sources in order of preference:
// 1. TonAPI
// 2. CoinGecko (the-open-network)
// 3. Direct Public Exchange TONUSDT ticker (OKX, Binance)
// 4. Last known persistent rate in Redis/Postgres
func (s *CryptoPriceService) GetTONUSDT(ctx context.Context) (rate float64, source string, fetchedAt time.Time, isStale bool, ok bool) {
	s.mu.RLock()
	rate = s.prices["the-open-network"]
	source = s.lastSource
	fetchedAt = s.lastFetch
	s.mu.RUnlock()

	// If in-memory rate is available
	if rate > 0 {
		isStale = time.Since(fetchedAt) > 15*time.Minute
		if source == "" {
			source = "TonAPI"
		}
		return rate, source, fetchedAt, isStale, true
	}

	// Try reading directly from Redis fallback storage without TTL restriction
	if s.cache != nil && s.cache.Client != nil {
		val, err := s.cache.Client.Get(ctx, "crypto:prices:ton_usdt").Result()
		if err == nil {
			var r float64
			if _, scanErr := fmt.Sscanf(val, "%f", &r); scanErr == nil && r > 0 {
				var ts time.Time
				if tsStr, tsErr := s.cache.Client.Get(ctx, "crypto:prices:ts").Result(); tsErr == nil {
					var tsSec int64
					if n, _ := fmt.Sscanf(tsStr, "%d", &tsSec); n > 0 {
						ts = time.Unix(tsSec, 0)
					}
				}
				src := "Redis Cache Fallback"
				if srcStr, srcErr := s.cache.Client.Get(ctx, "crypto:prices:source").Result(); srcErr == nil && srcStr != "" {
					src = srcStr + " (cached)"
				}
				stale := true
				if !ts.IsZero() && time.Since(ts) <= 15*time.Minute {
					stale = false
				}
				return r, src, ts, stale, true
			}
		}
	}

	// No price available anywhere
	return 0, "", time.Time{}, true, false
}

// GetPriceWithFreshness returns price, existence, staleness (> 15m), and fetch timestamp
func (s *CryptoPriceService) GetPriceWithFreshness(symbol string) (price float64, ok bool, isStale bool, fetchedAt time.Time) {
	s.mu.RLock()
	price, ok = s.prices[symbol]
	last := s.lastFetch
	s.mu.RUnlock()

	if !ok || price <= 0 {
		return 0, false, true, time.Time{}
	}
	isStale = time.Since(last) > 15*time.Minute
	return price, true, isStale, last
}

// GetPrice returns the price formatted as a string
func (s *CryptoPriceService) GetPrice(symbol string) string {
	price, ok, isStale, _ := s.GetPriceWithFreshness(symbol)
	if !ok {
		return "N/A"
	}
	formatted := formatPrice(price)
	if isStale {
		return formatted + " (stale)"
	}
	return formatted
}

// GetFloatPrice returns raw price float64 and existence bool.
// Rejects severely stale prices (> 2 hours) to prevent corrupt financial calculations.
func (s *CryptoPriceService) GetFloatPrice(symbol string) (float64, bool) {
	price, ok, _, last := s.GetPriceWithFreshness(symbol)
	if !ok {
		return 0, false
	}
	// Fail closed if price is older than 2 hours without successful update
	if time.Since(last) > 2*time.Hour {
		slog.Warn("Rejecting crypto price due to extreme staleness (>2h)", "symbol", symbol, "age", time.Since(last).String())
		return 0, false
	}
	return price, true
}

// SetTestPrice manually assigns a rate for tests or mocks
func (s *CryptoPriceService) SetTestPrice(symbol string, price float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.prices[symbol] = price
	s.lastFetch = time.Now()
}

func formatPrice(price float64) string {
	if price >= 1000 {
		p := int64(price)
		str := fmt.Sprintf("%d", p)
		var buf []byte
		for i, c := range str {
			buf = append(buf, byte(c))
			if (len(str)-i-1)%3 == 0 && i != len(str)-1 {
				buf = append(buf, ',')
			}
		}
		return "$" + string(buf)
	} else if price >= 1 {
		return fmt.Sprintf("$%.2f", price)
	} else {
		return fmt.Sprintf("$%.4f", price)
	}
}
