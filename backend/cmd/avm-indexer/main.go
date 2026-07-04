package main

import (
	"context"
	"log"
	"math"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/shopspring/decimal"

	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username/avm"
)

// Known Fragment / GetGems smart contract names to look for
var marketplaceNames = []string{
	"Getgems Deployer",
	"Fragment",
	"Fragment Auction",
	"elector.ton", // Sometimes involved in Fragment
}

func main() {
	log.Println("Starting Deep Blockchain Indexer (TonAPI)...")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Init DB
	repo, err := repository.NewDatabase(ctx)
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}
	defer repo.Close()

	// 2. Init TonAPI
	tonClient := tonapi.NewClient()

	// Setup Graceful Shutdown
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigs
		log.Println("Shutting down indexer gracefully...")
		cancel()
	}()

	// 3. Start Indexing
	offset := 0
	limit := 50 // TonAPI collection items limit

	log.Println("Fetching Telegram Usernames Collection Items...")
	for {
		if ctx.Err() != nil {
			break
		}

		items, err := tonClient.FetchCollectionItems(ctx, tonapi.UsernamesCollectionAddr, limit, offset)
		if err != nil {
			log.Printf("Error fetching collection items (offset %d): %v", offset, err)
			time.Sleep(5 * time.Second) // Backoff
			continue
		}

		if len(items.Items) == 0 {
			log.Println("No more items found. Indexing complete.")
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
			log.Printf("Inspecting NFT: %s (%s)", username, item.Address)

			processNFT(ctx, tonClient, repo, username, item.Address)
		}

		offset += len(items.Items)
		log.Printf("Processed %d items. Next offset: %d", len(items.Items), offset)
		time.Sleep(1 * time.Second) // Respect rate limits
	}
}

func processNFT(ctx context.Context, client *tonapi.Client, repo *repository.Database, username string, nftAddr string) {
	history, err := client.FetchNFTHistory(ctx, nftAddr, 20)
	if err != nil {
		log.Printf("  -> Error fetching history: %v", err)
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
			priceTon, saleType := extractPriceFromTrace(ctx, client, txHash)
			
			if priceTon > 0 {
				log.Printf("  [SALE FOUND] %s sold for %.2f TON (%s)", username, priceTon, saleType)
				
				saleDate := time.Unix(event.Timestamp, 0)
				
				_, err := repo.InsertSale(ctx, repository.Sale{
					Username:      username,
					CharLength:    charLen,
					Segment:       segment,
					HasNumbers:    features.HasNumbers,
					HasUnderscore: features.HasUnderscore,
					IsDictionary:  features.IsDictionary,
					SalePriceTON:  decimal.NewFromFloat(priceTon),
					SaleDate:      saleDate,
					SaleType:      saleType,
					Source:        "fragment",
				})
				if err != nil {
					log.Printf("  -> DB Insert Error: %v", err)
				}
			}
		}
	}
	
	time.Sleep(500 * time.Millisecond)
}

func extractPriceFromTrace(ctx context.Context, client *tonapi.Client, traceID string) (float64, string) {
	trace, err := client.FetchTrace(ctx, traceID)
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
