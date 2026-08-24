package main

import (
	"context"
	"flag"
	"fmt"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username/avm"
	"log"
	"math"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type SegmentStat struct {
	Count       int
	InBandCount int
	Errors      []float64
}

func main() {
	outPath := flag.String("output", "", "Optional path to export markdown report")
	flag.Parse()

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

	log.Printf("Starting AVM v7.0 Point-in-Time (PiT) Backtest (%s)...", avm.ModelVersion)

	// Fetch all historical sales ordered by sale_date ASC
	allSales, err := db.GetAllSales(ctx)
	if err != nil {
		log.Fatalf("Failed to fetch historical sales: %v", err)
	}

	if len(allSales) == 0 {
		log.Println("No sales data available for backtesting.")
		return
	}

	log.Printf("Loaded %d historical sales for backtesting.", len(allSales))

	cfg := avm.DefaultEngineConfig()

	var (
		absolutePercentageErrors []float64
		coverageCount            int
		totalEvaluated           int
		segmentStats             = make(map[string]*SegmentStat)
		lengthStats              = make(map[int]*SegmentStat)
	)

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

		// Convert to ComparableSale with Winsorization
		exactComps := avm.SalesToComparables(exactSales, cfg)
		broadComps := avm.SalesToComparables(broadSales, cfg)

		// Morph features for target
		segment, charLen, features := avm.ClassifyUsername(targetSale.Username)

		// ── Execute AVM v7.0 Math Pipeline ──
		baseLog, nEff, mad, _ := avm.CalcBaseLog(nil, exactComps, broadComps, cfg, features, evalTime)
		morphLog := avm.CalcMorphologyLog(features, cfg.MorphMultipliers, cfg)
		momentumLog := avm.CalcSmoothedMomentum(count30, count31_90, 1.0, cfg)
		expectedTON, lowTON, highTON := avm.CalcRangeLog(baseLog, morphLog, momentumLog, 0.0, mad, int(charLen), cfg)

		// Apply Quantile / MAD Blend
		if nEff >= cfg.BandBlendNEffThreshold && mad > 0 {
			madWidth := mad * cfg.UncertaintyMult
			if madWidth < 0.10 {
				madWidth = 0.10
			}
			blendedWidth := cfg.BandBlendMADWeight*madWidth + cfg.BandBlendFixedWeight*math.Log(1.30)
			lowTON = expectedTON * math.Exp(-blendedWidth)
			highTON = expectedTON * math.Exp(blendedWidth)
		}

		// The actual price of the target sale
		actualPrice := avm.ToFloat64(avm.NormalizeSalePrice(targetSale.SalePriceTON, targetSale.SaleType, cfg))
		if actualPrice <= 0 {
			continue
		}

		// ── Metrics ──
		ape := math.Abs(expectedTON-actualPrice) / actualPrice * 100.0
		absolutePercentageErrors = append(absolutePercentageErrors, ape)

		inBand := actualPrice >= lowTON && actualPrice <= highTON
		if inBand {
			coverageCount++
		}

		// Track Segment breakdown
		if segmentStats[segment] == nil {
			segmentStats[segment] = &SegmentStat{}
		}
		segmentStats[segment].Count++
		segmentStats[segment].Errors = append(segmentStats[segment].Errors, ape)
		if inBand {
			segmentStats[segment].InBandCount++
		}

		// Track Length breakdown
		l := int(charLen)
		if lengthStats[l] == nil {
			lengthStats[l] = &SegmentStat{}
		}
		lengthStats[l].Count++
		lengthStats[l].Errors = append(lengthStats[l].Errors, ape)
		if inBand {
			lengthStats[l].InBandCount++
		}

		totalEvaluated++
	}

	if totalEvaluated == 0 {
		log.Println("Not enough data to evaluate any sales.")
		return
	}

	// Calculate Global MdAPE
	sort.Float64s(absolutePercentageErrors)
	var mdape float64
	n := len(absolutePercentageErrors)
	if n%2 == 0 {
		mdape = (absolutePercentageErrors[n/2-1] + absolutePercentageErrors[n/2]) / 2.0
	} else {
		mdape = absolutePercentageErrors[n/2]
	}

	coveragePct := float64(coverageCount) / float64(totalEvaluated) * 100.0

	fmt.Printf("\n======================================================\n")
	fmt.Printf("🏆 AVM v7.0 Point-in-Time Backtest Results\n")
	fmt.Printf("======================================================\n")
	fmt.Printf("Model Version         : %s\n", avm.ModelVersion)
	fmt.Printf("Total Sales Evaluated : %d\n", totalEvaluated)
	fmt.Printf("Global MdAPE          : %.2f%%\n", mdape)
	fmt.Printf("Range Coverage        : %.2f%%\n", coveragePct)
	fmt.Printf("======================================================\n")

	for seg, st := range segmentStats {
		sort.Float64s(st.Errors)
		segMdAPE := st.Errors[len(st.Errors)/2]
		segCov := float64(st.InBandCount) / float64(st.Count) * 100.0
		fmt.Printf("  • Segment [%-10s] N=%-4d | MdAPE: %5.2f%% | Coverage: %5.2f%%\n", seg, st.Count, segMdAPE, segCov)
	}

	if *outPath != "" {
		var md strings.Builder
		md.WriteString(fmt.Sprintf("# 📊 AVM v7.0 Empirical Backtest Report\n\n"))
		md.WriteString(fmt.Sprintf("- **Evaluated At**: `%s`\n", time.Now().UTC().Format(time.RFC3339)))
		md.WriteString(fmt.Sprintf("- **Model Version**: `%s`\n", avm.ModelVersion))
		md.WriteString(fmt.Sprintf("- **Total Samples Evaluated**: `%d`\n", totalEvaluated))
		md.WriteString(fmt.Sprintf("- **Global MdAPE**: `%.2f%%`\n", mdape))
		md.WriteString(fmt.Sprintf("- **Within-Band Coverage**: `%.2f%%`\n\n", coveragePct))
		md.WriteString("## Segment Accuracy Breakdown\n\n")
		md.WriteString("| Segment | Samples | MdAPE | Coverage |\n| :--- | :--- | :--- | :--- |\n")
		for seg, st := range segmentStats {
			sort.Float64s(st.Errors)
			segMdAPE := st.Errors[len(st.Errors)/2]
			segCov := float64(st.InBandCount) / float64(st.Count) * 100.0
			md.WriteString(fmt.Sprintf("| `%s` | %d | `%.2f%%` | `%.2f%%` |\n", seg, st.Count, segMdAPE, segCov))
		}

		_ = os.WriteFile(*outPath, []byte(md.String()), 0644)
		log.Printf("Report exported to %s", *outPath)
	}
}
