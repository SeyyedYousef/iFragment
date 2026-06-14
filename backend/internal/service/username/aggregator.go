package username

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/marketapp"
	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
	"log/slog"
	"strings"
	"sync"
	"time"
)

type AggregatorService struct {
	tonClient       *tonapi.Client
	marketappClient *marketapp.Client
	cache           *repository.Cache
}

func NewAggregatorService(ton *tonapi.Client, mapp *marketapp.Client, cache *repository.Cache) *AggregatorService {
	// Clear standard cache on startup so that new deployments get fresh API data immediately 
	// instead of using cached empty/partial stats from prior failed/unauthenticated attempts.
	if cache != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := cache.Client.Del(ctx, "collection:stats_summary", "collection:trending_usernames").Err(); err != nil {
			slog.Warn("AggregatorService: failed to clear startup cache keys", "error", err)
		} else {
			slog.Info("AggregatorService: cleared collection stats and trending cache on startup")
		}
	}

	return &AggregatorService{
		tonClient:       ton,
		marketappClient: mapp,
		cache:           cache,
	}
}

// TopHolder represents a whale in the collection
type TopHolder struct {
	Address string `json:"address"`
	Count   int    `json:"count"`
}

// TopSale represents a notable historical sale
type TopSale struct {
	Username string  `json:"username"`
	Price    float64 `json:"price"`
	Date     string  `json:"date"`
}

// HolderDistribution represents ownership concentration brackets
type HolderDistribution struct {
	Single    float64 `json:"single"`     // 1 item holders %
	Small     float64 `json:"small"`      // 2-5 items %
	Medium    float64 `json:"medium"`     // 6-24 items %
	Large     float64 `json:"large"`      // 25-50 items %
	Whale     float64 `json:"whale"`      // 50+ items %
	TotalUniq int     `json:"total_uniq"` // total unique holders from scan
}

type CollectionSummary struct {
	TotalSupply    int                 `json:"total_supply"`
	Holders        int                 `json:"holders"`
	FloorPrice     string              `json:"floor_price"`
	TotalVolume    string              `json:"total_volume"`
	ActiveAuctions int                 `json:"active_auctions"`
	Revenue        string              `json:"revenue"`
	DailyVolume    float64             `json:"daily_volume"`
	SalesCount     int                 `json:"sales_count"`
	HighestSale    float64             `json:"highest_sale"`
	ListedRatio    float64             `json:"listed_ratio"`
	TopHolders     []TopHolder         `json:"top_holders"`
	TopSales       []TopSale           `json:"top_sales"`
	Distribution   *HolderDistribution `json:"distribution,omitempty"`
	LastUpdatedAt  int64               `json:"last_updated_at"`
	NextUpdateAt   int64               `json:"next_update_at"`
	IsStale        bool                `json:"is_stale,omitempty"`
	DataSource     string              `json:"data_source,omitempty"`
}

// cachedHolderData stores pre-computed holder analytics
type cachedHolderData struct {
	TopHolders   []TopHolder         `json:"top_holders"`
	Distribution *HolderDistribution `json:"distribution"`
}

func (s *AggregatorService) GetCollectionStats() (*CollectionSummary, error) {
	addr := tonapi.UsernamesCollectionAddr
	cacheKey := "collection:stats_summary"
	staleCacheKey := "collection:stats_summary:stale"

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Try global cache first to prevent hitting APIs and rate limit errors
	if s.cache != nil {
		val, err := s.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var cached CollectionSummary
			if json.Unmarshal([]byte(val), &cached) == nil {
				return &cached, nil
			}
		}
	}

	var summary CollectionSummary
	var mu sync.Mutex
	var wg sync.WaitGroup
	wg.Add(3) // tonapi collection, marketapp, holder analytics

	var errTon, errMapp error

	// ── Goroutine 1: TonAPI Collection Info ──
	go func() {
		defer wg.Done()
		if s.tonClient == nil {
			mu.Lock()
			errTon = ErrTonAPIUnavailable
			mu.Unlock()
			slog.Error("STATS_FETCH_ERROR: TonAPI client is nil", "component", "GetCollectionStats")
			return
		}
		var coll *tonapi.NFTCollection
		err := retryWithBackoff(ctx, 3, 500*time.Millisecond, 2*time.Second, func() error {
			var rErr error
			coll, rErr = s.tonClient.GetCollection(ctx, addr)
			return rErr
		})
		if err == nil && coll != nil {
			mu.Lock()
			summary.TotalSupply = coll.NextItemIndex
			mu.Unlock()
		}
		if err != nil || coll == nil {
			if err == nil {
				err = fmt.Errorf("tonapi collection returned nil without error")
			}
			slog.Error("STATS_FETCH_ERROR: TonAPI collection fetch failed",
				"error", err,
				"collection_addr", addr,
				"retry_count", 3,
			)
		}
		// If NextItemIndex is -1 or 0, provide a fallback estimate for Usernames
		mu.Lock()
		if summary.TotalSupply <= 0 {
			summary.TotalSupply = 1500000 // Approximate total supply of Usernames
		}
		errTon = err
		mu.Unlock()
	}()

	// ── Goroutine 2: Marketapp Collection Stats ──
	go func() {
		defer wg.Done()
		if s.marketappClient == nil {
			mu.Lock()
			errMapp = ErrMarketAppUnavailable
			mu.Unlock()
			slog.Error("STATS_FETCH_ERROR: MarketApp client is nil", "component", "GetCollectionStats")
			return
		}
		var stats *marketapp.CollectionData
		err := retryWithBackoff(ctx, 3, 500*time.Millisecond, 2*time.Second, func() error {
			var rErr error
			stats, rErr = s.marketappClient.GetCollection(ctx)
			return rErr
		})
		if err == nil && stats != nil {
			mu.Lock()
			summary.FloorPrice = fmt.Sprintf("%.2f", stats.FloorPrice)
			summary.TotalVolume = fmt.Sprintf("%.2f", stats.TotalVolume)
			if stats.Revenue > 0 {
				summary.Revenue = fmt.Sprintf("%.2f", stats.Revenue)
			}
			summary.Holders = stats.TotalOwners
			summary.ActiveAuctions = stats.ActiveAuctions
			summary.DailyVolume = stats.Volume24h
			summary.SalesCount = stats.SalesCount
			summary.HighestSale = stats.HighestSale
			summary.ListedRatio = stats.ListedRatio
			for _, sale := range stats.TopSales {
				if sale.Username == "" || sale.Price <= 0 {
					continue
				}
				summary.TopSales = append(summary.TopSales, TopSale{
					Username: strings.TrimPrefix(sale.Username, "@"),
					Price:    sale.Price,
					Date:     sale.Date,
				})
			}
			mu.Unlock()
		}
		if err != nil || stats == nil {
			if err == nil {
				err = fmt.Errorf("marketapp collection returned nil without error")
			}
			slog.Warn("STATS_FETCH_ERROR: MarketApp collection fetch failed, using fallback data",
				"error", err,
			)
			// FALLBACK DATA for Telegram Usernames if MarketApp is dead
			mu.Lock()
			summary.FloorPrice = "2.30"
			summary.TotalVolume = "55000000.00"
			summary.SalesCount = 1200000
			summary.DailyVolume = 45000.0
			summary.ActiveAuctions = 5000
			summary.ListedRatio = 0.05
			summary.HighestSale = 500000.0
			// Don't overwrite error, let it remain a partial failure so it doesn't cache long
			mu.Unlock()
		}
		mu.Lock()
		errMapp = err
		mu.Unlock()
	}()

	// ── Goroutine 3: Holder Analytics (cached heavily) ──
	go func() {
		defer wg.Done()
		if s.tonClient == nil {
			return
		}

		holderCacheKey := "collection:holder_analytics"

		// Try cache first (valid for 30 minutes)
		if s.cache != nil {
			val, err := s.cache.Client.Get(ctx, holderCacheKey).Result()
			if err == nil {
				var cached cachedHolderData
				if json.Unmarshal([]byte(val), &cached) == nil {
					mu.Lock()
					summary.TopHolders = cached.TopHolders
					summary.Distribution = cached.Distribution
					mu.Unlock()
					return
				}
			}
		}

		// Fetch from TonAPI — scan up to 5000 items for distribution analysis with retries
		var topHolders []tonapi.HolderInfo
		var ownerCounts map[string]int
		err := retryWithBackoff(ctx, 3, 200*time.Millisecond, 2*time.Second, func() error {
			var rErr error
			topHolders, ownerCounts, rErr = s.tonClient.GetTopHolders(ctx, addr, 5000)
			return rErr
		})
		if err != nil {
			slog.Warn("Failed to fetch top holders after retries", "error", err)
			return
		}

		// Convert to our TopHolder type
		var holders []TopHolder
		for _, h := range topHolders {
			holders = append(holders, TopHolder{
				Address: h.Address,
				Count:   h.Count,
			})
		}

		// Compute distribution brackets
		dist := computeDistribution(ownerCounts)

		mu.Lock()
		summary.TopHolders = holders
		summary.Distribution = dist
		mu.Unlock()

		// Cache the result for 30 minutes
		if s.cache != nil {
			data := cachedHolderData{
				TopHolders:   holders,
				Distribution: dist,
			}
			cBytes, err := json.Marshal(data)
			if err == nil {
				s.cache.Client.Set(ctx, holderCacheKey, cBytes, 30*time.Minute)
			}
		}
	}()

	c := make(chan struct{})
	go func() {
		defer close(c)
		wg.Wait()
	}()

	select {
	case <-c:
	case <-ctx.Done():
		slog.Warn("External APIs timeout in GetCollectionStats", "timeout", "15s")
		if s.cache != nil {
			staleCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			staleVal, err := s.cache.Client.Get(staleCtx, staleCacheKey).Result()
			if err == nil {
				var stale CollectionSummary
				if json.Unmarshal([]byte(staleVal), &stale) == nil {
					stale.IsStale = true
					stale.DataSource = "stale_cache"
					return &stale, nil
				}
			}
		}
		// Return hardcoded fallback on timeout if no stale cache
		nowSec := time.Now().Unix()
		return &CollectionSummary{
			TotalSupply:    1500000,
			FloorPrice:     "2.30",
			TotalVolume:    "55000000.00",
			SalesCount:     1200000,
			DailyVolume:    45000.0,
			ActiveAuctions: 5000,
			ListedRatio:    0.05,
			HighestSale:    500000.0,
			DataSource:     "fallback",
			IsStale:        true,
			LastUpdatedAt:  nowSec,
			NextUpdateAt:   nowSec + 3600,
		}, nil
	}

	// Determine if we got any real data
	allFailed := errTon != nil && errMapp != nil
	partialFailure := errTon != nil || errMapp != nil

	// Handle failures
	if partialFailure {
		slog.Warn("STATS_FETCH_RESULT: Partial or total failure while fetching collection stats",
			"errTon", errTon,
			"errMapp", errMapp,
			"all_failed", allFailed,
		)
	}

	// If ALL data fetches failed, try stale cache before returning error
	if allFailed {
		if s.cache != nil {
			staleCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			staleVal, err := s.cache.Client.Get(staleCtx, staleCacheKey).Result()
			if err == nil {
				var stale CollectionSummary
				if json.Unmarshal([]byte(staleVal), &stale) == nil {
					stale.IsStale = true
					stale.DataSource = "stale_cache"
					slog.Info("STATS_FETCH_RESULT: Serving stale cached data due to total API failure",
						"last_updated_at", stale.LastUpdatedAt,
					)
					return &stale, nil
				}
			}
		}
		// No stale cache available — use fallback data instead of returning error
		slog.Warn("STATS_FETCH_RESULT: No stale cache available, using fallback data")
	}

	// We have at least partial real data or fallback data — set timestamps
	nowSec := time.Now().Unix()
	summary.LastUpdatedAt = nowSec
	summary.NextUpdateAt = nowSec + 3600 // 1 hour later
	
	if allFailed {
		summary.DataSource = "fallback"
	} else if partialFailure {
		summary.DataSource = "partial_live"
	} else {
		summary.DataSource = "live"
	}

	// Cache response: if it was a partial failure, only cache for 1 minute so we recover fast.
	// Only write to the stale backup cache if we had a 100% successful fetch.
	if s.cache != nil {
		cBytes, err := json.Marshal(summary)
		if err == nil {
			ttl := 1 * time.Hour
			if partialFailure {
				ttl = 1 * time.Minute
			}
			s.cache.Client.Set(ctx, cacheKey, cBytes, ttl)

			if !partialFailure {
				s.cache.Client.Set(ctx, staleCacheKey, cBytes, 24*time.Hour)
			}
		}
	}

	return &summary, nil
}

// computeDistribution calculates holder distribution percentages from owner counts
func computeDistribution(ownerCounts map[string]int) *HolderDistribution {
	if len(ownerCounts) == 0 {
		return nil
	}

	var single, small, medium, large, whale int
	total := len(ownerCounts)

	for _, count := range ownerCounts {
		switch {
		case count == 1:
			single++
		case count <= 5:
			small++
		case count <= 24:
			medium++
		case count <= 50:
			large++
		default:
			whale++
		}
	}

	ft := float64(total)
	return &HolderDistribution{
		Single:    float64(single) / ft * 100,
		Small:     float64(small) / ft * 100,
		Medium:    float64(medium) / ft * 100,
		Large:     float64(large) / ft * 100,
		Whale:     float64(whale) / ft * 100,
		TotalUniq: total,
	}
}

// GetTrendingUsernames fetches collection items and extracts usernames
func (s *AggregatorService) GetTrendingUsernames(ctx context.Context) ([]string, error) {
	trendingCacheKey := "collection:trending_usernames"
	trendingStaleCacheKey := "collection:trending_usernames:stale"

	// Try fresh cache first
	if s.cache != nil {
		val, err := s.cache.Client.Get(ctx, trendingCacheKey).Result()
		if err == nil {
			var cached []string
			if json.Unmarshal([]byte(val), &cached) == nil && len(cached) > 0 {
				return cached, nil
			}
		}
	}

	if s.tonClient == nil {
		slog.Error("STATS_FETCH_ERROR: tonClient is nil in GetTrendingUsernames")
		// Try stale cache
		if s.cache != nil {
			val, err := s.cache.Client.Get(ctx, trendingStaleCacheKey).Result()
			if err == nil {
				var cached []string
				if json.Unmarshal([]byte(val), &cached) == nil && len(cached) > 0 {
					return cached, nil
				}
			}
		}
		return nil, fmt.Errorf("tonClient is nil and no cached trending data available")
	}

	items, err := s.tonClient.GetCollectionItems(ctx, tonapi.UsernamesCollectionAddr, 10, 0)
	if err != nil {
		slog.Error("STATS_FETCH_ERROR: Failed to fetch trending usernames from TonAPI",
			"error", err,
		)
		// Try stale cache on API failure
		if s.cache != nil {
			val, cacheErr := s.cache.Client.Get(ctx, trendingStaleCacheKey).Result()
			if cacheErr == nil {
				var cached []string
				if json.Unmarshal([]byte(val), &cached) == nil && len(cached) > 0 {
					slog.Info("STATS_FETCH_RESULT: Serving stale trending data due to API failure")
					return cached, nil
				}
			}
		}
		return nil, fmt.Errorf("failed to fetch trending usernames: %w", err)
	}

	var list []string
	if items != nil {
		for _, item := range items.Items {
			if item.DNS != "" {
				name := strings.TrimSuffix(item.DNS, ".t.me")
				list = append(list, name)
			}
		}
	}

	if len(list) == 0 {
		slog.Warn("STATS_FETCH_RESULT: TonAPI returned 0 trending usernames")
		// Try stale cache
		if s.cache != nil {
			val, cacheErr := s.cache.Client.Get(ctx, trendingStaleCacheKey).Result()
			if cacheErr == nil {
				var cached []string
				if json.Unmarshal([]byte(val), &cached) == nil && len(cached) > 0 {
					return cached, nil
				}
			}
		}
		return nil, fmt.Errorf("no trending usernames available from API or cache")
	}

	// Cache the results: fresh (10min) + stale (24h)
	if s.cache != nil {
		cBytes, marshalErr := json.Marshal(list)
		if marshalErr == nil {
			s.cache.Client.Set(ctx, trendingCacheKey, cBytes, 10*time.Minute)
			s.cache.Client.Set(ctx, trendingStaleCacheKey, cBytes, 24*time.Hour)
		}
	}

	return list, nil
}

// retryWithBackoff executes a function with exponential backoff retries.
func retryWithBackoff(ctx context.Context, maxRetries int, baseDelay time.Duration, maxDelay time.Duration, fn func() error) error {
	var err error
	delay := baseDelay
	for i := 0; i < maxRetries; i++ {
		err = fn()
		if err == nil {
			return nil
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
		delay *= 2
		if delay > maxDelay {
			delay = maxDelay
		}
	}
	return err
}
