package getgems

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	BaseURL string
	HTTP    *http.Client
}

func NewClient() *Client {
	return &Client{
		BaseURL: "https://api.getgems.io/graphql",
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

type GraphQLResponse struct {
	Data struct {
		AlphaNftCollectionStats struct {
			FloorPrice  string `json:"floorPrice"`
			TotalVolume string `json:"totalVolume"`
			OwnersCount int    `json:"ownersCount"`
			ItemsCount  int    `json:"itemsCount"`
		} `json:"alphaNftCollectionStats"`
	} `json:"data"`
}

func (c *Client) GetCollectionStats(addr string) (*GraphQLResponse, error) {
	query := `
	query NftCollectionStats($address: String!) {
	  alphaNftCollectionStats(address: $address) {
		floorPrice
		totalVolume
		ownersCount
		itemsCount
	  }
	}`

	body, _ := json.Marshal(map[string]interface{}{
		"query":     query,
		"variables": map[string]interface{}{"address": addr},
	})

	resp, err := c.HTTP.Post(c.BaseURL, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("getgems error: %s", resp.Status)
	}

	var result GraphQLResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}
