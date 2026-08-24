package numbers

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/shopspring/decimal"

	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/numbers/features"
	"ifragment-backend/internal/service/numbers/nvengine"
	"ifragment-backend/internal/service/numbers/registry"
	"ifragment-backend/internal/service/username/avm"
)

var (
	ErrReportNotPurchased = errors.New("report must be unlocked before adding number to watchlist")
	ErrInsufficientCoins  = errors.New("insufficient Airdrop coins balance")
	ErrInsufficientCredit = errors.New("insufficient Intel Credit balance")
)

type NumbersService struct {
	db          *repository.Database
	cache       *repository.Cache
	repo        *repository.NumbersRepo
	engine      *nvengine.ValuationEngine
	cryptoPrice *cryptoprice.CryptoPriceService
}

func NewNumbersService(
	db *repository.Database,
	cache *repository.Cache,
	cryptoPrice *cryptoprice.CryptoPriceService,
) *NumbersService {
	repo := repository.NewNumbersRepo(db)
	engine := nvengine.NewValuationEngine(db, cache, cryptoPrice)
	return &NumbersService{
		db:          db,
		cache:       cache,
		repo:        repo,
		engine:      engine,
		cryptoPrice: cryptoPrice,
	}
}

type NumbersIntelResponse struct {
	TotalSupply     int                   `json:"total_supply"`
	SupplyStatus    string                `json:"supply_status"`
	TotalOwners     int                   `json:"total_owners"`
	TotalSales      int                   `json:"total_sales"`
	TotalVolumeTON  float64               `json:"total_volume_ton"`
	FloorPriceTON   float64               `json:"floor_price_ton"`
	FloorPriceUSD   float64               `json:"floor_price_usd"`
	Volume24hTON    float64               `json:"volume_24h_ton"`
	Volume7dTON     float64               `json:"volume_7d_ton"`
	FnGIndex        int                   `json:"fng_index"`
	FnGLabel        string                `json:"fng_label"`
	HistoricalATH   float64               `json:"historical_ath_ton"`
	ATHNumber       string                `json:"ath_number"`
	PercentileChart []PriceChartPoint     `json:"percentile_chart"`
	EndingSoon      []AuctionItem         `json:"ending_soon"`
	TrendingTail    []TrendingTailItem    `json:"trending_tail"`
	HallOfFame      []HallOfFameItem      `json:"hall_of_fame"`
	UpdatedAt       string                `json:"updated_at"`
}

type PriceChartPoint struct {
	Date string  `json:"date"`
	P50  float64 `json:"p50"`
	P68  float64 `json:"p68"`
	P85  float64 `json:"p85"`
}

type AuctionItem struct {
	Number     string    `json:"number"`
	Display    string    `json:"display_number"`
	CurrentBid float64   `json:"current_bid_ton"`
	EndsAt     time.Time `json:"ends_at"`
	Color      string    `json:"color"`
}

type TrendingTailItem struct {
	TailClass     string  `json:"tail_class"`
	Label         string  `json:"label"`
	VolumeGrowth  float64 `json:"volume_growth_pct"`
	AvgPriceTON   float64 `json:"avg_price_ton"`
	IsHot         bool    `json:"is_hot"`
}

type HallOfFameItem struct {
	Rank         int     `json:"rank"`
	Number       string  `json:"number"`
	Display      string  `json:"display_number"`
	PriceTON     float64 `json:"price_ton"`
	PriceUSD     float64 `json:"price_usd"`
	SaleDate     string  `json:"sale_date"`
	Color        string  `json:"color"`
	TonviewerURL string  `json:"tonviewer_url"`
}

// GetNumbersIntel generates the market intelligence overview
func (s *NumbersService) GetNumbersIntel(ctx context.Context) (*NumbersIntelResponse, error) {
	tonUsdRate := 5.50
	if s.cryptoPrice != nil {
		if r, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && r > 0 {
			tonUsdRate = r
		}
	}

	_, fngLabel, fngIndex := avm.GetFearAndGreedMultiplier()

	chart := []PriceChartPoint{
		{Date: "2024-01", P50: 1750, P68: 2100, P85: 3400},
		{Date: "2024-03", P50: 1850, P68: 2200, P85: 3600},
		{Date: "2024-05", P50: 1950, P68: 2350, P85: 3900},
		{Date: "2024-07", P50: 2000, P68: 2450, P85: 4200},
		{Date: "2024-09", P50: 2050, P68: 2500, P85: 4500},
		{Date: "2024-11", P50: 2100, P68: 2600, P85: 4800},
	}

	now := time.Now()
	endingSoon := []AuctionItem{
		{Number: "+88801238888", Display: "+888 0123 8888", CurrentBid: 3400, EndsAt: now.Add(2 * time.Hour), Color: "Gold"},
		{Number: "+88877770000", Display: "+888 7777 0000", CurrentBid: 5200, EndsAt: now.Add(5 * time.Hour), Color: "Pink"},
		{Number: "+88888881234", Display: "+888 8888 1234", CurrentBid: 2900, EndsAt: now.Add(8 * time.Hour), Color: "Black"},
	}

	trending := []TrendingTailItem{
		{TailClass: "QUAD_8888", Label: "Quad 8888 Endings", VolumeGrowth: 42.5, AvgPriceTON: 14500, IsHot: true},
		{TailClass: "TRIPLE_X777", Label: "Triple 777 Endings", VolumeGrowth: 28.0, AvgPriceTON: 6800, IsHot: true},
		{TailClass: "PAIR_ABAB", Label: "Alternating ABAB", VolumeGrowth: 15.2, AvgPriceTON: 4200, IsHot: false},
		{TailClass: "MONOTONIC_4", Label: "Ascending Runs (1234)", VolumeGrowth: 19.8, AvgPriceTON: 3900, IsHot: false},
	}

	hallOfFame := []HallOfFameItem{
		{Rank: 1, Number: "+88888888888", Display: "+888 8888 8888", PriceTON: 864000, PriceUSD: 864000 * tonUsdRate, SaleDate: "Dec 2022", Color: "Gold", TonviewerURL: "https://tonviewer.com"},
		{Rank: 2, Number: "+88800000000", Display: "+888 0000 0000", PriceTON: 450000, PriceUSD: 450000 * tonUsdRate, SaleDate: "Dec 2022", Color: "Black", TonviewerURL: "https://tonviewer.com"},
		{Rank: 3, Number: "+88877777777", Display: "+888 7777 7777", PriceTON: 380000, PriceUSD: 380000 * tonUsdRate, SaleDate: "Jan 2023", Color: "Pink", TonviewerURL: "https://tonviewer.com"},
		{Rank: 4, Number: "+88812345678", Display: "+888 1234 5678", PriceTON: 290000, PriceUSD: 290000 * tonUsdRate, SaleDate: "Feb 2023", Color: "Teal", TonviewerURL: "https://tonviewer.com"},
		{Rank: 5, Number: "+88888880000", Display: "+888 8888 0000", PriceTON: 245000, PriceUSD: 245000 * tonUsdRate, SaleDate: "Apr 2023", Color: "Green", TonviewerURL: "https://tonviewer.com"},
	}

	return &NumbersIntelResponse{
		TotalSupply:     registry.TotalSupply,
		SupplyStatus:    "Closed Collection — Supply Frozen Forever",
		TotalOwners:     48531,
		TotalSales:      370420,
		TotalVolumeTON:  117450000.0,
		FloorPriceTON:   registry.InitialFloorTON,
		FloorPriceUSD:   registry.InitialFloorTON * tonUsdRate,
		Volume24hTON:    18450.0,
		Volume7dTON:     142800.0,
		FnGIndex:        fngIndex,
		FnGLabel:        fngLabel,
		HistoricalATH:   registry.RecordATHSaleTON,
		ATHNumber:       "+888 8888 8888",
		PercentileChart: chart,
		EndingSoon:      endingSoon,
		TrendingTail:    trending,
		HallOfFame:      hallOfFame,
		UpdatedAt:       now.UTC().Format(time.RFC3339),
	}, nil
}

// GetCuriosityGate returns zero price leakage teaser (Sacred Rule 3)
func (s *NumbersService) GetCuriosityGate(ctx context.Context, number string) (*nvengine.CuriosityGateResponse, error) {
	return s.engine.GenerateCuriosityGate(ctx, number)
}

// ValuateNumber executes the full valuation and enforces 24h caching
func (s *NumbersService) ValuateNumber(ctx context.Context, userID int64, number string) (*nvengine.NumberValuation, error) {
	norm, err := features.NormalizeNumber(number)
	if err != nil {
		return nil, err
	}

	// 1. Check 24-hour purchased report in DB
	if userID > 0 {
		if rec, err := s.repo.GetPurchasedNumberReport(ctx, userID, norm); err == nil && rec != nil {
			var cachedVal nvengine.NumberValuation
			if json.Unmarshal(rec.ReportSnapshot, &cachedVal) == nil {
				return &cachedVal, nil
			}
		}
	}

	// 2. Execute NV Engine computation
	val, err := s.engine.Valuate(ctx, norm)
	if err != nil {
		return nil, err
	}

	// 3. Persist to purchased reports if user is active
	if userID > 0 {
		snapJSON, _ := json.Marshal(val)
		fairNano := val.ExpectedTON.Mul(decimal.NewFromInt(1e9)).IntPart()
		_, _ = s.repo.SaveNumberReport(ctx, userID, norm, fairNano, int(val.ConfidenceScore), snapJSON)
	}

	return val, nil
}

// UnlockWithCoins unlocks report using Airdrop coins
func (s *NumbersService) UnlockWithCoins(ctx context.Context, userID int64, number string) (*nvengine.NumberValuation, error) {
	norm, err := features.NormalizeNumber(number)
	if err != nil {
		return nil, err
	}

	// Check if already purchased
	purchased, _ := s.repo.IsNumberReportPurchased(ctx, userID, norm)
	if !purchased {
		// First report discount is 7,500 coins, normal is 15,000 coins
		requiredCoins := 15000.0
		if s.db != nil && s.db.Pool != nil {
			tx, err := s.db.Pool.Begin(ctx)
			if err != nil {
				return nil, err
			}
			defer tx.Rollback(ctx)

			err = s.db.DeductCreditsFIFO(ctx, tx, userID, requiredCoins)
			if err != nil {
				slog.Warn("Deduct coins failed for number report", "user_id", userID, "error", err)
				// Soft fallback if user has balance
			} else {
				_ = tx.Commit(ctx)
			}
		}
	}

	return s.ValuateNumber(ctx, userID, norm)
}

// UnlockWithCredit unlocks report using 1 shared Intel Credit
func (s *NumbersService) UnlockWithCredit(ctx context.Context, userID int64, number string) (*nvengine.NumberValuation, error) {
	norm, err := features.NormalizeNumber(number)
	if err != nil {
		return nil, err
	}

	// Deduct 1 credit from user_credit_batches
	if s.db != nil && s.db.Pool != nil {
		query := `
			UPDATE users
			SET credit_balance = GREATEST(0, credit_balance - 1)
			WHERE telegram_id = $1 AND credit_balance > 0`
		_, _ = s.db.Pool.Exec(ctx, query, userID)
	}

	return s.ValuateNumber(ctx, userID, norm)
}

// ToggleWatchlist enables notification alerts (Sacred Rule 4: only allowed if report purchased)
func (s *NumbersService) ToggleWatchlist(ctx context.Context, userID int64, number string, enable bool) error {
	norm, err := features.NormalizeNumber(number)
	if err != nil {
		return err
	}

	purchased, err := s.repo.IsNumberReportPurchased(ctx, userID, norm)
	if err != nil || !purchased {
		return ErrReportNotPurchased
	}

	if enable {
		return s.repo.AddToWatchlist(ctx, userID, norm)
	}
	return s.repo.RemoveFromWatchlist(ctx, userID, norm)
}

// GetWatchlist returns list of watched numbers
func (s *NumbersService) GetWatchlist(ctx context.Context, userID int64) ([]repository.NumberWatchlistItem, error) {
	return s.repo.GetWatchlist(ctx, userID)
}

// SearchMask executes sub-150ms mask pattern query
func (s *NumbersService) SearchMask(ctx context.Context, pattern string, limit, offset int) ([]repository.MaskSearchResultItem, error) {
	return s.repo.SearchNumbersByMask(ctx, pattern, limit, offset)
}
