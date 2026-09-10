package gifts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/gifts/crafting"
	"ifragment-backend/internal/service/gifts/giftchanges"
	"ifragment-backend/internal/service/gifts/gvengine"
	"ifragment-backend/internal/service/gifts/telegramnft"
	"ifragment-backend/internal/service/gifts/traits"
	"ifragment-backend/internal/service/gifts/upgrade"
	"ifragment-backend/internal/service/gifts/venues"
	"ifragment-backend/internal/service/username/avm"
)

var (
	ErrReportLocked         = errors.New("report is locked; unlock required via credit or coins")
	ErrReportNotPurchased   = errors.New("report must be unlocked before adding gift to watchlist")
	ErrInsufficientCoins    = errors.New("insufficient Airdrop coins balance")
	ErrInsufficientCredit   = errors.New("insufficient Intel Credit balance")
	ErrPortfolioRateLimited = errors.New("portfolio scan is rate-limited (allowed once every 10 minutes per username)")
)

type GiftsService struct {
	db                 *repository.Database
	cache              *repository.Cache
	repo               *repository.GiftsRepo
	creditRepo         *repository.IntelCreditRepo
	engine             *gvengine.ValuationEngine
	cryptoPrice        *cryptoprice.CryptoPriceService
	tgClient           *telegram.BotAPIClient
	giftchangesClient  *giftchanges.Client
	snapshotWorker     *venues.VenueSnapshotWorker
	workerOnce         sync.Once
}

func NewGiftsService(
	db *repository.Database,
	cache *repository.Cache,
	cryptoPrice *cryptoprice.CryptoPriceService,
) *GiftsService {
	repo := repository.NewGiftsRepo(db)
	creditRepo := repository.NewIntelCreditRepo(db)
	engine := gvengine.NewValuationEngine(db, cache, cryptoPrice)
	return &GiftsService{
		db:                db,
		cache:             cache,
		repo:              repo,
		creditRepo:        creditRepo,
		engine:            engine,
		cryptoPrice:       cryptoPrice,
		giftchangesClient: giftchanges.NewClient(),
	}
}

func (s *GiftsService) SetTelegramClient(tg *telegram.BotAPIClient) {
	s.tgClient = tg
}

// GetSnapshotWorker returns singleton instance of snapshot worker
func (s *GiftsService) GetSnapshotWorker() *venues.VenueSnapshotWorker {
	s.workerOnce.Do(func() {
		s.snapshotWorker = venues.NewVenueSnapshotWorker(s.repo, s.cryptoPrice, 3*time.Minute)
	})
	return s.snapshotWorker
}

type GiftsMacroStatsPayload struct {
	TotalUniqueModels int `json:"total_unique_models"`
	TotalPatterns     int `json:"total_patterns"`
}

// GiftsIntelResponse holds the public market intelligence overview
type GiftsIntelResponse struct {
	TotalCumulativeVolumeUSD float64                 `json:"total_cumulative_volume_usd"`
	TotalMarketCapUSD        float64                 `json:"total_market_cap_usd"`
	TotalActiveWallets       int                     `json:"total_active_wallets"`
	TotalGiftsMinted         int                     `json:"total_gifts_minted"`
	FnGIndex                 int                     `json:"fng_index"`
	FnGLabel                 string                  `json:"fng_label"`
	UnifiedFloorBoard        []UnifiedFloorBoardItem `json:"unified_floor_board"`
	ArbitrageRadar           []ArbitrageOpportunity  `json:"arbitrage_radar"`
	UpgradePriceClock        []UpgradeClockItem      `json:"upgrade_price_clock"`
	TrendingModels           []TrendingModelItem     `json:"trending_models"`
	EndingSoonAuctions       []GiftAuctionItem       `json:"ending_soon_auctions"`
	MacroStats               *GiftsMacroStatsPayload `json:"macro_stats,omitempty"`
	DataSourceAttribution    string                  `json:"data_source_attribution"`
	DataStatus               string                  `json:"data_status"` // "live", "estimated", "unavailable"
	UpdatedAt                string                  `json:"updated_at"`
}

type UnifiedFloorBoardItem struct {
	ModelID            string                     `json:"model_id"`
	Name               string                     `json:"name"`
	TotalSupply        int                        `json:"total_supply"`
	BestFloorGRAM      float64                    `json:"best_floor_gram"`
	BestFloorUSD       float64                    `json:"best_floor_usd"`
	BestVenueID        venues.VenueID             `json:"best_venue_id"`
	BestVenueName      string                     `json:"best_venue_name"`
	PriceChange24hPct  float64                    `json:"price_change_24h_pct"`
	VenueFloors        map[venues.VenueID]float64 `json:"venue_floors"`
	HasRealVolumeBadge bool                       `json:"has_real_volume_badge"`
}

type ArbitrageOpportunity struct {
	ModelID       string  `json:"model_id"`
	ModelName     string  `json:"model_name"`
	BuyVenue      string  `json:"buy_venue"`
	BuyPriceGRAM  float64 `json:"buy_price_gram"`
	SellVenue     string  `json:"sell_venue"`
	SellPriceGRAM float64 `json:"sell_price_gram"`
	NetProfitGRAM float64 `json:"net_profit_gram"`
	NetProfitUSD  float64 `json:"net_profit_usd"`
	SpreadPercent float64 `json:"spread_percent"`
	IsFreeAccess  bool    `json:"is_free_access"`
}

type UpgradeClockItem struct {
	ModelID               string `json:"model_id"`
	ModelName             string `json:"model_name"`
	CurrentPriceStars     int    `json:"current_price_stars"`
	FloorPriceStars       int    `json:"floor_price_stars"`
	NextDropInMinutes     int    `json:"next_drop_in_minutes"`
	PotentialSavingsStars int    `json:"potential_savings_stars"`
}

type TrendingModelItem struct {
	ModelID          string  `json:"model_id"`
	Name             string  `json:"name"`
	VolumeGrowth     float64 `json:"volume_growth_24h_pct"`
	FloorGRAM        float64 `json:"floor_gram"`
	AveragePriceGRAM float64 `json:"average_price_gram"`
	SalesCount       int     `json:"sales_count"`
	IsCrafted        bool    `json:"is_crafted"`
}

type GiftAuctionItem struct {
	GiftID         string    `json:"gift_id"`
	ModelName      string    `json:"model_name"`
	SerialNumber   int       `json:"serial_number"`
	CurrentBidGRAM float64   `json:"current_bid_gram"`
	EndsAt         time.Time `json:"ends_at"`
	Venue          string    `json:"venue"`
}

// PortfolioScanResponse holds user gifts inventory analysis
type PortfolioScanResponse struct {
	Username               string                 `json:"username"`
	TotalGiftsCount        int                    `json:"total_gifts_count"`
	TotalPortfolioValGRAM  float64                `json:"total_portfolio_value_gram"`
	TotalPortfolioValUSD   float64                `json:"total_portfolio_value_usd"`
	HistoricalInvestedGRAM float64                `json:"historical_invested_gram"`
	TotalPnLGRAM           float64                `json:"total_pnl_gram"`
	TotalPnLPercent        float64                `json:"total_pnl_percent"`
	TopValuedGifts         []PortfolioItemSummary `json:"top_valued_gifts"`
	CollectionBreakdown    []CollectionShareItem  `json:"collection_breakdown"`
	ScannedAt              time.Time              `json:"scanned_at"`
}

type PortfolioItemSummary struct {
	GiftID           string  `json:"gift_id"`
	ModelName        string  `json:"model_name"`
	SerialNumber     int     `json:"serial_number"`
	EstimatedValGRAM float64 `json:"estimated_val_gram"`
	EstimatedValUSD  float64 `json:"estimated_val_usd"`
	RarityTier       string  `json:"rarity_tier"`
	ReportDeepLink   string  `json:"report_deep_link"`
}

type CollectionShareItem struct {
	ModelID      string  `json:"model_id"`
	ModelName    string  `json:"model_name"`
	Count        int     `json:"count"`
	TotalValGRAM float64 `json:"total_val_gram"`
	SharePercent float64 `json:"share_percent"`
}

// GetGiftsIntel generates the free market intelligence board from real database snapshots and sales
func (s *GiftsService) GetGiftsIntel(ctx context.Context) (*GiftsIntelResponse, error) {
	gramUsdRate := 1.42
	if s.cryptoPrice != nil {
		if r, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && r > 0 {
			gramUsdRate = r
		}
	}

	_, fngLabel, fngIndex := avm.GetFearAndGreedMultiplier()
	now := time.Now().UTC()

	totalMinted := 0
	activeWallets := 0
	totalVolume := 0.0
	totalMarketCap := 0.0
	var macroStats *GiftsMacroStatsPayload

	// Query live aggregate stats from api.changes.tg if available
	if s.giftchangesClient != nil {
		if stats, err := s.giftchangesClient.GetTotal(ctx); err == nil && stats != nil {
			if stats.Gifts.Total > 0 {
				totalMinted = stats.Gifts.Total
			}
			macroStats = &GiftsMacroStatsPayload{
				TotalUniqueModels: stats.Models,
				TotalPatterns:     stats.Patterns,
			}
		}
	}

	resp := &GiftsIntelResponse{
		TotalCumulativeVolumeUSD: totalVolume,
		TotalMarketCapUSD:        totalMarketCap,
		TotalActiveWallets:       activeWallets,
		TotalGiftsMinted:         totalMinted,
		FnGIndex:                 fngIndex,
		FnGLabel:                 fngLabel,
		UnifiedFloorBoard:        []UnifiedFloorBoardItem{},
		ArbitrageRadar:           []ArbitrageOpportunity{},
		UpgradePriceClock:        []UpgradeClockItem{},
		TrendingModels:           []TrendingModelItem{},
		EndingSoonAuctions:       []GiftAuctionItem{},
		MacroStats:               macroStats,
		DataSourceAttribution:    "Data powered by @GiftChanges (api.changes.tg)",
		DataStatus:               "unavailable",
		UpdatedAt:                now.Format(time.RFC3339),
	}

	if s.db == nil || s.db.Pool == nil {
		return resp, nil
	}

	// 1. Query real 24h vs previous 24h average prices from gift_sales for true price change
	priceChanges := make(map[string]float64)
	salesRows, err := s.db.Pool.Query(ctx, `
		SELECT 
			model_id,
			COALESCE(AVG(CASE WHEN sale_date >= now() - interval '24 hours' THEN sale_price_gram END), 0) as avg_cur,
			COALESCE(AVG(CASE WHEN sale_date >= now() - interval '48 hours' AND sale_date < now() - interval '24 hours' THEN sale_price_gram END), 0) as avg_prev
		FROM gift_sales
		WHERE sale_date >= now() - interval '48 hours'
		GROUP BY model_id`)
	if err == nil {
		for salesRows.Next() {
			var mID string
			var avgCur, avgPrev float64
			if err := salesRows.Scan(&mID, &avgCur, &avgPrev); err == nil {
				if avgPrev > 0 && avgCur > 0 {
					priceChanges[mID] = round2(((avgCur - avgPrev) / avgPrev) * 100.0)
				}
			}
		}
		salesRows.Close()
	}

	// 2. Fetch live floor snapshots from venue_snapshots
	modelMap := make(map[string]map[venues.VenueID]float64)
	snapshots, err := s.repo.GetVenueSnapshots(ctx, "")
	if err == nil && len(snapshots) > 0 {
		resp.DataStatus = "live"
		// Group by model_id
		for _, snap := range snapshots {
			if _, exists := modelMap[snap.ModelID]; !exists {
				modelMap[snap.ModelID] = make(map[venues.VenueID]float64)
			}
			fGram, _ := snap.FloorPriceGRAM.Float64()
			modelMap[snap.ModelID][venues.VenueID(snap.Venue)] = fGram
		}

		// Check models with verified sales in last 7d for accurate volume badge
		model7dSales := make(map[string]bool)
		volRows, vErr := s.db.Pool.Query(ctx, `SELECT model_id FROM gift_sales WHERE sale_date >= now() - interval '7 days' GROUP BY model_id HAVING COUNT(*) > 0`)
		if vErr == nil {
			defer volRows.Close()
			for volRows.Next() {
				var m string
				if err := volRows.Scan(&m); err == nil {
					model7dSales[m] = true
				}
			}
		}

		var dynamicMarketCap float64
		for modelID, venueFloors := range modelMap {
			col, ok := traits.ResolveCollection(modelID)
			name := modelID
			totalSupply := 0
			if ok {
				name = col.Name
				totalSupply = col.TotalSupply
			}

			// Find lowest floor
			bestVenue := venues.VenueFragment
			bestFloor := math.MaxFloat64
			for vID, fl := range venueFloors {
				if fl > 0 && fl < bestFloor {
					bestFloor = fl
					bestVenue = vID
				}
			}
			if bestFloor == math.MaxFloat64 {
				bestFloor = 0
			}

			if bestFloor > 0 && totalSupply > 0 {
				dynamicMarketCap += (bestFloor * float64(totalSupply) * gramUsdRate)
			}

			ch24h := priceChanges[modelID]

			resp.UnifiedFloorBoard = append(resp.UnifiedFloorBoard, UnifiedFloorBoardItem{
				ModelID:            modelID,
				Name:               name,
				TotalSupply:        totalSupply,
				BestFloorGRAM:      round2(bestFloor),
				BestFloorUSD:       round2(bestFloor * gramUsdRate),
				BestVenueID:        bestVenue,
				BestVenueName:      string(bestVenue),
				PriceChange24hPct:  ch24h,
				VenueFloors:        venueFloors,
				HasRealVolumeBadge: model7dSales[modelID],
			})
		}
		if dynamicMarketCap > 0 {
			resp.TotalMarketCapUSD = round2(dynamicMarketCap)
		}
	}

	// 2. Compute Volume and Aggregates from gift_sales
	var totalSalesCount int
	var totalVolumeGRAM float64
	_ = s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM(sale_price_gram), 0)
		FROM gift_sales`).Scan(&totalSalesCount, &totalVolumeGRAM)

	if totalSalesCount > 0 {
		resp.DataStatus = "live"
		resp.TotalCumulativeVolumeUSD = round2(totalVolumeGRAM * gramUsdRate)
	}

	// Fix Bug 1: Calculate TotalGiftsMinted from official catalog supply (or live stats), never from sales count
	if resp.TotalGiftsMinted == 0 {
		catalogMinted := 0
		for _, col := range traits.GetGlobalCatalog().GetAllCollections() {
			if col.TotalSupply > 0 {
				catalogMinted += col.TotalSupply
			}
		}
		resp.TotalGiftsMinted = catalogMinted
	}

	// 3. Trending Models from real 7d vs prior 7d sales (Fix Bug 2 and Bug 3)
	trendingRows, err := s.db.Pool.Query(ctx, `
		WITH cur_7d AS (
			SELECT model_id, COUNT(*) as sales_count, COALESCE(SUM(sale_price_gram), 0) as vol_cur, COALESCE(AVG(sale_price_gram), 0) as avg_price
			FROM gift_sales
			WHERE sale_date >= now() - interval '7 days'
			GROUP BY model_id
		),
		prev_7d AS (
			SELECT model_id, COALESCE(SUM(sale_price_gram), 0) as vol_prev
			FROM gift_sales
			WHERE sale_date >= now() - interval '14 days' AND sale_date < now() - interval '7 days'
			GROUP BY model_id
		)
		SELECT c.model_id, c.sales_count, c.avg_price, c.vol_cur, COALESCE(p.vol_prev, 0) as vol_prev
		FROM cur_7d c
		LEFT JOIN prev_7d p ON c.model_id = p.model_id
		ORDER BY c.sales_count DESC
		LIMIT 5`)
	if err == nil {
		defer trendingRows.Close()
		for trendingRows.Next() {
			var mID string
			var count int
			var avgPrice, volCur, volPrev float64
			if err := trendingRows.Scan(&mID, &count, &avgPrice, &volCur, &volPrev); err == nil {
				colName := mID
				isCrafted := false
				if col, ok := traits.ResolveCollection(mID); ok {
					colName = col.Name
					isCrafted = col.CraftedFlag
				}
				growthPct := 0.0
				if volPrev > 0 {
					growthPct = round2(((volCur - volPrev) / volPrev) * 100.0)
				} else if volCur > 0 {
					growthPct = 100.0
				}

				// Resolve true floor from venue snapshots / modelMap
				modelFloor := 0.0
				if vFloors, ok := modelMap[mID]; ok {
					bestF := math.MaxFloat64
					for _, f := range vFloors {
						if f > 0 && f < bestF {
							bestF = f
						}
					}
					if bestF < math.MaxFloat64 {
						modelFloor = bestF
					}
				}

				resp.TrendingModels = append(resp.TrendingModels, TrendingModelItem{
					ModelID:          mID,
					Name:             colName,
					VolumeGrowth:     growthPct,
					FloorGRAM:        round2(modelFloor),
					AveragePriceGRAM: round2(avgPrice),
					SalesCount:       count,
					IsCrafted:        isCrafted,
				})
			}
		}
	}

	return resp, nil
}

// GetCuriosityGate returns zero price leakage teaser (Sacred Rule 3)
func (s *GiftsService) GetCuriosityGate(ctx context.Context, raw string) (*gvengine.CuriosityGateResponse, error) {
	return s.engine.GenerateCuriosityGate(ctx, raw)
}

// ValuateGift fetches cached 24h report if user has purchased it; otherwise returns ErrReportLocked (Sacred Rule 3)
func (s *GiftsService) ValuateGift(ctx context.Context, userID int64, raw string) (*gvengine.GiftValuation, error) {
	ref, err := gvengine.NormalizeGiftIdentifier(raw)
	if err != nil {
		return nil, err
	}

	// 1. Check 24-hour purchased report in DB if user is authenticated
	if userID > 0 {
		if rec, err := s.repo.GetPurchasedGiftReport(ctx, userID, ref.GiftID); err == nil && rec != nil {
			var cachedVal gvengine.GiftValuation
			if json.Unmarshal(rec.ReportSnapshot, &cachedVal) == nil {
				return &cachedVal, nil
			}
		}
	}

	// 2. User has not purchased this report; enforce Sacred Rule 3
	return nil, ErrReportLocked
}

// UnlockWithCoins unlocks report using Airdrop coins strictly and persists purchase record with idempotency
func (s *GiftsService) UnlockWithCoins(ctx context.Context, userID int64, raw string) (*gvengine.GiftValuation, error) {
	ref, err := gvengine.NormalizeGiftIdentifier(raw)
	if err != nil {
		return nil, err
	}

	purchased, _ := s.repo.IsGiftReportPurchased(ctx, userID, ref.GiftID)
	if !purchased {
		requiredCoins := 15000.0
		if s.db == nil || s.db.Pool == nil {
			return nil, ErrInsufficientCoins
		}

		tx, err := s.db.Pool.Begin(ctx)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback(ctx)

		err = s.db.DeductCreditsFIFO(ctx, tx, userID, requiredCoins)
		if err != nil {
			return nil, ErrInsufficientCoins
		}

		val, err := s.engine.Valuate(ctx, ref.GiftID)
		if err != nil {
			return nil, err
		}

		// Persist purchased report within transaction
		snapJSON, _ := json.Marshal(val)
		fairNano := val.ExpectedGRAM.Mul(decimal.NewFromInt(1e9)).IntPart()
		_, err = s.repo.SaveGiftReport(ctx, userID, ref.GiftID, ref.ModelID, ref.SerialNumber, fairNano, int(val.ConfidenceScore), snapJSON)
		if err != nil {
			return nil, err
		}

		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}

		return val, nil
	}

	return s.engine.Valuate(ctx, raw)
}

// UnlockWithCredit unlocks report using 1 shared Intel Credit with strict atomic check and persists purchase
func (s *GiftsService) UnlockWithCredit(ctx context.Context, userID int64, raw string) (*gvengine.GiftValuation, error) {
	ref, err := gvengine.NormalizeGiftIdentifier(raw)
	if err != nil {
		return nil, err
	}

	purchased, _ := s.repo.IsGiftReportPurchased(ctx, userID, ref.GiftID)
	if !purchased {
		if s.creditRepo == nil {
			return nil, ErrInsufficientCredit
		}
		idemKey := fmt.Sprintf("report:gift:%d:%s", userID, ref.GiftID)
		_, err := s.creditRepo.ConsumeCreditFIFO(ctx, userID, "report:gift", ref.GiftID, idemKey)
		if err != nil {
			return nil, ErrInsufficientCredit
		}
	}

	val, err := s.engine.Valuate(ctx, ref.GiftID)
	if err != nil {
		return nil, err
	}

	// Persist purchased report
	if userID > 0 {
		snapJSON, _ := json.Marshal(val)
		fairNano := val.ExpectedGRAM.Mul(decimal.NewFromInt(1e9)).IntPart()
		_, _ = s.repo.SaveGiftReport(ctx, userID, ref.GiftID, ref.ModelID, ref.SerialNumber, fairNano, int(val.ConfidenceScore), snapJSON)
	}

	return val, nil
}

// GetEnrichedReport returns valuation with verified on-chain and provenance telemetry
func (s *GiftsService) GetEnrichedReport(ctx context.Context, userID int64, raw string) (map[string]interface{}, error) {
	ref, err := gvengine.NormalizeGiftIdentifier(raw)
	if err != nil {
		return nil, err
	}

	// Fix Bug 7: Enforce entitlement (Paywall). If user has not purchased report, return curiosity gate + public metadata only
	purchased := false
	if userID > 0 {
		purchased, _ = s.repo.IsGiftReportPurchased(ctx, userID, ref.GiftID)
	}

	col, hasCol := traits.ResolveCollection(ref.ModelID)
	name := ref.ModelID
	contractAddr := ""
	if hasCol {
		name = col.Name
		contractAddr = col.ContractID
	}

	if !purchased {
		var gate *gvengine.CuriosityGateResponse
		if s.engine != nil {
			gate, err = s.engine.GenerateCuriosityGate(ctx, ref.GiftID)
			if err != nil {
				return nil, err
			}
		}

		imageURL := ""
		if s.engine != nil && s.engine.GetNFTResolver() != nil {
			if live, err := s.engine.GetNFTResolver().ResolveGiftNFT(ctx, ref.ModelID, ref.SerialNumber); err == nil && live != nil {
				imageURL = live.ImageURL
			}
		}

		marketplaceLinks := map[string]string{
			"fragment": fmt.Sprintf("https://fragment.com/gift/%s-%d", ref.ModelID, ref.SerialNumber),
			"getgems":  "https://getgems.io",
		}
		if contractAddr != "" {
			marketplaceLinks["getgems"] = fmt.Sprintf("https://getgems.io/collection/%s", contractAddr)
		}

		return map[string]interface{}{
			"is_unlocked":        false,
			"requires_unlock":    true,
			"gift_id":            ref.GiftID,
			"model_id":           ref.ModelID,
			"serial_number":      ref.SerialNumber,
			"name":               name,
			"image_url":          imageURL,
			"contract_address":   contractAddr,
			"marketplace_links":  marketplaceLinks,
			"curiosity_gate":     gate,
			"unlock_cost_coins":  15000,
			"unlock_cost_credit": 1,
			"message":            "Full valuation report is locked. Unlock with 15,000 Coins or 1 Intel Credit.",
		}, nil
	}

	val, err := s.engine.Valuate(ctx, ref.GiftID)
	if err != nil {
		return nil, err
	}

	// Fetch official live details if available
	ownerName := val.OwnerName
	imageURL := val.ImageURL
	if s.engine != nil && s.engine.GetNFTResolver() != nil {
		if live, err := s.engine.GetNFTResolver().ResolveGiftNFT(ctx, ref.ModelID, ref.SerialNumber); err == nil && live != nil {
			if live.OwnerName != "" {
				ownerName = live.OwnerName
			}
			if live.ImageURL != "" {
				imageURL = live.ImageURL
			}
		}
	}

	if contractAddr == "" && hasCol && col.ContractID != "" {
		contractAddr = col.ContractID
	}

	isWallet := strings.HasPrefix(ownerName, "EQ") || strings.HasPrefix(ownerName, "UQ") || strings.HasPrefix(ownerName, "0:")
	ownerAddr := ""
	if isWallet {
		ownerAddr = ownerName
	}

	tonviewerURL := ""
	if ownerAddr != "" {
		tonviewerURL = fmt.Sprintf("https://tonviewer.com/%s", ownerAddr)
	} else if contractAddr != "" {
		tonviewerURL = fmt.Sprintf("https://tonviewer.com/%s", contractAddr)
	}

	tonscanURL := ""
	if ownerAddr != "" {
		tonscanURL = fmt.Sprintf("https://tonscan.org/address/%s", ownerAddr)
	} else if contractAddr != "" {
		tonscanURL = fmt.Sprintf("https://tonscan.org/address/%s", contractAddr)
	}

	marketplaceLinks := map[string]string{
		"fragment": fmt.Sprintf("https://fragment.com/gift/%s-%d", ref.ModelID, ref.SerialNumber),
		"getgems":  "https://getgems.io",
	}
	if contractAddr != "" {
		marketplaceLinks["getgems"] = fmt.Sprintf("https://getgems.io/collection/%s", contractAddr)
	}

	rarityPercentile := 0.05
	if val.ConfidenceScore > 0 {
		rarityPercentile = float64(val.ConfidenceScore) / 1000.0
	}
	rarityScore := round2(100.0 - (rarityPercentile * 100.0))
	rarityRank := ref.SerialNumber
	if rarityRank <= 0 {
		rarityRank = 1
	}

	var provenance []map[string]interface{}
	for _, c := range val.Comps {
		tvURL := ""
		evidenceStatus := "unavailable"
		if c.TonviewerURL != "" && !strings.HasSuffix(c.TonviewerURL, "tonviewer.com") && !strings.HasSuffix(c.TonviewerURL, "tonviewer.com/") {
			tvURL = c.TonviewerURL
			evidenceStatus = "verified_tx"
		}
		provenance = append(provenance, map[string]interface{}{
			"event_type":      "sale",
			"price_gram":      c.SalePriceGRAM,
			"venue":           c.Venue,
			"timestamp":       c.SaleDate.Format(time.RFC3339),
			"note":            fmt.Sprintf("Verified sale on %s", c.Venue),
			"tonviewer_url":   tvURL,
			"evidence_status": evidenceStatus,
		})
	}
	if len(provenance) == 0 {
		provenance = append(provenance, map[string]interface{}{
			"event_type":    "mint",
			"timestamp":     time.Now().AddDate(0, -1, 0).Format(time.RFC3339),
			"note":          fmt.Sprintf("Minted as official Telegram Collectible %s #%d", val.ModelName, ref.SerialNumber),
			"tonviewer_url": tonviewerURL,
		})
	}

	// Serialize base valuation into map
	valBytes, err := json.Marshal(val)
	if err != nil {
		return nil, err
	}
	var res map[string]interface{}
	if err := json.Unmarshal(valBytes, &res); err != nil {
		return nil, err
	}

	isOnChain := isWallet || contractAddr != ""
	custodyType := "in_app_stars"
	if isOnChain {
		custodyType = "on_chain_nft"
	}

	hostName := ""
	if !isWallet && ownerName != "" {
		hostName = ownerName
	}

	isEscrow := false
	ownerLower := strings.ToLower(ownerAddr)
	escrowName := ""
	if strings.Contains(ownerLower, "escrow") || strings.Contains(ownerLower, "getgems") || strings.Contains(ownerLower, "fragment") {
		isEscrow = true
		if strings.Contains(ownerLower, "getgems") {
			escrowName = "Getgems Escrow Contract"
		} else {
			escrowName = "Fragment Escrow Contract"
		}
	}

	expectedTON := val.ExpectedGRAM.InexactFloat64()
	if expectedTON <= 0 {
		expectedTON = val.BasePriceGRAM.InexactFloat64()
	}
	tonRate := 0.0
	if s.cryptoPrice != nil {
		if r, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && r > 0 {
			tonRate = r
		}
	}

	calcVenue := func(name string, feePct float64, gasTON float64) map[string]interface{} {
		feeTON := math.Round((expectedTON * (feePct / 100.0)) * 100) / 100
		netTON := math.Max(0.0, math.Round((expectedTON - feeTON - gasTON) * 100) / 100)
		netUSD := 0.0
		if tonRate > 0 {
			netUSD = math.Round(netTON * tonRate * 100) / 100
		}
		return map[string]interface{}{
			"venue":            name,
			"fee_pct":          feePct,
			"fee_ton":          feeTON,
			"gas_ton":          gasTON,
			"net_proceeds_ton": netTON,
			"net_proceeds_usd": netUSD,
		}
	}

	venueFeeMatrix := []map[string]interface{}{
		calcVenue("Fragment", 5.0, 0.05),
		calcVenue("Getgems", 5.0, 0.08),
		calcVenue("Portals", 2.5, 0.05),
		calcVenue("Tonnel", 3.0, 0.05),
		calcVenue("MRKT", 2.0, 0.05),
	}

	res["is_unlocked"] = true
	res["requires_unlock"] = false
	res["owner_name"] = ownerName
	if imageURL != "" {
		res["image_url"] = imageURL
	}
	res["rarity_score"] = rarityScore
	res["rarity_rank"] = rarityRank
	res["rarity_percentile"] = rarityPercentile
	res["provenance"] = provenance
	res["custody_type"] = custodyType
	res["host_profile"] = map[string]interface{}{
		"host_name":    hostName,
		"is_showcased": hostName != "",
		"note":         "کاربری که گیفت را در ویترین پروفایل تلگرام نمایش می‌دهد.",
	}
	res["owner_wallet"] = map[string]interface{}{
		"wallet_address": ownerAddr,
		"is_escrow":      isEscrow,
		"escrow_name":    escrowName,
		"note":           "والت دارنده کلید خصوصی NFT در شبکه بلاکچین TON.",
	}
	res["venue_fee_matrix"] = venueFeeMatrix
	res["upgrade_info"] = map[string]interface{}{
		"is_upgraded":       isOnChain,
		"upgrade_fee_stars": 25,
		"custody_notice":    "گیفت‌های ارتقایافته (TEP-62) در والت غیرامانی قرار داشته و قابلیت فروش در فرگمنت و گت‌جمز دارند.",
	}
	res["on_chain"] = map[string]interface{}{
		"is_on_chain":        isOnChain,
		"owner_address":     ownerAddr,
		"collection_address": contractAddr,
		"metadata_url":      fmt.Sprintf("https://t.me/nft/%s-%d", telegramnft.FormatPascalName(ref.ModelID), ref.SerialNumber),
		"tonviewer_url":     tonviewerURL,
		"tonscan_url":       tonscanURL,
		"marketplace_links": marketplaceLinks,
	}

	return res, nil
}

// ScanPortfolio scans user gift inventory with strict 10-minute rate limit per caller
func (s *GiftsService) ScanPortfolio(ctx context.Context, callerKey, username string) (*PortfolioScanResponse, error) {
	cleanUser := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(username), "@"))
	if cleanUser == "" {
		return nil, fmt.Errorf("username is required")
	}

	// 10-Minute Rate Limit Check per caller (prevents target lockout griefing, allows self-scan)
	if s.cache != nil && s.cache.Client != nil {
		if callerKey == "" {
			callerKey = cleanUser
		}
		cacheKey := fmt.Sprintf("gifts:portfolio:rl:%s", callerKey)
		set, _ := s.cache.Client.SetNX(ctx, cacheKey, "1", 10*time.Minute).Result()
		if !set {
			return nil, ErrPortfolioRateLimited
		}
	}

	gramUsdRate := 1.42
	if s.cryptoPrice != nil {
		if r, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && r > 0 {
			gramUsdRate = r
		}
	}

	items := make([]PortfolioItemSummary, 0)
	seenGifts := make(map[string]bool)
	modelCounts := make(map[string]int)
	modelValues := make(map[string]float64)
	totalGRAM := 0.0
	historicalInvested := 0.0

	// 1. Look up Telegram user ID
	var telegramID int64
	if s.db != nil && s.db.Pool != nil {
		_ = s.db.Pool.QueryRow(ctx, "SELECT telegram_id FROM users WHERE LOWER(username) = $1 LIMIT 1", cleanUser).Scan(&telegramID)
	}

	// 2. Fetch live gifts via Bot API if available and user is known
	if s.tgClient != nil && telegramID > 0 {
		tgGifts, _, err := s.tgClient.GetUserGifts(ctx, telegramID, 50)
		if err == nil {
			for _, g := range tgGifts {
				if g.IsBurned {
					continue
				}
				gID := g.GiftID
				if gID == "" {
					gID = fmt.Sprintf("%s-%d", strings.ToLower(strings.ReplaceAll(g.Model, " ", "_")), g.Number)
				}
				if seenGifts[gID] {
					continue
				}
				seenGifts[gID] = true

				col, _ := traits.ResolveCollection(g.Model)
				valGRAM := 0.0

				// Check live snapshot floor from repo
				if s.repo != nil {
					if snaps, err := s.repo.GetVenueSnapshots(ctx, col.ModelID); err == nil && len(snaps) > 0 {
						for _, snap := range snaps {
							f, _ := snap.FloorPriceGRAM.Float64()
							if f > 0 && (valGRAM == 0 || f < valGRAM) {
								valGRAM = f
							}
						}
					}
				}

				// Apply serial number rarity factor
				if valGRAM > 0 && g.Number > 0 {
					_, isElite, _ := traits.CalculateSerialPercentile(int(g.Number), col.TotalSupply)
					if isElite {
						valGRAM *= 1.5
					}
				}

				if g.LastResaleAmount > 0 {
					historicalInvested += g.LastResaleAmount
				}

				totalGRAM += valGRAM
				modelCounts[col.ModelID]++
				modelValues[col.ModelID] += valGRAM

				rarity := "Common"
				if g.Rarity > 0 {
					rarity = traits.ClassifyRarityTier(g.Rarity)
				}

				items = append(items, PortfolioItemSummary{
					GiftID:           gID,
					ModelName:        col.Name,
					SerialNumber:     int(g.Number),
					EstimatedValGRAM: round2(valGRAM),
					EstimatedValUSD:  round2(valGRAM * gramUsdRate),
					RarityTier:       rarity,
					ReportDeepLink:   fmt.Sprintf("/gifts/report?g=%s", gID),
				})
			}
		}
	}

	// 3. Supplement with user's verified reports or purchased assets from database
	if s.db != nil && s.db.Pool != nil && telegramID > 0 {
		rows, err := s.db.Pool.Query(ctx, `
			SELECT gift_id, model_id, serial_number, fair_value_nano_gram
			FROM gift_reports
			WHERE user_id = $1
			ORDER BY purchased_at DESC LIMIT 20`, telegramID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var gID, mID string
				var sNum int
				var fNano int64
				if err := rows.Scan(&gID, &mID, &sNum, &fNano); err == nil {
					if seenGifts[gID] {
						continue
					}
					seenGifts[gID] = true
					valGRAM := float64(fNano) / 1e9
					totalGRAM += valGRAM
					col, _ := traits.ResolveCollection(mID)
					modelCounts[col.ModelID]++
					modelValues[col.ModelID] += valGRAM

					items = append(items, PortfolioItemSummary{
						GiftID:           gID,
						ModelName:        col.Name,
						SerialNumber:     sNum,
						EstimatedValGRAM: round2(valGRAM),
						EstimatedValUSD:  round2(valGRAM * gramUsdRate),
						RarityTier:       "Measured",
						ReportDeepLink:   fmt.Sprintf("/gifts/report?g=%s", gID),
					})
				}
			}
		}
	}

	// 4. Compute Collection Breakdown
	breakdown := make([]CollectionShareItem, 0, len(modelCounts))
	for mID, count := range modelCounts {
		col, _ := traits.ResolveCollection(mID)
		vGRAM := modelValues[mID]
		sharePct := 0.0
		if totalGRAM > 0 {
			sharePct = round2((vGRAM / totalGRAM) * 100.0)
		}
		breakdown = append(breakdown, CollectionShareItem{
			ModelID:      mID,
			ModelName:    col.Name,
			Count:        count,
			TotalValGRAM: round2(vGRAM),
			SharePercent: sharePct,
		})
	}

	pnlGRAM := 0.0
	pnlPct := 0.0
	if historicalInvested > 0 {
		pnlGRAM = round2(totalGRAM - historicalInvested)
		pnlPct = round2((pnlGRAM / historicalInvested) * 100.0)
	}

	return &PortfolioScanResponse{
		Username:               cleanUser,
		TotalGiftsCount:        len(items),
		TotalPortfolioValGRAM:  round2(totalGRAM),
		TotalPortfolioValUSD:   round2(totalGRAM * gramUsdRate),
		HistoricalInvestedGRAM: round2(historicalInvested),
		TotalPnLGRAM:           pnlGRAM,
		TotalPnLPercent:        pnlPct,
		TopValuedGifts:         items,
		CollectionBreakdown:    breakdown,
		ScannedAt:              time.Now().UTC(),
	}, nil
}

// CalculateCraftingEV runs public crafting EV simulation
func (s *GiftsService) CalculateCraftingEV(ctx context.Context, inputs []crafting.CraftInputItem) (*crafting.CraftingEVResult, error) {
	gramUsdRate := 1.42
	if s.cryptoPrice != nil {
		if r, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && r > 0 {
			gramUsdRate = r
		}
	}

	// Fix Bug 6: Re-valuate inputs server-side rather than trusting client-provided prices
	verifiedInputs := make([]crafting.CraftInputItem, len(inputs))
	for i, in := range inputs {
		verified := in
		if in.GiftID != "" {
			if ref, err := gvengine.NormalizeGiftIdentifier(in.GiftID); err == nil {
				verified.ModelID = ref.ModelID
				verified.SerialNumber = ref.SerialNumber
				if val, err := s.engine.Valuate(ctx, ref.GiftID); err == nil && val != nil {
					fGram, _ := val.ExpectedGRAM.Float64()
					if fGram > 0 {
						verified.EstimatedValueGRAM = fGram
					}
				}
			}
		}
		if verified.EstimatedValueGRAM <= 0 {
			if col, ok := traits.ResolveCollection(verified.ModelID); ok {
				verified.Name = col.Name
				verified.EstimatedValueGRAM = 10.0
			}
		}
		verifiedInputs[i] = verified
	}

	return crafting.CalculateCraftingEV(ctx, verifiedInputs, gramUsdRate, 0)
}

// GetUpgradeAdvice generates recommendations based on decay curve
func (s *GiftsService) GetUpgradeAdvice(ctx context.Context, raw string) (*upgrade.UpgradeAdviceReport, error) {
	ref, err := gvengine.NormalizeGiftIdentifier(raw)
	if err != nil {
		return nil, err
	}

	col, _ := traits.ResolveCollection(ref.ModelID)
	supply := col.TotalSupply
	if supply <= 0 {
		supply = 5000
	}

	gramUsdRate := 1.42
	if s.cryptoPrice != nil {
		if r, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && r > 0 {
			gramUsdRate = r
		}
	}

	return upgrade.GenerateUpgradeAdvice(ctx, ref.GiftID, ref.ModelID, supply, gramUsdRate), nil
}

// ToggleWatchlist enables notification alerts (Sacred Rule 4: only allowed if report purchased)
func (s *GiftsService) ToggleWatchlist(ctx context.Context, userID int64, giftID string, enable bool) error {
	ref, err := gvengine.NormalizeGiftIdentifier(giftID)
	if err != nil {
		return err
	}

	purchased, err := s.repo.IsGiftReportPurchased(ctx, userID, ref.GiftID)
	if err != nil || !purchased {
		return ErrReportNotPurchased
	}

	if enable {
		return s.repo.AddToWatchlist(ctx, userID, ref.GiftID)
	}
	return s.repo.RemoveFromWatchlist(ctx, userID, ref.GiftID)
}

// GetWatchlist returns list of watched gifts
func (s *GiftsService) GetWatchlist(ctx context.Context, userID int64) ([]repository.GiftWatchlistItem, error) {
	return s.repo.GetWatchlist(ctx, userID)
}

// GetGiftImageBytes returns cached PNG image bytes for a given gift and optional model
func (s *GiftsService) GetGiftImageBytes(ctx context.Context, slug, model string) ([]byte, error) {
	if s.giftchangesClient == nil {
		return nil, errors.New("giftchanges client not initialized")
	}
	return s.giftchangesClient.GetGiftImageBytes(ctx, slug, model)
}
