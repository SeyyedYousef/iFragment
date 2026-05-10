package username

import (
	"context"
	"fmt"
	"ifragment-backend/internal/client/marketapp"
	"ifragment-backend/internal/client/tonapi"
	"sync"
	"time"
)

type AggregatorService struct {
	tonClient       *tonapi.Client
	marketappClient *marketapp.Client
}

func NewAggregatorService(ton *tonapi.Client, mapp *marketapp.Client) *AggregatorService {
	return &AggregatorService{
		tonClient:       ton,
		marketappClient: mapp,
	}
}

type CollectionSummary struct {
	TotalSupply    int     `json:"total_supply"`
	Holders        int     `json:"holders"`
	FloorPrice     string  `json:"floor_price"`
	TotalVolume    string  `json:"total_volume"`
	ActiveAuctions int     `json:"active_auctions"`
	Revenue        string  `json:"revenue"`
	DailyVolume    float64 `json:"daily_volume"`
	SalesCount     int     `json:"sales_count"`
	HighestSale    float64 `json:"highest_sale"`
	ListedRatio    float64 `json:"listed_ratio"`
}

func (s *AggregatorService) GetCollectionStats() (*CollectionSummary, error) {
	addr := tonapi.UsernamesCollectionAddr

	var summary CollectionSummary
	var mu sync.Mutex
	var wg sync.WaitGroup
	wg.Add(2)

	var errTon, errMapp error

	// Add 5 second timeout for external calls
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	go func() {
		defer wg.Done()
		
		if ctx.Err() != nil {
			errTon = ctx.Err()
			return
		}
		
		var err error
		if s.tonClient != nil {
			coll, errTonGet := s.tonClient.GetCollection(ctx, addr)
			if errTonGet == nil && coll != nil {
				mu.Lock()
				summary.TotalSupply = coll.NextItemIndex
				mu.Unlock()
			}
			err = errTonGet
		}
		mu.Lock()
		errTon = err
		mu.Unlock()
	}()

	go func() {
		defer wg.Done()
		
		if ctx.Err() != nil {
			errMapp = ctx.Err()
			return
		}
		
		var err error
		if s.marketappClient != nil {
			stats, errMappGet := s.marketappClient.GetCollection(ctx)
			if errMappGet == nil && stats != nil {
				mu.Lock()
				summary.FloorPrice = fmt.Sprintf("%.2f", stats.FloorPrice)
				summary.TotalVolume = fmt.Sprintf("%.2f", stats.TotalVolume)
				summary.Holders = stats.TotalOwners
				summary.ActiveAuctions = stats.ActiveAuctions
				summary.DailyVolume = stats.Volume24h
				summary.SalesCount = stats.SalesCount
				summary.HighestSale = stats.HighestSale
				summary.ListedRatio = stats.ListedRatio
				mu.Unlock()
			}
			err = errMappGet
		}
		mu.Lock()
		errMapp = err
		mu.Unlock()
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

	if errTon != nil && errMapp != nil {
		return nil, errTon
	}

	return &summary, nil
}
