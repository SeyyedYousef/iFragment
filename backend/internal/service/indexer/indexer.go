package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/shopspring/decimal"
	"github.com/sony/gobreaker"
	"golang.org/x/time/rate"

	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username/avm"
)

type MarketContract struct {
	Address    string
	Name       string
	MarketType string
	IsOfficial bool
}

type IndexerMetrics struct {
	LastSeenTS     int64     `json:"last_seen_ts"`
	ItemsIndexed   int64     `json:"items_indexed"`
	LagSeconds     int64     `json:"lag_seconds"`
	Throughput     float64   `json:"throughput_items_per_sec"`
	ErrorCount     int64     `json:"error_count"`
	Status         string    `json:"status"` // "idle", "bootstrap", "incremental", "paused"
	LastCheckpoint time.Time `json:"last_checkpoint"`
}

type IndexerService struct {
	client          *tonapi.Client
	repo            *repository.Database
	scope           string
	workers         int
	rateLimiter     *rate.Limiter
	circuitBreaker  *gobreaker.CircuitBreaker
	marketRegistry  map[string]MarketContract
	marketMu        sync.RWMutex
	priorityQueue   chan string
	
	// Metrics & State
	mu              sync.RWMutex
	lastSeenTS      int64
	itemsIndexed    int64
	lagSeconds      int64
	throughput      float64
	errorCount      int64
	status          string
	lastCheckpoint  time.Time
	sweepStartTime  time.Time
	batchCounter    int64
}

func NewIndexerService(client *tonapi.Client, repo *repository.Database) *IndexerService {
	workerCount := 4
	if wc := os.Getenv("INDEXER_WORKERS"); wc != "" {
		if n, err := strconv.Atoi(wc); err == nil && n > 0 {
			workerCount = n
		}
	}

	rps := 5.0
	if rStr := os.Getenv("INDEXER_RATE_LIMIT"); rStr != "" {
		if r, err := strconv.ParseFloat(rStr, 64); err == nil && r > 0 {
			rps = r
		}
	}

	cbSettings := gobreaker.Settings{
		Name:        "TonAPI-Indexer",
		MaxRequests: 3,
		Interval:    10 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 5 && failureRatio >= 0.6
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			slog.Warn("TonAPI Indexer Circuit Breaker state change", "from", from.String(), "to", to.String())
		},
	}

	svc := &IndexerService{
		client:         client,
		repo:           repo,
		scope:          "fragment_usernames",
		workers:        workerCount,
		rateLimiter:    rate.NewLimiter(rate.Limit(rps), int(rps*2)),
		circuitBreaker: gobreaker.NewCircuitBreaker(cbSettings),
		marketRegistry: make(map[string]MarketContract),
		priorityQueue:  make(chan string, 1000),
		status:         "idle",
	}

	// Seed fallback memory markets
	svc.marketRegistry["EQA27W806y788s4p6n9d-2Mv8-26tA16174G2b99p1021464"] = MarketContract{
		Address: "EQA27W806y788s4p6n9d-2Mv8-26tA16174G2b99p1021464", Name: "Fragment Auction", MarketType: "auction", IsOfficial: true,
	}
	svc.marketRegistry["EQD-cvR0Nz6XAyRBvbhz-PftCdRCmkyAcY1K2xsov1TDN9GM"] = MarketContract{
		Address: "EQD-cvR0Nz6XAyRBvbhz-PftCdRCmkyAcY1K2xsov1TDN9GM", Name: "Fragment Direct Sale", MarketType: "sale", IsOfficial: true,
	}

	return svc
}

// AddPriorityUsername schedules an immediate priority index sweep for a high-value or paid username
func (s *IndexerService) AddPriorityUsername(username string) {
	clean := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(username), "@"))
	if clean == "" {
		return
	}
	select {
	case s.priorityQueue <- clean:
		slog.Debug("Added username to Indexer Priority Queue", "username", clean)
	default:
		slog.Warn("Indexer Priority Queue is full; username dropped", "username", clean)
	}
}

// AddPriorityGift schedules an immediate priority index sweep for a high-value or purchased gift
func (s *IndexerService) AddPriorityGift(giftID string) {
	clean := strings.ToLower(strings.TrimSpace(giftID))
	if clean == "" {
		return
	}
	select {
	case s.priorityQueue <- "gift:" + clean:
		slog.Debug("Added gift to Indexer Priority Queue", "gift_id", clean)
	default:
		slog.Warn("Indexer Priority Queue is full; gift dropped", "gift_id", clean)
	}
}

// StartBackgroundLoop runs continuous incremental indexing with periodic sweeps and priority drain.
func (s *IndexerService) StartBackgroundLoop(ctx context.Context, interval time.Duration) {
	slog.Info("Starting TON Indexer v2 Engine...", "workers", s.workers, "interval", interval)

	// Load DB market contracts
	s.loadMarketRegistry(ctx)

	// Restore checkpoint
	_, lastTS, err := s.loadCheckpoint(ctx)
	if err == nil && lastTS > 0 {
		s.mu.Lock()
		s.lastSeenTS = lastTS
		s.mu.Unlock()
		slog.Info("Restored indexer checkpoint", "last_seen_ts", lastTS, "last_date", time.Unix(lastTS, 0).Format(time.RFC3339))
	} else {
		slog.Info("No existing checkpoint found. Indexer will bootstrap.")
	}

	// 1. Priority Consumer Worker
	go s.runPriorityWorker(ctx)

	// 2. Main Incremental Engine
	go func() {
		for {
			select {
			case <-ctx.Done():
				slog.Info("Indexer engine background loop stopping...")
				return
			default:
				s.RunIncrementalSync(ctx)

				select {
				case <-ctx.Done():
					return
				case <-time.After(interval):
				}
			}
		}
	}()
}

func (s *IndexerService) runPriorityWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case u := <-s.priorityQueue:
			_ = s.rateLimiter.Wait(ctx)
			nftAddr := s.resolveNFTAddress(ctx, u)
			if nftAddr != "" {
				s.processNFT(ctx, u, nftAddr)
			}
		}
	}
}

func (s *IndexerService) resolveNFTAddress(ctx context.Context, username string) string {
	// Query TonAPI account/dns info for username
	domain := fmt.Sprintf("%s.t.me", username)
	item, err := s.client.ResolveDNS(ctx, domain)
	if err == nil && item != nil && item.Wallet.Address != "" {
		return item.Wallet.Address
	}
	return ""
}

// RunIncrementalSync processes new sales since last checkpoint.
func (s *IndexerService) RunIncrementalSync(ctx context.Context) {
	s.mu.Lock()
	s.status = "incremental"
	s.sweepStartTime = time.Now()
	s.mu.Unlock()

	offset := 0
	limit := 50
	cursor, _, _ := s.loadCheckpoint(ctx)
	if cursor != "" {
		offset, _ = strconv.Atoi(cursor)
	}

	maxSeenTS := s.getLastSeenTS()
	batchIndexed := int64(0)

	type nftTask struct {
		username string
		address  string
	}

	taskChan := make(chan nftTask, limit*2)
	var wg sync.WaitGroup

	// Launch parallel workers
	for w := 0; w < s.workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for task := range taskChan {
				if ctx.Err() != nil {
					return
				}
				_ = s.rateLimiter.Wait(ctx)
				s.processNFT(ctx, task.username, task.address)
				atomic.AddInt64(&batchIndexed, 1)
			}
		}()
	}

	slog.Info("Starting TON Indexer incremental batch...", "offset", offset)

	for {
		if ctx.Err() != nil {
			break
		}

		_ = s.rateLimiter.Wait(ctx)

		res, err := s.circuitBreaker.Execute(func() (interface{}, error) {
			return s.client.FetchCollectionItems(ctx, tonapi.UsernamesCollectionAddr, limit, offset)
		})

		if err != nil {
			slog.Error("Error fetching collection items from TonAPI", "offset", offset, "error", err)
			s.recordError()
			time.Sleep(3 * time.Second)
			break
		}

		items := res.(*tonapi.NFTItems)
		if len(items.Items) == 0 {
			slog.Info("Incremental sweep reached end of collection items", "offset", offset)
			break
		}

		for _, item := range items.Items {
			if ctx.Err() != nil {
				break
			}
			if item.DNS == "" || !strings.HasSuffix(item.DNS, ".t.me") {
				continue
			}
			username := strings.TrimSuffix(item.DNS, ".t.me")
			taskChan <- nftTask{username: username, address: item.Address}
		}

		offset += len(items.Items)

		// Save intermediate checkpoint every 200 items
		if offset%200 == 0 {
			nowTS := time.Now().Unix()
			lagSec := int64(0)
			if maxSeenTS > 0 {
				lagSec = nowTS - maxSeenTS
			}
			s.saveCheckpoint(ctx, strconv.Itoa(offset), maxSeenTS, batchIndexed, lagSec)
		}

		// Incremental stop condition: if we've processed a reasonable window, take a breather
		if offset >= 1000 && cursor != "" {
			break
		}
	}

	close(taskChan)
	wg.Wait()

	nowTS := time.Now().Unix()
	lagSec := int64(0)
	if maxSeenTS > 0 {
		lagSec = nowTS - maxSeenTS
	}

	s.saveCheckpoint(ctx, strconv.Itoa(offset), maxSeenTS, batchIndexed, lagSec)

	s.mu.Lock()
	s.status = "idle"
	s.itemsIndexed += batchIndexed
	s.lagSeconds = lagSec
	if duration := time.Since(s.sweepStartTime).Seconds(); duration > 0 {
		s.throughput = float64(batchIndexed) / duration
	}
	s.mu.Unlock()

	slog.Info("Completed TON Indexer incremental cycle", "indexed", batchIndexed, "offset", offset, "lag_sec", lagSec)
}

func (s *IndexerService) processNFT(ctx context.Context, username string, nftAddr string) {
	if nftAddr == "" {
		return
	}

	history, err := s.client.FetchNFTHistory(ctx, nftAddr, 20)
	if err != nil {
		slog.Warn("Error fetching NFT history", "username", username, "error", err)
		s.recordError()
		return
	}

	segment, charLen, features := avm.ClassifyUsername(username)

	for _, event := range history.Events {
		var transfer *tonapi.NftItemTransfer
		for _, action := range event.Actions {
			if action.Type == "NftItemTransfer" && action.NftItemTransfer != nil {
				transfer = action.NftItemTransfer
				break
			}
		}

		if transfer == nil {
			continue
		}

		// Address-based market identification with name fallback
		marketAddr, saleTypeFromContract, isOfficial := s.matchMarket(transfer.Sender, transfer.Recipient)
		if marketAddr == "" {
			continue
		}

		if len(event.Actions) > 0 && len(event.Actions[0].BaseTransactions) > 0 {
			txHash := event.Actions[0].BaseTransactions[0]
			priceTon, saleType, confidence := s.extractPriceFromTrace(ctx, txHash)

			if isOfficial && saleTypeFromContract != "" {
				saleType = saleTypeFromContract
			}

			if priceTon > 0 {
				saleDate := time.Unix(event.Timestamp, 0)
				slog.Debug("Indexed confirmed sale", "username", username, "price_ton", priceTon, "type", saleType, "confidence", confidence)

				_, err := s.repo.InsertSale(ctx, repository.Sale{
					Username:      username,
					CharLength:    charLen,
					Segment:       segment,
					HasNumbers:    features.HasNumbers,
					HasUnderscore: features.HasUnderscore,
					IsDictionary:  features.IsDictionary,
					SalePriceTON:  decimal.NewFromFloat(priceTon),
					SaleDate:      saleDate,
					SaleType:      saleType,
					Source:        "indexer_v2",
				})

				if err != nil && !strings.Contains(err.Error(), "duplicate key") {
					slog.Warn("DB Insert Error for sale", "username", username, "error", err)
					s.recordError()
				} else {
					s.updateLastSeen(event.Timestamp)
				}
			}
		}
	}
}

func (s *IndexerService) matchMarket(sender, recipient tonapi.AccountAddress) (marketAddr string, marketType string, isOfficial bool) {
	s.marketMu.RLock()
	defer s.marketMu.RUnlock()

	// 1. Exact contract address match
	if c, ok := s.marketRegistry[sender.Address]; ok {
		return c.Address, c.MarketType, c.IsOfficial
	}
	if c, ok := s.marketRegistry[recipient.Address]; ok {
		return c.Address, c.MarketType, c.IsOfficial
	}

	// 2. Fallback: Display Name match (logs warning)
	for _, c := range s.marketRegistry {
		if sender.Name == c.Name || recipient.Name == c.Name {
			slog.Warn("Marketplace matched via fallback display name instead of contract address", "name", c.Name)
			return c.Address, c.MarketType, c.IsOfficial
		}
	}

	// Standard fallback list
	if strings.Contains(strings.ToLower(sender.Name), "fragment") || strings.Contains(strings.ToLower(recipient.Name), "fragment") {
		return "fallback_fragment", "auction", false
	}

	return "", "", false
}

func (s *IndexerService) extractPriceFromTrace(ctx context.Context, traceID string) (float64, string, string) {
	trace, err := s.client.FetchTrace(ctx, traceID)
	if err != nil {
		s.recordError()
		return 0, "unknown", "heuristic"
	}

	maxTon := int64(0)
	saleType := "buy_now"
	confidence := "exact"

	var traverse func(t *tonapi.Trace)
	traverse = func(t *tonapi.Trace) {
		if t.Transaction.InMsg != nil && t.Transaction.InMsg.Value > maxTon {
			maxTon = t.Transaction.InMsg.Value
		}

		for _, iface := range t.Interfaces {
			if strings.Contains(iface, "auction") {
				saleType = "auction"
			}
		}

		for _, child := range t.Children {
			traverse(&child)
		}
	}

	traverse(trace)

	if maxTon == 0 {
		return 0, "unknown", "heuristic"
	}

	tonValue := float64(maxTon) / math.Pow10(9)

	if tonValue < 0.5 {
		return 0, "unknown", "heuristic"
	}

	return tonValue, saleType, confidence
}

func (s *IndexerService) loadMarketRegistry(ctx context.Context) {
	if s.repo == nil || s.repo.Pool == nil {
		return
	}

	rows, err := s.repo.Pool.Query(ctx, `SELECT address, name, market_type, is_official FROM market_registry`)
	if err != nil {
		slog.Warn("Failed to query market_registry table", "error", err)
		return
	}
	defer rows.Close()

	s.marketMu.Lock()
	defer s.marketMu.Unlock()

	for rows.Next() {
		var m MarketContract
		if err := rows.Scan(&m.Address, &m.Name, &m.MarketType, &m.IsOfficial); err == nil {
			s.marketRegistry[m.Address] = m
		}
	}
	slog.Info("Loaded market contracts into Indexer memory", "count", len(s.marketRegistry))
}

func (s *IndexerService) saveCheckpoint(ctx context.Context, cursor string, lastSeenTS int64, itemsCount int64, lagSec int64) {
	if s.repo == nil || s.repo.Pool == nil {
		return
	}

	query := `
		INSERT INTO indexer_checkpoints (scope, cursor, last_seen_ts, items_indexed, lag_seconds, updated_at)
		VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
		ON CONFLICT (scope) DO UPDATE SET
			cursor = EXCLUDED.cursor,
			last_seen_ts = GREATEST(indexer_checkpoints.last_seen_ts, EXCLUDED.last_seen_ts),
			items_indexed = indexer_checkpoints.items_indexed + EXCLUDED.items_indexed,
			lag_seconds = EXCLUDED.lag_seconds,
			updated_at = CURRENT_TIMESTAMP
	`
	_, err := s.repo.Pool.Exec(ctx, query, s.scope, cursor, lastSeenTS, itemsCount, lagSec)
	if err != nil {
		slog.Warn("Failed to persist indexer checkpoint", "error", err)
	} else {
		s.mu.Lock()
		s.lastCheckpoint = time.Now()
		s.mu.Unlock()
	}
}

func (s *IndexerService) loadCheckpoint(ctx context.Context) (string, int64, error) {
	if s.repo == nil || s.repo.Pool == nil {
		return "", 0, fmt.Errorf("db pool nil")
	}

	query := `SELECT cursor, last_seen_ts FROM indexer_checkpoints WHERE scope = $1`
	var cursor string
	var lastSeenTS int64
	err := s.repo.Pool.QueryRow(ctx, query, s.scope).Scan(&cursor, &lastSeenTS)
	return cursor, lastSeenTS, err
}

func (s *IndexerService) updateLastSeen(ts int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if ts > s.lastSeenTS {
		s.lastSeenTS = ts
	}
}

func (s *IndexerService) getLastSeenTS() int64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastSeenTS
}

func (s *IndexerService) recordError() {
	atomic.AddInt64(&s.errorCount, 1)
}

// GetMetrics returns real-time health and lag statistics for Owner Panel
func (s *IndexerService) GetMetrics() IndexerMetrics {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return IndexerMetrics{
		LastSeenTS:     s.lastSeenTS,
		ItemsIndexed:   s.itemsIndexed,
		LagSeconds:     s.lagSeconds,
		Throughput:     s.throughput,
		ErrorCount:     atomic.LoadInt64(&s.errorCount),
		Status:         s.status,
		LastCheckpoint: s.lastCheckpoint,
	}
}
