package fragment

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/sony/gobreaker"
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

var fragmentCB = gobreaker.NewCircuitBreaker(gobreaker.Settings{
	Name:        "fragment-scraper",
	MaxRequests: 3,
	Interval:    60 * time.Second,
	Timeout:     30 * time.Second,
	ReadyToTrip: func(c gobreaker.Counts) bool {
		return c.ConsecutiveFailures > 5
	},
})

func (c *Client) CheckUsername(ctx context.Context, username string) (Status, error) {
	res, err := fragmentCB.Execute(func() (any, error) {
		return c.checkInternal(ctx, username)
	})
	if err != nil {
		return StatusUnknown, err
	}
	return res.(Status), nil
}

func (c *Client) checkInternal(ctx context.Context, username string) (Status, error) {
	url := fmt.Sprintf("%s/username/%s", c.BaseURL, username)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return StatusUnknown, err
	}
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

	// If we get here on an HTTP 200, the scraper could not parse any known DOM selectors.
	// This might indicate a change in Fragment's UI layout, which is highly critical to log.
	slog.Warn("Fragment scraper failed to determine status from DOM selectors on valid HTTP response", 
		"username", username, 
		"status_code", resp.StatusCode,
		"html_preview", truncateString(doc.Text(), 200),
	)

	return StatusUnknown, nil // Default to unknown if we see it exists but no status matches
}

func truncateString(s string, maxLen int) string {
	cleaned := strings.Join(strings.Fields(s), " ")
	if len(cleaned) <= maxLen {
		return cleaned
	}
	return cleaned[:maxLen] + "..."
}
