package tonapi

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"ifragment-backend/internal/telemetry"

	"golang.org/x/time/rate"
)

type Client struct {
	BaseURL  string
	APIKeys  []string
	keyIndex uint64
	HTTP     *http.Client
	Limiters []*rate.Limiter
	Limiter  *rate.Limiter
}

func NewClient() *Client {
	var apiKeys []string
	if keysStr := os.Getenv("TONAPI_KEYS"); keysStr != "" {
		for _, k := range strings.Split(keysStr, ",") {
			if trimmed := strings.TrimSpace(k); trimmed != "" {
				apiKeys = append(apiKeys, trimmed)
			}
		}
	} else if singleKey := os.Getenv("TONAPI_KEY"); singleKey != "" {
		apiKeys = []string{singleKey}
	}

	if len(apiKeys) == 0 {
		slog.Warn("TONAPI_KEY/TONAPI_KEYS not set — requests will be unauthenticated and heavily rate-limited")
	} else {
		slog.Info("TonAPI client initialized", "key_count", len(apiKeys))
	}

	limiters := make([]*rate.Limiter, len(apiKeys))
	for i := 0; i < len(apiKeys); i++ {
		limiters[i] = rate.NewLimiter(rate.Limit(8), 8)
	}

	return &Client{
		BaseURL:  "https://tonapi.io/v2",
		APIKeys:  apiKeys,
		Limiters: limiters,
		HTTP: &http.Client{
			Timeout: 10 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 20,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		Limiter: rate.NewLimiter(rate.Limit(8), 8),
	}
}

func (c *Client) getAPIKey() string {
	if len(c.APIKeys) == 0 {
		return ""
	}
	idx := atomic.AddUint64(&c.keyIndex, 1) % uint64(len(c.APIKeys))
	return c.APIKeys[idx]
}

func (c *Client) getAPIKeyAndLimit(ctx context.Context) (string, error) {
	if len(c.APIKeys) == 0 {
		if c.Limiter != nil {
			if err := c.Limiter.Wait(ctx); err != nil {
				return "", err
			}
		}
		return "", nil
	}

	numKeys := len(c.APIKeys)
	startIdx := atomic.AddUint64(&c.keyIndex, 1)

	// Attempt to find a key that is immediately available without blocking
	for i := 0; i < numKeys; i++ {
		idx := (startIdx + uint64(i)) % uint64(numKeys)
		if c.Limiters[idx].Allow() {
			return c.APIKeys[idx], nil
		}
	}

	// If none are immediately available, block on the next round-robin key's limiter
	idx := startIdx % uint64(numKeys)
	if err := c.Limiters[idx].Wait(ctx); err != nil {
		return "", err
	}
	return c.APIKeys[idx], nil
}

const UsernamesCollectionAddr = "EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi"

type NFTCollection struct {
	Address       string `json:"address"`
	NextItemIndex int    `json:"next_item_index"`
}

type NFTItem struct {
	Address  string `json:"address"`
	Index    int    `json:"index"`
	Verified bool   `json:"verified"`
	Owner    struct {
		Address string `json:"address"`
	} `json:"owner"`
	Sale *NFTSale `json:"sale"`
	DNS  string   `json:"dns"`
}

type NFTSale struct {
	Address string `json:"address"`
	Market  struct {
		Address string `json:"address"`
		Name    string `json:"name"`
	} `json:"market"`
	Price      Price `json:"price"`
	MarketFee  int64 `json:"market_fee"`
	NetworkFee int64 `json:"network_fee"`
}

type Price struct {
	Value     string `json:"value"`
	TokenName string `json:"token_name"`
}

type WalletInfo struct {
	Address string `json:"address"`
	Balance int64  `json:"balance"`
	Status  string `json:"status"`
}

type NFTItems struct {
	Items []NFTItem `json:"nft_items"`
}

type Transfer struct {
	From struct {
		Address string `json:"address"`
	} `json:"from"`
	To struct {
		Address string `json:"address"`
	} `json:"to"`
	TransactionHash string `json:"transaction_hash"`
	Timestamp       int64  `json:"timestamp"`
}

type TransferHistory struct {
	Transfers []Transfer `json:"nft_transfers"`
}

func (c *Client) doRequest(ctx context.Context, url string) (*http.Response, error) {
	var resp *http.Response
	var err error
	var duration float64

	for attempt := 0; attempt < 3; attempt++ {
		key, errLimit := c.getAPIKeyAndLimit(ctx)
		if errLimit != nil {
			return nil, errLimit
		}
		req, reqErr := http.NewRequestWithContext(ctx, "GET", url, nil)
		if reqErr != nil {
			return nil, reqErr
		}
		if key != "" {
			req.Header.Set("Authorization", "Bearer "+key)
		}

		version := os.Getenv("APP_VERSION")
		if version == "" {
			version = "1.0"
		}
		req.Header.Set("User-Agent", fmt.Sprintf("iFragment/%s (Telegram Mini App)", version))

		start := time.Now()
		resp, err = c.HTTP.Do(req)
		duration = time.Since(start).Seconds()

		if err == nil && resp.StatusCode == http.StatusTooManyRequests {
			retryAfter := resp.Header.Get("Retry-After")
			if delaySec, atoiErr := strconv.Atoi(retryAfter); atoiErr == nil && delaySec > 0 && delaySec <= 10 {
				resp.Body.Close()
				select {
				case <-ctx.Done():
					return nil, ctx.Err()
				case <-time.After(time.Duration(delaySec) * time.Second):
				}
				continue
			}
		}
		break
	}

	statusCode := "error"
	if err == nil {
		statusCode = fmt.Sprintf("%d", resp.StatusCode)
	}

	method := "unknown"
	if strings.Contains(url, "/nfts/collections/") {
		method = "GetCollection"
	} else if strings.Contains(url, "/resolve") {
		method = "ResolveDNS"
	} else if strings.Contains(url, "/nfts/") {
		method = "GetNFTItem"
	} else if strings.Contains(url, "/accounts/") {
		method = "GetWalletInfo"
	} else if strings.Contains(url, "/rates") {
		method = "GetRates"
	} else if strings.Contains(url, "/blockchain/transactions/") {
		method = "GetTransaction"
	}

	telemetry.RecordTonAPILatency(method, statusCode, duration)

	// Log non-success responses with body preview for debugging
	if err == nil && resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		bodyPreview := string(bodyBytes)
		if len(bodyPreview) > 512 {
			bodyPreview = bodyPreview[:512] + "..."
		}

		shouldLog := true
		if strings.Contains(bodyPreview, "not resolved") || strings.Contains(bodyPreview, "entity not found") {
			shouldLog = false
		}

		if shouldLog {
			slog.Error("TONAPI_REQUEST_FAILED",
				"method", method,
				"url", url,
				"status", resp.StatusCode,
				"body", bodyPreview,
				"duration_sec", duration,
				"authenticated", true, // simplified since we looped
			)
		}
		// Reconstruct the body so callers can still read/decode it fully
		resp.Body = io.NopCloser(bytes.NewReader(bodyBytes))
	}

	return resp, err
}

// GetCollection fetches collection-level data
func (c *Client) GetCollection(ctx context.Context, addr string) (*NFTCollection, error) {
	url := fmt.Sprintf("%s/nfts/collections/%s", c.BaseURL, addr)
	resp, err := c.doRequest(ctx, url)
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

// GetNFTByDNS resolves a username to its NFT item via TON DNS
func (c *Client) GetNFTByDNS(ctx context.Context, username string) (*NFTItem, error) {
	cleanName := strings.TrimSuffix(username, ".t.me")
	url := fmt.Sprintf("%s/nfts/%s.t.me", c.BaseURL, cleanName)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi dns error: %s", resp.Status)
	}

	var item NFTItem
	if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
		return nil, err
	}
	return &item, nil
}

// GetNFTItem fetches a specific NFT item by its address
func (c *Client) GetNFTItem(ctx context.Context, nftAddr string) (*NFTItem, error) {
	url := fmt.Sprintf("%s/nfts/%s", c.BaseURL, nftAddr)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi nft error: %s", resp.Status)
	}

	var item NFTItem
	if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
		return nil, err
	}
	return &item, nil
}

// GetWalletInfo fetches balance and status of a TON wallet
func (c *Client) GetWalletInfo(ctx context.Context, address string) (*WalletInfo, error) {
	url := fmt.Sprintf("%s/accounts/%s", c.BaseURL, address)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi wallet error: %s", resp.Status)
	}

	var info WalletInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	return &info, nil
}

// GetOwnerNFTs fetches all NFTs owned by a wallet in the usernames collection
func (c *Client) GetOwnerNFTs(ctx context.Context, ownerAddr string) (*NFTItems, error) {
	url := fmt.Sprintf("%s/accounts/%s/nfts?collection=%s&limit=100", c.BaseURL, ownerAddr, UsernamesCollectionAddr)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi owner nfts error: %s", resp.Status)
	}

	var items NFTItems
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, err
	}
	return &items, nil
}

// GetNFTTransfers fetches transfer history for an NFT
func (c *Client) GetNFTTransfers(ctx context.Context, nftAddr string) (*TransferHistory, error) {
	url := fmt.Sprintf("%s/nfts/%s/history?limit=50", c.BaseURL, nftAddr)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi transfers error: %s", resp.Status)
	}

	var history TransferHistory
	if err := json.NewDecoder(resp.Body).Decode(&history); err != nil {
		return nil, err
	}
	return &history, nil
}

// HolderInfo represents aggregated ownership data for a single wallet
type HolderInfo struct {
	Address string `json:"address"`
	Count   int    `json:"count"`
}

// CollectionItemsResponse wraps paginated collection items
type CollectionItemsResponse struct {
	Items []NFTItem `json:"nft_items"`
}

// GetCollectionItems fetches NFT items from a collection with offset/limit pagination
func (c *Client) GetCollectionItems(ctx context.Context, collectionAddr string, limit, offset int) (*CollectionItemsResponse, error) {
	url := fmt.Sprintf("%s/nfts/collections/%s/items?limit=%d&offset=%d", c.BaseURL, collectionAddr, limit, offset)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi collection items error: %s", resp.Status)
	}

	var result CollectionItemsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetTopHolders fetches collection items and aggregates ownership to find top holders
// maxItems controls how many items to scan (to avoid very long API calls)
func (c *Client) GetTopHolders(ctx context.Context, collectionAddr string, maxItems int) ([]HolderInfo, map[string]int, error) {
	batchSize := 1000
	pagesCount := (maxItems + batchSize - 1) / batchSize
	if pagesCount <= 0 {
		return nil, nil, fmt.Errorf("invalid maxItems: %d", maxItems)
	}

	type pageResult struct {
		items []NFTItem
		err   error
	}

	results := make([]pageResult, pagesCount)
	var wg sync.WaitGroup
	var mu sync.Mutex

	// Concurrency semaphore (worker pool with max 5 concurrent workers)
	sem := make(chan struct{}, 5)

	for i := 0; i < pagesCount; i++ {
		offset := i * batchSize
		limit := batchSize
		if offset+limit > maxItems {
			limit = maxItems - offset
		}

		wg.Add(1)
		go func(pageIdx, l, off int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			itemsResp, err := c.GetCollectionItems(ctx, collectionAddr, l, off)
			if err != nil {
				mu.Lock()
				results[pageIdx] = pageResult{err: err}
				mu.Unlock()
				return
			}
			mu.Lock()
			results[pageIdx] = pageResult{items: itemsResp.Items}
			mu.Unlock()
		}(i, limit, offset)
	}

	wg.Wait()

	ownerCounts := make(map[string]int)
	for _, res := range results {
		if res.err != nil {
			continue
		}
		for _, item := range res.items {
			if item.Owner.Address != "" {
				ownerCounts[item.Owner.Address]++
			}
		}
	}

	// Sort by count descending and return top holders
	type kv struct {
		Key   string
		Value int
	}
	var sorted []kv
	for k, v := range ownerCounts {
		sorted = append(sorted, kv{k, v})
	}

	// Standard sort.Slice descending
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Value > sorted[j].Value
	})

	var topHolders []HolderInfo
	limit := 10
	if len(sorted) < limit {
		limit = len(sorted)
	}
	for i := 0; i < limit; i++ {
		topHolders = append(topHolders, HolderInfo{
			Address: sorted[i].Key,
			Count:   sorted[i].Value,
		})
	}

	return topHolders, ownerCounts, nil
}

type RatesResponse struct {
	Rates map[string]struct {
		Prices map[string]float64 `json:"prices"`
	} `json:"rates"`
}

// GetTONRates fetches the current TON to USD exchange rate from TonAPI
func (c *Client) GetTONRates(ctx context.Context) (float64, error) {
	url := fmt.Sprintf("%s/rates?tokens=ton&currencies=usd", c.BaseURL)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("tonapi rates error: %s", resp.Status)
	}

	var rates RatesResponse
	if err := json.NewDecoder(resp.Body).Decode(&rates); err != nil {
		return 0, err
	}

	tonData, ok := rates.Rates["TON"]
	if !ok {
		return 0, fmt.Errorf("ton rate data not found")
	}

	usdPrice, ok := tonData.Prices["USD"]
	if !ok {
		return 0, fmt.Errorf("usd price not found")
	}

	return usdPrice, nil
}

type DNSResolve struct {
	Wallet struct {
		Address string `json:"address"`
	} `json:"wallet"`
}

// ResolveDNS resolves a domain directly via TON DNS
func (c *Client) ResolveDNS(ctx context.Context, domain string) (*DNSResolve, error) {
	url := fmt.Sprintf("%s/dns/%s/resolve", c.BaseURL, domain)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tonapi dns resolve error: %s", resp.Status)
	}

	var resolve DNSResolve
	if err := json.NewDecoder(resp.Body).Decode(&resolve); err != nil {
		return nil, err
	}
	return &resolve, nil
}

type BidInfo struct {
	Success bool   `json:"success"`
	Value   int64  `json:"value"` // nanotons
	TxTime  int64  `json:"txTime"`
	TxHash  string `json:"txHash"`
	Bidder  struct {
		Address  string `json:"address"`
		IsWallet bool   `json:"is_wallet"`
	} `json:"bidder"`
}

type BidsResponse struct {
	Data []BidInfo `json:"data"`
}

var (
	bidsCache     sync.Map
	bidsCacheTime sync.Map
)

// GetFragmentBids retrieves the bidding/auction history for a DNS domain (Fragment usernames)
func (c *Client) GetFragmentBids(ctx context.Context, domain string) (*BidsResponse, error) {
	domain = strings.ToLower(strings.TrimSpace(domain))
	if cached, ok := bidsCache.Load(domain); ok {
		if t, tOk := bidsCacheTime.Load(domain); tOk && time.Since(t.(time.Time)) < 1*time.Hour {
			return cached.(*BidsResponse), nil
		}
	}

	url := fmt.Sprintf("%s/dns/%s/bids", c.BaseURL, domain)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, nil
	}

	var bids BidsResponse
	if err := json.NewDecoder(resp.Body).Decode(&bids); err != nil {
		return nil, nil
	}

	bidsCache.Store(domain, &bids)
	bidsCacheTime.Store(domain, time.Now())
	return &bids, nil
}

// StreamAccountEvents opens an SSE connection to stream events for specific accounts
func (c *Client) StreamAccountEvents(ctx context.Context, accounts []string, onEvent func(data []byte)) error {
	accountsStr := strings.Join(accounts, ",")
	url := fmt.Sprintf("https://tonapi.io/v2/sse/accounts/transactions?accounts=%s", accountsStr)

	baseBackoff := 1 * time.Second
	maxBackoff := 60 * time.Second
	currentBackoff := baseBackoff

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		err := func() error {
			req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
			if err != nil {
				return err
			}
			key := c.getAPIKey()
			if key != "" {
				req.Header.Set("Authorization", "Bearer "+key)
			}
			req.Header.Set("Accept", "text/event-stream")
			req.Header.Set("Cache-Control", "no-cache")
			req.Header.Set("Connection", "keep-alive")

			resp, err := c.HTTP.Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				return fmt.Errorf("sse connection failed: %s", resp.Status)
			}

			connectedTime := time.Now()
			reader := bufio.NewReader(resp.Body)
			for {
				select {
				case <-ctx.Done():
					return ctx.Err()
				default:
				}

				line, err := reader.ReadBytes('\n')
				if err != nil {
					return err
				}

				if time.Since(connectedTime) > 10*time.Second {
					currentBackoff = baseBackoff
				}

				if bytes.HasPrefix(line, []byte("data: ")) {
					data := bytes.TrimPrefix(line, []byte("data: "))
					data = bytes.TrimSpace(data)
					onEvent(data)
				}
			}
		}()

		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(currentBackoff):
			}

			currentBackoff *= 2
			if currentBackoff > maxBackoff {
				currentBackoff = maxBackoff
			}
		}
	}
}

type TransactionInfo struct {
	Hash    string `json:"hash"`
	Success bool   `json:"success"`
	Utime   int64  `json:"utime"`
	InMsg   *struct {
		Source *struct {
			Address string `json:"address"`
		} `json:"source,omitempty"`
		Destination *struct {
			Address string `json:"address"`
		} `json:"destination,omitempty"`
		Value int64 `json:"value"` // in nanotons
	} `json:"in_msg,omitempty"`
}

func (c *Client) GetTransaction(ctx context.Context, txHash string) (*TransactionInfo, error) {
	url := fmt.Sprintf("%s/blockchain/transactions/%s", c.BaseURL, txHash)
	backoffs := []time.Duration{1 * time.Second, 2 * time.Second, 4 * time.Second, 8 * time.Second, 16 * time.Second}
	var lastErr error
	var isNotFound bool

	for attempt := 0; attempt < 5; attempt++ {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		resp, err := c.doRequest(ctx, url)
		if err != nil {
			lastErr = err
			isNotFound = false
		} else {
			if resp.StatusCode == http.StatusOK {
				var tx TransactionInfo
				decodeErr := json.NewDecoder(resp.Body).Decode(&tx)
				resp.Body.Close()
				if decodeErr != nil {
					return nil, decodeErr
				}
				return &tx, nil
			}

			if resp.StatusCode == http.StatusNotFound {
				isNotFound = true
				lastErr = fmt.Errorf("tonapi transaction error: %s (status %d)", resp.Status, resp.StatusCode)
			} else {
				isNotFound = false
				lastErr = fmt.Errorf("tonapi transaction error: %s (status %d)", resp.Status, resp.StatusCode)
			}
			resp.Body.Close()
		}

		if attempt == 4 {
			break
		}

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(backoffs[attempt]):
		}
	}

	if isNotFound {
		return nil, nil
	}
	return nil, lastErr
}
