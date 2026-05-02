package fragment

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

type Status string

const (
	StatusAvailable Status = "available"
	StatusAuction   Status = "on_auction"
	StatusSold      Status = "taken"
	StatusSale      Status = "on_sale"
	StatusUnknown   Status = "unknown"
)

type Client struct {
	BaseURL string
	HTTP    *http.Client
}

func NewClient() *Client {
	return &Client{
		BaseURL: "https://fragment.com",
		HTTP:    &http.Client{},
	}
}

func (c *Client) CheckUsername(username string) (Status, error) {
	url := fmt.Sprintf("%s/username/%s", c.BaseURL, username)
	
	req, _ := http.NewRequest("GET", url, nil)
	// Important: Use a browser-like User-Agent to avoid being blocked
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return StatusUnknown, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return StatusAvailable, nil
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return StatusUnknown, err
	}

	// Logic to determine status based on DOM elements
	if doc.Find(".tm-section-bid").Length() > 0 {
		return StatusAuction, nil
	}
	
	if doc.Find(".tm-section-buy").Length() > 0 {
		return StatusSale, nil
	}

	// Check for "Owner" or similar to determine if taken
	if doc.Find(".tm-owner").Length() > 0 || doc.Find(".tm-owner-address").Length() > 0 {
		return StatusSold, nil
	}

	// Check if it's available for bidding/unavailable
	statusText := strings.ToLower(doc.Find(".tm-status-avail").Text())
	if strings.Contains(statusText, "available") {
		return StatusAvailable, nil
	}

	return StatusSold, nil // Default to sold if we see it exists but no buy/bid action
}
