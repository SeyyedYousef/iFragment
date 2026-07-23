package fragment

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
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
	BaseURL    string
	HTTP       *http.Client
	fragmentCB *gobreaker.CircuitBreaker
}

func NewClient() *Client {
	cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        "fragment-scraper",
		MaxRequests: 3,
		Interval:    60 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(c gobreaker.Counts) bool {
			return c.ConsecutiveFailures > 5
		},
	})
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
		fragmentCB: cb,
	}
}

func (c *Client) CheckUsername(ctx context.Context, username string) (Status, error) {
	res, err := c.fragmentCB.Execute(func() (any, error) {
		return c.checkInternal(ctx, username)
	})
	if err != nil {
		return StatusUnknown, err
	}
	return res.(Status), nil
}

func (c *Client) newRequest(ctx context.Context, endpoint string) (*http.Request, error) {
	reqURL := fmt.Sprintf("%s%s", c.BaseURL, endpoint)
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	return req, nil
}

func (c *Client) checkInternal(ctx context.Context, username string) (Status, error) {
	endpoint := fmt.Sprintf("/username/%s", url.PathEscape(username))
	req, err := c.newRequest(ctx, endpoint)
	if err != nil {
		return StatusUnknown, err
	}

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return StatusUnknown, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		io.Copy(io.Discard, resp.Body)
		return StatusAvailable, nil
	}
	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, resp.Body)
		return StatusUnknown, fmt.Errorf("fragment scraper returned status %d: %s", resp.StatusCode, resp.Status)
	}

	// Limit reader to 2MB to protect memory
	limitReader := io.LimitReader(resp.Body, 2*1024*1024)
	doc, err := goquery.NewDocumentFromReader(limitReader)
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

	// 5. Fallback using OpenGraph meta tags (often more stable than UI layout)
	metaDesc, _ := doc.Find("meta[property='og:description']").Attr("content")
	metaTitle, _ := doc.Find("meta[property='og:title']").Attr("content")
	metaText := strings.ToLower(metaDesc + " " + metaTitle)

	if strings.Contains(metaText, "bid") || strings.Contains(metaText, "auction") {
		return StatusAuction, nil
	}
	if strings.Contains(metaText, "buy now") || strings.Contains(metaText, "for sale") {
		return StatusSale, nil
	}
	if strings.Contains(metaText, "owner") || strings.Contains(metaText, "taken") || strings.Contains(metaText, "sold") {
		return StatusSold, nil
	}
	if strings.Contains(metaText, "available") {
		return StatusAvailable, nil
	}

	// 6. Last resort Fallback strings.Contains checks on full text if selectors and meta did not match
	fullText := strings.ToLower(doc.Text())
	if strings.Contains(fullText, "bid") || strings.Contains(fullText, "auction") || strings.Contains(fullText, "ends in") {
		return StatusAuction, nil
	}
	if strings.Contains(fullText, "buy now") || strings.Contains(fullText, "for sale") || strings.Contains(fullText, "fixed price") {
		return StatusSale, nil
	}
	if strings.Contains(fullText, "owner") || strings.Contains(fullText, "taken") || strings.Contains(fullText, "sold") {
		return StatusSold, nil
	}
	if strings.Contains(fullText, "available") {
		return StatusAvailable, nil
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
	runes := []rune(cleaned)
	if len(runes) <= maxLen {
		return cleaned
	}
	return string(runes[:maxLen]) + "..."
}

type HistoricalSale struct {
	PriceTON float64
	SaleDate time.Time
}

func (c *Client) GetHistoricalSales(ctx context.Context, username string) ([]HistoricalSale, error) {
	res, err := c.fragmentCB.Execute(func() (any, error) {
		return c.getHistoricalSalesInternal(ctx, username)
	})
	if err != nil {
		return nil, err
	}
	return res.([]HistoricalSale), nil
}

func (c *Client) getHistoricalSalesInternal(ctx context.Context, username string) ([]HistoricalSale, error) {
	endpoint := fmt.Sprintf("/username/%s", url.PathEscape(username))
	req, err := c.newRequest(ctx, endpoint)
	if err != nil {
		return nil, err
	}

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, resp.Body)
		return nil, fmt.Errorf("fragment scraper returned status %d", resp.StatusCode)
	}

	limitReader := io.LimitReader(resp.Body, 2*1024*1024)
	doc, err := goquery.NewDocumentFromReader(limitReader)
	if err != nil {
		return nil, err
	}

	var sales []HistoricalSale
	doc.Find("table.tm-table tbody tr").Each(func(i int, s *goquery.Selection) {
		priceText := s.Find("td").Eq(0).Find(".tm-value").Text()
		priceText = strings.ReplaceAll(priceText, ",", "")
		priceText = strings.TrimSpace(priceText)
		if priceText == "" {
			return
		}
		var price float64
		_, err := fmt.Sscanf(priceText, "%f", &price)
		if err != nil {
			return
		}

		dateText, exists := s.Find("td").Eq(1).Find("time").Attr("datetime")
		if !exists {
			return
		}
		saleDate, err := time.Parse(time.RFC3339, dateText)
		if err != nil {
			saleDate, err = time.Parse("2006-01-02T15:04:05-07:00", dateText)
			if err != nil {
				return
			}
		}

		sales = append(sales, HistoricalSale{
			PriceTON: price,
			SaleDate: saleDate,
		})
	})

	return sales, nil
}
