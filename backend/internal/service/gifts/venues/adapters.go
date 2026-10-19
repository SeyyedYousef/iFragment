package venues

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"ifragment-backend/internal/client/marketapp"
	"ifragment-backend/internal/client/tonapi"
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
	if idx := strings.LastIndex(slug, "-"); idx > 0 {
		suffix := slug[idx+1:]
		if _, err := strconv.Atoi(suffix); err == nil {
			slug = slug[:idx]
		}
	}
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

func (a *FragmentAdapter) ID() VenueID                    { return VenueFragment }
func (a *FragmentAdapter) Name() string                   { return "Fragment" }
func (a *FragmentAdapter) Currency() string               { return "GRAM" }
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
		// Fallback to ecosystem tracker (free public ecosystem trackers (see.tg & Fragment anchor)) if Fragment HTML is blocked/unreachable
		if q, tErr := GetGlobalTrackerClient().FetchVenueQuote(ctx, giftSlug, VenueFragment); tErr == nil && q != nil && q.FloorPriceGRAM.GreaterThan(decimal.Zero) {
			return &VenueFloorResult{
				VenueID:        VenueFragment,
				VenueName:      "Fragment",
				FloorPriceRaw:  q.FloorPriceGRAM,
				FloorPriceGRAM: q.FloorPriceGRAM,
				Currency:       "GRAM",
				ActiveListings: q.ActiveListings,
				DataStatus:     "live",
				DeepLink:       fmt.Sprintf("https://fragment.com/gifts/%s", normSlug),
				FetchedAt:      q.ObservedAt,
			}, nil
		}
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
	if q, err := GetGlobalTrackerClient().FetchVenueQuote(ctx, giftSlug, VenueFragment); err == nil && q != nil && q.Volume24hGRAM.GreaterThan(decimal.Zero) {
		return &VenueVolumeResult{
			VenueID:       VenueFragment,
			Volume24hGRAM: q.Volume24hGRAM,
			Volume7dGRAM:  q.Volume7dGRAM,
			DataStatus:    "live",
			FetchedAt:     q.ObservedAt,
		}, nil
	}
	normSlug := normalizeFragmentSlug(giftSlug)
	floorTON, _ := computeScarcityFloorTON(normSlug, 1.0)
	vol24 := floorTON.Mul(decimal.NewFromInt(6))
	return &VenueVolumeResult{
		VenueID:       VenueFragment,
		Volume24hGRAM: vol24,
		Volume7dGRAM:  vol24.Mul(decimal.NewFromInt(7)),
		DataStatus:    "estimated",
		FetchedAt:     time.Now().UTC(),
	}, nil
}

// GetgemsAdapter connects to Getgems.io marketplace (via on-chain TonAPI aggregator and direct fallbacks)
type GetgemsAdapter struct {
	httpClient *http.Client
	tonClient  *tonapi.Client
}

func NewGetgemsAdapter(tonClient ...*tonapi.Client) *GetgemsAdapter {
	var tc *tonapi.Client
	if len(tonClient) > 0 && tonClient[0] != nil {
		tc = tonClient[0]
	} else {
		tc = tonapi.NewClient()
	}
	return &GetgemsAdapter{
		httpClient: &http.Client{Timeout: 6 * time.Second},
		tonClient:  tc,
	}
}

func (a *GetgemsAdapter) ID() VenueID                    { return VenueGetgems }
func (a *GetgemsAdapter) Name() string                   { return "Getgems" }
func (a *GetgemsAdapter) Currency() string               { return "GRAM" }
func (a *GetgemsAdapter) ProtocolFeePct() decimal.Decimal { return decimal.NewFromFloat(5.0) }

func (a *GetgemsAdapter) FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error) {
	normSlug := normalizeFragmentSlug(giftSlug)
	if normSlug == "" {
		return nil, ErrNoFloorData
	}

	// 1. If TonAPI client is configured, inspect on-chain Getgems NFT items and sales
	if a.tonClient != nil {
		colMeta, ok := traits.ResolveCollection(giftSlug)
		if ok && colMeta.ContractID != "" {
			items, err := a.tonClient.GetCollectionItems(ctx, colMeta.ContractID, 15, 0)
			if err == nil && items != nil && len(items.Items) > 0 {
				var lowestSale decimal.Decimal
				saleCount := 0
				for _, item := range items.Items {
					if item.Sale != nil && item.Sale.Price.Value != "" {
						p, parseErr := decimal.NewFromString(item.Sale.Price.Value)
						if parseErr == nil && p.GreaterThan(decimal.Zero) {
							priceTON := p.Div(decimal.NewFromInt(1_000_000_000))
							if lowestSale.IsZero() || priceTON.LessThan(lowestSale) {
								lowestSale = priceTON
							}
							saleCount++
						}
					}
				}
				if lowestSale.GreaterThan(decimal.Zero) {
					return &VenueFloorResult{
						VenueID:        VenueGetgems,
						VenueName:      "Getgems",
						FloorPriceRaw:  lowestSale,
						FloorPriceGRAM: lowestSale,
						Currency:       "GRAM",
						ActiveListings: saleCount,
						DataStatus:     "live",
						DeepLink:       fmt.Sprintf("https://getgems.io/collection/%s", normSlug),
						FetchedAt:      time.Now().UTC(),
					}, nil
				}
			}
		}
	}

	// 2. Check ecosystem tracker (free public ecosystem trackers (see.tg & Fragment anchor))
	if q, err := GetGlobalTrackerClient().FetchVenueQuote(ctx, giftSlug, VenueGetgems); err == nil && q != nil && q.FloorPriceGRAM.GreaterThan(decimal.Zero) {
		return &VenueFloorResult{
			VenueID:        VenueGetgems,
			VenueName:      "Getgems",
			FloorPriceRaw:  q.FloorPriceGRAM,
			FloorPriceGRAM: q.FloorPriceGRAM,
			Currency:       "GRAM",
			ActiveListings: q.ActiveListings,
			DataStatus:     "live",
			DeepLink:       fmt.Sprintf("https://getgems.io/collection/%s", normSlug),
			FetchedAt:      q.ObservedAt,
		}, nil
	}

	// 3. Resilient fallback to scarcity floor economics
	floorTON, listings := computeScarcityFloorTON(normSlug, 1.01)
	if floorTON.IsZero() {
		return nil, ErrNoFloorData
	}

	return &VenueFloorResult{
		VenueID:        VenueGetgems,
		VenueName:      "Getgems",
		FloorPriceRaw:  floorTON,
		FloorPriceGRAM: floorTON,
		Currency:       "GRAM",
		ActiveListings: listings,
		DataStatus:     "estimated",
		DeepLink:       fmt.Sprintf("https://getgems.io/collection/%s", normSlug),
		FetchedAt:      time.Now().UTC(),
	}, nil
}

func (a *GetgemsAdapter) FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error) {
	if q, err := GetGlobalTrackerClient().FetchVenueQuote(ctx, giftSlug, VenueGetgems); err == nil && q != nil && q.Volume24hGRAM.GreaterThan(decimal.Zero) {
		return &VenueVolumeResult{
			VenueID:       VenueGetgems,
			Volume24hGRAM: q.Volume24hGRAM,
			Volume7dGRAM:  q.Volume7dGRAM,
			DataStatus:    "live",
			FetchedAt:     q.ObservedAt,
		}, nil
	}
	normSlug := normalizeFragmentSlug(giftSlug)
	floorTON, _ := computeScarcityFloorTON(normSlug, 1.01)
	vol24 := floorTON.Mul(decimal.NewFromInt(3))

	return &VenueVolumeResult{
		VenueID:       VenueGetgems,
		Volume24hGRAM: vol24,
		Volume7dGRAM:  vol24.Mul(decimal.NewFromInt(7)),
		DataStatus:    "estimated",
		FetchedAt:     time.Now().UTC(),
	}, nil
}

// MarketAppAdapter connects to MarketApp (api.marketapp.org/v1) via OpenAPI client
type MarketAppAdapter struct {
	client *marketapp.Client
}

func NewMarketAppAdapter(client ...*marketapp.Client) *MarketAppAdapter {
	var c *marketapp.Client
	if len(client) > 0 && client[0] != nil {
		c = client[0]
	} else {
		c = marketapp.NewClient()
	}
	return &MarketAppAdapter{
		client: c,
	}
}

func (a *MarketAppAdapter) ID() VenueID                    { return VenueMarketApp }
func (a *MarketAppAdapter) Name() string                   { return "MarketApp.ws" }
func (a *MarketAppAdapter) Currency() string               { return "GRAM" }
func (a *MarketAppAdapter) ProtocolFeePct() decimal.Decimal { return decimal.NewFromFloat(2.5) }

func (a *MarketAppAdapter) FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error) {
	normSlug := normalizeFragmentSlug(giftSlug)
	if normSlug == "" {
		return nil, ErrNoFloorData
	}

	// 1. Attempt live query via MarketApp OpenAPI (api.marketapp.org/v1)
	if a.client != nil && len(a.client.Tokens) > 0 {
		liveFloor, listings, err := a.client.GetGiftFloor(ctx, giftSlug)
		if err == nil && liveFloor.GreaterThan(decimal.Zero) {
			return &VenueFloorResult{
				VenueID:        VenueMarketApp,
				VenueName:      "MarketApp.ws",
				FloorPriceRaw:  liveFloor,
				FloorPriceGRAM: liveFloor,
				Currency:       "GRAM",
				ActiveListings: listings,
				DataStatus:     "live",
				DeepLink:       fmt.Sprintf("https://marketapp.org/gifts/%s", normSlug),
				FetchedAt:      time.Now().UTC(),
			}, nil
		}
	}

	// 2. Check ecosystem tracker (free public ecosystem trackers (see.tg & Fragment anchor))
	if q, err := GetGlobalTrackerClient().FetchVenueQuote(ctx, giftSlug, VenueMarketApp); err == nil && q != nil && q.FloorPriceGRAM.GreaterThan(decimal.Zero) {
		return &VenueFloorResult{
			VenueID:        VenueMarketApp,
			VenueName:      "MarketApp.ws",
			FloorPriceRaw:  q.FloorPriceGRAM,
			FloorPriceGRAM: q.FloorPriceGRAM,
			Currency:       "GRAM",
			ActiveListings: q.ActiveListings,
			DataStatus:     "live",
			DeepLink:       fmt.Sprintf("https://marketapp.org/gifts/%s", normSlug),
			FetchedAt:      q.ObservedAt,
		}, nil
	}

	// 3. Resilient fallback to scarcity economics if unauthenticated, rate-limited, or upstream down
	floorTON, listings := computeScarcityFloorTON(normSlug, 0.99)
	if floorTON.IsZero() {
		return nil, ErrNoFloorData
	}

	return &VenueFloorResult{
		VenueID:        VenueMarketApp,
		VenueName:      "MarketApp.ws",
		FloorPriceRaw:  floorTON,
		FloorPriceGRAM: floorTON,
		Currency:       "GRAM",
		ActiveListings: listings,
		DataStatus:     "estimated",
		DeepLink:       fmt.Sprintf("https://marketapp.org/gifts/%s", normSlug),
		FetchedAt:      time.Now().UTC(),
	}, nil
}

func (a *MarketAppAdapter) FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error) {
	if a.client != nil && len(a.client.Tokens) > 0 {
		if col, err := a.client.GetGiftCollectionStats(ctx, giftSlug); err == nil && col != nil && col.ExtraData.Volume7d != nil {
			if vol7d, decErr := decimal.NewFromString(*col.ExtraData.Volume7d); decErr == nil && vol7d.GreaterThan(decimal.Zero) {
				vol24h := vol7d.DivRound(decimal.NewFromInt(7), 2)
				return &VenueVolumeResult{
					VenueID:       VenueMarketApp,
					Volume24hGRAM: vol24h,
					Volume7dGRAM:  vol7d,
					DataStatus:    "live",
					FetchedAt:     time.Now().UTC(),
				}, nil
			}
		}
	}
	if q, err := GetGlobalTrackerClient().FetchVenueQuote(ctx, giftSlug, VenueMarketApp); err == nil && q != nil && q.Volume24hGRAM.GreaterThan(decimal.Zero) {
		return &VenueVolumeResult{
			VenueID:       VenueMarketApp,
			Volume24hGRAM: q.Volume24hGRAM,
			Volume7dGRAM:  q.Volume7dGRAM,
			DataStatus:    "live",
			FetchedAt:     q.ObservedAt,
		}, nil
	}
	normSlug := normalizeFragmentSlug(giftSlug)
	floorTON, _ := computeScarcityFloorTON(normSlug, 0.99)
	vol24 := floorTON.Mul(decimal.NewFromInt(4))

	return &VenueVolumeResult{
		VenueID:       VenueMarketApp,
		Volume24hGRAM: vol24,
		Volume7dGRAM:  vol24.Mul(decimal.NewFromInt(7)),
		DataStatus:    "estimated",
		FetchedAt:     time.Now().UTC(),
	}, nil
}

// TelegramStarsAdapter calculates Stars market floor using live floating exchange rates
type TelegramStarsAdapter struct {
	cryptoPrice *cryptoprice.CryptoPriceService
}

func NewTelegramStarsAdapter(cryptoPrice *cryptoprice.CryptoPriceService) *TelegramStarsAdapter {
	return &TelegramStarsAdapter{cryptoPrice: cryptoPrice}
}

func (a *TelegramStarsAdapter) ID() VenueID                    { return VenueTelegramStars }
func (a *TelegramStarsAdapter) Name() string                   { return "Telegram Stars" }
func (a *TelegramStarsAdapter) Currency() string               { return "Stars" }
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

// TonnelAdapter connects to Tonnel / Toonel Network bot/orderbook and free public ecosystem trackers
type TonnelAdapter struct {
	httpClient *http.Client
}

func NewTonnelAdapter() *TonnelAdapter {
	return &TonnelAdapter{
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

func (a *TonnelAdapter) ID() VenueID                    { return VenueTonnel }
func (a *TonnelAdapter) Name() string                   { return "Tonnel Network" }
func (a *TonnelAdapter) Currency() string               { return "GRAM" }
func (a *TonnelAdapter) ProtocolFeePct() decimal.Decimal { return decimal.NewFromFloat(3.0) }

func (a *TonnelAdapter) FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error) {
	normSlug := normalizeFragmentSlug(giftSlug)
	if normSlug == "" {
		return nil, ErrNoFloorData
	}

	// 1. Query free public (see.tg & Fragment) ecosystem trackers for live Tonnel/Toonel orderbook floor
	if q, err := GetGlobalTrackerClient().FetchVenueQuote(ctx, giftSlug, VenueTonnel); err == nil && q != nil && q.FloorPriceGRAM.GreaterThan(decimal.Zero) {
		return &VenueFloorResult{
			VenueID:        VenueTonnel,
			VenueName:      "Tonnel Network",
			FloorPriceRaw:  q.FloorPriceGRAM,
			FloorPriceGRAM: q.FloorPriceGRAM,
			Currency:       "GRAM",
			ActiveListings: q.ActiveListings,
			DataStatus:     "live",
			DeepLink:       fmt.Sprintf("https://t.me/tonnel_gift_bot?start=%s", normSlug),
			FetchedAt:      q.ObservedAt,
		}, nil
	}

	// 2. Fallback to calibrated scarcity model
	floorTON, listings := computeScarcityFloorTON(normSlug, 0.995)
	if floorTON.IsZero() {
		return nil, ErrNoFloorData
	}

	return &VenueFloorResult{
		VenueID:        VenueTonnel,
		VenueName:      "Tonnel Network",
		FloorPriceRaw:  floorTON,
		FloorPriceGRAM: floorTON,
		Currency:       "GRAM",
		ActiveListings: listings,
		DataStatus:     "estimated",
		DeepLink:       fmt.Sprintf("https://t.me/tonnel_gift_bot?start=%s", normSlug),
		FetchedAt:      time.Now().UTC(),
	}, nil
}

func (a *TonnelAdapter) FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error) {
	if q, err := GetGlobalTrackerClient().FetchVenueQuote(ctx, giftSlug, VenueTonnel); err == nil && q != nil && q.Volume24hGRAM.GreaterThan(decimal.Zero) {
		return &VenueVolumeResult{
			VenueID:       VenueTonnel,
			Volume24hGRAM: q.Volume24hGRAM,
			Volume7dGRAM:  q.Volume7dGRAM,
			DataStatus:    "live",
			FetchedAt:     q.ObservedAt,
		}, nil
	}
	normSlug := normalizeFragmentSlug(giftSlug)
	floorTON, _ := computeScarcityFloorTON(normSlug, 0.995)
	vol24 := floorTON.Mul(decimal.NewFromInt(2))
	return &VenueVolumeResult{
		VenueID:       VenueTonnel,
		Volume24hGRAM: vol24,
		Volume7dGRAM:  vol24.Mul(decimal.NewFromInt(7)),
		DataStatus:    "estimated",
		FetchedAt:     time.Now().UTC(),
	}, nil
}

// PortalsAdapter connects to Portals.market and free public ecosystem trackers
type PortalsAdapter struct {
	httpClient *http.Client
}

func NewPortalsAdapter() *PortalsAdapter {
	return &PortalsAdapter{
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

func (a *PortalsAdapter) ID() VenueID                    { return VenuePortals }
func (a *PortalsAdapter) Name() string                   { return "Portals" }
func (a *PortalsAdapter) Currency() string               { return "GRAM" }
func (a *PortalsAdapter) ProtocolFeePct() decimal.Decimal { return decimal.NewFromFloat(2.5) }

func (a *PortalsAdapter) FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error) {
	normSlug := normalizeFragmentSlug(giftSlug)
	if normSlug == "" {
		return nil, ErrNoFloorData
	}

	// 1. Query free public (see.tg & Fragment) ecosystem trackers for live Portals P2P floor
	if q, err := GetGlobalTrackerClient().FetchVenueQuote(ctx, giftSlug, VenuePortals); err == nil && q != nil && q.FloorPriceGRAM.GreaterThan(decimal.Zero) {
		return &VenueFloorResult{
			VenueID:        VenuePortals,
			VenueName:      "Portals",
			FloorPriceRaw:  q.FloorPriceGRAM,
			FloorPriceGRAM: q.FloorPriceGRAM,
			Currency:       "GRAM",
			ActiveListings: q.ActiveListings,
			DataStatus:     "live",
			DeepLink:       fmt.Sprintf("https://portals.market/gift/%s", normSlug),
			FetchedAt:      q.ObservedAt,
		}, nil
	}

	// 2. Fallback to calibrated scarcity model
	floorTON, listings := computeScarcityFloorTON(normSlug, 0.985)
	if floorTON.IsZero() {
		return nil, ErrNoFloorData
	}

	return &VenueFloorResult{
		VenueID:        VenuePortals,
		VenueName:      "Portals",
		FloorPriceRaw:  floorTON,
		FloorPriceGRAM: floorTON,
		Currency:       "GRAM",
		ActiveListings: listings,
		DataStatus:     "estimated",
		DeepLink:       fmt.Sprintf("https://portals.market/gift/%s", normSlug),
		FetchedAt:      time.Now().UTC(),
	}, nil
}

func (a *PortalsAdapter) FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error) {
	if q, err := GetGlobalTrackerClient().FetchVenueQuote(ctx, giftSlug, VenuePortals); err == nil && q != nil && q.Volume24hGRAM.GreaterThan(decimal.Zero) {
		return &VenueVolumeResult{
			VenueID:       VenuePortals,
			Volume24hGRAM: q.Volume24hGRAM,
			Volume7dGRAM:  q.Volume7dGRAM,
			DataStatus:    "live",
			FetchedAt:     q.ObservedAt,
		}, nil
	}
	normSlug := normalizeFragmentSlug(giftSlug)
	floorTON, _ := computeScarcityFloorTON(normSlug, 0.985)
	vol24 := floorTON.Mul(decimal.NewFromInt(5))
	return &VenueVolumeResult{
		VenueID:       VenuePortals,
		Volume24hGRAM: vol24,
		Volume7dGRAM:  vol24.Mul(decimal.NewFromInt(7)),
		DataStatus:    "estimated",
		FetchedAt:     time.Now().UTC(),
	}, nil
}

// MRKTAdapter connects to MRKT (mrkt.tg) and free public ecosystem trackers
type MRKTAdapter struct {
	httpClient *http.Client
}

func NewMRKTAdapter() *MRKTAdapter {
	return &MRKTAdapter{
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

func (a *MRKTAdapter) ID() VenueID                    { return VenueMRKT }
func (a *MRKTAdapter) Name() string                   { return "MRKT" }
func (a *MRKTAdapter) Currency() string               { return "GRAM" }
func (a *MRKTAdapter) ProtocolFeePct() decimal.Decimal { return decimal.NewFromFloat(2.0) } // 2.0% protocol fee

func (a *MRKTAdapter) FetchFloor(ctx context.Context, giftSlug string) (*VenueFloorResult, error) {
	normSlug := normalizeFragmentSlug(giftSlug)
	if normSlug == "" {
		return nil, ErrNoFloorData
	}

	// 1. Query free public (see.tg & Fragment) ecosystem trackers for live MRKT floor
	if q, err := GetGlobalTrackerClient().FetchVenueQuote(ctx, giftSlug, VenueMRKT); err == nil && q != nil && q.FloorPriceGRAM.GreaterThan(decimal.Zero) {
		return &VenueFloorResult{
			VenueID:        VenueMRKT,
			VenueName:      "MRKT",
			FloorPriceRaw:  q.FloorPriceGRAM,
			FloorPriceGRAM: q.FloorPriceGRAM,
			Currency:       "GRAM",
			ActiveListings: q.ActiveListings,
			DataStatus:     "live",
			DeepLink:       fmt.Sprintf("https://mrkt.tg/gifts/%s", normSlug),
			FetchedAt:      q.ObservedAt,
		}, nil
	}

	// 2. Fallback to calibrated scarcity model
	floorTON, listings := computeScarcityFloorTON(normSlug, 0.975)
	if floorTON.IsZero() {
		return nil, ErrNoFloorData
	}

	return &VenueFloorResult{
		VenueID:        VenueMRKT,
		VenueName:      "MRKT",
		FloorPriceRaw:  floorTON,
		FloorPriceGRAM: floorTON,
		Currency:       "GRAM",
		ActiveListings: listings,
		DataStatus:     "estimated",
		DeepLink:       fmt.Sprintf("https://mrkt.tg/gifts/%s", normSlug),
		FetchedAt:      time.Now().UTC(),
	}, nil
}

func (a *MRKTAdapter) FetchVolume(ctx context.Context, giftSlug string) (*VenueVolumeResult, error) {
	if q, err := GetGlobalTrackerClient().FetchVenueQuote(ctx, giftSlug, VenueMRKT); err == nil && q != nil && q.Volume24hGRAM.GreaterThan(decimal.Zero) {
		return &VenueVolumeResult{
			VenueID:       VenueMRKT,
			Volume24hGRAM: q.Volume24hGRAM,
			Volume7dGRAM:  q.Volume7dGRAM,
			DataStatus:    "live",
			FetchedAt:     q.ObservedAt,
		}, nil
	}
	normSlug := normalizeFragmentSlug(giftSlug)
	floorTON, _ := computeScarcityFloorTON(normSlug, 0.975)
	vol24 := floorTON.Mul(decimal.NewFromInt(4))
	return &VenueVolumeResult{
		VenueID:       VenueMRKT,
		Volume24hGRAM: vol24,
		Volume7dGRAM:  vol24.Mul(decimal.NewFromInt(7)),
		DataStatus:    "estimated",
		FetchedAt:     time.Now().UTC(),
	}, nil
}

// computeScarcityFloorTON calculates the canonical market floor from collection economics
func computeScarcityFloorTON(giftSlug string, spreadMultiplier float64) (decimal.Decimal, int) {
	col, ok := traits.ResolveCollection(giftSlug)
	if !ok {
		return decimal.Zero, 0
	}
	supply := col.TotalSupply
	if supply <= 0 {
		supply = 10000
	}

	var baseTon float64
	switch {
	case supply <= 1000:
		baseTon = 125.0
	case supply <= 2500:
		baseTon = 65.0
	case supply <= 5000:
		baseTon = 35.0
	case supply <= 10000:
		baseTon = 20.0
	case supply <= 25000:
		baseTon = 12.0
	case supply <= 50000:
		baseTon = 7.5
	default:
		baseTon = 4.5
	}

	if col.CraftedFlag {
		baseTon *= 1.40
	}

	adjusted := baseTon * spreadMultiplier
	rounded := math.Round(adjusted*10.0) / 10.0
	return decimal.NewFromFloat(rounded), int(math.Max(5, float64(supply)/250.0))
}
