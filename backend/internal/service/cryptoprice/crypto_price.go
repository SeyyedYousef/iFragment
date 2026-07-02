package cryptoprice

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"sync"
	"time"

	"ifragment-backend/internal/repository"
)

type CryptoPriceService struct {
	cache      *repository.Cache
	httpClient *http.Client
	mu         sync.RWMutex
	prices     map[string]float64
	lastFetch  time.Time
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

	// We use Binance API for more stable rate limits compared to CoinGecko without an API key
	url := "https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT"

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		slog.Error("failed to create request for crypto prices", "error", err)
		return
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "iFragmentBot/1.0 (https://ifragment.com)")
	
	resp, err := s.httpClient.Do(req)
	if err != nil {
		slog.Error("failed to fetch crypto prices", "error", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		slog.Error("failed to fetch crypto prices", "status", resp.StatusCode)
		return
	}

	var data struct {
		Price string `json:"price"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		slog.Error("failed to decode crypto prices", "error", err)
		return
	}

	priceFloat, err := strconv.ParseFloat(data.Price, 64)
	if err != nil {
		slog.Error("failed to parse crypto price", "error", err)
		return
	}

	s.mu.Lock()
	s.prices["the-open-network"] = priceFloat
	s.lastFetch = time.Now()
	s.mu.Unlock()

	// Try to cache to Redis
	if s.cache != nil && s.cache.Client != nil {
		s.mu.RLock()
		cachedData, _ := json.Marshal(s.prices)
		s.mu.RUnlock()
		_ = s.cache.Client.Set(ctx, "crypto:prices", cachedData, 6*time.Minute).Err()
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
				s.mu.Unlock()
			}
		}
	}
}

// GetPrice returns the price formatted as a string
func (s *CryptoPriceService) GetPrice(symbol string) string {
	s.mu.RLock()
	price, ok := s.prices[symbol]
	s.mu.RUnlock()

	if !ok {
		return "N/A"
	}
	return formatPrice(price)
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
