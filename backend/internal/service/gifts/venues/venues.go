package venues

import (
	"context"
	"math"
	"sort"
	"time"
)

// VenueID identifies one of the 7 supported marketplaces
type VenueID string

const (
	VenueTelegramStars VenueID = "telegram_stars"
	VenueFragment      VenueID = "fragment"
	VenueGetgems       VenueID = "getgems"
	VenueMarketApp     VenueID = "marketapp"
	VenueTonnel        VenueID = "tonnel"
	VenuePortals       VenueID = "portals"
	VenueMRKT          VenueID = "mrkt"
)

// VenueInfo holds metadata and live trading terms for a marketplace
type VenueInfo struct {
	ID                 VenueID `json:"id"`
	Name               string  `json:"name"`
	Currency           string  `json:"currency"`             // "GRAM", "Stars", "USDT"
	ProtocolFeePct     float64 `json:"protocol_fee_pct"`     // e.g. 5.0 for 5%
	ListingFeePct      float64 `json:"listing_fee_pct"`      // e.g. 0.0
	RequiresKYC        bool    `json:"requires_kyc"`         // true for Fragment
	EscrowType         string  `json:"escrow_type"`          // "smart_contract", "telegram_escrow"
	DeepLinkBase       string  `json:"deep_link_base"`
	HasRealVolumeBadge bool    `json:"has_real_volume_badge"` // DropsTab verified 7d real volume
	Volume7dGRAM       float64 `json:"volume_7d_gram"`
	ActiveListings     int     `json:"active_listings"`
	FloorPriceGRAM     float64 `json:"floor_price_gram"`
	EstimatedSlippage  float64 `json:"estimated_slippage_pct"`
	DataStatus         string  `json:"data_status"`          // "live", "estimated", "unavailable"
}

// ExitOption holds the net payout simulation for a specific venue
type ExitOption struct {
	Rank                int     `json:"rank"`
	VenueID             VenueID `json:"venue_id"`
	VenueName           string  `json:"venue_name"`
	Currency            string  `json:"currency"`
	GrossPriceGRAM      float64 `json:"gross_price_gram"`
	GrossPriceUSD       float64 `json:"gross_price_usd"`
	FeePercent          float64 `json:"fee_percent"`
	FeeAmountGRAM       float64 `json:"fee_amount_gram"`
	NetPayoutGRAM       float64 `json:"net_payout_gram"`
	NetPayoutUSD        float64 `json:"net_payout_usd"`
	RequiresKYC         bool    `json:"requires_kyc"`
	HasRealVolumeBadge  bool    `json:"has_real_volume_badge"` // DropsTab warning badge
	Volume7dGRAM        float64 `json:"volume_7d_gram"`
	EstimatedDaysToSell int     `json:"estimated_days_to_sell"`
	DeepLink            string  `json:"deep_link"`
	RecommendationNote  string  `json:"recommendation_note"`
}

// ExitPlannerPlan contains sorted exit destinations ranked by net payout
type ExitPlannerPlan struct {
	BestVenueID     VenueID      `json:"best_venue_id"`
	BestVenueName   string       `json:"best_venue_name"`
	MaxNetGRAM      float64      `json:"max_net_gram"`
	MaxNetUSD       float64      `json:"max_net_usd"`
	ArbitrageSpread float64      `json:"arbitrage_spread_pct"` // Spread between highest and lowest net venue
	Options         []ExitOption `json:"options"`
	CalculatedAt    time.Time    `json:"calculated_at"`
}

// VenueRegistry map of standard venue configs
var Registry = map[VenueID]VenueInfo{
	VenueFragment: {
		ID:                 VenueFragment,
		Name:               "Fragment",
		Currency:           "GRAM",
		ProtocolFeePct:     5.0,
		ListingFeePct:      0.0,
		RequiresKYC:        true,
		EscrowType:         "smart_contract",
		DeepLinkBase:       "https://fragment.com/gifts",
		HasRealVolumeBadge: true,
		EstimatedSlippage:  0.5,
		DataStatus:         "live",
	},
	VenueGetgems: {
		ID:                 VenueGetgems,
		Name:               "Getgems",
		Currency:           "GRAM",
		ProtocolFeePct:     5.0,
		ListingFeePct:      0.0,
		RequiresKYC:        false,
		EscrowType:         "smart_contract",
		DeepLinkBase:       "https://getgems.io/collection",
		HasRealVolumeBadge: true,
		EstimatedSlippage:  0.8,
		DataStatus:         "live",
	},
	VenueMarketApp: {
		ID:                 VenueMarketApp,
		Name:               "MarketApp.ws",
		Currency:           "GRAM",
		ProtocolFeePct:     2.5,
		ListingFeePct:      0.0,
		RequiresKYC:        false,
		EscrowType:         "smart_contract",
		DeepLinkBase:       "https://marketapp.ws/gifts",
		HasRealVolumeBadge: true,
		EstimatedSlippage:  1.1,
		DataStatus:         "live",
	},
	VenueMRKT: {
		ID:                 VenueMRKT,
		Name:               "MRKT",
		Currency:           "GRAM",
		ProtocolFeePct:     0.0, // 0% two-way fee
		ListingFeePct:      0.0,
		RequiresKYC:        false,
		EscrowType:         "smart_contract",
		DeepLinkBase:       "https://mrkt.tg",
		HasRealVolumeBadge: true,
		EstimatedSlippage:  1.2,
		DataStatus:         "live",
	},
	VenuePortals: {
		ID:                 VenuePortals,
		Name:               "Portals",
		Currency:           "GRAM",
		ProtocolFeePct:     2.5,
		ListingFeePct:      0.0,
		RequiresKYC:        false,
		EscrowType:         "smart_contract",
		DeepLinkBase:       "https://portals.market",
		HasRealVolumeBadge: true,
		EstimatedSlippage:  1.5,
		DataStatus:         "live",
	},
	VenueTonnel: {
		ID:                 VenueTonnel,
		Name:               "Tonnel Network",
		Currency:           "GRAM",
		ProtocolFeePct:     3.0,
		ListingFeePct:      0.0,
		RequiresKYC:        false,
		EscrowType:         "bot_orderbook",
		DeepLinkBase:       "https://t.me/tonnel_gift_bot",
		HasRealVolumeBadge: false, // Low liquidity warning
		EstimatedSlippage:  2.5,
		DataStatus:         "estimated",
	},
	VenueTelegramStars: {
		ID:                 VenueTelegramStars,
		Name:               "In-Telegram Stars Resale",
		Currency:           "Stars",
		ProtocolFeePct:     10.0, // Default per-gift commission ~10%
		ListingFeePct:      0.0,
		RequiresKYC:        false,
		EscrowType:         "telegram_escrow",
		DeepLinkBase:       "https://t.me/nft",
		HasRealVolumeBadge: true,
		EstimatedSlippage:  1.0,
		DataStatus:         "live",
	},
}

// ComputeExitPlan evaluates venue choices using real baseline price and fee schedules
func ComputeExitPlan(ctx context.Context, targetGRAM, gramUsdRate float64, customResalePermille int) *ExitPlannerPlan {
	if gramUsdRate <= 0 {
		gramUsdRate = 5.50
	}
	if targetGRAM <= 0 {
		targetGRAM = 10.0
	}

	options := make([]ExitOption, 0, len(Registry))

	for _, v := range Registry {
		feePct := v.ProtocolFeePct
		if v.ID == VenueTelegramStars && customResalePermille > 0 {
			feePct = float64(customResalePermille) / 10.0
		}

		daysToSell := 3
		switch v.ID {
		case VenueFragment:
			daysToSell = 4
		case VenueGetgems:
			daysToSell = 3
		case VenueMarketApp:
			daysToSell = 5
		case VenueMRKT:
			daysToSell = 6
		case VenuePortals:
			daysToSell = 7
		case VenueTonnel:
			daysToSell = 12
		case VenueTelegramStars:
			daysToSell = 2
		}

		grossPrice := roundVal(targetGRAM)
		feeAmount := roundVal(grossPrice * (feePct / 100.0))
		netPayout := roundVal(grossPrice - feeAmount)

		recNote := "Standard Market Execution"
		if v.ID == VenueMRKT {
			recNote = "Zero fee maximizes net yield for high-ticket items"
		} else if v.ID == VenueTelegramStars {
			recNote = "Instant Stars liquidity directly in Telegram app"
		} else if v.ID == VenueFragment {
			recNote = "Deepest whale orderbook; requires KYC verification"
		} else if !v.HasRealVolumeBadge {
			recNote = "⚠️ Low 7-day liquidity; trade execution may experience slippage"
		}

		options = append(options, ExitOption{
			VenueID:            v.ID,
			VenueName:          v.Name,
			Currency:           v.Currency,
			GrossPriceGRAM:     grossPrice,
			GrossPriceUSD:      roundVal(grossPrice * gramUsdRate),
			FeePercent:         feePct,
			FeeAmountGRAM:      feeAmount,
			NetPayoutGRAM:      netPayout,
			NetPayoutUSD:       roundVal(netPayout * gramUsdRate),
			RequiresKYC:        v.RequiresKYC,
			HasRealVolumeBadge: v.HasRealVolumeBadge,
			Volume7dGRAM:       v.Volume7dGRAM,
			EstimatedDaysToSell: daysToSell,
			DeepLink:           v.DeepLinkBase,
			RecommendationNote: recNote,
		})
	}

	// Sort descending by NetPayoutGRAM
	sort.Slice(options, func(i, j int) bool {
		return options[i].NetPayoutGRAM > options[j].NetPayoutGRAM
	})

	for i := range options {
		options[i].Rank = i + 1
	}

	best := options[0]
	worst := options[len(options)-1]
	spreadPct := 0.0
	if worst.NetPayoutGRAM > 0 {
		spreadPct = ((best.NetPayoutGRAM - worst.NetPayoutGRAM) / worst.NetPayoutGRAM) * 100.0
	}

	return &ExitPlannerPlan{
		BestVenueID:     best.VenueID,
		BestVenueName:   best.VenueName,
		MaxNetGRAM:      best.NetPayoutGRAM,
		MaxNetUSD:       best.NetPayoutUSD,
		ArbitrageSpread: roundVal(spreadPct),
		Options:         options,
		CalculatedAt:    time.Now().UTC(),
	}
}

func roundVal(v float64) float64 {
	return math.Round(v*100.0) / 100.0
}
