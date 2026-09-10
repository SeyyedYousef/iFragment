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

type ParserConfidence string

const (
	ConfidenceExactSelector ParserConfidence = "exact_selector"
	ConfidenceOpenGraph     ParserConfidence = "opengraph"
	ConfidenceFallbackText  ParserConfidence = "fallback_text"
	ConfidenceNone          ParserConfidence = "none"
)

type CheckResult struct {
	Status     Status           `json:"status"`
	Confidence ParserConfidence `json:"confidence"`
	Source     string           `json:"source"`
	CheckedAt  time.Time        `json:"checked_at"`
}

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
	res, err := c.CheckUsernameWithConfidence(ctx, username)
	if err != nil {
		return StatusUnknown, err
	}
	return res.Status, nil
}

func (c *Client) CheckUsernameWithConfidence(ctx context.Context, username string) (CheckResult, error) {
	res, err := c.fragmentCB.Execute(func() (any, error) {
		return c.checkInternal(ctx, username)
	})
	if err != nil {
		return CheckResult{
			Status:     StatusUnknown,
			Confidence: ConfidenceNone,
			Source:     "fragment_scraper",
			CheckedAt:  time.Now().UTC(),
		}, err
	}
	return res.(CheckResult), nil
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

func (c *Client) checkInternal(ctx context.Context, username string) (CheckResult, error) {
	now := time.Now().UTC()
	endpoint := fmt.Sprintf("/username/%s", url.PathEscape(username))
	req, err := c.newRequest(ctx, endpoint)
	if err != nil {
		return CheckResult{Status: StatusUnknown, Confidence: ConfidenceNone, Source: "fragment_scraper", CheckedAt: now}, err
	}

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return CheckResult{Status: StatusUnknown, Confidence: ConfidenceNone, Source: "fragment_scraper", CheckedAt: now}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		io.Copy(io.Discard, resp.Body)
		return CheckResult{
			Status:     StatusAvailable,
			Confidence: ConfidenceExactSelector,
			Source:     "fragment_http_404",
			CheckedAt:  now,
		}, nil
	}
	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, resp.Body)
		return CheckResult{
			Status:     StatusUnknown,
			Confidence: ConfidenceNone,
			Source:     "fragment_http_error",
			CheckedAt:  now,
		}, fmt.Errorf("fragment scraper returned status %d: %s", resp.StatusCode, resp.Status)
	}

	// Limit reader to 2MB to protect memory
	limitReader := io.LimitReader(resp.Body, 2*1024*1024)
	doc, err := goquery.NewDocumentFromReader(limitReader)
	if err != nil {
		return CheckResult{Status: StatusUnknown, Confidence: ConfidenceNone, Source: "fragment_html_parse_error", CheckedAt: now}, err
	}

	// Logic to determine status based on DOM elements
	// 1. Check for Auction (Exact Selector)
	if doc.Find(".tm-section-bid, .tm-auction-active").Length() > 0 {
		return CheckResult{Status: StatusAuction, Confidence: ConfidenceExactSelector, Source: "fragment_dom_bid", CheckedAt: now}, nil
	}

	// 2. Check for Sale (Fixed Price - Exact Selector)
	if doc.Find(".tm-section-buy, .tm-buy-fixed").Length() > 0 {
		return CheckResult{Status: StatusSale, Confidence: ConfidenceExactSelector, Source: "fragment_dom_buy", CheckedAt: now}, nil
	}

	// 3. Check for Taken (Owner present - Exact Selector)
	if doc.Find(".tm-owner, .tm-owner-address, .tm-main-owner").Length() > 0 {
		return CheckResult{Status: StatusSold, Confidence: ConfidenceExactSelector, Source: "fragment_dom_owner", CheckedAt: now}, nil
	}

	// 4. Check status labels (Exact Selector)
	statusLabel := strings.ToLower(doc.Find(".tm-status-avail, .tm-section-header-status").Text())
	if strings.Contains(statusLabel, "available") {
		return CheckResult{Status: StatusAvailable, Confidence: ConfidenceExactSelector, Source: "fragment_dom_label", CheckedAt: now}, nil
	}
	if strings.Contains(statusLabel, "sold") || strings.Contains(statusLabel, "taken") {
		return CheckResult{Status: StatusSold, Confidence: ConfidenceExactSelector, Source: "fragment_dom_label", CheckedAt: now}, nil
	}

	// 5. Fallback using OpenGraph meta tags (often more stable than UI layout)
	metaDesc, _ := doc.Find("meta[property='og:description']").Attr("content")
	metaTitle, _ := doc.Find("meta[property='og:title']").Attr("content")
	metaText := strings.ToLower(metaDesc + " " + metaTitle)

	if strings.Contains(metaText, "bid") || strings.Contains(metaText, "auction") {
		return CheckResult{Status: StatusAuction, Confidence: ConfidenceOpenGraph, Source: "fragment_meta_og", CheckedAt: now}, nil
	}
	if strings.Contains(metaText, "buy now") || strings.Contains(metaText, "for sale") {
		return CheckResult{Status: StatusSale, Confidence: ConfidenceOpenGraph, Source: "fragment_meta_og", CheckedAt: now}, nil
	}
	if strings.Contains(metaText, "owner") || strings.Contains(metaText, "taken") || strings.Contains(metaText, "sold") {
		return CheckResult{Status: StatusSold, Confidence: ConfidenceOpenGraph, Source: "fragment_meta_og", CheckedAt: now}, nil
	}
	if strings.Contains(metaText, "available") {
		return CheckResult{Status: StatusAvailable, Confidence: ConfidenceOpenGraph, Source: "fragment_meta_og", CheckedAt: now}, nil
	}

	// 6. Last resort Fallback strings.Contains checks on full text if selectors and meta did not match
	fullText := strings.ToLower(doc.Text())
	if strings.Contains(fullText, "bid") || strings.Contains(fullText, "auction") || strings.Contains(fullText, "ends in") {
		return CheckResult{Status: StatusAuction, Confidence: ConfidenceFallbackText, Source: "fragment_text_fallback", CheckedAt: now}, nil
	}
	if strings.Contains(fullText, "buy now") || strings.Contains(fullText, "for sale") || strings.Contains(fullText, "fixed price") {
		return CheckResult{Status: StatusSale, Confidence: ConfidenceFallbackText, Source: "fragment_text_fallback", CheckedAt: now}, nil
	}
	if strings.Contains(fullText, "owner") || strings.Contains(fullText, "taken") || strings.Contains(fullText, "sold") {
		return CheckResult{Status: StatusSold, Confidence: ConfidenceFallbackText, Source: "fragment_text_fallback", CheckedAt: now}, nil
	}
	if strings.Contains(fullText, "available") {
		return CheckResult{Status: StatusAvailable, Confidence: ConfidenceFallbackText, Source: "fragment_text_fallback", CheckedAt: now}, nil
	}

	// If we get here on an HTTP 200, the scraper could not parse any known DOM selectors.
	slog.Warn("Fragment scraper failed to determine status from DOM selectors on valid HTTP response",
		"username", username,
		"status_code", resp.StatusCode,
		"html_preview", truncateString(doc.Text(), 200),
	)

	return CheckResult{
		Status:     StatusUnknown,
		Confidence: ConfidenceNone,
		Source:     "fragment_unparsed",
		CheckedAt:  now,
	}, nil
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
