package giftchanges

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
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
	Name           string  `json:"name"`
	Rarity         float64 `json:"rarity,omitempty"`
	RarityPermille int     `json:"rarityPermille,omitempty"`
	TotalSupply    int     `json:"totalSupply,omitempty"`
}

func (m Model) GetRarityPermille() int {
	if m.RarityPermille > 0 {
		return m.RarityPermille
	}
	if m.Rarity > 0 {
		return int(math.Round(m.Rarity * 10.0))
	}
	return 20
}

type BackdropHex struct {
	CenterColor  string `json:"centerColor"`
	Center       string `json:"center"`
	EdgeColor    string `json:"edgeColor"`
	Edge         string `json:"edge"`
	PatternColor string `json:"patternColor"`
	Pattern      string `json:"pattern"`
	TextColor    string `json:"textColor"`
	Text         string `json:"text"`
}

func (b BackdropHex) GetCenter() string {
	if b.Center != "" {
		return b.Center
	}
	return b.CenterColor
}

func (b BackdropHex) GetEdge() string {
	if b.Edge != "" {
		return b.Edge
	}
	return b.EdgeColor
}

func (b BackdropHex) GetPattern() string {
	if b.Pattern != "" {
		return b.Pattern
	}
	return b.PatternColor
}

func (b BackdropHex) GetText() string {
	if b.Text != "" {
		return b.Text
	}
	return b.TextColor
}

type Backdrop struct {
	Name           string      `json:"name"`
	CenterColor    int         `json:"centerColor"`
	EdgeColor      int         `json:"edgeColor"`
	PatternColor   int         `json:"patternColor"`
	TextColor      int         `json:"textColor"`
	Hex            BackdropHex `json:"hex"`
	Rarity         float64     `json:"rarity,omitempty"`
	RarityPermille int         `json:"rarityPermille,omitempty"`
}

func (b Backdrop) GetRarityPermille() int {
	if b.RarityPermille > 0 {
		return b.RarityPermille
	}
	if b.Rarity > 0 {
		return int(math.Round(b.Rarity * 10.0))
	}
	return 20
}

type Symbol struct {
	Name           string  `json:"name"`
	Rarity         float64 `json:"rarity,omitempty"`
	RarityPermille int     `json:"rarityPermille,omitempty"`
}

func (s Symbol) GetRarityPermille() int {
	if s.RarityPermille > 0 {
		return s.RarityPermille
	}
	if s.Rarity > 0 {
		return int(math.Round(s.Rarity * 10.0))
	}
	return 20
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

	imgBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	// Bounded cache eviction: if cache exceeds 500 items, clear expired or prune
	if len(c.cache) > 500 {
		now := time.Now()
		for k, v := range c.cache {
			if now.After(v.expiresAt) {
				delete(c.cache, k)
			}
		}
	}
	c.cache[cacheKey] = &cacheItem{
		data:      imgBytes,
		expiresAt: time.Now().Add(7 * 24 * time.Hour), // 7 days TTL
	}
	c.mu.Unlock()

	return imgBytes, nil
}

// ModelEmoji represents custom emoji information from /emoji/:gift
type ModelEmoji struct {
	Name          string  `json:"name"`
	Rarity        float64 `json:"rarity"`
	CustomEmojiID string  `json:"customEmojiId"`
}

// GiftDateItem represents an entry from /dates
type GiftDateItem struct {
	ID           string `json:"id"`
	ReleasedAt   int64  `json:"releasedAt"`
	UpgradableAt *int64 `json:"upgradableAt"`
	Upgradable   bool   `json:"upgradable"`
	Auction      bool   `json:"auction"`
	Name         string `json:"name,omitempty"`
}

// GetGiftEmojis returns the official custom animated emoji IDs for models
func (c *Client) GetGiftEmojis(ctx context.Context, slug string) ([]ModelEmoji, error) {
	slug = strings.ToLower(strings.TrimSpace(slug))
	slug = strings.ReplaceAll(slug, "_", "-")
	cacheKey := "gift_emojis:" + slug

	c.mu.RLock()
	if item, ok := c.cache[cacheKey]; ok && time.Now().Before(item.expiresAt) {
		c.mu.RUnlock()
		return item.data.([]ModelEmoji), nil
	}
	c.mu.RUnlock()

	var emojis []ModelEmoji
	if err := c.get(ctx, "/emoji/"+url.PathEscape(slug), &emojis); err != nil {
		return nil, err
	}

	c.mu.Lock()
	c.cache[cacheKey] = &cacheItem{
		data:      emojis,
		expiresAt: time.Now().Add(24 * time.Hour),
	}
	c.mu.Unlock()

	return emojis, nil
}

// GetDates returns the release and upgrade dates for all gifts
func (c *Client) GetDates(ctx context.Context) ([]GiftDateItem, error) {
	cacheKey := "gift_dates"

	c.mu.RLock()
	if item, ok := c.cache[cacheKey]; ok && time.Now().Before(item.expiresAt) {
		c.mu.RUnlock()
		return item.data.([]GiftDateItem), nil
	}
	c.mu.RUnlock()

	var dates []GiftDateItem
	if err := c.get(ctx, "/dates", &dates); err != nil {
		return nil, err
	}

	c.mu.Lock()
	c.cache[cacheKey] = &cacheItem{
		data:      dates,
		expiresAt: time.Now().Add(12 * time.Hour),
	}
	c.mu.Unlock()

	return dates, nil
}

// GetIDs returns the mapping of 64-bit Telegram contract IDs to gift names
func (c *Client) GetIDs(ctx context.Context) (map[string]string, error) {
	cacheKey := "gift_ids"

	c.mu.RLock()
	if item, ok := c.cache[cacheKey]; ok && time.Now().Before(item.expiresAt) {
		c.mu.RUnlock()
		return item.data.(map[string]string), nil
	}
	c.mu.RUnlock()

	var ids map[string]string
	if err := c.get(ctx, "/ids", &ids); err != nil {
		return nil, err
	}

	c.mu.Lock()
	c.cache[cacheKey] = &cacheItem{
		data:      ids,
		expiresAt: time.Now().Add(12 * time.Hour),
	}
	c.mu.Unlock()

	return ids, nil
}



