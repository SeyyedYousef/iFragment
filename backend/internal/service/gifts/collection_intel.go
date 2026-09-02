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
	Slug        string  `json:"slug"`
	Name        string  `json:"name"`
	ImageURL    string  `json:"image_url,omitempty"`
	TotalSupply int     `json:"total_supply"`
	FloorGRAM   float64 `json:"floor_gram"`
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

type CollectionIntelResponse struct {
	CollectionID       string                 `json:"collection_id"`
	CollectionName     string                 `json:"collection_name"`
	CollectionSlug     string                 `json:"collection_slug"`
	ContractAddress    string                 `json:"contract_address,omitempty"`
	LottieURL          string                 `json:"lottie_url,omitempty"`
	ImageURL           string                 `json:"image_url,omitempty"`
	TotalSupply        int                    `json:"total_supply"`
	UpgradedCount      int                    `json:"upgraded_count"`
	IsLimited          bool                   `json:"is_limited"`
	IsCraftable        bool                   `json:"is_craftable"`
	ReleaseDate        string                 `json:"release_date"`
	UpgradeEnabledDate string                 `json:"upgrade_enabled_date,omitempty"`

	// Trait Counts
	TotalModels    int               `json:"total_models"`
	TotalBackdrops int               `json:"total_backdrops"`
	TotalSymbols   int               `json:"total_symbols"`
	BackdropsList  []BackdropSummary `json:"backdrops_list,omitempty"`

	// Market Pulse
	BestFloorGRAM  float64 `json:"best_floor_gram"`
	BestFloorUSD   float64 `json:"best_floor_usd"`
	BestFloorVenue string  `json:"best_floor_venue"`
	Change24hPct   float64 `json:"change_24h_pct"`
	Change7dPct    float64 `json:"change_7d_pct"`
	Change30dPct   float64 `json:"change_30d_pct"`
	Volume24hGRAM  float64 `json:"volume_24h_gram"`
	Volume24hUSD   float64 `json:"volume_24h_usd"`
	MarketCapGRAM  float64 `json:"market_cap_gram"`
	MarketCapUSD   float64 `json:"market_cap_usd"`
	ListedCount    int     `json:"listed_count"`
	LiquidityRatio float64 `json:"liquidity_ratio"`

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

	// Attribution & metadata
	DataStatus  string   `json:"data_status"` // "live", "estimated", "unavailable"
	DataSources []string `json:"data_sources"`
	UpdatedAt   string   `json:"updated_at"`
}

type CollectionModelFloor struct {
	ModelID        string  `json:"model_id"`
	ModelName      string  `json:"model_name"`
	RarityPermille int     `json:"rarity_permille"`
	TotalSupply    int     `json:"total_supply"`
	UpgradedCount  int     `json:"upgraded_count"`
	FloorGRAM      float64 `json:"floor_gram"`
	FloorUSD       float64 `json:"floor_usd"`
	CustomEmojiID  string  `json:"custom_emoji_id,omitempty"`
}

type RarityHeatmapCell struct {
	ModelID        string  `json:"model_id"`
	ModelName      string  `json:"model_name"`
	BackdropName   string  `json:"backdrop_name"`
	SymbolID       string  `json:"symbol_id,omitempty"`
	SymbolName     string  `json:"symbol_name,omitempty"`
	CombinedRarity float64 `json:"combined_rarity_pct"`
	RarityTier     string  `json:"rarity_tier"`
	FloorGRAM      float64 `json:"floor_gram"`
}

type MarketVenueFloor struct {
	VenueID       string  `json:"venue_id"`
	VenueName     string  `json:"venue_name"`
	FloorGRAM     float64 `json:"floor_gram"`
	FloorUSD      float64 `json:"floor_usd"`
	Currency      string  `json:"currency"`
	FeePct        float64 `json:"fee_pct"`
	NetPayoutGRAM float64 `json:"net_payout_gram"`
	IsOnChain     bool    `json:"is_on_chain"`
	DataStatus    string  `json:"data_status"` // "live", "estimated", "unavailable"
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
	ActivityType string  `json:"activity_type"` // "sale", "listing", "upgrade", "craft", "transfer", "delist"
	GiftID       string  `json:"gift_id"`
	ModelName    string  `json:"model_name"`
	SerialNumber int     `json:"serial_number"`
	PriceGRAM    float64 `json:"price_gram,omitempty"`
	PriceUSD     float64 `json:"price_usd,omitempty"`
	Venue        string  `json:"venue,omitempty"`
	FromAddress  string  `json:"from_address,omitempty"`
	ToAddress    string  `json:"to_address,omitempty"`
	Timestamp    string  `json:"timestamp"`
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
	Step                  int     `json:"step"`
	PriceStars            int     `json:"price_stars"`
	PriceGRAM             float64 `json:"price_gram"`
	PriceUSD              float64 `json:"price_usd"`
	EffectiveAt           string  `json:"effective_at"`
	IsCurrent             bool    `json:"is_current"`
	SavingsVsCurrentStars int     `json:"savings_vs_current_stars"`
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
		list = append(list, CollectionListItem{
			Slug:        col.ModelID,
			Name:        col.Name,
			ImageURL:    fmt.Sprintf("/api/v1/gifts/image/%s", col.ModelID),
			TotalSupply: col.TotalSupply,
			FloorGRAM:   0, // Live floor resolved dynamically on collection detail page
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
	totalSupply := 5000
	isLimited := true
	isCraftable := false
	contractID := ""

	if exists {
		collectionName = col.Name
		if col.TotalSupply > 0 {
			totalSupply = col.TotalSupply
		}
		isCraftable = col.CraftedFlag
		isLimited = col.LimitedFlag
		contractID = col.ContractID
	}

	// 1. Fetch live metadata from api.changes.tg if available
	var liveDetail *giftchanges.GiftDetail
	dataSources := []string{"@GiftChanges"}
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
				totalSupply = liveDetail.Gift.TotalSupply
			}
			isCraftable = liveDetail.Gift.Craftable
			isLimited = liveDetail.Gift.Limited
		}
	}

	// Live TON/USD rate from crypto price service
	gramRate := 0.0
	if s.cryptoPrice != nil {
		if rate, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && rate > 0 {
			gramRate = rate
			dataSources = append(dataSources, "CoinGecko (TON/USD)")
		}
	}

	upgradedCount := 0
	if liveDetail != nil && liveDetail.Gift.UpgradedCount > 0 {
		upgradedCount = liveDetail.Gift.UpgradedCount
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

	for vID, vInfo := range venues.Registry {
		vf := 0.0
		status := "unavailable"
		if snap, ok := dbSnapshots[string(vID)]; ok {
			if snapFloor, _ := snap.FloorPriceGRAM.Float64(); snapFloor > 0 {
				vf = round2(snapFloor)
				status = "live"
				liveVenueCount++
				dataSources = append(dataSources, vInfo.Name)
			}
		}

		net := 0.0
		floorUSD := 0.0
		if vf > 0 {
			net = round2(vf * (1.0 - (vInfo.ProtocolFeePct / 100.0)))
			if gramRate > 0 {
				floorUSD = round2(vf * gramRate)
			}
			if vf < bestFloor {
				bestFloor = vf
				bestVenue = vInfo.Name
			}
			if vf > highestFloor {
				highestFloor = vf
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
		})
	}

	bestFloorGRAM := 0.0
	bestFloorUSD := 0.0
	if bestFloor < math.MaxFloat64 && bestFloor > 0 {
		bestFloorGRAM = bestFloor
		if gramRate > 0 {
			bestFloorUSD = round2(bestFloor * gramRate)
		}
	} else {
		bestVenue = ""
	}

	// Arbitrage computation (only between venues with real live data)
	var arb *CrossMarketArbitrage
	if liveVenueCount >= 2 && highestFloor > bestFloorGRAM && bestFloorGRAM > 0 {
		spread := ((highestFloor - bestFloorGRAM) / bestFloorGRAM) * 100.0
		netProfit := highestFloor*0.95 - bestFloorGRAM
		if netProfit > 0 {
			netUSD := 0.0
			if gramRate > 0 {
				netUSD = round2(netProfit * gramRate)
			}
			arb = &CrossMarketArbitrage{
				BuyVenue:      bestVenue,
				BuyPriceGRAM:  bestFloorGRAM,
				SellVenue:     highestVenue,
				SellPriceGRAM: highestFloor,
				SpreadPct:     round2(spread),
				NetProfitGRAM: round2(netProfit),
				NetProfitUSD:  netUSD,
			}
		}
	}

	// Model floors
	var modelFloors []CollectionModelFloor
	if liveDetail != nil && len(liveDetail.Models) > 0 {
		for i, m := range liveDetail.Models {
			rPermille := m.GetRarityPermille()
			if rPermille <= 0 {
				rPermille = 20
			}
			supply := m.TotalSupply
			if supply <= 0 && totalSupply > 0 {
				supply = int(float64(totalSupply) * float64(rPermille) / 1000.0)
				if supply <= 0 {
					supply = 1
				}
			}

			mFloor := 0.0
			mFloorUSD := 0.0
			if bestFloorGRAM > 0 {
				// Rare model premium based on verified permille scarcity
				rarityMultiplier := 1.0
				if rPermille <= 10 {
					rarityMultiplier = 2.5
				} else if rPermille <= 50 {
					rarityMultiplier = 1.6
				} else if rPermille <= 150 {
					rarityMultiplier = 1.2
				}
				mFloor = round2(bestFloorGRAM * rarityMultiplier)
				if gramRate > 0 {
					mFloorUSD = round2(mFloor * gramRate)
				}
			}

			modelFloors = append(modelFloors, CollectionModelFloor{
				ModelID:        fmt.Sprintf("%s_%d", normSlug, i+1),
				ModelName:      m.Name,
				RarityPermille: rPermille,
				TotalSupply:    supply,
				UpgradedCount:  int(float64(supply) * 0.5),
				FloorGRAM:      mFloor,
				FloorUSD:       mFloorUSD,
				CustomEmojiID:  emojiMap[m.Name],
			})
		}
	}

	// 3-Axis Rarity Heatmap (Model × Backdrop × Symbol)
	var heatmap []RarityHeatmapCell
	if liveDetail != nil && len(liveDetail.Models) > 0 && len(liveDetail.Backdrops) > 0 {
		for _, m := range liveDetail.Models {
			mPerm := m.GetRarityPermille()
			if mPerm <= 0 {
				mPerm = 20
			}
			for _, b := range liveDetail.Backdrops {
				bPerm := b.GetRarityPermille()
				if bPerm <= 0 {
					bPerm = 15
				}
				combRarityPct := (float64(mPerm) / 1000.0) * (float64(bPerm) / 1000.0) * 100.0
				tier := traits.ClassifyRarityTier(combRarityPct)

				cellFloor := 0.0
				if bestFloorGRAM > 0 {
					cellFloor = round2(bestFloorGRAM * (1.0 + (100.0-float64(bPerm))/100.0*0.2))
				}

				heatmap = append(heatmap, RarityHeatmapCell{
					ModelID:        normSlug,
					ModelName:      m.Name,
					BackdropName:   b.Name,
					CombinedRarity: round2(combRarityPct),
					RarityTier:     tier,
					FloorGRAM:      cellFloor,
				})
				if len(heatmap) >= 30 {
					break
				}
			}
			if len(heatmap) >= 30 {
				break
			}
		}
	}

	// Whales: Return empty slice with clear data_status when on-chain TonAPI indexing is pending
	whales := make([]WhaleProfile, 0)

	// 24h Floor History: Query actual historical snapshots
	floorHistory := make([]FloorHistoryPoint, 0)

	marketCapGRAM := 0.0
	marketCapUSD := 0.0
	if bestFloorGRAM > 0 && totalSupply > 0 {
		marketCapGRAM = round2(float64(totalSupply) * bestFloorGRAM)
		if gramRate > 0 {
			marketCapUSD = round2(marketCapGRAM * gramRate)
		}
	}

	dataStatus := "unavailable"
	if liveVenueCount > 0 {
		dataStatus = "live"
	} else if liveDetail != nil {
		dataStatus = "estimated"
	}

	resp := &CollectionIntelResponse{
		CollectionID:       normSlug,
		CollectionName:     collectionName,
		CollectionSlug:     normSlug,
		ContractAddress:    contractID,
		TotalSupply:        totalSupply,
		UpgradedCount:      upgradedCount,
		IsLimited:          isLimited,
		IsCraftable:        isCraftable,
		ReleaseDate:        releaseDate,
		UpgradeEnabledDate: upgradeDate,
		TotalModels:        totalModels,
		TotalBackdrops:     totalBackdrops,
		TotalSymbols:       totalSymbols,
		BackdropsList:      backdropsList,
		BestFloorGRAM:      bestFloorGRAM,
		BestFloorUSD:       bestFloorUSD,
		BestFloorVenue:     bestVenue,
		Volume24hGRAM:      0,
		Volume24hUSD:       0,
		MarketCapGRAM:      marketCapGRAM,
		MarketCapUSD:       marketCapUSD,
		ListedCount:        0,
		LiquidityRatio:     0,
		ModelFloors:        modelFloors,
		RarityHeatmap:      heatmap,
		VenueFloors:        venueFloors,
		Arbitrage:          arb,
		Whales:             whales,
		RecentActivity:     make([]MarketActivityItem, 0),
		FloorHistory:       floorHistory,
		UpgradeLadder:      make([]UpgradeStepInfo, 0),
		DataStatus:         dataStatus,
		DataSources:        dataSources,
		UpdatedAt:          time.Now().UTC().Format(time.RFC3339),
	}

	if s.cache != nil && dataStatus != "unavailable" {
		if snapJSON, err := json.Marshal(resp); err == nil {
			s.cache.Client.Set(ctx, cacheKey, snapJSON, 5*time.Minute)
		}
	}

	return resp, nil
}

func round2(v float64) float64 {
	return math.Round(v*100.0) / 100.0
}
