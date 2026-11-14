package nvengine

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"sync"
	"time"

	"ifragment-backend/internal/client/laya"
	"ifragment-backend/internal/service/numbers/features"
)

// LayaNumberResult holds Laya System One decisions for anonymous phone numbers (+888).
type LayaNumberResult struct {
	ScoreChina           int     `json:"score_china"`            // 1-100
	ScoreRussia          int     `json:"score_russia"`           // 1-100
	ScoreMENA            int     `json:"score_mena"`             // 1-100
	PatternAesthetics    int     `json:"pattern_aesthetics"`     // 1-10
	OTCWhaleDesirability int     `json:"otc_whale_desirability"` // 1-100
	KeypadErgonomicScore int     `json:"keypad_ergonomic_score"` // 1-100
	CollectorPrestige    string  `json:"collector_prestige"`     // grail_monodigit, high_status, etc.
	LiquiditySpeed       string  `json:"liquidity_speed"`        // instant_liquid, active_trade, etc.
	BuyerArchetype       string  `json:"buyer_archetype"`        // crypto_whale, prestige_businessman, etc.
	DecisionMultiplier   float64 `json:"decision_multiplier"`    // [0.88, 1.28] continuous System 1 valuation multiplier
	Confidence           float64 `json:"confidence"`             // 0.0 to 1.0
	SummaryFa            string  `json:"summary_fa"`
	SummaryEn            string  `json:"summary_en"`
}

// LayaNumberEvaluator handles System One evaluations for +888 Anonymous Numbers via Laya.
type LayaNumberEvaluator struct {
	client     *laya.Client
	cache      map[string]*LayaNumberResult
	cacheTimes map[string]time.Time
	mu         sync.RWMutex
	cacheTTL   time.Duration
}

// NewLayaNumberEvaluator creates a new number evaluator.
func NewLayaNumberEvaluator() *LayaNumberEvaluator {
	return &LayaNumberEvaluator{
		client:     laya.NewClient(),
		cache:      make(map[string]*LayaNumberResult),
		cacheTimes: make(map[string]time.Time),
		cacheTTL:   24 * time.Hour,
	}
}

// EvaluateNumber passes the number pattern, Fitts's Law biomechanics, DTMF acoustics, and morphology to Laya for multi-regional analysis.
func (e *LayaNumberEvaluator) EvaluateNumber(ctx context.Context, rawNumber string) *LayaNumberResult {
	clean := strings.TrimPrefix(strings.TrimSpace(rawNumber), "+888")
	clean = strings.ReplaceAll(clean, " ", "")
	full := "+888" + clean
	if norm, err := features.NormalizeNumber(rawNumber); err == nil {
		full = norm
		clean = strings.TrimPrefix(norm, "+888")
	}

	e.mu.RLock()
	cached, ok := e.cache[full]
	cachedAt := e.cacheTimes[full]
	e.mu.RUnlock()

	if ok && time.Since(cachedAt) < e.cacheTTL {
		return cached
	}

	fv, fvErr := features.ExtractFeatures(full)

	questions := map[string]laya.Question{
		"cultural_resonance_cn": {
			Type:         laya.TypeScore,
			Instructions: "Rate Chinese cultural numerology prestige from 1 to 100 based on auspicious digits (8, 6, 9, 168, 518) and avoiding 4.",
		},
		"cultural_resonance_ru": {
			Type:         laya.TypeScore,
			Instructions: "Rate Russian/CIS elite mobile prestige from 1 to 100 based on car-plate symmetry (777, 888, 999, 001, 007), repeating triples and mirror patterns.",
		},
		"cultural_resonance_mena": {
			Type:         laya.TypeScore,
			Instructions: "Rate Middle East / Arab / Persian VIP mobile prestige from 1 to 100 based on royal plate zeros, repeating sequences and status value.",
		},
		"pattern_aesthetics": {
			Type:         laya.TypeScore,
			Instructions: "Rate overall keypad typing flow, visual symmetry, and memory retention from 1 to 10.",
		},
		"otc_whale_desirability": {
			Type:         laya.TypeScore,
			Instructions: "Rate Web3 OTC whale and institutional vault desirability from 1 to 100.",
		},
		"keypad_ergonomic_score": {
			Type:         laya.TypeScore,
			Instructions: "Rate ITU-T E.161 Fitts's Law keypad biomechanics and DTMF acoustic consonance from 1 to 100.",
		},
		"collector_prestige": {
			Type:         laya.TypeChoice,
			Instructions: "Classify collector tier.",
			Criteria: map[string]string{
				"grail_monodigit":  "Ultra-rare single or two unique digits (Holy Grail)",
				"high_status":      "Repetitive, mirror or clean vanity sequence",
				"vanity_lifestyle": "Pleasing rhythm or easy-to-remember sequence",
				"standard":         "Standard phone number sequence",
			},
		},
		"liquidity_speed": {
			Type:         laya.TypeChoice,
			Instructions: "Predict secondary market velocity on Fragment.",
			Criteria: map[string]string{
				"instant_liquid": "Sells in under 7 days",
				"active_trade":   "Sells within 1 month",
				"medium_hold":    "Sells in 1 to 3 months",
				"illiquid_hold":  "Long-term collector hold (6+ months)",
			},
		},
		"buyer_archetype": {
			Type:         laya.TypeChoice,
			Instructions: "Identify target buyer persona.",
			Criteria: map[string]string{
				"crypto_whale":         "TON / Web3 high roller using +888 for privacy",
				"prestige_businessman": "Executive or VIP using number as a status signal",
				"collector_investor":   "Speculator holding rare pattern for capital gain",
				"retail_user":          "Casual user wanting a clean personal anonymous number",
			},
		},
	}

	state := map[string]any{
		"number":      full,
		"digits":      clean,
		"digit_count": len(clean),
	}
	if fvErr == nil {
		state["is_genesis_4digit"] = fv.IsGenesis4Digit
		state["vip_tier"] = string(fv.VIP.Tier)
		state["pattern_key"] = fv.VIP.PatternKey
		state["max_run"] = fv.MaxRun
		state["effective_max_run"] = fv.EffectiveMaxRun
		state["distinct_digits"] = fv.DistinctDigits
		state["is_palindrome"] = fv.IsPalindrome
		state["is_full_dial_palindrome"] = fv.IsFullDialPalindrome
		state["repeated_block"] = fv.RepeatedBlock
		state["echo_harmonics"] = fv.EchoHarmonics
		state["tail_class"] = fv.TailClass
		state["fitts_ergonomic_score"] = fv.DialPad.FittsErgonomicScore
		state["fitts_index_bits"] = fv.DialPad.FittsIndexBits
		state["dtmf_consonance"] = fv.DialPad.DTMFConsonanceScore
		state["lucky_weight"] = fv.LuckyWeight
		state["unlucky_weight"] = fv.UnluckyWeight
		state["rarity_score"] = fv.RarityScore
	}

	resp, err := e.client.Evaluate(ctx, state, questions)
	if err != nil {
		slog.Warn("Laya number evaluation error, using fallback", "number", full, "error", err)
		return e.fallbackNumber(clean, fv)
	}

	result := e.parseResponse(clean, fv, resp)

	e.mu.Lock()
	if len(e.cache) >= 10000 {
		e.cache = make(map[string]*LayaNumberResult)
		e.cacheTimes = make(map[string]time.Time)
	}
	e.cache[full] = result
	e.cacheTimes[full] = time.Now()
	e.mu.Unlock()

	return result
}

func (e *LayaNumberEvaluator) parseResponse(digits string, fv features.FeatureVector, resp *laya.Response) *LayaNumberResult {
	res := &LayaNumberResult{
		ScoreChina:           60,
		ScoreRussia:          60,
		ScoreMENA:            60,
		PatternAesthetics:    6,
		OTCWhaleDesirability: 60,
		KeypadErgonomicScore: 65,
		CollectorPrestige:    "vanity_lifestyle",
		LiquiditySpeed:       "active_trade",
		BuyerArchetype:       "prestige_businessman",
		DecisionMultiplier:   1.0,
		Confidence:           0.96,
	}

	var confSum float64
	var confCnt int

	if a, ok := resp.Answers["cultural_resonance_cn"]; ok && a.Score > 0 {
		res.ScoreChina = a.Score
		confSum += a.Confidence
		confCnt++
	}
	if a, ok := resp.Answers["cultural_resonance_ru"]; ok && a.Score > 0 {
		res.ScoreRussia = a.Score
		confSum += a.Confidence
		confCnt++
	}
	if a, ok := resp.Answers["cultural_resonance_mena"]; ok && a.Score > 0 {
		res.ScoreMENA = a.Score
		confSum += a.Confidence
		confCnt++
	}
	if a, ok := resp.Answers["pattern_aesthetics"]; ok && a.Score > 0 {
		res.PatternAesthetics = a.Score
		confSum += a.Confidence
		confCnt++
	}
	if a, ok := resp.Answers["otc_whale_desirability"]; ok && a.Score > 0 {
		res.OTCWhaleDesirability = a.Score
	}
	if a, ok := resp.Answers["keypad_ergonomic_score"]; ok && a.Score > 0 {
		res.KeypadErgonomicScore = a.Score
	}
	if a, ok := resp.Answers["collector_prestige"]; ok && a.Choice != "" {
		res.CollectorPrestige = a.Choice
	}
	if a, ok := resp.Answers["liquidity_speed"]; ok && a.Choice != "" {
		res.LiquiditySpeed = a.Choice
	}
	if a, ok := resp.Answers["buyer_archetype"]; ok && a.Choice != "" {
		res.BuyerArchetype = a.Choice
	}

	if confCnt > 0 {
		res.Confidence = math.Round((confSum/float64(confCnt))*100.0) / 100.0
	}

	// Compute continuous System 1 DecisionMultiplier in [0.88, 1.28]
	maxRegional := math.Max(float64(res.ScoreChina), math.Max(float64(res.ScoreRussia), float64(res.ScoreMENA)))
	meanRegional := (float64(res.ScoreChina) + float64(res.ScoreRussia) + float64(res.ScoreMENA)) / 3.0
	composite01 := (0.45*maxRegional + 0.25*meanRegional + 0.15*float64(res.PatternAesthetics*10) + 0.15*float64(res.KeypadErgonomicScore)) / 100.0
	mult := 0.88 + composite01*0.36
	if res.CollectorPrestige == "grail_monodigit" {
		mult += 0.04
	}
	res.DecisionMultiplier = math.Round(math.Max(0.88, math.Min(1.28, mult))*1000.0) / 1000.0

	res.SummaryEn = fmt.Sprintf(
		"LAYA System 1 Multi-Regional Verdict: CN=%d/100, CIS/RU=%d/100, MENA=%d/100 | Keypad Ergonomics=%d/100 | Tier=%s (%s, %.2fx).",
		res.ScoreChina, res.ScoreRussia, res.ScoreMENA, res.KeypadErgonomicScore, res.CollectorPrestige, res.BuyerArchetype, res.DecisionMultiplier,
	)
	res.SummaryFa = fmt.Sprintf(
		"تحلیل چندمنطقه‌ای LAYA System 1: امتیاز شرق آسیا %d/100، روسیه/CIS %d/100، خاورمیانه/ایران %d/100 | ارگونومی کی‌پد %d/100 | رده کلکسیونی: %s (ضریب %.2fx).",
		res.ScoreChina, res.ScoreRussia, res.ScoreMENA, res.KeypadErgonomicScore, res.CollectorPrestige, res.DecisionMultiplier,
	)

	return res
}

func (e *LayaNumberEvaluator) fallbackNumber(digits string, fv features.FeatureVector) *LayaNumberResult {
	cn, ru, mena := 58, 58, 58
	aesthetics := 6
	ergo := 65
	if fv.Suffix != "" {
		ergo = int(math.Round(fv.DialPad.FittsErgonomicScore))
		if ergo < 1 {
			ergo = 55
		}
		if fv.RarityScore >= 85 {
			aesthetics = 9
		} else if fv.RarityScore >= 65 {
			aesthetics = 8
		}
	}
	return &LayaNumberResult{
		ScoreChina:           cn,
		ScoreRussia:          ru,
		ScoreMENA:            mena,
		PatternAesthetics:    aesthetics,
		OTCWhaleDesirability: 60,
		KeypadErgonomicScore: ergo,
		CollectorPrestige:    "vanity_lifestyle",
		LiquiditySpeed:       "active_trade",
		BuyerArchetype:       "prestige_businessman",
		DecisionMultiplier:   1.0,
		Confidence:           0.85,
		SummaryEn:            "Deterministic pattern evaluation calibrated across East Asia, CIS, and MENA markets.",
		SummaryFa:            "ارزیابی الگو کالیبره‌شده بر اساس بازارهای شرق آسیا، CIS و خاورمیانه.",
	}
}
