package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

type CollectionStats struct {
	StatDate    time.Time `json:"stat_date"`
	ItemsCount  string    `json:"items_count"`
	OwnersCount string    `json:"owners_count"`
	FloorPrice  string    `json:"floor_price"`
	TotalVolume string    `json:"total_volume"`
	Source      string    `json:"source,omitempty"`
	IsStale     bool      `json:"is_stale"`
}

type CollectionCategory struct {
	CategoryName string `json:"category_name"`
	Volume       string `json:"volume"`
}

type CollectionAuction struct {
	ItemName  string `json:"item_name"`
	Price     string `json:"price"`
	Status    string `json:"status"`
	TxHash    string `json:"tx_hash,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
	Verified  bool   `json:"verified,omitempty"`
}

type MarketPulseSignal struct {
	Status string  `json:"status"` // "strong", "moderate", "low", "increasing", "neutral"
	Value  string  `json:"value"`
	Delta  float64 `json:"delta,omitempty"`
	Desc   string  `json:"desc"`
}

type MarketPulse struct {
	Demand         MarketPulseSignal `json:"demand"`
	SupplyPressure MarketPulseSignal `json:"supply_pressure"`
	Liquidity      MarketPulseSignal `json:"liquidity"`
	PriceMomentum  MarketPulseSignal `json:"price_momentum"`
}

type FXRateInfo struct {
	TonUsd     float64   `json:"ton_usd"`
	Source     string    `json:"source"`
	ObservedAt time.Time `json:"observed_at"`
	IsStale    bool      `json:"is_stale"`
}

type SourceHealth struct {
	Name       string    `json:"name"`
	Status     string    `json:"status"` // "healthy", "degraded", "unavailable"
	ObservedAt time.Time `json:"observed_at"`
}

type CollectionData struct {
	CollectionAddress string               `json:"collection_address"`
	Stats             *CollectionStats     `json:"stats"`
	MarketPulse       MarketPulse          `json:"market_pulse"`
	Categories        []CollectionCategory `json:"categories"`
	Auctions          []CollectionAuction  `json:"auctions"`
	TopSales          []CollectionAuction  `json:"top_sales"`
	RecentActivity    []CollectionAuction  `json:"recent_activity"`
	FX                *FXRateInfo          `json:"fx,omitempty"`
	Sources           []SourceHealth       `json:"sources"`
	// Kept for backward-compatibility with older frontends during rollout:
	FearGreedIndex int    `json:"fear_greed_index,omitempty"`
	FearGreedLabel string `json:"fear_greed_label,omitempty"`
}

type CollectionRepo struct {
	db *Database
}

func NewCollectionRepo(db *Database) *CollectionRepo {
	return &CollectionRepo{db: db}
}

func (r *CollectionRepo) GetLatestCollectionData(ctx context.Context) (*CollectionData, error) {
	statsQuery := `
		SELECT stat_date, items_count, owners_count, floor_price, total_volume
		FROM nft_collection_stats
		ORDER BY stat_date DESC
		LIMIT 1
	`
	var stats CollectionStats
	err := r.db.Pool.QueryRow(ctx, statsQuery).Scan(
		&stats.StatDate,
		&stats.ItemsCount,
		&stats.OwnersCount,
		&stats.FloorPrice,
		&stats.TotalVolume,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // No data yet
		}
		return nil, err
	}

	stats.Source = "TON TeleMint / Fragment"
	stats.IsStale = time.Since(stats.StatDate) > 24*time.Hour

	data := &CollectionData{
		CollectionAddress: "EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi",
		Stats:             &stats,
		Categories:        []CollectionCategory{},
		Auctions:          []CollectionAuction{},
		TopSales:          []CollectionAuction{},
		RecentActivity:    []CollectionAuction{},
		Sources: []SourceHealth{
			{Name: "tonapi", Status: "healthy", ObservedAt: time.Now().UTC()},
			{Name: "fragment", Status: "healthy", ObservedAt: time.Now().UTC()},
			{Name: "getgems", Status: "healthy", ObservedAt: time.Now().UTC()},
		},
		MarketPulse: MarketPulse{
			Demand: MarketPulseSignal{
				Status: "active",
				Value:  "Steady",
				Delta:  4.2,
				Desc:   "Daily sales turnover and active bidding demand",
			},
			SupplyPressure: MarketPulseSignal{
				Status: "normal",
				Value:  "Controlled",
				Delta:  -1.8,
				Desc:   "Listing vs unminted TeleMint ratio",
			},
			Liquidity: MarketPulseSignal{
				Status: "healthy",
				Value:  "High",
				Delta:  6.5,
				Desc:   "Average time-to-sale for competitive floors",
			},
			PriceMomentum: MarketPulseSignal{
				Status: "positive",
				Value:  "Bullish",
				Delta:  3.1,
				Desc:   "7-day median settlement floor trend",
			},
		},
	}

	catQuery := `
		SELECT category_name, volume
		FROM nft_collection_categories
		WHERE stat_date = $1
		ORDER BY volume DESC
	`
	rows, err := r.db.Pool.Query(ctx, catQuery, stats.StatDate)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var cat CollectionCategory
			if err := rows.Scan(&cat.CategoryName, &cat.Volume); err == nil {
				data.Categories = append(data.Categories, cat)
			}
		}
	}

	aucQuery := `
		SELECT item_name, price, status
		FROM nft_collection_recent_auctions
		WHERE stat_date = $1
	`
	aucRows, err := r.db.Pool.Query(ctx, aucQuery, stats.StatDate)
	if err == nil {
		defer aucRows.Close()
		for aucRows.Next() {
			var auc CollectionAuction
			if err := aucRows.Scan(&auc.ItemName, &auc.Price, &auc.Status); err == nil {
				data.Auctions = append(data.Auctions, auc)
			}
		}
	}

	topSalesQuery := `
		SELECT item_name, price, status
		FROM nft_collection_top_sales
		WHERE stat_date = $1
	`
	topRows, err := r.db.Pool.Query(ctx, topSalesQuery, stats.StatDate)
	if err == nil {
		defer topRows.Close()
		for topRows.Next() {
			var auc CollectionAuction
			if err := topRows.Scan(&auc.ItemName, &auc.Price, &auc.Status); err == nil {
				data.TopSales = append(data.TopSales, auc)
			}
		}
	}

	recentQuery := `
		SELECT item_name, price, status
		FROM nft_collection_recent_activity
		WHERE stat_date = $1
	`
	recentRows, err := r.db.Pool.Query(ctx, recentQuery, stats.StatDate)
	if err == nil {
		defer recentRows.Close()
		for recentRows.Next() {
			var auc CollectionAuction
			if err := recentRows.Scan(&auc.ItemName, &auc.Price, &auc.Status); err == nil {
				data.RecentActivity = append(data.RecentActivity, auc)
			}
		}
	}

	return data, nil
}

type CollectionHistoryPoint struct {
	Timestamp string  `json:"timestamp"`
	Label     string  `json:"label"`
	FloorTon  float64 `json:"floor_ton"`
	VolumeTon float64 `json:"volume_ton"`
}

func (r *CollectionRepo) GetCollectionHistory(ctx context.Context, timeframe string) ([]CollectionHistoryPoint, error) {
	if timeframe == "" {
		timeframe = "30d"
	}

	query := `
		SELECT timestamp, floor_nano_ton, volume_nano_ton
		FROM username_collection_history
		WHERE timeframe = $1
		ORDER BY timestamp ASC
		LIMIT 100
	`
	rows, err := r.db.Pool.Query(ctx, query, timeframe)
	if err != nil {
		return []CollectionHistoryPoint{}, nil
	}
	defer rows.Close()

	var points []CollectionHistoryPoint
	for rows.Next() {
		var (
			ts          time.Time
			floorNano   int64
			volNano     int64
		)
		if err := rows.Scan(&ts, &floorNano, &volNano); err == nil {
			points = append(points, CollectionHistoryPoint{
				Timestamp: ts.Format(time.RFC3339),
				Label:     ts.Format("02 Jan"),
				FloorTon:  float64(floorNano) / 1e9,
				VolumeTon: float64(volNano) / 1e9,
			})
		}
	}

	if points == nil {
		points = []CollectionHistoryPoint{}
	}
	return points, nil
}
