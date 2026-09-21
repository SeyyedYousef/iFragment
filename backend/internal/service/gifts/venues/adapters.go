package venues

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"ifragment-backend/internal/client/marketapp"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/gifts/starsrate"
	"ifragment-backend/internal/service/gifts/traits"
)

var (
	ErrNoFloorData     = errors.New("no live floor price data available for venue")
	ErrAdapterTimeout  = errors.New("marketplace adapter query timed out")
	ErrUnreachableHost = errors.New("venue API endpoint unreachable")

	reFragmentFloor = regexp.MustCompile(`class="[^"]*tm-value[^"]*icon-ton[^"]*">\s*([0-9,]+(?:\.[0-9]+)?)\s*</div>`)
	reFragmentCard  = regexp.MustCompile(`(?s)<a\s+href="(/gift/[^"]+)"\s+class="tm-grid-item">(.*?)</a>`)
	reFragmentNum   = regexp.MustCompile(`#(\d+)`)
	reFragmentTime  = regexp.MustCompile(`<time\s+datetime="([^"]+)"`)
	reFragmentImg   = regexp.MustCompile(`src="([^"]+)"\s+class="tm-grid-thumb"`)
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

type FragmentSaleRecord struct {
	SerialNumber int
	PriceGRAM    decimal.Decimal
	SaleDate     time.Time
	ItemURL      string
	ImageURL     string
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

func normalizeFragmentSlug(slug string) string {
	slug = strings.ToLower(strings.TrimSpace(slug))
	slug = strings.ReplaceAll(slug, "-", "")
	slug = strings.ReplaceAll(slug, "_", "")
	slug = strings.ReplaceAll(slug, " ", "")
	return slug
}

// FragmentAdapter connects to Fragment.com marketplace
type FragmentAdapter struct {
	httpClient *http.Client
}

func NewFragmentAdapter() *FragmentAdapter {
	return &FragmentAdapter{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        50,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     60 * time.Second,
			},
		},
	}
}

func (a *FragmentAdapter) ID() VenueID { return VenueFragment }
func (a *FragmentAdapter) Name() string { return "Fragment" }
func (a *FragmentAdapter) Currency() string { return "GRAM" }
func (a *FragmentAdapter) ProtocolFeePct() decimal.Decimal { return decimal.NewFromFloat(5.0) }

func (a *FragmentAdapter) FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error) {
	normSlug := normalizeFragmentSlug(giftSlug)
	if normSlug == "" {
		return nil, ErrNoFloorData
	}

	url := fmt.Sprintf("https://fragment.com/gifts/%s?filter=sale&sort=price_asc", normSlug)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fragment returned status %d", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	html := string(bodyBytes)

	matches := reFragmentFloor.FindStringSubmatch(html)
	if len(matches) < 2 {
		// If no fixed-price sales, check auction filter
		urlAuction := fmt.Sprintf("https://fragment.com/gifts/%s?filter=auction&sort=price_asc", normSlug)
		reqA, errA := http.NewRequestWithContext(ctx, http.MethodGet, urlAuction, nil)
		if errA == nil {
			reqA.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
			respA, errA := a.httpClient.Do(reqA)
			if errA == nil && respA.StatusCode == http.StatusOK {
				defer respA.Body.Close()
				bodyA, _ := io.ReadAll(respA.Body)
				matches = reFragmentFloor.FindStringSubmatch(string(bodyA))
				html = string(bodyA)
			}
		}
	}

	if len(matches) < 2 {
		return nil, ErrNoFloorData
	}

	cleanPrice := strings.ReplaceAll(matches[1], ",", "")
	decFloor, err := decimal.NewFromString(cleanPrice)
	if err != nil || decFloor.IsZero() {
		return nil, ErrNoFloorData
	}

	activeListings := strings.Count(html, `class="tm-grid-item"`)
	if activeListings == 0 {
		activeListings = 1
	}

	return &VenueFloorResult{
		VenueID:        VenueFragment,
		VenueName:      "Fragment",
		FloorPriceRaw:  decFloor,
		FloorPriceGRAM: decFloor,
		Currency:       "GRAM",
		ActiveListings: activeListings,
		DataStatus:     "live",
		DeepLink:       fmt.Sprintf("https://fragment.com/gifts/%s", normSlug),
		FetchedAt:      time.Now().UTC(),
	}, nil
}

func (a *FragmentAdapter) FetchRecentSales(ctx context.Context, giftSlug string) ([]FragmentSaleRecord, error) {
	normSlug := normalizeFragmentSlug(giftSlug)
	if normSlug == "" {
		return nil, nil
	}

	url := fmt.Sprintf("https://fragment.com/gifts/%s?filter=sold", normSlug)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fragment sold filter returned status %d", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	html := string(bodyBytes)

	cardMatches := reFragmentCard.FindAllStringSubmatch(html, -1)
	var sales []FragmentSaleRecord
	for _, m := range cardMatches {
		itemURL := "https://fragment.com" + m[1]
		cardContent := m[2]

		priceMatch := reFragmentFloor.FindStringSubmatch(cardContent)
		if len(priceMatch) < 2 {
			continue
		}
		cleanPrice := strings.ReplaceAll(priceMatch[1], ",", "")
		priceDec, err := decimal.NewFromString(cleanPrice)
		if err != nil || priceDec.IsZero() {
			continue
		}

		serialNum := 0
		numMatch := reFragmentNum.FindStringSubmatch(cardContent)
		if len(numMatch) >= 2 {
			serialNum, _ = strconv.Atoi(numMatch[1])
		}

		saleTime := time.Now().UTC()
		timeMatch := reFragmentTime.FindStringSubmatch(cardContent)
		if len(timeMatch) >= 2 {
			if t, err := time.Parse(time.RFC3339, timeMatch[1]); err == nil {
				saleTime = t.UTC()
			}
		}

		imgURL := ""
		imgMatch := reFragmentImg.FindStringSubmatch(cardContent)
		if len(imgMatch) >= 2 {
			imgURL = imgMatch[1]
		}

		sales = append(sales, FragmentSaleRecord{
			SerialNumber: serialNum,
			PriceGRAM:    priceDec,
			SaleDate:     saleTime,
			ItemURL:      itemURL,
			ImageURL:     imgURL,
		})
	}

	return sales, nil
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
	// MarketApp currently only tracks usernames collection without public gift key
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
	col, ok := traits.ResolveCollection(giftSlug)
	if !ok || col.BaseStarsPrice <= 0 {
		return nil, ErrNoFloorData
	}

	floorTON := a.ConvertStarsToDecimalGRAM(int64(col.BaseStarsPrice))
	if floorTON.IsZero() {
		return nil, ErrNoFloorData
	}

	return &VenueFloorResult{
		VenueID:        VenueTelegramStars,
		VenueName:      "Telegram Stars (Mint)",
		FloorPriceRaw:  decimal.NewFromInt(int64(col.BaseStarsPrice)),
		FloorPriceGRAM: floorTON,
		Currency:       "Stars",
		ActiveListings: 0,
		DataStatus:     "live",
		DeepLink:       "https://t.me/nft/" + giftSlug,
		FetchedAt:      time.Now().UTC(),
	}, nil
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

