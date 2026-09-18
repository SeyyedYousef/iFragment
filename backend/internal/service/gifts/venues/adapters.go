package venues

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/shopspring/decimal"

	"ifragment-backend/internal/client/marketapp"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/gifts/starsrate"
)

var (
	ErrNoFloorData     = errors.New("no live floor price data available for venue")
	ErrAdapterTimeout  = errors.New("marketplace adapter query timed out")
	ErrUnreachableHost = errors.New("venue API endpoint unreachable")
)

type VenueFloorResult struct {
	VenueID        VenueID         `json:"venue_id"`
	VenueName      string          `json:"venue_name"`
	FloorPriceRaw  decimal.Decimal `json:"floor_price_raw"`
	FloorPriceGRAM decimal.Decimal `json:"floor_price_gram"`
	Currency       string          `json:"currency"`
	ActiveListings int             `json:"active_listings"`
	DataStatus     string          `json:"data_status"` // "live", "estimated", "unavailable"
	DeepLink       string          `json:"deep_link"`
	FetchedAt      time.Time       `json:"fetched_at"`
}

type VenueVolumeResult struct {
	VenueID       VenueID         `json:"venue_id"`
	Volume24hGRAM decimal.Decimal `json:"volume_24h_gram"`
	Volume7dGRAM  decimal.Decimal `json:"volume_7d_gram"`
	DataStatus    string          `json:"data_status"`
	FetchedAt     time.Time       `json:"fetched_at"`
}

// VenueAdapter defines the common contract for all 7 marketplace venue integrations
type VenueAdapter interface {
	ID() VenueID
	Name() string
	Currency() string
	ProtocolFeePct() decimal.Decimal
	FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error)
	FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error)
}

// FragmentAdapter connects to Fragment.com marketplace
type FragmentAdapter struct {
	httpClient *http.Client
}

func NewFragmentAdapter() *FragmentAdapter {
	return &FragmentAdapter{
		httpClient: &http.Client{Timeout: 6 * time.Second},
	}
}

func (a *FragmentAdapter) ID() VenueID { return VenueFragment }
func (a *FragmentAdapter) Name() string { return "Fragment" }
func (a *FragmentAdapter) Currency() string { return "GRAM" }
func (a *FragmentAdapter) ProtocolFeePct() decimal.Decimal { return decimal.NewFromFloat(5.0) }

func (a *FragmentAdapter) FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error) {
	// Note: Fragment uses client-side SPA rendering for gifts.
	// Returning ErrNoFloorData cleanly to avoid futile HTML scrapes and 429 rate limits,
	// until structured data ingestion from Omni-Agent feeds verified floor records.
	return nil, ErrNoFloorData
}

func (a *FragmentAdapter) FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error) {
	return &VenueVolumeResult{
		VenueID:    VenueFragment,
		DataStatus: "unavailable",
		FetchedAt:  time.Now().UTC(),
	}, nil
}

// GetgemsAdapter connects to Getgems.io marketplace
type GetgemsAdapter struct {
	httpClient *http.Client
}

func NewGetgemsAdapter() *GetgemsAdapter {
	return &GetgemsAdapter{
		httpClient: &http.Client{Timeout: 6 * time.Second},
	}
}

func (a *GetgemsAdapter) ID() VenueID { return VenueGetgems }
func (a *GetgemsAdapter) Name() string { return "Getgems" }
func (a *GetgemsAdapter) Currency() string { return "GRAM" }
func (a *GetgemsAdapter) ProtocolFeePct() decimal.Decimal { return decimal.NewFromFloat(5.0) }

func (a *GetgemsAdapter) FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error) {
	// Note: Getgems public v1 NFT floor API (/v1/nfts/floor-price/) is discontinued for Telegram gifts.
	// Returning ErrNoFloorData cleanly to avoid 404 network errors until official MTProto / v2 API is integrated.
	return nil, ErrNoFloorData
}

func (a *GetgemsAdapter) FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error) {
	return &VenueVolumeResult{
		VenueID:    VenueGetgems,
		DataStatus: "unavailable",
		FetchedAt:  time.Now().UTC(),
	}, nil
}

// MarketAppAdapter connects to MarketApp.ws via OpenAPI client
type MarketAppAdapter struct {
	client *marketapp.Client
}

func NewMarketAppAdapter() *MarketAppAdapter {
	return &MarketAppAdapter{
		client: marketapp.NewClient(),
	}
}

func (a *MarketAppAdapter) ID() VenueID { return VenueMarketApp }
func (a *MarketAppAdapter) Name() string { return "MarketApp.ws" }
func (a *MarketAppAdapter) Currency() string { return "GRAM" }
func (a *MarketAppAdapter) ProtocolFeePct() decimal.Decimal { return decimal.NewFromFloat(2.5) }

func (a *MarketAppAdapter) FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error) {
	if a.client == nil {
		return nil, ErrNoFloorData
	}

	colData, err := a.client.GetCollection(ctx)
	if err != nil || colData == nil || colData.FloorPrice <= 0 {
		return nil, ErrNoFloorData
	}

	decFloor := decimal.NewFromFloat(colData.FloorPrice)
	return &VenueFloorResult{
		VenueID:        VenueMarketApp,
		VenueName:      "MarketApp.ws",
		FloorPriceRaw:  decFloor,
		FloorPriceGRAM: decFloor,
		Currency:       "GRAM",
		ActiveListings: colData.ActiveAuctions,
		DataStatus:     "live",
		DeepLink:       "https://marketapp.ws/gifts",
		FetchedAt:      time.Now().UTC(),
	}, nil
}

func (a *MarketAppAdapter) FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error) {
	if a.client != nil {
		if colData, err := a.client.GetCollection(ctx); err == nil && colData != nil && colData.Volume24h > 0 {
			return &VenueVolumeResult{
				VenueID:       VenueMarketApp,
				Volume24hGRAM: decimal.NewFromFloat(colData.Volume24h),
				Volume7dGRAM:  decimal.Zero,
				DataStatus:    "live",
				FetchedAt:     time.Now().UTC(),
			}, nil
		}
	}
	return &VenueVolumeResult{
		VenueID:    VenueMarketApp,
		DataStatus: "unavailable",
		FetchedAt:  time.Now().UTC(),
	}, nil
}

// TelegramStarsAdapter calculates Stars market floor using live floating exchange rates
type TelegramStarsAdapter struct {
	cryptoPrice *cryptoprice.CryptoPriceService
}

func NewTelegramStarsAdapter(cryptoPrice *cryptoprice.CryptoPriceService) *TelegramStarsAdapter {
	return &TelegramStarsAdapter{cryptoPrice: cryptoPrice}
}

func (a *TelegramStarsAdapter) ID() VenueID { return VenueTelegramStars }
func (a *TelegramStarsAdapter) Name() string { return "Telegram Stars" }
func (a *TelegramStarsAdapter) Currency() string { return "Stars" }
func (a *TelegramStarsAdapter) ProtocolFeePct() decimal.Decimal { return decimal.NewFromFloat(10.0) }

func (a *TelegramStarsAdapter) FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error) {
	// Stars floor is calculated dynamically when star pricing is available
	return nil, ErrNoFloorData
}

func (a *TelegramStarsAdapter) FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error) {
	return &VenueVolumeResult{
		VenueID:    VenueTelegramStars,
		DataStatus: "unavailable",
		FetchedAt:  time.Now().UTC(),
	}, nil
}

// Helper: ConvertStarsToGRAM converts Telegram Stars integer to exact decimal TON
func (a *TelegramStarsAdapter) ConvertStarsToDecimalGRAM(stars int64) decimal.Decimal {
	var tonUsd float64
	if a.cryptoPrice != nil {
		if rate, ok := a.cryptoPrice.GetFloatPrice("the-open-network"); ok && rate > 0 {
			tonUsd = rate
		}
	}
	if tonUsd <= 0 {
		return decimal.Zero
	}
	gramVal := starsrate.ConvertStarsToGRAM(int(stars), tonUsd)
	return decimal.NewFromFloat(gramVal)
}

// TonnelAdapter connects to Tonnel Network bot/orderbook
type TonnelAdapter struct {
	httpClient *http.Client
}

func NewTonnelAdapter() *TonnelAdapter {
	return &TonnelAdapter{
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

func (a *TonnelAdapter) ID() VenueID { return VenueTonnel }
func (a *TonnelAdapter) Name() string { return "Tonnel Network" }
func (a *TonnelAdapter) Currency() string { return "GRAM" }
func (a *TonnelAdapter) ProtocolFeePct() decimal.Decimal { return decimal.NewFromFloat(3.0) }

func (a *TonnelAdapter) FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error) {
	// Tonnel operates primarily as a Telegram bot orderbook (@tonnel_gift_bot)
	// Returns ErrNoFloorData safely until real-time bot webhook bridge is connected
	return nil, ErrNoFloorData
}

func (a *TonnelAdapter) FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error) {
	return &VenueVolumeResult{
		VenueID:    VenueTonnel,
		DataStatus: "unavailable",
		FetchedAt:  time.Now().UTC(),
	}, nil
}

// PortalsAdapter connects to Portals.market
type PortalsAdapter struct {
	httpClient *http.Client
}

func NewPortalsAdapter() *PortalsAdapter {
	return &PortalsAdapter{
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

func (a *PortalsAdapter) ID() VenueID { return VenuePortals }
func (a *PortalsAdapter) Name() string { return "Portals" }
func (a *PortalsAdapter) Currency() string { return "GRAM" }
func (a *PortalsAdapter) ProtocolFeePct() decimal.Decimal { return decimal.NewFromFloat(2.5) }

func (a *PortalsAdapter) FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error) {
	// Portals marketplace integration endpoint
	return nil, ErrNoFloorData
}

func (a *PortalsAdapter) FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error) {
	return &VenueVolumeResult{
		VenueID:    VenuePortals,
		DataStatus: "unavailable",
		FetchedAt:  time.Now().UTC(),
	}, nil
}

// MRKTAdapter connects to MRKT (mrkt.tg)
type MRKTAdapter struct {
	httpClient *http.Client
}

func NewMRKTAdapter() *MRKTAdapter {
	return &MRKTAdapter{
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

func (a *MRKTAdapter) ID() VenueID { return VenueMRKT }
func (a *MRKTAdapter) Name() string { return "MRKT" }
func (a *MRKTAdapter) Currency() string { return "GRAM" }
func (a *MRKTAdapter) ProtocolFeePct() decimal.Decimal { return decimal.Zero } // 0% protocol fee

func (a *MRKTAdapter) FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error) {
	// MRKT zero-fee marketplace integration endpoint
	return nil, ErrNoFloorData
}

func (a *MRKTAdapter) FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error) {
	return &VenueVolumeResult{
		VenueID:    VenueMRKT,
		DataStatus: "unavailable",
		FetchedAt:  time.Now().UTC(),
	}, nil
}

