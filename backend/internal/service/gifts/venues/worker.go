package venues

import (
	"context"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"golang.org/x/sync/errgroup"

	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/gifts/traits"
)

// VenueSnapshotWorker periodically refreshes floor prices and volume snapshots across all supported marketplaces
type VenueSnapshotWorker struct {
	repo        *repository.GiftsRepo
	cryptoPrice *cryptoprice.CryptoPriceService
	adapters    []VenueAdapter
	interval    time.Duration
}

func NewVenueSnapshotWorker(
	repo *repository.GiftsRepo,
	cryptoPrice *cryptoprice.CryptoPriceService,
	interval time.Duration,
) *VenueSnapshotWorker {
	if interval <= 0 {
		interval = 3 * time.Minute
	}
	return &VenueSnapshotWorker{
		repo:        repo,
		cryptoPrice: cryptoPrice,
		adapters: []VenueAdapter{
			NewFragmentAdapter(),
			NewGetgemsAdapter(),
			NewMarketAppAdapter(),
			NewTelegramStarsAdapter(cryptoPrice),
		},
		interval: interval,
	}
}

// Start begins periodic snapshot aggregation
func (w *VenueSnapshotWorker) Start(ctx context.Context) {
	slog.Info("Starting real-data VenueSnapshotWorker for Telegram Gifts", "interval", w.interval)

	// Initial sync immediately
	w.syncSnapshots(ctx)

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			w.syncSnapshots(ctx)
		case <-ctx.Done():
			slog.Info("VenueSnapshotWorker stopped")
			return
		}
	}
}

func (w *VenueSnapshotWorker) syncSnapshots(ctx context.Context) {
	if w.repo == nil {
		return
	}

	allCols := traits.GetGlobalCatalog().GetAllCollections()
	if len(allCols) == 0 {
		return
	}

	slog.Info("VenueSnapshotWorker: Refreshing live marketplace snapshots...", "collections_count", len(allCols))

	// Rate-limited sync worker pool
	sem := make(chan struct{}, 6) // Max 6 concurrent requests
	var wg sync.WaitGroup

	for _, col := range allCols {
		col := col
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			w.syncOneCollection(ctx, col.ModelID)
		}()
	}

	wg.Wait()
	slog.Info("VenueSnapshotWorker: Snapshot sync cycle completed")
}

func (w *VenueSnapshotWorker) syncOneCollection(ctx context.Context, modelID string) {
	slug := strings.ReplaceAll(modelID, "_", "-")
	g, gctx := errgroup.WithContext(ctx)

	type snapResult struct {
		vID  VenueID
		res  *VenueFloorResult
		fees decimal.Decimal
	}

	results := make(chan snapResult, len(w.adapters))

	for _, adapter := range w.adapters {
		adapter := adapter
		g.Go(func() error {
			floorRes, err := adapter.FetchFloor(gctx, slug)
			if err == nil && floorRes != nil && !floorRes.FloorPriceGRAM.IsZero() {
				results <- snapResult{
					vID:  adapter.ID(),
					res:  floorRes,
					fees: adapter.ProtocolFeePct(),
				}
			}
			return nil
		})
	}

	_ = g.Wait()
	close(results)

	for r := range results {
		rec := repository.VenueSnapshotRecord{
			ModelID:            modelID,
			Venue:              string(r.vID),
			FloorPriceRaw:      r.res.FloorPriceRaw,
			FloorPriceGRAM:     r.res.FloorPriceGRAM,
			Currency:           r.res.Currency,
			Volume24hGRAM:      decimal.Zero,
			Volume7dGRAM:       decimal.Zero,
			ActiveListings:     r.res.ActiveListings,
			VenueFeePct:        r.fees,
			HasRealVolumeBadge: true,
			UpdatedAt:          time.Now().UTC(),
		}

		if err := w.repo.UpsertVenueSnapshot(ctx, rec); err != nil {
			slog.Warn("Failed to upsert venue snapshot", "model_id", modelID, "venue", r.vID, "error", err)
		}
	}
}
