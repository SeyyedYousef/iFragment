package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"ifragment-backend/internal/client/marketapp"
)

type SemanticCategoryMetric struct {
	CategoryKey  string  `json:"category_key"`
	CategoryName string  `json:"category_name"`
	VolumeTON    float64 `json:"volume_ton"`
	SalesCount   int     `json:"sales_count"`
	FloorTON     float64 `json:"floor_ton"`
	MedianTON    float64 `json:"median_ton"`
	SharePct     float64 `json:"share_pct"`
}

type OnChainTeleMintEvent struct {
	EventID      string  `json:"event_id"`
	Timestamp    int64   `json:"timestamp"`
	TimeISO      string  `json:"time_iso"`
	LT           int64   `json:"lt"`
	ActionType   string  `json:"action_type"`
	Opcode       string  `json:"opcode"`
	OpcodeLabel  string  `json:"opcode_label"`
	Username     string  `json:"username"`
	NFTAddress   string  `json:"nft_address"`
	ActorAddress string  `json:"actor_address"`
	AmountTON    float64 `json:"amount_ton"`
	CodeHash     string  `json:"code_hash,omitempty"`
	DataHash     string  `json:"data_hash,omitempty"`
}

type TeleMintTVMSnapshot struct {
	Username            string  `json:"username"`
	NFTAddress          string  `json:"nft_address"`
	BidderAddress       string  `json:"bidder_address"`
	CurrentBidTON       float64 `json:"current_bid_ton"`
	MinNextBidTON       float64 `json:"min_next_bid_ton"`
	BidTimestamp        int64   `json:"bid_timestamp"`
	EndTimestamp        int64   `json:"end_timestamp"`
	BeneficiaryAddress  string  `json:"beneficiary_address"`
	IsPrimaryMint       bool    `json:"is_primary_mint"`
	InitialMinBidTON    float64 `json:"initial_min_bid_ton"`
	MinBidStepPct       int     `json:"min_bid_step_pct"`
	AntiSnipeWindowSec  int     `json:"anti_snipe_window_sec"`
	DurationSec         int     `json:"duration_sec"`
	CodeHash            string  `json:"code_hash,omitempty"`
	DataHash            string  `json:"data_hash,omitempty"`
	RawStateBoCHex      string  `json:"raw_state_boc_hex,omitempty"`
	RawConfigBoCHex     string  `json:"raw_config_boc_hex,omitempty"`
}

type WhaleActivityItem struct {
	WalletAddress    string   `json:"wallet_address"`
	TotalTONDeployed float64  `json:"total_ton_deployed"`
	HandlesCount     int      `json:"handles_count"`
	SampleHandles    []string `json:"sample_handles"`
	RoleLabel        string   `json:"role_label"`
	LastActiveISO    string   `json:"last_active_iso"`
	LatestTxHash     string   `json:"latest_tx_hash,omitempty"`
}

type liveCollectionSnapshot struct {
	fetchedAt          time.Time
	highAuctions       []CollectionAuction
	endingSoonAuctions []CollectionAuction
	lowAuctions        []CollectionAuction
	floorListings      []CollectionAuction
	topSales           []CollectionAuction
	recentSold         []CollectionAuction
	onChainEvents      []OnChainTeleMintEvent
	tvmSnapshot        *TeleMintTVMSnapshot
	buyNowFloorTON     float64
	auctionFloorTON    float64
	activeAuctionsCnt  int
	listedForSaleCnt   int
	liveItemsCount     int
	liveOwnersCount    int
	liveVolume30dTON   float64
}

var (
	liveCacheMu   sync.RWMutex
	liveCacheData *liveCollectionSnapshot
	liveRefreshMu sync.Mutex

	reFragmentTr     = regexp.MustCompile(`(?s)<tr class="tm-row-selectable">(.*?)</tr>`)
	reFragmentHandle = regexp.MustCompile(`<div class="table-cell-value tm-value">@([a-zA-Z0-9_]+)</div>`)
	reFragmentPrice  = regexp.MustCompile(`<div class="table-cell-value tm-value icon-before icon-ton">([0-9,.]+)</div>`)
	reFragmentTime   = regexp.MustCompile(`<time datetime="([^"]+)"[^>]*>([^<]*)</time>`)
)

func getOrFetchLiveSnapshot(ctx context.Context) *liveCollectionSnapshot {
	liveCacheMu.RLock()
	cached := liveCacheData
	liveCacheMu.RUnlock()

	if cached != nil && time.Since(cached.fetchedAt) < 3*time.Minute {
		return cached
	}

	// If we have stale cache, return it and trigger background refresh if not already running
	if cached != nil {
		go func() {
			bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			refreshLiveSnapshot(bgCtx)
		}()
		return cached
	}

	// First load: fetch synchronously with a tight timeout
	fetchCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	return refreshLiveSnapshot(fetchCtx)
}

func refreshLiveSnapshot(ctx context.Context) *liveCollectionSnapshot {
	liveRefreshMu.Lock()
	defer liveRefreshMu.Unlock()

	liveCacheMu.RLock()
	if liveCacheData != nil && time.Since(liveCacheData.fetchedAt) < 2*time.Minute {
		c := liveCacheData
		liveCacheMu.RUnlock()
		return c
	}
	liveCacheMu.RUnlock()

	snap := &liveCollectionSnapshot{
		fetchedAt: time.Now().UTC(),
	}

	var wg sync.WaitGroup

	// 1. High-bid auctions
	wg.Add(1)
	go func() {
		defer wg.Done()
		rows, total := scrapeFragmentRows(ctx, "https://fragment.com/?filter=auction", "Active", 25)
		snap.highAuctions = rows
		if total > 0 {
			snap.activeAuctionsCnt = total
		}
	}()

	// 2. Ending-soon sniper auctions
	wg.Add(1)
	go func() {
		defer wg.Done()
		rows, _ := scrapeFragmentRows(ctx, "https://fragment.com/?filter=auction&sort=ending", "Ending Soon", 25)
		snap.endingSoonAuctions = rows
	}()

	// 2b. Lowest active auction floor (?filter=auction&sort=price_asc)
	wg.Add(1)
	go func() {
		defer wg.Done()
		rows, _ := scrapeFragmentRows(ctx, "https://fragment.com/?filter=auction&sort=price_asc", "Active", 5)
		snap.lowAuctions = rows
	}()

	// 3. Fixed-price floor listings
	wg.Add(1)
	go func() {
		defer wg.Done()
		rows, total := scrapeFragmentRows(ctx, "https://fragment.com/?filter=sale&sort=price_asc", "For Sale", 20)
		snap.floorListings = rows
		if total > 0 {
			snap.listedForSaleCnt = total
		}
		if len(rows) > 0 && rows[0].PriceTON > 0 {
			snap.buyNowFloorTON = rows[0].PriceTON
		}
	}()

	// 4. All-time top sales on Fragment
	wg.Add(1)
	go func() {
		defer wg.Done()
		rows, _ := scrapeFragmentRows(ctx, "https://fragment.com/?filter=sold&sort=price_desc", "Sold", 25)
		snap.topSales = rows
	}()

	// 5. Recently sold real-time tape
	wg.Add(1)
	go func() {
		defer wg.Done()
		rows, _ := scrapeFragmentRows(ctx, "https://fragment.com/?filter=sold&sort=listed", "Sold", 25)
		snap.recentSold = rows
	}()

	// 6. TonAPI On-Chain TeleMint events & TVM binary inspection
	wg.Add(1)
	go func() {
		defer wg.Done()
		events, tvm := fetchTonAPITeleMintEvents(ctx)
		snap.onChainEvents = events
		snap.tvmSnapshot = tvm
	}()

	// 7. MarketApp OpenAPI live collection supply, holders & 30d volume (when MARKETAPP_TOKENS configured)
	wg.Add(1)
	go func() {
		defer wg.Done()
		maClient := marketapp.NewClient()
		if col, err := maClient.GetCollection(ctx); err == nil && col != nil {
			if col.ItemsCount > 0 {
				snap.liveItemsCount = col.ItemsCount
			}
			if col.TotalOwners > 0 {
				snap.liveOwnersCount = col.TotalOwners
			}
			if col.Volume30d > 0 {
				snap.liveVolume30dTON = col.Volume30d
			}
			if col.ActiveAuctions > snap.activeAuctionsCnt {
				snap.activeAuctionsCnt = col.ActiveAuctions
			}
			if snap.buyNowFloorTON <= 0 && col.FloorPrice > 0 {
				snap.buyNowFloorTON = col.FloorPrice
			}
		}
	}()

	wg.Wait()

	// Compute lowest active auction bid across price_asc auctions first, then fallback to ending/high
	minAuc := 0.0
	for _, a := range snap.lowAuctions {
		if a.PriceTON > 0 && (minAuc == 0 || a.PriceTON < minAuc) {
			minAuc = a.PriceTON
		}
	}
	if minAuc == 0 {
		for _, a := range snap.endingSoonAuctions {
			if a.PriceTON > 0 && (minAuc == 0 || a.PriceTON < minAuc) {
				minAuc = a.PriceTON
			}
		}
		for _, a := range snap.highAuctions {
			if a.PriceTON > 0 && (minAuc == 0 || a.PriceTON < minAuc) {
				minAuc = a.PriceTON
			}
		}
	}
	snap.auctionFloorTON = minAuc

	liveCacheMu.Lock()
	liveCacheData = snap
	liveCacheMu.Unlock()

	return snap
}

func scrapeFragmentRows(ctx context.Context, url string, defaultStatus string, maxItems int) ([]CollectionAuction, int) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, 0
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	client := &http.Client{Timeout: 6 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, 0
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0
	}
	html := string(bodyBytes)

	trMatches := reFragmentTr.FindAllStringSubmatch(html, -1)
	totalRows := len(trMatches)
	if totalRows == 0 {
		return nil, 0
	}

	limit := maxItems
	if totalRows < limit {
		limit = totalRows
	}

	results := make([]CollectionAuction, 0, limit)
	for i := 0; i < limit; i++ {
		rowHTML := trMatches[i][1]
		hMatch := reFragmentHandle.FindStringSubmatch(rowHTML)
		pMatch := reFragmentPrice.FindStringSubmatch(rowHTML)
		if len(hMatch) < 2 || len(pMatch) < 2 {
			continue
		}
		handle := strings.TrimSpace(hMatch[1])
		rawPrice := strings.TrimSpace(pMatch[1])
		priceVal := parsePriceStringTON(rawPrice)

		auctionType := "Primary Mint"
		if strings.Contains(rowHTML, ">Resale<") {
			auctionType = "Secondary Resale"
		} else if defaultStatus == "For Sale" {
			auctionType = "Fixed Price"
		} else if defaultStatus == "Sold" {
			auctionType = "Settled"
		}

		var isoTime, timeLabel string
		tMatches := reFragmentTime.FindAllStringSubmatch(rowHTML, -1)
		if len(tMatches) > 0 {
			isoTime = strings.TrimSpace(tMatches[0][1])
			timeLabel = strings.TrimSpace(tMatches[0][2])
			// If there is a second <time> tag in sold rows or wide columns, capture readable label if first was empty
			if timeLabel == "" && len(tMatches) > 1 {
				timeLabel = strings.TrimSpace(tMatches[1][2])
			}
		}

		results = append(results, CollectionAuction{
			ItemName:    "@" + handle,
			Price:       rawPrice + " TON",
			PriceTON:    priceVal,
			Status:      defaultStatus,
			AuctionType: auctionType,
			EndsAt:      isoTime,
			TimeLeft:    timeLabel,
			Timestamp:   isoTime,
			CharLength:  len(handle),
			Verified:    true,
		})
	}

	return results, totalRows
}

type tonAPIEventsResponse struct {
	Events []struct {
		EventID   string `json:"event_id"`
		Timestamp int64  `json:"timestamp"`
		LT        int64  `json:"lt"`
		Actions   []struct {
			Type       string `json:"type"`
			Status     string `json:"status"`
			AuctionBid *struct {
				AuctionType string `json:"auction_type"`
				Amount      struct {
					Value string `json:"value"`
				} `json:"amount"`
				NFT struct {
					Address  string `json:"address"`
					CodeHash string `json:"code_hash"`
					DataHash string `json:"data_hash"`
					Metadata struct {
						Name string `json:"name"`
					} `json:"metadata"`
				} `json:"nft"`
				Bidder struct {
					Address string `json:"address"`
				} `json:"bidder"`
			} `json:"AuctionBid,omitempty"`
			NftItemTransfer *struct {
				NFT       string `json:"nft"`
				Sender    struct{ Address string `json:"address"` } `json:"sender"`
				Recipient struct{ Address string `json:"address"` } `json:"recipient"`
			} `json:"NftItemTransfer,omitempty"`
			NftPurchase *struct {
				Amount struct {
					Value string `json:"value"`
				} `json:"amount"`
				NFT struct {
					Address  string `json:"address"`
					CodeHash string `json:"code_hash"`
					DataHash string `json:"data_hash"`
					Metadata struct {
						Name string `json:"name"`
					} `json:"metadata"`
				} `json:"nft"`
				Buyer struct {
					Address string `json:"address"`
				} `json:"buyer"`
			} `json:"NftPurchase,omitempty"`
			BaseTransactions []string `json:"base_transactions"`
		} `json:"actions"`
	} `json:"events"`
}

func fetchTonAPITeleMintEvents(ctx context.Context) ([]OnChainTeleMintEvent, *TeleMintTVMSnapshot) {
	url := "https://tonapi.io/v2/accounts/EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi/events?limit=15"
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, nil
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 6 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil
	}

	var parsed tonAPIEventsResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, nil
	}

	var events []OnChainTeleMintEvent
	var sampleNFTAddr, sampleHandle, sampleCodeHash, sampleDataHash string

	for _, ev := range parsed.Events {
		for _, act := range ev.Actions {
			txHash := ev.EventID
			if len(act.BaseTransactions) > 0 && act.BaseTransactions[0] != "" {
				txHash = act.BaseTransactions[0]
			}
			timeISO := time.Unix(ev.Timestamp, 0).UTC().Format(time.RFC3339)

			if act.AuctionBid != nil {
				nanoVal, _ := strconv.ParseFloat(act.AuctionBid.Amount.Value, 64)
				tonVal := math.Round((nanoVal/1e9)*100) / 100
				handle := strings.TrimSpace(act.AuctionBid.NFT.Metadata.Name)
				if handle != "" && !strings.HasPrefix(handle, "@") {
					handle = "@" + handle
				}
				if sampleNFTAddr == "" && act.AuctionBid.NFT.Address != "" {
					sampleNFTAddr = act.AuctionBid.NFT.Address
					sampleHandle = handle
					sampleCodeHash = act.AuctionBid.NFT.CodeHash
					sampleDataHash = act.AuctionBid.NFT.DataHash
				}
				events = append(events, OnChainTeleMintEvent{
					EventID:      txHash,
					Timestamp:    ev.Timestamp,
					TimeISO:      timeISO,
					LT:           ev.LT,
					ActionType:   "AuctionBid",
					Opcode:       "0x487a8e81",
					OpcodeLabel:  "teleitem_bid (TVM Auction Engine)",
					Username:     handle,
					NFTAddress:   act.AuctionBid.NFT.Address,
					ActorAddress: act.AuctionBid.Bidder.Address,
					AmountTON:    tonVal,
					CodeHash:     act.AuctionBid.NFT.CodeHash,
					DataHash:     act.AuctionBid.NFT.DataHash,
				})
			} else if act.NftPurchase != nil {
				nanoVal, _ := strconv.ParseFloat(act.NftPurchase.Amount.Value, 64)
				tonVal := math.Round((nanoVal/1e9)*100) / 100
				handle := strings.TrimSpace(act.NftPurchase.NFT.Metadata.Name)
				if handle != "" && !strings.HasPrefix(handle, "@") {
					handle = "@" + handle
				}
				events = append(events, OnChainTeleMintEvent{
					EventID:      txHash,
					Timestamp:    ev.Timestamp,
					TimeISO:      timeISO,
					LT:           ev.LT,
					ActionType:   "NftPurchase",
					Opcode:       "0x5fcc3d14",
					OpcodeLabel:  "tep62_transfer (Settlement)",
					Username:     handle,
					NFTAddress:   act.NftPurchase.NFT.Address,
					ActorAddress: act.NftPurchase.Buyer.Address,
					AmountTON:    tonVal,
					CodeHash:     act.NftPurchase.NFT.CodeHash,
					DataHash:     act.NftPurchase.NFT.DataHash,
				})
			}
		}
	}

	var tvmSnap *TeleMintTVMSnapshot
	if sampleNFTAddr != "" {
		tvmSnap = fetchTVMAuctionSnapshot(ctx, client, sampleNFTAddr, sampleHandle, sampleCodeHash, sampleDataHash)
	}

	return events, tvmSnap
}

type tvmMethodResponse struct {
	Success bool `json:"success"`
	Stack   []struct {
		Type string `json:"type"`
		Cell string `json:"cell,omitempty"`
		Num  string `json:"num,omitempty"`
	} `json:"stack"`
	Decoded map[string]interface{} `json:"decoded"`
}

func fetchTVMAuctionSnapshot(ctx context.Context, client *http.Client, nftAddr, handle, codeHash, dataHash string) *TeleMintTVMSnapshot {
	stateURL := fmt.Sprintf("https://tonapi.io/v2/blockchain/accounts/%s/methods/get_telemint_auction_state", nftAddr)
	cfgURL := fmt.Sprintf("https://tonapi.io/v2/blockchain/accounts/%s/methods/get_telemint_auction_config", nftAddr)

	var stateResp, cfgResp tvmMethodResponse
	var wg sync.WaitGroup

	wg.Add(2)
	go func() {
		defer wg.Done()
		req, err := http.NewRequestWithContext(ctx, "GET", stateURL, nil)
		if err != nil {
			return
		}
		req.Header.Set("User-Agent", "Mozilla/5.0")
		if r, err := client.Do(req); err == nil {
			defer r.Body.Close()
			if b, err := io.ReadAll(r.Body); err == nil {
				_ = json.Unmarshal(b, &stateResp)
			}
		}
	}()
	go func() {
		defer wg.Done()
		req, err := http.NewRequestWithContext(ctx, "GET", cfgURL, nil)
		if err != nil {
			return
		}
		req.Header.Set("User-Agent", "Mozilla/5.0")
		if r, err := client.Do(req); err == nil {
			defer r.Body.Close()
			if b, err := io.ReadAll(r.Body); err == nil {
				_ = json.Unmarshal(b, &cfgResp)
			}
		}
	}()
	wg.Wait()

	if !stateResp.Success && !cfgResp.Success {
		return nil
	}

	snap := &TeleMintTVMSnapshot{
		Username:   handle,
		NFTAddress: nftAddr,
		CodeHash:   codeHash,
		DataHash:   dataHash,
	}

	if len(stateResp.Stack) > 0 && stateResp.Stack[0].Cell != "" {
		snap.RawStateBoCHex = stateResp.Stack[0].Cell
	}
	if len(cfgResp.Stack) > 0 && cfgResp.Stack[0].Cell != "" {
		snap.RawConfigBoCHex = cfgResp.Stack[0].Cell
	}

	if stateResp.Decoded != nil {
		if b, ok := stateResp.Decoded["bidder"].(string); ok {
			snap.BidderAddress = b
		}
		if v, ok := stateResp.Decoded["bid"].(float64); ok {
			snap.CurrentBidTON = math.Round((v/1e9)*100) / 100
		}
		if v, ok := stateResp.Decoded["min_bid"].(float64); ok {
			snap.MinNextBidTON = math.Round((v/1e9)*100) / 100
		}
		if v, ok := stateResp.Decoded["bid_ts"].(float64); ok {
			snap.BidTimestamp = int64(v)
		}
		if v, ok := stateResp.Decoded["end_time"].(float64); ok {
			snap.EndTimestamp = int64(v)
		}
	}

	if cfgResp.Decoded != nil {
		if b, ok := cfgResp.Decoded["beneficiar"].(string); ok {
			snap.BeneficiaryAddress = b
			// Fragment Treasury address on TON starts with 0:426f81e13b3b2bf6...
			snap.IsPrimaryMint = strings.HasPrefix(b, "0:426f81e1")
		}
		if v, ok := cfgResp.Decoded["initial_min_bid"].(float64); ok {
			snap.InitialMinBidTON = math.Round((v/1e9)*100) / 100
		}
		if v, ok := cfgResp.Decoded["min_bid_step"].(float64); ok {
			snap.MinBidStepPct = int(v)
		}
		if v, ok := cfgResp.Decoded["min_extend_time"].(float64); ok {
			snap.AntiSnipeWindowSec = int(v)
		}
		if v, ok := cfgResp.Decoded["duration"].(float64); ok {
			snap.DurationSec = int(v)
		}
	}

	return snap
}

func mergeTopSalesHallOfFame(liveTop []CollectionAuction, dbTop []CollectionAuction) []CollectionAuction {
	genesisRecords := []CollectionAuction{
		{ItemName: "@danbao", Price: "1,583,948 TON", PriceTON: 1583948, Status: "2026-02-07", Timestamp: "2026-02-07T17:04:13Z", AuctionType: "Primary Mint", CharLength: 6, Verified: true},
		{ItemName: "@news", Price: "994,000 TON", PriceTON: 994000, Status: "2022-11-18", Timestamp: "2022-11-18T14:20:00Z", AuctionType: "Primary Mint", CharLength: 4, Verified: true},
		{ItemName: "@auto", Price: "900,000 TON", PriceTON: 900000, Status: "2022-11-05", Timestamp: "2022-11-05T18:00:00Z", AuctionType: "Primary Mint", CharLength: 4, Verified: true},
		{ItemName: "@bank", Price: "850,000 TON", PriceTON: 850000, Status: "2022-11-04", Timestamp: "2022-11-04T19:12:00Z", AuctionType: "Primary Mint", CharLength: 4, Verified: true},
		{ItemName: "@avia", Price: "800,000 TON", PriceTON: 800000, Status: "2022-11-06", Timestamp: "2022-11-06T16:40:00Z", AuctionType: "Primary Mint", CharLength: 4, Verified: true},
		{ItemName: "@chat", Price: "700,000 TON", PriceTON: 700000, Status: "2022-11-07", Timestamp: "2022-11-07T12:15:00Z", AuctionType: "Primary Mint", CharLength: 4, Verified: true},
		{ItemName: "@king", Price: "675,000 TON", PriceTON: 675000, Status: "2022-11-05", Timestamp: "2022-11-05T15:30:00Z", AuctionType: "Primary Mint", CharLength: 4, Verified: true},
		{ItemName: "@fifa", Price: "600,000 TON", PriceTON: 600000, Status: "2022-11-09", Timestamp: "2022-11-09T20:00:00Z", AuctionType: "Primary Mint", CharLength: 4, Verified: true},
		{ItemName: "@devil", Price: "550,000 TON", PriceTON: 550000, Status: "2022-11-12", Timestamp: "2022-11-12T11:45:00Z", AuctionType: "Primary Mint", CharLength: 5, Verified: true},
		{ItemName: "@casino", Price: "400,000 TON", PriceTON: 400000, Status: "2022-11-02", Timestamp: "2022-11-02T17:00:00Z", AuctionType: "Primary Mint", CharLength: 6, Verified: true},
		{ItemName: "@crypto", Price: "350,000 TON", PriceTON: 350000, Status: "2023-03-14", Timestamp: "2023-03-14T09:30:00Z", AuctionType: "Secondary Resale", CharLength: 6, Verified: true},
		{ItemName: "@wallet", Price: "260,000 TON", PriceTON: 260000, Status: "2023-01-22", Timestamp: "2023-01-22T14:00:00Z", AuctionType: "Primary Mint", CharLength: 6, Verified: true},
	}

	byHandle := make(map[string]CollectionAuction)
	add := func(item CollectionAuction) {
		key := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(item.ItemName), "@"))
		if key == "" {
			return
		}
		if item.PriceTON <= 0 {
			item.PriceTON = parsePriceStringTON(item.Price)
		}
		if item.CharLength == 0 {
			item.CharLength = len(key)
		}
		item.ItemName = "@" + key
		existing, exists := byHandle[key]
		if !exists || item.PriceTON > existing.PriceTON || (existing.EndsAt == "" && item.EndsAt != "") {
			byHandle[key] = item
		}
	}

	for _, g := range genesisRecords {
		add(g)
	}
	for _, d := range dbTop {
		add(d)
	}
	for _, l := range liveTop {
		add(l)
	}

	merged := make([]CollectionAuction, 0, len(byHandle))
	for _, v := range byHandle {
		merged = append(merged, v)
	}
	sort.Slice(merged, func(i, j int) bool {
		return merged[i].PriceTON > merged[j].PriceTON
	})
	if len(merged) > 30 {
		merged = merged[:30]
	}
	return merged
}
