package avm

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/repository"
	"log/slog"
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
	ReasoningLog    map[string]any  `json:"reasoning_log"`
}

// ClassifyUsername extracts the segment and morphology features.
func ClassifyUsername(username string) (segment string, charLen int16, features MorphFeatures) {
	lower := strings.ToLower(username)
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

	features = MorphFeatures{
		HasNumbers:    hasNumbers,
		HasUnderscore: hasUnderscore,
		IsDictionary:  isDictionaryWord(lower),
		CharLength:    int(charLen),
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
		exactSales []repository.Sale
		broadSales []repository.Sale
		count30    int
		count31_90 int
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

	if err := g.Wait(); err != nil {
		slog.Error("AVM parallel fetch failed", "username", username, "error", err)
		return nil, fmt.Errorf("failed to fetch comparable data: %w", err)
	}

	reasoning["exact_sales_count"] = len(exactSales)
	reasoning["broad_sales_count"] = len(broadSales)
	reasoning["momentum_30d"] = count30
	reasoning["momentum_31_90d"] = count31_90

	// ── Step 3: Math Engine (float64 isolated zone) ──

	// Convert DB sales to engine ComparableSales with normalization
	exactComps := SalesToComparables(exactSales, s.cfg)
	broadComps := SalesToComparables(broadSales, s.cfg)

	// 3a. Base price via Bayesian shrinkage
	baseLog, nEff, mad, saleIDs := CalcBaseLog(exactComps, broadComps, s.cfg, now)
	reasoning["base_log"] = baseLog
	reasoning["n_eff"] = nEff
	reasoning["mad"] = mad

	// 3b. Morphology
	morphLog := CalcMorphologyLog(features, s.cfg.MorphMultipliers, s.cfg)
	reasoning["morph_log"] = morphLog

	// 3c. Momentum
	priceTrend := 1.0 // Default neutral; could be computed from price series
	momentumLog := CalcSmoothedMomentum(count30, count31_90, priceTrend, s.cfg)
	reasoning["momentum_log"] = momentumLog

	// 3d. Range
	expectedTON, lowTON, highTON := CalcRangeLog(baseLog, morphLog, momentumLog, mad, s.cfg)
	basePriceTON := expectedTON // base before morph/momentum is exp(baseLog)

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
