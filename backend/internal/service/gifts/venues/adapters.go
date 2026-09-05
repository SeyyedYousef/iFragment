package venues

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"

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
	cleanSlug := strings.ToLower(strings.TrimSpace(giftSlug))
	cleanSlug = strings.ReplaceAll(cleanSlug, "_", "-")

	// Query Fragment real gifts catalog listing page
	apiURL := fmt.Sprintf("https://fragment.com/gifts/%s", url.PathEscape(cleanSlug))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUnreachableHost, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		// Extract lowest price from Fragment table icon-ton element
		rePrice := regexp.MustCompile(`(?s)<div class="table-cell-value tm-value icon-before icon-ton">([\d,]+(?:\.\d+)?)</div>`)
		matches := rePrice.FindAllStringSubmatch(string(body), 10)
		if len(matches) > 0 {
			rawP := strings.ReplaceAll(matches[0][1], ",", "")
			if p, err := strconv.ParseFloat(rawP, 64); err == nil && p > 0 {
				decFloor := decimal.NewFromFloat(p)
				return &VenueFloorResult{
					VenueID:        VenueFragment,
					VenueName:      "Fragment",
					FloorPriceRaw:  decFloor,
					FloorPriceGRAM: decFloor,
					Currency:       "GRAM",
					ActiveListings: len(matches),
					DataStatus:     "live",
					DeepLink:       apiURL,
					FetchedAt:      time.Now().UTC(),
				}, nil
			}
		}
	}

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
	cleanSlug := strings.ToLower(strings.TrimSpace(giftSlug))
	cleanSlug = strings.ReplaceAll(cleanSlug, "_", "-")

	apiURL := fmt.Sprintf("https://api.getgems.io/public-api/v1/nfts/floor-price/%s", url.PathEscape(cleanSlug))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "iFragment/1.0")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUnreachableHost, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("getgems HTTP %d", resp.StatusCode)
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			FloorPriceTON  float64 `json:"floorPrice"`
			ActiveListings int     `json:"itemsCount"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	if payload.Data.FloorPriceTON > 0 {
		decFloor := decimal.NewFromFloat(payload.Data.FloorPriceTON)
		return &VenueFloorResult{
			VenueID:        VenueGetgems,
			VenueName:      "Getgems",
			FloorPriceRaw:  decFloor,
			FloorPriceGRAM: decFloor,
			Currency:       "GRAM",
			ActiveListings: payload.Data.ActiveListings,
			DataStatus:     "live",
			DeepLink:       fmt.Sprintf("https://getgems.io/collection/%s", cleanSlug),
			FetchedAt:      time.Now().UTC(),
		}, nil
	}

	return nil, ErrNoFloorData
}

func (a *GetgemsAdapter) FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error) {
	return &VenueVolumeResult{
		VenueID:    VenueGetgems,
		DataStatus: "unavailable",
		FetchedAt:  time.Now().UTC(),
	}, nil
}

// MarketAppAdapter connects to MarketApp.ws
type MarketAppAdapter struct {
	httpClient *http.Client
}

func NewMarketAppAdapter() *MarketAppAdapter {
	return &MarketAppAdapter{
		httpClient: &http.Client{Timeout: 6 * time.Second},
	}
}

func (a *MarketAppAdapter) ID() VenueID { return VenueMarketApp }
func (a *MarketAppAdapter) Name() string { return "MarketApp.ws" }
func (a *MarketAppAdapter) Currency() string { return "GRAM" }
func (a *MarketAppAdapter) ProtocolFeePct() decimal.Decimal { return decimal.NewFromFloat(2.5) }

func (a *MarketAppAdapter) FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error) {
	cleanSlug := strings.ToLower(strings.TrimSpace(giftSlug))
	cleanSlug = strings.ReplaceAll(cleanSlug, "_", "-")

	apiURL := fmt.Sprintf("https://marketapp.ws/api/v1/gifts/floor/%s", url.PathEscape(cleanSlug))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUnreachableHost, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("marketapp HTTP %d", resp.StatusCode)
	}

	var payload struct {
		FloorTON float64 `json:"floor_ton"`
		Listings int     `json:"listings"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	if payload.FloorTON > 0 {
		decFloor := decimal.NewFromFloat(payload.FloorTON)
		return &VenueFloorResult{
			VenueID:        VenueMarketApp,
			VenueName:      "MarketApp.ws",
			FloorPriceRaw:  decFloor,
			FloorPriceGRAM: decFloor,
			Currency:       "GRAM",
			ActiveListings: payload.Listings,
			DataStatus:     "live",
			DeepLink:       fmt.Sprintf("https://marketapp.ws/gifts/%s", cleanSlug),
			FetchedAt:      time.Now().UTC(),
		}, nil
	}

	return nil, ErrNoFloorData
}

func (a *MarketAppAdapter) FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error) {
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
	tonUsd := 5.50
	if a.cryptoPrice != nil {
		if rate, ok := a.cryptoPrice.GetFloatPrice("the-open-network"); ok && rate > 0 {
			tonUsd = rate
		}
	}
	gramVal := starsrate.ConvertStarsToGRAM(int(stars), tonUsd)
	return decimal.NewFromFloat(gramVal)
}
