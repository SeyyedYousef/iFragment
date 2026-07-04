package marketapp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

const CollectionAddr = "EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi"

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

// CollectionData represents global collection stats from Marketapp
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

// ItemData represents data for a specific username NFT
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

func (c *Client) doRequest(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
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

// GetCollection fetches global collection data
func (c *Client) GetCollection(ctx context.Context) (*CollectionData, error) {
	url := fmt.Sprintf("%s/collections/%s", c.BaseURL, CollectionAddr)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("marketapp collection request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Read response body to diagnose rejection reason
		bodyPreview, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		slog.Error("MARKETAPP_REQUEST_FAILED",
			"url", url,
			"status", resp.StatusCode,
			"body", string(bodyPreview),
			"authenticated", c.getToken() != "",
		)
		// Reconstruct body for caller
		resp.Body = io.NopCloser(bytes.NewReader(bodyPreview))
		return nil, fmt.Errorf("marketapp collection error: status %d, body: %s", resp.StatusCode, string(bodyPreview))
	}

	var data CollectionData
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("marketapp collection decode failed: %w", err)
	}
	return &data, nil
}

// GetItem fetches data for a specific username NFT
func (c *Client) GetItem(ctx context.Context, username string) (*ItemData, error) {
	url := fmt.Sprintf("%s/collections/%s/items/%s", c.BaseURL, CollectionAddr, username)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("marketapp item request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil // Not an NFT yet
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("marketapp item error: %s", resp.Status)
	}

	var data ItemData
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("marketapp item decode failed: %w", err)
	}
	return &data, nil
}
