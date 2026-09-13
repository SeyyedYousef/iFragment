package gifts

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/gifts/giftchanges"
	"ifragment-backend/internal/service/gifts/traits"
	"ifragment-backend/internal/service/gifts/venues"
)

// CollectionListItem represents a gift collection in summary
type CollectionListItem struct {
	Slug        string   `json:"slug"`
	Name        string   `json:"name"`
	ImageURL    string   `json:"image_url,omitempty"`
	TotalSupply *int     `json:"total_supply"`
	FloorGRAM   *float64 `json:"floor_gram"`
}

// CollectionIntelResponse represents comprehensive collection intelligence
type BackdropSummary struct {
	Name           string `json:"name"`
	RarityPermille int    `json:"rarity_permille"`
	CenterHex      string `json:"center_hex"`
	EdgeHex        string `json:"edge_hex"`
	PatternHex     string `json:"pattern_hex"`
	TextHex        string `json:"text_hex"`
}

type SymbolSummary struct {
	Name           string `json:"name"`
	RarityPermille int    `json:"rarity_permille"`
	TotalSupply    *int   `json:"total_supply"`
	RarityStatus   string `json:"rarity_status,omitempty"` // "estimated", "verified"
}

type FloorItemSummary struct {
	Rank         int      `json:"rank"`
	SerialNumber int      `json:"serial_number"`
	ModelName    string   `json:"model_name"`
	SymbolName   string   `json:"symbol_name"`
	BackdropName string   `json:"backdrop_name"`
	CenterHex    string   `json:"center_hex,omitempty"`
	EdgeHex      string   `json:"edge_hex,omitempty"`
	PriceGRAM    *float64 `json:"price_gram"`
	PriceUSD     *float64 `json:"price_usd"`
	VenueName    string   `json:"venue_name"`
	BuyURL       string   `json:"buy_url,omitempty"`
	ListingID    string   `json:"listing_id,omitempty"`
	ObservedAt   string   `json:"observed_at,omitempty"`
}

type MarketSalesSourceBreakdown struct {
	VenueName  string   `json:"venue_name"`
	VolumeGRAM float64  `json:"volume_gram"`
	VolumeUSD  *float64 `json:"volume_usd"`
	DealsCount int      `json:"deals_count"`
}

type MarketSalesMetricPeriod struct {
	VolumeGRAM float64                      `json:"volume_gram"`
	VolumeUSD  *float64                     `json:"volume_usd"`
	MinGRAM    *float64                     `json:"min_gram"`
	MinUSD     *float64                     `json:"min_usd"`
	AvgGRAM    *float64                     `json:"avg_gram"`
	AvgUSD     *float64                     `json:"avg_usd"`
	MaxGRAM    *float64                     `json:"max_gram"`
	MaxUSD     *float64                     `json:"max_usd"`
	DealsCount int                          `json:"deals_count"`
	BySource   []MarketSalesSourceBreakdown `json:"by_source"`
}

type MarketSalesStats struct {
	Period24h MarketSalesMetricPeriod `json:"period_24h"`
	Period7d  MarketSalesMetricPeriod `json:"period_7d"`
	Period30d MarketSalesMetricPeriod `json:"period_30d"`
}

type OnSaleMarketplaceBreakdown struct {
	VenueName string   `json:"venue_name"`
	FloorGRAM *float64 `json:"floor_gram"`
	FloorUSD  *float64 `json:"floor_usd"`
	Count     *int     `json:"count"`
	Status    string   `json:"status"` // "live", "delayed", "stale", "unavailable"
}

type OnSaleStats struct {
	TotalCount    int                          `json:"total_count"`
	FloorGRAM     *float64                     `json:"floor_gram"`
	FloorUSD      *float64                     `json:"floor_usd"`
	ByMarketplace []OnSaleMarketplaceBreakdown `json:"by_marketplace"`
}

type SalesHistoryItem struct {
	Rank         int      `json:"rank"`
	SerialNumber int      `json:"serial_number"`
	ModelName    string   `json:"model_name"`
	SymbolName   string   `json:"symbol_name"`
	BackdropName string   `json:"backdrop_name"`
	CenterHex    string   `json:"center_hex,omitempty"`
	PriceGRAM    float64  `json:"price_gram"`
	PriceUSD     *float64 `json:"price_usd"`
	ExchangeRate *float64 `json:"exchange_rate"`
	VenueName    string   `json:"venue_name"`
	SaleDate     string   `json:"sale_date"`
	TxHash       string   `json:"tx_hash,omitempty"`
	EventIndex   int      `json:"event_index,omitempty"`
}

type CatalogSearchItem struct {
	SerialNumber int      `json:"serial_number"`
	ModelName    string   `json:"model_name"`
	SymbolName   string   `json:"symbol_name"`
	BackdropName string   `json:"backdrop_name"`
	CenterHex    string   `json:"center_hex,omitempty"`
	IsOnSale     bool     `json:"is_on_sale"`
	PriceGRAM    *float64 `json:"price_gram,omitempty"`
	PriceUSD     *float64 `json:"price_usd,omitempty"`
	VenueName    string   `json:"venue_name,omitempty"`
	RarityScore  float64  `json:"rarity_score"`
}

type CollectionIntelResponse struct {
	CollectionID        string  `json:"collection_id"`
	CollectionName      string  `json:"collection_name"`
	CollectionSlug      string  `json:"collection_slug"`
	ContractAddress     string  `json:"contract_address,omitempty"`
	LottieURL           string  `json:"lottie_url,omitempty"`
	ImageURL            string  `json:"image_url,omitempty"`
	TotalSupply         *int    `json:"total_supply"`
	UpgradedCount       *int    `json:"upgraded_count"`
	UpgradedCountStatus string  `json:"upgraded_count_status,omitempty"`
	IsLimited           bool    `json:"is_limited"`
	IsCraftable         bool    `json:"is_craftable"`
	ReleaseDate         string  `json:"release_date"`
	UpgradeEnabledDate  string  `json:"upgrade_enabled_date,omitempty"`

	// Trait Counts
	TotalModels    int               `json:"total_models"`
	TotalBackdrops int               `json:"total_backdrops"`
	TotalSymbols   int               `json:"total_symbols"`
	BackdropsList  []BackdropSummary `json:"backdrops_list,omitempty"`
	SymbolsList    []SymbolSummary   `json:"symbols_list,omitempty"`

	// Market Pulse
	BestFloorGRAM  *float64 `json:"best_floor_gram"`
	BestFloorUSD   *float64 `json:"best_floor_usd"`
	BestFloorVenue *string  `json:"best_floor_venue"`
	Change24hPct   float64  `json:"change_24h_pct"`
	Change7dPct    float64  `json:"change_7d_pct"`
	Change30dPct   float64  `json:"change_30d_pct"`
	Volume24hGRAM  float64  `json:"volume_24h_gram"`
	Volume24hUSD   *float64 `json:"volume_24h_usd"`
	MarketCapGRAM  *float64 `json:"market_cap_gram"`
	MarketCapUSD   *float64 `json:"market_cap_usd"`
	FDVGRAM        *float64 `json:"fdv_gram,omitempty"`
	FDVUSD         *float64 `json:"fdv_usd,omitempty"`
	ListedCount    int      `json:"listed_count"`
	LiquidityRatio float64  `json:"liquidity_ratio"`

	// Sub-sections
	ModelFloors    []CollectionModelFloor `json:"model_floors"`
	RarityHeatmap  []RarityHeatmapCell    `json:"rarity_heatmap"`
	VenueFloors    []MarketVenueFloor     `json:"venue_floors"`
	Arbitrage      *CrossMarketArbitrage  `json:"arbitrage,omitempty"`
	Whales         []WhaleProfile         `json:"whales"`
	RecentActivity []MarketActivityItem   `json:"recent_activity"`
	FearGreed      FearGreedData          `json:"fear_greed"`
	UpgradeLadder  []UpgradeStepInfo      `json:"upgrade_ladder"`
	FloorHistory   []FloorHistoryPoint    `json:"floor_history"`

	// Extended Screenshot-based Intelligence
	FloorItem        *FloorItemSummary   `json:"floor_item,omitempty"`
	TopFloorItems    []FloorItemSummary  `json:"top_floor_items"`
	MarketSalesStats MarketSalesStats    `json:"market_sales_stats"`
	OnSaleStats      OnSaleStats         `json:"on_sale_stats"`
	SalesHistory     []SalesHistoryItem  `json:"sales_history"`
	SearchItems      []CatalogSearchItem `json:"search_items"`

	// Attribution & metadata
	MetadataSource        string   `json:"metadata_source"`
	PriceSource           string   `json:"price_source"`
	DataSourceAttribution string   `json:"data_source_attribution"`
	DataStatus            string   `json:"data_status"` // "live", "delayed", "stale", "unavailable"
	DataSources           []string `json:"data_sources"`
	SourceTimestamp       string   `json:"source_timestamp,omitempty"`
	AgeSeconds            int      `json:"age_seconds,omitempty"`
	UpdatedAt             string   `json:"updated_at"`
}

type CollectionModelFloor struct {
	ModelID        string   `json:"model_id"`
	ModelName      string   `json:"model_name"`
	RarityPermille int      `json:"rarity_permille"`
	TotalSupply    *int     `json:"total_supply"`
	UpgradedCount  *int     `json:"upgraded_count"`
	FloorGRAM      *float64 `json:"floor_gram"`
	FloorUSD       *float64 `json:"floor_usd"`
	CustomEmojiID  string   `json:"custom_emoji_id,omitempty"`
	DataStatus     string   `json:"data_status"` // "live", "unavailable"
}

type RarityHeatmapCell struct {
	ModelID           string   `json:"model_id"`
	ModelName         string   `json:"model_name"`
	BackdropName      string   `json:"backdrop_name"`
	SymbolID          string   `json:"symbol_id,omitempty"`
	SymbolName        string   `json:"symbol_name,omitempty"`
	CombinedRarity    float64  `json:"combined_rarity_pct"`
	RarityTier        string   `json:"rarity_tier"`
	FloorGRAM         *float64 `json:"floor_gram"`
	RarityStatus      string   `json:"rarity_status,omitempty"`
	CalculationMethod string   `json:"calculation_method,omitempty"`
}

type MarketVenueFloor struct {
	VenueID       string   `json:"venue_id"`
	VenueName     string   `json:"venue_name"`
	FloorGRAM     *float64 `json:"floor_gram"`
	FloorUSD      *float64 `json:"floor_usd"`
	Currency      string   `json:"currency"`
	FeePct        float64  `json:"fee_pct"`
	NetPayoutGRAM *float64 `json:"net_payout_gram"`
	IsOnChain     bool     `json:"is_on_chain"`
	DataStatus    string   `json:"data_status"` // "live", "delayed", "stale", "unavailable"
	AgeSeconds    int      `json:"age_seconds"`
}

type CrossMarketArbitrage struct {
	BuyVenue      string  `json:"buy_venue"`
	BuyPriceGRAM  float64 `json:"buy_price_gram"`
	SellVenue     string  `json:"sell_venue"`
	SellPriceGRAM float64 `json:"sell_price_gram"`
	SpreadPct     float64 `json:"spread_pct"`
	NetProfitGRAM float64 `json:"net_profit_gram"`
	NetProfitUSD  float64 `json:"net_profit_usd"`
}

type WhaleProfile struct {
	Rank             int     `json:"rank"`
	OwnerAddress     string  `json:"owner_address"`
	DisplayName      string  `json:"display_name,omitempty"`
	TelegramUsername string  `json:"telegram_username,omitempty"`
	HoldingsCount    int     `json:"holdings_count"`
	TotalValueGRAM   float64 `json:"total_value_gram"`
	TotalValueUSD    float64 `json:"total_value_usd"`
	Classification   string  `json:"classification"` // "diamond_hands", "flipper", "accumulator"
	Change24hCount   int     `json:"change_24h_count"`
	AvgHoldDays      int     `json:"avg_hold_days"`
}

type MarketActivityItem struct {
	ActivityType string   `json:"activity_type"` // "sale", "listing", "upgrade", "craft", "transfer", "delist"
	GiftID       string   `json:"gift_id"`
	ModelName    string   `json:"model_name"`
	SerialNumber int      `json:"serial_number"`
	PriceGRAM    *float64 `json:"price_gram,omitempty"`
	PriceUSD     *float64 `json:"price_usd,omitempty"`
	Venue        string   `json:"venue,omitempty"`
	FromAddress  string   `json:"from_address,omitempty"`
	ToAddress    string   `json:"to_address,omitempty"`
	Timestamp    string   `json:"timestamp"`
}

type FearGreedData struct {
	Index                 int     `json:"index"`
	Label                 string  `json:"label"`
	VolumeComponent       float64 `json:"volume_component"`
	PriceComponent        float64 `json:"price_component"`
	ListingRatioComponent float64 `json:"listing_ratio_component"`
	OnChainComponent      float64 `json:"on_chain_component"`
	PreviousIndex         int     `json:"previous_index"`
	Trend                 string  `json:"trend"` // "rising", "falling", "stable"
}

type UpgradeStepInfo struct {
	Step                  int      `json:"step"`
	PriceStars            int      `json:"price_stars"`
	PriceGRAM             float64  `json:"price_gram"`
	PriceUSD              *float64 `json:"price_usd"`
	EffectiveAt           string   `json:"effective_at"`
	IsCurrent             bool     `json:"is_current"`
	SavingsVsCurrentStars int      `json:"savings_vs_current_stars"`
}

type FloorHistoryPoint struct {
	Timestamp      string             `json:"timestamp"`
	FloorGRAM      float64            `json:"floor_gram"`
	VenueBreakdown map[string]float64 `json:"venue_breakdown,omitempty"`
}

// ListCollections returns catalog of available official Telegram gift collections
func (s *GiftsService) ListCollections(ctx context.Context) ([]CollectionListItem, error) {
	allCols := traits.GetGlobalCatalog().GetAllCollections()
	var list []CollectionListItem

	for _, col := range allCols {
		var ts *int
		if col.TotalSupply > 0 {
			v := col.TotalSupply
			ts = &v
		}
		list = append(list, CollectionListItem{
			Slug:        col.ModelID,
			Name:        col.Name,
			ImageURL:    fmt.Sprintf("/api/v1/gifts/image/%s", col.ModelID),
			TotalSupply: ts,
			FloorGRAM:   nil, // Live floor resolved dynamically on collection detail page
		})
	}
	return list, nil
}

// GetCollectionIntel computes deep intelligence for a gift collection with verified real market sources
func (s *GiftsService) GetCollectionIntel(ctx context.Context, slug string) (*CollectionIntelResponse, error) {
	normSlug := strings.ToLower(strings.TrimSpace(slug))
	normSlug = strings.ReplaceAll(normSlug, " ", "-")
	normSlug = strings.ReplaceAll(normSlug, "_", "-")
	underscoreSlug := strings.ReplaceAll(normSlug, "-", "_")

	cacheKey := fmt.Sprintf("gifts:intel:col:%s", normSlug)
	if s.cache != nil {
		if cachedJSON, err := s.cache.Client.Get(ctx, cacheKey).Result(); err == nil && cachedJSON != "" {
			var snap CollectionIntelResponse
			if err := json.Unmarshal([]byte(cachedJSON), &snap); err == nil {
				return &snap, nil
			}
		}
	}

	col, exists := traits.ResolveCollection(normSlug)
	if !exists {
		col, exists = traits.ResolveCollection(underscoreSlug)
	}

	collectionName := traits.NormalizeSlug(normSlug)
	var totalSupply *int
	isLimited := false
	isCraftable := false
	contractID := ""

	if exists {
		collectionName = col.Name
		if col.TotalSupply > 0 {
			ts := col.TotalSupply
			totalSupply = &ts
		}
		isCraftable = col.CraftedFlag
		isLimited = col.LimitedFlag
		contractID = col.ContractID
	}

	// 1. Fetch live metadata from api.changes.tg if available
	var liveDetail *giftchanges.GiftDetail
	metadataSource := "GiftChanges (api.changes.tg)"
	if s.giftchangesClient != nil {
		if detail, err := s.giftchangesClient.GetGiftDetail(ctx, normSlug); err == nil && detail != nil {
			liveDetail = detail
			if liveDetail.Gift.Name != "" {
				collectionName = liveDetail.Gift.Name
			}
			if liveDetail.Gift.ID != "" {
				contractID = liveDetail.Gift.ID
			}
			if liveDetail.Gift.TotalSupply > 0 {
				ts := liveDetail.Gift.TotalSupply
				totalSupply = &ts
			}
			isCraftable = liveDetail.Gift.Craftable
			isLimited = liveDetail.Gift.Limited
		}
	}

	// Live TON/USD rate from crypto price service (Strictly nullable - no static 1.335 fallback)
	var gramRate *float64
	if s.cryptoPrice != nil {
		if rate, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && rate > 0 {
			r := rate
			gramRate = &r
		}
	}

	var upgradedCount *int
	upgradedCountStatus := "unavailable"
	if liveDetail != nil && liveDetail.Gift.UpgradedCount > 0 {
		uc := liveDetail.Gift.UpgradedCount
		upgradedCount = &uc
		upgradedCountStatus = "live"
	}

	totalModels := 0
	totalBackdrops := 0
	totalSymbols := 0
	var backdropsList []BackdropSummary

	if liveDetail != nil {
		totalModels = len(liveDetail.Models)
		totalBackdrops = len(liveDetail.Backdrops)
		totalSymbols = len(liveDetail.Symbols)
		for _, b := range liveDetail.Backdrops {
			backdropsList = append(backdropsList, BackdropSummary{
				Name:           b.Name,
				RarityPermille: b.GetRarityPermille(),
				CenterHex:      b.Hex.GetCenter(),
				EdgeHex:        b.Hex.GetEdge(),
				PatternHex:     b.Hex.GetPattern(),
				TextHex:        b.Hex.GetText(),
			})
		}
	}

	var symbolsList []SymbolSummary
	if liveDetail != nil && len(liveDetail.Symbols) > 0 {
		for _, sym := range liveDetail.Symbols {
			rPerm := sym.GetRarityPermille()
			var sSupply *int
			if totalSupply != nil && *totalSupply > 0 {
				sCount := int(float64(*totalSupply) * float64(rPerm) / 1000.0)
				if sCount <= 0 {
					sCount = 1
				}
				sSupply = &sCount
			}
			symbolsList = append(symbolsList, SymbolSummary{
				Name:           sym.Name,
				RarityPermille: rPerm,
				TotalSupply:    sSupply,
				RarityStatus:   "estimated",
			})
		}
	}

	// Fetch live custom emoji IDs for models
	emojiMap := make(map[string]string)
	if s.giftchangesClient != nil {
		if emojis, err := s.giftchangesClient.GetGiftEmojis(ctx, normSlug); err == nil {
			for _, em := range emojis {
				emojiMap[em.Name] = em.CustomEmojiID
			}
		}
	}

	// Fetch official release and upgrade dates
	releaseDate := ""
	upgradeDate := ""
	if s.giftchangesClient != nil {
		if dates, err := s.giftchangesClient.GetDates(ctx); err == nil && contractID != "" {
			for _, d := range dates {
				if d.ID == contractID {
					if d.ReleasedAt > 0 {
						releaseDate = time.Unix(d.ReleasedAt, 0).UTC().Format(time.RFC3339)
					}
					if d.UpgradableAt != nil && *d.UpgradableAt > 0 {
						upgradeDate = time.Unix(*d.UpgradableAt, 0).UTC().Format(time.RFC3339)
					}
					break
				}
			}
		}
	}

	// Read REAL venue snapshots from database
	dbSnapshots := make(map[string]repository.VenueSnapshotRecord)
	if s.repo != nil {
		if snaps, err := s.repo.GetVenueSnapshots(ctx, normSlug); err == nil && len(snaps) > 0 {
			for _, snap := range snaps {
				dbSnapshots[snap.Venue] = snap
			}
		} else if snaps, err := s.repo.GetVenueSnapshots(ctx, underscoreSlug); err == nil && len(snaps) > 0 {
			for _, snap := range snaps {
				dbSnapshots[snap.Venue] = snap
			}
		}
	}

	var venueFloors []MarketVenueFloor
	bestFloor := math.MaxFloat64
	bestVenue := ""
	highestFloor := 0.0
	highestVenue := ""
	liveVenueCount := 0
	var priceSources []string
	now := time.Now().UTC()

	for vID, vInfo := range venues.Registry {
		var vf *float64
		var floorUSD *float64
		var net *float64
		status := "unavailable"
		ageSec := 0

		if snap, ok := dbSnapshots[string(vID)]; ok {
			age := now.Sub(snap.UpdatedAt)
			ageSec = int(age.Seconds())

			// Freshness Policy:
			// < 5m: live
			// 5m - 30m: delayed
			// 30m - 6h: stale
			// > 6h: unavailable (strictly omitted from active floor)
			if age < 5*time.Minute {
				status = "live"
			} else if age < 30*time.Minute {
				status = "delayed"
			} else if age < 6*time.Hour {
				status = "stale"
			} else {
				status = "unavailable"
			}

			if status != "unavailable" {
				if snapFloor, _ := snap.FloorPriceGRAM.Float64(); snapFloor > 0 {
					f := round2(snapFloor)
					vf = &f
					if status == "live" {
						liveVenueCount++
					}
					priceSources = append(priceSources, vInfo.Name)
				}
			}
		}

		if vf != nil && *vf > 0 {
			netVal := round2(*vf * (1.0 - (vInfo.ProtocolFeePct / 100.0)))
			net = &netVal
			if gramRate != nil && *gramRate > 0 {
				usdVal := round2(*vf * *gramRate)
				floorUSD = &usdVal
			}
			if *vf < bestFloor {
				bestFloor = *vf
				bestVenue = vInfo.Name
			}
			if *vf > highestFloor {
				highestFloor = *vf
				highestVenue = vInfo.Name
			}
		}

		venueFloors = append(venueFloors, MarketVenueFloor{
			VenueID:       string(vID),
			VenueName:     vInfo.Name,
			FloorGRAM:     vf,
			FloorUSD:      floorUSD,
			Currency:      vInfo.Currency,
			FeePct:        vInfo.ProtocolFeePct,
			NetPayoutGRAM: net,
			IsOnChain:     vID == venues.VenueFragment || vID == venues.VenueGetgems,
			DataStatus:    status,
			AgeSeconds:    ageSec,
		})
	}

	var bestFloorGRAM *float64
	var bestFloorUSD *float64
	var bestFloorVenue *string

	if bestFloor < math.MaxFloat64 && bestFloor > 0 {
		bf := bestFloor
		bestFloorGRAM = &bf
		bv := bestVenue
		bestFloorVenue = &bv
		if gramRate != nil && *gramRate > 0 {
			bfUSD := round2(bestFloor * *gramRate)
			bestFloorUSD = &bfUSD
		}
	}

	// Arbitrage computation (only between venues with real live/fresh data)
	var arb *CrossMarketArbitrage
	if liveVenueCount >= 2 && bestFloorGRAM != nil && highestFloor > *bestFloorGRAM && *bestFloorGRAM > 0 {
		spread := ((highestFloor - *bestFloorGRAM) / *bestFloorGRAM) * 100.0
		netProfit := highestFloor*0.95 - *bestFloorGRAM
		if netProfit > 0 {
			netUSD := 0.0
			if gramRate != nil && *gramRate > 0 {
				netUSD = round2(netProfit * *gramRate)
			}
			arb = &CrossMarketArbitrage{
				BuyVenue:      bestVenue,
				BuyPriceGRAM:  *bestFloorGRAM,
				SellVenue:     highestVenue,
				SellPriceGRAM: highestFloor,
				SpreadPct:     round2(spread),
				NetProfitGRAM: round2(netProfit),
				NetProfitUSD:  netUSD,
			}
		}
	}

	// Model floors: Computed strictly from real model listings when indexed, not artificial multipliers
	var modelFloors []CollectionModelFloor
	if liveDetail != nil && len(liveDetail.Models) > 0 {
		for i, m := range liveDetail.Models {
			rPermille := m.GetRarityPermille()
			var mSupply *int
			if m.TotalSupply > 0 {
				s := m.TotalSupply
				mSupply = &s
			} else if totalSupply != nil && *totalSupply > 0 {
				s := int(float64(*totalSupply) * float64(rPermille) / 1000.0)
				if s <= 0 {
					s = 1
				}
				mSupply = &s
			}

			// Do not multiply collection floor by hardcoded multipliers.
			// Set Floor to nil with unavailable status unless actual listing exists for this model.
			modelFloors = append(modelFloors, CollectionModelFloor{
				ModelID:        fmt.Sprintf("%s_%d", normSlug, i+1),
				ModelName:      m.Name,
				RarityPermille: rPermille,
				TotalSupply:    mSupply,
				UpgradedCount:  nil,
				FloorGRAM:      nil,
				FloorUSD:       nil,
				CustomEmojiID:  emojiMap[m.Name],
				DataStatus:     "unavailable",
			})
		}
	}

	// 3-Axis Rarity Heatmap (Model × Backdrop)
	var heatmap []RarityHeatmapCell
	if liveDetail != nil && len(liveDetail.Models) > 0 && len(liveDetail.Backdrops) > 0 {
		for _, m := range liveDetail.Models {
			mPerm := m.GetRarityPermille()
			if mPerm <= 0 {
				mPerm = 20
			}
			mProb := float64(mPerm) / 1000.0

			for _, b := range liveDetail.Backdrops {
				bPerm := b.GetRarityPermille()
				if bPerm <= 0 {
					bPerm = 20
				}
				bProb := float64(bPerm) / 1000.0

				combRarityPct := round2(mProb * bProb * 100.0)
				tier := "Common"
				if combRarityPct <= 0.05 {
					tier = "Mythic"
				} else if combRarityPct <= 0.2 {
					tier = "Legendary"
				} else if combRarityPct <= 1.0 {
					tier = "Epic"
				} else if combRarityPct <= 5.0 {
					tier = "Rare"
				} else if combRarityPct <= 15.0 {
					tier = "Uncommon"
				}

				heatmap = append(heatmap, RarityHeatmapCell{
					ModelID:           normSlug,
					ModelName:         m.Name,
					BackdropName:      b.Name,
					CombinedRarity:    combRarityPct,
					RarityTier:        tier,
					FloorGRAM:         nil, // Null unless realized model-backdrop listing exists
					RarityStatus:      "estimated",
					CalculationMethod: "independent_trait_assumption",
				})
			}
		}
		if len(heatmap) > 30 {
			heatmap = heatmap[:30]
		}
	}

	whales := make([]WhaleProfile, 0)

	// Market Cap vs FDV:
	// MarketCap = Floor * UpgradedSupply (circulating upgraded assets)
	// FDV = Floor * TotalSupply (fully diluted valuation)
	var marketCapGRAM *float64
	var marketCapUSD *float64
	var fdvGRAM *float64
	var fdvUSD *float64

	if bestFloorGRAM != nil && *bestFloorGRAM > 0 {
		if upgradedCount != nil && *upgradedCount > 0 {
			mc := round2(float64(*upgradedCount) * *bestFloorGRAM)
			marketCapGRAM = &mc
			if gramRate != nil && *gramRate > 0 {
				mcUSD := round2(mc * *gramRate)
				marketCapUSD = &mcUSD
			}
		}
		if totalSupply != nil && *totalSupply > 0 {
			fdv := round2(float64(*totalSupply) * *bestFloorGRAM)
			fdvGRAM = &fdv
			if gramRate != nil && *gramRate > 0 {
				fUSD := round2(fdv * *gramRate)
				fdvUSD = &fUSD
			}
		}
	}

	dataStatus := "unavailable"
	if liveVenueCount > 0 {
		dataStatus = "live"
	} else if len(dbSnapshots) > 0 {
		dataStatus = "stale"
	} else if liveDetail != nil {
		dataStatus = "estimated"
	}

	// Historical 30-day floor history time-series:
	// Built STRICTLY from verified snapshot history or real trades. No sin/cos waves.
	floorHistory := make([]FloorHistoryPoint, 0)
	if s.repo != nil {
		if hist, err := s.repo.GetFloorHistoryFromSnapshots(ctx, normSlug, 30); err == nil && len(hist) > 0 {
			for _, pt := range hist {
				f, _ := pt.FloorGRAM.Float64()
				vb := make(map[string]float64)
				for vn, vDec := range pt.VenueBreakdown {
					vPrice, _ := vDec.Float64()
					vb[vn] = round2(vPrice)
				}
				floorHistory = append(floorHistory, FloorHistoryPoint{
					Timestamp:      pt.Timestamp.UTC().Format(time.RFC3339),
					FloorGRAM:      round2(f),
					VenueBreakdown: vb,
				})
			}
		}
	}

	// Top Floor Items: Read strictly from real market listings index
	var topFloorItems []FloorItemSummary
	if s.repo != nil {
		if dbListings, err := s.repo.GetActiveMarketListings(ctx, normSlug, 10); err == nil && len(dbListings) > 0 {
			for idx, it := range dbListings {
				pGRAM, _ := it.PriceGRAM.Float64()
				var pUSD *float64
				if gramRate != nil && *gramRate > 0 {
					usd := round2(pGRAM * *gramRate)
					pUSD = &usd
				}
				topFloorItems = append(topFloorItems, FloorItemSummary{
					Rank:         idx + 1,
					SerialNumber: it.SerialNumber,
					ModelName:    it.ModelName,
					SymbolName:   it.SymbolName,
					BackdropName: it.BackdropName,
					CenterHex:    it.CenterHex,
					EdgeHex:      it.EdgeHex,
					PriceGRAM:    &pGRAM,
					PriceUSD:     pUSD,
					VenueName:    it.Venue,
					BuyURL:       it.BuyURL,
					ListingID:    it.ListingID,
					ObservedAt:   it.ObservedAt.UTC().Format(time.RFC3339),
				})
			}
		}
	}

	var floorItem *FloorItemSummary
	if len(topFloorItems) > 0 {
		floorItem = &topFloorItems[0]
	}

	// On Sale Now stats: Computed exclusively from real venue snapshot counts
	totalOnSale := 0
	var byMarketplace []OnSaleMarketplaceBreakdown

	for _, vf := range venueFloors {
		var cnt *int
		if snap, ok := dbSnapshots[vf.VenueID]; ok && vf.DataStatus != "unavailable" {
			c := snap.ActiveListings
			cnt = &c
			totalOnSale += c
		}
		byMarketplace = append(byMarketplace, OnSaleMarketplaceBreakdown{
			VenueName: vf.VenueName,
			FloorGRAM: vf.FloorGRAM,
			FloorUSD:  vf.FloorUSD,
			Count:     cnt,
			Status:    vf.DataStatus,
		})
	}

	onSaleStats := OnSaleStats{
		TotalCount:    totalOnSale,
		FloorGRAM:     bestFloorGRAM,
		FloorUSD:      bestFloorUSD,
		ByMarketplace: byMarketplace,
	}

	// Market Sales Stats (24h, 7d, 30d): Derived purely from real completed sales in DB
	marketSalesStats := MarketSalesStats{}
	if s.repo != nil {
		if s24, err := s.repo.GetSalesStatsByPeriod(ctx, normSlug, now.Add(-24*time.Hour)); err == nil {
			vGRAM, _ := s24.VolumeGRAM.Float64()
			minG, _ := s24.MinGRAM.Float64()
			avgG, _ := s24.AvgGRAM.Float64()
			maxG, _ := s24.MaxGRAM.Float64()

			var vUSD, minUSD, avgUSD, maxUSD *float64
			if gramRate != nil && *gramRate > 0 && s24.DealsCount > 0 {
				vu := round2(vGRAM * *gramRate)
				vUSD = &vu
				miu := round2(minG * *gramRate)
				minUSD = &miu
				au := round2(avgG * *gramRate)
				avgUSD = &au
				mau := round2(maxG * *gramRate)
				maxUSD = &mau
			}

			var bSources []MarketSalesSourceBreakdown
			for _, bs := range s24.BySource {
				bsG, _ := bs.VolumeGRAM.Float64()
				var bsU *float64
				if gramRate != nil && *gramRate > 0 {
					u := round2(bsG * *gramRate)
					bsU = &u
				}
				bSources = append(bSources, MarketSalesSourceBreakdown{
					VenueName:  bs.VenueName,
					VolumeGRAM: round2(bsG),
					VolumeUSD:  bsU,
					DealsCount: bs.DealsCount,
				})
			}

			var minPtr, avgPtr, maxPtr *float64
			if s24.DealsCount > 0 {
				minPtr = &minG
				avgPtr = &avgG
				maxPtr = &maxG
			}

			marketSalesStats.Period24h = MarketSalesMetricPeriod{
				VolumeGRAM: round2(vGRAM),
				VolumeUSD:  vUSD,
				MinGRAM:    minPtr,
				MinUSD:     minUSD,
				AvgGRAM:    avgPtr,
				AvgUSD:     avgUSD,
				MaxGRAM:    maxPtr,
				MaxUSD:     maxUSD,
				DealsCount: s24.DealsCount,
				BySource:   bSources,
			}
		}

		if s7, err := s.repo.GetSalesStatsByPeriod(ctx, normSlug, now.Add(-7*24*time.Hour)); err == nil {
			vGRAM, _ := s7.VolumeGRAM.Float64()
			minG, _ := s7.MinGRAM.Float64()
			avgG, _ := s7.AvgGRAM.Float64()
			maxG, _ := s7.MaxGRAM.Float64()

			var vUSD, minUSD, avgUSD, maxUSD *float64
			if gramRate != nil && *gramRate > 0 && s7.DealsCount > 0 {
				vu := round2(vGRAM * *gramRate)
				vUSD = &vu
				miu := round2(minG * *gramRate)
				minUSD = &miu
				au := round2(avgG * *gramRate)
				avgUSD = &au
				mau := round2(maxG * *gramRate)
				maxUSD = &mau
			}

			var bSources []MarketSalesSourceBreakdown
			for _, bs := range s7.BySource {
				bsG, _ := bs.VolumeGRAM.Float64()
				var bsU *float64
				if gramRate != nil && *gramRate > 0 {
					u := round2(bsG * *gramRate)
					bsU = &u
				}
				bSources = append(bSources, MarketSalesSourceBreakdown{
					VenueName:  bs.VenueName,
					VolumeGRAM: round2(bsG),
					VolumeUSD:  bsU,
					DealsCount: bs.DealsCount,
				})
			}

			var minPtr, avgPtr, maxPtr *float64
			if s7.DealsCount > 0 {
				minPtr = &minG
				avgPtr = &avgG
				maxPtr = &maxG
			}

			marketSalesStats.Period7d = MarketSalesMetricPeriod{
				VolumeGRAM: round2(vGRAM),
				VolumeUSD:  vUSD,
				MinGRAM:    minPtr,
				MinUSD:     minUSD,
				AvgGRAM:    avgPtr,
				AvgUSD:     avgUSD,
				MaxGRAM:    maxPtr,
				MaxUSD:     maxUSD,
				DealsCount: s7.DealsCount,
				BySource:   bSources,
			}
		}

		if s30, err := s.repo.GetSalesStatsByPeriod(ctx, normSlug, now.Add(-30*24*time.Hour)); err == nil {
			vGRAM, _ := s30.VolumeGRAM.Float64()
			minG, _ := s30.MinGRAM.Float64()
			avgG, _ := s30.AvgGRAM.Float64()
			maxG, _ := s30.MaxGRAM.Float64()

			var vUSD, minUSD, avgUSD, maxUSD *float64
			if gramRate != nil && *gramRate > 0 && s30.DealsCount > 0 {
				vu := round2(vGRAM * *gramRate)
				vUSD = &vu
				miu := round2(minG * *gramRate)
				minUSD = &miu
				au := round2(avgG * *gramRate)
				avgUSD = &au
				mau := round2(maxG * *gramRate)
				maxUSD = &mau
			}

			var bSources []MarketSalesSourceBreakdown
			for _, bs := range s30.BySource {
				bsG, _ := bs.VolumeGRAM.Float64()
				var bsU *float64
				if gramRate != nil && *gramRate > 0 {
					u := round2(bsG * *gramRate)
					bsU = &u
				}
				bSources = append(bSources, MarketSalesSourceBreakdown{
					VenueName:  bs.VenueName,
					VolumeGRAM: round2(bsG),
					VolumeUSD:  bsU,
					DealsCount: bs.DealsCount,
				})
			}

			var minPtr, avgPtr, maxPtr *float64
			if s30.DealsCount > 0 {
				minPtr = &minG
				avgPtr = &avgG
				maxPtr = &maxG
			}

			marketSalesStats.Period30d = MarketSalesMetricPeriod{
				VolumeGRAM: round2(vGRAM),
				VolumeUSD:  vUSD,
				MinGRAM:    minPtr,
				MinUSD:     minUSD,
				AvgGRAM:    avgPtr,
				AvgUSD:     avgUSD,
				MaxGRAM:    maxPtr,
				MaxUSD:     maxUSD,
				DealsCount: s30.DealsCount,
				BySource:   bSources,
			}
		}
	}

	// Sales History: Populated strictly with verified completed sales records from DB
	var salesHistory []SalesHistoryItem
	if s.repo != nil {
		if dbSales, err := s.repo.GetRecentSalesByModel(ctx, normSlug, 20); err == nil && len(dbSales) > 0 {
			for idx, sRec := range dbSales {
				pGRAM, _ := sRec.SalePriceGRAM.Float64()
				var pUSD *float64
				if !sRec.SalePriceUSD.IsZero() {
					u, _ := sRec.SalePriceUSD.Float64()
					pUSD = &u
				} else if gramRate != nil && *gramRate > 0 {
					u := round2(pGRAM * *gramRate)
					pUSD = &u
				}

				var exRate *float64
				if sRec.TonUsdAtSale != nil && !sRec.TonUsdAtSale.IsZero() {
					er, _ := sRec.TonUsdAtSale.Float64()
					exRate = &er
				} else if gramRate != nil {
					exRate = gramRate
				}

				salesHistory = append(salesHistory, SalesHistoryItem{
					Rank:         idx + 1,
					SerialNumber: sRec.SerialNumber,
					ModelName:    collectionName,
					SymbolName:   "",
					BackdropName: "",
					PriceGRAM:    round2(pGRAM),
					PriceUSD:     pUSD,
					ExchangeRate: exRate,
					VenueName:    sRec.Venue,
					SaleDate:     sRec.SaleDate.UTC().Format(time.RFC3339),
					TxHash:       sRec.TxHash,
					EventIndex:   sRec.EventIndex,
				})
			}
		}
	}

	// Catalog Search Items: Populated from real active listings
	searchItems := make([]CatalogSearchItem, 0)
	if len(topFloorItems) > 0 {
		for _, it := range topFloorItems {
			searchItems = append(searchItems, CatalogSearchItem{
				SerialNumber: it.SerialNumber,
				ModelName:    it.ModelName,
				SymbolName:   it.SymbolName,
				BackdropName: it.BackdropName,
				CenterHex:    it.CenterHex,
				IsOnSale:     true,
				PriceGRAM:    it.PriceGRAM,
				PriceUSD:     it.PriceUSD,
				VenueName:    it.VenueName,
				RarityScore:  0,
			})
		}
	}

	dataSources := []string{metadataSource}
	if len(priceSources) > 0 {
		dataSources = append(dataSources, priceSources...)
	} else {
		dataSources = append(dataSources, "Fragment / Getgems / MarketApp / Telegram / TON Indexer")
	}
	if gramRate != nil {
		dataSources = append(dataSources, "CoinGecko (TON/USD)")
	}

	priceSourceAttribution := "Fragment / Getgems / MarketApp / Telegram / TON Indexer"
	if len(priceSources) > 0 {
		priceSourceAttribution = strings.Join(priceSources, ", ")
	}

	resp := &CollectionIntelResponse{
		CollectionID:          normSlug,
		CollectionName:        collectionName,
		CollectionSlug:        normSlug,
		ContractAddress:       contractID,
		TotalSupply:           totalSupply,
		UpgradedCount:         upgradedCount,
		UpgradedCountStatus:   upgradedCountStatus,
		IsLimited:             isLimited,
		IsCraftable:           isCraftable,
		ReleaseDate:           releaseDate,
		UpgradeEnabledDate:    upgradeDate,
		TotalModels:           totalModels,
		TotalBackdrops:        totalBackdrops,
		TotalSymbols:          totalSymbols,
		BackdropsList:         backdropsList,
		SymbolsList:           symbolsList,
		BestFloorGRAM:         bestFloorGRAM,
		BestFloorUSD:          bestFloorUSD,
		BestFloorVenue:        bestFloorVenue,
		Volume24hGRAM:         marketSalesStats.Period24h.VolumeGRAM,
		Volume24hUSD:          marketSalesStats.Period24h.VolumeUSD,
		MarketCapGRAM:         marketCapGRAM,
		MarketCapUSD:          marketCapUSD,
		FDVGRAM:               fdvGRAM,
		FDVUSD:                fdvUSD,
		ListedCount:           totalOnSale,
		LiquidityRatio:        0,
		ModelFloors:           modelFloors,
		RarityHeatmap:         heatmap,
		VenueFloors:           venueFloors,
		Arbitrage:             arb,
		Whales:                whales,
		RecentActivity:        make([]MarketActivityItem, 0),
		FearGreed:             FearGreedData{Index: 50, Label: "Neutral"},
		FloorHistory:          floorHistory,
		UpgradeLadder:         make([]UpgradeStepInfo, 0),
		FloorItem:             floorItem,
		TopFloorItems:         topFloorItems,
		MarketSalesStats:      marketSalesStats,
		OnSaleStats:           onSaleStats,
		SalesHistory:          salesHistory,
		SearchItems:           searchItems,
		MetadataSource:        metadataSource,
		PriceSource:           priceSourceAttribution,
		DataStatus:            dataStatus,
		DataSourceAttribution: fmt.Sprintf("Metadata: %s | Prices: %s", metadataSource, priceSourceAttribution),
		DataSources:           dataSources,
		UpdatedAt:             now.Format(time.RFC3339),
	}

	// Cache only valid/non-unavailable responses with short TTL
	if s.cache != nil && dataStatus != "unavailable" {
		if snapJSON, err := json.Marshal(resp); err == nil {
			s.cache.Client.Set(ctx, cacheKey, snapJSON, 2*time.Minute)
		}
	}

	return resp, nil
}

func round2(v float64) float64 {
	return math.Round(v*100.0) / 100.0
}
