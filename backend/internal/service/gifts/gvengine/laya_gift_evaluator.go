package gvengine

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"sync"
	"time"

	"ifragment-backend/internal/client/laya"
)

// GiftTelemetryInput provides full on-chain and perceptual color-science telemetry
// to the Laya System 1 Gift Decision Engine.
type GiftTelemetryInput struct {
	CollectionID        string
	ModelVariant        string
	ModelRarityPct      float64
	Backdrop            string
	BackdropPermille    int
	Symbol              string
	SymbolPermille      int
	Serial              int
	TotalSupply         int
	SerialCategory      string
	DeltaE2000          float64
	IsColorMatched      bool
	DominantFloorDriver string
	FloorLockRegime     string
	HasSpecialFeature   bool
	HasTelemetry        bool
	IsCrafted           bool
}

// LayaGiftResult contains System One decisions for Telegram Gifts via Laya.
type LayaGiftResult struct {
	TraitSynergyScore      int     `json:"trait_synergy_score"`      // 1-10
	MonochromeMatchScore   int     `json:"monochrome_match_score"`   // 1-100 perceptual CIEDE2000 match score
	CollectorAppeal        string  `json:"collector_appeal"`         // museum_grail, aesthetic_elite, floor_sweeper, mismatched_colors
	FloorLockRegime        string  `json:"floor_lock_regime"`        // COLLECTION_FLOOR_LOCKED, MODEL_FLOOR_LOCKED, BACKDROP_FLOOR_LOCKED, SPECIAL_COLLECTOR_GRAIL
	ActionRecommendation   string  `json:"action_recommendation"`    // HOLD, SELL_NOW, CRAFT_FORGE, UPGRADE
	LiquidityTier          string  `json:"liquidity_tier"`           // ultra_liquid, high_turnover, slow_liquid, illiquid
	CraftFodderSuitability float64 `json:"craft_fodder_suitability"` // 0.0 (Never Burn Grail) to 1.0 (Ideal Forge Burn Fodder)
	WhaleHoldProbability   float64 `json:"whale_hold_probability"`   // 0.0 to 1.0
	WashTradeAnomaly       float64 `json:"wash_trade_anomaly"`       // 0.0 to 1.0
	Confidence             float64 `json:"confidence"`               // 0.0 to 1.0
	SynergyMultiplier      float64 `json:"synergy_multiplier"`       // 1.00x (floor-locked) or 0.90x to 1.30x (special collector regime)
	VerdictSummaryEn       string  `json:"verdict_summary_en"`
	VerdictSummaryFa       string  `json:"verdict_summary_fa"`
}

// LayaGiftEvaluator handles System One evaluations for Telegram Gifts using Laya.
type LayaGiftEvaluator struct {
	client     *laya.Client
	cache      map[string]*LayaGiftResult
	cacheTimes map[string]time.Time
	mu         sync.RWMutex
	cacheTTL   time.Duration
}

// NewLayaGiftEvaluator creates a new gift evaluator.
func NewLayaGiftEvaluator() *LayaGiftEvaluator {
	return &LayaGiftEvaluator{
		client:     laya.NewClient(),
		cache:      make(map[string]*LayaGiftResult),
		cacheTimes: make(map[string]time.Time),
		cacheTTL:   24 * time.Hour,
	}
}

// EvaluateGift evaluates trait harmony, collector appeal, and action recommendation via Laya.
func (e *LayaGiftEvaluator) EvaluateGift(ctx context.Context, modelName, backdrop, symbol string, serial int) *LayaGiftResult {
	return e.EvaluateGiftWithTelemetry(ctx, GiftTelemetryInput{
		CollectionID:      modelName,
		ModelVariant:      modelName,
		ModelRarityPct:    1.5,
		Backdrop:          backdrop,
		BackdropPermille:  20,
		Symbol:            symbol,
		SymbolPermille:    20,
		Serial:            serial,
		HasSpecialFeature: true,
		HasTelemetry:      false,
	})
}

// EvaluateGiftWithTelemetry evaluates a Telegram Collectible Gift using full trait rarity,
// CIEDE2000 perceptual color-matching, and 4-Regime Floor-Lock telemetry.
func (e *LayaGiftEvaluator) EvaluateGiftWithTelemetry(ctx context.Context, in GiftTelemetryInput) *LayaGiftResult {
	key := fmt.Sprintf("%s:%s:%s:%s:%d:%t:%.1f:%s",
		in.CollectionID, in.ModelVariant, in.Backdrop, in.Symbol,
		in.Serial, in.HasSpecialFeature, in.DeltaE2000, in.FloorLockRegime,
	)

	e.mu.RLock()
	cached, ok := e.cache[key]
	cachedAt := e.cacheTimes[key]
	e.mu.RUnlock()

	if ok && time.Since(cachedAt) < e.cacheTTL {
		return cached
	}

	questions := map[string]laya.Question{
		"trait_synergy": {
			Type:         laya.TypeScore,
			Instructions: "Rate visual color harmony, aesthetic prestige and trait matching between Model, Backdrop, and Symbol from 1 to 10.",
		},
		"collector_appeal": {
			Type:         laya.TypeChoice,
			Instructions: "Classify secondary market collector desirability.",
			Criteria: map[string]string{
				"museum_grail":      "Ultra-elite perfect color match or two-digit serial grail",
				"aesthetic_elite":   "Harmonious vibrant palette highly sought after by collectors",
				"floor_sweeper":     "Average decent combination trading near collection floor",
				"mismatched_colors": "Clashing or unappealing color tones trading at a discount",
			},
		},
		"action_recommendation": {
			Type:         laya.TypeChoice,
			Instructions: "Determine optimal strategic action for the holder.",
			Criteria: map[string]string{
				"HOLD":        "Accumulate / Hold for long-term scarcity appreciation",
				"SELL_NOW":    "Take profit immediately while floor momentum is elevated",
				"CRAFT_FORGE": "Use in Telegram Gift Forge / Crafting to create higher tier artifact",
				"UPGRADE":     "Burn stars or apply enhancement to upgrade metadata tier",
			},
		},
		"liquidity_tier": {
			Type:         laya.TypeChoice,
			Instructions: "Estimate exit speed at fair value.",
			Criteria: map[string]string{
				"ultra_liquid":  "Under 24 hours - instant buy wall",
				"high_turnover": "1 to 7 days - rapid turnover",
				"slow_liquid":   "1 to 4 weeks - normal NFT liquidity",
				"illiquid":      "Over 1 month - niche collector item",
			},
		},
		"wash_trade_anomaly": {
			Type:         laya.TypeNoul,
			Instructions: "Probability of secondary marketplace wash trading or artificial floor manipulation.",
		},
	}

	state := map[string]any{
		"collection":           in.CollectionID,
		"model":                in.ModelVariant,
		"model_rarity_pct":     in.ModelRarityPct,
		"backdrop":             in.Backdrop,
		"backdrop_permille":    in.BackdropPermille,
		"symbol":               in.Symbol,
		"symbol_permille":      in.SymbolPermille,
		"serial":               in.Serial,
		"total_supply":         in.TotalSupply,
		"serial_category":      in.SerialCategory,
		"delta_e_2000":         in.DeltaE2000,
		"is_color_matched":     in.IsColorMatched,
		"dominant_floor":       in.DominantFloorDriver,
		"floor_lock_regime":    in.FloorLockRegime,
		"has_special_feature":  in.HasSpecialFeature,
		"is_crafted":           in.IsCrafted,
	}

	resp, err := e.client.Evaluate(ctx, state, questions)
	if err != nil {
		slog.Warn("Laya gift evaluation error, using fallback", "key", key, "error", err)
		return e.fallbackGiftWithTelemetry(in)
	}

	result := e.parseResponse(resp, in)

	e.mu.Lock()
	if len(e.cache) >= 10000 {
		e.cache = make(map[string]*LayaGiftResult)
		e.cacheTimes = make(map[string]time.Time)
	}
	e.cache[key] = result
	e.cacheTimes[key] = time.Now()
	e.mu.Unlock()

	return result
}

func (e *LayaGiftEvaluator) parseResponse(resp *laya.Response, in GiftTelemetryInput) *LayaGiftResult {
	regime := in.FloorLockRegime
	if regime == "" {
		if in.HasSpecialFeature {
			regime = "SPECIAL_COLLECTOR_GRAIL"
		} else {
			regime = "COLLECTION_FLOOR_LOCKED"
		}
	}

	res := &LayaGiftResult{
		TraitSynergyScore:    7,
		MonochromeMatchScore: 68,
		CollectorAppeal:      "aesthetic_elite",
		FloorLockRegime:      regime,
		ActionRecommendation: "HOLD",
		LiquidityTier:        "high_turnover",
		WashTradeAnomaly:     0.05,
		Confidence:           0.94,
		SynergyMultiplier:    1.00,
	}

	if a, ok := resp.Answers["trait_synergy"]; ok && a.Score > 0 {
		res.TraitSynergyScore = a.Score
	}
	if a, ok := resp.Answers["collector_appeal"]; ok && a.Choice != "" {
		res.CollectorAppeal = a.Choice
	}
	if a, ok := resp.Answers["action_recommendation"]; ok && a.Choice != "" {
		res.ActionRecommendation = a.Choice
	}
	if a, ok := resp.Answers["liquidity_tier"]; ok && a.Choice != "" {
		res.LiquidityTier = a.Choice
	}
	if a, ok := resp.Answers["wash_trade_anomaly"]; ok {
		res.WashTradeAnomaly = a.Noul
	}

	// Compute perceptual Monochrome Match Score (1-100) from CIEDE2000
	if in.DeltaE2000 > 0 {
		matchScore := int(math.Round(math.Max(15.0, math.Min(99.0, 100.0-in.DeltaE2000*1.45))))
		if in.IsColorMatched && matchScore < 88 {
			matchScore = 88
		}
		res.MonochromeMatchScore = matchScore
	} else if in.IsColorMatched {
		res.MonochromeMatchScore = 94
	}

	// Enforce 4-Regime Floor-Lock Law when full telemetry is provided:
	if in.HasTelemetry && !in.HasSpecialFeature {
		// Floor-locked regime: item trades strictly at its dominant floor (Collection, Model, or Backdrop floor)
		res.SynergyMultiplier = 1.00
		if regime == "COLLECTION_FLOOR_LOCKED" {
			res.CollectorAppeal = "floor_sweeper"
			res.LiquidityTier = "ultra_liquid"
			res.CraftFodderSuitability = 0.88
			res.WhaleHoldProbability = 0.32
			if res.TraitSynergyScore > 7 {
				res.TraitSynergyScore = 7
			}
		} else {
			// Locked at a rare Model Floor or Tier-S/A Backdrop Floor (without extra compounding traits)
			res.CollectorAppeal = "aesthetic_elite"
			res.LiquidityTier = "high_turnover"
			res.CraftFodderSuitability = 0.08 // Never burn a rare Model or Black Backdrop in Forge!
			res.WhaleHoldProbability = 0.74
		}
	} else {
		// Special Collector Grail regime (or standalone evaluation):
		mult := 1.00 + (float64(res.TraitSynergyScore-7) / 25.0)
		if in.IsColorMatched {
			mult += 0.06
			if res.TraitSynergyScore < 9 {
				res.TraitSynergyScore = 9
			}
			res.CollectorAppeal = "museum_grail"
		}
		if in.Serial > 0 && in.Serial <= 100 {
			mult += 0.05 // Low serial aesthetic reinforcement
		}
		if mult < 0.90 {
			mult = 0.90
		} else if mult > 1.28 {
			mult = 1.28
		}
		res.SynergyMultiplier = math.Round(mult*100) / 100.0
		res.CraftFodderSuitability = 0.02
		res.WhaleHoldProbability = math.Min(0.98, 0.65+float64(res.TraitSynergyScore)*0.03)
		if in.Serial > 0 && in.Serial <= 25 {
			res.CollectorAppeal = "museum_grail"
			res.ActionRecommendation = "HOLD"
		}
	}

	res.VerdictSummaryEn = fmt.Sprintf(
		"Laya System 1 [%s]: %s (Synergy: %d/10, CIEDE2000 Match: %d/100, Rec: %s)",
		res.FloorLockRegime, res.CollectorAppeal, res.TraitSynergyScore, res.MonochromeMatchScore, res.ActionRecommendation,
	)
	res.VerdictSummaryFa = fmt.Sprintf(
		"تصمیم هوشمند Laya (رژیم %s): جذابیت %s با همخوانی صفات %d/10، تطابق رنگی %d/100 و توصیه به %s.",
		res.FloorLockRegime, res.CollectorAppeal, res.TraitSynergyScore, res.MonochromeMatchScore, res.ActionRecommendation,
	)

	return res
}

func (e *LayaGiftEvaluator) fallbackGift(serial int) *LayaGiftResult {
	return e.fallbackGiftWithTelemetry(GiftTelemetryInput{
		Serial:          serial,
		FloorLockRegime: "COLLECTION_FLOOR_LOCKED",
	})
}

func (e *LayaGiftEvaluator) fallbackGiftWithTelemetry(in GiftTelemetryInput) *LayaGiftResult {
	mult := 1.00
	regime := in.FloorLockRegime
	if regime == "" {
		regime = "COLLECTION_FLOOR_LOCKED"
	}
	return &LayaGiftResult{
		TraitSynergyScore:      6,
		MonochromeMatchScore:   65,
		CollectorAppeal:        "floor_sweeper",
		FloorLockRegime:        regime,
		ActionRecommendation:   "HOLD",
		LiquidityTier:          "high_turnover",
		CraftFodderSuitability: 0.75,
		WhaleHoldProbability:   0.45,
		Confidence:             0.80,
		SynergyMultiplier:      mult,
		VerdictSummaryEn:       "Deterministic gift trait evaluation via Laya System 1.",
		VerdictSummaryFa:       "ارزیابی قطعی صفات گیفت تلگرام با سیستم ۱ لایا.",
	}
}
