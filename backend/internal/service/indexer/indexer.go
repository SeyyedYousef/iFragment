package indexer

import (
	"context"
	"log/slog"
	"math"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username/avm"
)

var marketplaceNames = []string{
	"Getgems Deployer",
	"Fragment",
	"Fragment Auction",
	"elector.ton",
}

type IndexerService struct {
	client *tonapi.Client
	repo   *repository.Database
}

func NewIndexerService(client *tonapi.Client, repo *repository.Database) *IndexerService {
	return &IndexerService{
		client: client,
		repo:   repo,
	}
}

// StartBackgroundLoop runs the indexing process continuously in the background
// with a sleep interval between full collection sweeps.
func (s *IndexerService) StartBackgroundLoop(ctx context.Context, interval time.Duration) {
	slog.Info("Starting AVM TonAPI Indexer background loop...")

	go func() {
		for {
			select {
			case <-ctx.Done():
				slog.Info("Indexer background loop stopping...")
				return
			default:
				s.RunFullSweep(ctx)
				slog.Info("Indexer full sweep completed. Sleeping before next sweep...", "interval", interval)

				// Sleep with context awareness
				select {
				case <-ctx.Done():
					return
				case <-time.After(interval):
				}
			}
		}
	}()
}

// RunFullSweep processes all items in the Fragment collection.
func (s *IndexerService) RunFullSweep(ctx context.Context) {
	offset := 0
	limit := 50

	slog.Info("Fetching Telegram Usernames Collection Items...")
	for {
		if ctx.Err() != nil {
			break
		}

		items, err := s.client.FetchCollectionItems(ctx, tonapi.UsernamesCollectionAddr, limit, offset)
		if err != nil {
			slog.Error("Error fetching collection items", "offset", offset, "error", err)
			time.Sleep(5 * time.Second) // Backoff
			continue
		}

		if len(items.Items) == 0 {
			slog.Info("No more items found. Sweep complete.")
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
			s.processNFT(ctx, username, item.Address)
		}

		offset += len(items.Items)
		time.Sleep(1 * time.Second) // Respect rate limits
	}
}

func (s *IndexerService) processNFT(ctx context.Context, username string, nftAddr string) {
	history, err := s.client.FetchNFTHistory(ctx, nftAddr, 20)
	if err != nil {
		slog.Warn("Error fetching NFT history", "username", username, "error", err)
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

		isMarket := false
		for _, name := range marketplaceNames {
			if transfer.Sender.Name == name || transfer.Recipient.Name == name {
				isMarket = true
				break
			}
		}

		if !isMarket {
			continue
		}

		if len(event.Actions) > 0 && len(event.Actions[0].BaseTransactions) > 0 {
			txHash := event.Actions[0].BaseTransactions[0]
			priceTon, saleType := s.extractPriceFromTrace(ctx, txHash)

			if priceTon > 0 {
				slog.Debug("Sale found via indexer", "username", username, "price_ton", priceTon, "type", saleType)

				saleDate := time.Unix(event.Timestamp, 0)

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
					Source:        "indexer_daemon",
				})
				if err != nil && !strings.Contains(err.Error(), "duplicate key") {
					slog.Warn("DB Insert Error for sale", "username", username, "error", err)
				}
			}
		}
	}

	time.Sleep(500 * time.Millisecond)
}

func (s *IndexerService) extractPriceFromTrace(ctx context.Context, traceID string) (float64, string) {
	trace, err := s.client.FetchTrace(ctx, traceID)
	if err != nil {
		return 0, "unknown"
	}

	maxTon := int64(0)
	saleType := "buy_now"

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
		return 0, "unknown"
	}

	tonValue := float64(maxTon) / math.Pow10(9)

	if tonValue < 0.5 {
		return 0, "unknown"
	}

	return tonValue, saleType
}
