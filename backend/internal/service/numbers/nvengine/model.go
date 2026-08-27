package nvengine

import (
	"time"

	"github.com/shopspring/decimal"
	"ifragment-backend/internal/service/numbers/features"
	"ifragment-backend/internal/service/numbers/registry"
)

// NumberValuation is the complete, comprehensive evaluation output of NV Engine
type NumberValuation struct {
	RunID                int64                    `json:"run_id"`
	Number               string                   `json:"number"`           // +888XXXXXXXX
	DisplayNumber        string                   `json:"display_number"`   // +888 1234 5678
	ModelVersion         string                   `json:"model_version"`
	BasePriceTON         decimal.Decimal          `json:"base_price_ton"`
	LowTON               decimal.Decimal          `json:"low_ton"`
	ExpectedTON          decimal.Decimal          `json:"expected_ton"`
	HighTON              decimal.Decimal          `json:"high_ton"`
	LowUSD               float64                  `json:"low_usd"`
	ExpectedUSD          float64                  `json:"expected_usd"`
	HighUSD              float64                  `json:"high_usd"`
	TONUSDRate           float64                  `json:"ton_usd_rate"`
	ConfidenceScore      int16                    `json:"confidence_score"` // 0 - 100
	PriceBasis           string                   `json:"price_basis"`      // direct_sales_of_this_number | pattern_comps_shrunk_to_class | class_median_only
	GlobalRank           int                      `json:"global_rank"`      // 1 to 136566
	CategoryClub         string                   `json:"category_club"`    // "4-Digit Club", "Grail Monodigit", "Binary Dual", etc.
	CollateralValueTON   float64                  `json:"collateral_value_ton"`
	CollateralValueUSD   float64                  `json:"collateral_value_usd"`
	FragmentDirectURL    string                   `json:"fragment_direct_url"`
	Features             features.FeatureVector   `json:"features"`
	RarityDNA            []RarityBar              `json:"rarity_dna"`
	Color                registry.ColorInfo       `json:"color"`
	History              ValuationHistory         `json:"history"`
	Comps                []ComparableSale         `json:"comps"`
	CulturalRadar        []CulturalScoreItem      `json:"cultural_radar"`
	Liquidity            LiquidityMetrics         `json:"liquidity"`
	RiskAudit            RiskAuditReport          `json:"risk_audit"`
	Economics            TransactionEconomics     `json:"economics"`
	Projection           GrowthProjection         `json:"projection"`
	Recommendation       ActionRecommendation     `json:"recommendation"`
	CertificateID        string                   `json:"certificate_id"`
	EvaluatedAt          time.Time                `json:"evaluated_at"`
	ReasoningLog         map[string]interface{}   `json:"reasoning_log"`
}

// DealSniperItem represents an undervalued deal on Fragment or Getgems
type DealSniperItem struct {
	Number             string  `json:"number"`
	DisplayNumber      string  `json:"display_number"`
	ListingPriceTON    float64 `json:"listing_price_ton"`
	FairValueTON       float64 `json:"fair_value_ton"`
	DiscountPercent    float64 `json:"discount_percent"`
	ProfitPotentialTON float64 `json:"profit_potential_ton"`
	Marketplace        string  `json:"marketplace"` // "Fragment" | "Getgems"
	MarketplaceURL     string  `json:"marketplace_url"`
	Color              string  `json:"color"`
	GlobalRank         int     `json:"global_rank"`
	CategoryClub       string  `json:"category_club"`
}

// CategoryClubItem represents a distinct collectible tier with dynamic floor
type CategoryClubItem struct {
	ID            string  `json:"id"`
	NameEn        string  `json:"name_en"`
	NameFa        string  `json:"name_fa"`
	Icon          string  `json:"icon"`
	FloorPriceTON float64 `json:"floor_price_ton"`
	TotalSupply   int     `json:"total_supply"`
	TopSaleTON    float64 `json:"top_sale_ton"`
	DescriptionEn string  `json:"description_en"`
	DescriptionFa string  `json:"description_fa"`
}

// WalletPortfolioResult summarizes all numbers in a connected wallet
type WalletPortfolioResult struct {
	OwnerAddress       string               `json:"owner_address"`
	TotalAssets        int                  `json:"total_assets"`
	TotalValueTON      float64              `json:"total_value_ton"`
	TotalValueUSD      float64              `json:"total_value_usd"`
	AverageRarityScore float64              `json:"average_rarity_score"`
	BestGlobalRank     int                  `json:"best_global_rank"`
	Assets             []PortfolioAssetItem `json:"assets"`
}

// PortfolioAssetItem details one owned number
type PortfolioAssetItem struct {
	Number        string  `json:"number"`
	DisplayNumber string  `json:"display_number"`
	ExpectedTON   float64 `json:"expected_ton"`
	ExpectedUSD   float64 `json:"expected_usd"`
	RarityScore   int     `json:"rarity_score"`
	GlobalRank    int     `json:"global_rank"`
	CategoryClub  string  `json:"category_club"`
	Color         string  `json:"color"`
}

// LiveActivityItem represents a real-time sale on TON
type LiveActivityItem struct {
	ID            string    `json:"id"`
	Number        string    `json:"number"`
	DisplayNumber string    `json:"display_number"`
	SalePriceTON  float64   `json:"sale_price_ton"`
	SalePriceUSD  float64   `json:"sale_price_usd"`
	SaleDate      time.Time `json:"sale_date"`
	TxHash        string    `json:"tx_hash"`
	TonviewerURL  string    `json:"tonviewer_url"`
	Marketplace   string    `json:"marketplace"`
}

// RarityBar represents an individual deterministic attribute bar
type RarityBar struct {
	Key          string  `json:"key"`           // e.g. "max_run", "distinct_digits", "symmetry"
	LabelEn      string  `json:"label_en"`
	LabelFa      string  `json:"label_fa"`
	Value        string  `json:"value"`         // e.g. "4 digits", "3 unique"
	Percentile   float64 `json:"percentile"`    // Top X% or Raw Percentile
	IsExact      bool    `json:"is_exact"`      // Always true for Closed Collection (136,566)
	Description  string  `json:"description"`
}

// ValuationHistory records on-chain sales
type ValuationHistory struct {
	IsSold             bool                  `json:"is_sold"`
	OwnerAddress       string                `json:"owner_address,omitempty"`
	NFTAddress         string                `json:"nft_address,omitempty"`
	HighestPastSaleTON float64               `json:"highest_past_sale_ton,omitempty"`
	Transactions       []HistoricalSaleEvent `json:"transactions"`
}

type HistoricalSaleEvent struct {
	PriceTON        float64   `json:"price_ton"`
	PriceUSD        float64   `json:"price_usd"`
	SaleDate        time.Time `json:"sale_date"`
	BuyerAddress    string    `json:"buyer_address"`
	SellerAddress   string    `json:"seller_address"`
	TransactionHash string    `json:"transaction_hash,omitempty"`
	Source          string    `json:"source"`
}

// ComparableSale represents a peer sale in the same market class
type ComparableSale struct {
	Number       string    `json:"number"`
	PriceTON     float64   `json:"price_ton"`
	PriceUSD     float64   `json:"price_usd"`
	SaleDate     time.Time `json:"sale_date"`
	Color        string    `json:"color"`
	TailClass    string    `json:"tail_class"`
	DiffPercent  float64   `json:"diff_percent"` // +/- % from expected
	TonviewerURL string    `json:"tonviewer_url,omitempty"`
}

// CulturalScoreItem details cultural desirability per region
type CulturalScoreItem struct {
	RegionKey     string  `json:"region_key"`
	MarketName    string  `json:"market_name"`
	Score         int     `json:"score"`         // 0 - 100
	VerdictEn     string  `json:"verdict_en"`
	VerdictFa     string  `json:"verdict_fa"`
	DescriptionEn string  `json:"description_en"`
	DescriptionFa string  `json:"description_fa"`
}

// LiquidityMetrics estimates time to liquidate on Fragment
type LiquidityMetrics struct {
	LiquidityRating    string  `json:"liquidity_rating"` // High, Medium, Low
	EstimatedSellDays  string  `json:"estimated_sell_days"`
	MedianDaysToSell   int     `json:"median_days_to_sell"`
	TargetBuyerProfile string  `json:"target_buyer_profile"`
	BidVelocityScore   float64 `json:"bid_velocity_score"`
}

// RiskAuditReport provides honest transparency on asset flags
type RiskAuditReport struct {
	OwnershipChurn     string `json:"ownership_churn"`     // "Normal (1-2 owners)", "High Velocity (Frequent Flips)"
	DistressSignal     bool   `json:"distress_signal"`     // True if listing is > 40% below expected band
	DistressMessage    string `json:"distress_message,omitempty"`
	RestrictedRisk     string `json:"restricted_risk"`     // "Low Risk", "Check Telegram Status"
	RestrictedGuide    string `json:"restricted_guide"`
	ManagementDeepLink string `json:"management_deep_link"`
}

// TransactionEconomics calculates proceeds after 5% Fragment protocol fee
type TransactionEconomics struct {
	FragmentFeePct float64 `json:"fragment_fee_pct"`
	FragmentFeeTON float64 `json:"fragment_fee_ton"`
	NetPayoutTON   float64 `json:"net_payout_ton"`
	NetPayoutUSD   float64 `json:"net_payout_usd"`
	MinBidTON      float64 `json:"min_bid_ton"`
	BidStepTON     float64 `json:"bid_step_ton"`
	BuyNowTON      float64 `json:"buy_now_ton"`
	BuyNowUSD      float64 `json:"buy_now_usd"`
}

// GrowthProjection forecasts 12-month valuations
type GrowthProjection struct {
	BullTON float64 `json:"bull_ton"`
	BullUSD float64 `json:"bull_usd"`
	BaseTON float64 `json:"base_ton"`
	BaseUSD float64 `json:"base_usd"`
	BearTON float64 `json:"bear_ton"`
	BearUSD float64 `json:"bear_usd"`
}

// ActionRecommendation gives a definitive trading action
type ActionRecommendation struct {
	Verdict        string  `json:"verdict"` // "HOLD" | "SELL_NOW" | "BUY_NOW"
	ConfidenceTier string  `json:"confidence_tier"`
	ExpectedNetTON float64 `json:"expected_net_ton"`
	SummaryEn      string  `json:"summary_en"`
	SummaryFa      string  `json:"summary_fa"`
}

// CuriosityGateResponse is the strictly locked pre-paywall payload (Sacred Rule 3)
type CuriosityGateResponse struct {
	Number           string   `json:"number"`
	DisplayNumber    string   `json:"display_number"`
	SignalsAnalyzed  int      `json:"signals_analyzed"`   // e.g. 27
	RisksIdentified  int      `json:"risks_identified"`   // e.g. 1
	DataSourcesCount int      `json:"data_sources_count"` // e.g. 4
	IsLiveListing    bool     `json:"is_live_listing"`
	LiveAskTON       *float64 `json:"live_ask_ton,omitempty"`
	ColorName        string   `json:"color_name,omitempty"`
	CheckedAt        string   `json:"checked_at"`
}
