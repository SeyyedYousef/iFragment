package bootstrap

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/numbers/features"
	"ifragment-backend/internal/service/numbers/registry"
)

type BootstrapWorker struct {
	client    *tonapi.Client
	db        *repository.Database
	limiter   *rate.Limiter
	batchSize int
}

func NewBootstrapWorker(client *tonapi.Client, db *repository.Database) *BootstrapWorker {
	return &BootstrapWorker{
		client:    client,
		db:        db,
		limiter:   rate.NewLimiter(rate.Limit(8), 8), // 8 rps token bucket
		batchSize: 50,
	}
}

// RunResilientBootstrap scans the 136,566 Telegram Anonymous Numbers with checkpoint resilience
func (b *BootstrapWorker) RunResilientBootstrap(ctx context.Context) error {
	if b.db == nil || b.db.Pool == nil {
		return fmt.Errorf("database pool is nil")
	}

	offset := b.getLastCheckpoint(ctx)
	slog.Info("Starting Anonymous Numbers Bootstrap", "resume_offset", offset, "total_supply", registry.TotalSupply)

	for offset < registry.TotalSupply {
		if ctx.Err() != nil {
			slog.Info("Bootstrap worker interrupted gracefully", "last_offset", offset)
			return ctx.Err()
		}

		_ = b.limiter.Wait(ctx)

		items, err := b.client.FetchCollectionItems(ctx, registry.AnonymousNumbersCollectionAddr, b.batchSize, offset)
		if err != nil {
			slog.Error("Failed to fetch collection batch, backing off...", "offset", offset, "error", err)
			time.Sleep(3 * time.Second)
			continue
		}

		if len(items.Items) == 0 {
			slog.Info("No more items returned. Bootstrap scan complete.", "scanned", offset)
			break
		}

		// Process batch concurrently with worker pool
		var wg sync.WaitGroup
		itemChan := make(chan tonapi.NFTItem, len(items.Items))

		workerCount := 4
		for w := 0; w < workerCount; w++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for item := range itemChan {
					b.processNFTItem(ctx, item)
				}
			}()
		}

		for _, item := range items.Items {
			itemChan <- item
		}
		close(itemChan)
		wg.Wait()

		offset += len(items.Items)
		b.saveCheckpoint(ctx, offset, offset >= registry.TotalSupply)
		slog.Info("Bootstrap progress", "scanned", offset, "total", registry.TotalSupply, "pct", fmt.Sprintf("%.2f%%", (float64(offset)/float64(registry.TotalSupply))*100.0))
	}

	slog.Info("Bootstrap completed successfully. 136,566 Rarity Matrix locked.", "final_offset", offset)
	return nil
}

func (b *BootstrapWorker) processNFTItem(ctx context.Context, item tonapi.NFTItem) {
	rawNumber := item.Metadata.Name
	if rawNumber == "" {
		rawNumber = item.DNS
	}
	if rawNumber == "" {
		if item.Index >= 8000 && item.Index <= 8999 {
			rawNumber = fmt.Sprintf("+888%04d", item.Index)
		} else {
			rawNumber = fmt.Sprintf("+888%08d", item.Index)
		}
	}

	norm, err := features.NormalizeNumber(rawNumber)
	if err != nil {
		return
	}

	fv, err := features.ExtractFeatures(norm)
	if err != nil {
		return
	}

	colorName := "Blue" // Default baseline
	for _, attr := range item.Metadata.Attributes {
		if strings.EqualFold(attr.TraitType, "Color") || strings.EqualFold(attr.TraitType, "Theme") {
			for cName := range registry.OfficialColors {
				if strings.EqualFold(cName, strings.TrimSpace(attr.Value)) {
					colorName = cName
					break
				}
			}
			break
		}
	}
	featuresJSON, _ := json.Marshal(fv)

	// Upsert into number_features
	query := `
		INSERT INTO number_features (number, color, owner_address, nft_address, features, updated_at)
		VALUES ($1, $2, $3, $4, $5, now())
		ON CONFLICT (number) DO UPDATE
		SET color = EXCLUDED.color,
		    owner_address = EXCLUDED.owner_address,
		    nft_address = EXCLUDED.nft_address,
		    features = EXCLUDED.features,
		    updated_at = now()`

	_, _ = b.db.Pool.Exec(ctx, query, norm, colorName, item.Owner.Address, item.Address, featuresJSON)

	// Update histograms for exact rarity matrix
	b.incrementHistogram(ctx, "max_run", strconv.Itoa(fv.MaxRun))
	b.incrementHistogram(ctx, "distinct_digits", strconv.Itoa(fv.DistinctDigits))
	b.incrementHistogram(ctx, "tail_class", fv.TailClass)
	b.incrementHistogram(ctx, "repeated_block", fv.RepeatedBlock)
}

func (b *BootstrapWorker) incrementHistogram(ctx context.Context, key, bucket string) {
	query := `
		INSERT INTO feature_histograms (feature_key, bucket, count)
		VALUES ($1, $2, 1)
		ON CONFLICT (feature_key, bucket) DO UPDATE
		SET count = feature_histograms.count + 1`
	_, _ = b.db.Pool.Exec(ctx, query, key, bucket)
}

func (b *BootstrapWorker) getLastCheckpoint(ctx context.Context) int {
	query := `SELECT COALESCE(MAX(last_offset), 0) FROM number_bootstrap_checkpoints`
	var offset int
	_ = b.db.Pool.QueryRow(ctx, query).Scan(&offset)
	return offset
}

func (b *BootstrapWorker) saveCheckpoint(ctx context.Context, offset int, completed bool) {
	query := `
		INSERT INTO number_bootstrap_checkpoints (last_offset, total_scanned, is_completed, updated_at)
		VALUES ($1, $1, $2, now())`
	_, _ = b.db.Pool.Exec(ctx, query, offset, completed)
}
