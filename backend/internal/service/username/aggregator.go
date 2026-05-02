package username

import (
	"ifragment-backend/internal/client/getgems"
	"ifragment-backend/internal/client/tonapi"
	"sync"
)

type AggregatorService struct {
	tonClient     *tonapi.Client
	getgemsClient *getgems.Client
}

func NewAggregatorService(ton *tonapi.Client, gg *getgems.Client) *AggregatorService {
	return &AggregatorService{
		tonClient:     ton,
		getgemsClient: gg,
	}
}

type CollectionSummary struct {
	TotalSupply int    `json:"total_supply"`
	Holders     int    `json:"holders"`
	FloorPrice  string `json:"floor_price"`
	TotalVolume string `json:"total_volume"`
}

func (s *AggregatorService) GetCollectionStats() (*CollectionSummary, error) {
	addr := tonapi.UsernamesCollectionAddr

	var summary CollectionSummary
	var wg sync.WaitGroup
	wg.Add(2)

	var errTon, errGg error

	go func() {
		defer wg.Done()
		coll, err := s.tonClient.GetCollection(addr)
		if err == nil {
			summary.TotalSupply = coll.NextItemIndex
		}
		errTon = err
	}()

	go func() {
		defer wg.Done()
		stats, err := s.getgemsClient.GetCollectionStats(addr)
		if err == nil {
			summary.FloorPrice = stats.Data.AlphaNftCollectionStats.FloorPrice
			summary.TotalVolume = stats.Data.AlphaNftCollectionStats.TotalVolume
			summary.Holders = stats.Data.AlphaNftCollectionStats.OwnersCount
		}
		errGg = err
	}()

	wg.Wait()

	// If both failed, return error. Otherwise, return what we have.
	if errTon != nil && errGg != nil {
		return nil, errTon
	}

	return &summary, nil
}
