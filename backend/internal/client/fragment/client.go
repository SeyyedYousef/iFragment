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
	// 1. Check for Auction
	if doc.Find(".tm-section-bid, .tm-auction-active").Length() > 0 {
		return StatusAuction, nil
	}
	
	// 2. Check for Sale (Fixed Price)
	if doc.Find(".tm-section-buy, .tm-buy-fixed").Length() > 0 {
		return StatusSale, nil
	}

	// 3. Check for Taken (Owner present)
	if doc.Find(".tm-owner, .tm-owner-address, .tm-main-owner").Length() > 0 {
		return StatusSold, nil
	}

	// 4. Check status labels
	statusLabel := strings.ToLower(doc.Find(".tm-status-avail, .tm-section-header-status").Text())
	if strings.Contains(statusLabel, "available") {
		return StatusAvailable, nil
	}
	if strings.Contains(statusLabel, "sold") || strings.Contains(statusLabel, "taken") {
		return StatusSold, nil
	}

	return StatusSold, nil // Default to sold if we see it exists but no buy/bid action
}
