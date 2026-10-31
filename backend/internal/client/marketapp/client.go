package marketapp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/shopspring/decimal"
)

const (
	// UsernamesCollectionAddr is Telegram Usernames NFT collection on TON
	UsernamesCollectionAddr = "EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi"
	// AnonymousNumbersCollectionAddr is +888 Anonymous Numbers collection on TON
	AnonymousNumbersCollectionAddr = "EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N"
	// CollectionAddr retained for backwards compatibility
	CollectionAddr = UsernamesCollectionAddr
)

var (
	ErrUnauthorized = errors.New("marketapp: unauthorized or expired token")
	ErrNotFound     = errors.New("marketapp: resource not found")
)

type Client struct {
	BaseURL         string
	Tokens          []string
	tokenIndex      uint64
	HTTP            *http.Client
	collectionsMu   sync.RWMutex
	giftCollections []MarketAppCollection
	giftColsExp     time.Time
}

// MarketAppCollectionStats matches OpenAPI #/components/schemas/CollectionStats
type MarketAppCollectionStats struct {
	Items         *int    `json:"items"`
	Floor         *string `json:"floor"`
	RentFloor     *string `json:"rent_floor"`
	Volume7d      *string `json:"volume7d"`
	Volume30d     *string `json:"volume30d"`
	Owners        *int    `json:"owners"`
	OnSaleAll     *int    `json:"on_sale_all"`
	OnSaleOnchain *int    `json:"on_sale_onchain"`
}

// MarketAppCollection matches OpenAPI #/components/schemas/Collection
type MarketAppCollection struct {
	Name      string                   `json:"name"`
	Address   string                   `json:"address"`
	ExtraData MarketAppCollectionStats `json:"extra_data"`
}

func NewClient() *Client {
	var tokens []string
	if tokensStr := os.Getenv("MARKETAPP_TOKENS"); tokensStr != "" {
		for _, t := range strings.Split(tokensStr, ",") {
			if trimmed := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(t), "Bearer ")); trimmed != "" {
				tokens = append(tokens, trimmed)
			}
		}
	} else if singleToken := os.Getenv("MARKETAPP_TOKEN"); singleToken != "" {
		if trimmed := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(singleToken), "Bearer ")); trimmed != "" {
			tokens = []string{trimmed}
		}
	}

	if len(tokens) == 0 {
		slog.Warn("MARKETAPP_TOKEN/MARKETAPP_TOKENS not set — MarketApp API requests will be unauthenticated")
	} else {
		slog.Info("MarketApp client initialized", "token_count", len(tokens))
	}

	return &Client{
		BaseURL: "https://api.marketapp.org/v1",
		Tokens:  tokens,
		HTTP: &http.Client{
			Timeout: 10 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 20,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

func (c *Client) getToken() string {
	if len(c.Tokens) == 0 {
		return ""
	}
	idx := atomic.AddUint64(&c.tokenIndex, 1) % uint64(len(c.Tokens))
	return c.Tokens[idx]
}

// HasToken returns true if any API token is configured
func (c *Client) HasToken() bool {
	return len(c.Tokens) > 0
}

// NFTAttribute represents trait metadata
type NFTAttribute struct {
	TraitType string      `json:"trait_type"`
	Value     interface{} `json:"value"`
}

// NFTItem represents a single listed NFT on MarketApp
type NFTItem struct {
	Address           string         `json:"address"`
	Name              string         `json:"name"`
	CollectionAddress string         `json:"collection_address"`
	Owner             string         `json:"owner"`
	RealOwner         string         `json:"real_owner"`
	MinBid            string         `json:"min_bid"` // Price in GRAM
	MaxBid            string         `json:"max_bid"`
	Status            string         `json:"status"`
	Attributes        []NFTAttribute `json:"attributes"`
}

// GiftsOnSaleResponse matches MarketApp OpenAPI schema for /v1/gifts/onsale/
type GiftsOnSaleResponse struct {
	Cursor *string   `json:"cursor"`
	Items  []NFTItem `json:"items"`
}

// NFTsOnSaleResponse matches MarketApp OpenAPI schema for /v1/nfts/collections/{addr}/
type NFTsOnSaleResponse struct {
	Cursor *string   `json:"cursor"`
	Items  []NFTItem `json:"items"`
}

// GiftFilterParams controls filtering on /v1/gifts/onsale/
type GiftFilterParams struct {
	Model             string
	Symbol            string
	Backdrop          string
	Models            []string
	Symbols           []string
	Backdrops         []string
	ItemNumFrom       *int
	ItemNumTo         *int
	MinPrice          *float64
	MaxPrice          *float64
	SortBy            string // default "min_bid_asc", or "min_bid_desc", "recently_touch"
	CollectionAddress string
	CollectionsList   []string
	Limit             int // default 10, max 100
	Cursor            string
}

// CollectionData represents global collection stats from Marketapp
type CollectionData struct {
	Name           string          `json:"name"`
	Description    string          `json:"description"`
	Address        string          `json:"address"`
	TotalMinted    int             `json:"total_minted"`
	ItemsCount     int             `json:"items_count"`
	TotalOwners    int             `json:"total_owners"`
	FloorPrice     float64         `json:"floor_price"`
	RentFloorPrice float64         `json:"rent_floor_price"`
	TotalVolume    float64         `json:"total_volume"`
	Volume7d       float64         `json:"volume_7d"`
	Volume30d      float64         `json:"volume_30d"`
	Revenue        float64         `json:"revenue"`
	Volume24h      float64         `json:"24h_volume"`
	SalesCount     int             `json:"sales_count"`
	HighestSale    float64         `json:"highest_sale"`
	ListedRatio    float64         `json:"listed_ratio"`
	ActiveAuctions int             `json:"active_auctions_count"`
	TopSales       []TopSaleRecord `json:"top_sales"`
}

// ItemData represents legacy username NFT data
type ItemData struct {
	Name           string       `json:"name"`
	OwnerAddress   string       `json:"owner_address"`
	SaleStatus     string       `json:"sale_status"`
	HighestBid     float64      `json:"highest_bid"`
	BuyNowPrice    float64      `json:"buy_now_price"`
	EndTime        string       `json:"end_time"`
	MintDate       string       `json:"mint_date"`
	PastSales      []SaleRecord `json:"past_sales"`
	PreviousOwners []string     `json:"previous_owners"`
}

type SaleRecord struct {
	Price float64 `json:"price"`
	Date  string  `json:"date"`
	From  string  `json:"from"`
	To    string  `json:"to"`
}

type TopSaleRecord struct {
	Username string  `json:"username"`
	Price    float64 `json:"price"`
	Date     string  `json:"date"`
}

func (c *Client) doRequest(ctx context.Context, endpointURL string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", endpointURL, nil)
	if err != nil {
		return nil, err
	}
	token := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(c.getToken()), "Bearer "))
	if token != "" {
		// Per Marketapp OpenAPI securitySchemes.ApiTokenAuth:
		// Set Authorization header to raw API token without "Bearer" prefix.
		req.Header.Set("Authorization", token)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "iFragment/1.0 (Telegram Mini App)")
	return c.HTTP.Do(req)
}

// GetGiftCollections fetches all Telegram Gift collections and stats from GET /v1/collections/gifts/
func (c *Client) GetGiftCollections(ctx context.Context) ([]MarketAppCollection, error) {
	c.collectionsMu.RLock()
	if len(c.giftCollections) > 0 && time.Now().Before(c.giftColsExp) {
		cols := make([]MarketAppCollection, len(c.giftCollections))
		copy(cols, c.giftCollections)
		c.collectionsMu.RUnlock()
		return cols, nil
	}
	c.collectionsMu.RUnlock()

	reqURL := fmt.Sprintf("%s/collections/gifts/", strings.TrimRight(c.BaseURL, "/"))
	resp, err := c.doRequest(ctx, reqURL)
	if err != nil {
		return nil, fmt.Errorf("marketapp gift collections request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, ErrUnauthorized
	}
	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrNotFound
	}
	if resp.StatusCode != http.StatusOK {
		bodyPreview, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("marketapp gift collections status %d: %s", resp.StatusCode, string(bodyPreview))
	}

	var cols []MarketAppCollection
	if err := json.NewDecoder(resp.Body).Decode(&cols); err != nil {
		return nil, fmt.Errorf("marketapp gift collections decode failed: %w", err)
	}

	c.collectionsMu.Lock()
	c.giftCollections = cols
	c.giftColsExp = time.Now().Add(2 * time.Minute)
	c.collectionsMu.Unlock()

	return cols, nil
}

func normalizeGiftCollectionKey(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, "_", "")
	s = strings.ReplaceAll(s, "-", "")
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "'", "")
	s = strings.ReplaceAll(s, "’", "")
	return s
}

// GetGiftCollectionStats matches a gift slug against /v1/collections/gifts/
func (c *Client) GetGiftCollectionStats(ctx context.Context, giftSlug string) (*MarketAppCollection, error) {
	target := normalizeGiftCollectionKey(giftSlug)
	if target == "" {
		return nil, ErrNotFound
	}
	cols, err := c.GetGiftCollections(ctx)
	if err != nil {
		return nil, err
	}
	for i := range cols {
		if normalizeGiftCollectionKey(cols[i].Name) == target || strings.EqualFold(cols[i].Address, giftSlug) {
			return &cols[i], nil
		}
	}
	return nil, ErrNotFound
}

// GetGiftsOnSale fetches gifts on sale matching the filter parameters
func (c *Client) GetGiftsOnSale(ctx context.Context, params GiftFilterParams) (*GiftsOnSaleResponse, error) {
	u, err := url.Parse(fmt.Sprintf("%s/gifts/onsale/", strings.TrimRight(c.BaseURL, "/")))
	if err != nil {
		return nil, err
	}

	q := u.Query()
	if params.Cursor != "" {
		q.Set("cursor", params.Cursor)
	}
	limit := params.Limit
	if limit <= 0 {
		limit = 20
	} else if limit > 100 {
		limit = 100
	}
	q.Set("limit", strconv.Itoa(limit))

	if params.SortBy != "" {
		q.Set("sort_by", params.SortBy)
	} else {
		q.Set("sort_by", "min_bid_asc")
	}

	if params.Model != "" {
		q.Set("model", params.Model)
	}
	for _, m := range params.Models {
		if m != "" {
			q.Add("models", m)
		}
	}
	if params.Symbol != "" {
		q.Set("symbol", params.Symbol)
	}
	for _, s := range params.Symbols {
		if s != "" {
			q.Add("symbols", s)
		}
	}
	if params.Backdrop != "" {
		q.Set("backdrop", params.Backdrop)
	}
	for _, b := range params.Backdrops {
		if b != "" {
			q.Add("backdrops", b)
		}
	}
	if params.CollectionAddress != "" {
		q.Set("collection_address", params.CollectionAddress)
	}
	for _, cAddr := range params.CollectionsList {
		if cAddr != "" {
			q.Add("collections_list", cAddr)
		}
	}
	if params.ItemNumFrom != nil {
		q.Set("item_num_from", strconv.Itoa(*params.ItemNumFrom))
	}
	if params.ItemNumTo != nil {
		q.Set("item_num_to", strconv.Itoa(*params.ItemNumTo))
	}
	if params.MinPrice != nil {
		q.Set("min_price", fmt.Sprintf("%.4f", *params.MinPrice))
	}
	if params.MaxPrice != nil {
		q.Set("max_price", fmt.Sprintf("%.4f", *params.MaxPrice))
	}

	u.RawQuery = q.Encode()

	resp, err := c.doRequest(ctx, u.String())
	if err != nil {
		return nil, fmt.Errorf("marketapp gifts onsale request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		bodyPreview, _ := io.ReadAll(io.LimitReader(resp.Body, 256))
		slog.Warn("MARKETAPP_AUTH_FAILED", "status", resp.StatusCode, "body", string(bodyPreview))
		return nil, ErrUnauthorized
	}
	if resp.StatusCode == http.StatusNotFound {
		return &GiftsOnSaleResponse{Items: []NFTItem{}}, nil
	}
	if resp.StatusCode != http.StatusOK {
		bodyPreview, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("marketapp gifts onsale status %d: %s", resp.StatusCode, string(bodyPreview))
	}

	var res GiftsOnSaleResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, fmt.Errorf("marketapp gifts onsale decode failed: %w", err)
	}
	return &res, nil
}

// GetGiftFloor fetches the lowest active on-sale price and listing count for a specific gift collection/model.
// It first checks /v1/collections/gifts/ for collection-level floor & on-sale count (or collection_address),
// and falls back to /v1/gifts/onsale/ sorted by min_bid_asc.
func (c *Client) GetGiftFloor(ctx context.Context, model string) (decimal.Decimal, int, error) {
	var colAddr string
	if col, colErr := c.GetGiftCollectionStats(ctx, model); colErr == nil && col != nil {
		colAddr = col.Address
		if col.ExtraData.Floor != nil && strings.TrimSpace(*col.ExtraData.Floor) != "" {
			if fl, decErr := decimal.NewFromString(strings.TrimSpace(*col.ExtraData.Floor)); decErr == nil && fl.GreaterThan(decimal.Zero) {
				listings := 0
				if col.ExtraData.OnSaleOnchain != nil && *col.ExtraData.OnSaleOnchain > 0 {
					listings = *col.ExtraData.OnSaleOnchain
				} else if col.ExtraData.OnSaleAll != nil && *col.ExtraData.OnSaleAll > 0 {
					listings = *col.ExtraData.OnSaleAll
				}
				return fl, listings, nil
			}
		}
	} else if errors.Is(colErr, ErrUnauthorized) {
		return decimal.Zero, 0, ErrUnauthorized
	}

	filter := GiftFilterParams{
		SortBy: "min_bid_asc",
		Limit:  20,
	}
	if colAddr != "" {
		filter.CollectionAddress = colAddr
	} else {
		filter.Model = model
	}

	resp, err := c.GetGiftsOnSale(ctx, filter)
	if err != nil {
		return decimal.Zero, 0, err
	}

	if len(resp.Items) == 0 {
		return decimal.Zero, 0, nil
	}

	// First item in min_bid_asc sort is the floor
	first := resp.Items[0]
	floorPrice, err := decimal.NewFromString(first.MinBid)
	if err != nil {
		f, parseErr := strconv.ParseFloat(first.MinBid, 64)
		if parseErr != nil {
			return decimal.Zero, len(resp.Items), fmt.Errorf("unable to parse min_bid %q: %w", first.MinBid, err)
		}
		floorPrice = decimal.NewFromFloat(f)
	}

	return floorPrice, len(resp.Items), nil
}

// GetCollectionNFTsOnSale fetches NFTs currently listed for sale in a collection (e.g. Usernames or Numbers)
func (c *Client) GetCollectionNFTsOnSale(ctx context.Context, collectionAddr string, limit int, cursor string) (*NFTsOnSaleResponse, error) {
	if collectionAddr == "" {
		collectionAddr = UsernamesCollectionAddr
	}
	if limit <= 0 {
		limit = 20
	} else if limit > 100 {
		limit = 100
	}

	reqURL := fmt.Sprintf("%s/nfts/collections/%s/?limit=%d&filter_by=onsale", strings.TrimRight(c.BaseURL, "/"), collectionAddr, limit)
	if cursor != "" {
		reqURL += "&cursor=" + url.QueryEscape(cursor)
	}

	resp, err := c.doRequest(ctx, reqURL)
	if err != nil {
		return nil, fmt.Errorf("marketapp collection nfts request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, ErrUnauthorized
	}
	if resp.StatusCode == http.StatusNotFound {
		return &NFTsOnSaleResponse{Items: []NFTItem{}}, nil
	}
	if resp.StatusCode != http.StatusOK {
		bodyPreview, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("marketapp collection nfts status %d: %s", resp.StatusCode, string(bodyPreview))
	}

	var res NFTsOnSaleResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, fmt.Errorf("marketapp collection nfts decode failed: %w", err)
	}
	return &res, nil
}

// GetCollection fetches collection metadata from GET /v1/collections/ (per Marketapp OpenAPI spec)
func (c *Client) GetCollection(ctx context.Context) (*CollectionData, error) {
	return c.GetCollectionByAddress(ctx, CollectionAddr)
}

// GetCollectionByAddress fetches collection stats for a specific TON collection address from GET /v1/collections/
func (c *Client) GetCollectionByAddress(ctx context.Context, targetAddr string) (*CollectionData, error) {
	if targetAddr == "" {
		targetAddr = CollectionAddr
	}
	reqURL := fmt.Sprintf("%s/collections/", strings.TrimRight(c.BaseURL, "/"))
	resp, err := c.doRequest(ctx, reqURL)
	if err != nil {
		return nil, fmt.Errorf("marketapp collection request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusUnauthorized {
		return nil, nil
	}

	if resp.StatusCode != http.StatusOK {
		bodyPreview, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("marketapp collection error: status %d, body: %s", resp.StatusCode, string(bodyPreview))
	}

	rawBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("marketapp collection read failed: %w", err)
	}
	trimmed := bytes.TrimSpace(rawBody)
	if len(trimmed) == 0 {
		return nil, nil
	}

	// Official OpenAPI response for GET /v1/collections/ is []Collection
	if trimmed[0] == '[' {
		var cols []MarketAppCollection
		if err := json.Unmarshal(trimmed, &cols); err != nil {
			return nil, fmt.Errorf("marketapp collections decode failed: %w", err)
		}
		for _, col := range cols {
			if strings.EqualFold(col.Address, targetAddr) {
				return mapMarketAppCollectionToData(col), nil
			}
		}
		if len(cols) > 0 {
			return mapMarketAppCollectionToData(cols[0]), nil
		}
		return nil, nil
	}

	var data CollectionData
	if err := json.Unmarshal(trimmed, &data); err != nil {
		return nil, fmt.Errorf("marketapp collection decode failed: %w", err)
	}
	return &data, nil
}

func mapMarketAppCollectionToData(col MarketAppCollection) *CollectionData {
	out := &CollectionData{
		Name:    col.Name,
		Address: col.Address,
	}
	if col.ExtraData.Items != nil {
		out.TotalMinted = *col.ExtraData.Items
		out.ItemsCount = *col.ExtraData.Items
	}
	if col.ExtraData.Owners != nil {
		out.TotalOwners = *col.ExtraData.Owners
	}
	if col.ExtraData.Floor != nil {
		if v, err := strconv.ParseFloat(strings.TrimSpace(*col.ExtraData.Floor), 64); err == nil {
			if v > 1e6 {
				v /= 1e9
			}
			out.FloorPrice = math.Round(v*100) / 100
		}
	}
	if col.ExtraData.RentFloor != nil {
		if v, err := strconv.ParseFloat(strings.TrimSpace(*col.ExtraData.RentFloor), 64); err == nil {
			if v > 1e6 {
				v /= 1e9
			}
			out.RentFloorPrice = math.Round(v*100) / 100
		}
	}
	if col.ExtraData.Volume7d != nil {
		if v, err := strconv.ParseFloat(strings.TrimSpace(*col.ExtraData.Volume7d), 64); err == nil {
			if v > 1e11 {
				v /= 1e9
			}
			out.Volume7d = v
			out.Volume24h = v / 7.0
		}
	}
	if col.ExtraData.Volume30d != nil {
		if v, err := strconv.ParseFloat(strings.TrimSpace(*col.ExtraData.Volume30d), 64); err == nil {
			if v > 1e11 {
				v /= 1e9
			}
			out.Volume30d = v
			out.TotalVolume = v
		}
	}
	if col.ExtraData.OnSaleAll != nil {
		out.ActiveAuctions = *col.ExtraData.OnSaleAll
		if out.ItemsCount > 0 {
			out.ListedRatio = float64(*col.ExtraData.OnSaleAll) / float64(out.ItemsCount)
		}
	}
	return out
}

// GetItem fetches data for a specific username NFT by inspecting collection listings
func (c *Client) GetItem(ctx context.Context, username string) (*ItemData, error) {
	cleanName := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(username)), "@")
	if cleanName == "" {
		return nil, nil
	}

	// Query collection NFTs
	res, err := c.GetCollectionNFTsOnSale(ctx, UsernamesCollectionAddr, 50, "")
	if err != nil {
		if errors.Is(err, ErrUnauthorized) || errors.Is(err, ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}

	for _, item := range res.Items {
		itemClean := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(item.Name)), "@")
		if itemClean == cleanName {
			priceFloat, _ := strconv.ParseFloat(item.MinBid, 64)
			return &ItemData{
				Name:         item.Name,
				OwnerAddress: item.RealOwner,
				SaleStatus:   item.Status,
				BuyNowPrice:  priceFloat,
				HighestBid:   priceFloat,
			}, nil
		}
	}

	return nil, nil
}
