package avm

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/tonapi"
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
	db             *repository.Database
	cache          *repository.Cache
	tonClient      *tonapi.Client
	cfg            EngineConfig
	semanticEngine *SemanticEngine
}

// NewValuationService creates a new AVM service with default config.
func NewValuationService(db *repository.Database, cache *repository.Cache, tonClient *tonapi.Client) *ValuationService {
	return &ValuationService{
		db:             db,
		cache:          cache,
		tonClient:      tonClient,
		cfg:            DefaultEngineConfig(),
		semanticEngine: NewSemanticEngine(db),
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
	Tags            []string        `json:"tags"`
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

	cheapSuffixes := []string{"_official", "_real", "_bot", "_news", "_ir", "_support", "_admin"}
	hasCheapSuffix := false
	for _, suf := range cheapSuffixes {
		if strings.HasSuffix(lower, suf) && len(lower) > len(suf) {
			hasCheapSuffix = true
			break
		}
	}
	if !hasCheapSuffix {
		nonUnderscoreSuffixes := []string{"official", "real", "support", "admin"}
		for _, suf := range nonUnderscoreSuffixes {
			if strings.HasSuffix(lower, suf) && len(lower) >= len(suf)+3 {
				hasCheapSuffix = true
				break
			}
		}
	}

	cheapPrefixes := []string{"the_", "real_", "official_", "mr_", "my_", "iam_"}
	hasCheapPrefix := false
	for _, pref := range cheapPrefixes {
		if strings.HasPrefix(lower, pref) && len(lower) > len(pref) {
			hasCheapPrefix = true
			break
		}
	}
	if !hasCheapPrefix {
		nonUnderscorePrefixes := []string{"official", "real"}
		for _, pref := range nonUnderscorePrefixes {
			if strings.HasPrefix(lower, pref) && len(lower) >= len(pref)+4 {
				hasCheapPrefix = true
				break
			}
		}
	}

	hasRepetition := false
	if len(lower) >= 3 {
		for i := 0; i < len(lower)-2; i++ {
			if lower[i] == lower[i+1] && lower[i] == lower[i+2] {
				hasRepetition = true
				break
			}
		}
	}
	
	// Phase 4 Linguistics & Aesthetics
	isUnderscoreCompound := false
	if hasUnderscore {
		parts := strings.Split(lower, "_")
		if len(parts) == 2 {
			if (isDictionaryWord(parts[0]) || RankWord(parts[0]) > 0) && (isDictionaryWord(parts[1]) || RankWord(parts[1]) > 0) {
				isUnderscoreCompound = true
			}
		}
	}
	
	isAcronym := false
	acronyms := []string{"fifa", "nato", "nasa", "opec", "asap", "vpn", "ceo", "cto", "nft", "defi", "dao", "vip"}
	for _, a := range acronyms {
		if lower == a {
			isAcronym = true
			break
		}
	}
	
	isABAB := false
	isAABB := false
	if len(lower) == 4 {
		if lower[0] == lower[2] && lower[1] == lower[3] && lower[0] != lower[1] {
			isABAB = true
		}
		if lower[0] == lower[1] && lower[2] == lower[3] && lower[0] != lower[2] {
			isAABB = true
		}
	}
	
	symCount := 0
	for _, r := range strings.ToUpper(lower) {
		switch r {
		case 'A', 'H', 'I', 'M', 'O', 'T', 'U', 'V', 'W', 'X', 'Y':
			symCount++
		}
	}
	var visualSymmetry float64
	if charLen > 0 {
		visualSymmetry = float64(symCount) / float64(charLen)
	}
	
	hasBrandableSuffix := false
	brandableSuffixes := []string{"ly", "ify", "io", "er", "ex", "ix", "ax", "oo", "hq", "app"}
	for _, s := range brandableSuffixes {
		if strings.HasSuffix(lower, s) && len(lower) > len(s) + 2 && !hasUnderscore {
			hasBrandableSuffix = true
			break
		}
	}

	features = MorphFeatures{
		HasNumbers:        hasNumbers,
		HasAlpha:          hasAlpha,
		HasUnderscore:     hasUnderscore,
		HasCheapSuffix:    hasCheapSuffix,
		HasCheapPrefix:    hasCheapPrefix,
		HasRepetition:     hasRepetition,
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
		HasBrandableSuffix: hasBrandableSuffix,
		IsAcronym:         isAcronym,
		IsUnderscoreCompound: isUnderscoreCompound,
		VisualSymmetry:    visualSymmetry,
		IsABAB:            isABAB,
		IsAABB:            isAABB,
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
		"cars": true, "casino": true, "crypto": true,
		"game": true, "gold": true, "money": true, "news": true,
		"shop": true, "sport": true, "tesla": true, "trade": true,
		"wallet": true, "apple": true, "google": true, "meta": true,
		"coin": true, "tech": true, "chat": true, "love": true,
		"king": true, "club": true, "play": true, "star": true,
		"cool": true, "best": true, "whale": true, "rare": true,
		"bull": true, "bear": true, "rich": true, "moon": true,
		"pump": true, "queen": true, "root": true, "admin": true,
		"alpha": true, "epic": true, "dark": true, "light": true,
		"fire": true, "good": true, "fast": true, "lord": true,
		"hero": true, "house": true, "home": true, "music": true,
		"girl": true, "life": true, "soul": true, "mind": true,
		"code": true, "token": true, "doge": true, "meme": true,
		"chain": true, "block": true, "defi": true, "swap": true,
		"earn": true, "farm": true, "yield": true, "cash": true,
		"fund": true, "invest": true, "stock": true, "bond": true,
		"doctor": true, "nurse": true, "health": true,
		"food": true, "drink": true, "water": true, "coffee": true,
		"beer": true, "wine": true, "hotel": true, "travel": true,
		"trip": true, "boat": true, "ship": true, "moonlight": true,
		"starry": true, "space": true, "earth": true, "world": true,
		"planet": true, "gods": true, "devil": true, "angel": true,
		"demon": true, "magic": true, "spell": true, "wizard": true,
		"witch": true, "sword": true, "shield": true, "peace": true,
		"hate": true, "smile": true, "laugh": true, "happy": true,
		"angry": true, "calm": true, "smart": true, "dumb": true,
		"genius": true, "idiot": true, "crazy": true, "wild": true,
		"free": true, "slave": true, "master": true, "prince": true,
		"princess": true, "lady": true, "madam": true, "bird": true,
		"fish": true, "horse": true, "sheep": true, "lion": true,
		"tiger": true, "wolf": true, "deer": true, "monkey": true,
		"snake": true, "spider": true, "tree": true, "leaf": true,
		"flower": true, "rose": true, "lily": true, "grass": true,
		"wood": true, "stone": true, "rock": true, "metal": true,
		"silver": true, "copper": true, "iron": true, "steel": true,
		"glass": true, "plastic": true, "paper": true, "book": true,
		"desk": true, "chair": true, "table": true, "room": true,
		"door": true, "window": true, "wall": true, "roof": true,
		"city": true, "town": true, "village": true, "street": true,
		"road": true, "path": true, "bridge": true, "river": true,
		"lake": true, "ocean": true, "mountain": true, "hill": true,
		"valley": true, "forest": true, "desert": true, "island": true,
		"beach": true, "sand": true, "snow": true, "rain": true,
		"storm": true, "wind": true, "cloud": true, "weather": true,
		"climate": true, "time": true, "night": true, "week": true,
		"month": true, "year": true, "hour": true, "minute": true,
		"second": true, "past": true, "present": true, "future": true,
		"then": true, "always": true, "never": true, "soon": true,
		"late": true, "early": true, "slow": true, "quick": true,
		"rapid": true, "swift": true, "small": true, "tall": true,
		"short": true, "long": true, "wide": true, "narrow": true,
		"thick": true, "thin": true, "heavy": true, "bright": true,
		"clear": true, "blur": true, "sharp": true, "dull": true,
		"soft": true, "hard": true, "rough": true, "smooth": true,
		"cold": true, "warm": true, "sweet": true, "sour": true,
		"bitter": true, "salty": true, "spicy": true, "tasty": true,
		"great": true, "awful": true, "nice": true, "mean": true,
		"kind": true, "cruel": true, "fair": true, "foul": true,
		"right": true, "wrong": true, "true": true, "false": true,
		"real": true, "fake": true, "pure": true, "dirty": true,
		"clean": true, "messy": true, "poor": true, "wealth": true,
		"poverty": true, "safe": true, "danger": true, "secure": true,
		"risk": true, "luck": true, "fate": true, "destiny": true,
		"doom": true, "death": true, "birth": true, "kill": true,
		"save": true, "help": true, "hurt": true, "heal": true,
		"sell": true, "deal": true, "cost": true, "price": true,
		"value": true, "worth": true, "store": true, "market": true,
		"super": true, "mega": true, "ultra": true, "hyper": true,
		"elite": true, "prime": true, "grand": true,
		"cyber": true, "ninja": true, "hacker": true, "maker": true,
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
	targetComps := SalesToComparables(targetSales, s.cfg)
	exactComps := SalesToComparables(exactSales, s.cfg)
	broadComps := SalesToComparables(broadSales, s.cfg)

	// Apply 40% annual market appreciation to historical sales
	ApplyMarketAppreciation(targetComps, 0.40, now)
	ApplyMarketAppreciation(exactComps, 0.40, now)
	ApplyMarketAppreciation(broadComps, 0.40, now)

	// --- ANCHOR OVERRIDE (Redesign) ---
	// Inject the exact historical username sale as a highly weighted target comparable
	lowerUsername := strings.ToLower(username)
	var anchorInjected bool

	if hardcodedPrice, ok := HistoricalSales[lowerUsername]; ok && hardcodedPrice > 0 {
		// 1. In-Memory Hardcoded Historical Dataset
		targetComps = append(targetComps, ComparableSale{
			PriceTON: hardcodedPrice,
			SaleDate: now, // Extremely recent for max weight
			ID:       0,   // Sentinel ID
		})
		anchorInjected = true
		reasoning["anchor_source"] = "memory_hardcoded"
		reasoning["anchor_price"] = hardcodedPrice
	} else if len(targetComps) > 0 {
		// 2. Postgres Database Target Sales
		anchorInjected = true
		reasoning["anchor_source"] = "postgres_db"
		reasoning["anchor_price"] = targetComps[0].PriceTON
	}
	
	reasoning["anchor_injected"] = anchorInjected

	// 3a. Base Price (Bayesian)
	baseLog, nEff, mad, saleIDs := CalcBaseLog(targetComps, exactComps, broadComps, s.cfg, features, now)

	// Fetch semantic engine result early so we can use it for base price boosting
	semResult := s.semanticEngine.Score(ctx, username)

	// 3a-1. Semantic-Aware Base Price Boost
	// If no anchor/target sales exist and the semantic engine thinks this is premium,
	// boost the fallback base price dramatically. Without this, "bitcoin" starts at 5 TON.
	if !anchorInjected && semResult != nil && semResult.TotalScore > 0 {
		if semResult.TotalScore >= 70 {
			// Legendary: base at least 250 TON (will be multiplied by ~400x combined max = ~100k TON)
			minBase := math.Log(250)
			if baseLog < minBase {
				baseLog = minBase
				reasoning["semantic_base_boost"] = "legendary_250"
			}
		} else if semResult.TotalScore >= 60 {
			// Premium: base at least 50 TON (will be multiplied by ~120x combined max = ~6k TON)
			minBase := math.Log(50)
			if baseLog < minBase {
				baseLog = minBase
				reasoning["semantic_base_boost"] = "premium_50"
			}
		} else if semResult.TotalScore >= 40 {
			// Moderate: base at least 10 TON (will be multiplied by ~20x combined max = ~200 TON)
			minBase := math.Log(10)
			if baseLog < minBase {
				baseLog = minBase
				reasoning["semantic_base_boost"] = "moderate_10"
			}
		}
	}

	// 3b. Morphology
	morphLog := CalcMorphologyLog(features, s.cfg.MorphMultipliers, s.cfg)
	if anchorInjected {
		// Heavily dampen MorphLog because premium is already priced into the anchor
		morphLog = morphLog * s.cfg.MorphDamping
	}

	reasoning["base_log"] = baseLog
	reasoning["n_eff"] = nEff
	reasoning["mad"] = mad
	reasoning["morph_log"] = morphLog

	// 3b-1. Semantic Intelligence Engine (4-signal: Datamuse + Wikipedia + Gemini AI + Clearbit)
	semanticLog := 0.0
	if semResult != nil && semResult.Multiplier > 0 {
		semanticLog = math.Log(semResult.Multiplier)
		reasoning["semantic_source"] = "semantic_intelligence_engine"
		reasoning["semantic_total_score"] = semResult.TotalScore
		reasoning["semantic_multiplier"] = semResult.Multiplier
		reasoning["semantic_word_freq"] = semResult.WordFreqScore
		reasoning["semantic_wiki"] = semResult.WikiScore
		reasoning["semantic_ai_score"] = semResult.AIScore
		reasoning["semantic_brand"] = semResult.BrandScore
		reasoning["semantic_ai_reason"] = semResult.AIReason
		if semResult.WikiDescription != "" {
			reasoning["semantic_wiki_desc"] = semResult.WikiDescription
		}
	} else if segment == "alphabetic" {
		// Fallback: Not scored by engine, check flow/euphony
		flowScore := AnalyzeFlow(username)
		if flowScore >= 0.55 {
			flowMult := 1.0 + ((flowScore - 0.55) * 1.5)
			semanticLog = math.Log(flowMult)
			reasoning["semantic_source"] = "pronounceability_flow"
			reasoning["semantic_multiplier"] = flowMult
			reasoning["flow_score"] = flowScore
		}
	}

	if anchorInjected && semanticLog > 0 {
		// Premium is largely priced into the anchor sale itself.
		// Dampen so we don't double-count, but less aggressively for high AI scores.
		dampFactor := 0.4 // Allow 40% of semantic premium on top of anchor
		if semResult != nil && semResult.AIScore >= 80 {
			dampFactor = 0.6 // High AI confidence = even less damping
		}
		semanticLog = semanticLog * dampFactor
	}
	reasoning["semantic_log"] = semanticLog

	// 3c. Momentum
	var sumRecent, sumOlder float64
	var numRecent, numOlder int
	thirtyDaysAgo := now.AddDate(0, 0, -30)
	
	for _, comp := range exactComps {
		// Skip injected anchor (either sentinel 0 or the db anchor) so we don't skew momentum
		if anchorInjected && (comp.ID == 0 || (len(targetSales) > 0 && comp.ID == targetSales[0].ID)) {
			continue
		}
		if comp.SaleDate.After(thirtyDaysAgo) {
			sumRecent += comp.PriceTON
			numRecent++
		} else {
			sumOlder += comp.PriceTON
			numOlder++
		}
	}
	
	priceTrend := 1.0 
	if numRecent > 0 && numOlder > 0 {
		avgRecent := sumRecent / float64(numRecent)
		avgOlder := sumOlder / float64(numOlder)
		priceTrend = avgRecent / avgOlder
	}
	momentumLog := CalcSmoothedMomentum(count30, count31_90, priceTrend, s.cfg)
	reasoning["momentum_log"] = momentumLog

	// 3d. Range
	expectedTONRaw, lowTONRaw, highTONRaw := CalcRangeLog(baseLog, morphLog, momentumLog, semanticLog, mad, features.CharLength, s.cfg)
	basePriceTON := math.Exp(baseLog) // base before morph/momentum/semantic is exp(baseLog)

	// 3e. External Market Multipliers (Wallet Wealth, FnG)
	// NOTE: Brand check is now handled by SemanticEngine (signal #4), no double-counting.
	fngMult, fngClass := GetFearAndGreedMultiplier()
	reasoning["fng_multiplier"] = fngMult
	reasoning["fng_classification"] = fngClass

	if s.tonClient != nil {
		nft, err := s.tonClient.GetNFTByDNS(ctx, username)
		if err == nil && nft != nil && nft.Owner.Address != "" {
			wallet, err := s.tonClient.GetWalletInfo(ctx, nft.Owner.Address)
			if err == nil && wallet != nil {
				tonBalance := float64(wallet.Balance) / 1e9
				if tonBalance > 10000 {
					whaleMult := 1.20
					if tonBalance > 100000 {
						whaleMult = 1.30
					}
					expectedTONRaw *= whaleMult
					lowTONRaw *= whaleMult
					highTONRaw *= whaleMult
					reasoning["whale_wallet_multiplier"] = whaleMult
					reasoning["wallet_balance_ton"] = tonBalance
				}
			}
		}
	}

	expectedTONRaw *= fngMult
	lowTONRaw *= fngMult
	highTONRaw *= fngMult

	// 3f. Live Bid Floor
	activeBid, err := s.db.GetActiveBid(ctx, username)
	if err == nil && activeBid != nil {
		maxBidFloat := ToFloat64(activeBid.HighestBidTON)
		if expectedTONRaw < maxBidFloat {
			expectedTONRaw = maxBidFloat
			lowTONRaw = maxBidFloat // The floor is literally the active bid!
			if highTONRaw < maxBidFloat {
				highTONRaw = maxBidFloat * 1.5 // Leave some room for a higher closing bid
			}
			reasoning["live_bid_floor_applied"] = true
			reasoning["live_bid_ton"] = maxBidFloat
		}
	}

	// 3g. Historical Sale Floor (For Dictionary / Meaningful Usernames)
	if features.IsDictionary && len(targetSales) > 0 {
		highestPastSale := 0.0
		for _, sale := range targetSales {
			price := ToFloat64(sale.SalePriceTON)
			if price > highestPastSale {
				highestPastSale = price
			}
		}

		// Ensure strictly higher (e.g., +5% minimum) than the highest past sale
		strictFloor := highestPastSale * 1.05
		if highestPastSale > 0 && expectedTONRaw < strictFloor {
			expectedTONRaw = strictFloor
			lowTONRaw = highestPastSale // Floor is the exact past sale
			if highTONRaw < strictFloor {
				highTONRaw = strictFloor * 1.5
			}
			reasoning["historical_sale_floor_applied"] = true
			reasoning["highest_past_sale_ton"] = highestPastSale
		}
	}

	expectedTON := AestheticRound(expectedTONRaw)
	lowTON := AestheticRound(lowTONRaw)
	highTON := AestheticRound(highTONRaw)

	// Final invariants guard to ensure low <= expected <= high after rounding
	if lowTON > expectedTON {
		lowTON = expectedTON
	}
	if highTON < expectedTON {
		highTON = expectedTON
	}

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
		ComparableSales: len(targetSales) + len(exactSales) + len(broadSales),
		Rarity: ValuationRarity{
			Tier:  GetTier(expectedTON),
			Stars: GetStars(expectedTON),
		},
		Tags:            semResult.Tags,
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
