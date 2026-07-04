package avm

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/repository"
	"log/slog"
	"math"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"golang.org/x/sync/errgroup"
)

// ValuationService orchestrates the AVM pipeline:
// Classify → Fetch → Compute → Audit → Return
type ValuationService struct {
	db    *repository.Database
	cache *repository.Cache
	cfg   EngineConfig
}

// NewValuationService creates a new AVM service with default config.
func NewValuationService(db *repository.Database, cache *repository.Cache) *ValuationService {
	return &ValuationService{
		db:    db,
		cache: cache,
		cfg:   DefaultEngineConfig(),
	}
}

// ValuationResult is the output DTO for a single valuation.
type ValuationResult struct {
	RunID           int64           `json:"run_id"`
	Username        string          `json:"username"`
	ModelVersion    string          `json:"model_version"`
	BasePriceTON    decimal.Decimal `json:"base_price_ton"`
	LowTON          decimal.Decimal `json:"low_ton"`
	ExpectedTON     decimal.Decimal `json:"expected_ton"`
	HighTON         decimal.Decimal `json:"high_ton"`
	LowUSD          decimal.Decimal `json:"low_usd"`
	ExpectedUSD     decimal.Decimal `json:"expected_usd"`
	HighUSD         decimal.Decimal `json:"high_usd"`
	ConfidenceScore int16           `json:"confidence_score"`
	TONUSDRate      float64         `json:"ton_usd_rate"`
	ComparableSales int             `json:"comparable_sales_count"`
	Rarity          ValuationRarity `json:"rarity"`
	ReasoningLog    map[string]any  `json:"reasoning_log"`
}

// ValuationRarity provides human-readable classification of the username's value
type ValuationRarity struct {
	Tier  string `json:"tier"`
	Stars string `json:"stars"`
}

// ClassifyUsername extracts the segment and morphology features.
func ClassifyUsername(username string) (segment string, charLen int16, features MorphFeatures) {
	lower := strings.ToLower(username)
	decoded := DecodeLeet(lower)
	charLen = int16(len([]rune(lower)))

	hasNumbers := false
	hasUnderscore := false
	hasAlpha := false

	for _, r := range lower {
		switch {
		case r >= '0' && r <= '9':
			hasNumbers = true
		case r == '_':
			hasUnderscore = true
		case r >= 'a' && r <= 'z':
			hasAlpha = true
		}
	}

	switch {
	case hasUnderscore:
		segment = "underscore"
	case hasNumbers && hasAlpha:
		segment = "mixed"
	case hasNumbers && !hasAlpha:
		segment = "numeric"
	case hasAlpha:
		segment = "alpha"
	default:
		segment = "other"
	}

	tierRes := CheckTier(decoded)
	comboRes := DetectCombo(decoded)
	techRes := DetectTechPattern(lower)
	yearRes := DetectGoldenYear(lower)
	affixRes := DetectAffixes(decoded)
	euphonyScore, isAesthetic := CalculateEuphony(decoded)

	isDict := tierRes.Tier <= 4 || isDictionaryWord(decoded) || isDictionaryWord(lower)

	features = MorphFeatures{
		HasNumbers:        hasNumbers,
		HasUnderscore:     hasUnderscore,
		IsDictionary:      isDict,
		CharLength:        int(charLen),
		FlowScore:         AnalyzeFlow(decoded),
		IsPalindrome:      IsPalindrome(lower),
		IsKeyboardPattern: IsKeyboardPattern(lower),
		IsCombo:           comboRes.IsCombo,
		ComboValue:        comboRes.Value,
		IsTechPattern:     techRes.IsTechPattern,
		HasGoldenYear:     yearRes.HasYear,
		AffixBonus:        affixRes.Bonus,
		TierMultiplier:    tierRes.Multiplier,
		FrequencyRank:     RankWord(decoded),
		IsHyped:           IsHyped(decoded),
		EuphonyScore:      euphonyScore,
		IsAesthetic:       isAesthetic,
	}

	return segment, charLen, features
}

// isDictionaryWord checks if a username is a known dictionary word.
// This is a simplified check; the full Trie is in the parent package.
// For the AVM, we use a basic embedded check.
func isDictionaryWord(lower string) bool {
	// Common high-value dictionary words relevant for username valuation.
	// The full Trie from analysis.go covers ~4000 words; this is a subset
	// for the standalone AVM package. In production, this will be injected.
	dictWords := map[string]bool{
		"auto": true, "bank": true, "bitcoin": true, "boss": true,
		"buy": true, "cars": true, "casino": true, "crypto": true,
		"game": true, "gold": true, "money": true, "news": true,
		"shop": true, "sport": true, "tesla": true, "trade": true,
		"wallet": true, "ton": true, "nft": true, "bet": true,
		"apple": true, "google": true, "meta": true, "pay": true,
		"coin": true, "ai": true, "tech": true, "web": true,
		"chat": true, "love": true, "king": true, "club": true,
		"play": true, "star": true, "cool": true, "best": true,
		"top": true, "pro": true, "vip": true, "max": true,
		"whale": true, "rare": true, "bull": true, "bear": true,
		"rich": true, "moon": true, "pump": true, "god": true,
		"queen": true, "root": true, "admin": true, "alpha": true,
		"epic": true, "dark": true, "light": true, "fire": true,
		"good": true, "fast": true, "lord": true, "hero": true,
	}
	return dictWords[lower]
}

// Valuate executes the full AVM pipeline for a username.
//
// Execution DAG:
//  1. Classify username → segment, length, morphology
//  2. Parallel fetch: exact comparables, broad comparables, momentum counts
//  3. Math engine: float64 → shrinkage → morphology → momentum → range → decimal
//  4. Synchronous audit write (fail = 500)
//  5. Return result with run_id
func (s *ValuationService) Valuate(ctx context.Context, username string, tonRate float64) (*ValuationResult, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not available for valuation")
	}

	now := time.Now()
	segment, charLen, features := ClassifyUsername(username)
	reasoning := map[string]any{
		"segment":     segment,
		"char_length": charLen,
		"features":    features,
		"timestamp":   now.Format(time.RFC3339),
	}

	// ── Step 2: Parallel Fetch ──
	var (
		exactSales  []repository.Sale
		broadSales  []repository.Sale
		targetSales []repository.Sale
		count30     int
		count31_90  int
	)

	g, gCtx := errgroup.WithContext(ctx)

	g.Go(func() error {
		var err error
		exactSales, err = s.db.GetExactComparables(gCtx, segment, charLen, now, 200)
		return err
	})

	g.Go(func() error {
		var err error
		broadSales, err = s.db.GetBroadComparables(gCtx, segment, now, 500)
		return err
	})

	g.Go(func() error {
		var err error
		count30, count31_90, err = s.db.GetMomentumCounts(gCtx, segment, charLen, now)
		return err
	})

	g.Go(func() error {
		var err error
		targetSales, err = s.db.GetSalesByUsername(gCtx, username)
		return err
	})

	if err := g.Wait(); err != nil {
		slog.Error("AVM parallel fetch failed", "username", username, "error", err)
		return nil, fmt.Errorf("failed to fetch comparable data: %w", err)
	}

	reasoning["exact_sales_count"] = len(exactSales)
	reasoning["broad_sales_count"] = len(broadSales)
	reasoning["target_sales_count"] = len(targetSales)
	reasoning["momentum_30d"] = count30
	reasoning["momentum_31_90d"] = count31_90

	// ── Step 3: Math Engine (float64 isolated zone) ──

	// Convert DB sales to engine ComparableSales with normalization
	exactComps := SalesToComparables(exactSales, s.cfg)
	broadComps := SalesToComparables(broadSales, s.cfg)

	// 3a. Base Price (Bayesian)
	baseLog, nEff, mad, saleIDs := CalcBaseLog(exactComps, broadComps, s.cfg, features, now)

	// 3b. Morphology
	morphLog := CalcMorphologyLog(features, s.cfg.MorphMultipliers, s.cfg)

	// --- ANCHOR OVERRIDE ---
	// If the exact username was sold before, use its latest sale price as the anchor
	var anchorSale *repository.Sale
	lowerUsername := strings.ToLower(username)

	// 1. In-Memory Hardcoded Historical Dataset Bypass
	if hardcodedPrice, ok := HistoricalSales[lowerUsername]; ok && hardcodedPrice > 0 {
		baseLog = math.Log(hardcodedPrice)
		nEff = 100.0 // Max confidence for exact historical match
		// Heavily dampen MorphLog because premium is already priced into the anchor
		morphLog = morphLog * 0.1 
		reasoning["anchor_sale_used"] = true
		reasoning["anchor_price"] = hardcodedPrice
		reasoning["anchor_source"] = "memory_hardcoded"
	} else if len(targetSales) > 0 {
		// 2. Fallback to Postgres Database Target Sales
		anchorSale = &targetSales[0] // GetSalesByUsername orders by sale_date DESC
		// Use normalized price of the anchor sale
		anchorPrice := ToFloat64(NormalizeSalePrice(anchorSale.SalePriceTON, anchorSale.SaleType, s.cfg))
		
		if anchorPrice > 0 {
			baseLog = math.Log(anchorPrice)
			nEff = 100.0 // Max confidence for exact historical match
			// Heavily dampen MorphLog because premium is already priced into the anchor
			morphLog = morphLog * 0.1 
			reasoning["anchor_sale_used"] = true
			reasoning["anchor_price"] = anchorPrice
			reasoning["anchor_source"] = "postgres_db"
			saleIDs = []int64{anchorSale.ID}
		}
	}

	reasoning["base_log"] = baseLog
	reasoning["n_eff"] = nEff
	reasoning["mad"] = mad
	reasoning["morph_log"] = morphLog

	// 3c. Momentum
	priceTrend := 1.0 // Default neutral; could be computed from price series
	momentumLog := CalcSmoothedMomentum(count30, count31_90, priceTrend, s.cfg)
	reasoning["momentum_log"] = momentumLog

	// 3d. Range
	expectedTONRaw, lowTONRaw, highTONRaw := CalcRangeLog(baseLog, morphLog, momentumLog, mad, features.CharLength, s.cfg)
	basePriceTON := math.Exp(baseLog) // base before morph/momentum is exp(baseLog)

	expectedTON := AestheticRound(expectedTONRaw)
	lowTON := AestheticRound(lowTONRaw)
	highTON := AestheticRound(highTONRaw)

	reasoning["expected_ton"] = expectedTON
	reasoning["low_ton"] = lowTON
	reasoning["high_ton"] = highTON

	// ── Cast back to decimal.Decimal ──
	expectedDec := FromFloat64(expectedTON)
	lowDec := FromFloat64(lowTON)
	highDec := FromFloat64(highTON)
	baseDec := FromFloat64(basePriceTON)

	// Dual denomination
	tonRateDec := decimal.NewFromFloat(tonRate)
	expectedUSD := expectedDec.Mul(tonRateDec).Round(4)
	lowUSD := lowDec.Mul(tonRateDec).Round(4)
	highUSD := highDec.Mul(tonRateDec).Round(4)

	// Confidence
	hasMomentum := count30 > 0 || count31_90 > 0
	confidence := CalcConfidenceScore(nEff, len(exactSales)+len(broadSales), mad, hasMomentum)
	reasoning["confidence_score"] = confidence

	// ── Step 4: Synchronous Audit Write ──
	configJSON, _ := json.Marshal(s.cfg)
	reasoningJSON, _ := json.Marshal(reasoning)

	run := repository.ValuationRun{
		Username:          username,
		ModelVersion:      ModelVersion,
		ConfigSnapshot:    configJSON,
		TONUSDRate:        decimal.NewFromFloat(tonRate),
		BasePriceTON:      baseDec,
		LowTON:            lowDec,
		ExpectedTON:       expectedDec,
		HighTON:           highDec,
		ConfidenceScore:   confidence,
		ComparableSaleIDs: saleIDs,
		ReasoningLog:      reasoningJSON,
	}

	runID, err := s.db.InsertValuationRun(ctx, run)
	if err != nil {
		slog.Error("AVM audit write FAILED — request will be rejected",
			"username", username, "error", err)
		return nil, fmt.Errorf("valuation audit write failed (non-negotiable): %w", err)
	}

	// ── Step 5: Return DTO ──
	return &ValuationResult{
		RunID:           runID,
		Username:        username,
		ModelVersion:    ModelVersion,
		BasePriceTON:    baseDec,
		LowTON:          lowDec,
		ExpectedTON:     expectedDec,
		HighTON:         highDec,
		LowUSD:          lowUSD,
		ExpectedUSD:     expectedUSD,
		HighUSD:         highUSD,
		ConfidenceScore: confidence,
		TONUSDRate:      tonRate,
		ComparableSales: len(exactSales) + len(broadSales),
		Rarity: ValuationRarity{
			Tier:  GetTier(expectedTON),
			Stars: GetStars(expectedTON),
		},
		ReasoningLog:    reasoning,
	}, nil
}

// SalesToComparables converts repository sales to math engine ComparableSales
// with sale-type normalization applied.
func SalesToComparables(sales []repository.Sale, cfg EngineConfig) []ComparableSale {
	comps := make([]ComparableSale, 0, len(sales))
	for _, s := range sales {
		normalized := NormalizeSalePrice(s.SalePriceTON, s.SaleType, cfg)
		comps = append(comps, ComparableSale{
			ID:            s.ID,
			PriceTON:      ToFloat64(normalized),
			SaleDate:      s.SaleDate,
			HasNumbers:    s.HasNumbers,
			HasUnderscore: s.HasUnderscore,
			IsDictionary:  s.IsDictionary,
		})
	}
	return comps
}
