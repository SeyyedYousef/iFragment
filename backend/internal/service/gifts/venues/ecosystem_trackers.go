package venues

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
)

const (
	GiftAssetBaseURL = "https://api.giftasset.dev/v1"
	SeeTgBaseURL     = "https://see.tg/api/v1"
)

// EcosystemVenueQuote holds live floor and volume metrics from specialized trackers (GiftAsset & see.tg)
type EcosystemVenueQuote struct {
	VenueID        VenueID         `json:"venue_id"`
	FloorPriceGRAM decimal.Decimal `json:"floor_price_gram"`
	Volume24hGRAM  decimal.Decimal `json:"volume_24h_gram"`
	Volume7dGRAM   decimal.Decimal `json:"volume_7d_gram"`
	ActiveListings int             `json:"active_listings"`
	UpgradedCount  int             `json:"upgraded_count,omitempty"`
	HoldersCount   int             `json:"holders_count,omitempty"`
	Source         string          `json:"source"` // "giftasset.dev" or "see.tg"
	ObservedAt     time.Time       `json:"observed_at"`
}

// ExternalSourceHealth represents real-time reachability & latency of an ecosystem provider
type ExternalSourceHealth struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Category    string `json:"category"` // "marketplace", "tracker", "blockchain"
	Endpoint    string `json:"endpoint"`
	Status      string `json:"status"` // "healthy", "degraded", "unreachable"
	LatencyMS   int64  `json:"latency_ms"`
	StatusCode  int    `json:"status_code,omitempty"`
	CheckedAt   string `json:"checked_at"`
	Description string `json:"description"`
}

// ExternalProviderHealth is an alias for ExternalSourceHealth
type ExternalProviderHealth = ExternalSourceHealth

type trackerCacheEntry struct {
	quotes    map[VenueID]*EcosystemVenueQuote
	expiresAt time.Time
}

// EcosystemTrackerClient aggregates specialized Telegram Gift trackers (GiftAsset & see.tg)
type EcosystemTrackerClient struct {
	httpClient   *http.Client
	giftAssetKey string
	mu           sync.RWMutex
	cache        map[string]*trackerCacheEntry
	disabled     bool
}

var (
	globalTrackerOnce   sync.Once
	globalTrackerClient *EcosystemTrackerClient
)

// GetGlobalTrackerClient returns the singleton EcosystemTrackerClient
func GetGlobalTrackerClient() *EcosystemTrackerClient {
	globalTrackerOnce.Do(func() {
		apiKey := strings.TrimSpace(os.Getenv("GIFTASSET_API_KEY"))
		// Only enable live external tracker network calls when explicitly configured or in production
		enabled := apiKey != "" || os.Getenv("APP_ENV") == "production" || os.Getenv("ENABLE_LIVE_TRACKERS") == "true"
		globalTrackerClient = &EcosystemTrackerClient{
			httpClient: &http.Client{
				Timeout: 2500 * time.Millisecond,
				Transport: &http.Transport{
					MaxIdleConns:        40,
					MaxIdleConnsPerHost: 10,
					IdleConnTimeout:     60 * time.Second,
				},
			},
			giftAssetKey: apiKey,
			cache:        make(map[string]*trackerCacheEntry),
			disabled:     !enabled,
		}
	})
	return globalTrackerClient
}

// FetchVenueQuote queries GiftAsset (api.giftasset.dev) and see.tg for live venue floor & volume
func (c *EcosystemTrackerClient) FetchVenueQuote(ctx context.Context, giftSlug string, venue VenueID) (*EcosystemVenueQuote, error) {
	if c == nil || c.disabled {
		return nil, ErrNoFloorData
	}

	normSlug := normalizeFragmentSlug(giftSlug)
	if normSlug == "" {
		return nil, ErrNoFloorData
	}

	c.mu.RLock()
	if entry, ok := c.cache[normSlug]; ok && time.Now().Before(entry.expiresAt) {
		if q, found := entry.quotes[venue]; found && q != nil {
			c.mu.RUnlock()
			return q, nil
		}
	}
	c.mu.RUnlock()

	quotes := make(map[VenueID]*EcosystemVenueQuote)

	// 1. Primary specialized aggregator: GiftAsset (api.giftasset.dev)
	if gaQuotes, err := c.fetchFromGiftAsset(ctx, giftSlug); err == nil && len(gaQuotes) > 0 {
		for k, v := range gaQuotes {
			quotes[k] = v
		}
	}

	// 2. Secondary tracker: see.tg (upgrade leaderboard & live market listings)
	if len(quotes) == 0 {
		if seeQuotes, err := c.fetchFromSeeTg(ctx, giftSlug); err == nil && len(seeQuotes) > 0 {
			for k, v := range seeQuotes {
				quotes[k] = v
			}
		}
	}

	if len(quotes) > 0 {
		c.mu.Lock()
		c.cache[normSlug] = &trackerCacheEntry{
			quotes:    quotes,
			expiresAt: time.Now().Add(2 * time.Minute),
		}
		c.mu.Unlock()
	}

	if q, ok := quotes[venue]; ok && q != nil {
		return q, nil
	}
	return nil, ErrNoFloorData
}

func (c *EcosystemTrackerClient) fetchFromGiftAsset(ctx context.Context, giftSlug string) (map[VenueID]*EcosystemVenueQuote, error) {
	slug := strings.ToLower(strings.TrimSpace(giftSlug))
	slug = strings.ReplaceAll(slug, "_", "-")
	reqURL := fmt.Sprintf("%s/gifts/%s/markets", GiftAssetBaseURL, url.PathEscape(slug))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "iFragment/2.0 (Institutional Collectibles Engine; +https://ifragment.app)")
	req.Header.Set("Accept", "application/json")
	if c.giftAssetKey != "" {
		req.Header.Set("X-API-Key", c.giftAssetKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("giftasset returned HTTP %d", resp.StatusCode)
	}

	var payload struct {
		Markets map[string]struct {
			FloorTON       float64 `json:"floor_ton"`
			Volume24hTON   float64 `json:"volume_24h_ton"`
			Volume7dTON    float64 `json:"volume_7d_ton"`
			ActiveListings int     `json:"active_listings"`
		} `json:"markets"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	out := make(map[VenueID]*EcosystemVenueQuote)
	now := time.Now().UTC()
	for k, m := range payload.Markets {
		if m.FloorTON <= 0 {
			continue
		}
		var vID VenueID
		switch strings.ToLower(k) {
		case "fragment":
			vID = VenueFragment
		case "getgems":
			vID = VenueGetgems
		case "marketapp", "marketapp.org", "marketapp.ws":
			vID = VenueMarketApp
		case "portals":
			vID = VenuePortals
		case "mrkt":
			vID = VenueMRKT
		case "tonnel", "toonel":
			vID = VenueTonnel
		default:
			continue
		}
		out[vID] = &EcosystemVenueQuote{
			VenueID:        vID,
			FloorPriceGRAM: decimal.NewFromFloat(m.FloorTON),
			Volume24hGRAM:  decimal.NewFromFloat(m.Volume24hTON),
			Volume7dGRAM:   decimal.NewFromFloat(m.Volume7dTON),
			ActiveListings: m.ActiveListings,
			Source:         "giftasset.dev",
			ObservedAt:     now,
		}
	}
	return out, nil
}

func (c *EcosystemTrackerClient) fetchFromSeeTg(ctx context.Context, giftSlug string) (map[VenueID]*EcosystemVenueQuote, error) {
	slug := strings.ToLower(strings.TrimSpace(giftSlug))
	slug = strings.ReplaceAll(slug, "_", "-")
	reqURL := fmt.Sprintf("%s/collections/%s", SeeTgBaseURL, url.PathEscape(slug))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "iFragment/2.0 (Institutional Collectibles Engine; +https://ifragment.app)")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("see.tg returned HTTP %d", resp.StatusCode)
	}

	var payload struct {
		FloorTON       float64 `json:"floor_ton"`
		Volume24hTON   float64 `json:"volume_24h_ton"`
		Volume7dTON    float64 `json:"volume_7d_ton"`
		ActiveListings int     `json:"listed_count"`
		UpgradedCount  int     `json:"upgraded_count"`
		HoldersCount   int     `json:"holders_count"`
		Venues         map[string]struct {
			FloorTON       float64 `json:"floor_ton"`
			ActiveListings int     `json:"listed_count"`
		} `json:"venues"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	out := make(map[VenueID]*EcosystemVenueQuote)
	now := time.Now().UTC()
	for k, v := range payload.Venues {
		if v.FloorTON <= 0 {
			continue
		}
		var vID VenueID
		switch strings.ToLower(k) {
		case "portals":
			vID = VenuePortals
		case "mrkt":
			vID = VenueMRKT
		case "tonnel", "toonel":
			vID = VenueTonnel
		case "fragment":
			vID = VenueFragment
		case "marketapp":
			vID = VenueMarketApp
		case "getgems":
			vID = VenueGetgems
		default:
			continue
		}
		out[vID] = &EcosystemVenueQuote{
			VenueID:        vID,
			FloorPriceGRAM: decimal.NewFromFloat(v.FloorTON),
			Volume24hGRAM:  decimal.NewFromFloat(payload.Volume24hTON),
			Volume7dGRAM:   decimal.NewFromFloat(payload.Volume7dTON),
			ActiveListings: v.ActiveListings,
			UpgradedCount:  payload.UpgradedCount,
			HoldersCount:   payload.HoldersCount,
			Source:         "see.tg",
			ObservedAt:     now,
		}
	}
	return out, nil
}

// CheckAllEcosystemProviders probes all primary marketplaces, trackers, and TON indexers concurrently
func CheckAllEcosystemProviders(ctx context.Context) []ExternalSourceHealth {
	providers := []struct {
		id       string
		name     string
		category string
		endpoint string
		desc     string
	}{
		{
			id:       "fragment",
			name:     "Fragment.com",
			category: "marketplace",
			endpoint: "https://fragment.com",
			desc:     "Official Telegram Auction & Collectibles Marketplace (Usernames, +888, Gifts)",
		},
		{
			id:       "nums888",
			name:     "nums888.io",
			category: "tracker",
			endpoint: "https://nums888.io/api/latest/",
			desc:     "Anonymous Numbers (+888) Live Floor, OHLC Chart & Orderbook Tracker",
		},
		{
			id:       "marketapp",
			name:     "MarketApp.org",
			category: "marketplace",
			endpoint: "https://api.marketapp.org/v1/collections/",
			desc:     "On-Chain Sales, Rentals & Fragment Escrow Aggregator (Usernames, +888, Gifts)",
		},
		{
			id:       "changes_tg",
			name:     "api.changes.tg (@GiftChanges)",
			category: "tracker",
			endpoint: "https://api.changes.tg/total",
			desc:     "Canonical 120+ Telegram Gifts Catalog, Models, 4-Hex Backdrops & Symbols",
		},
		{
			id:       "see_tg",
			name:     "see.tg",
			category: "tracker",
			endpoint: "https://see.tg",
			desc:     "Telegram Gifts Upgrade Leaderboard, Holder Distribution & Floor Analytics",
		},
		{
			id:       "giftasset",
			name:     "Gift Assets (giftasset.dev)",
			category: "tracker",
			endpoint: "https://api.giftasset.dev/v1/health",
			desc:     "Multi-Venue Gift Floor Price & Cross-Market Arbitrage Feed",
		},
		{
			id:       "portals",
			name:     "Portals Market",
			category: "marketplace",
			endpoint: "https://portals.market",
			desc:     "Telegram Mini App P2P Gift Marketplace (2.5% Fee)",
		},
		{
			id:       "mrkt",
			name:     "MRKT (mrkt.tg)",
			category: "marketplace",
			endpoint: "https://mrkt.tg",
			desc:     "Zero-Fee Telegram Gift Secondary Marketplace (0% Protocol Fee)",
		},
		{
			id:       "tonnel",
			name:     "Tonnel / Toonel Network",
			category: "marketplace",
			endpoint: "https://t.me/tonnel_gift_bot",
			desc:     "Telegram Gift Orderbook & Liquidity Pool Marketplace (3.0% Fee)",
		},
		{
			id:       "tonapi",
			name:     "TON Blockchain API (tonapi.io)",
			category: "blockchain",
			endpoint: "https://tonapi.io/v2/status",
			desc:     "TEP-62 / Telemint Smart Contract & On-Chain Provenance Indexer",
		},
	}

	results := make([]ExternalSourceHealth, len(providers))
	client := &http.Client{Timeout: 3 * time.Second}
	var wg sync.WaitGroup

	for i, p := range providers {
		i, p := i, p
		wg.Add(1)
		go func() {
			defer wg.Done()
			start := time.Now()
			status := "healthy"
			statusCode := 200

			reqCtx, cancel := context.WithTimeout(ctx, 2500*time.Millisecond)
			defer cancel()

			req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, p.endpoint, nil)
			if err == nil {
				req.Header.Set("User-Agent", "iFragment-HealthMonitor/2.0")
				resp, doErr := client.Do(req)
				if doErr != nil {
					status = "degraded"
					statusCode = 0
				} else {
					statusCode = resp.StatusCode
					resp.Body.Close()
					if resp.StatusCode >= 500 {
						status = "unreachable"
					} else if resp.StatusCode == 429 {
						status = "degraded"
					}
				}
			} else {
				status = "unreachable"
			}

			lat := time.Since(start).Milliseconds()
			if lat <= 0 {
				lat = 1
			}

			results[i] = ExternalSourceHealth{
				ID:          p.id,
				Name:        p.name,
				Category:    p.category,
				Endpoint:    p.endpoint,
				Status:      status,
				LatencyMS:   lat,
				StatusCode:  statusCode,
				CheckedAt:   time.Now().UTC().Format(time.RFC3339),
				Description: p.desc,
			}
		}()
	}

	wg.Wait()
	return results
}
