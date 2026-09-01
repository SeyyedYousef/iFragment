package gvengine

import (
	"time"

	"github.com/shopspring/decimal"
	"ifragment-backend/internal/service/gifts/crafting"
	"ifragment-backend/internal/service/gifts/risk"
	"ifragment-backend/internal/service/gifts/starsrate"
	"ifragment-backend/internal/service/gifts/traits"
	"ifragment-backend/internal/service/gifts/upgrade"
	"ifragment-backend/internal/service/gifts/venues"
)

// CuriosityGateResponse is the zero price leakage response (Sacred Rule 3)
type CuriosityGateResponse struct {
	GiftID           string  `json:"gift_id"`
	ModelID          string  `json:"model_id"`
	ModelName        string  `json:"model_name"`
	SerialNumber     int     `json:"serial_number"`
	SelectedModel    string  `json:"selected_model,omitempty"`
	OwnerName        string  `json:"owner_name,omitempty"`
	ImageURL         string  `json:"image_url,omitempty"`
	SignalsAnalyzed  int     `json:"signals_analyzed"`   // e.g. 34 signals
	RisksIdentified  int     `json:"risks_identified"`   // e.g. 2 risks
	DataSourcesCount int     `json:"data_sources_count"` // 6 venues + Telegram on-chain
	IsCrafted        bool    `json:"is_crafted"`
	FloorPriceGRAM   float64 `json:"floor_price_gram"` // Public floor data is permissible
	FloorPriceUSD    float64 `json:"floor_price_usd"`
	CheckedAt        string  `json:"checked_at"`
}

// TraitDNABar holds the 4-axis attribute rarity representation
type TraitDNABar struct {
	AxisKey        string                    `json:"axis_key"`        // "model", "backdrop", "symbol", "serial"
	LabelEn        string                    `json:"label_en"`
	LabelFa        string                    `json:"label_fa"`
	Value          string                    `json:"value"`
	Percentile     float64                   `json:"percentile"`      // Top X%
	RarityTier     string                    `json:"rarity_tier"`     // Legendary, Epic, Rare, Uncommon, Common
	CertaintyLevel string                    `json:"certainty_level"` // "exact" (Blue), "measured" (Green), "estimated" (Yellow)
	Colors         *traits.BackdropColorSet  `json:"colors,omitempty"`
	Description    string                    `json:"description"`
}

// ComparableGiftSale represents a similar historical trade
type ComparableGiftSale struct {
	GiftID          string    `json:"gift_id"`
	ModelID         string    `json:"model_id"`
	SerialNumber    int       `json:"serial_number"`
	Venue           string    `json:"venue"`
	SalePriceGRAM   float64   `json:"sale_price_gram"`
	SalePriceUSD    float64   `json:"sale_price_usd"`
	SaleDate        time.Time `json:"sale_date"`
	BackdropName    string    `json:"backdrop_name"`
	DiffPercent     float64   `json:"diff_percent"`
	TonviewerURL    string    `json:"tonviewer_url"`
}

// GrowthProjection holds the 12-month forward simulation
type GrowthProjection struct {
	BullGRAM float64 `json:"bull_gram"`
	BullUSD  float64 `json:"bull_usd"`
	BaseGRAM float64 `json:"base_gram"`
	BaseUSD  float64 `json:"base_usd"`
	BearGRAM float64 `json:"bear_gram"`
	BearUSD  float64 `json:"bear_usd"`
}

// ValuationActionVerdict holds actionable decision advice
type ValuationActionVerdict struct {
	Verdict        string  `json:"verdict"` // "HOLD", "SELL_NOW", "CRAFT_FORGE", "UPGRADE"
	ConfidenceTier string  `json:"confidence_tier"`
	BestVenueID    string  `json:"best_venue_id"`
	ExpectedNetGRAM float64 `json:"expected_net_gram"`
	SummaryEn      string  `json:"summary_en"`
	SummaryFa      string  `json:"summary_fa"`
}

// GiftValuation is the complete quantitative valuation artifact for a Telegram Gift
type GiftValuation struct {
	RunID              int64                          `json:"run_id"`
	GiftID             string                         `json:"gift_id"`
	ModelID            string                         `json:"model_id"`
	ModelName          string                         `json:"model_name"`
	SerialNumber       int                            `json:"serial_number"`
	SelectedModel      string                         `json:"selected_model,omitempty"`
	OwnerName          string                         `json:"owner_name,omitempty"`
	ImageURL           string                         `json:"image_url,omitempty"`
	DisplayTitle       string                         `json:"display_title"` // e.g. "Plush Pepe #42"
	ModelVersion       string                         `json:"model_version"`
	BasePriceGRAM      decimal.Decimal                `json:"base_price_gram"`
	LowGRAM            decimal.Decimal                `json:"low_gram"`
	ExpectedGRAM       decimal.Decimal                `json:"expected_gram"`
	HighGRAM           decimal.Decimal                `json:"high_gram"`
	LowUSD             float64                        `json:"low_usd"`
	ExpectedUSD        float64                        `json:"expected_usd"`
	HighUSD            float64                        `json:"high_usd"`
	GRAMUSDRate        float64                        `json:"gram_usd_rate"`
	ConfidenceScore    int16                          `json:"confidence_score"`
	PriceBasis         string                         `json:"price_basis"` // direct_sales_of_this_item, trait_comps_shrunk_to_class, class_median_only
	TraitDNA           []TraitDNABar                  `json:"trait_dna"`
	AestheticHarmony   traits.AestheticHarmonyResult  `json:"aesthetic_harmony"`
	JointRarity        traits.JointRarityAnalysis     `json:"joint_rarity"`
	StarsParity        starsrate.StarsParityMetrics   `json:"stars_parity"`
	ProfileFlex        ProfileFlexReport              `json:"profile_flex"`
	ExitPlanner        *venues.ExitPlannerPlan        `json:"exit_planner"`
	CraftingEV         *crafting.CraftingEVResult     `json:"crafting_ev,omitempty"`
	MonteCarloCrafting *crafting.MonteCarloForgeResult `json:"monte_carlo_crafting,omitempty"`
	UpgradeAdvisor     *upgrade.UpgradeAdviceReport   `json:"upgrade_advisor,omitempty"`
	Comps              []ComparableGiftSale           `json:"comps"`
	RiskAudit          *risk.RiskAuditResult          `json:"risk_audit"`
	Projection         GrowthProjection               `json:"projection"`
	Recommendation     ValuationActionVerdict         `json:"recommendation"`
	CertificateID      string                         `json:"certificate_id"`
	EvaluatedAt        time.Time                      `json:"evaluated_at"`
	ReasoningLog       map[string]interface{}         `json:"reasoning_log"`
}
