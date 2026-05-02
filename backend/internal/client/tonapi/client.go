package tonapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
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
		HTTP:    &http.Client{},
	}
}

type CollectionStats struct {
	TotalSupply int    `json:"total_supply"`
	HoldersCount int   `json:"holders_count"`
}

type NFTCollection struct {
	Address      string `json:"address"`
	NextItemIndex int   `json:"next_item_index"`
	// Add more fields as needed
}

const UsernamesCollectionAddr = "EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi"

func (c *Client) GetCollection(addr string) (*NFTCollection, error) {
	url := fmt.Sprintf("%s/nfts/collections/%s", c.BaseURL, addr)
	
	req, _ := http.NewRequest("GET", url, nil)
	if c.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
	}

	resp, err := c.HTTP.Do(req)
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
