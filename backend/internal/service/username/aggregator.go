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
}

// cachedHolderData stores pre-computed holder analytics
type cachedHolderData struct {
	TopHolders   []TopHolder         `json:"top_holders"`
	Distribution *HolderDistribution `json:"distribution"`
}

func (s *AggregatorService) GetCollectionStats() (*CollectionSummary, error) {
	addr := tonapi.UsernamesCollectionAddr
	cacheKey := "collection:stats_summary"

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
			return
		}
		coll, err := s.tonClient.GetCollection(ctx, addr)
		if err == nil && coll != nil {
			mu.Lock()
			summary.TotalSupply = coll.NextItemIndex
			mu.Unlock()
		}
		mu.Lock()
		errTon = err
		mu.Unlock()
	}()

	// ── Goroutine 2: Marketapp Collection Stats ──
	go func() {
		defer wg.Done()
		if s.marketappClient == nil {
			return
		}
		stats, err := s.marketappClient.GetCollection(ctx)
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

		// Fetch from TonAPI — scan up to 5000 items for distribution analysis
		topHolders, ownerCounts, err := s.tonClient.GetTopHolders(ctx, addr, 5000)
		if err != nil {
			slog.Warn("Failed to fetch top holders", "error", err)
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
		return nil, fmt.Errorf("external APIs timeout")
	}

	// Handle partial responses and failures
	if errTon != nil || errMapp != nil {
		slog.Warn("Partial or total failure while fetching collection stats",
			"errTon", errTon,
			"errMapp", errMapp,
		)
		
		// If both failed, we cannot proceed and must return an error
		if errTon != nil && errMapp != nil {
			return nil, fmt.Errorf("both TonAPI and Marketapp services failed: %w", errTon)
		}
	}

	// Cache successful response (only if no errors occurred)
	if s.cache != nil && errTon == nil && errMapp == nil {
		cBytes, err := json.Marshal(summary)
		if err == nil {
			s.cache.Client.Set(ctx, cacheKey, cBytes, 5*time.Minute)
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
	if s.tonClient == nil {
		return []string{"news", "auto", "bank", "crypto"}, nil
	}

	items, err := s.tonClient.GetCollectionItems(ctx, tonapi.UsernamesCollectionAddr, 10, 0)
	if err != nil {
		return []string{"news", "auto", "bank", "crypto"}, nil
	}

	var list []string
	for _, item := range items.Items {
		if item.DNS != "" {
			name := strings.TrimSuffix(item.DNS, ".t.me")
			list = append(list, name)
		}
	}

	// Fallback if empty or not enough items
	if len(list) < 4 {
		fallback := []string{"news", "auto", "bank", "crypto"}
		for _, f := range fallback {
			if len(list) >= 10 {
				break
			}
			// Only add if not already in list
			found := false
			for _, l := range list {
				if l == f {
					found = true
					break
				}
			}
			if !found {
				list = append(list, f)
			}
		}
	}

	return list, nil
}
