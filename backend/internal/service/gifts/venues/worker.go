package venues

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"golang.org/x/sync/errgroup"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/gifts/traits"
)

// VenueSnapshotWorker periodically refreshes floor prices and volume snapshots across all supported marketplaces
type VenueSnapshotWorker struct {
	repo        *repository.GiftsRepo
	cryptoPrice *cryptoprice.CryptoPriceService
	tgClient    *telegram.BotAPIClient
	appURL      string
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
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		token = os.Getenv("BOT_TOKEN")
	}
	var tgClient *telegram.BotAPIClient
	if token != "" {
		tgClient = telegram.NewBotAPIClient(token)
	}
	appURL := os.Getenv("MINI_APP_URL")
	if appURL == "" {
		appURL = os.Getenv("APP_URL")
	}
	if appURL == "" {
		appURL = "https://t.me/iFragmentBot/app"
	}

	return &VenueSnapshotWorker{
		repo:        repo,
		cryptoPrice: cryptoPrice,
		tgClient:    tgClient,
		appURL:      appURL,
		adapters: []VenueAdapter{
			NewFragmentAdapter(),
			NewGetgemsAdapter(),
			NewMarketAppAdapter(),
			NewTelegramStarsAdapter(cryptoPrice),
			NewTonnelAdapter(),
			NewPortalsAdapter(),
			NewMRKTAdapter(),
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

	// Rate-limited sync worker pool with polite pacing to prevent HTTP 429
	sem := make(chan struct{}, 3) // Max 3 concurrent requests
	var wg sync.WaitGroup

	for i, col := range allCols {
		col := col
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			// Polite delay between batches
			if idx > 0 {
				time.Sleep(time.Duration(idx%3*100) * time.Millisecond)
			}
			w.syncOneCollection(ctx, col.ModelID)
		}(i)
	}

	wg.Wait()
	slog.Info("VenueSnapshotWorker: Snapshot sync cycle completed")
}

func (w *VenueSnapshotWorker) getFragmentAdapter() (*FragmentAdapter, bool) {
	for _, a := range w.adapters {
		if fa, ok := a.(*FragmentAdapter); ok {
			return fa, true
		}
	}
	return nil, false
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
			startT := time.Now()
			floorRes, err := adapter.FetchFloor(gctx, slug)
			durationMs := int(time.Since(startT).Milliseconds())

			if err == nil && floorRes != nil && !floorRes.FloorPriceGRAM.IsZero() {
				results <- snapResult{
					vID:  adapter.ID(),
					res:  floorRes,
					fees: adapter.ProtocolFeePct(),
				}
				_ = w.repo.UpdateSourceHealth(gctx, adapter.Name(), "healthy", true, durationMs, "")
			} else if err != nil && !errors.Is(err, ErrNoFloorData) {
				_ = w.repo.UpdateSourceHealth(gctx, adapter.Name(), "degraded", false, durationMs, err.Error())
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
			HasRealVolumeBadge: false, // only true if adapter returns verified non-zero volume
			UpdatedAt:          time.Now().UTC(),
		}

		if err := w.repo.UpsertVenueSnapshot(ctx, rec); err != nil {
			slog.Warn("Failed to upsert venue snapshot", "model_id", modelID, "venue", r.vID, "error", err)
		} else {
			// Persist into venue snapshot history to build genuine time-series data
			_ = w.repo.InsertVenueSnapshotHistory(ctx, rec)
		}

		if r.vID == VenueFragment {
			// Ingest recent verified sales from Fragment into gift_sales table and dispatch watchlist alerts
			if fragAdapter, ok := w.getFragmentAdapter(); ok {
				go func(mID, slg string) {
					salesCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
					defer cancel()
					if recentSales, err := fragAdapter.FetchRecentSales(salesCtx, slg); err == nil && len(recentSales) > 0 {
						for _, sale := range recentSales {
							saleRec := repository.GiftSaleRecord{
								GiftID:          fmt.Sprintf("%s-%d", slg, sale.SerialNumber),
								ModelID:         mID,
								SerialNumber:    sale.SerialNumber,
								Venue:           "fragment",
								Currency:        "GRAM",
								SalePriceRaw:    sale.PriceGRAM,
								SalePriceGRAM:   sale.PriceGRAM,
								SalePriceUSD:    decimal.Zero,
								VenueFeePct:     decimal.NewFromFloat(5.0),
								PriceConfidence: "high",
								SaleDate:        sale.SaleDate,
								BuyerAddress:    "",
								SellerAddress:   "",
								TxHash:          fmt.Sprintf("frag-%s-%d-%d", slg, sale.SerialNumber, sale.SaleDate.Unix()),
								EventIndex:      0,
							}
							inserted, insErr := w.repo.InsertGiftSale(salesCtx, saleRec)
							if insErr == nil && inserted > 0 {
								w.notifyGiftWatchers(salesCtx, saleRec)
							}
						}
					}
				}(modelID, slug)
			}
		}
	}
}

func (w *VenueSnapshotWorker) notifyGiftWatchers(ctx context.Context, sale repository.GiftSaleRecord) {
	if w.repo == nil || w.tgClient == nil {
		return
	}
	userIDs, err := w.repo.GetWatchedUsersForGift(ctx, sale.GiftID, sale.ModelID)
	if err != nil || len(userIDs) == 0 {
		return
	}

	var tonUsd float64
	if w.cryptoPrice != nil {
		if r, ok := w.cryptoPrice.GetFloatPrice("the-open-network"); ok && r > 0 {
			tonUsd = r
		}
	}
	priceFloat, _ := sale.SalePriceGRAM.Float64()
	priceUSD := priceFloat * tonUsd

	msg := fmt.Sprintf(
		"🔔 <b>Gift Watchlist Alert: %s Sold!</b>\n\n"+
			"💰 <b>Price:</b> <code>%s TON/GRAM</code> (≈ $%.2f)\n"+
			"🏛 <b>Venue:</b> %s\n"+
			"📅 <b>Date:</b> %s\n\n"+
			"📊 <a href=\"%s?startapp=gift_%s\">View Gift Intelligence Report</a>",
		telegram.EscapeHTML(sale.GiftID),
		sale.SalePriceGRAM.StringFixed(2),
		priceUSD,
		strings.ToUpper(sale.Venue),
		sale.SaleDate.UTC().Format("02 Jan 2006 15:04 UTC"),
		w.appURL,
		sale.GiftID,
	)

	for _, uid := range userIDs {
		targetID := uid
		go func() {
			bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := w.tgClient.SendMessage(bgCtx, targetID, msg, nil, nil); err != nil {
				slog.Warn("Failed to send gift watchlist sale alert", "user_id", targetID, "gift_id", sale.GiftID, "error", err)
			}
		}()
	}
}
