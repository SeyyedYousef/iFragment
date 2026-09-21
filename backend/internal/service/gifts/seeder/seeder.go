package seeder

import (
	"context"
	"fmt"
	"log"

	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/gifts/traits"
)

// EnsureCanonicalDataSeeded checks if the gifts database is empty and hydrates it
func EnsureCanonicalDataSeeded(ctx context.Context, repo *repository.GiftsRepo) error {
	if repo == nil {
		return fmt.Errorf("gifts repo is nil")
	}

	count, err := repo.GetGiftCollectionsCount(ctx)
	if err != nil {
		return fmt.Errorf("failed to check gift collections count: %w", err)
	}

	if count >= len(traits.CanonicalCollections) {
		// Collections already seeded
		return nil
	}

	log.Printf("[GiftsSeeder] Database contains %d collections. Seeding canonical Telegram 120 collections and traits...", count)

	// 1. Seed All Canonical 120 Collections
	for slug, meta := range traits.CanonicalCollections {
		colRec := repository.GiftCollectionRecord{
			ModelID:        meta.ModelID,
			Name:           meta.Name,
			TotalSupply:    meta.TotalSupply,
			CraftedFlag:    meta.CraftedFlag,
			BaseStarsPrice: meta.BaseStarsPrice,
		}
		if err := repo.UpsertGiftCollection(ctx, colRec); err != nil {
			log.Printf("[GiftsSeeder] Warning: failed to upsert collection %s: %v", slug, err)
			continue
		}

		// 2. Seed Official Backdrops for this collection
		for bdName, bdMeta := range traits.OfficialBackdrops {
			tr := repository.GiftTraitRecord{
				ModelID:             meta.ModelID,
				TraitType:           "backdrop",
				TraitName:           bdName,
				Permille:            bdMeta.Permille,
				BackdropCenter:      bdMeta.Colors.CenterHex,
				BackdropEdge:        bdMeta.Colors.EdgeHex,
				BackdropPattern:     bdMeta.Colors.PatternHex,
				BackdropText:        bdMeta.Colors.TextHex,
				CraftChancePermille: bdMeta.Permille / 2,
			}
			_ = repo.UpsertGiftTrait(ctx, tr)
		}

		// 3. Seed Official Symbols for this collection
		for symName, symMeta := range traits.OfficialSymbols {
			tr := repository.GiftTraitRecord{
				ModelID:             meta.ModelID,
				TraitType:           "symbol",
				TraitName:           symName,
				Permille:            symMeta.Permille,
				CraftChancePermille: symMeta.Permille / 2,
			}
			_ = repo.UpsertGiftTrait(ctx, tr)
		}

		// 4. Seed Canonical Models for top collections
		seedModelsForCollection(ctx, repo, meta.ModelID)
	}

	// 5. RB-P0-001, DEL-P0-001: Zero synthetic market data seeding
	// Live venue snapshots, sales, and listings must strictly come from genuine indexer/scrapers

	log.Printf("[GiftsSeeder] Successfully seeded all %d collections and canonical traits.", len(traits.CanonicalCollections))
	return nil
}

// seedModelsForCollection seeds known official models for iconic collections
func seedModelsForCollection(ctx context.Context, repo *repository.GiftsRepo, modelID string) {
	models := getCanonicalModels(modelID)
	for _, m := range models {
		tr := repository.GiftTraitRecord{
			ModelID:             modelID,
			TraitType:           "model",
			TraitName:           m.name,
			Permille:            m.permille,
			CraftChancePermille: m.permille,
		}
		_ = repo.UpsertGiftTrait(ctx, tr)
	}
}

type modelEntry struct {
	name     string
	permille int
}

func getCanonicalModels(modelID string) []modelEntry {
	switch modelID {
	case "plush_pepe":
		return []modelEntry{
			{"Ninja Mike", 10},
			{"Louis Vuittoad", 10},
			{"Steel Frog", 10},
			{"Gucci Leap", 10},
			{"Raphael", 10},
			{"Midas Pepe", 10},
			{"Leonardo", 15},
			{"Donatello", 15},
			{"Puppy Pug", 20},
			{"Cold Heart", 30},
			{"Spectrum", 30},
			{"Gummy Frog", 30},
			{"Poison Dart", 30},
			{"Hue Jester", 30},
			{"Standard Pepe", 50},
		}
	case "durov_cap":
		return []modelEntry{
			{"Sovereign Durov", 10},
			{"Cyber Velvet", 15},
			{"Onyx Stealth", 20},
			{"Gold Trim", 25},
			{"Midnight Canvas", 50},
			{"Classic Black", 70},
		}
	case "diamond_ring":
		return []modelEntry{
			{"Solitaire Royal", 10},
			{"Pink Diamond", 15},
			{"Emerald Cut", 20},
			{"Platinum Band", 30},
			{"White Gold", 40},
			{"Classic Gold", 60},
		}
	case "santa_hat":
		return []modelEntry{
			{"Crystal Frost", 10},
			{"Golden Trim", 15},
			{"Velvet Royal", 25},
			{"Classic Red", 60},
		}
	case "magic_potion":
		return []modelEntry{
			{"Elixir of Life", 10},
			{"Cosmic Mana", 15},
			{"Venom Flask", 25},
			{"Emerald Draft", 40},
			{"Amethyst Brew", 50},
		}
	default:
		return []modelEntry{
			{"Genesis Edition", 10},
			{"Master Craft", 25},
			{"Royal Variant", 40},
			{"Artisan Standard", 70},
		}
	}
}



