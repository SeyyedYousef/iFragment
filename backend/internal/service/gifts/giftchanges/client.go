package giftchanges

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const (
	BaseAPIURL = "https://api.changes.tg"
	BaseCDNURL = "https://cdn.changes.tg"
)

// Client provides access to official GiftChanges live API
type Client struct {
	httpClient *http.Client
	mu         sync.RWMutex
	cache      map[string]*cacheItem
}

type cacheItem struct {
	data      any
	expiresAt time.Time
}

func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 6 * time.Second,
		},
		cache: make(map[string]*cacheItem),
	}
}

// TotalStats represents the /total endpoint response
type TotalStats struct {
	Gifts struct {
		Total      int `json:"total"`
		Upgradable int `json:"upgradable"`
		Unlimited  int `json:"unlimited"`
		Limited    int `json:"limited"`
	} `json:"gifts"`
	Models    int `json:"models"`
	Backdrops int `json:"backdrops"`
	Patterns  int `json:"patterns"`
}

// GiftDetail represents /gift/:name endpoint response
type GiftDetail struct {
	Gift      GiftInfo   `json:"gift"`
	Models    []Model    `json:"models"`
	Backdrops []Backdrop `json:"backdrops"`
	Symbols   []Symbol   `json:"symbols"`
}

type GiftInfo struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	Slug               string `json:"slug"`
	TotalSupply        int    `json:"totalSupply"`
	AvailabilityRemain int    `json:"availabilityRemains"`
	UpgradedCount      int    `json:"upgradedCount"`
	Upgradable         bool   `json:"upgradable"`
	Limited            bool   `json:"limited"`
	Craftable          bool   `json:"craftable"`
}

type Model struct {
	Name           string `json:"name"`
	RarityPermille int    `json:"rarityPermille"`
	TotalSupply    int    `json:"totalSupply,omitempty"`
}

type BackdropHex struct {
	Center  string `json:"center"`
	Edge    string `json:"edge"`
	Pattern string `json:"pattern"`
	Text    string `json:"text"`
}

type Backdrop struct {
	Name           string      `json:"name"`
	CenterColor    int         `json:"centerColor"`
	EdgeColor      int         `json:"edgeColor"`
	PatternColor   int         `json:"patternColor"`
	TextColor      int         `json:"textColor"`
	Hex            BackdropHex `json:"hex"`
	RarityPermille int         `json:"rarityPermille"`
}

type Symbol struct {
	Name           string `json:"name"`
	RarityPermille int    `json:"rarityPermille"`
}

func (c *Client) get(ctx context.Context, endpoint string, target any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, BaseAPIURL+endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "iFragment/1.0 (Telegram Mini App; Bot: @iFragmentBot)")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("api.changes.tg responded with status %d", resp.StatusCode)
	}

	return json.NewDecoder(resp.Body).Decode(target)
}

// GetTotal returns live aggregate stats across the ecosystem
func (c *Client) GetTotal(ctx context.Context) (*TotalStats, error) {
	cacheKey := "total_stats"
	c.mu.RLock()
	if item, ok := c.cache[cacheKey]; ok && time.Now().Before(item.expiresAt) {
		c.mu.RUnlock()
		return item.data.(*TotalStats), nil
	}
	c.mu.RUnlock()

	var stats TotalStats
	if err := c.get(ctx, "/total", &stats); err != nil {
		return nil, err
	}

	c.mu.Lock()
	c.cache[cacheKey] = &cacheItem{
		data:      &stats,
		expiresAt: time.Now().Add(10 * time.Minute),
	}
	c.mu.Unlock()

	return &stats, nil
}

// GetGifts returns the live list of all 120 upgradable gift names
func (c *Client) GetGifts(ctx context.Context) ([]string, error) {
	cacheKey := "gifts_list"
	c.mu.RLock()
	if item, ok := c.cache[cacheKey]; ok && time.Now().Before(item.expiresAt) {
		c.mu.RUnlock()
		return item.data.([]string), nil
	}
	c.mu.RUnlock()

	var names []string
	if err := c.get(ctx, "/gifts", &names); err != nil {
		return nil, err
	}

	c.mu.Lock()
	c.cache[cacheKey] = &cacheItem{
		data:      names,
		expiresAt: time.Now().Add(30 * time.Minute),
	}
	c.mu.Unlock()

	return names, nil
}

// GetGiftDetail returns real models, backdrops, and symbols for a given gift with 12h cache
func (c *Client) GetGiftDetail(ctx context.Context, giftNameOrSlug string) (*GiftDetail, error) {
	slug := strings.ToLower(strings.TrimSpace(giftNameOrSlug))
	slug = strings.ReplaceAll(slug, "_", "-")
	cacheKey := "gift_detail:" + slug

	c.mu.RLock()
	if item, ok := c.cache[cacheKey]; ok && time.Now().Before(item.expiresAt) {
		c.mu.RUnlock()
		return item.data.(*GiftDetail), nil
	}
	c.mu.RUnlock()

	var detail GiftDetail
	if err := c.get(ctx, "/gift/"+url.PathEscape(slug), &detail); err != nil {
		// Try title casing if hyphenated failed
		altSlug := strings.ReplaceAll(slug, "-", " ")
		if err2 := c.get(ctx, "/gift/"+url.PathEscape(altSlug), &detail); err2 != nil {
			return nil, err
		}
	}

	c.mu.Lock()
	c.cache[cacheKey] = &cacheItem{
		data:      &detail,
		expiresAt: time.Now().Add(12 * time.Hour), // 12 Hours TTL
	}
	c.mu.Unlock()

	return &detail, nil
}

// GetGiftImageBytes fetches image from api.changes.tg and caches for 7 days
func (c *Client) GetGiftImageBytes(ctx context.Context, slug, model string) ([]byte, error) {
	slug = strings.ToLower(strings.TrimSpace(slug))
	slug = strings.ReplaceAll(slug, "_", "-")

	if model == "" {
		detail, err := c.GetGiftDetail(ctx, slug)
		if err == nil && detail != nil && len(detail.Models) > 0 {
			model = detail.Models[0].Name
		} else {
			model = "1"
		}
	}

	cacheKey := fmt.Sprintf("gift_img:%s:%s", slug, model)
	c.mu.RLock()
	if item, ok := c.cache[cacheKey]; ok && time.Now().Before(item.expiresAt) {
		c.mu.RUnlock()
		return item.data.([]byte), nil
	}
	c.mu.RUnlock()

	reqURL := fmt.Sprintf("%s/model/%s/%s.png?size=256", BaseAPIURL, url.PathEscape(slug), url.PathEscape(model))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "iFragment/1.0 (Telegram Mini App)")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("image fetch failed with status %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}


