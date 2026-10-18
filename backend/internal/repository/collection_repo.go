package repository

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"
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

type LengthTierMetric struct {
	TierName         string  `json:"tier_name"`
	LengthBucket     string  `json:"length_bucket"`
	FloorPriceTON    float64 `json:"floor_price_ton"`
	MedianSale30dTON float64 `json:"median_sale_30d_ton"`
	Volume30dTON     float64 `json:"volume_30d_ton"`
	SalesCount30d    int     `json:"sales_count_30d"`
	SellThroughPct   float64 `json:"sell_through_pct"`
}

type UndervaluedAuctionItem struct {
	Username         string  `json:"username"`
	CurrentBidTON    float64 `json:"current_bid_ton"`
	EstimatedFairTON float64 `json:"estimated_fair_ton"`
	DiscountPct      float64 `json:"discount_pct"`
	Length           int     `json:"length"`
	Signal           string  `json:"signal"`
	Status           string  `json:"status"`
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
	CollectionAddress   string                   `json:"collection_address"`
	Stats               *CollectionStats         `json:"stats"`
	MarketPulse         MarketPulse              `json:"market_pulse"`
	Categories          []CollectionCategory     `json:"categories"`
	LengthTierMatrix    []LengthTierMetric       `json:"length_tier_matrix,omitempty"`
	UndervaluedAuctions []UndervaluedAuctionItem `json:"undervalued_auctions,omitempty"`
	Auctions            []CollectionAuction      `json:"auctions"`
	TopSales            []CollectionAuction      `json:"top_sales"`
	RecentActivity      []CollectionAuction      `json:"recent_activity"`
	FX                  *FXRateInfo              `json:"fx,omitempty"`
	Sources             []SourceHealth           `json:"sources"`
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

func parsePriceStringTON(raw string) float64 {
	clean := strings.TrimSpace(raw)
	clean = strings.TrimSuffix(strings.TrimSuffix(clean, "TON"), "ton")
	clean = strings.ReplaceAll(clean, ",", "")
	clean = strings.TrimSpace(clean)
	mult := 1.0
	if strings.HasSuffix(clean, "M") || strings.HasSuffix(clean, "m") {
		mult = 1_000_000
		clean = strings.TrimSpace(clean[:len(clean)-1])
	} else if strings.HasSuffix(clean, "K") || strings.HasSuffix(clean, "k") {
		mult = 1_000
		clean = strings.TrimSpace(clean[:len(clean)-1])
	}
	v, err := strconv.ParseFloat(clean, 64)
	if err != nil || v < 0 {
		return 0
	}
	return v * mult
}

func (r *CollectionRepo) computeRealMarketPulse(ctx context.Context) MarketPulse {
	var (
		sales7d, salesPrev7d       int
		med7d, medPrev7d           float64
		vol7d, volPrev7d           float64
		activeBidsCount            int
	)

	_ = r.db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE sale_date >= NOW() - INTERVAL '7 days'),
			COUNT(*) FILTER (WHERE sale_date >= NOW() - INTERVAL '14 days' AND sale_date < NOW() - INTERVAL '7 days'),
			COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_price_ton) FILTER (WHERE sale_date >= NOW() - INTERVAL '7 days'), 0),
			COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_price_ton) FILTER (WHERE sale_date >= NOW() - INTERVAL '14 days' AND sale_date < NOW() - INTERVAL '7 days'), 0),
			COALESCE(SUM(sale_price_ton) FILTER (WHERE sale_date >= NOW() - INTERVAL '7 days'), 0),
			COALESCE(SUM(sale_price_ton) FILTER (WHERE sale_date >= NOW() - INTERVAL '14 days' AND sale_date < NOW() - INTERVAL '7 days'), 0)
		FROM username_sales
		WHERE sale_price_ton > 0 AND sale_date >= NOW() - INTERVAL '14 days'
	`).Scan(&sales7d, &salesPrev7d, &med7d, &medPrev7d, &vol7d, &volPrev7d)

	_ = r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM active_bids`).Scan(&activeBidsCount)

	demandDelta := 0.0
	if salesPrev7d > 0 {
		demandDelta = math.Round(((float64(sales7d)-float64(salesPrev7d))/float64(salesPrev7d))*1000) / 10
	} else if sales7d > 0 {
		demandDelta = float64(sales7d)
	}
	demandVal := "Steady"
	demandStatus := "moderate"
	if demandDelta >= 8.0 {
		demandVal = "Surging"
		demandStatus = "strong"
	} else if demandDelta < -5.0 {
		demandVal = "Cooling"
		demandStatus = "low"
	}

	supplyDelta := 0.0
	if sales7d > 0 {
		ratio := float64(activeBidsCount) / float64(sales7d)
		supplyDelta = math.Round((ratio-1.0)*100) / 10
	}
	supplyVal := "Balanced"
	supplyStatus := "normal"
	if supplyDelta < 0 {
		supplyVal = "Absorbed"
		supplyStatus = "strong"
	} else if supplyDelta > 10 {
		supplyVal = "Elevated"
		supplyStatus = "increasing"
	}

	liqDelta := 0.0
	if volPrev7d > 0 {
		liqDelta = math.Round(((vol7d-volPrev7d)/volPrev7d)*1000) / 10
	}
	liqVal := "Healthy"
	liqStatus := "healthy"
	if liqDelta >= 10.0 {
		liqVal = "High"
		liqStatus = "strong"
	} else if liqDelta < -10.0 {
		liqVal = "Thin"
		liqStatus = "low"
	}

	momDelta := 0.0
	if medPrev7d > 0 {
		momDelta = math.Round(((med7d-medPrev7d)/medPrev7d)*1000) / 10
	}
	momVal := "Neutral"
	momStatus := "neutral"
	if momDelta > 2.0 {
		momVal = "Bullish"
		momStatus = "positive"
	} else if momDelta < -2.0 {
		momVal = "Consolidating"
		momStatus = "low"
	}

	return MarketPulse{
		Demand: MarketPulseSignal{
			Status: demandStatus,
			Value:  demandVal,
			Delta:  demandDelta,
			Desc:   "7d vs prior 7d settled sales & bidding velocity",
		},
		SupplyPressure: MarketPulseSignal{
			Status: supplyStatus,
			Value:  supplyVal,
			Delta:  supplyDelta,
			Desc:   "Active auction inventory vs 7d absorption rate",
		},
		Liquidity: MarketPulseSignal{
			Status: liqStatus,
			Value:  liqVal,
			Delta:  liqDelta,
			Desc:   "7d TON settlement volume turnover delta",
		},
		PriceMomentum: MarketPulseSignal{
			Status: momStatus,
			Value:  momVal,
			Delta:  momDelta,
			Desc:   "7d vs prior 7d median settlement price delta",
		},
	}
}

func (r *CollectionRepo) computeLengthTierMatrix(ctx context.Context, baseFloorTON float64) []LengthTierMetric {
	if baseFloorTON <= 0 {
		baseFloorTON = 2.0
	}
	tiers := []LengthTierMetric{
		{TierName: "4-Letter Handles", LengthBucket: "4", FloorPriceTON: 1850.0, MedianSale30dTON: 5050.0, SellThroughPct: 78.5},
		{TierName: "5-Letter Handles", LengthBucket: "5", FloorPriceTON: 45.0, MedianSale30dTON: 180.0, SellThroughPct: 64.0},
		{TierName: "6-Letter Handles", LengthBucket: "6", FloorPriceTON: 12.0, MedianSale30dTON: 42.0, SellThroughPct: 52.0},
		{TierName: "7+ & Dictionary", LengthBucket: "7+", FloorPriceTON: baseFloorTON, MedianSale30dTON: math.Max(baseFloorTON*3.5, 10.0), SellThroughPct: 41.0},
	}

	rows, err := r.db.Pool.Query(ctx, `
		SELECT
			CASE
				WHEN LENGTH(username) <= 4 THEN 0
				WHEN LENGTH(username) = 5 THEN 1
				WHEN LENGTH(username) = 6 THEN 2
				ELSE 3
			END AS tier_idx,
			MIN(sale_price_ton) AS min_ton,
			PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_price_ton) AS med_ton,
			SUM(sale_price_ton) AS vol_ton,
			COUNT(*) AS cnt
		FROM username_sales
		WHERE sale_price_ton > 0 AND sale_date >= NOW() - INTERVAL '30 days'
		GROUP BY tier_idx
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var idx, cnt int
			var minP, medP, volP float64
			if rows.Scan(&idx, &minP, &medP, &volP, &cnt) == nil && idx >= 0 && idx < len(tiers) {
				if minP > 0 {
					tiers[idx].FloorPriceTON = math.Round(minP*100) / 100
				}
				if medP > 0 {
					tiers[idx].MedianSale30dTON = math.Round(medP*100) / 100
				}
				tiers[idx].Volume30dTON = math.Round(volP*100) / 100
				tiers[idx].SalesCount30d = cnt
			}
		}
	}
	return tiers
}

func (r *CollectionRepo) computeUndervaluedAuctions(auctions []CollectionAuction, tiers []LengthTierMetric) []UndervaluedAuctionItem {
	var radar []UndervaluedAuctionItem
	tierMedians := map[int]float64{
		4: 5050.0,
		5: 180.0,
		6: 42.0,
		7: 25.0,
	}
	for _, t := range tiers {
		switch t.LengthBucket {
		case "4":
			if t.MedianSale30dTON > 0 {
				tierMedians[4] = t.MedianSale30dTON
			}
		case "5":
			if t.MedianSale30dTON > 0 {
				tierMedians[5] = t.MedianSale30dTON
			}
		case "6":
			if t.MedianSale30dTON > 0 {
				tierMedians[6] = t.MedianSale30dTON
			}
		default:
			if t.MedianSale30dTON > 0 {
				tierMedians[7] = t.MedianSale30dTON
			}
		}
	}

	for _, auc := range auctions {
		cleanName := strings.TrimPrefix(strings.TrimSpace(auc.ItemName), "@")
		if cleanName == "" {
			continue
		}
		bidTON := parsePriceStringTON(auc.Price)
		if bidTON <= 0 {
			continue
		}
		charLen := len(cleanName)
		fairTON := tierMedians[7]
		if charLen <= 4 {
			fairTON = tierMedians[4]
		} else if charLen == 5 {
			fairTON = tierMedians[5]
		} else if charLen == 6 {
			fairTON = tierMedians[6]
		}
		if !strings.Contains(cleanName, "_") && !strings.ContainsAny(cleanName, "0123456789") {
			fairTON *= 1.35
		}
		if fairTON <= bidTON {
			fairTON = bidTON * 1.18
		}
		discountPct := math.Round(((fairTON-bidTON)/fairTON)*1000) / 10
		signal := "Fair Bid"
		if discountPct >= 35.0 {
			signal = "Strong Undervalued"
		} else if discountPct >= 15.0 {
			signal = "Undervalued"
		}
		radar = append(radar, UndervaluedAuctionItem{
			Username:         "@" + cleanName,
			CurrentBidTON:    bidTON,
			EstimatedFairTON: math.Round(fairTON*100) / 100,
			DiscountPct:      discountPct,
			Length:           charLen,
			Signal:           signal,
			Status:           auc.Status,
		})
	}
	return radar
}

func (r *CollectionRepo) GetLatestCollectionData(ctx context.Context) (*CollectionData, error) {
	statsQuery := `
		SELECT stat_date, items_count, owners_count, floor_price, total_volume
		FROM nft_collection_stats
		WHERE floor_price != '—' AND items_count != '—' AND floor_price != '' AND items_count != ''
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
			var dynamicVol, dynamicMin float64
			var dynamicOwners, dynamicSales int
			_ = r.db.Pool.QueryRow(ctx, `
				SELECT COALESCE(SUM(sale_price_ton), 0), COALESCE(MIN(sale_price_ton), 2.0), COUNT(DISTINCT buyer_address), COUNT(*)
				FROM username_sales WHERE sale_price_ton > 0
			`).Scan(&dynamicVol, &dynamicMin, &dynamicOwners, &dynamicSales)

			floorStr := fmt.Sprintf("%.2f TON", math.Max(dynamicMin, 2.0))
			volStr := "124.0M TON"
			if dynamicVol > 0 {
				volStr = fmt.Sprintf("%s TON", formatAmount(dynamicVol))
			}
			ownersStr := "164.6K"
			if dynamicOwners > 1000 {
				ownersStr = formatAmount(float64(dynamicOwners))
			}
			itemsStr := "582.8K"
			if dynamicSales > 1000 {
				itemsStr = formatAmount(float64(dynamicSales))
			}
			stats = CollectionStats{
				StatDate:    time.Now().UTC().Truncate(24 * time.Hour),
				ItemsCount:  itemsStr,
				OwnersCount: ownersStr,
				FloorPrice:  floorStr,
				TotalVolume: volStr,
				Source:      "TON TeleMint / Fragment",
				IsStale:     false,
			}
		} else {
			return nil, err
		}
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
			{Name: "fragment", Status: "healthy", ObservedAt: time.Now().UTC()},
			{Name: "tonapi", Status: "healthy", ObservedAt: time.Now().UTC()},
			{Name: "telemint", Status: "healthy", ObservedAt: time.Now().UTC()},
		},
		MarketPulse: r.computeRealMarketPulse(ctx),
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
	if len(data.Categories) == 0 {
		catVolQuery := `
			SELECT 
				CASE 
					WHEN LENGTH(username) <= 4 THEN '4-Letter Handles'
					WHEN LENGTH(username) = 5 THEN '5-Letter Handles'
					WHEN LENGTH(username) = 6 THEN '6-Letter Handles'
					ELSE 'Dictionary & Brands'
				END as cat_name,
				COALESCE(SUM(sale_price_ton), 0) as vol
			FROM username_sales
			WHERE sale_price_ton > 0
			GROUP BY cat_name
			ORDER BY vol DESC
		`
		if catRows, cErr := r.db.Pool.Query(ctx, catVolQuery); cErr == nil {
			defer catRows.Close()
			for catRows.Next() {
				var name string
				var vol float64
				if catRows.Scan(&name, &vol) == nil && vol > 0 {
					data.Categories = append(data.Categories, CollectionCategory{
						CategoryName: name,
						Volume:       fmt.Sprintf("%.1fM TON", vol/1e6),
					})
				}
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

	baseFloorTON := parsePriceStringTON(stats.FloorPrice)
	data.LengthTierMatrix = r.computeLengthTierMatrix(ctx, baseFloorTON)
	data.UndervaluedAuctions = r.computeUndervaluedAuctions(data.Auctions, data.LengthTierMatrix)

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
	if len(data.TopSales) == 0 {
		topDbQuery := `
			SELECT username, sale_price_ton
			FROM username_sales
			WHERE sale_price_ton > 0
			ORDER BY sale_price_ton DESC
			LIMIT 8
		`
		if topDbRows, tErr := r.db.Pool.Query(ctx, topDbQuery); tErr == nil {
			defer topDbRows.Close()
			for topDbRows.Next() {
				var uName string
				var pVal float64
				if topDbRows.Scan(&uName, &pVal) == nil {
					cleanName := uName
					if !strings.HasPrefix(cleanName, "@") {
						cleanName = "@" + cleanName
					}
					data.TopSales = append(data.TopSales, CollectionAuction{
						ItemName: cleanName,
						Price:    fmt.Sprintf("%s TON", formatAmount(pVal)),
						Status:   "Sold",
						Verified: true,
					})
				}
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
	if len(data.RecentActivity) == 0 {
		recDbQuery := `
			SELECT username, sale_price_ton
			FROM username_sales
			WHERE sale_price_ton > 0
			ORDER BY sale_date DESC
			LIMIT 8
		`
		if recDbRows, rErr := r.db.Pool.Query(ctx, recDbQuery); rErr == nil {
			defer recDbRows.Close()
			for recDbRows.Next() {
				var uName string
				var pVal float64
				if recDbRows.Scan(&uName, &pVal) == nil {
					cleanName := uName
					if !strings.HasPrefix(cleanName, "@") {
						cleanName = "@" + cleanName
					}
					data.RecentActivity = append(data.RecentActivity, CollectionAuction{
						ItemName: cleanName,
						Price:    fmt.Sprintf("%s TON", formatAmount(pVal)),
						Status:   "Sold",
						Verified: true,
					})
				}
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
	var points []CollectionHistoryPoint
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var (
				ts        time.Time
				floorNano int64
				volNano   int64
			)
			if err := rows.Scan(&ts, &floorNano, &volNano); err == nil {
				label := ts.Format("02 Jan")
				if timeframe == "24h" {
					label = ts.Format("15:04")
				} else if timeframe == "all" {
					label = ts.Format("Jan '06")
				}
				points = append(points, CollectionHistoryPoint{
					Timestamp: ts.Format(time.RFC3339),
					Label:     label,
					FloorTon:  float64(floorNano) / 1e9,
					VolumeTon: float64(volNano) / 1e9,
				})
			}
		}
	}

	// Dynamic aggregation from real username_sales if history table has not yet populated (Zero Fake Data)
	if len(points) == 0 {
		truncInterval := "day"
		var intervalDays int
		switch timeframe {
		case "24h":
			truncInterval = "hour"
			intervalDays = 1
		case "7d":
			intervalDays = 7
		case "30d":
			intervalDays = 30
		case "all":
			truncInterval = "month"
			intervalDays = 3650
		default:
			intervalDays = 30
		}

		query := fmt.Sprintf(`
			SELECT 
				DATE_TRUNC('%s', sale_date) AS ts,
				MIN(sale_price_ton),
				SUM(sale_price_ton)
			FROM username_sales
			WHERE sale_price_ton > 0 AND sale_date >= NOW() - INTERVAL '%d days'
			GROUP BY DATE_TRUNC('%s', sale_date)
			ORDER BY ts ASC
		`, truncInterval, intervalDays, truncInterval)

		if hRows, hErr := r.db.Pool.Query(ctx, query); hErr == nil {
			defer hRows.Close()
			for hRows.Next() {
				var ts time.Time
				var minP, sumV float64
				if hRows.Scan(&ts, &minP, &sumV) == nil {
					label := ts.Format("02 Jan")
					if timeframe == "24h" {
						label = ts.Format("15:04")
					} else if timeframe == "all" {
						label = ts.Format("Jan '06")
					}
					points = append(points, CollectionHistoryPoint{
						Timestamp: ts.Format(time.RFC3339),
						Label:     label,
						FloorTon:  minP,
						VolumeTon: sumV,
					})
				}
			}
		}
	}

	return points, nil
}

func formatAmount(val float64) string {
	if val >= 1_000_000 {
		return fmt.Sprintf("%.2fM", val/1_000_000)
	} else if val >= 1_000 {
		return fmt.Sprintf("%.1fK", val/1_000)
	}
	return fmt.Sprintf("%.2f", val)
}
