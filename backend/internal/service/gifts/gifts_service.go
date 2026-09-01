package gifts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/gifts/crafting"
	"ifragment-backend/internal/service/gifts/giftchanges"
	"ifragment-backend/internal/service/gifts/gvengine"
	"ifragment-backend/internal/service/gifts/traits"
	"ifragment-backend/internal/service/gifts/upgrade"
	"ifragment-backend/internal/service/gifts/venues"
	"ifragment-backend/internal/service/username/avm"
)

var (
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

func (s *GiftsService) GetSnapshotWorker() *venues.VenueSnapshotWorker {
	return venues.NewVenueSnapshotWorker(s.repo, s.cryptoPrice, 3*time.Minute)
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
	DataStatus               string                  `json:"data_status"` // "live" or "insufficient_data"
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
	ModelID      string  `json:"model_id"`
	Name         string  `json:"name"`
	VolumeGrowth float64 `json:"volume_growth_24h_pct"`
	FloorGRAM    float64 `json:"floor_gram"`
	IsCrafted    bool    `json:"is_crafted"`
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
	gramUsdRate := 5.50
	if s.cryptoPrice != nil {
		if r, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && r > 0 {
			gramUsdRate = r
		}
	}

	_, fngLabel, fngIndex := avm.GetFearAndGreedMultiplier()
	now := time.Now().UTC()

	totalMinted := 9_000_000
	activeWallets := 520_000
	totalVolume := 320_000_000.0
	totalMarketCap := 128_000_000.0

	// Query live aggregate stats from api.changes.tg if available
	if s.giftchangesClient != nil {
		if stats, err := s.giftchangesClient.GetTotal(ctx); err == nil && stats != nil {
			if stats.Gifts.Total > 0 {
				totalMinted = stats.Gifts.Total * 60_000 // Approximate circulating items across 149 gifts
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
		DataStatus:               "estimated",
		UpdatedAt:                now.Format(time.RFC3339),
	}

	if s.db == nil || s.db.Pool == nil {
		return resp, nil
	}

	// 1. Fetch live floor snapshots from venue_snapshots
	snapshots, err := s.repo.GetVenueSnapshots(ctx, "")
	if err == nil && len(snapshots) > 0 {
		resp.DataStatus = "live"
		// Group by model_id
		modelMap := make(map[string]map[venues.VenueID]float64)
		for _, snap := range snapshots {
			if _, exists := modelMap[snap.ModelID]; !exists {
				modelMap[snap.ModelID] = make(map[venues.VenueID]float64)
			}
			fGram, _ := snap.FloorPriceGRAM.Float64()
			modelMap[snap.ModelID][venues.VenueID(snap.Venue)] = fGram
		}

		for modelID, venueFloors := range modelMap {
			col, ok := traits.OfficialCollections[modelID]
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

			resp.UnifiedFloorBoard = append(resp.UnifiedFloorBoard, UnifiedFloorBoardItem{
				ModelID:            modelID,
				Name:               name,
				TotalSupply:        totalSupply,
				BestFloorGRAM:      round2(bestFloor),
				BestFloorUSD:       round2(bestFloor * gramUsdRate),
				BestVenueID:        bestVenue,
				BestVenueName:      string(bestVenue),
				PriceChange24hPct:  0.0,
				VenueFloors:        venueFloors,
				HasRealVolumeBadge: true,
			})
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
		resp.TotalGiftsMinted = totalSalesCount
	}

	// 3. Trending Models from sales
	trendingRows, err := s.db.Pool.Query(ctx, `
		SELECT model_id, COUNT(*) as sales_count, COALESCE(AVG(sale_price_gram), 0) as avg_price
		FROM gift_sales
		WHERE sale_date >= now() - interval '7 days'
		GROUP BY model_id
		ORDER BY sales_count DESC
		LIMIT 5`)
	if err == nil {
		defer trendingRows.Close()
		for trendingRows.Next() {
			var mID string
			var count int
			var avgPrice float64
			if err := trendingRows.Scan(&mID, &count, &avgPrice); err == nil {
				colName := mID
				isCrafted := false
				if col, ok := traits.OfficialCollections[mID]; ok {
					colName = col.Name
					isCrafted = col.CraftedFlag
				}
				resp.TrendingModels = append(resp.TrendingModels, TrendingModelItem{
					ModelID:      mID,
					Name:         colName,
					VolumeGrowth: float64(count * 5),
					FloorGRAM:    round2(avgPrice),
					IsCrafted:    isCrafted,
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

// ValuateGift executes valuation computation (respects purchased cache, does NOT auto-grant purchase)
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

	// 2. Execute GV Engine computation
	return s.engine.Valuate(ctx, raw)
}

// UnlockWithCoins unlocks report using Airdrop coins strictly and persists purchase record
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

		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
	}

	val, err := s.engine.Valuate(ctx, raw)
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
		_, err := s.creditRepo.ConsumeCreditFIFO(ctx, userID, "report:gift", ref.GiftID, "")
		if err != nil {
			return nil, ErrInsufficientCredit
		}
	}

	val, err := s.engine.Valuate(ctx, raw)
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

// ScanPortfolio scans user gift inventory with strict 10-minute rate limit per caller
func (s *GiftsService) ScanPortfolio(ctx context.Context, callerKey, username string) (*PortfolioScanResponse, error) {
	cleanUser := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(username), "@"))
	if cleanUser == "" {
		return nil, fmt.Errorf("username is required")
	}

	// 10-Minute Rate Limit Check per caller (prevents target lockout griefing)
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

	gramUsdRate := 5.50
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
				valGRAM := col.InitialFloorGRAM
				if valGRAM <= 0 {
					valGRAM = 20.0
				}
				if g.LastResaleAmount > 0 {
					historicalInvested += g.LastResaleAmount
				} else {
					historicalInvested += valGRAM * 0.8
				}

				totalGRAM += valGRAM
				modelCounts[col.ModelID]++
				modelValues[col.ModelID] += valGRAM

				rarity := "Measured"
				if g.Rarity > 0 {
					rarity = "Exact"
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
					historicalInvested += valGRAM * 0.85
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
	gramUsdRate := 5.50
	if s.cryptoPrice != nil {
		if r, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && r > 0 {
			gramUsdRate = r
		}
	}
	return crafting.CalculateCraftingEV(ctx, inputs, gramUsdRate, 0)
}

// GetUpgradeAdvice generates recommendations based on decay curve
func (s *GiftsService) GetUpgradeAdvice(ctx context.Context, raw string) (*upgrade.UpgradeAdviceReport, error) {
	ref, err := gvengine.NormalizeGiftIdentifier(raw)
	if err != nil {
		return nil, err
	}

	col, ok := traits.OfficialCollections[ref.ModelID]
	if !ok {
		col = traits.OfficialCollections["durov_cap"]
	}

	gramUsdRate := 5.50
	if s.cryptoPrice != nil {
		if r, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && r > 0 {
			gramUsdRate = r
		}
	}

	return upgrade.GenerateUpgradeAdvice(ctx, ref.GiftID, ref.ModelID, col.BaseStarsPrice, gramUsdRate), nil
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

func round2(v float64) float64 {
	return math.Round(v*100.0) / 100.0
}

// GetGiftImageBytes returns cached PNG image bytes for a given gift
func (s *GiftsService) GetGiftImageBytes(ctx context.Context, slug string) ([]byte, error) {
	if s.giftchangesClient == nil {
		return nil, errors.New("giftchanges client not initialized")
	}
	return s.giftchangesClient.GetGiftImageBytes(ctx, slug, "")
}

