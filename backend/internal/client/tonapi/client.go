package tonapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type Client struct {
	BaseURL string
	APIKey  string
	HTTP    *http.Client
}

func NewClient() *Client {
	return &Client{
		BaseURL: "https://tonapi.io/v2",
		APIKey:  os.Getenv("TONAPI_KEY"),
		HTTP:    &http.Client{Timeout: 10 * time.Second},
	}
}

const UsernamesCollectionAddr = "EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi"

type NFTCollection struct {
	Address       string `json:"address"`
	NextItemIndex int    `json:"next_item_index"`
}

type NFTItem struct {
	Address  string `json:"address"`
	Index    int    `json:"index"`
	Verified bool   `json:"verified"`
	Owner    struct {
		Address string `json:"address"`
	} `json:"owner"`
	Sale *NFTSale `json:"sale"`
	DNS  string   `json:"dns"`
}

type NFTSale struct {
	Address    string `json:"address"`
	Market     string `json:"market"`
	Price      Price  `json:"price"`
	MarketFee  int64  `json:"market_fee"`
	NetworkFee int64  `json:"network_fee"`
}

type Price struct {
	Value      string `json:"value"`
	TokenName  string `json:"token_name"`
}

type WalletInfo struct {
	Address string `json:"address"`
	Balance int64  `json:"balance"`
	Status  string `json:"status"`
}

type NFTItems struct {
	Items []NFTItem `json:"nft_items"`
}

type Transfer struct {
	From struct {
		Address string `json:"address"`
	} `json:"from"`
	To struct {
		Address string `json:"address"`
	} `json:"to"`
	TransactionHash string `json:"transaction_hash"`
	Timestamp       int64  `json:"timestamp"`
}

type TransferHistory struct {
	Transfers []Transfer `json:"nft_transfers"`
}

func (c *Client) doRequest(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	if c.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
	}
	return c.HTTP.Do(req)
}

// GetCollection fetches collection-level data
func (c *Client) GetCollection(ctx context.Context, addr string) (*NFTCollection, error) {
	url := fmt.Sprintf("%s/nfts/collections/%s", c.BaseURL, addr)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi error: %s", resp.Status)
	}

	var collection NFTCollection
	if err := json.NewDecoder(resp.Body).Decode(&collection); err != nil {
		return nil, err
	}
	return &collection, nil
}

// GetNFTByDNS resolves a username to its NFT item via TON DNS
func (c *Client) GetNFTByDNS(ctx context.Context, username string) (*NFTItem, error) {
	url := fmt.Sprintf("%s/dns/%s.t.me/resolve", c.BaseURL, username)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi dns error: %s", resp.Status)
	}

	var item NFTItem
	if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
		return nil, err
	}
	return &item, nil
}

// GetNFTItem fetches a specific NFT item by its address
func (c *Client) GetNFTItem(ctx context.Context, nftAddr string) (*NFTItem, error) {
	url := fmt.Sprintf("%s/nfts/%s", c.BaseURL, nftAddr)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi nft error: %s", resp.Status)
	}

	var item NFTItem
	if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
		return nil, err
	}
	return &item, nil
}

// GetWalletInfo fetches balance and status of a TON wallet
func (c *Client) GetWalletInfo(ctx context.Context, address string) (*WalletInfo, error) {
	url := fmt.Sprintf("%s/accounts/%s", c.BaseURL, address)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi wallet error: %s", resp.Status)
	}

	var info WalletInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	return &info, nil
}

// GetOwnerNFTs fetches all NFTs owned by a wallet in the usernames collection
func (c *Client) GetOwnerNFTs(ctx context.Context, ownerAddr string) (*NFTItems, error) {
	url := fmt.Sprintf("%s/accounts/%s/nfts?collection=%s&limit=100", c.BaseURL, ownerAddr, UsernamesCollectionAddr)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi owner nfts error: %s", resp.Status)
	}

	var items NFTItems
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, err
	}
	return &items, nil
}

// GetNFTTransfers fetches transfer history for an NFT
func (c *Client) GetNFTTransfers(ctx context.Context, nftAddr string) (*TransferHistory, error) {
	url := fmt.Sprintf("%s/nfts/%s/history?limit=50", c.BaseURL, nftAddr)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi transfers error: %s", resp.Status)
	}

	var history TransferHistory
	if err := json.NewDecoder(resp.Body).Decode(&history); err != nil {
		return nil, err
	}
	return &history, nil
}
