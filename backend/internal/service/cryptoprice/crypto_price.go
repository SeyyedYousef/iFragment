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

	// Use TonAPI to fetch the official TON price, utilizing our authenticated client keys
	tonClient := tonapi.NewClient()
	usdPrice, err := tonClient.GetTONRates(ctx)
	
	if err != nil {
		slog.Error("failed to fetch crypto price from tonapi", "error", err)
		return
	}

	s.mu.Lock()
	s.prices["the-open-network"] = usdPrice
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
