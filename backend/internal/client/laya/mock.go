package laya

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// MockEvaluator produces 100% deterministic, calibrated System 1 quantitative decisions
// simulating Laya (ModernBERT-large / mmBERT-base multi-head classifier) with zero network latency.
type MockEvaluator struct{}

// NewMockEvaluator creates a new deterministic quantitative evaluator for Laya.
func NewMockEvaluator() *MockEvaluator {
	return &MockEvaluator{}
}

var (
	layaNonAlphaRe = regexp.MustCompile(`[^a-z]`)
	layaNonDigitRe = regexp.MustCompile(`\D`)

	layaBrands = map[string]bool{
		"telegram": true, "durov": true, "wallet": true, "fragment": true, "toncoin": true,
		"bitcoin": true, "ethereum": true, "binance": true, "coinbase": true, "apple": true,
		"google": true, "meta": true, "microsoft": true, "openai": true, "nvidia": true,
		"amazon": true, "tesla": true, "nike": true, "adidas": true, "rolex": true,
		"gucci": true, "ferrari": true, "porsche": true, "paypal": true, "stripe": true,
	}

	layaCryptoKeywords = []string{
		"crypto", "ton", "swap", "dex", "defi", "coin", "token", "nft", "web3",
		"whale", "hodl", "pepe", "btc", "eth", "sol", "usdt", "dao", "stake", "mint",
	}

	layaLuxuryKeywords = []string{
		"gold", "rare", "vip", "king", "royal", "elite", "luxury", "diamond",
		"prime", "apex", "alpha", "crown", "vault", "rich", "noble", "supreme", "god",
	}

	layaBusinessKeywords = []string{
		"pay", "bank", "cash", "fund", "trade", "market", "club", "news",
		"auto", "ai", "bot", "app", "cloud", "tech", "shop", "store", "money", "chat",
	}

	layaMemeKeywords = []string{
		"pepe", "doge", "shib", "chad", "wojak", "frog", "moon", "pump", "meme",
		"fomo", "yolo", "based", "degen", "rekt", "wagmi", "cats", "dogs", "notcoin", "hamster",
	}
)

type layaSignalVector struct {
	phonetic        float64
	ergonomic       float64
	viterbiCoverage float64
	keyword         float64
	isCrypto        float64
	isLuxury        float64
	isBiz           float64
	isMeme          float64
	isDict          bool
	isGibberish     bool
	trademark       float64
	numberScarcity  float64
	cn              float64
	ru              float64
	mena            float64
	giftSynergy     float64
	serial          float64
	composite       float64
	charLen         int
}

func isVowelByte(b byte) bool {
	return b == 'a' || b == 'e' || b == 'i' || b == 'o' || b == 'u' || b == 'y'
}

func computePhoneticQualityGo(handle string) float64 {
	clean := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(handle)), "@")
	if clean == "" {
		return 0.65
	}
	alpha := layaNonAlphaRe.ReplaceAllString(clean, "")
	if len(alpha) == 0 {
		return 0.45
	}

	hasVowel := false
	transitions := 0
	maxConsonantCluster := 0
	curConsonant := 0
	for i := 0; i < len(alpha); i++ {
		v := isVowelByte(alpha[i])
		if v {
			hasVowel = true
			curConsonant = 0
		} else {
			curConsonant++
			if curConsonant > maxConsonantCluster {
				maxConsonantCluster = curConsonant
			}
		}
		if i > 0 && isVowelByte(alpha[i]) != isVowelByte(alpha[i-1]) {
			transitions++
		}
	}

	if !hasVowel && len(alpha) >= 3 {
		return 0.12
	}

	denom := len(alpha) - 1
	if denom < 1 {
		denom = 1
	}
	cvRatio := float64(transitions) / float64(denom)

	// Penalize excessive identical character runs (e.g. fhhff, xxxxx)
	maxIdenticalRun := 1
	curRun := 1
	for i := 1; i < len(clean); i++ {
		if clean[i] == clean[i-1] {
			curRun++
			if curRun > maxIdenticalRun {
				maxIdenticalRun = curRun
			}
		} else {
			curRun = 1
		}
	}

	lengthBonus := 0.48
	switch {
	case len(clean) <= 4:
		lengthBonus = 1.0
	case len(clean) == 5:
		lengthBonus = 0.85
	case len(clean) <= 7:
		lengthBonus = 0.72
	}

	penalty := 0.0
	if strings.Contains(clean, "_") {
		penalty += 0.22
	}
	for i := 0; i < len(clean); i++ {
		if clean[i] >= '0' && clean[i] <= '9' {
			penalty += 0.18
			break
		}
	}
	if maxConsonantCluster >= 4 {
		penalty += 0.30
	} else if maxConsonantCluster == 3 {
		penalty += 0.12
	}
	if maxIdenticalRun >= 3 {
		penalty += 0.25
	}

	score := (0.55*cvRatio + 0.45*lengthBonus) - penalty
	return math.Max(0.10, math.Min(0.99, score))
}

func computeNumberSignalsGo(rawNumber string) (scarcity, cn, ru, mena float64) {
	digits := layaNonDigitRe.ReplaceAllString(rawNumber, "")
	suffix := digits
	if strings.HasPrefix(digits, "888") && len(digits) > 3 {
		suffix = digits[3:]
	}
	if suffix == "" {
		return 0.55, 0.60, 0.60, 0.60
	}

	n := len(suffix)
	isGenesis := n == 4
	distinctMap := make(map[byte]bool, n)
	isPal := 1.0
	for i := 0; i < n; i++ {
		distinctMap[suffix[i]] = true
		if suffix[i] != suffix[n-1-i] {
			isPal = 0.0
		}
	}
	// Also check full-dial E.164 palindrome ("888" + suffix)
	fullDial := "888" + suffix
	isFullPal := 1.0
	for i := 0; i < len(fullDial)/2; i++ {
		if fullDial[i] != fullDial[len(fullDial)-1-i] {
			isFullPal = 0.0
			break
		}
	}
	symSignal := math.Max(isPal, isFullPal*0.90)

	distinct := float64(len(distinctMap))

	maxRun := 1.0
	curRun := 1.0
	for i := 1; i < n; i++ {
		if suffix[i] == suffix[i-1] {
			curRun++
			if curRun > maxRun {
				maxRun = curRun
			}
		} else {
			curRun = 1.0
		}
	}

	// Prefix +888 continuation bridge
	leadingEights := 0.0
	for i := 0; i < n && suffix[i] == '8'; i++ {
		leadingEights++
	}
	effRun := maxRun
	if 3.0+leadingEights > effRun && leadingEights > 0 {
		effRun = 3.0 + leadingEights
	}

	eights := float64(strings.Count(suffix, "8"))
	sixes := float64(strings.Count(suffix, "6"))
	nines := float64(strings.Count(suffix, "9"))
	fours := float64(strings.Count(suffix, "4"))
	zeros := float64(strings.Count(suffix, "0"))
	sevens := float64(strings.Count(suffix, "7"))

	genesisBoost := 0.0
	if isGenesis {
		genesisBoost = 0.24
	}

	// East Asia / China Feng-Shui (8 = Wealth, 6 = Smooth, 9 = Longevity, 168/518 combos, 4 = Tetraphobia)
	comboCN := 0.0
	if strings.Contains(suffix, "168") || strings.Contains(suffix, "518") || strings.Contains(suffix, "888") {
		comboCN = 0.10
	}
	fourPenalty := fours * 0.10
	if distinct == 1 {
		fourPenalty = 0.02 // Monodigit 44444444 is still a 1-of-10 grail
	}
	cn = math.Max(0.15, math.Min(0.99, 0.52+genesisBoost*0.8+(eights*0.09)+(sixes*0.05)+(nines*0.04)+comboCN-fourPenalty+(maxRun-1.0)*0.05))

	// Russia / CIS VIP Car-Plate & Golden Number Prestige (777, 888, 999, 000, 001..009, AAAA)
	ruRunBonus := 0.0
	if maxRun >= 3 || effRun >= 5 {
		ruRunBonus = 0.22
	}
	if strings.Contains(suffix, "777") || strings.Contains(suffix, "888") || strings.Contains(suffix, "999") || strings.Contains(suffix, "007") || strings.HasSuffix(suffix, "001") {
		ruRunBonus += 0.10
	}
	ru = math.Max(0.18, math.Min(0.99, 0.48+genesisBoost+ruRunBonus+symSignal*0.18+math.Max(0, 6.0-distinct)*0.07))

	// MENA / Gulf Royal Plate & Persian "Rend" (Round zeros, 7s, symmetry, repeating blocks)
	menaZeroBonus := zeros * 0.055
	if strings.HasSuffix(suffix, "000") || strings.HasSuffix(suffix, "0000") {
		menaZeroBonus += 0.10
	}
	mena = math.Max(0.18, math.Min(0.99, 0.50+genesisBoost+(maxRun-1.0)*0.09+menaZeroBonus+sevens*0.045+symSignal*0.14))

	if isGenesis {
		scarcity = math.Max(0.86, math.Min(0.99, 0.84+(4.0-distinct)*0.05+(maxRun-1.0)*0.04+symSignal*0.06))
	} else {
		scarcity = math.Max(0.15, math.Min(0.99, (9.0-distinct)*0.10+(effRun-1.0)*0.07+symSignal*0.16))
	}
	return scarcity, cn, ru, mena
}

func extractStateMap(state any) map[string]any {
	if state == nil {
		return map[string]any{}
	}
	if m, ok := state.(map[string]any); ok {
		return m
	}
	raw, err := json.Marshal(state)
	if err != nil {
		return map[string]any{}
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return map[string]any{}
	}
	return out
}

func stateStrVal(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			s := strings.TrimSpace(fmt.Sprintf("%v", v))
			if s != "" && s != "<nil>" {
				return s
			}
		}
	}
	return ""
}

func stateFloatVal(m map[string]any, defaultVal float64, keys ...string) float64 {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			switch tv := v.(type) {
			case float64:
				return tv
			case float32:
				return float64(tv)
			case int:
				return float64(tv)
			case int64:
				return float64(tv)
			case int16:
				return float64(tv)
			case string:
				if f, err := strconv.ParseFloat(strings.TrimSpace(tv), 64); err == nil {
					return f
				}
			}
		}
	}
	return defaultVal
}

func stateBoolVal(m map[string]any, keys ...string) (bool, bool) {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			switch tv := v.(type) {
			case bool:
				return tv, true
			case string:
				if strings.EqualFold(tv, "true") {
					return true, true
				}
				if strings.EqualFold(tv, "false") {
					return false, true
				}
			}
		}
	}
	return false, false
}

func computeStateSignalVectorGo(stateMap map[string]any) layaSignalVector {
	username := strings.TrimPrefix(strings.ToLower(stateStrVal(stateMap, "username", "handle")), "@")
	rawNum := stateStrVal(stateMap, "digits", "number")
	backdrop := strings.ToLower(stateStrVal(stateMap, "backdrop"))
	modelName := strings.ToLower(stateStrVal(stateMap, "model", "model_name", "collection"))
	symbol := strings.ToLower(stateStrVal(stateMap, "symbol"))
	serial := stateFloatVal(stateMap, 500, "serial_number", "serial")

	phonetic := 0.68
	if username != "" {
		phonetic = computePhoneticQualityGo(username)
	}
	// Enrich with caller-supplied flow/euphony/fitts scores when present
	if flow := stateFloatVal(stateMap, -1, "flow_score"); flow >= 0 {
		phonetic = 0.60*phonetic + 0.40*math.Max(0.10, math.Min(0.99, flow))
	}

	ergonomic := stateFloatVal(stateMap, phonetic, "fitts_ergonomic_score", "ergonomic_score")
	viterbiCov := stateFloatVal(stateMap, -1, "viterbi_coverage")

	isDict, hasDict := stateBoolVal(stateMap, "is_dictionary")
	isGib, hasGib := stateBoolVal(stateMap, "is_gibberish")
	freqRank := stateFloatVal(stateMap, 0, "word_freq_rank", "frequency_rank")

	var isCrypto, isLuxury, isBiz, isMeme float64
	if username != "" {
		for _, k := range layaCryptoKeywords {
			if username == k || (len(k) >= 3 && strings.Contains(username, k)) {
				isCrypto = 1.0
				break
			}
		}
		for _, k := range layaLuxuryKeywords {
			if username == k || (len(k) >= 4 && strings.Contains(username, k)) {
				isLuxury = 1.0
				break
			}
		}
		for _, k := range layaBusinessKeywords {
			if username == k || (len(k) >= 3 && strings.Contains(username, k)) {
				isBiz = 1.0
				break
			}
		}
		for _, k := range layaMemeKeywords {
			if username == k || (len(k) >= 4 && strings.Contains(username, k)) {
				isMeme = 1.0
				break
			}
		}
	}

	isKw := math.Max(math.Max(isCrypto, isLuxury), math.Max(isBiz, isMeme))
	if !hasDict {
		isDict = isKw > 0 || freqRank > 0
	}
	if viterbiCov < 0 {
		if isDict {
			viterbiCov = 1.0
		} else {
			viterbiCov = phonetic * 0.75
		}
	}
	if !hasGib && username != "" {
		isGib = !isDict && phonetic < 0.35 && viterbiCov < 0.50
	}
	if isGib {
		phonetic = math.Min(phonetic, 0.22)
		ergonomic = math.Min(ergonomic, 0.30)
		isKw = 0.0
	}

	var isTm float64
	if tmSev := stateStrVal(stateMap, "trademark_severity"); tmSev != "" {
		switch strings.ToLower(tmSev) {
		case "exact_match", "high", "direct_infringement":
			isTm = 0.95
		case "confusing_similarity", "medium", "substring":
			isTm = 0.65
		}
	}
	if isTm == 0 && username != "" {
		for b := range layaBrands {
			if username == b {
				isTm = 0.92
				break
			} else if len(b) >= 5 && strings.Contains(username, b) {
				isTm = 0.65
			}
		}
	}

	numScarcity, cn, ru, mena := computeNumberSignalsGo(rawNum)

	giftSynergy := 0.62
	if backdrop != "" || modelName != "" {
		hasSpecial, hasSpecialFlag := stateBoolVal(stateMap, "has_special_feature")
		isColorMatch, _ := stateBoolVal(stateMap, "is_color_matched")
		deltaE2000 := stateFloatVal(stateMap, -1.0, "delta_e_2000")
		modelRarityPct := stateFloatVal(stateMap, 2.0, "model_rarity_pct")
		backdropPermille := stateFloatVal(stateMap, 20.0, "backdrop_permille")

		if hasSpecialFlag && !hasSpecial {
			// Strictly floor-locked gift without secondary collector features
			giftSynergy = 0.56
			for _, c := range []string{"black", "obsidian", "gold", "emerald", "cyber", "neon", "celestial", "matrix"} {
				if strings.Contains(backdrop, c) {
					giftSynergy = 0.64
					break
				}
			}
			if modelRarityPct <= 1.2 {
				giftSynergy = math.Max(giftSynergy, 0.64)
			}
		} else {
			for _, c := range []string{"black", "obsidian", "gold", "emerald", "cyber", "neon", "celestial", "matrix"} {
				if strings.Contains(backdrop, c) {
					giftSynergy += 0.20
					break
				}
			}
			for _, s := range []string{"crown", "diamond", "star", "fire", "ton", "pepe"} {
				if strings.Contains(symbol, s) || strings.Contains(modelName, s) {
					giftSynergy += 0.10
					break
				}
			}
			if isColorMatch || (deltaE2000 >= 0 && deltaE2000 <= 18.0) {
				giftSynergy += 0.14
			}
			if modelRarityPct > 0 && modelRarityPct <= 1.0 {
				giftSynergy += 0.08
			}
			if backdropPermille > 0 && backdropPermille <= 12.0 {
				giftSynergy += 0.06
			}
			if serial <= 10 {
				giftSynergy += 0.12
			} else if serial <= 100 {
				giftSynergy += 0.06
			}
		}
		giftSynergy = math.Max(0.20, math.Min(0.98, giftSynergy))
	}

	var composite float64
	if username != "" && rawNum == "" && backdrop == "" {
		// Pure username composite signal
		dictBoost := 0.0
		if isDict {
			dictBoost = 0.22
			if freqRank > 0 && freqRank <= 1500 {
				dictBoost = 0.30
			}
		}
		lenBoost := 0.0
		if len(username) <= 4 {
			lenBoost = 0.16
		} else if len(username) == 5 {
			lenBoost = 0.08
		}
		composite = 0.32*phonetic + 0.18*ergonomic + 0.22*math.Max(isKw, viterbiCov*0.8) + dictBoost + lenBoost
		if isGib {
			composite = math.Min(0.18, composite*0.35)
		}
		if strings.Contains(username, "_") {
			composite *= 0.68
		}
	} else {
		composite = 0.40*phonetic + 0.20*isKw + 0.20*numScarcity + 0.20*giftSynergy
	}
	composite = math.Max(0.10, math.Min(0.98, composite))

	return layaSignalVector{
		phonetic:        phonetic,
		ergonomic:       ergonomic,
		viterbiCoverage: viterbiCov,
		keyword:         isKw,
		isCrypto:        isCrypto,
		isLuxury:        isLuxury,
		isBiz:           isBiz,
		isMeme:          isMeme,
		isDict:          isDict,
		isGibberish:     isGib,
		trademark:       isTm,
		numberScarcity:  numScarcity,
		cn:              cn,
		ru:              ru,
		mena:            mena,
		giftSynergy:     giftSynergy,
		serial:          serial,
		composite:       composite,
		charLen:         len(username),
	}
}

func selectSemanticChoiceGo(qKey string, criteria map[string]string, vec layaSignalVector, stateMap map[string]any) Answer {
	keys := make([]string, 0, len(criteria))
	for k := range criteria {
		keys = append(keys, k)
	}
	sort.Strings(keys) // Deterministic ordering
	if len(keys) == 0 {
		keys = []string{"standard"}
	}

	ql := strings.ToLower(qKey)
	username := strings.TrimPrefix(strings.ToLower(stateStrVal(stateMap, "username", "handle")), "@")
	chosen := keys[0]

	hasKey := func(k string) bool {
		_, ok := criteria[k]
		return ok
	}

	switch {
	case strings.Contains(ql, "trademark"):
		if vec.trademark >= 0.85 && hasKey("direct_infringement") {
			chosen = "direct_infringement"
		} else if vec.trademark >= 0.50 && hasKey("confusing_impersonation") {
			chosen = "confusing_impersonation"
		} else if vec.keyword >= 0.50 && hasKey("descriptive_fair_use") {
			chosen = "descriptive_fair_use"
		} else if hasKey("safe") {
			chosen = "safe"
		}

	case strings.Contains(ql, "cultural_resonance"):
		if vec.isGibberish && hasKey("obscure_filler") {
			chosen = "obscure_filler"
		} else if vec.isCrypto >= 0.5 && hasKey("web3_crypto") {
			chosen = "web3_crypto"
		} else if vec.isLuxury >= 0.5 && hasKey("luxury_status") {
			chosen = "luxury_status"
		} else if vec.isMeme >= 0.5 && hasKey("pop_culture_meme") {
			chosen = "pop_culture_meme"
		} else if vec.isBiz >= 0.5 && hasKey("business_utility") {
			chosen = "business_utility"
		} else if (vec.isDict || vec.phonetic >= 0.62) && hasKey("generic_english") {
			chosen = "generic_english"
		} else if hasKey("obscure_filler") {
			chosen = "obscure_filler"
		}

	case strings.Contains(ql, "target_entity_fit"):
		if vec.isGibberish && hasKey("placeholder") {
			chosen = "placeholder"
		} else if strings.HasSuffix(username, "bot") && hasKey("automated_bot") {
			chosen = "automated_bot"
		} else if vec.isCrypto >= 0.5 && hasKey("web3_project") {
			chosen = "web3_project"
		} else if (vec.isLuxury >= 0.5 || (vec.charLen > 0 && vec.charLen <= 4 && vec.isDict)) && hasKey("personal_vip") {
			chosen = "personal_vip"
		} else if vec.isBiz >= 0.5 && hasKey("web2_enterprise") {
			chosen = "web2_enterprise"
		} else if vec.isDict && hasKey("official_channel") {
			chosen = "official_channel"
		} else if hasKey("personal_vip") && !vec.isGibberish {
			chosen = "personal_vip"
		} else if hasKey("placeholder") {
			chosen = "placeholder"
		}

	case strings.Contains(ql, "liquidity"):
		sig := vec.composite
		if username == "" {
			sig = math.Max(vec.composite, math.Max(vec.numberScarcity, vec.giftSynergy))
		}
		var prefs []string
		if sig >= 0.80 {
			prefs = []string{"instant_frenzy", "instant_liquid", "ultra_liquid"}
		} else if sig >= 0.58 {
			prefs = []string{"high_velocity", "active_trade", "high_turnover"}
		} else if sig >= 0.35 {
			prefs = []string{"moderate_liquidity", "medium_hold", "slow_liquid"}
		} else {
			prefs = []string{"illiquid_collector", "slow_liquid", "moderate_liquidity"}
		}
		for _, pref := range prefs {
			if hasKey(pref) {
				chosen = pref
				break
			}
		}

	case strings.Contains(ql, "collector_prestige"):
		if vec.numberScarcity >= 0.85 && hasKey("grail_monodigit") {
			chosen = "grail_monodigit"
		} else if vec.numberScarcity >= 0.68 && hasKey("high_status") {
			chosen = "high_status"
		} else if vec.numberScarcity >= 0.45 && hasKey("vanity_lifestyle") {
			chosen = "vanity_lifestyle"
		} else if hasKey("standard") {
			chosen = "standard"
		}

	case strings.Contains(ql, "collector_appeal"):
		if (vec.giftSynergy >= 0.85 || vec.serial <= 25) && hasKey("museum_grail") {
			chosen = "museum_grail"
		} else if vec.giftSynergy >= 0.65 && hasKey("aesthetic_elite") {
			chosen = "aesthetic_elite"
		} else if hasKey("floor_sweeper") {
			chosen = "floor_sweeper"
		}

	case strings.Contains(ql, "action_recommendation"):
		if vec.giftSynergy >= 0.72 && hasKey("HOLD") {
			chosen = "HOLD"
		} else if vec.giftSynergy < 0.45 && hasKey("CRAFT_FORGE") {
			chosen = "CRAFT_FORGE"
		} else if hasKey("HOLD") {
			chosen = "HOLD"
		}

	case strings.Contains(ql, "buyer_archetype"):
		if vec.isGibberish && hasKey("retail_user") {
			chosen = "retail_user"
		} else if (vec.isLuxury >= 0.5 || (vec.charLen > 0 && vec.charLen <= 4 && vec.composite >= 0.78)) && hasKey("ton_whale") {
			chosen = "ton_whale"
		} else if (vec.isCrypto >= 0.5 || vec.isBiz >= 0.5) && hasKey("project_founder") {
			chosen = "project_founder"
		} else if vec.isDict && hasKey("channel_admin") {
			chosen = "channel_admin"
		} else {
			for _, cand := range []string{"ton_whale", "crypto_whale", "project_founder", "prestige_businessman", "collector_investor", "domain_speculator", "retail_user"} {
				if hasKey(cand) {
					chosen = cand
					break
				}
			}
		}
	}

	probs := make(map[string]float64, len(keys))
	rem := 0.24
	otherCnt := math.Max(1.0, float64(len(keys)-1))
	for _, k := range keys {
		if k == chosen {
			probs[k] = 0.76
		} else {
			probs[k] = math.Round((rem/otherCnt)*10000) / 10000
		}
	}

	return Answer{
		Type:          TypeChoice,
		Choice:        chosen,
		Confidence:    0.92,
		Probabilities: probs,
	}
}

// Evaluate provides a deterministic, quantitative Laya System 1 response for every question.
func (m *MockEvaluator) Evaluate(_ context.Context, state any, questions map[string]Question) (*Response, error) {
	stateMap := extractStateMap(state)
	vec := computeStateSignalVectorGo(stateMap)
	answers := make(map[string]Answer, len(questions))

	// Canonical state fingerprint (excluding volatile timestamps)
	canonicalParts := make([]string, 0, len(stateMap))
	for k, v := range stateMap {
		if k == "timestamp" {
			continue
		}
		canonicalParts = append(canonicalParts, fmt.Sprintf("%s=%v", k, v))
	}
	sort.Strings(canonicalParts)
	canonicalState := strings.Join(canonicalParts, "|")

	for qKey, q := range questions {
		ql := strings.ToLower(qKey)
		inst := strings.ToLower(q.Instructions)

		var sig float64
		switch {
		case strings.Contains(ql, "cn") || strings.Contains(inst, "chinese"):
			sig = vec.cn
		case strings.Contains(ql, "ru") || strings.Contains(inst, "russian"):
			sig = vec.ru
		case strings.Contains(ql, "mena") || strings.Contains(inst, "persian") || strings.Contains(inst, "arab"):
			sig = vec.mena
		case strings.Contains(ql, "ergonomic") || strings.Contains(ql, "fitts") || strings.Contains(ql, "typing") || strings.Contains(ql, "keypad") || strings.Contains(ql, "dtmf"):
			if vec.charLen == 0 {
				dpErgo := stateFloatVal(stateMap, -1, "fitts_ergonomic_score", "dialpad_elegance")
				dtmf := stateFloatVal(stateMap, -1, "dtmf_consonance")
				if dpErgo >= 0 && dtmf >= 0 {
					sig = math.Max(0.12, math.Min(0.99, (0.55*dpErgo+0.45*dtmf)/100.0))
				} else {
					sig = math.Max(vec.ergonomic, vec.numberScarcity)
				}
			} else {
				sig = vec.ergonomic
			}
		case strings.Contains(ql, "phonetic") || strings.Contains(ql, "flow"):
			sig = vec.phonetic
		case strings.Contains(ql, "trademark") || strings.Contains(ql, "seizure") || strings.Contains(ql, "wash_trade") || strings.Contains(ql, "anomaly"):
			if strings.Contains(ql, "trademark") || strings.Contains(ql, "seizure") {
				sig = math.Max(0.03, vec.trademark)
			} else {
				sig = 0.05
			}
		case strings.Contains(ql, "synergy") || strings.Contains(ql, "harmony"):
			sig = vec.giftSynergy
		case strings.Contains(ql, "number") || strings.Contains(ql, "pattern") || strings.Contains(ql, "aesthetics"):
			sig = vec.numberScarcity
		case strings.Contains(ql, "viral") || strings.Contains(ql, "elasticity") || strings.Contains(ql, "otc_whale"):
			if vec.charLen == 0 {
				regionalMax := math.Max(vec.cn, math.Max(vec.ru, vec.mena))
				sig = math.Max(0.15, math.Min(0.99, 0.55*vec.numberScarcity+0.45*regionalMax))
			} else {
				sig = math.Max(vec.composite, 0.50*vec.phonetic+0.30*vec.ergonomic+0.20*vec.keyword)
			}
		case strings.Contains(ql, "commercial") || strings.Contains(ql, "bidding_war"):
			if vec.isGibberish {
				sig = 0.06
			} else {
				sig = math.Max(vec.composite, 0.55*vec.phonetic+0.45*math.Max(vec.keyword, vec.viterbiCoverage*0.85))
			}
		default:
			h := sha256.Sum256([]byte(qKey + ":" + canonicalState))
			seedByte := float64(binary.BigEndian.Uint16(h[:2])) / 65535.0
			jitter := (seedByte - 0.5) * 0.08
			sig = math.Max(0.08, math.Min(0.98, vec.composite+jitter))
		}

		conf := math.Round(math.Max(0.78, math.Min(0.98, 0.84+0.14*math.Abs(sig-0.5)))*100) / 100

		switch q.Type {
		case TypeScore:
			is100Scale := strings.Contains(inst, "1-100") || strings.Contains(inst, "0-100") ||
				strings.Contains(inst, "1 to 100") || strings.Contains(inst, "0 to 100") || strings.Contains(inst, "100")
			var scoreVal int
			if is100Scale {
				scoreVal = int(math.Round(1.0 + sig*99.0))
				if scoreVal < 1 {
					scoreVal = 1
				} else if scoreVal > 100 {
					scoreVal = 100
				}
			} else {
				scoreVal = int(math.Round(1.0 + sig*9.0))
				if scoreVal < 1 {
					scoreVal = 1
				} else if scoreVal > 10 {
					scoreVal = 10
				}
			}
			answers[qKey] = Answer{
				Type:       TypeScore,
				Score:      scoreVal,
				Confidence: conf,
			}

		case TypeNoul:
			answers[qKey] = Answer{
				Type:       TypeNoul,
				Noul:       math.Round(sig*10000) / 10000,
				Confidence: conf,
			}

		case TypeChoice:
			answers[qKey] = selectSemanticChoiceGo(qKey, q.Criteria, vec, stateMap)
		}
	}

	return &Response{
		Model:   "convai/laya-multilingual-v2-quant",
		Answers: answers,
		Usage: Usage{
			InputTokens:  maxInt(1, len(canonicalState)/4),
			OutputTokens: len(questions) * 6,
		},
	}, nil
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
