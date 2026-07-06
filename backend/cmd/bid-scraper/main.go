package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"

	"github.com/shopspring/decimal"
)

func main() {
	log.Println("Starting Active Bid Scraper...")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	repo, err := repository.NewDatabase(ctx)
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}
	defer repo.Close()

	tonClient := tonapi.NewClient()

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigs
		log.Println("Shutting down scraper gracefully...")
		cancel()
	}()

	offset := 0
	limit := 50

	log.Println("Scanning Telegram Usernames Collection for active auctions...")
	for {
		if ctx.Err() != nil {
			break
		}

		items, err := tonClient.GetCollectionItems(ctx, tonapi.UsernamesCollectionAddr, limit, offset)
		if err != nil {
			log.Printf("Error fetching collection items (offset %d): %v", offset, err)
			time.Sleep(5 * time.Second) // Backoff
			continue
		}

		if len(items.Items) == 0 {
			log.Println("No more items found. Scraping complete.")
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

			// Check if item is currently on sale/auction
			if item.Sale != nil && item.Sale.Price.Value != "" {
				priceNano, err := strconv.ParseFloat(item.Sale.Price.Value, 64)
				if err == nil && priceNano > 0 {
					priceTON := priceNano / 1e9

					log.Printf("Found Active Auction: @%s -> %.2f TON", username, priceTON)

					bid := repository.ActiveBid{
						Username:      username,
						HighestBidTON: decimal.NewFromFloat(priceTON),
						LastSeenAt:    time.Now(),
					}

					if err := repo.UpsertActiveBid(ctx, bid); err != nil {
						log.Printf("Failed to upsert active bid for %s: %v", username, err)
					}
				}
			}
		}

		offset += len(items.Items)
		log.Printf("Processed %d items. Next offset: %d", len(items.Items), offset)
		time.Sleep(1 * time.Second) // Respect rate limits
	}
}
