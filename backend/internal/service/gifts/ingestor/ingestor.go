package ingestor

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"

	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/gifts/giftchanges"
	"ifragment-backend/internal/service/gifts/traits"
	"ifragment-backend/internal/service/gifts/venues"
)

// IngestionEngine periodically aggregates gifts ecosystem intelligence every 6 hours
type IngestionEngine struct {
	repo        *repository.GiftsRepo
	cache       *repository.Cache
	changes     *giftchanges.Client
	cryptoPrice *cryptoprice.CryptoPriceService
	adapters    []venues.VenueAdapter
	interval    time.Duration
	syncMu      sync.Mutex
	isSyncing   bool
	lastSyncAt  time.Time
}

func NewIngestionEngine(
	repo *repository.GiftsRepo,
	cache *repository.Cache,
	cryptoPrice *cryptoprice.CryptoPriceService,
	interval time.Duration,
) *IngestionEngine {
	if interval <= 0 {
		interval = 6 * time.Hour
	}

	return &IngestionEngine{
		repo:        repo,
		cache:       cache,
		changes:     giftchanges.NewClient(),
		cryptoPrice: cryptoPrice,
		adapters: []venues.VenueAdapter{
			venues.NewFragmentAdapter(),
			venues.NewGetgemsAdapter(),
			venues.NewMarketAppAdapter(),
			venues.NewTelegramStarsAdapter(cryptoPrice),
			venues.NewTonnelAdapter(),
			venues.NewPortalsAdapter(),
			venues.NewMRKTAdapter(),
		},
		interval: interval,
	}
}

// Start runs the periodic 6-hour sync loop
func (e *IngestionEngine) Start(ctx context.Context) {
	slog.Info("Starting 6-hour Autonomous Gifts Ingestion Engine", "interval", e.interval)

	// Run initial sync after a short delay
	time.AfterFunc(5*time.Second, func() {
		syncCtx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		if err := e.SyncAll(syncCtx); err != nil {
			slog.Warn("Initial gifts ingestion sync error", "error", err)
		}
	})

	ticker := time.NewTicker(e.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			syncCtx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
			if err := e.SyncAll(syncCtx); err != nil {
				slog.Error("Periodic gifts ingestion failed", "error", err)
			}
			cancel()
		case <-ctx.Done():
			slog.Info("Gifts Ingestion Engine stopped")
			return
		}
	}
}

// TriggerSyncNow initiates an on-demand sync cycle
func (e *IngestionEngine) TriggerSyncNow(ctx context.Context) error {
	return e.SyncAll(ctx)
}

// SyncAll orchestrates the multi-phase data ingestion
func (e *IngestionEngine) SyncAll(ctx context.Context) error {
	e.syncMu.Lock()
	if e.isSyncing {
		e.syncMu.Unlock()
		return fmt.Errorf("sync already in progress")
	}
	e.isSyncing = true
	e.syncMu.Unlock()

	defer func() {
		e.syncMu.Lock()
		e.isSyncing = false
		e.lastSyncAt = time.Now().UTC()
		e.syncMu.Unlock()
	}()

	slog.Info("Starting Omni-Agent Gifts Ingestion Cycle...")
	startTime := time.Now()

	// 1. Fetch total stats from official feed
	if e.changes != nil {
		if ts, err := e.changes.GetTotal(ctx); err == nil && ts != nil {
			slog.Info("Ingestion: Loaded ecosystem total stats",
				"total_gifts", ts.Gifts.Total,
				"upgradable", ts.Gifts.Upgradable,
				"models", ts.Models,
				"backdrops", ts.Backdrops,
				"patterns", ts.Patterns,
			)
		}
	}

	// 2. Fetch all collections list
	allSlugs := e.resolveCollectionSlugs(ctx)
	slog.Info("Ingestion: Cataloging collections", "count", len(allSlugs))

	// 3. Concurrently ingest and sync collection details & traits
	e.syncCollectionsAndTraits(ctx, allSlugs)

	// 4. Compute cross-venue floor & arbitrage spreads
	e.computeArbitrageOpportunities(ctx, allSlugs)

	// 5. Ingest top whale wallet analytics
	e.syncWhaleHolders(ctx)

	// 6. Invalidate/warm cache
	if e.cache != nil {
		_ = e.cache.Client.Del(ctx, "gifts:collections_list").Err()
		_ = e.cache.Client.Del(ctx, "gifts:intel_overview").Err()
		_ = e.cache.Client.Del(ctx, "gifts:arbitrage_radar").Err()
		_ = e.cache.Client.Del(ctx, "gifts:whale_wallets").Err()
	}

	slog.Info("Omni-Agent Gifts Ingestion Cycle completed successfully",
		"duration", time.Since(startTime).String(),
		"total_synced", len(allSlugs),
	)
	return nil
}

func (e *IngestionEngine) resolveCollectionSlugs(ctx context.Context) []string {
	slugSet := make(map[string]bool)

	// From GiftChanges API if accessible
	if e.changes != nil {
		if names, err := e.changes.GetGifts(ctx); err == nil && len(names) > 0 {
			for _, n := range names {
				clean := strings.ToLower(strings.TrimSpace(n))
				clean = strings.ReplaceAll(clean, " ", "-")
				clean = strings.ReplaceAll(clean, "_", "-")
				slugSet[clean] = true
			}
		}
	}

	// Fallback/canonical registry ensures all 151+ iconic collections are always covered
	for _, col := range traits.GetGlobalCatalog().GetAllCollections() {
		slug := strings.ToLower(strings.TrimSpace(col.ModelID))
		slug = strings.ReplaceAll(slug, "_", "-")
		slugSet[slug] = true
	}

	result := make([]string, 0, len(slugSet))
	for s := range slugSet {
		result = append(result, s)
	}
	return result
}

func (e *IngestionEngine) syncCollectionsAndTraits(ctx context.Context, slugs []string) {
	sem := make(chan struct{}, 4) // Max 4 concurrent requests
	var wg sync.WaitGroup

	for _, slug := range slugs {
		slug := slug
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			e.syncOneCollection(ctx, slug)
		}()
	}

	wg.Wait()
}

func (e *IngestionEngine) syncOneCollection(ctx context.Context, slug string) {
	modelID := strings.ReplaceAll(slug, "-", "_")
	canonicalMeta, hasCanonical := traits.CanonicalCollections[slug]
	if !hasCanonical {
		canonicalMeta, hasCanonical = traits.CanonicalCollections[modelID]
	}

	name := strings.Title(strings.ReplaceAll(slug, "-", " "))
	totalSupply := 10000
	craftedFlag := false
	baseStars := 500

	if hasCanonical {
		name = canonicalMeta.Name
		totalSupply = canonicalMeta.TotalSupply
		craftedFlag = canonicalMeta.CraftedFlag
		baseStars = canonicalMeta.BaseStarsPrice
	}

	upgradedCount := 0
	availRemains := 0
	isAuction := slug == "khabibs-papakha" || slug == "ufc-strike"
	holdersCount := 0

	var detail *giftchanges.GiftDetail
	if e.changes != nil {
		if d, err := e.changes.GetGiftDetail(ctx, slug); err == nil && d != nil {
			detail = d
			if d.Gift.Name != "" {
				name = d.Gift.Name
			}
			if d.Gift.TotalSupply > 0 {
				totalSupply = d.Gift.TotalSupply
			}
			if d.Gift.UpgradedCount > 0 {
				upgradedCount = d.Gift.UpgradedCount
			}
			if d.Gift.AvailabilityRemain > 0 {
				availRemains = d.Gift.AvailabilityRemain
			}
			craftedFlag = d.Gift.Craftable
		}
	}

	now := time.Now().UTC()
	// RB-P0-001, DEL-P0-001, RB-P0-008: Zero synthetic trade metrics or multipliers.
	// In the absence of confirmed on-chain sales, volume/ATH/ATL/mcap remain zero/unverified.
	colRec := repository.ExtendedGiftCollectionRecord{
		ModelID:            modelID,
		Name:               name,
		Slug:               slug,
		TotalSupply:        totalSupply,
		CraftedFlag:        craftedFlag,
		UpgradedCount:      upgradedCount,
		AvailabilityRemain: availRemains,
		IsAuction:          isAuction,
		IsLimited:          true,
		UniqueHoldersCount: holdersCount,
		ATHPriceGRAM:       decimal.Zero,
		ATHDate:            nil,
		ATLPriceGRAM:       decimal.Zero,
		ATLDate:            nil,
		Volume24hGRAM:      decimal.Zero,
		Volume7dGRAM:       decimal.Zero,
		Volume30dGRAM:      decimal.Zero,
		TurnoverRate24h:    decimal.Zero,
		PriceChange24hPct:  decimal.Zero,
		PriceChange7dPct:   decimal.Zero,
		MarketCapUSD:       decimal.Zero,
		BaseStarsPrice:     baseStars,
		UpdatedAt:          now,
	}

	_ = e.repo.UpsertGiftCollectionExtended(ctx, colRec)

	// Persist 4-HEX Chromatic Backdrops
	if detail != nil && len(detail.Backdrops) > 0 {
		for _, bd := range detail.Backdrops {
			center := bd.Hex.GetCenter()
			edge := bd.Hex.GetEdge()
			pattern := bd.Hex.GetPattern()
			text := bd.Hex.GetText()

			tr := repository.GiftTraitRecord{
				ModelID:             modelID,
				TraitType:           "backdrop",
				TraitName:           bd.Name,
				Permille:            bd.GetRarityPermille(),
				BackdropCenter:      center,
				BackdropEdge:        edge,
				BackdropPattern:     pattern,
				BackdropText:        text,
				CraftChancePermille: bd.GetRarityPermille() / 2,
			}
			_ = e.repo.UpsertGiftTrait(ctx, tr)
		}
	} else {
		// Fallback to official 80 backdrops
		for bdName, bdMeta := range traits.OfficialBackdrops {
			tr := repository.GiftTraitRecord{
				ModelID:             modelID,
				TraitType:           "backdrop",
				TraitName:           bdName,
				Permille:            bdMeta.Permille,
				BackdropCenter:      bdMeta.Colors.CenterHex,
				BackdropEdge:        bdMeta.Colors.EdgeHex,
				BackdropPattern:     bdMeta.Colors.PatternHex,
				BackdropText:        bdMeta.Colors.TextHex,
				CraftChancePermille: bdMeta.Permille / 2,
			}
			_ = e.repo.UpsertGiftTrait(ctx, tr)
		}
	}

	// Persist Models
	if detail != nil && len(detail.Models) > 0 {
		for _, m := range detail.Models {
			tr := repository.GiftTraitRecord{
				ModelID:             modelID,
				TraitType:           "model",
				TraitName:           m.Name,
				Permille:            m.GetRarityPermille(),
				CraftChancePermille: m.GetRarityPermille(),
			}
			_ = e.repo.UpsertGiftTrait(ctx, tr)
		}
	}

	// Persist Symbols
	if detail != nil && len(detail.Symbols) > 0 {
		for _, s := range detail.Symbols {
			tr := repository.GiftTraitRecord{
				ModelID:             modelID,
				TraitType:           "symbol",
				TraitName:           s.Name,
				Permille:            s.GetRarityPermille(),
				CraftChancePermille: s.GetRarityPermille() / 2,
			}
			_ = e.repo.UpsertGiftTrait(ctx, tr)
		}
	}
}

func (e *IngestionEngine) computeArbitrageOpportunities(ctx context.Context, slugs []string) {
	if e.repo == nil || e.repo.DB() == nil || e.repo.DB().Pool == nil {
		return
	}

	query := `
		SELECT s1.model_id, s1.venue, s1.floor_price_gram, s1.venue_fee_pct,
		       s2.venue, s2.floor_price_gram, s2.venue_fee_pct
		FROM venue_snapshots s1
		JOIN venue_snapshots s2 ON s1.model_id = s2.model_id AND s1.venue != s2.venue
		WHERE s1.floor_price_gram > 0 AND s2.floor_price_gram > s1.floor_price_gram
	`
	rows, err := e.repo.DB().Pool.Query(ctx, query)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var modelID, v1, v2 string
		var p1, fee1, p2, fee2 decimal.Decimal
		if err := rows.Scan(&modelID, &v1, &p1, &fee1, &v2, &p2, &fee2); err == nil {
			fee1Factor := decimal.NewFromInt(1).Add(fee1.Div(decimal.NewFromInt(100)))
			cost := p1.Mul(fee1Factor)

			fee2Factor := decimal.NewFromInt(1).Sub(fee2.Div(decimal.NewFromInt(100)))
			revenue := p2.Mul(fee2Factor)

			netProfit := revenue.Sub(cost)
			if netProfit.GreaterThan(decimal.Zero) {
				roi := netProfit.Div(cost).Mul(decimal.NewFromInt(100)).Round(2)
				grossSpread := p2.Sub(p1)

				slug := strings.ReplaceAll(modelID, "_", "-")
				srcURL := getVenueDeepLink(venues.VenueID(v1), slug)
				tgtURL := getVenueDeepLink(venues.VenueID(v2), slug)

				rec := repository.ArbitrageOpportunityRecord{
					ModelID:         modelID,
					SourceVenue:     v1,
					TargetVenue:     v2,
					SourceFloorGRAM: p1,
					TargetFloorGRAM: p2,
					GrossSpreadGRAM: grossSpread,
					NetProfitGRAM:   netProfit.Round(2),
					NetROIPct:       roi,
					SourceURL:       srcURL,
					TargetURL:       tgtURL,
					UpdatedAt:       time.Now().UTC(),
				}
				_ = e.repo.UpsertArbitrageOpportunity(ctx, rec)
			}
		}
	}
}

func getVenueDeepLink(vID venues.VenueID, slug string) string {
	switch vID {
	case venues.VenueFragment:
		return "https://fragment.com/gifts/" + slug
	case venues.VenueGetgems:
		return "https://getgems.io/collection/" + slug
	case venues.VenueMarketApp:
		return "https://marketapp.ws/gifts/" + slug
	case venues.VenuePortals:
		return "https://portals.market/gift/" + slug
	case venues.VenueTonnel:
		return "https://t.me/tonnel_gift_bot?start=" + slug
	case venues.VenueMRKT:
		return "https://mrkt.tg/gifts/" + slug
	case venues.VenueTelegramStars:
		return "https://t.me/nft/" + slug
	default:
		return "https://fragment.com/gifts/" + slug
	}
}

func (e *IngestionEngine) syncWhaleHolders(ctx context.Context) {
	if e.repo == nil || e.repo.DB() == nil || e.repo.DB().Pool == nil {
		return
	}

	query := `
		SELECT buyer_address, COUNT(*) as cnt, COUNT(DISTINCT model_id) as uniq_cols, COALESCE(SUM(sale_price_gram), 0) as tot_val
		FROM gift_sales
		WHERE buyer_address IS NOT NULL AND buyer_address != '' AND COALESCE(is_reorged, FALSE) = FALSE
		GROUP BY buyer_address
		ORDER BY tot_val DESC
		LIMIT 25
	`
	rows, err := e.repo.DB().Pool.Query(ctx, query)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var addr string
		var count, uniq int
		var totVal decimal.Decimal
		if err := rows.Scan(&addr, &count, &uniq, &totVal); err == nil {
			label := addr
			if len(addr) > 10 {
				label = fmt.Sprintf("%s...%s", addr[:4], addr[len(addr)-4:])
			}
			_ = e.repo.UpsertWhaleWallet(ctx, repository.WhaleWalletRecord{
				WalletAddress:     addr,
				Label:             label,
				GiftsCount:        count,
				UniqueCollections: uniq,
				TotalEstValueGRAM: totVal,
				TopAssetName:      "Telegram Gift",
				LastActiveAt:      time.Now().UTC(),
			})
		}
	}
}

func round(val float64) float64 {
	return float64(int64(val*100+0.5)) / 100
}
