package main

import (
	"context"
	"fmt"
	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username/avm"
	"log"
	"math/rand"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load(".env")
	if os.Getenv("DATABASE_URL") == "" {
		log.Fatal("DATABASE_URL must be set")
	}

	ctx := context.Background()
	db, err := repository.NewDatabase(ctx)
	if err != nil {
		log.Fatalf("Failed to connect to db: %v", err)
	}
	defer db.Close()

	// Ensure valuation_runs exists for the test
	_, _ = db.Pool.Exec(ctx, `DROP TABLE IF EXISTS valuation_runs`)
	_, err = db.Pool.Exec(ctx, `
		CREATE TABLE valuation_runs (
			id BIGSERIAL PRIMARY KEY,
			username TEXT NOT NULL,
			model_version TEXT NOT NULL,
			config_snapshot JSONB NOT NULL,
			ton_usd_rate NUMERIC(10,2) NOT NULL,
			base_price_ton NUMERIC(16,4) NOT NULL,
			low_ton NUMERIC(16,4) NOT NULL,
			expected_ton NUMERIC(16,4) NOT NULL,
			high_ton NUMERIC(16,4) NOT NULL,
			confidence_score NUMERIC(5,2) NOT NULL,
			comparable_sale_ids INTEGER[],
			reasoning_log JSONB NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
	`)
	if err != nil {
		log.Printf("Failed to create valuation_runs table: %v", err)
	}

	repo := db
	cacheService, _ := repository.NewCache(nil)
	tonClient := tonapi.NewClient()
	svc := avm.NewValuationService(repo, cacheService, tonClient)

	var allNames []string
	for k := range avm.HistoricalSales {
		allNames = append(allNames, k)
	}

	// Shuffle and pick 100
	rand.Seed(time.Now().UnixNano())
	rand.Shuffle(len(allNames), func(i, j int) {
		allNames[i], allNames[j] = allNames[j], allNames[i]
	})

	limit := 30
	if len(allNames) < 30 {
		limit = len(allNames)
	}
	selected := allNames[:limit]

	fmt.Printf("| %-15s | %-15s | %-15s | %-10s |\n", "Username", "DB Price (TON)", "AVM Expected", "Confidence")
	fmt.Printf("|%s|%s|%s|%s|\n", strings.Repeat("-", 17), strings.Repeat("-", 17), strings.Repeat("-", 17), strings.Repeat("-", 12))

	var wg sync.WaitGroup
	var mu sync.Mutex
	sem := make(chan struct{}, 2) // Limit to 2 concurrent valuations

	for _, name := range selected {
		wg.Add(1)
		sem <- struct{}{}
		go func(username string) {
			defer wg.Done()
			defer func() { <-sem }()
			actualPrice := avm.HistoricalSales[username]
			res, err := svc.Valuate(ctx, username, 0.0)
			if err != nil {
				log.Printf("Failed to valuate %s: %v", username, err)
				return
			}

			expected, _ := res.ExpectedTON.Float64()
			conf := res.ConfidenceScore

			mu.Lock()
			fmt.Printf("| @%-14s | %-15.0f | %-15.0f | %-10.1f |\n", username, actualPrice, expected, conf)
			mu.Unlock()
		}(name)
	}
	wg.Wait()
}
