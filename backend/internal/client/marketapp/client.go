package marketapp

import (
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
	BaseURL    string
	Tokens     []string
	tokenIndex uint64
	HTTP       *http.Client
}

func NewClient() *Client {
	var tokens []string
	if tokensStr := os.Getenv("MARKETAPP_TOKENS"); tokensStr != "" {
		for _, t := range strings.Split(tokensStr, ",") {
			if trimmed := strings.TrimSpace(t); trimmed != "" {
				tokens = append(tokens, trimmed)
			}
		}
	} else if singleToken := os.Getenv("MARKETAPP_TOKEN"); singleToken != "" {
		tokens = []string{singleToken}
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

// CollectionData represents global collection stats from Marketapp (legacy compatibility)
type CollectionData struct {
	Name           string          `json:"name"`
	Description    string          `json:"description"`
	Address        string          `json:"address"`
	TotalMinted    int             `json:"total_minted"`
	ItemsCount     int             `json:"items_count"`
	TotalOwners    int             `json:"total_owners"`
	FloorPrice     float64         `json:"floor_price"`
	TotalVolume    float64         `json:"total_volume"`
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
	token := c.getToken()
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "iFragment/1.0 (Telegram Mini App)")
	return c.HTTP.Do(req)
}

// GetGiftsOnSale fetches gifts on sale matching the filter parameters
func (c *Client) GetGiftsOnSale(ctx context.Context, params GiftFilterParams) (*GiftsOnSaleResponse, error) {
	u, err := url.Parse(fmt.Sprintf("%s/gifts/onsale/", c.BaseURL))
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
	if params.Symbol != "" {
		q.Set("symbol", params.Symbol)
	}
	if params.Backdrop != "" {
		q.Set("backdrop", params.Backdrop)
	}
	if params.CollectionAddress != "" {
		q.Set("collection_address", params.CollectionAddress)
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

// GetGiftFloor fetches the lowest active on-sale price and listing count for a specific gift model
func (c *Client) GetGiftFloor(ctx context.Context, model string) (decimal.Decimal, int, error) {
	resp, err := c.GetGiftsOnSale(ctx, GiftFilterParams{
		Model:  model,
		SortBy: "min_bid_asc",
		Limit:  20,
	})
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
		// Try parsing float
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

	reqURL := fmt.Sprintf("%s/nfts/collections/%s/?limit=%d&filter_by=onsale", c.BaseURL, collectionAddr, limit)
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

// GetCollection fetches collection metadata with resilient fallback
func (c *Client) GetCollection(ctx context.Context) (*CollectionData, error) {
	url := fmt.Sprintf("%s/collections/%s", c.BaseURL, CollectionAddr)
	resp, err := c.doRequest(ctx, url)
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

	var data CollectionData
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("marketapp collection decode failed: %w", err)
	}
	return &data, nil
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
