package main

import (
	"context"
	"fmt"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username/avm"
	"log"
	"math"
	"os"
	"sort"

	"github.com/joho/godotenv"
)

func main() {
	// Attempt to load .env relative to the cmd directory
	_ = godotenv.Load("../../.env")
	if os.Getenv("DATABASE_URL") == "" {
		log.Fatal("DATABASE_URL must be set")
	}

	ctx := context.Background()
	db, err := repository.NewDatabase(ctx)
	if err != nil {
		log.Fatalf("Failed to connect to db: %v", err)
	}
	defer db.Close()

	log.Println("Starting AVM V4 Point-in-Time (PiT) Backtest...")

	// Fetch all historical sales ordered by sale_date ASC
	allSales, err := db.GetAllSales(ctx)
	if err != nil {
		log.Fatalf("Failed to fetch historical sales: %v", err)
	}

	if len(allSales) == 0 {
		log.Println("No sales data available for backtesting.")
		return
	}

	log.Printf("Loaded %d sales for backtesting.", len(allSales))

	cfg := avm.DefaultEngineConfig()

	var absolutePercentageErrors []float64
	var coverageCount int
	var totalEvaluated int

	// Loop over every sale to predict its price at the exact moment before it happened
	for _, targetSale := range allSales {
		evalTime := targetSale.SaleDate

		// Strict PiT isolation: Gather only sales that occurred BEFORE this sale
		var exactSales []repository.Sale
		var broadSales []repository.Sale
		var count30, count31_90 int

		for _, s := range allSales {
			if !s.SaleDate.Before(evalTime) {
				continue
			}

			// Broad match
			if s.Segment == targetSale.Segment {
				broadSales = append(broadSales, s)

				// Exact match
				if s.CharLength == targetSale.CharLength {
					exactSales = append(exactSales, s)

					// Momentum counts
					daysAgo := evalTime.Sub(s.SaleDate).Hours() / 24.0
					if daysAgo >= 0 && daysAgo < 30 {
						count30++
					} else if daysAgo >= 30 && daysAgo < 90 {
						count31_90++
					}
				}
			}
		}

		// Skip if there's strictly zero data at all
		if len(exactSales) == 0 && len(broadSales) == 0 {
			continue
		}

		// Sort descending by date (newest first) to match DB query behavior
		sort.Slice(exactSales, func(i, j int) bool {
			return exactSales[i].SaleDate.After(exactSales[j].SaleDate)
		})
		sort.Slice(broadSales, func(i, j int) bool {
			return broadSales[i].SaleDate.After(broadSales[j].SaleDate)
		})

		// Convert to ComparableSale
		exactComps := avm.SalesToComparables(exactSales, cfg)
		broadComps := avm.SalesToComparables(broadSales, cfg)

		// Morph features for target
		_, _, features := avm.ClassifyUsername(targetSale.Username)

		// ── Execute Pipeline ──
		baseLog, _, mad, _ := avm.CalcBaseLog(nil, exactComps, broadComps, cfg, avm.MorphFeatures{}, evalTime)
		morphLog := avm.CalcMorphologyLog(features, cfg.MorphMultipliers, cfg)
		momentumLog := avm.CalcSmoothedMomentum(count30, count31_90, 1.0, cfg)
		expectedTON, lowTON, highTON := avm.CalcRangeLog(baseLog, morphLog, momentumLog, 0.0, mad, len(targetSale.Username), cfg)

		// The actual normalized price of the target sale
		actualPrice := avm.ToFloat64(avm.NormalizeSalePrice(targetSale.SalePriceTON, targetSale.SaleType, cfg))
		if actualPrice <= 0 {
			continue // Skip bad data
		}

		// ── Metrics ──
		ape := math.Abs(expectedTON-actualPrice) / actualPrice
		absolutePercentageErrors = append(absolutePercentageErrors, ape)

		if actualPrice >= lowTON && actualPrice <= highTON {
			coverageCount++
		}

		totalEvaluated++
	}

	if totalEvaluated == 0 {
		log.Println("Not enough data to evaluate any sales (all were the first of their kind).")
		return
	}

	// Calculate MdAPE
	sort.Float64s(absolutePercentageErrors)
	var mdape float64
	n := len(absolutePercentageErrors)
	if n%2 == 0 {
		mdape = (absolutePercentageErrors[n/2-1] + absolutePercentageErrors[n/2]) / 2.0
	} else {
		mdape = absolutePercentageErrors[n/2]
	}

	// Calculate Coverage
	coveragePct := float64(coverageCount) / float64(totalEvaluated) * 100.0

	fmt.Printf("\n======================================================\n")
	fmt.Printf("🎯 AVM V4 Point-in-Time Backtest Results\n")
	fmt.Printf("======================================================\n")
	fmt.Printf("Total Sales Evaluated : %d\n", totalEvaluated)
	fmt.Printf("MdAPE                 : %.2f%%\n", mdape*100)
	fmt.Printf("Range Coverage        : %.2f%%\n", coveragePct)
	fmt.Printf("======================================================\n")
	fmt.Printf("Note: Zero Future Leakage Guaranteed.\n")
}
