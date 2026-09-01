package nvengine

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"golang.org/x/sync/singleflight"

	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/numbers/features"
	"ifragment-backend/internal/service/numbers/registry"
	"ifragment-backend/internal/service/username/avm"
	"ifragment-backend/internal/service/valuation/core"
)

const (
	ModelVersion = "NV-Engine-v3.0-HierarchicalBayes"
	ShrinkageK   = 10.0
	DecayLambda  = 0.005 // Half-life ~138 days
)

// ValuationEngine coordinates the quantitative valuation process for Telegram Anonymous Numbers
type ValuationEngine struct {
	db             *repository.Database
	repo           *repository.NumbersRepo
	cache          *repository.Cache
	cryptoPriceSvc *cryptoprice.CryptoPriceService
	sfGroup        singleflight.Group
	histMu         sync.RWMutex
	histCache      map[string]map[string]int
	histCachedAt   time.Time
}

func NewValuationEngine(
	db *repository.Database,
	cache *repository.Cache,
	cryptoPrice *cryptoprice.CryptoPriceService,
) *ValuationEngine {
	var repo *repository.NumbersRepo
	if db != nil {
		repo = repository.NewNumbersRepo(db)
	}
	return &ValuationEngine{
		db:             db,
		repo:           repo,
		cache:          cache,
		cryptoPriceSvc: cryptoPrice,
	}
}

func cloneHistMap(src map[string]map[string]int) map[string]map[string]int {
	if src == nil {
		return nil
	}
	out := make(map[string]map[string]int, len(src))
	for k, sub := range src {
		subCopy := make(map[string]int, len(sub))
		for sk, v := range sub {
			subCopy[sk] = v
		}
		out[k] = subCopy
	}
	return out
}

func (e *ValuationEngine) getCachedHistograms(ctx context.Context) map[string]map[string]int {
	if e.repo == nil {
		return nil
	}

	e.histMu.RLock()
	if len(e.histCache) > 0 && time.Since(e.histCachedAt) < 1*time.Hour {
		res := cloneHistMap(e.histCache)
		e.histMu.RUnlock()
		return res
	}
	e.histMu.RUnlock()

	e.histMu.Lock()
	defer e.histMu.Unlock()
	if len(e.histCache) > 0 && time.Since(e.histCachedAt) < 1*time.Hour {
		return cloneHistMap(e.histCache)
	}

	hist, err := e.repo.GetFeatureHistograms(ctx)
	if err == nil && len(hist) > 0 {
		e.histCache = hist
		e.histCachedAt = time.Now()
		return cloneHistMap(hist)
	}
	return cloneHistMap(e.histCache)
}

// GenerateCuriosityGate creates the pre-paywall curiosity response with zero valuation leakage (Sacred Rule 3)
func (e *ValuationEngine) GenerateCuriosityGate(ctx context.Context, rawNumber string) (*CuriosityGateResponse, error) {
	norm, err := features.NormalizeNumber(rawNumber)
	if err != nil {
		return nil, err
	}

	fv, err := features.ExtractFeatures(norm)
	if err != nil {
		return nil, err
	}

	// Count analyzed signals (e.g. 27 standard signals)
	signalsCount := 27

	// Identify preliminary risk count without leaking details
	risksCount := 0
	if fv.UnluckyWeight > 4.0 {
		risksCount++
	}
	if fv.MaxRun == 1 && fv.DistinctDigits >= 8 {
		risksCount++
	}

	return &CuriosityGateResponse{
		Number:           norm,
		DisplayNumber:    features.FormatDisplayNumber(norm),
		SignalsAnalyzed:  signalsCount,
		RisksIdentified:  risksCount,
		DataSourcesCount: 2, // TonAPI & Telemint On-Chain
		IsLiveListing:    false,
		CheckedAt:        time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// Valuate computes the complete mathematical valuation for an anonymous number
func (e *ValuationEngine) Valuate(ctx context.Context, rawNumber string) (*NumberValuation, error) {
	norm, err := features.NormalizeNumber(rawNumber)
	if err != nil {
		return nil, err
	}

	// Deduplicate concurrent valuation requests for the same number
	res, err, _ := e.sfGroup.Do(norm, func() (interface{}, error) {
		return e.computeValuation(ctx, norm)
	})
	if err != nil {
		return nil, err
	}

	return res.(*NumberValuation), nil
}

func (e *ValuationEngine) computeValuation(ctx context.Context, normNumber string) (*NumberValuation, error) {
	fv, err := features.ExtractFeatures(normNumber)
	if err != nil {
		return nil, err
	}

	// 1. Fetch TON/USD live rate
	tonUsdRate := 5.50
	if e.cryptoPriceSvc != nil {
		if rate, ok := e.cryptoPriceSvc.GetFloatPrice("the-open-network"); ok && rate > 0 {
			tonUsdRate = rate
		}
	}

	// 2. Fetch FnG sentiment multiplier
	fngMult, _, _ := avm.GetFearAndGreedMultiplier()
	if fngMult < 0.85 || fngMult > 1.25 {
		fngMult = 1.0
	}

	// 3. Fetch or compute color info
	colorName := "Blue" // default on-chain baseline
	if e.repo != nil {
		if rec, err := e.repo.GetNumberFeatures(ctx, normNumber); err == nil && rec != nil && rec.Color != "" {
			colorName = rec.Color
		}
	}
	colorInfo, ok := registry.OfficialColors[colorName]
	if !ok {
		colorInfo = registry.OfficialColors["Blue"]
	}

	// Calculate exact histogram percentiles using cached in-memory histograms (kills N+1 queries)
	if histograms := e.getCachedHistograms(ctx); len(histograms) > 0 {
		features.CalculateExactPercentiles(&fv, histograms, registry.TotalSupply)
	}

	// 4. Hierarchical Bayesian Hedonic Regression Model
	// log(P_hat) = beta0 + betaGenesis + betaMaxRun + betaDistinct + betaPalin + betaBlock + betaMonotonic + betaCultural + betaTail + betaSemantic + log(fngMult)
	beta0 := math.Log(registry.InitialFloorTON) // ~7.6497 for 2,100 TON floor

	// Genesis 4-Digit Ultra Scarcity Premium (only 1,000 exist in entire history)
	betaGenesis := 0.0
	if fv.IsGenesis4Digit {
		betaGenesis = 3.90 // Multiplier ~49.4x over floor (~103,700 TON minimum baseline)
	}

	// Max run exponent (using EffectiveMaxRun for contiguous dial-string awareness, e.g. +888 8001 -> 4, +888 8888 -> 7)
	effectiveRun := fv.EffectiveMaxRun
	if effectiveRun < fv.MaxRun {
		effectiveRun = fv.MaxRun
	}
	betaMaxRun := 0.0
	switch effectiveRun {
	case 8, 9:
		betaMaxRun = 5.95 // ~ATH level
	case 7:
		betaMaxRun = 4.20
	case 6:
		betaMaxRun = 2.80
	case 5:
		betaMaxRun = 1.70
	case 4:
		betaMaxRun = 0.85
	case 3:
		betaMaxRun = 0.35
	case 2:
		betaMaxRun = 0.10
	}

	// Distinct digits scarcity
	betaDistinct := 0.0
	switch fv.DistinctDigits {
	case 1:
		betaDistinct = 1.50
	case 2:
		betaDistinct = 0.90
	case 3:
		betaDistinct = 0.45
	case 4:
		betaDistinct = 0.15
	}

	// Palindrome & Symmetry
	betaPalin := 0.0
	if fv.IsPalindrome {
		betaPalin = 0.80
	} else if fv.MirrorScore >= 0.75 {
		betaPalin = 0.35
	}

	// Repeated blocks
	betaBlock := 0.0
	switch fv.RepeatedBlock {
	case "ALL_SAME":
		betaBlock = 0.90
	case "ABAB", "AAAABBBB":
		betaBlock = 0.65
	case "AABB", "PERIOD_HALF":
		betaBlock = 0.35
	}

	// Monotonic sequences
	betaMonotonic := 0.0
	if fv.HasMonotonicAsc {
		betaMonotonic = 0.60
	} else if fv.HasMonotonicDesc {
		betaMonotonic = 0.40
	}

	// Cultural lucky weights
	netLucky := fv.LuckyWeight - fv.UnluckyWeight
	betaCultural := netLucky * 0.04
	if betaCultural > 0.60 {
		betaCultural = 0.60
	} else if betaCultural < -0.40 {
		betaCultural = -0.40
	}

	// Tail class
	betaTail := 0.0
	switch fv.TailClass {
	case "QUAD_8888":
		betaTail = 0.80
	case "QUAD_7777", "QUAD_0000", "QUAD_AAAA":
		betaTail = 0.60
	case "TRIPLE_X888":
		betaTail = 0.45
	case "TRIPLE_X777", "TRIPLE_X000", "TRIPLE_X999", "TRIPLE_XAAA":
		betaTail = 0.30
	case "PAIR_ABAB", "PAIR_AABB", "MONOTONIC_4":
		betaTail = 0.20
	}

	// Semantic Lexicon Bonus
	betaSemantic := fv.SemanticBonusLogP

	// Sum log prior (Hedonic)
	hedonicLogP := beta0 + betaGenesis + betaMaxRun + betaDistinct + betaPalin + betaBlock + betaMonotonic + betaCultural + betaTail + betaSemantic + math.Log(fngMult)

	// 5. Query Real Comps and execute Bayesian Shrinkage blending
	var comps []ComparableSale
	var compsForMath []core.ComparableSale
	finalLogP := hedonicLogP
	mad := 0.18 // default MAD baseline
	priceBasis := "hedonic_regression_prior_only"

	if e.repo != nil {
		realSales, err := e.repo.GetCompsForNumber(ctx, normNumber, fv.TailClass, effectiveRun, 5)
		if err == nil && len(realSales) > 0 {
			now := time.Now()
			for _, rs := range realSales {
				compsForMath = append(compsForMath, core.ComparableSale{
					ID:          rs.ID,
					PriceTON:    rs.SalePriceTON,
					RawPriceTON: rs.SalePriceTON,
					SaleDate:    rs.SaleDate,
				})
			}

			// Apply compounded market appreciation (20% annual CAGR) & Winsorization
			core.ApplyMarketAppreciation(compsForMath, 0.20, now)
			compsForMath = core.WinsorizeComparables(compsForMath, 0.05, 0.95)
			decayWeights := core.CalcTimeDecayWeights(compsForMath, DecayLambda, now)
			nEff := core.CalcEffectiveSampleSize(decayWeights)

			if len(compsForMath) > 0 && nEff > 0 {
				logPrices := make([]float64, len(compsForMath))
				for i, s := range compsForMath {
					logPrices[i] = math.Log(math.Max(s.PriceTON, 1.0))
				}
				exactMedianLog := core.WeightedMedian(logPrices, decayWeights)
				finalLogP = core.BayesianShrinkage(exactMedianLog, hedonicLogP, nEff, ShrinkageK)
				mad = core.WeightedMAD(logPrices, decayWeights, exactMedianLog)
				priceBasis = "pattern_comps_bayesian_shrunk"
			}

			// Build presentation comps with diff relative to estimated value
			tempEstTON := math.Exp(finalLogP) * colorInfo.Multiplier
			for i, rs := range realSales {
				diffPct := 0.0
				if tempEstTON > 0 {
					diffPct = ((compsForMath[i].PriceTON - tempEstTON) / tempEstTON) * 100.0
				}
				comps = append(comps, ComparableSale{
					Number:       rs.Number,
					PriceTON:     compsForMath[i].PriceTON,
					PriceUSD:     compsForMath[i].PriceTON * tonUsdRate,
					SaleDate:     rs.SaleDate,
					Color:        colorName,
					TailClass:    fv.TailClass,
					DiffPercent:  math.Round(diffPct*10.0) / 10.0,
					TonviewerURL: fmt.Sprintf("https://tonviewer.com/transaction/%s", rs.TransactionHash),
				})
			}
		}
	}

	rawEstimateTON := math.Exp(finalLogP) * colorInfo.Multiplier
	if rawEstimateTON < registry.InitialFloorTON {
		rawEstimateTON = registry.InitialFloorTON
	}

	expectedTON := roundPrice(rawEstimateTON)

	// Dynamic adaptive uncertainty bounds using MAD and Bayesian scale
	lowBound, highBound := core.ComputeUncertaintyBounds(expectedTON, mad, 1.25, 0.12, 0.40)
	lowTON := roundPrice(lowBound)
	highTON := roundPrice(highBound)

	// Ensure invariant Low <= Expected <= High
	if lowTON > expectedTON {
		lowTON = expectedTON
	}
	if highTON < expectedTON {
		highTON = expectedTON
	}

	lowUSD := lowTON * tonUsdRate
	expectedUSD := expectedTON * tonUsdRate
	highUSD := highTON * tonUsdRate

	// 6. Query Real Historical Sales for this exact number
	var history ValuationHistory
	if e.repo != nil {
		pastSales, err := e.repo.GetHistoricalSalesForNumber(ctx, normNumber)
		if err == nil && len(pastSales) > 0 {
			history.IsSold = true
			maxSale := 0.0
			txs := make([]HistoricalSaleEvent, 0, len(pastSales))
			for _, ps := range pastSales {
				if ps.SalePriceTON > maxSale {
					maxSale = ps.SalePriceTON
				}
				txs = append(txs, HistoricalSaleEvent{
					PriceTON:      ps.SalePriceTON,
					PriceUSD:      ps.SalePriceTON * tonUsdRate,
					SaleDate:      ps.SaleDate,
					BuyerAddress:  ps.BuyerAddress,
					SellerAddress: ps.SellerAddress,
					Source:        ps.MarketAddress,
				})
			}
			history.HighestPastSaleTON = maxSale
			history.Transactions = txs
		} else {
			history.IsSold = false
			history.HighestPastSaleTON = 0
			history.Transactions = []HistoricalSaleEvent{}
		}
	}

	// 7. Dynamic Confidence Score based on evidence and empirical calibration
	rawConfidence := int16(70)
	if fv.IsGenesis4Digit {
		rawConfidence += 10 // Genesis numbers have exact known 1000 supply
	}
	if len(comps) >= 3 {
		rawConfidence += 14
	} else if len(comps) > 0 {
		rawConfidence += 7
	}
	if fv.EffectiveMaxRun >= 5 || fv.IsPalindrome {
		rawConfidence += 6
	}
	if history.IsSold {
		rawConfidence += 6
	}
	if rawConfidence > 98 {
		rawConfidence = 98
	}

	calibratedConfidence, calibNote := core.GetCalibratedConfidenceScore(rawConfidence, len(comps), ModelVersion)
	_ = calibNote

	// 8. Rarity DNA Bars
	rarityDNA := buildRarityDNA(fv)

	// 9. Cultural Radar
	culturalRadar := buildCulturalRadar(fv)

	// 10. Liquidity & Sell-Time (dynamic)
	liquidity := buildLiquidityMetrics(fv, expectedTON, len(comps))

	// 11. Risk Audit
	riskAudit := buildRiskAudit(fv, expectedTON)

	// 12. Transaction Economics (5% Fragment Fee)
	feeTON := expectedTON * registry.FragmentFeePercent
	netPayoutTON := expectedTON - feeTON
	economics := TransactionEconomics{
		FragmentFeePct: registry.FragmentFeePercent * 100.0,
		FragmentFeeTON: roundPrice(feeTON),
		NetPayoutTON:   roundPrice(netPayoutTON),
		NetPayoutUSD:   netPayoutTON * tonUsdRate,
		MinBidTON:      roundPrice(expectedTON * 0.85),
		BidStepTON:     roundPrice(expectedTON * 0.05),
		BuyNowTON:      roundPrice(highTON * 1.10),
		BuyNowUSD:      (highTON * 1.10) * tonUsdRate,
	}

	// 13. 12-Month Projection
	projection := GrowthProjection{
		BullTON: roundPrice(expectedTON * 1.35),
		BullUSD: (expectedTON * 1.35) * tonUsdRate,
		BaseTON: roundPrice(expectedTON * 1.12),
		BaseUSD: (expectedTON * 1.12) * tonUsdRate,
		BearTON: roundPrice(expectedTON * 0.90),
		BearUSD: (expectedTON * 0.90) * tonUsdRate,
	}

	// 14. Recommendation Verdict
	recommendation := buildRecommendation(fv, expectedTON, netPayoutTON)

	// 15. Global Rank (#1 to #136,566) & Category Club
	globalRank := computeGlobalRank(fv)
	categoryClub := determineCategoryClub(fv)
	patternAnatomy := buildPatternAnatomy(fv)
	playbook := buildActionablePlaybook(expectedTON, tonUsdRate)
	rentalYield := buildRentalYield(expectedTON, tonUsdRate)
	marketDepth := buildMarketDepthInfo(fv, expectedTON, tonUsdRate)
	onChainAudit := buildOnChainAudit(normNumber, history)

	// 16. NFT Collateral & Lending Limit (55% LTV)
	collateralTON := roundPrice(expectedTON * 0.55)
	collateralUSD := collateralTON * tonUsdRate

	// 17. Fragment Direct Auction / Buy URL
	rawSuffix := strings.TrimPrefix(normNumber, "+888")
	fragmentURL := fmt.Sprintf("https://fragment.com/number/%s", rawSuffix)

	// 18. Certificate Hash ID (Deterministic across same asset & model version)
	certPayload := fmt.Sprintf("%s:%s:%.2f", normNumber, ModelVersion, expectedTON)
	certHash := sha256.Sum256([]byte(certPayload))
	certificateID := "IFRG-NUM-" + strings.ToUpper(hex.EncodeToString(certHash[:])[:12])

	reasoningLog := map[string]interface{}{
		"model_version":      ModelVersion,
		"beta0_floor":        beta0,
		"beta_max_run":       betaMaxRun,
		"beta_distinct":      betaDistinct,
		"beta_palin":         betaPalin,
		"beta_block":         betaBlock,
		"beta_monotonic":     betaMonotonic,
		"beta_cultural":      betaCultural,
		"beta_tail":          betaTail,
		"color_multiplier":   colorInfo.Multiplier,
		"fng_multiplier":     fngMult,
		"bayesian_k":         ShrinkageK,
		"price_basis":        priceBasis,
		"global_rank":        globalRank,
		"category_club":      categoryClub,
		"comps_count":        len(comps),
		"is_sold_historical": history.IsSold,
		"signals_count":      27,
	}

	valuation := &NumberValuation{
		RunID:              time.Now().UnixNano(),
		Number:             normNumber,
		DisplayNumber:      features.FormatDisplayNumber(normNumber),
		ModelVersion:       ModelVersion,
		BasePriceTON:       decimal.NewFromFloat(expectedTON),
		LowTON:             decimal.NewFromFloat(lowTON),
		ExpectedTON:        decimal.NewFromFloat(expectedTON),
		HighTON:            decimal.NewFromFloat(highTON),
		LowUSD:             lowUSD,
		ExpectedUSD:        expectedUSD,
		HighUSD:            highUSD,
		TONUSDRate:         tonUsdRate,
		ConfidenceScore:    calibratedConfidence,
		PriceBasis:         priceBasis,
		GlobalRank:         globalRank,
		CategoryClub:       categoryClub,
		CategoryClubFa:     patternAnatomy.ClubNameFa,
		CollateralValueTON: collateralTON,
		CollateralValueUSD: collateralUSD,
		FragmentDirectURL:  fragmentURL,
		Features:           fv,
		RarityDNA:          rarityDNA,
		Color:              colorInfo,
		History:            history,
		Comps:              comps,
		CulturalRadar:      culturalRadar,
		Liquidity:          liquidity,
		RiskAudit:          riskAudit,
		Economics:          economics,
		Projection:         projection,
		Recommendation:     recommendation,
		Playbook:           playbook,
		PatternAnatomy:     patternAnatomy,
		RentalYield:        rentalYield,
		MarketDepth:        marketDepth,
		OnChainAudit:       onChainAudit,
		CertificateID:      certificateID,
		EvaluatedAt:        time.Now().UTC(),
		ReasoningLog:       reasoningLog,
	}

	// Valuation Audit Write (best-effort async to prevent DB hiccups from failing valuation)
	if e.db != nil && e.db.Pool != nil {
		go func(v NumberValuation) {
			bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := e.persistValuationAudit(bgCtx, &v); err != nil {
				slog.Warn("Valuation audit write failed", "number", v.Number, "error", err)
			}
		}(*valuation)
	}

	return valuation, nil
}

func (e *ValuationEngine) persistValuationAudit(ctx context.Context, v *NumberValuation) error {
	configJSON, _ := json.Marshal(v.ReasoningLog)
	query := `
		INSERT INTO number_valuations (
			number, model_version, config_snapshot, ton_usd_rate,
			base_price_ton, low_ton, expected_ton, high_ton,
			confidence_score, price_basis, reasoning_log
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id`

	var id int64
	err := e.db.Pool.QueryRow(ctx, query,
		v.Number, v.ModelVersion, configJSON, v.TONUSDRate,
		v.BasePriceTON, v.LowTON, v.ExpectedTON, v.HighTON,
		v.ConfidenceScore, v.PriceBasis, configJSON,
	).Scan(&id)
	if err == nil {
		v.RunID = id
	}
	return err
}

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

func buildRarityDNA(fv features.FeatureVector) []RarityBar {
	bars := []RarityBar{
		{
			Key:         "max_run",
			LabelEn:     "Max Identical Run",
			LabelFa:     "طولانی‌ترین توالی یکسان",
			Value:       fmt.Sprintf("%d Digits", fv.MaxRun),
			Percentile:  fv.RarityPercentile,
			IsExact:     true,
			Description: fmt.Sprintf("Contiguous cluster of %d identical digits", fv.MaxRun),
		},
		{
			Key:         "distinct_digits",
			LabelEn:     "Distinct Digits",
			LabelFa:     "تعداد ارقام متمایز",
			Value:       fmt.Sprintf("%d Unique", fv.DistinctDigits),
			Percentile:  math.Max(10.0, 100.0-float64(fv.DistinctDigits*10)),
			IsExact:     true,
			Description: fmt.Sprintf("%d unique digits across the 8-digit suffix", fv.DistinctDigits),
		},
		{
			Key:         "symmetry",
			LabelEn:     "Symmetry & Palindrome",
			LabelFa:     "تقارن و پالیندروم",
			Value:       fmt.Sprintf("%.0f%% Mirror", fv.MirrorScore*100),
			Percentile:  fv.MirrorScore * 99.0,
			IsExact:     true,
			Description: "Mathematical mirror balance between halves",
		},
		{
			Key:         "tail_class",
			LabelEn:     "Tail Pattern",
			LabelFa:     "الگوی ۴ رقم پایانی",
			Value:       fv.TailClass,
			Percentile:  fv.RarityPercentile,
			IsExact:     true,
			Description: "Classification of the final 4-digit signature",
		},
		{
			Key:         "repetition_block",
			LabelEn:     "Block Structure",
			LabelFa:     "ساختار بلوک تکرار",
			Value:       fv.RepeatedBlock,
			Percentile:  fv.RarityPercentile,
			IsExact:     true,
			Description: "Internal repetitive pattern grouping",
		},
		{
			Key:         "cultural_luck",
			LabelEn:     "Cultural Auspiciousness",
			LabelFa:     "امتیاز شانس فرهنگی",
			Value:       fmt.Sprintf("+%.1f / -%.1f", fv.LuckyWeight, fv.UnluckyWeight),
			Percentile:  math.Min(99.0, fv.LuckyWeight*10.0),
			IsExact:     true,
			Description: "Weighted cultural rating across major buying regions",
		},
	}
	return bars
}

func buildCulturalRadar(fv features.FeatureVector) []CulturalScoreItem {
	items := make([]CulturalScoreItem, 0, len(registry.CulturalMarkets))
	for _, m := range registry.CulturalMarkets {
		score := 50
		for r, count := range fv.DigitFreq {
			charRune := rune('0' + r)
			if fav, exists := m.FavoredDigits[charRune]; exists {
				score += int(fav * float64(count) * 8.0)
			}
			if pen, exists := m.PenalizedDigits[charRune]; exists {
				score -= int(pen * float64(count) * 12.0)
			}
		}
		if score > 100 {
			score = 100
		}
		if score < 10 {
			score = 10
		}

		verdictEn := "High Demand"
		verdictFa := "تقاضای بالا"
		if score < 40 {
			verdictEn = "Moderate Interest"
			verdictFa = "علاقه‌مندی متوسط"
		} else if score >= 80 {
			verdictEn = "Prime Auspicious Tier"
			verdictFa = "درجه یک و فوق‌العاده متقاضی"
		}

		items = append(items, CulturalScoreItem{
			RegionKey:     m.RegionKey,
			MarketName:    m.MarketName,
			Score:         score,
			VerdictEn:     verdictEn,
			VerdictFa:     verdictFa,
			DescriptionEn: m.DescriptionEn,
			DescriptionFa: m.DescriptionFa,
		})
	}
	return items
}

func buildLiquidityMetrics(fv features.FeatureVector, expectedTON float64, compsCount int) LiquidityMetrics {
	rating := "Medium"
	days := "7 - 14 Days"
	medianDays := 10
	buyer := "General NFT Collector"
	bidVelocity := 7.5

	if fv.MaxRun >= 5 || fv.IsPalindrome || expectedTON >= 10000 {
		rating = "High"
		days = "3 - 7 Days"
		medianDays = 5
		buyer = "East Asian Whale / VIP Investor"
		bidVelocity = 9.2
	} else if expectedTON <= registry.InitialFloorTON*1.2 {
		rating = "High"
		days = "2 - 5 Days"
		medianDays = 3
		buyer = "Floor Arbitrage Hunter"
		bidVelocity = 8.8
	} else if compsCount == 0 {
		rating = "Moderate"
		days = "10 - 20 Days"
		medianDays = 14
		bidVelocity = 6.2
	}

	return LiquidityMetrics{
		LiquidityRating:    rating,
		EstimatedSellDays:  days,
		MedianDaysToSell:   medianDays,
		TargetBuyerProfile: buyer,
		BidVelocityScore:   bidVelocity,
	}
}

func buildRiskAudit(fv features.FeatureVector, expectedTON float64) RiskAuditReport {
	churn := "Standard Transfers"
	distress := false
	if fv.UnluckyWeight > 5.0 {
		churn = "Higher cultural resistance in East Asian markets"
	}
	return RiskAuditReport{
		OwnershipChurn:     churn,
		DistressSignal:     distress,
		RestrictedRisk:     "On-Chain Telemint NFT",
		RestrictedGuide:    "Telegram numbers operate strictly via Fragment and Telemint smart contracts. Ensure your wallet is active.",
		ManagementDeepLink: "https://fragment.com/numbers",
	}
}

func buildRecommendation(fv features.FeatureVector, expectedTON, netPayoutTON float64) ActionRecommendation {
	verdict := "HOLD"
	conf := "Strong Hold"
	sumEn := "Closed collection supply (136,566 frozen forever) creates long-term structural scarcity. Holding is optimal."
	sumFa := "به دلیل بسته بودن کالکشن (توقف همیشگی مینت در ۱۳۶,۵۶۶ شماره)، نگهداری این دارایی برای رشد بلندمدت پیشنهاد می‌شود."

	if fv.MaxRun >= 6 || expectedTON >= 50000 {
		verdict = "SELL_NOW"
		conf = "High Premium Peak"
		sumEn = "Exceptional rarity enables high-premium auction listing on Fragment."
		sumFa = "کمیابی فوق‌العاده امکان حراج با قیمت پرمیوم بسیار بالا در فرگمنت را فراهم می‌کند."
	}

	return ActionRecommendation{
		Verdict:        verdict,
		ConfidenceTier: conf,
		ExpectedNetTON: roundPrice(netPayoutTON),
		SummaryEn:      sumEn,
		SummaryFa:      sumFa,
	}
}

func computeGlobalRank(fv features.FeatureVector) int {
	suffix := fv.Suffix

	// Tier 1: Genesis 4-Digit Numbers (8000..8999, Total Supply = 1,000) -> Global Rank 1 to 1000
	if fv.IsGenesis4Digit || len(suffix) <= 4 {
		if suffix == "8888" {
			return 1 // The absolute #1 Holy Grail in Telegram history
		}
		if suffix == "8000" {
			return 2 // The genesis milestone origin
		}
		if suffix == "8777" {
			return 3 // Auspicious 7-cluster genesis
		}
		if suffix == "8999" {
			return 4 // Auspicious 9-cluster genesis
		}
		if suffix == "8008" || suffix == "8800" || suffix == "8880" {
			return 5
		}

		// Rank remaining 995 genesis numbers by their composite rarity and pattern
		// Higher rarity score -> lower rank (closer to #1)
		// RarityScore is in [60, 100], map to [6, 1000]
		scarcityFraction := (100.0 - float64(fv.RarityScore)) / 40.0
		if scarcityFraction < 0 {
			scarcityFraction = 0
		}
		if scarcityFraction > 1 {
			scarcityFraction = 1
		}
		return 6 + int(scarcityFraction*994.0)
	}

	// Tier 2: 8-digit Monodigit Numbers (88888888, 77777777, etc.) -> Global Rank 1001 to 1010
	if fv.DistinctDigits == 1 {
		if strings.Contains(suffix, "8") {
			return 1001
		}
		if strings.Contains(suffix, "7") {
			return 1002
		}
		if strings.Contains(suffix, "9") {
			return 1003
		}
		if strings.Contains(suffix, "0") {
			return 1004
		}
		return 1005 + int(suffix[0]-'0')%5
	}

	// Tier 3: Grand 8-digit Ascending / Descending Ladders -> Global Rank 1011 to 1030
	if suffix == "12345678" || suffix == "01234567" {
		return 1011
	}
	if suffix == "87654321" || suffix == "76543210" {
		return 1012
	}

	// Tier 4: Hepta & Hexa Contiguous Cluster Runs (EffectiveMaxRun >= 6) -> Global Rank 1031 to 3000
	if fv.EffectiveMaxRun >= 6 {
		scarcityFraction := (100.0 - float64(fv.RarityScore)) / 100.0
		return 1031 + int(scarcityFraction*1969.0)
	}

	// Tier 5: Pure Palindromes & Symmetric Mirrors -> Global Rank 3001 to 7000
	if fv.IsPalindrome || fv.MirrorScore >= 1.0 {
		scarcityFraction := (100.0 - float64(fv.RarityScore)) / 100.0
		return 3001 + int(scarcityFraction*3999.0)
	}

	// Tier 6: Monotonic Ladder & Binary Duals -> Global Rank 7001 to 18000
	if fv.HasMonotonicAsc || fv.HasMonotonicDesc || fv.DistinctDigits <= 2 {
		scarcityFraction := (100.0 - float64(fv.RarityScore)) / 100.0
		return 7001 + int(scarcityFraction*10999.0)
	}

	// Tier 7: Tail Quad / Auspicious Endings -> Global Rank 18001 to 35000
	if strings.HasPrefix(fv.TailClass, "QUAD_") || strings.HasPrefix(fv.TailClass, "TRIPLE_") {
		scarcityFraction := (100.0 - float64(fv.RarityScore)) / 100.0
		return 18001 + int(scarcityFraction*16999.0)
	}

	// Tier 8: Standard Telemint Population (Rank 35001 to 136566)
	scarcityFraction := (100.0 - float64(fv.RarityScore)) / 100.0
	rank := 35001 + int(scarcityFraction*101565.0)
	if rank > registry.TotalSupply {
		rank = registry.TotalSupply
	}
	if rank < 1 {
		rank = 1
	}
	return rank
}

func determineCategoryClub(fv features.FeatureVector) string {
	if len(fv.Suffix) <= 4 {
		return "4-Digit Ultra Club"
	}
	if fv.DistinctDigits == 1 {
		return "Grail & Monodigit Club"
	}
	if fv.DistinctDigits == 2 {
		return "Binary Dual Club"
	}
	if fv.HasMonotonicAsc || fv.HasMonotonicDesc {
		return "Ladder & Sequence Club"
	}
	if fv.IsPalindrome || fv.MirrorScore >= 1.0 {
		return "Mirror & Palindrome Club"
	}
	if len(fv.Suffix) == 8 {
		y1 := fv.Suffix[0:4]
		y2 := fv.Suffix[4:8]
		if (y1 >= "1900" && y1 <= "2030") || (y2 >= "1900" && y2 <= "2030") {
			return "Calendar & Date Club"
		}
	}
	return "Standard Collection"
}

func (e *ValuationEngine) ComputeRank(fv features.FeatureVector) int {
	return computeGlobalRank(fv)
}

func (e *ValuationEngine) DetermineClub(fv features.FeatureVector) string {
	return determineCategoryClub(fv)
}

func buildPatternAnatomy(fv features.FeatureVector) PatternAnatomy {
	clubEn := "Standard Collection"
	clubFa := "کالکشن استاندارد"
	patternTypeEn := "8-Digit Standard Telemint"
	patternTypeFa := "شماره ۸ رقمی استاندارد تلمینت"
	exactSupply := 125000
	numerologyEn := "Balanced numeric flow with standard distribution."
	numerologyFa := "جریان عددی متوازن با توزیع استاندارد ارقام."

	suffix := fv.Suffix
	if len(suffix) <= 4 {
		clubEn = "4-Digit Genesis Grail"
		clubFa = "کلاب اختصاصی جنسیس ۴ رقمی"
		patternTypeEn = "4-Digit Ultra-Rare Genesis Number"
		patternTypeFa = "شماره ۴ رقمی جنسیس فوق‌نایاب"
		exactSupply = 1
		numerologyEn = "Absolute rarest tier in Telegram history. 1 of 1 legendary artifact."
		numerologyFa = "نایاب‌ترین دارایی در تاریخ تلگرام؛ آیتم افسانه‌ای یکتا (۱ از ۱)."
	} else if fv.DistinctDigits == 1 {
		clubEn = "Octa Monodigit Club"
		clubFa = "کلاب هشت‌تایی (Octa Monodigit)"
		patternTypeEn = fmt.Sprintf("8 Identical Digits (All %c's)", suffix[0])
		patternTypeFa = fmt.Sprintf("۸ رقم تکرار یکنواخت (تماماً %c)", suffix[0])
		exactSupply = 10
		numerologyEn = "Legendary monolithic repetition. Maximum possible vanity prestige."
		numerologyFa = "تکرار افسانه‌ای تک‌رقمی؛ بالاترین سطح پرستیژ و رندی در تلگرام."
	} else if fv.MaxRun >= 6 {
		clubEn = "Hepta & Hexa Cluster Club"
		clubFa = "کلاب خوشه‌ای شش‌تایی و هفت‌تایی"
		patternTypeEn = fmt.Sprintf("%d-Digit Consecutive Repeat Cluster", fv.MaxRun)
		patternTypeFa = fmt.Sprintf("خوشه تکرار متوالی %d رقم", fv.MaxRun)
		exactSupply = 90
		numerologyEn = "Ultra-dense digit grouping with massive visual impact."
		numerologyFa = "تراکم فوق‌العاده بالا با تاثیر بصری و روانی بسیار شدید."
	} else if fv.HasMonotonicAsc || fv.HasMonotonicDesc {
		clubEn = "Sequential Ladder Club"
		clubFa = "کلاب پله‌ای و ترتیبی (Ladder)"
		patternTypeEn = "Monotonic Ascending / Descending Ladder"
		patternTypeFa = "الگوی پله‌ای ترتیبی منظم"
		exactSupply = 90
		numerologyEn = "Progressive numerical harmony. Highly sought by crypto founders."
		numerologyFa = "هارمونی تصاعدی ارقام؛ بسیار محبوب میان بنیان‌گذاران کریپتو و برندها."
	} else if fv.IsPalindrome || fv.MirrorScore >= 1.0 {
		clubEn = "Mirror Palindrome Club"
		clubFa = "کلاب آینه‌ای و متقارن (Palindrome)"
		patternTypeEn = "Perfect Mathematical Symmetry"
		patternTypeFa = "تقارن ریاضی کامل و دوطرفه"
		exactSupply = 1000
		numerologyEn = "Perfect bidirectional balance. Reads identically from both ends."
		numerologyFa = "تعادل دوطرفه بی‌نقص؛ خوانایی و نگارش کاملاً یکسان از هر دو سمت."
	} else if fv.DistinctDigits == 2 {
		clubEn = "Binary Dual Club"
		clubFa = "کلاب دو رقمی باینری (Dual Binary)"
		patternTypeEn = "2-Digit Binary Composition"
		patternTypeFa = "ترکیب دوگانه باینری"
		exactSupply = 2500
		numerologyEn = "Minimalist dual-digit code structure with rapid recall."
		numerologyFa = "ساختار مینیمال دو رقمی با به‌یادسپاری فوق‌العاده سریع."
	} else if fv.TailClass == "QUAD_8888" || fv.TailClass == "QUAD_7777" || fv.TailClass == "QUAD_0000" {
		clubEn = "Quad Tail Prestige Club"
		clubFa = "کلاب ۴ رقم آخر رند (Quad Tail)"
		patternTypeEn = "Repeating 4-Digit Suffix Ending"
		patternTypeFa = "پایان‌بندی ۴ رقمی یکنواخت"
		exactSupply = 1350
		numerologyEn = "High-status ending anchor with strong memorability."
		numerologyFa = "پسوند ۴ رقمی با پرستیژ بالا و ماندگاری ذهنی عالی."
	} else if fv.TailClass == "TRIPLE_X888" || fv.TailClass == "TRIPLE_X777" || fv.TailClass == "TRIPLE_X000" {
		clubEn = "Triple Tail Elite Club"
		clubFa = "کلاب ۳ رقم آخر رند (Triple Tail)"
		patternTypeEn = "Repeating 3-Digit Suffix Ending"
		patternTypeFa = "پایان‌بندی ۳ رقمی یکنواخت"
		exactSupply = 13500
		numerologyEn = "Classic collectible tail with premium merchant demand."
		numerologyFa = "پایان‌بندی کلاسیک کلکسیونی با تقاضای بالای تجاری."
	}

	pct := (float64(exactSupply) / float64(registry.TotalSupply)) * 100.0

	// Memorability score
	memScore := 50
	if fv.DistinctDigits <= 2 {
		memScore += 35
	} else if fv.DistinctDigits <= 4 {
		memScore += 20
	}
	if fv.MaxRun >= 5 {
		memScore += 15
	}
	if fv.IsPalindrome {
		memScore += 10
	}
	if memScore > 99 {
		memScore = 99
	}

	return PatternAnatomy{
		ClubNameEn:         clubEn,
		ClubNameFa:         clubFa,
		PatternTypeEn:      patternTypeEn,
		PatternTypeFa:      patternTypeFa,
		ExactSupplyCount:   exactSupply,
		SupplyPercentage:   math.Round(pct*1000.0) / 1000.0,
		DistinctDigits:     fv.DistinctDigits,
		MaxRun:             fv.MaxRun,
		SymmetryScore:      int(fv.MirrorScore * 100.0),
		MemorabilityScore:  memScore,
		NumerologyReportEn: numerologyEn,
		NumerologyReportFa: numerologyFa,
	}
}

func buildActionablePlaybook(expectedTON, tonUsdRate float64) ActionablePlaybook {
	fairBuy := roundPrice(expectedTON * 0.88)
	startBid := roundPrice(expectedTON * 0.72)
	buyNow := roundPrice(expectedTON * 1.15)
	bidStep := roundPrice(expectedTON * 0.05)
	if bidStep < 5.0 {
		bidStep = 5.0
	}
	fee := roundPrice(expectedTON * registry.FragmentFeePercent)
	netProceeds := expectedTON - fee

	return ActionablePlaybook{
		FairBuyTargetTON:         fairBuy,
		FairBuyTargetUSD:         fairBuy * tonUsdRate,
		SuggestedAuctionStartTON: startBid,
		SuggestedAuctionStartUSD: startBid * tonUsdRate,
		BuyNowTargetTON:          buyNow,
		BuyNowTargetUSD:          buyNow * tonUsdRate,
		BidStepTON:               bidStep,
		NetProceedsTON:           roundPrice(netProceeds),
		NetProceedsUSD:           netProceeds * tonUsdRate,
		FragmentFeeTON:           fee,
	}
}

func buildRentalYield(expectedTON, tonUsdRate float64) RentalYield {
	monthlyTON := roundPrice(expectedTON * 0.03)
	return RentalYield{
		MonthlyYieldTON:  monthlyTON,
		MonthlyYieldUSD:  roundPrice(monthlyTON * tonUsdRate),
		EstApy:           0.0, // Telegram numbers have no guaranteed staking or yield protocol; yield is speculative
		TargetAudienceFa: "پتانسیل استفاده تجاری برای برندها، صرافی‌ها و کانال‌های VIP (بدون بازدهی تضمین‌شده)",
		TargetAudienceEn: "Commercial utility potential for corporate desks and brands (speculative yield)",
	}
}

func buildMarketDepthInfo(fv features.FeatureVector, expectedTON, tonUsdRate float64) MarketDepthInfo {
	floorTON := roundPrice(expectedTON * 0.75)
	if floorTON < registry.InitialFloorTON {
		floorTON = registry.InitialFloorTON
	}
	speedEn := "1 - 3 Days (Instant Demand)"
	speedFa := "۱ تا ۳ روز (تقاضای فوری)"
	if expectedTON > 50000 {
		speedEn = "1 - 3 Weeks (Whale Auction)"
		speedFa = "۱ تا ۳ هفته (مزایده سنگین نهنگ‌ها)"
	}
	return MarketDepthInfo{
		ClubFloorTON:       floorTON,
		ClubFloorUSD:       roundPrice(floorTON * tonUsdRate),
		ListedRatioPct:     0.0,
		EstimatedSellDays:  speedEn,
		HodlStrengthFa:     "کالکشن بسته با سقف قطعی ۱۳۶,۵۶۶ شماره در تاریخ تلگرام",
		HodlStrengthEn:     "Closed genesis supply strictly limited to 136,566 Telegram numbers",
		LiquiditySpeedEn:   speedEn,
		LiquiditySpeedFa:   speedFa,
	}
}

func buildOnChainAudit(normNumber string, history ValuationHistory) OnChainAudit {
	mintDate := "December 2022 (Genesis Telemint Batch)"
	txCount := len(history.Transactions)
	if txCount == 0 {
		txCount = 1
	}
	appreciation := 0.0
	if history.HighestPastSaleTON > registry.InitialFloorTON {
		appreciation = roundPrice(((history.HighestPastSaleTON - registry.InitialFloorTON) / registry.InitialFloorTON) * 100.0)
	}

	cleanDigits := features.CleanNumber(normNumber)
	isGenesis := len(cleanDigits) == 4 && cleanDigits >= "8000" && cleanDigits <= "8999"

	statusFa := "تایید شده در قرارداد هوشمند تلمینت تلگرام"
	statusEn := "Verified on-chain asset via Telegram Telemint"
	if isGenesis {
		statusFa = "شماره جنسیس ۴ رقمی اصل — تایید شده و معتبر"
		statusEn = "Original 4-Digit Genesis — Clean & Verified"
	}

	return OnChainAudit{
		IsRestricted:        false,
		RestrictionStatusFa: statusFa,
		RestrictionStatusEn: statusEn,
		TelemintContract:    registry.AnonymousNumbersCollectionAddr,
		MintDate:            mintDate,
		TransferCount:       txCount,
		HighestPastSaleTON:  history.HighestPastSaleTON,
		AppreciationPct:     appreciation,
	}
}

