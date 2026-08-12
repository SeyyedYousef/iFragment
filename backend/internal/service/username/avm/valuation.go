package avm

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/fragment"
	"ifragment-backend/internal/client/marketapp"
	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
	"log/slog"
	"math"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"golang.org/x/sync/errgroup"
)

// ValuationService orchestrates the AVM pipeline:
// Classify → Fetch → Compute → Audit → Return
type ValuationService struct {
	db              *repository.Database
	cache           *repository.Cache
	tonClient       *tonapi.Client
	fragmentClient  *fragment.Client
	marketappClient *marketapp.Client
	cfg             EngineConfig
	semanticEngine  *SemanticEngine
}

// NewValuationService creates a new AVM service with default config.
func NewValuationService(db *repository.Database, cache *repository.Cache, tonClient *tonapi.Client) *ValuationService {
	return &ValuationService{
		db:              db,
		cache:           cache,
		tonClient:       tonClient,
		fragmentClient:  fragment.NewClient(),
		marketappClient: marketapp.NewClient(),
		cfg:             DefaultEngineConfig(),
		semanticEngine:  NewSemanticEngine(db),
	}
}

type DictionaryData struct {
	IsWord       bool   `json:"is_word"`
	PartOfSpeech string `json:"part_of_speech,omitempty"`
	Definition   string `json:"definition,omitempty"`
}

type ValuationHistoryItem struct {
	SalePriceTON string    `json:"sale_price_ton"`
	Date         time.Time `json:"date"`
	Buyer        string    `json:"buyer"`
}

type ValuationHistory struct {
	IsSold             bool                   `json:"is_sold"`
	OwnerAddress       string                 `json:"owner_address,omitempty"`
	HighestPastSaleTON float64                `json:"highest_past_sale_ton,omitempty"`
	Transactions       []ValuationHistoryItem `json:"transactions,omitempty"`
}

type ValuationSimilar struct {
	Username     string  `json:"username"`
	Reason       string  `json:"reason"`
	Status       string  `json:"status,omitempty"`         // "sold", "available", "taken", "on_sale", "on_auction", "non_nft"
	SalePrice    float64 `json:"sale_price,omitempty"`     // Last sale price in TON
	SalePriceUSD float64 `json:"sale_price_usd,omitempty"` // Last sale price in USD
	SaleDate     string  `json:"sale_date,omitempty"`      // Date of last sale
	// PriceSource tells the client how trustworthy SalePrice is:
	// "archive_anchor" (dated dataset price), "db_sale"/"fragment_history"
	// (recorded sale) or "onchain_listing" (live ask price).
	PriceSource string `json:"price_source,omitempty"`
}

type ValuationStructure struct {
	HasDigits     bool `json:"has_digits"`
	LettersOnly   bool `json:"letters_only"`
	HasUnderscore bool `json:"has_underscore"`
}

type ValuationSEO struct {
	Score   int    `json:"score"`
	Verdict string `json:"verdict"`
}

// ValuationResult is the output DTO for a single valuation.
type ValuationResult struct {
	RunID           int64              `json:"run_id"`
	Username        string             `json:"username"`
	ModelVersion    string             `json:"model_version"`
	BasePriceTON    decimal.Decimal    `json:"base_price_ton"`
	LowTON          decimal.Decimal    `json:"low_ton"`
	ExpectedTON     decimal.Decimal    `json:"expected_ton"`
	HighTON         decimal.Decimal    `json:"high_ton"`
	LowUSD          decimal.Decimal    `json:"low_usd"`
	ExpectedUSD     decimal.Decimal    `json:"expected_usd"`
	HighUSD         decimal.Decimal    `json:"high_usd"`
	ConfidenceScore int16              `json:"confidence_score"`
	TONUSDRate      float64            `json:"ton_usd_rate"`
	ComparableSales int                `json:"comparable_sales_count"`
	Rarity          ValuationRarity    `json:"rarity"`
	Tags            []string           `json:"tags"`
	Length          int                `json:"length"`
	Structure       ValuationStructure `json:"structure"`
	SEO             ValuationSEO       `json:"seo"`
	Dictionary      DictionaryData     `json:"dictionary"`
	History         ValuationHistory   `json:"history"`
	Similar         []ValuationSimilar `json:"similar"`
	ReasoningLog    map[string]any     `json:"reasoning_log"`

	// New fields for the 17-point feature set
	InvestmentGrade  string              `json:"investment_grade"`
	Comparables      []ComparableSaleDto `json:"comparables"`
	PriceTrend       []PriceTrendDto     `json:"price_trend"`
	WalletInfo       *WalletInfoDto      `json:"wallet_info"`
	EntityInfo       *EntityInfoDto      `json:"entity_info"`
	Status           string              `json:"status"`
	Brandability     int                 `json:"brandability"`
	FearGreedIndex   int                 `json:"fear_greed_index"`
	FearGreedLabel   string              `json:"fear_greed_label"`
	WikipediaSummary string              `json:"wikipedia_summary"`
	RarityBreakdown  map[string]int      `json:"rarity_breakdown"`

	// Enhanced Valuation & Intelligence metrics
	LiquidityRating    string             `json:"liquidity_rating"`
	EstimatedSellTime  string             `json:"estimated_sell_time"`
	TargetBuyerProfile string             `json:"target_buyer_profile"`
	ProjectedGrowth    ProjectedGrowthDto `json:"projected_growth"`

	// Portfolio & Contact features
	Portfolio    *PortfolioDto    `json:"portfolio,omitempty"`
	OwnerProfile *OwnerProfileDto `json:"owner_profile,omitempty"`

	// 🚀 New Intelligence Fields
	LiquidityMetrics *LiquidityMetricsDto `json:"liquidity_metrics,omitempty"`
	CrossPlatform    *CrossPlatformDto    `json:"cross_platform,omitempty"`
	AuctionPlaybook  *AuctionPlaybookDto  `json:"auction_playbook,omitempty"`
	PhishingThreat   *PhishingThreatDto   `json:"phishing_threat,omitempty"`
	SearchTrend      *SearchTrendDto      `json:"search_trend,omitempty"`

	// Live market state, collection context and estimate provenance.
	LiveMarket           *LiveMarketDto           `json:"live_market,omitempty"`
	MarketContext        *MarketContextDto        `json:"market_context,omitempty"`
	PriceBasis           *PriceBasisDto           `json:"price_basis,omitempty"`
	ModelAccuracy        *ModelAccuracyDto        `json:"model_accuracy,omitempty"`
	QualityGrade         string                   `json:"quality_grade,omitempty"`
	PercentileRank       float64                  `json:"percentile_rank,omitempty"`
	RiskAudit            *RiskAuditDto            `json:"risk_audit,omitempty"`
	TransactionEconomics *TransactionEconomicsDto `json:"transaction_economics,omitempty"`
}

// ModelAccuracyDto reports how the model has actually performed against sales that
// happened after a valuation was issued. Without it, "confidence" is self-reported.
type ModelAccuracyDto struct {
	SampleSize     int     `json:"sample_size"`
	MedianErrorPct float64 `json:"median_error_pct"`
	WithinBandPct  float64 `json:"within_band_pct"`
	EvaluatedAt    string  `json:"evaluated_at"`
}

type LiquidityMetricsDto struct {
	Score         int    `json:"score"`
	EstimatedDays string `json:"estimated_days"`
}

// LiveMarketDto is the current, actionable market state for a username: is it on
// auction right now, what is the standing bid, when does it close, and where can
// the user act on it. This is the one thing fragment.com shows that a valuation
// report is useless without.
type LiveMarketDto struct {
	Status        string  `json:"status"` // on_auction | on_sale | taken | available | unknown
	CurrentBidTON float64 `json:"current_bid_ton,omitempty"`
	CurrentBidUSD float64 `json:"current_bid_usd,omitempty"`
	BuyNowTON     float64 `json:"buy_now_ton,omitempty"`
	BuyNowUSD     float64 `json:"buy_now_usd,omitempty"`
	// AuctionEndsAt is RFC3339 and drives the client-side countdown.
	AuctionEndsAt  string           `json:"auction_ends_at,omitempty"`
	MintDate       string           `json:"mint_date,omitempty"`
	OwnerAddress   string           `json:"owner_address,omitempty"`
	PreviousOwners int              `json:"previous_owners,omitempty"`
	Offers         []MarketOfferDto `json:"offers,omitempty"`
	FragmentURL    string           `json:"fragment_url"`
	TelegramURL    string           `json:"telegram_url"`
	// AskVsEstimatePct is how far the live ask sits above (+) or below (−) our
	// expected value, in percent. This is the single most decision-relevant number
	// on the page when the username is actually purchasable.
	AskVsEstimatePct float64 `json:"ask_vs_estimate_pct,omitempty"`
	CheckedAt        string  `json:"checked_at"`
}

type MarketOfferDto struct {
	PriceTON float64 `json:"price_ton"`
	PriceUSD float64 `json:"price_usd,omitempty"`
	Date     string  `json:"date,omitempty"`
	From     string  `json:"from,omitempty"`
}

// MarketContextDto is collection-wide context so a single price has a scale to be
// read against.
type MarketContextDto struct {
	FloorPriceTON  float64 `json:"floor_price_ton,omitempty"`
	Volume24hTON   float64 `json:"volume_24h_ton,omitempty"`
	TotalVolumeTON float64 `json:"total_volume_ton,omitempty"`
	SalesCount     int     `json:"sales_count,omitempty"`
	ListedRatio    float64 `json:"listed_ratio,omitempty"`
	ActiveAuctions int     `json:"active_auctions,omitempty"`
	TotalOwners    int     `json:"total_owners,omitempty"`
	ItemsCount     int     `json:"items_count,omitempty"`
	HighestSaleTON float64 `json:"highest_sale_ton,omitempty"`
}

// PriceBasisDto states exactly what evidence produced the estimate, so the number
// can be audited by the person paying for it.
type PriceBasisDto struct {
	TargetSales int    `json:"target_sales"` // recorded sales of this exact username
	ExactSales  int    `json:"exact_sales"`  // same segment and character length
	BroadSales  int    `json:"broad_sales"`  // same segment, any length
	AnchorUsed  bool   `json:"anchor_used"`  // archive anchor price contributed
	LiveAskUsed bool   `json:"live_ask_used"`
	Method      string `json:"method"`
}

type CrossPlatformDto struct {
	Twitter   bool `json:"twitter"`
	Instagram bool `json:"instagram"`
	Github    bool `json:"github"`
	Web3      bool `json:"web3"`
}

type AuctionPlaybookDto struct {
	StartPriceTON float64 `json:"start_price_ton"`
	BidStepTON    float64 `json:"bid_step_ton"`
	BestDay       string  `json:"best_day"`
	BestHourUTC   string  `json:"best_hour_utc"`
}

type PhishingThreatDto struct {
	HasThreat       bool    `json:"has_threat"`
	SimilarUsername string  `json:"similar_username,omitempty"`
	SimilarSaleTON  float64 `json:"similar_sale_ton,omitempty"`
	RiskLevel       string  `json:"risk_level"`
}

type SearchTrendDto struct {
	SurgePercent int    `json:"surge_percent"`
	Status       string `json:"status"`
}

type ProjectedGrowthDto struct {
	BullTON float64 `json:"bull_ton"`
	BaseTON float64 `json:"base_ton"`
	BearTON float64 `json:"bear_ton"`
	BullUSD float64 `json:"bull_usd"`
	BaseUSD float64 `json:"base_usd"`
	BearUSD float64 `json:"bear_usd"`
}

// PortfolioDto shows all usernames owned by the same wallet with historical last-sale basis
type PortfolioDto struct {
	OwnerAddress string `json:"owner_address"`
	TotalCount   int    `json:"total_count"`
	// TotalLastSale* is the sum of the last recorded prices — i.e. what the
	// holdings changed hands for, not what they are worth today.
	TotalLastSaleTON        float64 `json:"total_last_sale_ton"`
	TotalLastSaleUSD        float64 `json:"total_last_sale_usd"`
	TotalAcquisitionCostTON float64 `json:"total_acquisition_cost_ton"`
	// TotalEstValue* is the model's current estimate for the whole wallet.
	TotalEstValueTON float64            `json:"total_est_value_ton,omitempty"`
	TotalEstValueUSD float64            `json:"total_est_value_usd,omitempty"`
	PricedItems      int                `json:"priced_items"`
	UnknownItems     int                `json:"unknown_items"`
	Items            []PortfolioItemDto `json:"items"`
}

type PortfolioItemDto struct {
	Username               string   `json:"username"`
	Status                 string   `json:"status"`
	LastSaleTON            *float64 `json:"last_sale_ton,omitempty"`
	LastSaleUSD            *float64 `json:"last_sale_usd,omitempty"`
	LastSaleDate           *string  `json:"last_sale_date,omitempty"`
	SaleSource             string   `json:"sale_source,omitempty"`
	AcquiredByCurrentOwner bool     `json:"acquired_by_current_owner"`
	AcquisitionCostTON     *float64 `json:"acquisition_cost_ton,omitempty"`
}

// OwnerProfileDto shows the Telegram profile behind a username
type OwnerProfileDto struct {
	UserID    int64  `json:"user_id,omitempty"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
	Username  string `json:"username,omitempty"`
	IsPremium bool   `json:"is_premium"`
	HasPhoto  bool   `json:"has_photo"`
	PeerType  string `json:"peer_type"` // "user", "channel", "bot", "unknown"
}

type RiskAuditDto struct {
	HasHomoglyphRisk bool   `json:"has_homoglyph_risk"`
	HomoglyphMessage string `json:"homoglyph_message,omitempty"`
	IsScamOrFake     bool   `json:"is_scam_or_fake"`
	HasTrademarkRisk bool   `json:"has_trademark_risk"`
	TrademarkDetail  string `json:"trademark_detail,omitempty"`
	TonDnsSynergy    string `json:"ton_dns_synergy,omitempty"` // "registered", "available", "unknown"
}

type TransactionEconomicsDto struct {
	NetPayoutTON   float64 `json:"net_payout_ton"`
	NetPayoutUSD   float64 `json:"net_payout_usd"`
	FragmentFeeTON float64 `json:"fragment_fee_ton"`
	FragmentFeePct float64 `json:"fragment_fee_pct"`
	MinBidTON      float64 `json:"min_bid_ton"`
	BidStepTON     float64 `json:"bid_step_ton"`
}

func CheckHomoglyphRisk(username string) (bool, string) {
	raw := strings.TrimPrefix(username, "@")
	u := strings.ToLower(raw)

	// Latin visual spoofing traps
	if strings.Contains(raw, "I") && strings.Contains(raw, "l") {
		return true, "High phishing risk: contains ambiguous uppercase 'I' and lowercase 'l'"
	}
	if strings.Contains(raw, "I") {
		return true, "Spoofing risk: uppercase 'I' looks identical to lowercase 'l' in standard fonts"
	}
	if strings.Contains(u, "0") && strings.Contains(u, "o") {
		return true, "Visual confusion risk: contains digit '0' alongside letter 'O'"
	}
	if strings.Contains(u, "1") && (strings.Contains(u, "l") || strings.Contains(raw, "I")) {
		return true, "Visual confusion risk: contains digit '1' alongside letter 'l'/'I'"
	}
	if strings.Contains(u, "rn") || strings.Contains(u, "vv") {
		return true, "Ligature spoofing risk: contains visual trick 'rn' (m-like) or 'vv' (w-like)"
	}

	// Non-ASCII and Cyrillic/Greek homoglyphs
	cyrillicHomoglyphs := map[rune]string{
		'а': "Cyrillic 'а' (looks like Latin 'a')",
		'е': "Cyrillic 'е' (looks like Latin 'e')",
		'о': "Cyrillic 'о' (looks like Latin 'o')",
		'р': "Cyrillic 'р' (looks like Latin 'p')",
		'с': "Cyrillic 'с' (looks like Latin 'c')",
		'х': "Cyrillic 'х' (looks like Latin 'x')",
		'у': "Cyrillic 'у' (looks like Latin 'y')",
		'і': "Cyrillic 'і' (looks like Latin 'i')",
		'А': "Cyrillic 'А' (looks like Latin 'A')",
		'В': "Cyrillic 'В' (looks like Latin 'B')",
		'Е': "Cyrillic 'Е' (looks like Latin 'E')",
		'К': "Cyrillic 'К' (looks like Latin 'K')",
		'М': "Cyrillic 'М' (looks like Latin 'M')",
		'Н': "Cyrillic 'Н' (looks like Latin 'H')",
		'О': "Cyrillic 'О' (looks like Latin 'O')",
		'Р': "Cyrillic 'Р' (looks like Latin 'P')",
		'С': "Cyrillic 'С' (looks like Latin 'C')",
		'Т': "Cyrillic 'Т' (looks like Latin 'T')",
		'Х': "Cyrillic 'Х' (looks like Latin 'X')",
		'α': "Greek 'α' (looks like Latin 'a')",
		'ε': "Greek 'ε' (looks like Latin 'e')",
		'ο': "Greek 'ο' (looks like Latin 'o')",
		'ρ': "Greek 'ρ' (looks like Latin 'p')",
	}

	for _, r := range raw {
		if desc, found := cyrillicHomoglyphs[r]; found {
			return true, fmt.Sprintf("Critical homoglyph spoofing: contains %s", desc)
		}
		if r > 127 {
			return true, "Critical homoglyph risk: contains non-ASCII characters"
		}
	}
	return false, ""
}

func CheckTrademarkRisk(username string) (bool, string) {
	u := strings.TrimPrefix(strings.ToLower(username), "@")
	brands := map[string]string{
		"clash":    "Clash of Clans / Supercell",
		"telegram": "Telegram FZ-LLC",
		"durov":    "Pavel Durov / Telegram",
		"wallet":   "Telegram Wallet",
		"fragment": "Fragment Auction Platform",
		"bitcoin":  "Bitcoin Foundation",
		"ethereum": "Ethereum Foundation",
		"binance":  "Binance Exchange",
		"apple":    "Apple Inc.",
		"google":   "Google LLC",
		"meta":     "Meta Platforms Inc.",
		"nike":     "Nike Inc.",
		"adidas":   "Adidas AG",
		"rolex":    "Rolex SA",
	}
	for b, brandName := range brands {
		if u == b || (len(u) >= 4 && strings.Contains(u, b)) {
			return true, fmt.Sprintf("Trademark clash: %s", brandName)
		}
	}
	return false, ""
}

func CalculateQualityGrade(expectedTON float64) (string, float64) {
	switch {
	case expectedTON >= 1000:
		return "A+", math.Min(99.0, 95.0+((expectedTON-1000)/2000)*4.0)
	case expectedTON >= 400:
		return "A", 85.0 + ((expectedTON-400)/600)*10.0
	case expectedTON >= 150:
		return "B+", 70.0 + ((expectedTON-150)/250)*15.0
	case expectedTON >= 50:
		return "B", 50.0 + ((expectedTON-50)/100)*20.0
	case expectedTON >= 15:
		return "C+", 30.0 + ((expectedTON-15)/35)*20.0
	default:
		return "C", math.Max(5.0, (expectedTON/15)*25.0)
	}
}

type ComparableSaleDto struct {
	Username     string  `json:"username"`
	Price        float64 `json:"price"`
	Date         string  `json:"date"`
	TonviewerUrl string  `json:"tonviewer_url,omitempty"`
}

type PriceTrendDto struct {
	Label string  `json:"label"`
	Value float64 `json:"value"`
}

type WalletInfoDto struct {
	Balance  float64 `json:"balance"`
	NFTCount int     `json:"nft_count"`
	IsWhale  bool    `json:"is_whale"`
}

type EntityInfoDto struct {
	Type     string `json:"type"`
	Members  int    `json:"members"`
	Verified bool   `json:"verified"`
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
	isSymmetricRepetition := false
	if len(lower) >= 3 {
		for i := 0; i < len(lower)-2; i++ {
			if lower[i] == lower[i+1] && lower[i] == lower[i+2] {
				hasRepetition = true
				break
			}
		}
		if hasRepetition {
			isSym := true
			first := lower[0]
			for i := 1; i < len(lower); i++ {
				if lower[i] != first {
					isSym = false
					break
				}
			}
			isSymmetricRepetition = isSym
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
		if strings.HasSuffix(lower, s) && len(lower) > len(s)+2 && !hasUnderscore {
			hasBrandableSuffix = true
			break
		}
	}

	features = MorphFeatures{
		HasNumbers:            hasNumbers,
		HasAlpha:              hasAlpha,
		HasUnderscore:         hasUnderscore,
		HasCheapSuffix:        hasCheapSuffix,
		HasCheapPrefix:        hasCheapPrefix,
		HasRepetition:         hasRepetition,
		IsDictionary:          isDict,
		CharLength:            int(charLen),
		FlowScore:             AnalyzeFlow(decoded),
		IsPalindrome:          IsPalindrome(lower),
		IsKeyboardPattern:     IsKeyboardPattern(lower),
		IsCombo:               comboRes.IsCombo,
		ComboValue:            comboRes.Value,
		IsTechPattern:         techRes.IsTechPattern,
		HasGoldenYear:         yearRes.HasYear,
		AffixBonus:            affixRes.Bonus,
		TierMultiplier:        tierRes.Multiplier,
		FrequencyRank:         RankWord(decoded),
		IsHyped:               IsHyped(decoded),
		EuphonyScore:          euphonyScore,
		IsAesthetic:           isAesthetic,
		HasBrandableSuffix:    hasBrandableSuffix,
		IsAcronym:             isAcronym,
		IsUnderscoreCompound:  isUnderscoreCompound,
		VisualSymmetry:        visualSymmetry,
		IsABAB:                isABAB,
		IsAABB:                isAABB,
		IsSymmetricRepetition: isSymmetricRepetition,
		IsGibberish:           IsGibberishString(lower, isDict, RankWord(decoded), AnalyzeFlow(decoded)),
	}

	return segment, charLen, features
}

// isDictionaryWord checks if a username is a known dictionary word using a
// 3-layer dynamic lookup. No manual word additions needed.
//
// Layer 1: RankWord() — 10,000 most common English words (instant, local)
// Layer 2: Datamuse API — millions of English words (HTTP, cached)
// Layer 3: Brand/tech fallback — known brand names not in dictionaries
func isDictionaryWord(lower string) bool {
	lower = strings.ToLower(lower)

	// Layer 1: Local frequency database (10K words, zero latency)
	if RankWord(lower) > 0 {
		return true
	}

	// Layer 2: Datamuse API (millions of words, cached after first call)
	if GetWordFrequency(lower) > 0 {
		return true
	}

	// Layer 3: Brand names and tech terms not in standard dictionaries
	brandWords := map[string]bool{
		"bitcoin": true, "ethereum": true, "tesla": true, "google": true,
		"apple": true, "meta": true, "nike": true, "adidas": true,
		"crypto": true, "defi": true, "nft": true, "doge": true,
		"meme": true, "wifi": true, "emoji": true, "hashtag": true,
		"chatgpt": true, "tiktok": true, "spotify": true, "uber": true,
	}
	return brandWords[lower]
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

	username = strings.ToLower(strings.TrimSpace(username))
	username = strings.TrimPrefix(username, "@")

	if len(username) < 4 || len(username) > 32 {
		return nil, fmt.Errorf("invalid telegram username length: must be between 4 and 32 characters")
	}
	if !regexp.MustCompile(`^[a-z][a-z0-9_]*$`).MatchString(username) {
		return nil, fmt.Errorf("invalid telegram username format: must start with a letter and contain only letters, numbers, or underscores")
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
		exactSales   []repository.Sale
		broadSales   []repository.Sale
		targetSales  []repository.Sale
		scrapedSales []fragment.HistoricalSale
		count30      int
		count31_90   int
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

	var (
		marketappPrice float64
		marketItem     *marketapp.ItemData
		liveStatus     string
	)

	// Structured item data first: it carries the live sale state (bid, buy-now,
	// auction end, past sales, previous owners) that the report needs, not just a
	// price. The HTML scraper stays as a price-only fallback.
	g.Go(func() error {
		mCtx, cancelM := context.WithTimeout(gCtx, 1500*time.Millisecond)
		defer cancelM()

		if s.marketappClient != nil {
			if itemData, err := s.marketappClient.GetItem(mCtx, username); err == nil && itemData != nil {
				marketItem = itemData
				switch {
				case itemData.BuyNowPrice > 0:
					marketappPrice = itemData.BuyNowPrice
				case itemData.HighestBid > 0:
					marketappPrice = itemData.HighestBid
				case len(itemData.PastSales) > 0:
					marketappPrice = itemData.PastSales[0].Price
				}
			}
		}

		if marketappPrice == 0 {
			if scrapedPrice := ScrapeMarketappMaxPrice(mCtx, username); scrapedPrice > 0 {
				marketappPrice = scrapedPrice
			}
		}
		return nil
	})

	// Live availability straight from Fragment.
	g.Go(func() error {
		if s.fragmentClient == nil {
			return nil
		}
		fCtx, cancelF := context.WithTimeout(gCtx, 1500*time.Millisecond)
		defer cancelF()
		if st, err := s.fragmentClient.CheckUsername(fCtx, username); err == nil && st != fragment.StatusUnknown {
			liveStatus = string(st)
		}
		return nil
	})

	g.Go(func() error {
		if s.fragmentClient != nil {
			scrapeCtx, cancelScrape := context.WithTimeout(gCtx, 1200*time.Millisecond)
			defer cancelScrape()
			var err error
			scrapedSales, err = s.fragmentClient.GetHistoricalSales(scrapeCtx, username)
			if err != nil {
				slog.Warn("Failed to scrape historical sales from Fragment (timeout or network)", "username", username, "error", err)
			}
		}
		return nil
	})

	if err := g.Wait(); err != nil {
		slog.Error("AVM parallel fetch failed", "username", username, "error", err)
		return nil, fmt.Errorf("failed to fetch comparable data: %w", err)
	}

	// ── Step 3: Math Engine (float64 isolated zone) ──

	// Convert DB sales to engine ComparableSales with normalization
	targetComps := SalesToComparables(targetSales, s.cfg)
	exactComps := SalesToComparables(exactSales, s.cfg)
	broadComps := SalesToComparables(broadSales, s.cfg)

	if marketappPrice > 0 {
		reasoning["marketapp_price_found"] = marketappPrice
		targetComps = append(targetComps, ComparableSale{
			ID:            0,
			PriceTON:      marketappPrice,
			SaleDate:      now,
			CharLength:    int(charLen),
			HasNumbers:    features.HasNumbers,
			HasUnderscore: features.HasUnderscore,
			IsDictionary:  features.IsDictionary,
		})
	}

	reasoning["exact_sales_count"] = len(exactSales)
	reasoning["broad_sales_count"] = len(broadSales)
	reasoning["target_sales_count"] = len(targetComps) + len(scrapedSales)
	reasoning["momentum_30d"] = count30
	reasoning["momentum_31_90d"] = count31_90

	// Merge scraped sales into targetComps (avoid duplicates)
	for _, ss := range scrapedSales {
		duplicate := false
		for _, tc := range targetComps {
			if math.Abs(tc.PriceTON-ss.PriceTON) < 0.1 && tc.SaleDate.Year() == ss.SaleDate.Year() && tc.SaleDate.Month() == ss.SaleDate.Month() && tc.SaleDate.Day() == ss.SaleDate.Day() {
				duplicate = true
				break
			}
		}
		if !duplicate {
			// Save to database so we don't have to scrape it again!
			_, dbErr := s.db.InsertSale(ctx, repository.Sale{
				Username:      username,
				SalePriceTON:  decimal.NewFromFloat(ss.PriceTON),
				SaleType:      "auction",
				SaleDate:      ss.SaleDate,
				BuyerAddress:  nil,
				CharLength:    int16(charLen),
				Segment:       segment,
				HasNumbers:    features.HasNumbers,
				HasUnderscore: features.HasUnderscore,
				IsDictionary:  features.IsDictionary,
				Source:        "fragment_scrape",
			})
			if dbErr != nil {
				slog.Warn("Failed to persist scraped sale to database", "username", username, "error", dbErr)
			}

			targetComps = append(targetComps, ComparableSale{
				ID:            0,
				PriceTON:      ss.PriceTON,
				RawPriceTON:   ss.PriceTON,
				SaleDate:      ss.SaleDate,
				CharLength:    int(charLen),
				HasNumbers:    features.HasNumbers,
				HasUnderscore: features.HasUnderscore,
				IsDictionary:  features.IsDictionary,
			})
		}
	}

	// --- ANCHOR OVERRIDE & INJECTION ---
	lowerUsername := strings.ToLower(username)
	var anchorInjected bool

	if hardcodedPrice, ok := HistoricalSales[lowerUsername]; ok && hardcodedPrice > 0 {
		// Ensure hardcoded historical anchor is ALWAYS injected as primary sale benchmark
		alreadyHasAnchor := false
		for _, tc := range targetComps {
			if math.Abs(tc.PriceTON-hardcodedPrice) < 1.0 {
				alreadyHasAnchor = true
				break
			}
		}
		if !alreadyHasAnchor {
			targetComps = append([]ComparableSale{{
				PriceTON:    hardcodedPrice,
				RawPriceTON: hardcodedPrice,
				SaleDate:    time.Date(2022, 11, 1, 0, 0, 0, 0, time.UTC),
				ID:          0,
				CharLength:  len(username),
			}}, targetComps...)
		}
		anchorInjected = true
		reasoning["anchor_source"] = "historical_sales_verified"
		reasoning["anchor_price"] = hardcodedPrice
	} else if len(targetComps) > 0 {
		anchorInjected = true
		reasoning["anchor_source"] = "live_scraped_or_db"
		reasoning["anchor_price"] = targetComps[0].PriceTON
	}

	// Apply annual market appreciation to historical sales (including injected anchors)
	ApplyMarketAppreciation(targetComps, s.cfg.AppreciationRate, now)
	ApplyMarketAppreciation(exactComps, s.cfg.AppreciationRate, now)
	ApplyMarketAppreciation(broadComps, s.cfg.AppreciationRate, now)

	reasoning["appreciation_rate"] = s.cfg.AppreciationRate
	reasoning["anchor_injected"] = anchorInjected

	// Fetch semantic engine result early so we can use it for base price sliding & boosting
	semResult := s.semanticEngine.Score(ctx, username)
	if semResult != nil {
		features.SemanticScore = semResult.TotalScore
		features.IsDictionary = features.IsDictionary || semResult.WordFreqScore > 20
	}
	reasoning["features"] = features

	// 3a. Base Price (Bayesian)
	baseLog, nEff, mad, saleIDs := CalcBaseLog(targetComps, exactComps, broadComps, s.cfg, features, now)

	// 3a-1. Semantic-Aware Base Price Boost
	// If no anchor/target sales exist and the semantic engine thinks this is premium,
	// boost the fallback base price dramatically. Without this, "bitcoin" starts at 5 TON.
	if !anchorInjected && semResult != nil && semResult.TotalScore >= 40 {
		// Continuous multiplier from 1.0x (at score 40) to 6.0x (at score 100)
		scoreDiff := semResult.TotalScore - 40.0
		semBaseMult := 1.0 + math.Pow(scoreDiff/60.0, 1.5)*5.0

		lengthFallback := fallbackForLength(int(charLen), s.cfg)
		if features.IsDictionary && lengthFallback < 500.0 {
			lengthFallback = 500.0 // Verified English dictionary words have a minimum 500 TON baseline
		}
		minBasePrice := lengthFallback * semBaseMult
		minBaseLog := math.Log(minBasePrice)

		if baseLog < minBaseLog {
			baseLog = minBaseLog
			reasoning["semantic_base_boost"] = fmt.Sprintf("continuous_boost_%.2fx", semBaseMult)
		}
	}

	// Compute dynamic age-based damping factor for anchor sales or database baseline
	dampingFactor := 1.0
	if anchorInjected {
		if features.IsDictionary {
			// Super-premium dictionary words maintain 100% full valuation strength without artificial damping
			dampingFactor = 1.0
		} else if len(targetComps) > 0 {
			anchorDate := targetComps[0].SaleDate
			ageInYears := now.Sub(anchorDate).Hours() / (24 * 365.25)
			if ageInYears > 0 {
				dampingFactor = math.Min(1.0, 0.50+ageInYears*0.15)
			} else {
				dampingFactor = 0.50
			}
		} else {
			dampingFactor = 0.50
		}
	} else if nEff > 0 {
		// Dynamic Damping: short names damp more (baseline is already high), long names damp less.
		// Bypassed for verified dictionary words to allow full organic premium.
		dynamicDamp := s.cfg.DatabaseDamping - float64(5-charLen)*0.10
		if features.IsDictionary {
			dynamicDamp = 1.0
		} else {
			if dynamicDamp < 0.35 {
				dynamicDamp = 0.35
			}
			if dynamicDamp > 0.80 {
				dynamicDamp = 0.80
			}
		}
		dampingFactor = dynamicDamp
	} else {
		dampingFactor = 1.0
	}
	reasoning["damping_factor"] = dampingFactor

	// 3b. Morphology
	morphLog := CalcMorphologyLog(features, s.cfg.MorphMultipliers, s.cfg)
	morphLog *= dampingFactor // Dampen morphology impact based on dampingFactor

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
	} else if segment == "alpha" {
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

	semanticLog *= dampingFactor // Dampen semantic impact based on dampingFactor

	if anchorInjected {
		// For anchored sales, the historical sale price ALREADY captures the username's morphology and baseline desirability.
		// Morphology is zeroed out to prevent double-counting.
		morphLog = 0.0
		reasoning["anchor_morphology_zeroed"] = true

		// Semantic multiplier for anchored sales represents minor market sentiment drift (capped up to 1.45x for dictionary words).
		maxDrift := 1.25
		if features.IsDictionary {
			maxDrift = 1.45
		}
		if semResult != nil && semResult.Multiplier > 1.0 {
			driftVal := math.Min(semResult.Multiplier, maxDrift)
			semanticLog = math.Log(driftVal)
			reasoning["anchor_semantic_drift_multiplier"] = driftVal
		} else {
			semanticLog = 0.0
		}
		reasoning["anchor_damping_applied"] = true
	}

	reasoning["semantic_log"] = semanticLog

	// 3c. Momentum
	var sumRecent, sumOlder float64
	var numRecent, numOlder int
	thirtyDaysAgo := now.AddDate(0, 0, -30)

	compsToUse := exactComps
	if len(compsToUse) == 0 {
		compsToUse = broadComps
	}

	for _, comp := range compsToUse {
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

	// Fallback to broad comps for momentum counts if exact counts are zero
	if count30 == 0 && count31_90 == 0 {
		for _, comp := range broadComps {
			if comp.SaleDate.After(thirtyDaysAgo) {
				count30++
			} else if comp.SaleDate.After(now.AddDate(0, 0, -90)) {
				count31_90++
			}
		}
	}

	momentumLog := CalcSmoothedMomentum(count30, count31_90, priceTrend, s.cfg)
	reasoning["momentum_log"] = momentumLog

	// 3d. Range
	expectedTONRaw, lowTONRaw, highTONRaw := CalcRangeLog(baseLog, morphLog, momentumLog, semanticLog, mad, features.CharLength, s.cfg)
	basePriceTON := math.Exp(baseLog) // base before morph/momentum/semantic is exp(baseLog)

	// 3e. External Market Multipliers (Wallet Wealth, FnG)
	// NOTE: Brand check is now handled by SemanticEngine (signal #4), no double-counting.
	fngMult, fngClass, fngIndex := GetFearAndGreedMultiplier()
	reasoning["fng_multiplier"] = fngMult
	reasoning["fng_classification"] = fngClass
	reasoning["fng_index"] = fngIndex

	var ownerAddress string
	if s.tonClient != nil {
		// Use a short 1.5s timeout for TonAPI wallet lookup so rate limiting never slows down valuation response
		tonCtx, tonCancel := context.WithTimeout(ctx, 1500*time.Millisecond)
		nft, err := s.tonClient.GetNFTByDNS(tonCtx, username)
		if err == nil && nft != nil && nft.Owner.Address != "" {
			ownerAddress = nft.Owner.Address
			wallet, err := s.tonClient.GetWalletInfo(tonCtx, nft.Owner.Address)
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
		tonCancel()
	}

	// Note: FnG index is recorded in reasoning log as market context, but not multiplied into TON username valuation

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

	// 3g. Historical Sale Floor (For all usernames with a past sale)
	highestPastSale := 0.0
	for _, sale := range targetComps {
		// targetComps has already been appreciated!
		if sale.PriceTON > highestPastSale {
			highestPastSale = sale.PriceTON
		}
	}

	// 3g-1. Marketapp Historical Floor (Live Scraping Fallback/Override)
	marketAppMax := ScrapeMarketappMaxPrice(ctx, username)
	if marketAppMax > highestPastSale {
		highestPastSale = marketAppMax
		reasoning["historical_sale_floor_source"] = "marketapp"
	} else if highestPastSale > 0 {
		reasoning["historical_sale_floor_source"] = "database_or_fragment"
	}

	if highestPastSale > 0 {
		// Ensure strictly higher (e.g., +5% minimum) than the highest past sale
		strictFloor := highestPastSale * 1.05
		if expectedTONRaw < strictFloor {
			expectedTONRaw = strictFloor
			lowTONRaw = highestPastSale // Floor is the exact past sale
			if highTONRaw < strictFloor {
				highTONRaw = strictFloor * 1.5
			}
			reasoning["historical_sale_floor_applied"] = true
			reasoning["highest_past_sale_ton"] = highestPastSale
		}
	}

	// 3h. Semantic KNN Comparable Floor (High-value status dictionary words)
	if !anchorInjected && highestPastSale == 0 {
		knnFloor := CalculateSemanticKNNFloor(username, features, semResult)
		if knnFloor > 0 {
			reasoning["knn_semantic_floor"] = knnFloor
			if expectedTONRaw < knnFloor {
				expectedTONRaw = knnFloor
				if lowTONRaw < knnFloor*0.80 {
					lowTONRaw = knnFloor * 0.80
				}
				if highTONRaw < knnFloor*1.30 {
					highTONRaw = knnFloor * 1.30
				}
				reasoning["knn_semantic_floor_applied"] = true
			}
		}
	}

	// Gibberish and copycat hard cap: Never apply positive length floor to unpronounceable gibberish or spam copycats!
	if features.IsGibberish || features.HasCheapPrefix || features.HasCheapSuffix {
		expectedTONRaw = math.Min(expectedTONRaw, 25.0)
		lowTONRaw = math.Min(lowTONRaw, 15.0)
		highTONRaw = math.Min(highTONRaw, 35.0)
		reasoning["gibberish_copycat_hard_cap_applied"] = true
	} else if charLen == 3 {
		// Floor for clean 3-character usernames (Fragment protocol baseline = 10,000 TON)
		minFloor := 10000.0
		if features.HasUnderscore || features.HasNumbers {
			minFloor = 2500.0
		}
		if expectedTONRaw < minFloor {
			expectedTONRaw = minFloor
		}
		if lowTONRaw < minFloor {
			lowTONRaw = minFloor
		}
		if highTONRaw < expectedTONRaw {
			highTONRaw = expectedTONRaw * 1.2
		}
	} else if charLen == 4 {
		// Floor for clean 4-character usernames (Fragment protocol baseline = 5,050 TON)
		minFloor := 5050.0
		if features.HasUnderscore || features.HasNumbers {
			minFloor = 1000.0
		}
		if expectedTONRaw < minFloor {
			expectedTONRaw = minFloor
		}
		if lowTONRaw < minFloor {
			lowTONRaw = minFloor
		}
		if highTONRaw < expectedTONRaw {
			highTONRaw = expectedTONRaw * 1.2
		}
	}

	// Prediction Intervals: Symmetric percentage bounds (15% for anchored/known, 30% for general)
	if anchorInjected || highestPastSale > 0 {
		lowTONRaw = math.Max(expectedTONRaw*0.85, highestPastSale)
		highTONRaw = math.Max(expectedTONRaw*1.15, highestPastSale*1.05)
	} else if !features.IsGibberish {
		lowTONRaw = expectedTONRaw * 0.70
		highTONRaw = expectedTONRaw * 1.30
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

	// Confidence & Liquidity
	hasMomentum := count30 > 0 || count31_90 > 0
	confidence := CalcConfidenceScore(nEff, len(exactSales)+len(broadSales), mad, hasMomentum)
	reasoning["confidence_score"] = confidence

	// Dynamic Liquidity & Velocity calculation
	liquidityScore := 40
	if features.IsDictionary {
		liquidityScore += 30
	}
	if charLen <= 5 {
		liquidityScore += 20
	}
	if !features.HasNumbers && !features.HasUnderscore {
		liquidityScore += 10
	}
	if features.IsGibberish {
		liquidityScore = 5
	}

	// Adjust liquidity score by price point (higher price = lower instant liquidity)
	if expectedTON > 50000 {
		liquidityScore -= 25
	} else if expectedTON > 10000 {
		liquidityScore -= 15
	} else if expectedTON < 100 {
		liquidityScore += 15
	}

	if liquidityScore < 5 {
		liquidityScore = 5
	}
	if liquidityScore > 98 {
		liquidityScore = 98
	}
	reasoning["liquidity_score"] = liquidityScore

	// Derive Liquidity Rating
	liquidityRating := "Moderate"
	if liquidityScore >= 75 {
		liquidityRating = "Ultra-Liquid"
	} else if liquidityScore >= 55 {
		liquidityRating = "High"
	} else if liquidityScore <= 25 {
		liquidityRating = "Illiquid"
	}

	// Derive Estimated Sell Time based on liquidity score & price bracket
	estimatedSellTime := "1–3 Weeks"
	if liquidityScore >= 80 {
		estimatedSellTime = "24–48 Hours"
	} else if liquidityScore >= 60 {
		estimatedSellTime = "3–7 Days"
	} else if liquidityScore >= 40 {
		estimatedSellTime = "1–3 Weeks"
	} else {
		estimatedSellTime = "1–3 Months (OTC)"
	}

	// Derive Target Buyer Profile
	targetBuyerProfile := "Personal Brand & Creator"
	if semResult != nil && semResult.Tags != nil {
		for _, tag := range semResult.Tags {
			if strings.Contains(tag, "crypto") {
				targetBuyerProfile = "Web3 & Crypto Project"
				break
			} else if strings.Contains(tag, "brand") || strings.Contains(tag, "premium") {
				targetBuyerProfile = "Institutional / OTC Collector"
				break
			} else if strings.Contains(tag, "telegram") {
				targetBuyerProfile = "Telegram MiniApp & Bot"
				break
			}
		}
	}
	if targetBuyerProfile == "Personal Brand & Creator" && features.IsDictionary {
		targetBuyerProfile = "Brand & Corporate Entity"
	}

	// Projected Growth (1-Year Bull / Base / Bear).
	//
	// Previously these were fixed ×1.45 / ×1.22 / ×0.95 multipliers, identical for
	// every username. They are now derived from two things the model actually
	// measured: the configured market CAGR for the base path, and the dispersion of
	// the comparable sales (MAD, in log-space) for the spread. A username priced
	// from tight, consistent comparables gets a narrow cone; a thinly-traded one
	// gets a wide one — which is the honest picture.
	baseMultiplier := 1.0 + s.cfg.AppreciationRate
	spread := mad * s.cfg.UncertaintyMult
	if spread < 0.18 {
		spread = 0.18 // floor: never imply more precision than a year out allows
	}
	if spread > 0.85 {
		spread = 0.85
	}
	// Momentum tilts the base path: a segment trading faster than its own 90-day
	// rate is given a modest upgrade, and vice versa.
	if count31_90 > 0 {
		recentRate := float64(count30) / 30.0
		priorRate := float64(count31_90) / 60.0
		if priorRate > 0 {
			tilt := math.Log(recentRate/priorRate) * 0.10
			baseMultiplier *= math.Exp(math.Max(-0.12, math.Min(0.12, tilt)))
		}
	}

	baseTON := AestheticRound(expectedTON * baseMultiplier)
	bullTON := AestheticRound(expectedTON * baseMultiplier * math.Exp(spread))
	bearTON := AestheticRound(expectedTON * baseMultiplier * math.Exp(-spread))

	projectedGrowth := ProjectedGrowthDto{
		BullTON: bullTON,
		BaseTON: baseTON,
		BearTON: bearTON,
		BullUSD: math.Round(bullTON * tonRate),
		BaseUSD: math.Round(baseTON * tonRate),
		BearUSD: math.Round(bearTON * tonRate),
	}

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

	// ── Step 4.5: Populate New Report Fields ──
	dictData := GetDictionaryDetails(username)

	liveMarket := buildLiveMarket(username, marketItem, liveStatus, expectedTON, tonRate)
	marketContext := s.getMarketContext(ctx)
	bestSaleDay, bestSaleHour := deriveBestListingWindow(exactSales)
	priceBasis := &PriceBasisDto{
		TargetSales: len(targetSales),
		ExactSales:  len(exactSales),
		BroadSales:  len(broadSales),
		AnchorUsed:  len(scrapedSales) > 0 || highestPastSale > 0,
		LiveAskUsed: marketappPrice > 0,
		Method: func() string {
			switch {
			case len(targetSales) > 0:
				return "prior_sales_of_this_username"
			case len(exactSales) >= 5:
				return "comparable_sales_same_length"
			case len(broadSales) > 0:
				return "segment_comparables_shrunk_to_prior"
			default:
				return "length_prior_only"
			}
		}(),
	}

	// Similar usernames (we'll just use Levenshtein from cache, if available, or empty)
	// Because ValuationService doesn't have AnalysisService attached directly, we'll construct a quick fallback or we could use the global pool if exported.
	// We'll leave similar empty for now and let the handler populate it, or populate it here if we expose a helper in similar.go.
	// Actually, we can export `similarCandidatePool` as `GetSimilarCandidates` in similar.go and use it here. But simpler to just leave empty array if we don't have access.
	// Let's assume we return an empty array for Similar for now, and populate it properly in the handler.
	var similarNames []ValuationSimilar

	hasPastSale := false
	if highestPastSale > 0 {
		hasPastSale = true
	}

	// ── Step 4.6: Populate Structure and SEO ──
	structureResult := ValuationStructure{
		HasDigits:     false,
		LettersOnly:   true,
		HasUnderscore: false,
	}
	if regexp.MustCompile(`\d`).MatchString(username) {
		structureResult.HasDigits = true
		structureResult.LettersOnly = false
	}
	if strings.Contains(username, "_") {
		structureResult.HasUnderscore = true
		structureResult.LettersOnly = false
	}

	// Calculate analytical SEO Score based on frequency data and composition
	// Rather than using arbitrary +/- numbers, we map frequency and structural purity to a 1-100 metric.
	seoScore := 0

	// Base score from length (shorter is generally higher search intent / more generic)
	if charLen <= 4 {
		seoScore = 80
	} else if charLen <= 6 {
		seoScore = 60
	} else if charLen <= 8 {
		seoScore = 40
	} else {
		seoScore = 20
	}

	// Add bonus for dictionary matches (Global Search Potential)
	if dictData.IsWord {
		seoScore += 30
		// High frequency words have massive global search volume
		// (Assume logic for checking frequency exists in dictData or similar context)
	}

	// Penalize complex structures which are rarely typed in searches
	if structureResult.HasUnderscore {
		seoScore -= 20
	}
	if structureResult.HasDigits {
		seoScore -= 10
	}

	// Cap the final analytical score
	if seoScore < 5 {
		seoScore = 5
	}
	if seoScore > 98 {
		seoScore = 98
	}

	seoVerdict := "Low Search Potential"
	if seoScore >= 80 {
		seoVerdict = "Global Keyword Level"
	} else if seoScore >= 60 {
		seoVerdict = "High Search Potential"
	} else if seoScore >= 40 {
		seoVerdict = "Moderate Interest"
	}

	seoResult := ValuationSEO{
		Score:   seoScore,
		Verdict: seoVerdict,
	}

	var historyTransactions []ValuationHistoryItem
	seenTx := make(map[string]bool)

	// 1. Live scraped sales from Fragment HTML scraper
	for _, ss := range scrapedSales {
		key := fmt.Sprintf("%.0f_%s", ss.PriceTON, ss.SaleDate.Format("2006-01-02"))
		if !seenTx[key] {
			seenTx[key] = true
			if highestPastSale == 0 && ss.PriceTON > 0 {
				highestPastSale = ss.PriceTON
			}
			historyTransactions = append(historyTransactions, ValuationHistoryItem{
				SalePriceTON: fmt.Sprintf("%.0f", ss.PriceTON),
				Date:         ss.SaleDate,
				Buyer:        "Fragment Auction",
			})
		}
	}

	// 2. Postgres Database sales
	for _, sale := range targetSales {
		priceStr := "Transferred"
		fPrice := 0.0
		if sale.SalePriceTON.GreaterThan(decimal.Zero) {
			priceStr = sale.SalePriceTON.String()
			fPrice, _ = sale.SalePriceTON.Float64()
			if highestPastSale == 0 && fPrice > 0 {
				highestPastSale = fPrice
			}
		}
		key := fmt.Sprintf("%.0f_%s", fPrice, sale.SaleDate.Format("2006-01-02"))
		if !seenTx[key] {
			seenTx[key] = true
			buyer := "Fragment"
			if sale.BuyerAddress != nil && *sale.BuyerAddress != "" {
				buyer = *sale.BuyerAddress
			}
			historyTransactions = append(historyTransactions, ValuationHistoryItem{
				SalePriceTON: priceStr,
				Date:         sale.SaleDate,
				Buyer:        buyer,
			})
		}
	}

	// 3. HistoricalSales in-memory verified dataset
	if hardcodedPrice, ok := HistoricalSales[strings.ToLower(username)]; ok && hardcodedPrice > 0 {
		key := fmt.Sprintf("%.0f_2022-11-01", hardcodedPrice)
		if !seenTx[key] {
			seenTx[key] = true
			if highestPastSale == 0 {
				highestPastSale = hardcodedPrice
			}
			historyTransactions = append(historyTransactions, ValuationHistoryItem{
				SalePriceTON: fmt.Sprintf("%.0f", hardcodedPrice),
				Date:         time.Date(2022, 11, 1, 0, 0, 0, 0, time.UTC),
				Buyer:        "Fragment Primary Sale",
			})
		}
	}

	// 4. Try TonAPI as additional source if available
	if os.Getenv("TONAPI_KEY") != "" || os.Getenv("TONAPI_KEYS") != "" {
		tonapiClient := tonapi.NewClient()
		subCtx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
		bidsResp, errBids := tonapiClient.GetFragmentBids(subCtx, username+".t.me")
		cancel()
		if errBids == nil && bidsResp != nil && len(bidsResp.Data) > 0 {
			for _, bid := range bidsResp.Data {
				if !bid.Success {
					continue
				}
				priceTON := float64(bid.Value) / 1e9
				key := fmt.Sprintf("%.0f_%d", priceTON, bid.TxTime)
				if !seenTx[key] {
					seenTx[key] = true
					if priceTON > highestPastSale {
						highestPastSale = priceTON
					}
					historyTransactions = append(historyTransactions, ValuationHistoryItem{
						SalePriceTON: fmt.Sprintf("%.0f", priceTON),
						Date:         time.Unix(bid.TxTime, 0).UTC(),
						Buyer:        bid.Bidder.Address,
					})
				}
			}
		}
	}

	if len(historyTransactions) > 0 {
		hasPastSale = true
	}

	similarNames = s.GenerateSemanticSimilarUsernames(ctx, username, tonRate)

	history := ValuationHistory{
		IsSold:             hasPastSale,
		OwnerAddress:       ownerAddress,
		HighestPastSaleTON: highestPastSale,
		Transactions:       historyTransactions,
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
		Tags:      semResult.Tags,
		Length:    int(charLen),
		Structure: structureResult,
		SEO:       seoResult,
		Dictionary: DictionaryData{
			IsWord:       dictData.IsWord || (semResult != nil && semResult.WordFreqScore > 20),
			PartOfSpeech: dictData.PartOfSpeech,
			Definition:   dictData.Definition,
		},
		History: history,
		Similar: similarNames,
		// Enhanced Valuation & Intelligence metrics
		LiquidityRating:    liquidityRating,
		EstimatedSellTime:  estimatedSellTime,
		TargetBuyerProfile: targetBuyerProfile,
		ProjectedGrowth:    projectedGrowth,

		// New fields populated
		InvestmentGrade: func() string {
			if expectedTON > 50000 {
				return "A+"
			}
			if expectedTON > 10000 {
				return "A"
			}
			if expectedTON > 1000 {
				return "B"
			}
			if expectedTON > 100 {
				return "C"
			}
			return "D"
		}(),
		QualityGrade: func() string {
			g, _ := CalculateQualityGrade(expectedTON)
			return g
		}(),
		PercentileRank: func() float64 {
			_, p := CalculateQualityGrade(expectedTON)
			return p
		}(),
		RiskAudit: func() *RiskAuditDto {
			hasHg, hgMsg := CheckHomoglyphRisk(username)
			hasTm, tmDetail := CheckTrademarkRisk(username)
			return &RiskAuditDto{
				HasHomoglyphRisk: hasHg,
				HomoglyphMessage: hgMsg,
				IsScamOrFake:     false,
				HasTrademarkRisk: hasTm,
				TrademarkDetail:  tmDetail,
				TonDnsSynergy:    "available",
			}
		}(),
		TransactionEconomics: &TransactionEconomicsDto{
			NetPayoutTON:   math.Round((expectedTON*0.95)*100) / 100,
			NetPayoutUSD:   math.Round((ToFloat64(expectedUSD)*0.95)*100) / 100,
			FragmentFeeTON: math.Round((expectedTON*0.05)*100) / 100,
			FragmentFeePct: 5.0,
			MinBidTON:      math.Max(5, math.Round(expectedTON*0.6)),
			BidStepTON:     math.Max(5, math.Round(expectedTON*0.05)),
		},
		Comparables: func() []ComparableSaleDto {
			var comps []ComparableSaleDto
			for i, s := range targetSales {
				if i >= 5 {
					break
				}
				comps = append(comps, ComparableSaleDto{
					Username:     s.Username,
					Price:        ToFloat64(s.SalePriceTON),
					Date:         s.SaleDate.Format(time.RFC3339),
					TonviewerUrl: fmt.Sprintf("https://tonviewer.com/nft/%s", strings.TrimPrefix(s.Username, "@")),
				})
			}
			return comps
		}(),
		PriceTrend: func() []PriceTrendDto {
			var trends []PriceTrendDto
			// 30-day momentum
			if count30 > 0 {
				trends = append(trends, PriceTrendDto{Label: "30d Volume", Value: float64(count30)})
			} else {
				trends = append(trends, PriceTrendDto{Label: "30d Volume", Value: 0})
			}
			// 31-90 day momentum
			if count31_90 > 0 {
				trends = append(trends, PriceTrendDto{Label: "90d Volume", Value: float64(count31_90)})
			} else {
				trends = append(trends, PriceTrendDto{Label: "90d Volume", Value: 0})
			}
			// Price ratio
			if priceTrend > 0 && priceTrend != 1.0 {
				// E.g., if priceTrend is 1.5, it means recent prices are 50% higher than older ones
				ratioPerc := (priceTrend - 1.0) * 100.0
				trends = append(trends, PriceTrendDto{Label: "Price Action", Value: math.Round(ratioPerc*10) / 10})
			} else {
				trends = append(trends, PriceTrendDto{Label: "Price Action", Value: 0})
			}
			return trends
		}(),
		Brandability: func() int {
			b := 30
			if dictData.IsWord {
				b += 30
			}
			if charLen <= 5 {
				b += 20
			}
			if !features.HasNumbers && !features.HasUnderscore {
				b += 20
			}
			return b
		}(),
		FearGreedIndex: fngIndex,
		FearGreedLabel: fngClass,
		WikipediaSummary: func() string {
			if semResult != nil && semResult.WikiDescription != "" {
				return semResult.WikiDescription
			}
			if semResult != nil && semResult.AIReason != "" {
				return semResult.AIReason
			}
			if dictData.Definition != "" {
				return dictData.Definition
			}
			return fmt.Sprintf("High-value Telegram username @%s with strong brand recognition and commercial appeal.", username)
		}(),
		RarityBreakdown: map[string]int{
			"Length Bonus": func() int {
				if charLen <= 5 {
					return 1000
				}
				return 0
			}(),
			"Dictionary Bonus": func() int {
				if dictData.IsWord {
					return 2000
				}
				return 0
			}(),
			"Clean Structure": func() int {
				if !features.HasUnderscore && !features.HasNumbers {
					return 300
				}
				return 0
			}(),
		},
		// Portfolio & Contact features.
		// Returns nil (instead of an empty shell) when the wallet holds nothing we
		// can verify, so the client can hide the section rather than fill it with
		// placeholder values.
		Portfolio: func() *PortfolioDto {
			if ownerAddress == "" || s.db == nil {
				return nil
			}
			sales, err := s.db.GetSalesByBuyerAddress(ctx, ownerAddress)
			if err != nil || len(sales) == 0 {
				return nil
			}
			var items []PortfolioItemDto
			var totalTON float64
			lowerU := strings.ToLower(username)
			for _, item := range sales {
				// The queried handle must never appear inside its own portfolio list.
				if strings.EqualFold(item.Username, lowerU) {
					continue
				}
				pTON := ToFloat64(item.SalePriceTON)
				totalTON += pTON
				dateStr := item.SaleDate.Format("2006-01-02")
				items = append(items, PortfolioItemDto{
					Username:               item.Username,
					Status:                 item.SaleType,
					LastSaleTON:            &pTON,
					LastSaleDate:           &dateStr,
					SaleSource:             "fragment_history",
					AcquiredByCurrentOwner: true,
					AcquisitionCostTON:     &pTON,
				})
			}
			if len(items) == 0 {
				return nil
			}
			return &PortfolioDto{
				OwnerAddress:            ownerAddress,
				TotalCount:              len(items),
				TotalLastSaleTON:        totalTON,
				TotalLastSaleUSD:        math.Round(totalTON * tonRate),
				TotalAcquisitionCostTON: totalTON,
				PricedItems:             len(items),
				Items:                   items,
			}
		}(),
		// OwnerProfile is left nil here on purpose. It used to be pre-filled with
		// the queried handle itself, which the UI then rendered as "the owner's
		// Telegram account". Only a real MTProto resolution may populate it.
		OwnerProfile: nil,

		// Wallet & Entity Intelligence.
		// NFTCount/Balance are filled in by the handler once the real on-chain
		// portfolio is known; only IsWhale is pre-seeded from the price tier.
		WalletInfo: &WalletInfoDto{
			IsWhale: expectedTON >= 20000,
		},
		// Members used to be a fabricated subscriber count (45,000 for any
		// dictionary word). We do not have a real audience figure here, so the
		// field is left at zero rather than invented.
		EntityInfo: &EntityInfoDto{
			Type:     func() string { if dictData.IsWord { return "Brand / Corporate" }; return "Individual Creator" }(),
			Verified: dictData.IsWord || charLen <= 4,
		},

		// 🚀 5 New Intelligence Engines
		LiquidityMetrics: &LiquidityMetricsDto{
			Score: func() int {
				if dictData.IsWord && charLen <= 5 {
					return 92
				}
				if charLen <= 5 {
					return 85
				}
				return 68
			}(),
			EstimatedDays: func() string {
				if charLen <= 5 {
					return "1-3 Days"
				}
				return "3-7 Days"
			}(),
		},
		CrossPlatform: &CrossPlatformDto{
			Twitter:   true,
			Instagram: true,
			Github:    dictData.IsWord,
			Web3:      charLen <= 5,
		},
		AuctionPlaybook: &AuctionPlaybookDto{
			StartPriceTON: math.Round(expectedTON * 0.7),
			BidStepTON:    math.Max(5, math.Round(expectedTON*0.05)),
			// BestDay/BestHourUTC are intentionally left empty: they used to be
			// hardcoded to "Thursday 18:00" for every username in the world, which
			// is not a finding. They are populated only when the comparable set is
			// large enough to actually show a timing pattern.
			BestDay:     bestSaleDay,
			BestHourUTC: bestSaleHour,
		},
		PhishingThreat: &PhishingThreatDto{
			HasThreat: false,
			RiskLevel: "LOW",
		},
		// Demand signal derived from real segment momentum (last 30 days versus the
		// preceding 60), not a constant.
		SearchTrend:   buildSearchTrend(count30, count31_90),
		LiveMarket:    liveMarket,
		MarketContext: marketContext,
		PriceBasis:    priceBasis,
	}, nil
}

// buildSearchTrend converts raw segment momentum counts into a demand signal.
// Returns nil when there is not enough trading activity to say anything.
func buildSearchTrend(count30, count31_90 int) *SearchTrendDto {
	if count30 == 0 && count31_90 == 0 {
		return nil
	}
	recentRate := float64(count30) / 30.0
	priorRate := float64(count31_90) / 60.0
	if priorRate <= 0 {
		if count30 == 0 {
			return nil
		}
		return &SearchTrendDto{SurgePercent: 100, Status: "New Activity"}
	}

	surge := int(math.Round(((recentRate / priorRate) - 1) * 100))
	status := "Stable Demand"
	switch {
	case surge >= 50:
		status = "Demand Surging"
	case surge >= 15:
		status = "Demand Rising"
	case surge <= -50:
		status = "Demand Collapsing"
	case surge <= -15:
		status = "Demand Cooling"
	}
	return &SearchTrendDto{SurgePercent: surge, Status: status}
}

// deriveBestListingWindow finds the weekday and UTC hour that historically saw the
// highest sale prices in the comparable set. It returns empty strings unless there
// are enough sales for the pattern to mean anything.
func deriveBestListingWindow(sales []repository.Sale) (day string, hour string) {
	const minSales = 12
	if len(sales) < minSales {
		return "", ""
	}

	dayTotals := map[time.Weekday]float64{}
	dayCounts := map[time.Weekday]int{}
	hourTotals := map[int]float64{}
	hourCounts := map[int]int{}

	for _, sale := range sales {
		if sale.SaleDate.IsZero() {
			continue
		}
		price := ToFloat64(sale.SalePriceTON)
		if price <= 0 {
			continue
		}
		utc := sale.SaleDate.UTC()
		dayTotals[utc.Weekday()] += price
		dayCounts[utc.Weekday()]++
		hourTotals[utc.Hour()] += price
		hourCounts[utc.Hour()]++
	}

	bestDayAvg, bestHourAvg := 0.0, 0.0
	var bestDay time.Weekday
	bestHour := -1
	for d, total := range dayTotals {
		if avg := total / float64(dayCounts[d]); avg > bestDayAvg {
			bestDayAvg, bestDay = avg, d
		}
	}
	for h, total := range hourTotals {
		if avg := total / float64(hourCounts[h]); avg > bestHourAvg {
			bestHourAvg, bestHour = avg, h
		}
	}

	if bestDayAvg == 0 || bestHour < 0 {
		return "", ""
	}
	return bestDay.String(), fmt.Sprintf("%02d:00", bestHour)
}

// The backtest scans the full run/sale history, so it is computed at most once
// per hour and shared across requests.
var (
	accuracyMu      sync.RWMutex
	accuracyCache   *ModelAccuracyDto
	accuracyExpires time.Time
)

const modelAccuracyTTL = time.Hour

// GetModelAccuracy measures how the current model version has actually performed:
// the median absolute percentage error against sales that happened after each
// prediction, and how often the real price landed inside the published range.
//
// Returns nil until there are enough matched pairs for the figure to mean
// anything — a "100% accurate" badge off three samples is worse than no badge.
func (s *ValuationService) GetModelAccuracy(ctx context.Context) *ModelAccuracyDto {
	const minSamples = 20

	accuracyMu.RLock()
	cached, expires := accuracyCache, accuracyExpires
	accuracyMu.RUnlock()
	if cached != nil && time.Now().Before(expires) {
		return cached
	}
	if s.db == nil {
		return cached
	}

	bCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	points, err := s.db.GetBacktestPoints(bCtx, ModelVersion, 2000)
	if err != nil {
		slog.Warn("AVM backtest query failed", "error", err)
		return cached
	}
	if len(points) < minSamples {
		return nil
	}

	errors := make([]float64, 0, len(points))
	inBand := 0
	for _, p := range points {
		errors = append(errors, math.Abs(p.PredictedTON-p.ActualTON)/p.ActualTON*100)
		if p.WithinBand {
			inBand++
		}
	}
	sort.Float64s(errors)

	median := errors[len(errors)/2]
	if len(errors)%2 == 0 {
		median = (errors[len(errors)/2-1] + errors[len(errors)/2]) / 2
	}

	fresh := &ModelAccuracyDto{
		SampleSize:     len(points),
		MedianErrorPct: math.Round(median*10) / 10,
		WithinBandPct:  math.Round(float64(inBand) / float64(len(points)) * 1000) / 10,
		EvaluatedAt:    time.Now().UTC().Format(time.RFC3339),
	}

	accuracyMu.Lock()
	accuracyCache = fresh
	accuracyExpires = time.Now().Add(modelAccuracyTTL)
	accuracyMu.Unlock()

	return fresh
}

// Collection-wide stats are identical for every username and change slowly, so
// they are fetched once and shared rather than re-requested per valuation.
var (
	marketContextMu      sync.RWMutex
	marketContextCache   *MarketContextDto
	marketContextExpires time.Time
)

const marketContextTTL = 5 * time.Minute

// getMarketContext returns collection-wide market stats, or nil when the upstream
// is unavailable. It never blocks a valuation for long and never fails it.
func (s *ValuationService) getMarketContext(ctx context.Context) *MarketContextDto {
	marketContextMu.RLock()
	cached, expires := marketContextCache, marketContextExpires
	marketContextMu.RUnlock()
	if cached != nil && time.Now().Before(expires) {
		return cached
	}

	if s.marketappClient == nil {
		return cached
	}

	cCtx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer cancel()

	data, err := s.marketappClient.GetCollection(cCtx)
	if err != nil || data == nil {
		// Serve the stale value rather than nothing.
		return cached
	}

	fresh := &MarketContextDto{
		FloorPriceTON:  data.FloorPrice,
		Volume24hTON:   data.Volume24h,
		TotalVolumeTON: data.TotalVolume,
		SalesCount:     data.SalesCount,
		ListedRatio:    data.ListedRatio,
		ActiveAuctions: data.ActiveAuctions,
		TotalOwners:    data.TotalOwners,
		ItemsCount:     data.ItemsCount,
		HighestSaleTON: data.HighestSale,
	}

	marketContextMu.Lock()
	marketContextCache = fresh
	marketContextExpires = time.Now().Add(marketContextTTL)
	marketContextMu.Unlock()

	return fresh
}

// normalizeMarketStatus maps the various vocabularies used by Marketapp and
// Fragment onto the single set the client renders.
func normalizeMarketStatus(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "auction", "on_auction", "active_auction":
		return "on_auction"
	case "sale", "on_sale", "for_sale", "buy_now", "listed", "purchase_available":
		return "on_sale"
	case "sold", "taken", "owned", "occupied", "not_for_sale":
		return "taken"
	case "available", "free":
		return "available"
	default:
		return ""
	}
}

// parseMarketTime accepts the handful of timestamp shapes Marketapp returns and
// normalises them to RFC3339. An unparseable value yields "" rather than a
// misleading date.
func parseMarketTime(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02 15:04:05", "2006-01-02"} {
		if ts, err := time.Parse(layout, raw); err == nil {
			return ts.UTC().Format(time.RFC3339)
		}
	}
	// Unix seconds
	if secs, err := strconv.ParseInt(raw, 10, 64); err == nil && secs > 1_000_000_000 {
		return time.Unix(secs, 0).UTC().Format(time.RFC3339)
	}
	return ""
}

// buildLiveMarket assembles the current, actionable market state. It returns a
// value even when no marketplace data was reachable, because the Fragment and
// t.me links are always useful.
func buildLiveMarket(username string, item *marketapp.ItemData, fragmentStatus string, expectedTON, tonRate float64) *LiveMarketDto {
	lm := &LiveMarketDto{
		Status:      normalizeMarketStatus(fragmentStatus),
		FragmentURL: "https://fragment.com/username/" + username,
		TelegramURL: "https://t.me/" + username,
		CheckedAt:   time.Now().UTC().Format(time.RFC3339),
	}

	if item != nil {
		if st := normalizeMarketStatus(item.SaleStatus); st != "" {
			// Marketapp knows about listings; Fragment only knows occupancy, so a
			// concrete listing status wins over a generic "taken".
			if lm.Status == "" || lm.Status == "taken" {
				lm.Status = st
			}
		}
		if item.HighestBid > 0 {
			lm.CurrentBidTON = item.HighestBid
			lm.CurrentBidUSD = math.Round(item.HighestBid * tonRate)
		}
		if item.BuyNowPrice > 0 {
			lm.BuyNowTON = item.BuyNowPrice
			lm.BuyNowUSD = math.Round(item.BuyNowPrice * tonRate)
		}
		lm.AuctionEndsAt = parseMarketTime(item.EndTime)
		lm.MintDate = parseMarketTime(item.MintDate)
		lm.OwnerAddress = item.OwnerAddress
		lm.PreviousOwners = len(item.PreviousOwners)

		for _, sale := range item.PastSales {
			if sale.Price <= 0 {
				continue
			}
			lm.Offers = append(lm.Offers, MarketOfferDto{
				PriceTON: sale.Price,
				PriceUSD: math.Round(sale.Price * tonRate),
				Date:     parseMarketTime(sale.Date),
				From:     sale.From,
			})
			if len(lm.Offers) >= 5 {
				break
			}
		}
	}

	// How far the live ask sits from our estimate — the number a buyer actually
	// decides on.
	ask := lm.BuyNowTON
	if ask == 0 {
		ask = lm.CurrentBidTON
	}
	if ask > 0 && expectedTON > 0 {
		lm.AskVsEstimatePct = math.Round(((ask/expectedTON)-1)*1000) / 10
	}

	if lm.Status == "" {
		lm.Status = "unknown"
	}
	return lm
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
			CharLength:    int(s.CharLength),
			HasNumbers:    s.HasNumbers,
			HasUnderscore: s.HasUnderscore,
			IsDictionary:  s.IsDictionary,
		})
	}
	return comps
}

// CalculateSemanticKNNFloor finds similar high-value sold dictionary anchors for premium words
// using a 5D k-Nearest Neighbors (k-NN) vector similarity model over HistoricalSales.
func CalculateSemanticKNNFloor(username string, features MorphFeatures, semResult *SemanticResult) float64 {
	// STRICT GIBBERISH GUARD: Never elevate random gibberish (e.g. @fhhff, @xqzkw)
	if features.IsGibberish || (!features.IsDictionary && features.SemanticScore < 40) {
		return 0
	}

	lower := strings.ToLower(username)
	charLen := len(lower)

	hasNumbers := features.HasNumbers || regexp.MustCompile(`\d`).MatchString(lower)
	hasUnderscore := features.HasUnderscore || strings.Contains(lower, "_")
	isPureAlpha := !hasNumbers && !hasUnderscore

	// Penalized morph names get reduced KNN floor
	if !isPureAlpha {
		return 0
	}

	// Build 5D Feature Vector for target username:
	// v = [charLenNorm, wordFreqNorm, wikiScoreNorm, flowScoreNorm, tagWeightNorm]
	vFreq := 0.0
	vWiki := 0.0
	vFlow := features.FlowScore
	vTag := 1.0

	if semResult != nil {
		vFreq = semResult.WordFreqScore / 100.0
		vWiki = float64(semResult.WikiScore) / 100.0
		for _, tag := range semResult.Tags {
			switch tag {
			case "crypto_ultra_premium":
				vTag += 2.0
			case "exclusivity_status_premium":
				vTag += 1.8
			case "general_ultra_premium", "telegram_ecosystem":
				vTag += 1.5
			}
		}
	}

	type neighbor struct {
		priceTON float64
		dist     float64
	}

	neighbors := make([]neighbor, 0, len(HistoricalSales))

	// Iterate over all anchors in HistoricalSales to compute 5D Euclidean distance
	for anchorName, basePrice := range HistoricalSales {
		aLen := len(anchorName)
		aLenNorm := float64(aLen) / 10.0
		targetLenNorm := float64(charLen) / 10.0

		// Feature distance components
		dLen := math.Abs(targetLenNorm - aLenNorm)
		dFreq := math.Abs(vFreq - 0.50) // Baseline anchor frequency approximation
		dWiki := math.Abs(vWiki - 0.30)
		dFlow := math.Abs(vFlow - 0.70)
		dTag := 0.0

		if (strings.Contains(anchorName, "crypto") || anchorName == "ton" || anchorName == "trade") && vTag > 1.5 {
			dTag = 0.0
		} else if vTag > 1.5 {
			dTag = 0.3
		}

		// 5D Weighted Distance
		dist := math.Sqrt(3.0*dLen*dLen + 2.0*dFreq*dFreq + 1.0*dWiki*dWiki + 1.0*dFlow*dFlow + 1.5*dTag*dTag)

		// Appreciate anchor price to current date (3.7 yrs @ 20% CAGR)
		appreciatedPrice := basePrice * math.Pow(1.20, 3.7)

		neighbors = append(neighbors, neighbor{
			priceTON: appreciatedPrice,
			dist:     dist,
		})
	}

	// Sort neighbors by distance ascending
	for i := 0; i < len(neighbors); i++ {
		for j := i + 1; j < len(neighbors); j++ {
			if neighbors[j].dist < neighbors[i].dist {
				neighbors[i], neighbors[j] = neighbors[j], neighbors[i]
			}
		}
	}

	// Take top k=5 nearest neighbors
	k := 5
	if len(neighbors) < k {
		k = len(neighbors)
	}

	var weightSum, weightedPriceSum float64
	for i := 0; i < k; i++ {
		w := 1.0 / (neighbors[i].dist + 0.05)
		weightSum += w
		weightedPriceSum += w * neighbors[i].priceTON
	}

	if weightSum == 0 {
		return 0
	}

	knnEstimate := weightedPriceSum / weightSum

	// Calibrate KNN estimate by character length category
	if charLen == 3 {
		return math.Min(knnEstimate, 3500000.0)
	} else if charLen == 4 {
		return math.Min(knnEstimate, 1500000.0)
	} else if charLen == 5 {
		return math.Min(knnEstimate, 300000.0)
	}

	return math.Min(knnEstimate, 100000.0)
}

// GenerateSemanticSimilarUsernames generates concept-equivalent & semantically similar usernames
// along with their historical or estimated sale prices.
func (s *ValuationService) GenerateSemanticSimilarUsernames(ctx context.Context, targetUsername string, tonRate float64) []ValuationSimilar {
	u := strings.ToLower(strings.TrimPrefix(targetUsername, "@"))

	semanticMap := map[string][]struct{ Name, Reason string }{
		"cars": {
			{"auto", "Automotive Category Benchmark"},
			{"vehicle", "Transport Category"},
			{"motors", "Motor Brand Concept"},
			{"wheels", "Automotive Concept"},
			{"drive", "Action & Transport"},
		},
		"car": {
			{"auto", "Automotive Category Benchmark"},
			{"vehicle", "Transport Category"},
			{"motors", "Motor Brand Concept"},
			{"drive", "Action & Transport"},
		},
		"rare": {
			{"unique", "Rarity & Exclusivity Concept"},
			{"scarce", "Rarity Concept"},
			{"limited", "Status Benchmark"},
			{"exclusive", "Exclusivity Tier"},
			{"grail", "Legendary Tier"},
		},
		"pubg": {
			{"clashofclans", "Top Mobile Game Benchmark"},
			{"fortnite", "Esports & Gaming Legend"},
			{"roblox", "Gaming Platform"},
			{"apex", "Esports Category"},
			{"dota", "Gaming Legend"},
		},
		"tiktok": {
			{"instagram", "Social Media Giant"},
			{"youtube", "Video Platform Giant"},
			{"reels", "Short Video Brand"},
			{"shorts", "Video Concept"},
			{"social", "Media Category"},
		},
		"chatgpt": {
			{"gemini", "AI Model Competitor"},
			{"claude", "AI Model Competitor"},
			{"copilot", "AI Assistant Brand"},
			{"openai", "Parent AI Organization"},
			{"ai", "Core Tech Category"},
		},
		"bitcoin": {
			{"ethereum", "Tier-1 Crypto Benchmark"},
			{"solana", "Top Blockchain Handle"},
			{"crypto", "Category Name"},
			{"btc", "Ticker Equivalent"},
			{"usdt", "Stablecoin Benchmark"},
		},
		"btc": {
			{"bitcoin", "Full Name Equivalent"},
			{"eth", "Ticker Equivalent"},
			{"crypto", "Category Name"},
			{"sol", "Ticker Equivalent"},
		},
		"ton": {
			{"wallet", "Official System Handle"},
			{"stars", "Ecosystem Currency"},
			{"notcoin", "Ecosystem Legend"},
			{"gram", "Legacy Ecosystem Name"},
		},
	}

	var candidates []struct{ Name, Reason string }
	if list, ok := semanticMap[u]; ok {
		candidates = list
	} else {
		if strings.Contains(u, "car") || strings.Contains(u, "auto") || strings.Contains(u, "drive") || strings.Contains(u, "moto") {
			candidates = []struct{ Name, Reason string }{
				{"auto", "Automotive Category Benchmark"},
				{"vehicle", "Transport Category"},
				{"motors", "Motor Brand Concept"},
				{"drive", "Action & Transport"},
			}
		} else if strings.Contains(u, "game") || strings.Contains(u, "play") {
			candidates = []struct{ Name, Reason string }{
				{"game", "Gaming Category Benchmark"},
				{"play", "Gaming Action Concept"},
				{"clashofclans", "Mobile Gaming Legend"},
				{"fortnite", "Esports Legend"},
			}
		} else if strings.Contains(u, "bot") || strings.Contains(u, "ai") || strings.Contains(u, "gpt") {
			candidates = []struct{ Name, Reason string }{
				{"chatgpt", "AI Revolution Benchmark"},
				{"gemini", "AI Competitor Concept"},
				{"claude", "AI Model Concept"},
				{"copilot", "AI Assistant Brand"},
			}
		} else if strings.Contains(u, "coin") || strings.Contains(u, "pay") || strings.Contains(u, "bank") || strings.Contains(u, "cash") {
			candidates = []struct{ Name, Reason string }{
				{"bank", "Financial Giant Benchmark"},
				{"cash", "Currency Category"},
				{"coin", "Crypto & Cash Category"},
				{"trade", "Official Trading Service"},
			}
		} else {
			if len(u) <= 4 {
				candidates = []struct{ Name, Reason string }{
					{"vip", "3-Letter Premium Category"},
					{"gem", "Short Premium Word"},
					{"king", "Short Status Handle"},
					{"gold", "Precious Category"},
				}
			} else {
				candidates = []struct{ Name, Reason string }{
					{"premium", "Commercial Category"},
					{"unique", "High-Rarity Synonym"},
					{"limited", "Exclusivity Benchmark"},
					{"developer", "Tech Industry Category"},
				}
			}
		}
	}

	result := make([]ValuationSimilar, 0, len(candidates))
	for _, cand := range candidates {
		if cand.Name == u {
			continue
		}
		// Status is intentionally left empty: this generator knows nothing about
		// occupancy, and defaulting to "available" advertised handles like "auto"
		// or "bitcoin" as free to register. The handler resolves it for real.
		result = append(result, ValuationSimilar{
			Username: cand.Name,
			Reason:   cand.Reason,
		})
	}

	// Price enrichment runs concurrently under a single shared deadline. Doing it
	// sequentially meant up to 5 × 2s of Fragment scraping inside the valuation
	// request.
	enrichCtx, cancelEnrich := context.WithTimeout(ctx, 2500*time.Millisecond)
	defer cancelEnrich()

	fragClient := s.fragmentClient
	if fragClient == nil {
		fragClient = fragment.NewClient()
	}

	var wg sync.WaitGroup
	for i := range result {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			candName := result[idx].Username

			setSold := func(priceTON float64, date, source string) {
				result[idx].SalePrice = priceTON
				result[idx].SalePriceUSD = math.Round(priceTON * tonRate)
				result[idx].SaleDate = date
				result[idx].PriceSource = source
				result[idx].Status = "sold"
			}

			// 1. Database sale records first — they carry a real, dated price.
			if s.db != nil {
				if dbSales, err := s.db.GetSalesByUsername(enrichCtx, candName); err == nil && len(dbSales) > 0 {
					if p := ToFloat64(dbSales[0].SalePriceTON); p > 0 {
						setSold(p, dbSales[0].SaleDate.Format("2006-01-02"), "db_sale")
						return
					}
				}
			}

			// 2. HistoricalSales anchor dataset, reported as-is. The previous code
			//    multiplied the anchor by 1.975 and stamped every entry with a
			//    hardcoded "2023-03-15" date, surfacing invented figures under a
			//    "VERIFIED SALE" badge.
			if p, ok := HistoricalSales[candName]; ok && p > 0 {
				setSold(p, "", "archive_anchor")
				return
			}

			// 3. Last resort: scrape Fragment for a recorded sale.
			if enrichCtx.Err() != nil {
				return
			}
			if scrapedSales, err := fragClient.GetHistoricalSales(enrichCtx, candName); err == nil && len(scrapedSales) > 0 {
				if p := scrapedSales[0].PriceTON; p > 0 {
					setSold(p, scrapedSales[0].SaleDate.Format("2006-01-02"), "fragment_history")
				}
			}
		}(i)
	}
	wg.Wait()

	return result
}
