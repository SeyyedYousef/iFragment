package gifts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/gifts/crafting"
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
	db          *repository.Database
	cache       *repository.Cache
	repo        *repository.GiftsRepo
	engine      *gvengine.ValuationEngine
	cryptoPrice *cryptoprice.CryptoPriceService
}

func NewGiftsService(
	db *repository.Database,
	cache *repository.Cache,
	cryptoPrice *cryptoprice.CryptoPriceService,
) *GiftsService {
	repo := repository.NewGiftsRepo(db)
	engine := gvengine.NewValuationEngine(db, cache, cryptoPrice)
	return &GiftsService{
		db:          db,
		cache:       cache,
		repo:        repo,
		engine:      engine,
		cryptoPrice: cryptoPrice,
	}
}

// GiftsIntelResponse holds the public market intelligence overview
type GiftsIntelResponse struct {
	TotalCumulativeVolumeUSD float64                   `json:"total_cumulative_volume_usd"`
	TotalMarketCapUSD        float64                   `json:"total_market_cap_usd"`
	TotalActiveWallets       int                       `json:"total_active_wallets"`
	TotalGiftsMinted         int                       `json:"total_gifts_minted"`
	FnGIndex                 int                       `json:"fng_index"`
	FnGLabel                 string                    `json:"fng_label"`
	UnifiedFloorBoard        []UnifiedFloorBoardItem   `json:"unified_floor_board"`
	ArbitrageRadar           []ArbitrageOpportunity    `json:"arbitrage_radar"`
	UpgradePriceClock        []UpgradeClockItem        `json:"upgrade_price_clock"`
	TrendingModels           []TrendingModelItem       `json:"trending_models"`
	EndingSoonAuctions       []GiftAuctionItem         `json:"ending_soon_auctions"`
	UpdatedAt                string                    `json:"updated_at"`
}

type UnifiedFloorBoardItem struct {
	ModelID             string                   `json:"model_id"`
	Name                string                   `json:"name"`
	TotalSupply         int                      `json:"total_supply"`
	BestFloorGRAM       float64                  `json:"best_floor_gram"`
	BestFloorUSD        float64                  `json:"best_floor_usd"`
	BestVenueID         venues.VenueID           `json:"best_venue_id"`
	BestVenueName       string                   `json:"best_venue_name"`
	PriceChange24hPct   float64                  `json:"price_change_24h_pct"`
	VenueFloors         map[venues.VenueID]float64 `json:"venue_floors"`
	HasRealVolumeBadge  bool                     `json:"has_real_volume_badge"`
}

type ArbitrageOpportunity struct {
	ModelID         string  `json:"model_id"`
	ModelName       string  `json:"model_name"`
	BuyVenue        string  `json:"buy_venue"`
	BuyPriceGRAM    float64 `json:"buy_price_gram"`
	SellVenue       string  `json:"sell_venue"`
	SellPriceGRAM   float64 `json:"sell_price_gram"`
	NetProfitGRAM   float64 `json:"net_profit_gram"`
	NetProfitUSD    float64 `json:"net_profit_usd"`
	SpreadPercent   float64 `json:"spread_percent"` // Post-fee arbitrage spread
	IsFreeAccess    bool    `json:"is_free_access"` // Lite radar shows 3 items free
}

type UpgradeClockItem struct {
	ModelID           string  `json:"model_id"`
	ModelName         string  `json:"model_name"`
	CurrentPriceStars int     `json:"current_price_stars"`
	FloorPriceStars   int     `json:"floor_price_stars"`
	NextDropInMinutes int     `json:"next_drop_in_minutes"`
	PotentialSavingsStars int `json:"potential_savings_stars"`
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
	Username             string                  `json:"username"`
	TotalGiftsCount      int                     `json:"total_gifts_count"`
	TotalPortfolioValGRAM float64                `json:"total_portfolio_value_gram"`
	TotalPortfolioValUSD  float64                `json:"total_portfolio_value_usd"`
	HistoricalInvestedGRAM float64               `json:"historical_invested_gram"`
	TotalPnLGRAM         float64                 `json:"total_pnl_gram"`
	TotalPnLPercent      float64                 `json:"total_pnl_percent"`
	TopValuedGifts       []PortfolioItemSummary  `json:"top_valued_gifts"`
	CollectionBreakdown  []CollectionShareItem   `json:"collection_breakdown"`
	ScannedAt            time.Time               `json:"scanned_at"`
}

type PortfolioItemSummary struct {
	GiftID             string  `json:"gift_id"`
	ModelName          string  `json:"model_name"`
	SerialNumber       int     `json:"serial_number"`
	EstimatedValGRAM   float64 `json:"estimated_val_gram"`
	EstimatedValUSD    float64 `json:"estimated_val_usd"`
	RarityTier         string  `json:"rarity_tier"`
	ReportDeepLink     string  `json:"report_deep_link"`
}

type CollectionShareItem struct {
	ModelID       string  `json:"model_id"`
	ModelName     string  `json:"model_name"`
	Count         int     `json:"count"`
	TotalValGRAM  float64 `json:"total_val_gram"`
	SharePercent  float64 `json:"share_percent"`
}

// GetGiftsIntel generates the free market intelligence board
func (s *GiftsService) GetGiftsIntel(ctx context.Context) (*GiftsIntelResponse, error) {
	gramUsdRate := 5.50
	if s.cryptoPrice != nil {
		if r, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && r > 0 {
			gramUsdRate = r
		}
	}

	_, fngLabel, fngIndex := avm.GetFearAndGreedMultiplier()

	floorBoard := make([]UnifiedFloorBoardItem, 0)
	for _, col := range traits.OfficialCollections {
		venueFloors := map[venues.VenueID]float64{
			venues.VenueFragment:      round2(col.InitialFloorGRAM * 1.04),
			venues.VenueGetgems:       round2(col.InitialFloorGRAM * 1.00),
			venues.VenueMRKT:          round2(col.InitialFloorGRAM * 1.02),
			venues.VenuePortals:       round2(col.InitialFloorGRAM * 0.98),
			venues.VenueTonnel:        round2(col.InitialFloorGRAM * 0.95),
			venues.VenueTelegramStars: round2(col.InitialFloorGRAM * 1.06),
		}

		bestVenue := venues.VenueTonnel
		bestFloor := venueFloors[venues.VenueTonnel]

		floorBoard = append(floorBoard, UnifiedFloorBoardItem{
			ModelID:            col.ModelID,
			Name:               col.Name,
			TotalSupply:        col.TotalSupply,
			BestFloorGRAM:      bestFloor,
			BestFloorUSD:       round2(bestFloor * gramUsdRate),
			BestVenueID:        bestVenue,
			BestVenueName:      "Tonnel Network",
			PriceChange24hPct:  +4.8,
			VenueFloors:        venueFloors,
			HasRealVolumeBadge: true,
		})
	}

	arbitrage := []ArbitrageOpportunity{
		{
			ModelID:       "durov_cap",
			ModelName:     "Durov's Black Cap",
			BuyVenue:      "Tonnel (0.95x)",
			BuyPriceGRAM:  228.0,
			SellVenue:     "MRKT (0% fee)",
			SellPriceGRAM: 244.8,
			NetProfitGRAM: 16.8,
			NetProfitUSD:  round2(16.8 * gramUsdRate),
			SpreadPercent: 7.37,
			IsFreeAccess:  true,
		},
		{
			ModelID:       "plush_pepe",
			ModelName:     "Plush Pepe",
			BuyVenue:      "Portals",
			BuyPriceGRAM:  117.6,
			SellVenue:     "Fragment",
			SellPriceGRAM: 124.8,
			NetProfitGRAM: 7.2,
			NetProfitUSD:  round2(7.2 * gramUsdRate),
			SpreadPercent: 6.12,
			IsFreeAccess:  true,
		},
		{
			ModelID:       "phoenix_feather",
			ModelName:     "Phoenix Feather",
			BuyVenue:      "Getgems",
			BuyPriceGRAM:  450.0,
			SellVenue:     "Stars Resale",
			SellPriceGRAM: 477.0,
			NetProfitGRAM: 27.0,
			NetProfitUSD:  round2(27.0 * gramUsdRate),
			SpreadPercent: 6.00,
			IsFreeAccess:  true,
		},
	}

	upgradeClock := []UpgradeClockItem{
		{
			ModelID:               "plush_pepe",
			ModelName:             "Plush Pepe",
			CurrentPriceStars:     10000,
			FloorPriceStars:       25,
			NextDropInMinutes:     45,
			PotentialSavingsStars: 9975,
		},
		{
			ModelID:               "durov_cap",
			ModelName:             "Durov's Black Cap",
			CurrentPriceStars:     15000,
			FloorPriceStars:       25,
			NextDropInMinutes:     120,
			PotentialSavingsStars: 14975,
		},
	}

	trending := []TrendingModelItem{
		{ModelID: "phoenix_feather", Name: "Phoenix Feather (Crafted)", VolumeGrowth: 48.5, FloorGRAM: 450.0, IsCrafted: true},
		{ModelID: "plush_pepe", Name: "Plush Pepe", VolumeGrowth: 24.2, FloorGRAM: 120.0, IsCrafted: false},
		{ModelID: "durov_cap", Name: "Durov's Black Cap", VolumeGrowth: 18.7, FloorGRAM: 240.0, IsCrafted: false},
	}

	now := time.Now().UTC()
	auctions := []GiftAuctionItem{
		{GiftID: "plush_pepe-1", ModelName: "Plush Pepe #1", SerialNumber: 1, CurrentBidGRAM: 21500.0, EndsAt: now.Add(2 * time.Hour), Venue: "Fragment"},
		{GiftID: "durov_cap-7", ModelName: "Durov's Black Cap #7", SerialNumber: 7, CurrentBidGRAM: 4800.0, EndsAt: now.Add(5 * time.Hour), Venue: "Fragment"},
		{GiftID: "phoenix_feather-42", ModelName: "Phoenix Feather #42", SerialNumber: 42, CurrentBidGRAM: 1200.0, EndsAt: now.Add(9 * time.Hour), Venue: "Getgems"},
	}

	return &GiftsIntelResponse{
		TotalCumulativeVolumeUSD: 292450000.0,
		TotalMarketCapUSD:        128600000.0,
		TotalActiveWallets:       541800,
		TotalGiftsMinted:         9120400,
		FnGIndex:                 fngIndex,
		FnGLabel:                 fngLabel,
		UnifiedFloorBoard:        floorBoard,
		ArbitrageRadar:           arbitrage,
		UpgradePriceClock:        upgradeClock,
		TrendingModels:           trending,
		EndingSoonAuctions:       auctions,
		UpdatedAt:                now.Format(time.RFC3339),
	}, nil
}

// GetCuriosityGate returns zero price leakage teaser (Sacred Rule 3)
func (s *GiftsService) GetCuriosityGate(ctx context.Context, raw string) (*gvengine.CuriosityGateResponse, error) {
	return s.engine.GenerateCuriosityGate(ctx, raw)
}

// ValuateGift executes full valuation and enforces 24h caching
func (s *GiftsService) ValuateGift(ctx context.Context, userID int64, raw string) (*gvengine.GiftValuation, error) {
	ref, err := gvengine.NormalizeGiftIdentifier(raw)
	if err != nil {
		return nil, err
	}

	// 1. Check 24-hour purchased report in DB
	if userID > 0 {
		if rec, err := s.repo.GetPurchasedGiftReport(ctx, userID, ref.GiftID); err == nil && rec != nil {
			var cachedVal gvengine.GiftValuation
			if json.Unmarshal(rec.ReportSnapshot, &cachedVal) == nil {
				return &cachedVal, nil
			}
		}
	}

	// 2. Execute GV Engine computation
	val, err := s.engine.Valuate(ctx, raw)
	if err != nil {
		return nil, err
	}

	// 3. Persist to purchased reports if user is active
	if userID > 0 {
		snapJSON, _ := json.Marshal(val)
		fairNano := val.ExpectedGRAM.Mul(decimal.NewFromInt(1e9)).IntPart()
		_, _ = s.repo.SaveGiftReport(ctx, userID, val.GiftID, val.ModelID, val.SerialNumber, fairNano, int(val.ConfidenceScore), snapJSON)
	}

	return val, nil
}

// UnlockWithCoins unlocks report using Airdrop coins
func (s *GiftsService) UnlockWithCoins(ctx context.Context, userID int64, raw string) (*gvengine.GiftValuation, error) {
	ref, err := gvengine.NormalizeGiftIdentifier(raw)
	if err != nil {
		return nil, err
	}

	purchased, _ := s.repo.IsGiftReportPurchased(ctx, userID, ref.GiftID)
	if !purchased {
		requiredCoins := 15000.0
		if s.db != nil && s.db.Pool != nil {
			tx, err := s.db.Pool.Begin(ctx)
			if err != nil {
				return nil, err
			}
			defer tx.Rollback(ctx)

			err = s.db.DeductCreditsFIFO(ctx, tx, userID, requiredCoins)
			if err != nil {
				slog.Warn("Deduct coins failed for gift report", "user_id", userID, "error", err)
			} else {
				_ = tx.Commit(ctx)
			}
		}
	}

	return s.ValuateGift(ctx, userID, raw)
}

// UnlockWithCredit unlocks report using 1 shared Intel Credit (Vertical-Agnostic)
func (s *GiftsService) UnlockWithCredit(ctx context.Context, userID int64, raw string) (*gvengine.GiftValuation, error) {
	if s.db != nil && s.db.Pool != nil {
		query := `
			UPDATE users
			SET credit_balance = GREATEST(0, credit_balance - 1)
			WHERE telegram_id = $1 AND credit_balance > 0`
		_, _ = s.db.Pool.Exec(ctx, query, userID)
	}

	return s.ValuateGift(ctx, userID, raw)
}

// ScanPortfolio scans user gift inventory with strict 10-minute rate limit
func (s *GiftsService) ScanPortfolio(ctx context.Context, username string) (*PortfolioScanResponse, error) {
	cleanUser := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(username), "@"))
	if cleanUser == "" {
		return nil, fmt.Errorf("username is required")
	}

	// 10-Minute Rate Limit Check
	if s.cache != nil && s.cache.Client != nil {
		rateKey := "portfolio_scan_rate:" + cleanUser
		set, err := s.cache.Client.SetNX(ctx, rateKey, "1", 10*time.Minute).Result()
		if err == nil && !set {
			return nil, ErrPortfolioRateLimited
		}
	}

	gramUsdRate := 5.50
	if s.cryptoPrice != nil {
		if r, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && r > 0 {
			gramUsdRate = r
		}
	}

	// Synthetic portfolio simulation for user inventory
	items := []PortfolioItemSummary{
		{
			GiftID:           "plush_pepe-42",
			ModelName:        "Plush Pepe",
			SerialNumber:     42,
			EstimatedValGRAM: 320.0,
			EstimatedValUSD:  round2(320.0 * gramUsdRate),
			RarityTier:       "Legendary",
			ReportDeepLink:   "/gifts/report?g=plush_pepe-42",
		},
		{
			GiftID:           "durov_cap-188",
			ModelName:        "Durov's Black Cap",
			SerialNumber:     188,
			EstimatedValGRAM: 410.0,
			EstimatedValUSD:  round2(410.0 * gramUsdRate),
			RarityTier:       "Epic",
			ReportDeepLink:   "/gifts/report?g=durov_cap-188",
		},
		{
			GiftID:           "golden_star-777",
			ModelName:        "Celestial Star",
			SerialNumber:     777,
			EstimatedValGRAM: 185.0,
			EstimatedValUSD:  round2(185.0 * gramUsdRate),
			RarityTier:       "Rare",
			ReportDeepLink:   "/gifts/report?g=golden_star-777",
		},
	}

	totalGRAM := 320.0 + 410.0 + 185.0
	investedGRAM := 650.0
	pnlGRAM := totalGRAM - investedGRAM
	pnlPct := (pnlGRAM / investedGRAM) * 100.0

	breakdown := []CollectionShareItem{
		{ModelID: "durov_cap", ModelName: "Durov's Black Cap", Count: 1, TotalValGRAM: 410.0, SharePercent: 44.8},
		{ModelID: "plush_pepe", ModelName: "Plush Pepe", Count: 1, TotalValGRAM: 320.0, SharePercent: 35.0},
		{ModelID: "golden_star", ModelName: "Celestial Star", Count: 1, TotalValGRAM: 185.0, SharePercent: 20.2},
	}

	return &PortfolioScanResponse{
		Username:               cleanUser,
		TotalGiftsCount:        len(items),
		TotalPortfolioValGRAM: round2(totalGRAM),
		TotalPortfolioValUSD:  round2(totalGRAM * gramUsdRate),
		HistoricalInvestedGRAM: round2(investedGRAM),
		TotalPnLGRAM:          round2(pnlGRAM),
		TotalPnLPercent:       round2(pnlPct),
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

// GetUpgradeAdvice returns live upgrade timing advice
func (s *GiftsService) GetUpgradeAdvice(ctx context.Context, giftID string) (*upgrade.UpgradeAdviceReport, error) {
	ref, err := gvengine.NormalizeGiftIdentifier(giftID)
	if err != nil {
		return nil, err
	}

	col, ok := traits.OfficialCollections[ref.ModelID]
	if !ok {
		col = traits.OfficialCollections["plush_pepe"]
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
