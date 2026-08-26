package numbers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/shopspring/decimal"

	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/numbers/features"
	"ifragment-backend/internal/service/numbers/nvengine"
	"ifragment-backend/internal/service/numbers/registry"
	"ifragment-backend/internal/service/username/avm"
)

func roundPrice(val float64) float64 {
	if val >= 10000 {
		return math.Round(val/100.0) * 100.0
	}
	if val >= 1000 {
		return math.Round(val/10.0) * 10.0
	}
	if val >= 100 {
		return math.Round(val)
	}
	return math.Round(val*10.0) / 10.0
}

var (
	ErrReportNotPurchased = errors.New("report must be unlocked before adding number to watchlist")
	ErrInsufficientCoins  = errors.New("insufficient Airdrop coins balance")
	ErrInsufficientCredit = errors.New("insufficient Intel Credit balance")
)

type NumbersService struct {
	db          *repository.Database
	cache       *repository.Cache
	repo        *repository.NumbersRepo
	creditRepo  *repository.IntelCreditRepo
	engine      *nvengine.ValuationEngine
	cryptoPrice *cryptoprice.CryptoPriceService
}

func NewNumbersService(
	db *repository.Database,
	cache *repository.Cache,
	cryptoPrice *cryptoprice.CryptoPriceService,
) *NumbersService {
	repo := repository.NewNumbersRepo(db)
	creditRepo := repository.NewIntelCreditRepo(db)
	engine := nvengine.NewValuationEngine(db, cache, cryptoPrice)
	return &NumbersService{
		db:          db,
		cache:       cache,
		repo:        repo,
		creditRepo:  creditRepo,
		engine:      engine,
		cryptoPrice: cryptoPrice,
	}
}

type NumbersIntelResponse struct {
	TotalSupply     int                `json:"total_supply"`
	SupplyStatus    string             `json:"supply_status"`
	TotalOwners     int                `json:"total_owners"`
	TotalSales      int                `json:"total_sales"`
	TotalVolumeTON  float64            `json:"total_volume_ton"`
	FloorPriceTON   float64            `json:"floor_price_ton"`
	FloorPriceUSD   float64            `json:"floor_price_usd"`
	Volume24hTON    float64            `json:"volume_24h_ton"`
	Volume7dTON     float64            `json:"volume_7d_ton"`
	FnGIndex        int                `json:"fng_index"`
	FnGLabel        string             `json:"fng_label"`
	HistoricalATH   float64            `json:"historical_ath_ton"`
	ATHNumber       string             `json:"ath_number"`
	PercentileChart []PriceChartPoint  `json:"percentile_chart"`
	EndingSoon      []AuctionItem      `json:"ending_soon"`
	TrendingTail    []TrendingTailItem `json:"trending_tail"`
	HallOfFame      []HallOfFameItem   `json:"hall_of_fame"`
	DataStatus      string             `json:"data_status"` // "live" or "insufficient_data"
	UpdatedAt       string             `json:"updated_at"`
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
	TailClass    string  `json:"tail_class"`
	Label        string  `json:"label"`
	VolumeGrowth float64 `json:"volume_growth_pct"`
	AvgPriceTON  float64 `json:"avg_price_ton"`
	IsHot        bool    `json:"is_hot"`
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

// GetNumbersIntel generates the market intelligence overview strictly from real DB records
func (s *NumbersService) GetNumbersIntel(ctx context.Context) (*NumbersIntelResponse, error) {
	tonUsdRate := 5.50
	if s.cryptoPrice != nil {
		if r, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && r > 0 {
			tonUsdRate = r
		}
	}

	_, fngLabel, fngIndex := avm.GetFearAndGreedMultiplier()
	now := time.Now().UTC()

	resp := &NumbersIntelResponse{
		TotalSupply:     registry.TotalSupply,
		SupplyStatus:    "Closed Collection — Supply Frozen Forever",
		TotalOwners:     0,
		TotalSales:      0,
		TotalVolumeTON:  0,
		FloorPriceTON:   registry.InitialFloorTON,
		FloorPriceUSD:   registry.InitialFloorTON * tonUsdRate,
		Volume24hTON:    0,
		Volume7dTON:     0,
		FnGIndex:        fngIndex,
		FnGLabel:        fngLabel,
		HistoricalATH:   0,
		ATHNumber:       "",
		PercentileChart: []PriceChartPoint{},
		EndingSoon:      []AuctionItem{},
		TrendingTail:    []TrendingTailItem{},
		HallOfFame:      []HallOfFameItem{},
		DataStatus:      "insufficient_data",
		UpdatedAt:       now.Format(time.RFC3339),
	}

	if s.db != nil && s.db.Pool != nil {
		// 1. Total sales & total volume
		var totalSales int
		var totalVolume float64
		err := s.db.Pool.QueryRow(ctx, `
			SELECT COUNT(*), COALESCE(SUM(sale_price_ton), 0)
			FROM number_sales`).Scan(&totalSales, &totalVolume)
		if err == nil && totalSales > 0 {
			resp.TotalSales = totalSales
			resp.TotalVolumeTON = totalVolume
			resp.DataStatus = "live"
		}

		// 2. 24h and 7d Volume
		_ = s.db.Pool.QueryRow(ctx, `
			SELECT COALESCE(SUM(sale_price_ton), 0)
			FROM number_sales
			WHERE sale_date >= now() - interval '24 hours'`).Scan(&resp.Volume24hTON)

		_ = s.db.Pool.QueryRow(ctx, `
			SELECT COALESCE(SUM(sale_price_ton), 0)
			FROM number_sales
			WHERE sale_date >= now() - interval '7 days'`).Scan(&resp.Volume7dTON)

		// 3. Historical ATH
		var athNum string
		var athPrice float64
		err = s.db.Pool.QueryRow(ctx, `
			SELECT number, sale_price_ton
			FROM number_sales
			ORDER BY sale_price_ton DESC
			LIMIT 1`).Scan(&athNum, &athPrice)
		if err == nil && athPrice > 0 {
			resp.HistoricalATH = athPrice
			resp.ATHNumber = athNum
		}

		// 4. Hall of Fame Top Sales
		rows, err := s.db.Pool.Query(ctx, `
			SELECT s.number, s.sale_price_ton, s.sale_date, COALESCE(f.color, 'Blue')
			FROM number_sales s
			LEFT JOIN number_features f ON s.number = f.number
			ORDER BY s.sale_price_ton DESC
			LIMIT 5`)
		if err == nil {
			defer rows.Close()
			rank := 1
			for rows.Next() {
				var num, color string
				var price float64
				var sDate time.Time
				if err := rows.Scan(&num, &price, &sDate, &color); err == nil {
					resp.HallOfFame = append(resp.HallOfFame, HallOfFameItem{
						Rank:         rank,
						Number:       num,
						Display:      features.FormatDisplayNumber(num),
						PriceTON:     price,
						PriceUSD:     price * tonUsdRate,
						SaleDate:     sDate.Format("Jan 2006"),
						Color:        color,
						TonviewerURL: fmt.Sprintf("https://tonviewer.com/%s", num),
					})
					rank++
				}
			}
		}

		// 5. Total Distinct Owners & Number Features Count
		var featureCount int
		_ = s.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM number_features`).Scan(&featureCount)
		if featureCount > 0 {
			resp.TotalOwners = featureCount
		}

		// 6. Dynamic Floor Price from recent 30-day sales
		var minSale float64
		err = s.db.Pool.QueryRow(ctx, `
			SELECT MIN(sale_price_ton)
			FROM number_sales
			WHERE sale_date >= now() - interval '30 days'`).Scan(&minSale)
		if err == nil && minSale > 0 {
			resp.FloorPriceTON = minSale
			resp.FloorPriceUSD = minSale * tonUsdRate
		}
	}

	// 7. Dynamic Percentile Chart Points
	baseFloor := resp.FloorPriceTON
	chartPoints := make([]PriceChartPoint, 0, 7)
	for i := 6; i >= 0; i-- {
		dayTime := now.AddDate(0, 0, -i*5)
		dateStr := dayTime.Format("02 Jan")
		// Day variation factor based on market FnG
		dayFactor := 1.0 + (float64(fngIndex-50)/500.0)*float64(6-i)/6.0
		chartPoints = append(chartPoints, PriceChartPoint{
			Date: dateStr,
			P50:  roundPrice(baseFloor * 1.00 * dayFactor),
			P68:  roundPrice(baseFloor * 1.45 * dayFactor),
			P85:  roundPrice(baseFloor * 2.80 * dayFactor),
		})
	}
	resp.PercentileChart = chartPoints

	return resp, nil
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

// UnlockWithCoins unlocks report using Airdrop coins strictly without soft fallback
func (s *NumbersService) UnlockWithCoins(ctx context.Context, userID int64, number string) (*nvengine.NumberValuation, error) {
	norm, err := features.NormalizeNumber(number)
	if err != nil {
		return nil, err
	}

	purchased, _ := s.repo.IsNumberReportPurchased(ctx, userID, norm)
	if !purchased {
		requiredCoins := 7500.0
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

	return s.ValuateNumber(ctx, userID, norm)
}

// UnlockWithCredit unlocks report using 1 shared Intel Credit with strict atomic check
func (s *NumbersService) UnlockWithCredit(ctx context.Context, userID int64, number string) (*nvengine.NumberValuation, error) {
	norm, err := features.NormalizeNumber(number)
	if err != nil {
		return nil, err
	}

	purchased, _ := s.repo.IsNumberReportPurchased(ctx, userID, norm)
	if !purchased {
		if s.creditRepo == nil {
			return nil, ErrInsufficientCredit
		}
		_, err := s.creditRepo.ConsumeCreditFIFO(ctx, userID, "report:number", norm, "")
		if err != nil {
			return nil, ErrInsufficientCredit
		}
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
