package crypto

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

type CryptoService struct {
	cache      sync.Map
	httpClient *http.Client
	ttl        time.Duration
}

type cacheEntry struct {
	price     float64
	expiresAt time.Time
}

func NewCryptoService() *CryptoService {
	return &CryptoService{
		httpClient: &http.Client{Timeout: 10 * time.Second},
		ttl:        5 * time.Minute, // 5 min cache
	}
}

// GetPrices fetches both BTC and Gram (TON) prices from CoinGecko
func (s *CryptoService) GetPrices(ctx context.Context) (float64, float64, error) {
	btcPrice := s.getCachedPrice("bitcoin")
	gramPrice := s.getCachedPrice("the-open-network") // Usually Gram translates to TON contextually, or we can use "gram" if it's on coingecko

	if btcPrice > 0 && gramPrice > 0 {
		return btcPrice, gramPrice, nil
	}

	// Fetch from CoinGecko
	// bitcoin, the-open-network, gram-coin (if there's a specific gram token)
	// We'll fetch bitcoin and the-open-network
	url := "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,the-open-network&vs_currencies=usd"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, 0, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return 0, 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, 0, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var result map[string]map[string]float64
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, 0, err
	}

	var btc, ton float64
	if data, ok := result["bitcoin"]; ok {
		btc = data["usd"]
		s.setCachedPrice("bitcoin", btc)
	}
	if data, ok := result["the-open-network"]; ok {
		ton = data["usd"]
		s.setCachedPrice("the-open-network", ton)
	}

	if btcPrice == 0 {
		btcPrice = btc
	}
	if gramPrice == 0 {
		gramPrice = ton
	}

	return btcPrice, gramPrice, nil
}

func (s *CryptoService) getCachedPrice(coin string) float64 {
	val, ok := s.cache.Load(coin)
	if !ok {
		return 0
	}
	entry := val.(cacheEntry)
	if time.Now().After(entry.expiresAt) {
		s.cache.Delete(coin)
		return 0
	}
	return entry.price
}

func (s *CryptoService) setCachedPrice(coin string, price float64) {
	s.cache.Store(coin, cacheEntry{
		price:     price,
		expiresAt: time.Now().Add(s.ttl),
	})
}
