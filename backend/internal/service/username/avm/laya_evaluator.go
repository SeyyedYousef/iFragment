package avm

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"sync"
	"time"

	"ifragment-backend/internal/client/laya"
)

// LayaUsernameResult contains the multi-dimensional System One decisions from Laya (Convai Innovations).
type LayaUsernameResult struct {
	TotalScore           float64                `json:"total_score"`            // 0-100 calibrated score
	PhoneticScore        int                    `json:"phonetic_score"`         // 1-10
	ErgonomicScore       int                    `json:"ergonomic_score"`        // 1-10 biomechanical Fitts's Law score
	CulturalResonance    string                 `json:"cultural_resonance"`     // web3_crypto, meme, luxury, etc.
	TargetEntityFit      string                 `json:"target_entity_fit"`      // personal_vip, bot, channel, etc.
	CommercialIntent     float64                `json:"commercial_intent"`      // 0.0 to 1.0
	ViralBrandElasticity float64                `json:"viral_brand_elasticity"` // 0.0 to 1.0
	OTCWhaleDesirability float64                `json:"otc_whale_desirability"` // 0.0 to 1.0
	DecisionMultiplier   float64                `json:"decision_multiplier"`    // 0.50x to 1.45x continuous System 1 modifier
	SystemOneVerdict     string                 `json:"system_one_verdict"`     // Quantitative executive verdict
	TrademarkRiskLevel   string                 `json:"trademark_risk_level"`   // low, medium, high
	SeizureRisk          float64                `json:"seizure_risk"`           // 0.0 to 1.0
	LiquiditySpeed       string                 `json:"liquidity_speed"`        // instant_frenzy, high_velocity, etc.
	BuyerArchetype       string                 `json:"buyer_archetype"`        // ton_whale, project_founder, etc.
	BiddingWarPotential  float64                `json:"bidding_war_potential"`  // 0.0 to 1.0
	Confidence           float64                `json:"confidence"`             // 0.0 to 1.0
	EstimatedSellTime    string                 `json:"estimated_sell_time"`
	LiquidityRating      string                 `json:"liquidity_rating"`
	TargetBuyerProfile   string                 `json:"target_buyer_profile"`
	AuctionTactics       string                 `json:"auction_tactics"`
	Tags                 []string               `json:"tags"`
	Answers              map[string]laya.Answer `json:"answers,omitempty"`
}

// LayaUsernameEvaluator orchestrates Laya System One evaluations for usernames.
type LayaUsernameEvaluator struct {
	client     *laya.Client
	cache      map[string]*LayaUsernameResult
	cacheTimes map[string]time.Time
	mu         sync.RWMutex
	cacheTTL   time.Duration
}

// NewLayaUsernameEvaluator creates a new username evaluator with Laya client.
func NewLayaUsernameEvaluator() *LayaUsernameEvaluator {
	return &LayaUsernameEvaluator{
		client:     laya.NewClient(),
		cache:      make(map[string]*LayaUsernameResult),
		cacheTimes: make(map[string]time.Time),
		cacheTTL:   24 * time.Hour,
	}
}

// Evaluate performs a comprehensive 12-question parallel decision pass via Laya System 1,
// feeding full linguistic, Viterbi, biomechanical (Fitts's Law), and binary forensic signals.
func (e *LayaUsernameEvaluator) Evaluate(ctx context.Context, username string) *LayaUsernameResult {
	clean := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(username), "@"))
	if clean == "" {
		return nil
	}

	// 1. Check local cache
	e.mu.RLock()
	cached, ok := e.cache[clean]
	cachedAt := e.cacheTimes[clean]
	e.mu.RUnlock()

	if ok && time.Since(cachedAt) < e.cacheTTL {
		return cached
	}

	// 2. Extract rich deterministic state vector for Laya System 1
	decoded := DecodeLeetSmart(clean)
	flowScore := AnalyzeFlow(decoded)
	euphonyScore, _ := CalculateEuphony(decoded)
	freqRank := RankWord(clean)
	if freqRank == 0 && decoded != clean {
		freqRank = RankWord(decoded)
	}
	viterbi := ViterbiSegmentUsername(clean)
	shadowRes := DetectTypoOrPhoneticShadow(clean)
	if !shadowRes.IsShadow && freqRank == 0 && viterbi.CompositeRank > 0 && viterbi.CoverageRatio >= 0.85 {
		freqRank = viterbi.CompositeRank
	}
	isDict := !shadowRes.IsShadow && (isDictionaryWord(clean) || isDictionaryWord(decoded) || freqRank > 0 || viterbi.IsCleanCompound)
	isGib := IsGibberishString(clean, isDict, freqRank, flowScore) && viterbi.CoverageRatio < 0.50

	fittsBits, fittsErgo, handAltPct := ComputeFittsBiomechanics(clean)
	kerningSym := ComputeOpticalKerningSymmetry(clean)
	tmMatch := CheckTrademarkSeverity(clean)

	// 3. Define 12 System One Questions for Laya
	questions := map[string]laya.Question{
		"phonetic_memorability": {
			Type:         laya.TypeScore,
			Instructions: "Rate pronounceability, syllable cadence, and auditory memorability from 1 to 10. Short clean dictionary/CVCV words get 8-10; consonant gibberish gets 1-3.",
		},
		"ergonomic_typing_memorability": {
			Type:         laya.TypeScore,
			Instructions: "Rate two-thumb mobile QWERTY typing ergonomics (Fitts's Law index of difficulty & hand alternation) from 1 to 10.",
		},
		"cultural_resonance": {
			Type:         laya.TypeChoice,
			Instructions: "Identify cultural or domain categorization of this handle.",
			Criteria: map[string]string{
				"web3_crypto":      "Blockchain, crypto tokens, DeFi, memes (e.g. ton, sol, btc, pepe)",
				"pop_culture_meme": "Viral internet trends, memes, humor",
				"luxury_status":    "High-end status, wealth, prestige symbols",
				"business_utility": "Practical commerce, finance, tooling, technology",
				"generic_english":  "Standard dictionary English vocabulary word",
				"obscure_filler":   "Random letter combinations, typo or filler",
			},
		},
		"target_entity_fit": {
			Type:         laya.TypeChoice,
			Instructions: "What kind of Telegram identity is this username best suited for?",
			Criteria: map[string]string{
				"personal_vip":     "High-profile individual, executive or influencer handle",
				"automated_bot":    "Service, automation bot, AI assistant or mini-app",
				"official_channel": "News, media, broadcast community hub",
				"web3_project":     "Crypto protocol, token project or NFT collection",
				"web2_enterprise":  "Corporation, e-commerce brand or consumer product",
				"placeholder":      "Casual or burner account",
			},
		},
		"commercial_intent": {
			Type:         laya.TypeNoul,
			Instructions: "Probability that a commercial business or founder would pay a substantial buyout for this name.",
		},
		"viral_brand_elasticity": {
			Type:         laya.TypeNoul,
			Instructions: "Probability that this handle can scale into a recognizable cross-platform consumer or Web3 brand.",
		},
		"otc_whale_desirability": {
			Type:         laya.TypeNoul,
			Instructions: "Probability that a high-net-worth TON ecosystem whale would acquire this handle as a status trophy.",
		},
		"trademark_risk": {
			Type:         laya.TypeChoice,
			Instructions: "Evaluate trademark conflict and impersonation liability under Telegram TOS.",
			Criteria: map[string]string{
				"safe":                    "Clean generic term or non-conflicting personal word",
				"descriptive_fair_use":    "Descriptive industry term with low infringement risk",
				"confusing_impersonation": "Resembles an existing platform, bank or celebrity",
				"direct_infringement":     "Direct exact match of protected global brand (e.g. apple, nike, binance)",
			},
		},
		"seizure_risk": {
			Type:         laya.TypeNoul,
			Instructions: "Probability that Telegram or Fragment could seize or freeze this handle due to squatting or scam risk.",
		},
		"liquidity_speed": {
			Type:         laya.TypeChoice,
			Instructions: "How fast will this username sell if listed at fair market value on Fragment?",
			Criteria: map[string]string{
				"instant_frenzy":     "Under 3 days - extreme liquid demand",
				"high_velocity":      "1 to 2 weeks - very active buyer interest",
				"moderate_liquidity": "1 to 3 months - steady niche market",
				"illiquid_collector": "6+ months - high price ceiling but narrow buyer pool",
			},
		},
		"buyer_archetype": {
			Type:         laya.TypeChoice,
			Instructions: "Most probable buyer archetype on Fragment auction.",
			Criteria: map[string]string{
				"ton_whale":         "High net worth TON ecosystem whale or collector",
				"project_founder":   "Founder acquiring handle for brand or token launch",
				"channel_admin":     "Telegram channel network or media agency",
				"domain_speculator": "Arbitrage trader or domain flipper",
				"retail_user":       "Regular user looking for a personal handle",
			},
		},
		"bidding_war_potential": {
			Type:         laya.TypeNoul,
			Instructions: "Probability of triggering an aggressive multi-bidder auction war.",
		},
	}

	// Deterministic state payload (NO wall-clock timestamp so caching & hashing are 100% reproducible)
	state := map[string]any{
		"username":                 clean,
		"char_length":              len(clean),
		"is_dictionary":            isDict,
		"is_gibberish":             isGib,
		"word_freq_rank":           freqRank,
		"flow_score":               math.Round(flowScore*1000) / 1000,
		"euphony_score":            math.Round(euphonyScore*1000) / 1000,
		"fitts_index_bits":         fittsBits,
		"fitts_ergonomic_score":    fittsErgo,
		"hand_alternation_pct":     handAltPct,
		"optical_kerning_symmetry": kerningSym,
		"viterbi_tokens":           strings.Join(viterbi.Tokens, "+"),
		"viterbi_coverage":         viterbi.CoverageRatio,
		"is_clean_compound":        viterbi.IsCleanCompound,
		"trademark_severity":       string(tmMatch.Severity),
	}

	resp, err := e.client.Evaluate(ctx, state, questions)
	if err != nil {
		slog.Warn("Laya username evaluation failed, using quantitative fallback", "username", clean, "error", err)
		return e.buildFallbackResult(clean, isDict, isGib, flowScore, fittsErgo)
	}

	result := e.parseLayaResponse(clean, resp, isDict, isGib, fittsErgo, viterbi.CoverageRatio)
	if shadowRes.IsShadow {
		result.CulturalResonance = "obscure_filler"
		result.TotalScore = math.Min(result.TotalScore, 26.0)
		result.DecisionMultiplier = 0.72
		result.LiquidityRating = "C (Low Liquidity — Typo Shadow)"
		result.SystemOneVerdict = fmt.Sprintf("Phonetic / Typo Shadow of @%s — traffic leaks to canonical handle", shadowRes.CanonicalWord)
	}

	// 4. Cache result
	e.mu.Lock()
	if len(e.cache) >= 10000 {
		e.cache = make(map[string]*LayaUsernameResult)
		e.cacheTimes = make(map[string]time.Time)
	}
	e.cache[clean] = result
	e.cacheTimes[clean] = time.Now()
	e.mu.Unlock()

	return result
}

func (e *LayaUsernameEvaluator) parseLayaResponse(username string, resp *laya.Response, isDict, isGib bool, fittsErgo, viterbiCov float64) *LayaUsernameResult {
	res := &LayaUsernameResult{
		Answers: resp.Answers,
		Tags:    make([]string, 0),
	}

	// 1. Phonetic Score
	if ans, ok := resp.Answers["phonetic_memorability"]; ok && ans.Score > 0 {
		res.PhoneticScore = ans.Score
	} else {
		res.PhoneticScore = 7
	}

	// 2. Ergonomic Score (Fitts's Law)
	if ans, ok := resp.Answers["ergonomic_typing_memorability"]; ok && ans.Score > 0 {
		res.ErgonomicScore = ans.Score
	} else {
		res.ErgonomicScore = int(math.Round(1.0 + fittsErgo*9.0))
	}

	// 3. Cultural Resonance
	if ans, ok := resp.Answers["cultural_resonance"]; ok {
		res.CulturalResonance = ans.Choice
		switch ans.Choice {
		case "web3_crypto":
			res.Tags = append(res.Tags, "crypto_native", "web3")
		case "luxury_status":
			res.Tags = append(res.Tags, "luxury", "prestige")
		case "business_utility":
			res.Tags = append(res.Tags, "business", "commercial")
		case "pop_culture_meme":
			res.Tags = append(res.Tags, "meme_culture", "viral")
		}
	}

	// 4. Target Entity Fit
	if ans, ok := resp.Answers["target_entity_fit"]; ok {
		res.TargetEntityFit = ans.Choice
	}

	// 5. Commercial Intent, Viral Brand Elasticity, OTC Whale Desirability
	if ans, ok := resp.Answers["commercial_intent"]; ok {
		res.CommercialIntent = ans.Noul
		if ans.Noul >= 0.70 {
			res.Tags = append(res.Tags, "high_commercial_intent")
		}
	}
	if ans, ok := resp.Answers["viral_brand_elasticity"]; ok {
		res.ViralBrandElasticity = ans.Noul
	} else {
		res.ViralBrandElasticity = res.CommercialIntent
	}
	if ans, ok := resp.Answers["otc_whale_desirability"]; ok {
		res.OTCWhaleDesirability = ans.Noul
	} else {
		res.OTCWhaleDesirability = res.CommercialIntent
	}

	// 6. Trademark Risk
	if ans, ok := resp.Answers["trademark_risk"]; ok {
		switch ans.Choice {
		case "direct_infringement":
			res.TrademarkRiskLevel = "high"
			res.Tags = append(res.Tags, "trademark_alert")
		case "confusing_impersonation":
			res.TrademarkRiskLevel = "medium"
		default:
			res.TrademarkRiskLevel = "low"
		}
	} else {
		res.TrademarkRiskLevel = "low"
	}

	// 7. Seizure Risk
	if ans, ok := resp.Answers["seizure_risk"]; ok {
		res.SeizureRisk = ans.Noul
	}

	// 8. Liquidity & Sell Time
	if ans, ok := resp.Answers["liquidity_speed"]; ok {
		res.LiquiditySpeed = ans.Choice
		switch ans.Choice {
		case "instant_frenzy":
			res.LiquidityRating = "A+ (Ultra Liquid)"
			res.EstimatedSellTime = "< 3 Days"
		case "high_velocity":
			res.LiquidityRating = "A (High Liquidity)"
			res.EstimatedSellTime = "1 - 2 Weeks"
		case "moderate_liquidity":
			res.LiquidityRating = "B (Moderate Liquidity)"
			res.EstimatedSellTime = "1 - 3 Months"
		default:
			res.LiquidityRating = "C (Collector Hold)"
			res.EstimatedSellTime = "3 - 6+ Months"
		}
	} else {
		res.LiquidityRating = "B"
		res.EstimatedSellTime = "1 - 2 Weeks"
	}

	// 9. Buyer Archetype
	if ans, ok := resp.Answers["buyer_archetype"]; ok {
		res.BuyerArchetype = ans.Choice
		switch ans.Choice {
		case "ton_whale":
			res.TargetBuyerProfile = "Ecosystem Whale / Ultra High Net Worth Collector"
		case "project_founder":
			res.TargetBuyerProfile = "Web3 Project Founder or Brand Builder"
		case "channel_admin":
			res.TargetBuyerProfile = "Telegram Media Network or Broadcast Channel Operator"
		case "domain_speculator":
			res.TargetBuyerProfile = "Strategic Domain Trader / Reseller"
		default:
			res.TargetBuyerProfile = "Telegram Power User / Retail Enthusiast"
		}
	}

	// 10. Bidding War Potential
	if ans, ok := resp.Answers["bidding_war_potential"]; ok {
		res.BiddingWarPotential = ans.Noul
		if ans.Noul > 0.65 {
			res.AuctionTactics = "Aggressive Low-Reserve Entry: Start bidding at 10-20% below valuation to trigger high-velocity bidding war among competing buyers."
		} else {
			res.AuctionTactics = "Firm Reserve Pricing: Set conservative reserve at fair expected value and avoid hasty liquidation to maximize realized profit."
		}
	}

	// Calibrated System 1 TotalScore (0-100) integrating phonetics, ergonomics, commercial intent, and resonance
	phoneticPart := float64(res.PhoneticScore) * 2.8   // up to 28
	ergonomicPart := float64(res.ErgonomicScore) * 1.4 // up to 14
	commercialPart := res.CommercialIntent * 22.0      // up to 22
	whalePart := res.OTCWhaleDesirability * 10.0       // up to 10

	resBonus := 10.0
	switch res.CulturalResonance {
	case "web3_crypto", "luxury_status":
		resBonus = 22.0
	case "business_utility":
		resBonus = 18.0
	case "pop_culture_meme":
		resBonus = 15.0
	case "generic_english":
		resBonus = 13.0
	case "obscure_filler":
		resBonus = 0.0
	}

	lengthBonus := 0.0
	l := len(username)
	if l <= 4 {
		if isGib {
			lengthBonus = 2.0
		} else {
			lengthBonus = 14.0
		}
	} else if l == 5 {
		if !isGib {
			lengthBonus = 8.0
		}
	} else if l > 12 {
		lengthBonus = -10.0
	}

	total := phoneticPart + ergonomicPart + commercialPart + whalePart + resBonus + lengthBonus
	if isGib || (res.CulturalResonance == "obscure_filler" && !isDict && viterbiCov < 0.5) {
		total = math.Min(total, 22.0)
	}
	total = math.Max(10.0, math.Min(100.0, math.Round(total*100)/100))
	res.TotalScore = total

	// Compute continuous System 1 DecisionMultiplier in [0.65, 1.35]
	// Neutral is 55.0 -> 1.0x
	if isGib {
		res.DecisionMultiplier = 0.65
	} else if total >= 55.0 {
		res.DecisionMultiplier = math.Round((1.0+((total-55.0)/45.0)*0.30)*1000) / 1000
	} else {
		res.DecisionMultiplier = math.Round((0.75+((total-10.0)/45.0)*0.25)*1000) / 1000
	}

	res.SystemOneVerdict = fmt.Sprintf(
		"System 1 Classification: %s → %s | Phonetic %d/10, Ergonomic %d/10 | Commercial %.0f%%, Whale Fit %.0f%%",
		res.CulturalResonance, res.TargetEntityFit, res.PhoneticScore, res.ErgonomicScore,
		res.CommercialIntent*100, res.OTCWhaleDesirability*100,
	)
	res.Confidence = 0.96

	return res
}

func (e *LayaUsernameEvaluator) buildFallbackResult(username string, isDict, isGib bool, flowScore, fittsErgo float64) *LayaUsernameResult {
	l := len(username)
	score := 52.0
	if isGib {
		score = 16.0
	} else if isDict && l <= 4 {
		score = 88.0
	} else if isDict && l <= 6 {
		score = 76.0
	} else if l <= 4 {
		score = 64.0
	}

	phoneticInt := int(math.Max(1, math.Min(10, math.Round(1.0+flowScore*9.0))))
	ergoInt := int(math.Max(1, math.Min(10, math.Round(1.0+fittsErgo*9.0))))

	return &LayaUsernameResult{
		TotalScore:           score,
		PhoneticScore:        phoneticInt,
		ErgonomicScore:       ergoInt,
		CulturalResonance:    "generic_english",
		TargetEntityFit:      "personal_vip",
		CommercialIntent:     0.55,
		ViralBrandElasticity: 0.55,
		OTCWhaleDesirability: 0.50,
		DecisionMultiplier:   1.0,
		SystemOneVerdict:     "Quantitative System 1 Fallback Evaluation",
		TrademarkRiskLevel:   "low",
		SeizureRisk:          0.05,
		LiquiditySpeed:       "moderate_liquidity",
		BuyerArchetype:       "retail_user",
		LiquidityRating:      "B (Standard)",
		EstimatedSellTime:    "2 - 4 Weeks",
		TargetBuyerProfile:   "Retail Collector",
		AuctionTactics:       "Standard Fragment Listing with Fair Reserve",
		Confidence:           0.85,
	}
}
