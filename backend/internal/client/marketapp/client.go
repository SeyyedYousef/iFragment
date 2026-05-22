package marketapp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

const CollectionAddr = "EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi"

type Client struct {
	BaseURL string
	Token   string
	HTTP    *http.Client
}

func NewClient() *Client {
	return &Client{
		BaseURL: "https://api.marketapp.ws/v1",
		Token:   os.Getenv("MARKETAPP_TOKEN"),
		HTTP:    &http.Client{Timeout: 10 * time.Second},
	}
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
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
	req.Header.Set("Accept", "application/json")
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
		return nil, fmt.Errorf("marketapp collection error: %s", resp.Status)
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
