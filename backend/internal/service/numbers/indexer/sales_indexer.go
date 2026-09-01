package indexer

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/sony/gobreaker"
	"golang.org/x/time/rate"

	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/numbers/features"
	"ifragment-backend/internal/service/numbers/registry"
	"ifragment-backend/internal/service/numbers/watchlist"
)

type NumbersSalesIndexer struct {
	client         *tonapi.Client
	db             *repository.Database
	repo           *repository.NumbersRepo
	notifier       *watchlist.WatchlistNotifier
	cryptoPrice    *cryptoprice.CryptoPriceService
	rateLimiter    *rate.Limiter
	circuitBreaker *gobreaker.CircuitBreaker
	priorityChan   chan string
	mu             sync.Mutex
	lastOffset     int
}

func NewNumbersSalesIndexer(
	client *tonapi.Client,
	db *repository.Database,
	cryptoPrice *cryptoprice.CryptoPriceService,
) *NumbersSalesIndexer {
	repo := repository.NewNumbersRepo(db)
	notifier := watchlist.NewWatchlistNotifier(repo)

	cbSettings := gobreaker.Settings{
		Name:        "TonAPI-NumbersSalesIndexer",
		MaxRequests: 3,
		Interval:    10 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.Requests >= 5 && float64(counts.TotalFailures)/float64(counts.Requests) >= 0.6
		},
	}

	return &NumbersSalesIndexer{
		client:         client,
		db:             db,
		repo:           repo,
		notifier:       notifier,
		cryptoPrice:    cryptoPrice,
		rateLimiter:    rate.NewLimiter(rate.Limit(6), 6),
		circuitBreaker: gobreaker.NewCircuitBreaker(cbSettings),
		priorityChan:   make(chan string, 500),
		lastOffset:     0,
	}
}

// EnqueuePriorityNumber schedules immediate sales indexing for a specific number
func (s *NumbersSalesIndexer) EnqueuePriorityNumber(number string) {
	norm, err := features.NormalizeNumber(number)
	if err != nil {
		return
	}
	select {
	case s.priorityChan <- norm:
	default:
		slog.Warn("Numbers Sales Indexer priority channel full", "number", norm)
	}
}

// StartBackgroundLoop launches periodic collection polling and priority indexing
func (s *NumbersSalesIndexer) StartBackgroundLoop(ctx context.Context, interval time.Duration) {
	slog.Info("Starting Numbers Sales Indexer...", "interval", interval)

	// Priority queue worker
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case num := <-s.priorityChan:
				_ = s.rateLimiter.Wait(ctx)
				s.IndexSingleNumber(ctx, num)
			}
		}
	}()

	// Periodic incremental sweep worker
	go func() {
		for {
			select {
			case <-ctx.Done():
				slog.Info("Numbers Sales Indexer loop stopping...")
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

// IndexSingleNumber sweeps on-chain transaction history for a specific number
func (s *NumbersSalesIndexer) IndexSingleNumber(ctx context.Context, normNumber string) (int, error) {
	if s.repo == nil || s.client == nil {
		return 0, nil
	}

	featRec, err := s.repo.GetNumberFeatures(ctx, normNumber)
	if err != nil || featRec == nil || featRec.NFTAddress == "" {
		return 0, fmt.Errorf("number NFT address not found in database: %s", normNumber)
	}

	return s.processNFTSales(ctx, normNumber, featRec.NFTAddress)
}

// RunIncrementalSync scans recent batches of collection items for new sales
func (s *NumbersSalesIndexer) RunIncrementalSync(ctx context.Context) {
	if s.client == nil || s.db == nil {
		return
	}

	limit := 50
	s.mu.Lock()
	offset := s.lastOffset
	s.mu.Unlock()

	_ = s.rateLimiter.Wait(ctx)
	res, err := s.circuitBreaker.Execute(func() (interface{}, error) {
		return s.client.FetchCollectionItems(ctx, registry.AnonymousNumbersCollectionAddr, limit, offset)
	})
	if err != nil {
		slog.Warn("Numbers sales indexer: failed to fetch collection batch", "offset", offset, "error", err)
		return
	}

	items := res.(*tonapi.NFTItems)
	if len(items.Items) == 0 {
		// Reset back to start for cyclical monitoring
		s.mu.Lock()
		s.lastOffset = 0
		s.mu.Unlock()
		return
	}

	for _, item := range items.Items {
		if ctx.Err() != nil {
			return
		}

		rawNumber := item.DNS
		if rawNumber == "" {
			rawNumber = fmt.Sprintf("+888%08d", item.Index)
		}
		norm, err := features.NormalizeNumber(rawNumber)
		if err != nil {
			continue
		}

		_ = s.rateLimiter.Wait(ctx)
		_, _ = s.processNFTSales(ctx, norm, item.Address)
	}

	s.mu.Lock()
	s.lastOffset = (offset + len(items.Items)) % registry.TotalSupply
	s.mu.Unlock()
}

func (s *NumbersSalesIndexer) processNFTSales(ctx context.Context, normNumber string, nftAddr string) (int, error) {
	if nftAddr == "" {
		return 0, nil
	}

	history, err := s.client.FetchNFTHistory(ctx, nftAddr, 20)
	if err != nil {
		return 0, err
	}

	tonUsdRate := 5.50
	if s.cryptoPrice != nil {
		if r, ok := s.cryptoPrice.GetFloatPrice("the-open-network"); ok && r > 0 {
			tonUsdRate = r
		}
	}

	indexedCount := 0

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

		if len(event.Actions) > 0 && len(event.Actions[0].BaseTransactions) > 0 {
			txHash := event.Actions[0].BaseTransactions[0]
			priceTON, saleType, confidence := s.extractPriceFromTrace(ctx, txHash)

			if priceTON > 0 {
				saleDate := time.Unix(event.Timestamp, 0)
				buyer := transfer.Recipient.Address
				seller := transfer.Sender.Address
				rawData, _ := json.Marshal(event)

				saleRec := repository.NumberSaleRecord{
					Number:          normNumber,
					SalePriceTON:    priceTON,
					SaleType:        saleType,
					SaleDate:        saleDate,
					BuyerAddress:    buyer,
					SellerAddress:   seller,
					MarketAddress:   "fragment_telemint",
					PriceConfidence: confidence,
					TransactionHash: txHash,
					RawData:         rawData,
				}

				if err := s.repo.InsertNumberSale(ctx, saleRec); err == nil {
					indexedCount++
					slog.Info("Indexed new verified number sale", "number", normNumber, "price_ton", priceTON, "type", saleType, "tx", txHash)

					// Trigger instant watchlist notification
					if s.notifier != nil {
						s.notifier.NotifySale(ctx, saleRec, tonUsdRate)
					}
				}
			}
		}
	}

	return indexedCount, nil
}

func (s *NumbersSalesIndexer) extractPriceFromTrace(ctx context.Context, traceID string) (float64, string, string) {
	trace, err := s.client.FetchTrace(ctx, traceID)
	if err != nil {
		return 0, "unknown", "heuristic"
	}

	maxNano := int64(0)
	saleType := "auction"
	confidence := "heuristic"
	matchedMarket := false

	var traverse func(t *tonapi.Trace)
	traverse = func(t *tonapi.Trace) {
		isMarketTx := false
		for _, iface := range t.Interfaces {
			lower := strings.ToLower(iface)
			if strings.Contains(lower, "sale") || strings.Contains(lower, "market") {
				saleType = "direct_sale"
				isMarketTx = true
				matchedMarket = true
			} else if strings.Contains(lower, "auction") || strings.Contains(lower, "telemint") {
				saleType = "auction"
				isMarketTx = true
				matchedMarket = true
			}
		}

		if t.Transaction.InMsg != nil {
			msg := t.Transaction.InMsg
			op := strings.ToLower(msg.DecodedOpName)
			if strings.Contains(op, "bid") || strings.Contains(op, "purchase") || strings.Contains(op, "buy") || strings.Contains(op, "sale") {
				if msg.Value > 0 {
					maxNano = msg.Value
					matchedMarket = true
					confidence = "exact"
				}
			} else if isMarketTx && msg.Value > maxNano {
				maxNano = msg.Value
			} else if !matchedMarket && msg.Value > maxNano {
				maxNano = msg.Value
			}
		}

		for _, child := range t.Children {
			traverse(&child)
		}
	}

	traverse(trace)

	if maxNano == 0 {
		return 0, "unknown", "heuristic"
	}

	tonValue := float64(maxNano) / math.Pow10(9)
	if tonValue < 0.5 {
		return 0, "unknown", "heuristic"
	}

	if matchedMarket && confidence != "exact" {
		confidence = "exact"
	}

	return tonValue, saleType, confidence
}
