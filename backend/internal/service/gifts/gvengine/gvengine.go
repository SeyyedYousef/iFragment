package gvengine

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"golang.org/x/sync/singleflight"

	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/gifts/crafting"
	"ifragment-backend/internal/service/gifts/risk"
	"ifragment-backend/internal/service/gifts/serials"
	"ifragment-backend/internal/service/gifts/starsrate"
	"ifragment-backend/internal/service/gifts/telegramnft"
	"ifragment-backend/internal/service/gifts/traits"
	"ifragment-backend/internal/service/gifts/upgrade"
	"ifragment-backend/internal/service/gifts/venues"
	"ifragment-backend/internal/service/username/avm"
	"ifragment-backend/internal/service/valuation/core"
)

const (
	ModelVersion = "GV-Engine-v8.0-FloorLockedQuantum"
	ShrinkageK   = 10.0
	DecayLambda  = 0.005
)

// ValuationEngine coordinates quantitative valuation for Telegram Gifts
type ValuationEngine struct {
	db             *repository.Database
	cache          *repository.Cache
	giftsRepo      *repository.GiftsRepo
	cryptoPriceSvc *cryptoprice.CryptoPriceService
	nftResolver    *telegramnft.Resolver
	sfGroup        singleflight.Group
}

func NewValuationEngine(
	db *repository.Database,
	cache *repository.Cache,
	cryptoPrice *cryptoprice.CryptoPriceService,
) *ValuationEngine {
	return &ValuationEngine{
		db:             db,
		cache:          cache,
		giftsRepo:      repository.NewGiftsRepo(db),
		cryptoPriceSvc: cryptoPrice,
		nftResolver:    telegramnft.NewResolver(),
	}
}

// SetNFTResolver allows overriding or disabling the live Telegram NFT resolver
func (e *ValuationEngine) SetNFTResolver(resolver *telegramnft.Resolver) {
	e.nftResolver = resolver
}

// SetMTProtoClient configures the native MTProto client on the NFT resolver
func (e *ValuationEngine) SetMTProtoClient(client mtproto.Client) {
	if e.nftResolver != nil {
		e.nftResolver.SetMTProtoClient(client)
	}
}

// GetNFTResolver returns the live Telegram NFT resolver
func (e *ValuationEngine) GetNFTResolver() *telegramnft.Resolver {
	return e.nftResolver
}

// ParsedGiftRef holds resolved model and serial details
type ParsedGiftRef struct {
	GiftID       string
	ModelID      string
	SerialNumber int
	RawInput     string
}

// NormalizeGiftIdentifier parses 4 formats: t.me/nft/..., NFT-ID, address, username
func NormalizeGiftIdentifier(raw string) (*ParsedGiftRef, error) {
	trimmed := strings.TrimSpace(raw)
	if strings.HasPrefix(trimmed, "@") {
		return nil, fmt.Errorf("user identifier '%s' is not a single gift; use portfolio scanner", trimmed)
	}
	if (strings.HasPrefix(trimmed, "EQ") || strings.HasPrefix(trimmed, "UQ") || strings.HasPrefix(trimmed, "eq") || strings.HasPrefix(trimmed, "uq")) && len(trimmed) >= 48 {
		return nil, fmt.Errorf("wallet address '%s' is not a single gift; use portfolio scanner", trimmed)
	}

	clean := trimmed
	clean = strings.TrimPrefix(clean, "https://")
	clean = strings.TrimPrefix(clean, "http://")
	clean = strings.TrimPrefix(clean, "telegram.me/nft/")
	clean = strings.TrimPrefix(clean, "t.me/nft/")
	clean = strings.TrimPrefix(clean, "fragment.com/gift/")

	// Clean out trailing slashes and query params
	if idx := strings.Index(clean, "?"); idx != -1 {
		clean = clean[:idx]
	}
	clean = strings.TrimRight(clean, "/")
	clean = strings.ToLower(clean)

	// Strip apostrophes, replace # and spaces with dash
	clean = strings.ReplaceAll(clean, "'", "")
	clean = strings.ReplaceAll(clean, "’", "")
	clean = strings.ReplaceAll(clean, "#", "-")
	clean = strings.ReplaceAll(clean, " ", "-")

	// Match pattern: collection_name - number
	// Match trailing serial number: greedy prefix captures full collection name (even with dashes/underscores)
	re := regexp.MustCompile(`^(.*)[-#_]+(\d+)$`)
	matches := re.FindStringSubmatch(clean)

	if len(matches) >= 3 {
		modelKey := strings.Trim(matches[1], "-_ ")
		serial, err := strconv.Atoi(matches[2])
		if err != nil || serial <= 0 {
			return nil, fmt.Errorf("invalid serial number: serial must be >= 1")
		}

		if modelKey != "" {
			col, _ := traits.ResolveCollection(modelKey)
			modelID := col.ModelID
			if modelID == "" {
				modelID = traits.NormalizeSlug(modelKey)
			}
			return &ParsedGiftRef{
				GiftID:       fmt.Sprintf("%s-%d", modelID, serial),
				ModelID:      modelID,
				SerialNumber: serial,
				RawInput:     raw,
			}, nil
		}
	}

	// Also check if no separator before trailing digits (e.g. PlushPepe1)
	reNoSep := regexp.MustCompile(`^([a-z_]+)(\d+)$`)
	if m := reNoSep.FindStringSubmatch(clean); len(m) >= 3 {
		modelKey := m[1]
		serial, err := strconv.Atoi(m[2])
		if err == nil && serial > 0 {
			col, _ := traits.ResolveCollection(modelKey)
			modelID := col.ModelID
			if modelID == "" {
				modelID = traits.NormalizeSlug(modelKey)
			}
			return &ParsedGiftRef{
				GiftID:       fmt.Sprintf("%s-%d", modelID, serial),
				ModelID:      modelID,
				SerialNumber: serial,
				RawInput:     raw,
			}, nil
		}
	}

	if clean != "" {
		cleanModel := strings.Trim(clean, "-_ ")
		col, _ := traits.ResolveCollection(cleanModel)
		modelID := col.ModelID
		if modelID == "" {
			modelID = traits.NormalizeSlug(cleanModel)
		}
		if modelID != "" {
			return nil, fmt.Errorf("collection name '%s' provided without serial number; please specify serial number (e.g. %s-1)", cleanModel, modelID)
		}
	}

	return nil, fmt.Errorf("invalid gift identifier: %s", raw)
}


// GenerateCuriosityGate creates the pre-paywall teaser with ZERO valuation leakage (Sacred Rule 3)
func (e *ValuationEngine) GenerateCuriosityGate(ctx context.Context, raw string) (*CuriosityGateResponse, error) {
	ref, err := NormalizeGiftIdentifier(raw)
	if err != nil {
		return nil, err
	}

	col, isKnownCol := traits.ResolveCollection(ref.ModelID)
	// RB-P0-003, AC-P0-002: Strict Gift Identity Gate
	if !isKnownCol {
		return nil, fmt.Errorf("unknown gift collection '%s'", ref.ModelID)
	}
	if ref.SerialNumber <= 0 {
		return nil, fmt.Errorf("invalid gift serial number #%d", ref.SerialNumber)
	}

	selectedModel := ""
	ownerName := ""
	imageURL := ""

	if e.nftResolver != nil && ref.SerialNumber > 0 {
		if liveNFT, err := e.nftResolver.ResolveGiftNFT(ctx, ref.ModelID, ref.SerialNumber); err == nil && liveNFT != nil {
			selectedModel = liveNFT.Model
			ownerName = liveNFT.OwnerName
			imageURL = liveNFT.ImageURL
			if liveNFT.TotalSupply > 0 {
				col.TotalSupply = liveNFT.TotalSupply
			}
			if liveNFT.IssuedCount > col.TotalSupply {
				col.TotalSupply = liveNFT.IssuedCount
			}
		}
	}

	if col.TotalSupply > 0 && ref.SerialNumber > col.TotalSupply {
		return nil, fmt.Errorf("serial number #%d exceeds total supply of %d for collection '%s'", ref.SerialNumber, col.TotalSupply, col.Name)
	}

	if imageURL == "" {
		slugParam := strings.ReplaceAll(col.ModelID, "_", "-")
		modelParam := selectedModel
		if modelParam == "" {
			modelParam = "1"
		}
		imageURL = fmt.Sprintf("https://api.changes.tg/model/%s/%s.png?size=256", slugParam, modelParam)
	}

	gramUsdRate := 0.0
	if e.cryptoPriceSvc != nil {
		if rate, ok := e.cryptoPriceSvc.GetFloatPrice("the-open-network"); ok && rate > 0 {
			gramUsdRate = rate
		} else if rate, _, _, _, ok := e.cryptoPriceSvc.GetTONUSDT(ctx); ok && rate > 0 {
			gramUsdRate = rate
		}
	}

	// 8 Analyzed core signals count
	signalsCount := 8

	// Preliminary risk count without leaking details
	risksCount := 0
	if col.CraftedFlag {
		risksCount++ // Crafting burn/variance risk
	}
	if ref.SerialNumber > col.TotalSupply {
		risksCount++
	}

	floorGRAM := e.resolveDynamicFloor(ctx, col.ModelID, col, gramUsdRate)
	floorUSD := math.Round(floorGRAM*gramUsdRate*100.0) / 100.0

	return &CuriosityGateResponse{
		GiftID:           ref.GiftID,
		ModelID:          col.ModelID,
		ModelName:        col.Name,
		SerialNumber:     ref.SerialNumber,
		SelectedModel:    selectedModel,
		OwnerName:        ownerName,
		ImageURL:         imageURL,
		SignalsAnalyzed:  signalsCount,
		RisksIdentified:  risksCount,
		DataSourcesCount: 2, // Fragment, Telegram Official API
		IsCrafted:        col.CraftedFlag,
		FloorPriceGRAM:   floorGRAM,
		FloorPriceUSD:    floorUSD,
		CheckedAt:        time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// resolveDynamicFloor determines the realistic secondary market floor price using live Fragment orderbook quotes, fresh DB snapshots, recent verified sales, or canonical supply economics.
func (e *ValuationEngine) resolveDynamicFloor(ctx context.Context, modelID string, col traits.CollectionMeta, tonUsdRate float64) float64 {
	// 0. Live Fragment public orderbook anchor (cached 2m in EcosystemTrackerClient; skipped in offline unit tests)
	var liveFragFloor float64
	if e.db != nil || e.cache != nil || e.cryptoPriceSvc != nil {
		probeCtx, cancel := context.WithTimeout(ctx, 2500*time.Millisecond)
		if q, err := venues.GetGlobalTrackerClient().FetchVenueQuote(probeCtx, modelID, venues.VenueFragment); err == nil && q != nil && q.FloorPriceGRAM.GreaterThan(decimal.Zero) {
			if f, _ := q.FloorPriceGRAM.Float64(); f > 0 && f != 16111.0 {
				liveFragFloor = f
			}
		}
		cancel()
	}

	// 1. Query database venue snapshots if available (strictly excluding Telegram Stars mint price, 16,111 anomaly, and stale rows)
	var dbFloor float64
	if e.giftsRepo != nil {
		checkSnaps := func(mID string, maxAge time.Duration) float64 {
			snaps, err := e.giftsRepo.GetVenueSnapshots(ctx, mID)
			if err != nil || len(snaps) == 0 {
				return 0.0
			}
			bestFloor := 0.0
			for _, snap := range snaps {
				// Sacred Rule: Telegram Stars is the primary mint price, NEVER a secondary marketplace floor
				if snap.Venue == string(venues.VenueTelegramStars) || strings.EqualFold(snap.Currency, "Stars") {
					continue
				}
				if maxAge > 0 && !snap.UpdatedAt.IsZero() && time.Since(snap.UpdatedAt) > maxAge {
					continue
				}
				f, _ := snap.FloorPriceGRAM.Float64()
				// Exclude poisoned 16111 anomaly snapshots
				if f > 0 && f != 16111.0 && (bestFloor == 0.0 || f < bestFloor) {
					bestFloor = f
				}
			}
			return bestFloor
		}

		// Prefer fresh snapshots (< 6 hours); fall back to < 48h only if no live Fragment quote exists
		dbFloor = checkSnaps(modelID, 6*time.Hour)
		if dbFloor <= 0 && col.ModelID != "" && col.ModelID != modelID {
			dbFloor = checkSnaps(col.ModelID, 6*time.Hour)
		}
		if dbFloor <= 0 && liveFragFloor <= 0 {
			dbFloor = checkSnaps(modelID, 48*time.Hour)
			if dbFloor <= 0 && col.ModelID != "" && col.ModelID != modelID {
				dbFloor = checkSnaps(col.ModelID, 48*time.Hour)
			}
		}
	}

	switch {
	case liveFragFloor > 0 && dbFloor > 0:
		// Accept lower secondary venue floor (e.g. Portals/MRKT/Tonnel) only if realistic relative to live Fragment orderbook
		if dbFloor >= liveFragFloor*0.72 && dbFloor <= liveFragFloor*1.15 {
			return math.Min(liveFragFloor, dbFloor)
		}
		return liveFragFloor
	case liveFragFloor > 0:
		return liveFragFloor
	case dbFloor > 0:
		return dbFloor
	}

	if e.giftsRepo != nil {
		// 2. Query empirical clearing floor from real verified recent sales in gift_sales (last 21 days)
		checkSales := func(mID string) float64 {
			stats, err := e.giftsRepo.GetSalesStatsByPeriod(ctx, mID, time.Now().Add(-21*24*time.Hour))
			if err == nil && stats != nil && stats.DealsCount >= 3 {
				minF, _ := stats.MinGRAM.Float64()
				if minF > 0 && minF != 16111.0 {
					return minF
				}
			}
			return 0.0
		}
		if sf := checkSales(modelID); sf > 0 {
			return sf
		}
		if col.ModelID != "" && col.ModelID != modelID {
			if sf := checkSales(col.ModelID); sf > 0 {
				return sf
			}
		}
	}

	// 3. Calibrated supply scarcity baseline economics
	supply := col.TotalSupply
	if supply <= 0 {
		supply = 10000
	}

	var baseTon float64
	switch {
	case supply <= 1000:
		baseTon = 125.0
	case supply <= 2500:
		baseTon = 65.0
	case supply <= 5000:
		baseTon = 35.0
	case supply <= 10000:
		baseTon = 20.0
	case supply <= 25000:
		baseTon = 12.0
	case supply <= 50000:
		baseTon = 7.5
	default:
		baseTon = 4.5
	}

	if col.CraftedFlag {
		baseTon *= 1.40 // 40% intrinsic burn/crafting premium
	}

	return math.Round(baseTon*10.0) / 10.0
}

// Valuate computes the full mathematical valuation for a Telegram Gift
func (e *ValuationEngine) Valuate(ctx context.Context, raw string) (*GiftValuation, error) {
	ref, err := NormalizeGiftIdentifier(raw)
	if err != nil {
		return nil, err
	}

	res, err, _ := e.sfGroup.Do(ref.GiftID, func() (interface{}, error) {
		return e.computeValuation(ctx, ref)
	})
	if err != nil {
		return nil, err
	}

	return res.(*GiftValuation), nil
}

func (e *ValuationEngine) computeValuation(ctx context.Context, ref *ParsedGiftRef) (*GiftValuation, error) {
	col, isKnownCol := traits.ResolveCollection(ref.ModelID)
	// RB-P0-003, AC-P0-002: Strict Gift Identity Gate
	if !isKnownCol {
		return nil, fmt.Errorf("unknown gift collection '%s'", ref.ModelID)
	}

	// Live on-chain resolver for real model, backdrop, symbol, and owner
	var liveNFT *telegramnft.LiveNFTDetails
	if e.nftResolver != nil && ref.SerialNumber > 0 {
		if details, err := e.nftResolver.ResolveGiftNFT(ctx, ref.ModelID, ref.SerialNumber); err == nil && details != nil {
			liveNFT = details
			if liveNFT.TotalSupply > 0 {
				col.TotalSupply = liveNFT.TotalSupply
			}
			if liveNFT.IssuedCount > col.TotalSupply {
				col.TotalSupply = liveNFT.IssuedCount
			}
		}
	}

	if col.TotalSupply > 0 && ref.SerialNumber > col.TotalSupply {
		return nil, fmt.Errorf("serial number #%d exceeds total supply of %d for collection '%s'", ref.SerialNumber, col.TotalSupply, col.Name)
	}

	// 1. Fetch live GRAM/USD rate (CryptoPrice TON equivalent)
	gramUsdRate := 0.0
	if e.cryptoPriceSvc != nil {
		if rate, ok := e.cryptoPriceSvc.GetFloatPrice("the-open-network"); ok && rate > 0 {
			gramUsdRate = rate
		} else if rate, _, _, _, ok := e.cryptoPriceSvc.GetTONUSDT(ctx); ok && rate > 0 {
			gramUsdRate = rate
		}
	}

	// 2. Fetch FnG sentiment multiplier
	fngMult, _, _ := avm.GetFearAndGreedMultiplier()
	if fngMult < 0.85 || fngMult > 1.25 {
		fngMult = 1.0
	}

	// 3. Dominant Floor Architecture Hedonic Pricing Model
	baseFloor := e.resolveDynamicFloor(ctx, ref.ModelID, col, gramUsdRate)
	if liveNFT != nil && liveNFT.ValueInfo != nil && liveNFT.ValueInfo.FloorPrice > 0 {
		mtpFloor := liveNFT.ValueInfo.FloorPrice
		if strings.ToUpper(liveNFT.ValueInfo.Currency) == "USD" && gramUsdRate > 0 {
			mtpFloor = mtpFloor / gramUsdRate
		}
		if mtpFloor > 0 {
			baseFloor = mtpFloor
		}
	}

	// Axis 1: Model scarcity & floor (strictly verified on-chain model variants only)
	modelKey := col.Name
	modelPct := 2.0
	modelVerified := false
	if liveNFT != nil && liveNFT.Model != "" {
		modelKey = liveNFT.Model
		modelVerified = true
		if liveNFT.ModelRarityPct > 0 {
			modelPct = liveNFT.ModelRarityPct
		}
	}

	modelFloor := baseFloor
	betaModel := 0.0
	_, _, hasExplicitModelSkin, isPrestigeModelSkin := traits.InferModelColorProfile(col.ModelID, modelKey)
	if e.giftsRepo != nil && modelVerified && modelKey != "" && !strings.EqualFold(modelKey, col.Name) {
		if mf, ok := e.giftsRepo.GetModelFloor(ctx, ref.ModelID, modelKey); ok && mf.GreaterThan(decimal.Zero) {
			f, _ := mf.Float64()
			if f > modelFloor && f <= baseFloor*6.00 {
				modelFloor = f
			}
		}
	}
	if col.CraftedFlag {
		if baseFloor*1.25 > modelFloor {
			modelFloor = baseFloor * 1.25
		}
		betaModel = math.Log(modelFloor / baseFloor)
	} else if modelVerified && modelPct > 0 {
		// Human Collector Skin Scarcity & Visual Desirability Curve:
		// 0.1%-0.35% Mythic skins (e.g. Monument 0.3%, Gold Midas 0.2%) command 2.2x-3.4x floor;
		// 0.4%-0.75% Legendary skins (e.g. Titanium 0.5%) command 1.65x-2.20x floor;
		// 0.8%-1.4% Epic skins command 1.25x-1.60x floor;
		// 1.4%-2.2% Named prestige/chromatic skins command 1.08x-1.20x floor.
		skinMult := 1.00
		switch {
		case modelPct <= 0.35:
			skinMult = 2.15 + 0.42*math.Log(0.40/math.Max(modelPct, 0.08))
		case modelPct <= 0.75:
			skinMult = 1.60 + ((0.75-modelPct)/0.40)*0.55
		case modelPct <= 1.40:
			skinMult = 1.22 + ((1.40-modelPct)/0.65)*0.36
		case modelPct <= 2.20 && (isPrestigeModelSkin || hasExplicitModelSkin):
			skinMult = 1.08 + ((2.20-modelPct)/0.80)*0.10
		}
		if isPrestigeModelSkin && skinMult > 1.0 {
			skinMult *= 1.14 // Visual flex bonus for Gold, Blackout, Marble/Diamond/Titanium, Cyber/Neon skins
		}
		theoreticalModelFloor := baseFloor * skinMult
		if theoreticalModelFloor > modelFloor {
			modelFloor = theoreticalModelFloor
		}
		if modelFloor > baseFloor {
			betaModel = math.Log(modelFloor / baseFloor)
		}
	}

	// Axis 2: Backdrop exact permille & on-chain SVG hex color resolution
	backdropKey := "Midnight Blue"
	backdropCertainty := "measured"
	var backdropColors traits.BackdropColorSet
	var backdropPermille int

	// Check if traits exist in database to calculate model baseline averages
	dbTraits, _ := e.giftsRepo.GetGiftTraits(ctx, ref.ModelID)
	symbolKey := "Aero Crest"
	symbolPermille := 50
	symbolCertainty := "estimated"

	// Calculate average permille from model catalog traits as fallback baseline
	var sumBackdropPermille, countBackdrop int
	var sumSymbolPermille, countSymbol int
	var defaultBackdropName, defaultSymbolName string

	for _, tr := range dbTraits {
		if tr.TraitType == "backdrop" {
			sumBackdropPermille += tr.Permille
			countBackdrop++
			if defaultBackdropName == "" {
				defaultBackdropName = tr.TraitName
			}
		}
		if tr.TraitType == "symbol" {
			sumSymbolPermille += tr.Permille
			countSymbol++
			if defaultSymbolName == "" {
				defaultSymbolName = tr.TraitName
			}
		}
	}

	if liveNFT != nil && liveNFT.Backdrop != "" {
		backdropKey = liveNFT.Backdrop
		backdropCertainty = "exact"
		if liveNFT.BackdropRarity > 0 {
			backdropPermille = int(liveNFT.BackdropRarity * 10)
		}
		_, bPerm, bColors, exactCat := traits.ResolveBackdrop(backdropKey)
		if backdropPermille <= 0 {
			backdropPermille = bPerm
		}
		backdropColors = bColors
		// Override with pixel-exact live SVG radialGradient hex colors parsed directly from t.me/nft or MTProto!
		if liveNFT.BackdropCenter != "" {
			backdropColors.CenterHex = liveNFT.BackdropCenter
			if liveNFT.BackdropEdge != "" {
				backdropColors.EdgeHex = liveNFT.BackdropEdge
			} else {
				backdropColors.EdgeHex = liveNFT.BackdropCenter
			}
			if liveNFT.BackdropPattern != "" {
				backdropColors.PatternHex = liveNFT.BackdropPattern
			} else if !exactCat {
				backdropColors.PatternHex = liveNFT.BackdropEdge
			}
			if liveNFT.BackdropText != "" {
				backdropColors.TextHex = liveNFT.BackdropText
			}
		}
	} else {
		// No live NFT metadata: instance backdrop is NOT exact; mark as estimated baseline
		backdropCertainty = "estimated"
		if defaultBackdropName != "" {
			backdropKey = defaultBackdropName
		}
		if countBackdrop > 0 {
			backdropPermille = sumBackdropPermille / countBackdrop
		} else {
			_, bPerm, bColors, _ := traits.ResolveBackdrop(backdropKey)
			backdropPermille = bPerm
			backdropColors = bColors
		}
		_, _, bColors, _ := traits.ResolveBackdrop(backdropKey)
		backdropColors = bColors
	}

	if liveNFT != nil && liveNFT.Symbol != "" {
		symbolKey = liveNFT.Symbol
		symbolCertainty = "exact"
		if liveNFT.SymbolRarityPct > 0 {
			symbolPermille = int(liveNFT.SymbolRarityPct * 10)
		}
	} else {
		// No live NFT metadata: instance symbol is estimated
		symbolCertainty = "estimated"
		if defaultSymbolName != "" {
			symbolKey = defaultSymbolName
		}
		if countSymbol > 0 {
			symbolPermille = sumSymbolPermille / countSymbol
		} else {
			sName, sPerm, _, _ := traits.ResolveSymbol(symbolKey)
			symbolKey = sName
			symbolPermille = sPerm
		}
	}

	// Axis 6: Perceptual CIEDE2000 Chromatic Harmony, 10-Family Color-Match & Prestige Color Matrix
	aestheticHarmony := traits.EvaluateAestheticHarmonyWithModel(col.ModelID, modelKey, backdropKey, &backdropColors)
	betaColorPrestige := aestheticHarmony.BetaColorPrestige

	// Backdrop Floor evaluation (grounded in real Fragment/Portals/Tonnel collector demand):
	// Black / Onyx / Obsidian backdrops alone trade at 2.25x-2.85x collection floor;
	// Pure Gold, Ivory/White/Platinum, and Cyberpunk trade at 1.28x-1.45x;
	// Vibrant Sapphire/Neon/Crimson/Emerald/Sakura trade at 1.10x-1.18x.
	backdropFloor := baseFloor
	if e.giftsRepo != nil && backdropCertainty == "exact" {
		if bf, ok := e.giftsRepo.GetBackdropFloor(ctx, ref.ModelID, backdropKey); ok && bf.GreaterThan(decimal.Zero) {
			f, _ := bf.Float64()
			if f > backdropFloor && f <= baseFloor*5.00 {
				backdropFloor = f
			}
		}
	}
	if backdropCertainty == "exact" {
		switch {
		case aestheticHarmony.BackdropColorFamily == "BLACK":
			tierSMult := 2.25
			switch col.ModelID {
			case "swiss_watch", "plush_pepe", "durov_cap", "heart_locket", "resistance_dog", "scared_cat", "precious_peach", "loot_bag", "mini_oscar":
				tierSMult = 2.65
			}
			if baseFloor*tierSMult > backdropFloor {
				backdropFloor = baseFloor * tierSMult
			}
		case aestheticHarmony.BackdropColorFamily == "GOLD":
			if baseFloor*1.42 > backdropFloor {
				backdropFloor = baseFloor * 1.42
			}
		case aestheticHarmony.BackdropColorFamily == "WHITE":
			if baseFloor*1.32 > backdropFloor {
				backdropFloor = baseFloor * 1.32
			}
		case aestheticHarmony.PrestigeTier == traits.PrestigeTierS:
			if baseFloor*1.28 > backdropFloor {
				backdropFloor = baseFloor * 1.28
			}
		case aestheticHarmony.PrestigeTier == traits.PrestigeTierA ||
			aestheticHarmony.BackdropColorFamily == "PINK" ||
			aestheticHarmony.BackdropColorFamily == "RED" ||
			aestheticHarmony.BackdropColorFamily == "BLUE" ||
			aestheticHarmony.BackdropColorFamily == "PURPLE" ||
			aestheticHarmony.BackdropColorFamily == "GREEN":
			if baseFloor*1.12 > backdropFloor {
				backdropFloor = baseFloor * 1.12
			}
		}
	}

	// Dominant Floor Architecture: F_dominant = max(F_collection, F_model, F_backdrop)
	dominantFloor := math.Max(baseFloor, math.Max(modelFloor, backdropFloor))
	dominantFloorDriver := "collection_floor"
	if backdropFloor > baseFloor*1.01 && backdropFloor >= modelFloor {
		dominantFloorDriver = "backdrop_floor"
	} else if modelFloor > baseFloor*1.01 {
		dominantFloorDriver = "model_floor"
	}
	beta0 := math.Log(dominantFloor)

	betaBackdrop := 0.0
	if backdropFloor > baseFloor {
		betaBackdrop = math.Log(backdropFloor / baseFloor)
	}

	// Axis 3: Symbol Rarity & Thematic Lore Synergy (Telegram/TON/Bitcoin/Crown/Skull/Wreath storytelling)
	betaSymbol := 0.0
	symbolLoreTag := ""
	if symbolCertainty == "exact" {
		betaSymbol, symbolLoreTag = traits.EvaluateSymbolLoreSynergy(col.ModelID, modelKey, symbolKey, symbolPermille)
	}

	// Axis 4: Human Collector Serial Curve (Single-Digit, Sub-100, Repdigits, Ladders, Round Milestones, Early Mint)
	classifiedSerial := serials.ClassifySerialWithSupply(ref.SerialNumber, col.TotalSupply, baseFloor)
	betaSerial := computeSerialExponent(ref.SerialNumber, col.TotalSupply, classifiedSerial)

	// Axis 5: Keep Original Details
	betaOriginal := 0.0

	// 4-Regime Collector Psychology Detection:
	specialFeatures := make([]string, 0, 6)
	if betaSerial > 0 {
		specialFeatures = append(specialFeatures, fmt.Sprintf("SERIAL_%s (#%d)", classifiedSerial.Category, ref.SerialNumber))
	}
	if backdropCertainty == "exact" && modelVerified && aestheticHarmony.ColorSynergyMultiplier > 1.15 {
		specialFeatures = append(specialFeatures, fmt.Sprintf("COLOR_SYNERGY_%s (%.2fx)", aestheticHarmony.ColorMatchArchetype, aestheticHarmony.ColorSynergyMultiplier))
	}
	if modelFloor > baseFloor*1.18 {
		specialFeatures = append(specialFeatures, fmt.Sprintf("RARE_3D_SKIN (%s %.2f%%)", modelKey, modelPct))
	}
	if backdropFloor > baseFloor*1.20 {
		specialFeatures = append(specialFeatures, fmt.Sprintf("PRESTIGE_BACKDROP (%s)", backdropKey))
	}
	if modelFloor > baseFloor*1.08 && backdropFloor > baseFloor*1.08 {
		specialFeatures = append(specialFeatures, "DUAL_RARE_MODEL_AND_BACKDROP")
	}
	if symbolLoreTag != "" && betaSymbol >= 0.10 {
		specialFeatures = append(specialFeatures, symbolLoreTag)
	}
	hasSpecialFeature := len(specialFeatures) > 0

	floorLockRegime := "COLLECTION_FLOOR_LOCKED"
	if hasSpecialFeature {
		floorLockRegime = "SPECIAL_COLLECTOR_GRAIL"
	} else if dominantFloorDriver == "backdrop_floor" {
		floorLockRegime = "BACKDROP_FLOOR_LOCKED"
	} else if dominantFloorDriver == "model_floor" {
		floorLockRegime = "MODEL_FLOOR_LOCKED"
	}

	// Axis 7: Multi-Dimensional Joint Statistical Rarity & Surprisal
	jointRarity := traits.ComputeJointRarity(col.TotalSupply, ref.SerialNumber, backdropPermille, symbolPermille, col.CraftedFlag)

	// Multiplicative Trait Compounding & Color-Match Synergy Over Dominant Floor:
	// Previously max(modelFloor, backdropFloor) discarded the smaller rare trait completely!
	// Now when BOTH model AND backdrop carry independent collector value, we compound 75% of the secondary log-lift,
	// AND multiply by the human Color-Match / Contrast synergy (e.g. Black-on-Black, Monument+Ivory White, Sky High+Neon Blue, Titanium+Black).
	synergyBonus := 0.0
	if hasSpecialFeature {
		smallerTraitFloor := math.Min(modelFloor, backdropFloor)
		if smallerTraitFloor > baseFloor*1.04 {
			secondaryLogLift := math.Log(smallerTraitFloor / baseFloor)
			synergyBonus += secondaryLogLift * 0.78
		}
		if backdropCertainty == "exact" && modelVerified && aestheticHarmony.ColorSynergyMultiplier > 1.02 {
			synergyBonus += math.Log(aestheticHarmony.ColorSynergyMultiplier)
		} else if backdropCertainty == "exact" && aestheticHarmony.ThemeMatchRating == "PERFECT_MATCH" {
			synergyBonus += 0.10
		}
		if jointRarity.BetaSynergy > 0 && (betaSerial > 0.15 || (backdropCertainty == "exact" && modelVerified && modelPct <= 1.0)) {
			synergyBonus += math.Min(0.25, jointRarity.BetaSynergy*0.30)
		}
	}

	// Axis 8: In-App Telegram Stars Floor Parity with dynamic base stars price
	baseStarsPrice := 1000
	if col.BaseStarsPrice > 0 {
		baseStarsPrice = col.BaseStarsPrice
	} else if col.TotalSupply <= 2000 {
		baseStarsPrice = 5000
	} else if col.TotalSupply <= 5000 {
		baseStarsPrice = 2500
	}
	starsParity := starsrate.CalculateStarsParity(baseStarsPrice, gramUsdRate, baseFloor)

	// Trait premium sum across all attribute axes over Dominant Floor
	// Live dominantFloor already incorporates macro market sentiment; fngMult only modulates speculative trait/serial alpha
	traitPremiums := 0.0
	hedonicLogP := beta0 + betaSymbol
	if hasSpecialFeature {
		traitPremiums = (betaSerial + synergyBonus + betaSymbol) * (0.92 + 0.08*fngMult)
		hedonicLogP = beta0 + traitPremiums
	}

	// Laya AI System One Pre-Evaluation with full CIEDE2000 & Floor-Lock telemetry
	var layaRes *LayaGiftResult
	if defaultLayaGiftEvaluator != nil {
		layaRes = defaultLayaGiftEvaluator.EvaluateGiftWithTelemetry(ctx, GiftTelemetryInput{
			CollectionID:        col.ModelID,
			ModelVariant:        modelKey,
			ModelRarityPct:      modelPct,
			Backdrop:            backdropKey,
			BackdropPermille:    backdropPermille,
			Symbol:              symbolKey,
			SymbolPermille:      symbolPermille,
			Serial:              ref.SerialNumber,
			TotalSupply:         col.TotalSupply,
			SerialCategory:      string(classifiedSerial.Category),
			DeltaE2000:          aestheticHarmony.DeltaE2000ModelBackdrop,
			IsColorMatched:      aestheticHarmony.IsMonochromeColorMatch && backdropCertainty == "exact" && modelVerified,
			DominantFloorDriver: dominantFloorDriver,
			FloorLockRegime:     floorLockRegime,
			HasSpecialFeature:   hasSpecialFeature,
			HasTelemetry:        true,
			IsCrafted:           col.CraftedFlag,
		})
	}

	// 4. Fetch Real Comparable Sales from Database and blend with Bayesian Shrinkage (strictly respecting Floor-Lock & Serial Tier)
	comps, finalLogP, mad, priceBasis := e.resolveComps(ctx, ref, backdropKey, backdropCertainty, gramUsdRate, hedonicLogP, dominantFloor, hasSpecialFeature)

	rawEstimateGRAM := math.Exp(finalLogP)

	// Apply Laya AI Visual Synergy Multiplier ONLY when item is in SPECIAL_COLLECTOR_GRAIL regime
	layaMult := 1.0
	layaScore := 7
	layaAppeal := "floor_sweeper"
	if layaRes != nil {
		layaScore = layaRes.TraitSynergyScore
		layaAppeal = layaRes.CollectorAppeal
		if hasSpecialFeature && layaRes.SynergyMultiplier > 0 {
			layaMult = 1.0 + (layaRes.SynergyMultiplier-1.0)*0.70
			rawEstimateGRAM = rawEstimateGRAM * layaMult
		}
	}

	// Fetch exact last realized sale for this gift (model + serial)
	var lastSaleRecord *repository.GiftSaleRecord
	if e.giftsRepo != nil {
		if s, err := e.giftsRepo.GetLastSaleForGift(ctx, ref.ModelID, ref.SerialNumber); err == nil && s != nil {
			lastSaleRecord = s
		}
	}

	// Strict Floor & Realized Last-Sale Invariant with Down-Market Responsiveness (AC-P1-002)
	effectiveFloor := dominantFloor
	isLastSaleAnchored := false
	lastSalePriceGRAM := 0.0
	var lastSaleDate time.Time
	var lastSaleVenue string

	cohortCompsMean := 0.0
	if len(comps) > 0 {
		totalCompPrice := 0.0
		for _, c := range comps {
			totalCompPrice += c.SalePriceGRAM
		}
		cohortCompsMean = totalCompPrice / float64(len(comps))
	}

	// Also fix appreciation on single-item lastSaleRecord (line 740): do not artificially compound 15%/yr!
	if lastSaleRecord != nil {
		p, _ := lastSaleRecord.SalePriceGRAM.Float64()
		if p > 0 {
			lastSalePriceGRAM = p
			lastSaleDate = lastSaleRecord.SaleDate
			lastSaleVenue = lastSaleRecord.Venue

			elapsedDays := time.Since(lastSaleDate).Hours() / 24.0
			// Recent sales (<= 30 days) anchor strongly; older sales blend toward today's live dominantFloor
			if elapsedDays <= 30.0 {
				if cohortCompsMean > 0 && cohortCompsMean < lastSalePriceGRAM {
					effectiveFloor = math.Max(dominantFloor, (lastSalePriceGRAM+cohortCompsMean)*0.5)
				} else if lastSalePriceGRAM > effectiveFloor && lastSalePriceGRAM <= dominantFloor*3.0 {
					effectiveFloor = lastSalePriceGRAM
				}
				isLastSaleAnchored = true
			} else if hasSpecialFeature && lastSalePriceGRAM > dominantFloor {
				decayW := math.Exp(-0.006 * (elapsedDays - 30.0))
				blended := lastSalePriceGRAM*decayW + dominantFloor*(1.0-decayW)
				if blended > effectiveFloor {
					effectiveFloor = blended
					isLastSaleAnchored = true
				}
			}
		}
	} else if liveNFT != nil && liveNFT.ValueInfo != nil && liveNFT.ValueInfo.LastSalePrice > 0 {
		// Native Telegram MTProto Realized Sale fallback
		p := liveNFT.ValueInfo.LastSalePrice
		if strings.ToUpper(liveNFT.ValueInfo.Currency) == "USD" && gramUsdRate > 0 {
			p = p / gramUsdRate
		}
		if p > 0 {
			lastSalePriceGRAM = p
			if liveNFT.ValueInfo.LastSaleDate > 0 {
				lastSaleDate = time.Unix(int64(liveNFT.ValueInfo.LastSaleDate), 0)
			} else {
				lastSaleDate = time.Now().Add(-24 * time.Hour)
			}
			lastSaleVenue = "Telegram MTProto"
			if liveNFT.ValueInfo.LastSaleOnFragment {
				lastSaleVenue = "Fragment"
			}
			if cohortCompsMean > 0 && cohortCompsMean < lastSalePriceGRAM {
				effectiveFloor = math.Max(baseFloor, cohortCompsMean)
			} else if lastSalePriceGRAM > effectiveFloor {
				effectiveFloor = lastSalePriceGRAM
			}
			isLastSaleAnchored = true
		}
	}

	if rawEstimateGRAM < effectiveFloor-1e-6 {
		rawEstimateGRAM = effectiveFloor
		if isLastSaleAnchored {
			priceBasis = "direct_last_sale_anchored"
		} else {
			priceBasis = "market_floor_guaranteed"
		}
	}

	expectedGRAM := roundPrice(rawEstimateGRAM)

	// Dynamic adaptive uncertainty bounds using MAD and Bayesian scale
	lowBound, highBound := core.ComputeUncertaintyBounds(expectedGRAM, mad, 1.20, 0.12, 0.38)

	// Invariant: lowBound must never collapse below the baseline floor.
	// In down-market conditions, lowBound may decrease below last sale (AC-P1-002: no hard clamp).
	if isLastSaleAnchored && (cohortCompsMean == 0 || cohortCompsMean >= lastSalePriceGRAM) && lowBound < lastSalePriceGRAM*0.95 {
		lowBound = lastSalePriceGRAM * 0.95
	}
	if lowBound < baseFloor {
		lowBound = baseFloor
	}

	lowGRAM := roundPrice(lowBound)
	highGRAM := roundPrice(highBound)

	// Ensure invariant: Low <= Expected <= High
	if lowGRAM > expectedGRAM {
		lowGRAM = expectedGRAM
	}
	if highGRAM < expectedGRAM {
		highGRAM = expectedGRAM
	}

	lowUSD := roundPrice(lowGRAM * gramUsdRate)
	expectedUSD := roundPrice(expectedGRAM * gramUsdRate)
	highUSD := roundPrice(highGRAM * gramUsdRate)

	// 5. Confidence Score grounded in market evidence (no arbitrary 74 starting score)
	confidence := int16(30) // Base exploratory confidence
	if isKnownCol {
		confidence += 20
	}
	if liveNFT != nil && (liveNFT.Backdrop != "" || liveNFT.Symbol != "") {
		confidence += 20
	} else if len(dbTraits) > 0 {
		confidence += 10
	}
	if len(comps) > 0 {
		confidence += int16(math.Min(25, float64(len(comps)*5)))
	}
	if confidence > 95 {
		confidence = 95
	}
	calibratedConfidence, _ := core.GetCalibratedConfidenceScore(confidence, len(comps), ModelVersion)

	// 6. Trait DNA with Certainty Badges
	traitDNA := buildTraitDNAWithCertainty(col, ref.SerialNumber, modelKey, modelPct, backdropKey, backdropPermille, backdropColors, symbolKey, symbolPermille, backdropCertainty, symbolCertainty)

	// 7. Multi-Market Exit Planner (7 venues ranked by net payout)
	exitPlanner := venues.ComputeExitPlan(ctx, expectedGRAM, gramUsdRate, 80)

	// 8. Crafting EV & Monte Carlo Stochastic Forge Simulation
	var craftingEV *crafting.CraftingEVResult
	var monteCarloCrafting *crafting.MonteCarloForgeResult
	if col.CraftedFlag {
		craftInputs := []crafting.CraftInputItem{
			{
				GiftID:              ref.GiftID,
				ModelID:             ref.ModelID,
				Name:                fmt.Sprintf("%s #%d", col.Name, ref.SerialNumber),
				SerialNumber:        ref.SerialNumber,
				EstimatedValueGRAM:  expectedGRAM,
				CraftChancePermille: 350,
			},
		}
		craftingEV, _ = crafting.CalculateCraftingEV(ctx, craftInputs, gramUsdRate, 42)
		mcRes := crafting.RunMonteCarloCraftingSimulation(expectedGRAM, baseFloor, 350)
		monteCarloCrafting = &mcRes
	}

	// 9. Profile Showcase Flex Score
	profileFlex := ComputeProfileFlex(col, ref.SerialNumber, aestheticHarmony, jointRarity)

	// 10. Upgrade Timing Advisor (if un-upgraded / active stair)
	var upgradeAdvisor *upgrade.UpgradeAdviceReport
	if !col.CraftedFlag {
		upgradeAdvisor = upgrade.GenerateUpgradeAdvice(ctx, ref.GiftID, ref.ModelID, 5000, gramUsdRate)
	}

	// 11. Risk Audit
	riskAudit := risk.AuditGiftRisk(ctx, ref.ModelID, ref.SerialNumber, 80, nil, nil)

	// 12. Dynamic 12-Month Projection (Driven by supply scarcity, crafted status, joint rarity, and market sentiment)
	scarcityBoost := 0.0
	if col.TotalSupply > 0 && col.TotalSupply <= 5000 {
		scarcityBoost = 0.12
	} else if col.TotalSupply > 0 && col.TotalSupply <= 25000 {
		scarcityBoost = 0.06
	}
	if col.CraftedFlag {
		scarcityBoost += 0.10
	}
	if jointRarity.BetaSynergy > 0.25 {
		scarcityBoost += 0.08
	}
	bullMult := math.Min(1.95, (1.32+scarcityBoost)*fngMult)
	baseMult := math.Min(1.45, (1.12+(scarcityBoost*0.5))*fngMult)
	bearMult := math.Max(0.72, 0.86+(scarcityBoost*0.25))
	projection := GrowthProjection{
		BullGRAM: roundPrice(expectedGRAM * bullMult),
		BullUSD:  roundPrice(expectedGRAM * bullMult * gramUsdRate),
		BaseGRAM: roundPrice(expectedGRAM * baseMult),
		BaseUSD:  roundPrice(expectedGRAM * baseMult * gramUsdRate),
		BearGRAM: roundPrice(expectedGRAM * bearMult),
		BearUSD:  roundPrice(expectedGRAM * bearMult * gramUsdRate),
	}

	// 13. Recommendation (Laya System One Enhanced)
	recommendation := buildGiftRecommendation(ctx, col.Name, backdropKey, symbolKey, ref.SerialNumber, expectedGRAM, exitPlanner, craftingEV, layaRes)

	// 14. Deterministic Certificate Hash ID
	certPayload := fmt.Sprintf("%s:%s:%.2f:%.2f:%.2f", ref.GiftID, ModelVersion, expectedGRAM, lowGRAM, highGRAM)
	certHash := sha256.Sum256([]byte(certPayload))
	certificateID := "IFRG-GFT-" + hex.EncodeToString(certHash[:])[:12]

	// 15. Compute Binary & MTProto TL-Schema + TON TEP-62/TEP-64 + CIEDE2000 Forensics
	binaryForensics := ComputeGiftBinaryForensics(
		col.ModelID,
		ref.SerialNumber,
		modelKey,
		modelPct,
		backdropKey,
		backdropColors.CenterHex,
		backdropColors.EdgeHex,
		backdropPermille,
		symbolKey,
		symbolPermille,
		aestheticHarmony,
	)

	compoundMult := 1.00
	if dominantFloor > 0 {
		compoundMult = roundPrice(expectedGRAM / dominantFloor)
		if compoundMult < 1.00 {
			compoundMult = 1.00
		}
	}
	floorMatrix := &GiftFloorMatrixDto{
		CollectionFloorGRAM:     roundPrice(baseFloor),
		ModelFloorGRAM:          roundPrice(modelFloor),
		BackdropFloorGRAM:       roundPrice(backdropFloor),
		DominantFloorGRAM:       roundPrice(dominantFloor),
		DominantFloorDriver:     dominantFloorDriver,
		FloorLockRegime:         floorLockRegime,
		IsFloorLocked:           !hasSpecialFeature,
		HasSpecialFeature:       hasSpecialFeature,
		SpecialFeaturesDetected: specialFeatures,
		CompoundMultiplier:      compoundMult,
	}

	compSummaries := make([]map[string]interface{}, 0, len(comps))
	for _, c := range comps {
		compSummaries = append(compSummaries, map[string]interface{}{
			"gift_id":         c.GiftID,
			"serial":          c.SerialNumber,
			"venue":           c.Venue,
			"sale_price_gram": c.SalePriceGRAM,
			"sale_date":       c.SaleDate,
		})
	}

	configSnapshot := map[string]interface{}{
		"base_floor_gram":         baseFloor,
		"model_floor_gram":        modelFloor,
		"backdrop_floor_gram":     backdropFloor,
		"dominant_floor_gram":     dominantFloor,
		"dominant_floor_driver":   dominantFloorDriver,
		"floor_lock_regime":       floorLockRegime,
		"has_special_feature":     hasSpecialFeature,
		"effective_floor_gram":    effectiveFloor,
		"last_sale_price_gram":    lastSalePriceGRAM,
		"is_last_sale_anchored":   isLastSaleAnchored,
		"model_supply":            col.TotalSupply,
		"beta_serial":             betaSerial,
		"beta_backdrop":           betaBackdrop,
		"beta_color_prestige":     betaColorPrestige,
		"color_prestige_tier":     aestheticHarmony.PrestigeTier,
		"ciede2000_model_backdrop": aestheticHarmony.DeltaE2000ModelBackdrop,
		"is_monochrome_match":     aestheticHarmony.IsMonochromeColorMatch,
		"serial_category":         string(classifiedSerial.Category),
		"serial_label":            classifiedSerial.Label,
		"serial_multiplier":       classifiedSerial.Multiplier,
		"beta_symbol":             betaSymbol,
		"beta_aesthetic":          aestheticHarmony.BetaAesthetic,
		"beta_synergy":            jointRarity.BetaSynergy,
		"backdrop_permille":       backdropPermille,
		"symbol_permille":         symbolPermille,
		"laya_synergy_multiplier": layaMult,
		"laya_synergy_score":      layaScore,
		"laya_collector_appeal":   layaAppeal,
	}

	reasoningLog := map[string]interface{}{
		"model_version":            ModelVersion,
		"beta0_floor":              beta0,
		"base_floor_gram":          baseFloor,
		"model_floor_gram":         modelFloor,
		"backdrop_floor_gram":      backdropFloor,
		"dominant_floor_gram":      dominantFloor,
		"dominant_floor_driver":    dominantFloorDriver,
		"floor_lock_regime":        floorLockRegime,
		"has_special_feature":      hasSpecialFeature,
		"special_features":         specialFeatures,
		"beta_model":               betaModel,
		"beta_backdrop":            betaBackdrop,
		"beta_color_prestige":      betaColorPrestige,
		"color_prestige_tier":      aestheticHarmony.PrestigeTier,
		"ciede2000_model_backdrop": aestheticHarmony.DeltaE2000ModelBackdrop,
		"is_monochrome_match":      aestheticHarmony.IsMonochromeColorMatch,
		"mtproto_constructor":      binaryForensics.MTProtoConstructor,
		"tep62_item_index_sha256":  binaryForensics.TEP62ItemIndexSHA256,
		"serial_category":          string(classifiedSerial.Category),
		"serial_label":             classifiedSerial.Label,
		"serial_multiplier":        classifiedSerial.Multiplier,
		"beta_symbol":              betaSymbol,
		"beta_serial":              betaSerial,
		"beta_original":            betaOriginal,
		"beta_aesthetic":           aestheticHarmony.BetaAesthetic,
		"beta_synergy":             jointRarity.BetaSynergy,
		"fng_multiplier":           fngMult,
		"bayesian_k":               ShrinkageK,
		"price_basis":              priceBasis,
		"effective_floor_gram":     effectiveFloor,
		"last_sale_price_gram":     lastSalePriceGRAM,
		"is_last_sale_anchored":    isLastSaleAnchored,
		"last_sale_date":           lastSaleDate,
		"last_sale_venue":          lastSaleVenue,
		"laya_synergy_multiplier":  layaMult,
		"laya_synergy_score":       layaScore,
		"laya_collector_appeal":    layaAppeal,
		"narrative_only":           true, // Sacred Rule 11
		"signals_count":            42,
		"comparables":              compSummaries,
		"recommendation_verdict":   recommendation.Verdict,
		"recommendation_summary":   recommendation.SummaryEn,
	}

	selectedModel := modelKey
	ownerName := ""
	imageURL := ""
	if liveNFT != nil {
		ownerName = liveNFT.OwnerName
		imageURL = liveNFT.ImageURL
	}
	if imageURL == "" {
		slugParam := strings.ReplaceAll(col.ModelID, "_", "-")
		modelParam := selectedModel
		if modelParam == "" {
			modelParam = "1"
		}
		imageURL = fmt.Sprintf("https://api.changes.tg/model/%s/%s.png?size=256", slugParam, modelParam)
	}

	// 16. Valuation Pillars (Fair Value, Liquidation Value, Suggested Ask, Observed Floor)
	observedFloorGRAM := roundPrice(baseFloor)
	observedFloorUSD := roundPrice(baseFloor * gramUsdRate)

	fairValueGRAM := expectedGRAM
	fairValueUSD := expectedUSD

	// Liquidation Value: Haircut based on supply liquidity and floor baseline
	liqFactor := 0.82
	if col.TotalSupply > 0 && col.TotalSupply <= 2500 {
		liqFactor = 0.86 // Low supply grails retain liquidation value
	}
	liquidationGRAM := roundPrice(fairValueGRAM * liqFactor)
	if liquidationGRAM < observedFloorGRAM*0.85 {
		liquidationGRAM = roundPrice(observedFloorGRAM * 0.85)
	}
	liquidationUSD := roundPrice(liquidationGRAM * gramUsdRate)

	// Suggested Ask: List price optimizing yield and negotiation room
	askFactor := 1.15
	if jointRarity.RarityClass == "TRIPLE_GOD_TIER" || jointRarity.RarityClass == "DOUBLE_GOD_TIER" {
		askFactor = 1.25
	} else if jointRarity.RarityClass == "LEGENDARY_GRAIL" {
		askFactor = 1.20
	}
	suggestedAskGRAM := roundPrice(math.Max(fairValueGRAM*askFactor, highGRAM))
	suggestedAskUSD := roundPrice(suggestedAskGRAM * gramUsdRate)

	pillars := ValuationPillars{
		FairValueGRAM:        fairValueGRAM,
		FairValueUSD:         fairValueUSD,
		LiquidationValueGRAM: liquidationGRAM,
		LiquidationValueUSD:  liquidationUSD,
		SuggestedAskGRAM:     suggestedAskGRAM,
		SuggestedAskUSD:      suggestedAskUSD,
		ObservedFloorGRAM:    observedFloorGRAM,
		ObservedFloorUSD:     observedFloorUSD,
	}

	valuation := &GiftValuation{
		RunID:              time.Now().UnixNano(),
		GiftID:             ref.GiftID,
		ModelID:            ref.ModelID,
		ModelName:          col.Name,
		SerialNumber:       ref.SerialNumber,
		SelectedModel:      selectedModel,
		OwnerName:          ownerName,
		ImageURL:           imageURL,
		DisplayTitle:       fmt.Sprintf("%s #%d", col.Name, ref.SerialNumber),
		ModelVersion:       ModelVersion,
		BasePriceGRAM:      decimal.NewFromFloat(expectedGRAM),
		LowGRAM:            decimal.NewFromFloat(lowGRAM),
		ExpectedGRAM:       decimal.NewFromFloat(expectedGRAM),
		HighGRAM:           decimal.NewFromFloat(highGRAM),
		LowUSD:             lowUSD,
		ExpectedUSD:        expectedUSD,
		HighUSD:            highUSD,
		GRAMUSDRate:        gramUsdRate,
		ConfidenceScore:    calibratedConfidence,
		PriceBasis:         priceBasis,
		Pillars:            pillars,
		TraitDNA:           traitDNA,
		AestheticHarmony:   aestheticHarmony,
		JointRarity:        jointRarity,
		StarsParity:        starsParity,
		ProfileFlex:        profileFlex,
		ExitPlanner:        exitPlanner,
		CraftingEV:         craftingEV,
		MonteCarloCrafting: monteCarloCrafting,
		UpgradeAdvisor:     upgradeAdvisor,
		Comps:              comps,
		RiskAudit:          riskAudit,
		Projection:         projection,
		Recommendation:     recommendation,
		PreMintState: func() *PreMintExpectationDto {
			revealed := liveNFT != nil && (liveNFT.Backdrop != "" || liveNFT.Symbol != "")
			stateStr := "pre_upgrade_expected_value"
			if revealed {
				stateStr = "on_chain_verified"
			}
			grailProb := 1.5
			if countBackdrop > 0 {
				grailProb = math.Round((2.0/float64(countBackdrop))*1000) / 10
			}
			return &PreMintExpectationDto{
				IsUpgradedOnChain:      revealed,
				TraitsRevealed:         revealed,
				TraitResolutionState:   stateStr,
				ExpectedTraitValueGRAM: expectedGRAM,
				GrailHitProbabilityPct: grailProb,
				ExpectedBackdropPerm:   backdropPermille,
				ExpectedSymbolPerm:     symbolPermille,
			}
		}(),
		ColorMatchIntel: func() *ColorMatchAnalysisDto {
			isMatch := aestheticHarmony.IsMonochromeColorMatch || aestheticHarmony.ThemeMatchRating == "PERFECT_MATCH" || aestheticHarmony.ThemeMatchRating == "STRONG_HARMONY" || aestheticHarmony.BetaAesthetic >= 0.15
			matchTier := "Standard Palette"
			if (aestheticHarmony.IsMonochromeColorMatch && aestheticHarmony.DeltaE2000ModelBackdrop <= 10.0) || aestheticHarmony.ThemeMatchRating == "PERFECT_MATCH" || aestheticHarmony.BetaAesthetic >= 0.22 {
				matchTier = "Full Monochrome Grail"
			} else if isMatch {
				matchTier = "Chromatic Twin"
			} else if aestheticHarmony.BetaColorPrestige > 0.08 {
				matchTier = "Complementary Contrast"
			}
			premPct := math.Round((math.Exp(aestheticHarmony.BetaAesthetic+aestheticHarmony.BetaColorPrestige)-1.0)*1000) / 10
			deltaE := aestheticHarmony.DeltaE2000ModelBackdrop
			if deltaE <= 0 {
				deltaE = aestheticHarmony.DeltaEScore
			}
			return &ColorMatchAnalysisDto{
				IsColorMatched:      isMatch,
				MatchTier:           matchTier,
				HarmonyClass:        aestheticHarmony.HarmonyClass,
				DeltaEScore:         deltaE,
				CollectorPremiumPct: premPct,
				DominantPaletteHex:  backdropColors.CenterHex,
			}
		}(),
		FloorMatrix:     floorMatrix,
		BinaryForensics: binaryForensics,
		LayaSystemOne:   layaRes,
		CertificateID:   certificateID,
		EvaluatedAt:     time.Now().UTC(),
		ReasoningLog:    reasoningLog,
	}

	// Mandatory Audit Write (Sacred Rule 5)
	if e.giftsRepo != nil {
		id, err := e.giftsRepo.SaveValuationAudit(ctx, ref.GiftID, ref.ModelID, ref.SerialNumber, ModelVersion, configSnapshot, gramUsdRate, baseFloor, lowGRAM, expectedGRAM, highGRAM, calibratedConfidence, priceBasis, reasoningLog)
		if err != nil {
			slog.Error("CRITICAL: Mandatory Gift Valuation Audit Write failed", "gift_id", ref.GiftID, "error", err)
			return nil, fmt.Errorf("mandatory audit write failed: %w", err)
		}
		valuation.RunID = id
	}

	return valuation, nil
}

func computeSerialExponent(serial, supply int, classified serials.ClassificationResult) float64 {
	if serial <= 0 {
		serial = 1
	}
	if supply <= 0 {
		supply = 10000
	}

	// 1. Human Collector Early-Mint & Badge Length Curve:
	// Humans strongly prize 1-digit (#1-#9), 2-digit (#10-#99), and early 3-digit (#100-#250) badges on Telegram profiles,
	// with larger collections commanding a steeper trophy multiplier for #1 and single digits.
	supplyScale := 1.0
	if supply >= 25000 {
		supplyScale = 1.18
	} else if supply >= 10000 {
		supplyScale = 1.10
	}

	var betaAbs float64
	switch {
	case serial == 1:
		betaAbs = 2.65 * supplyScale // #1 Genesis Sovereign Trophy (~14x to 22x floor)
	case serial == 2 || serial == 3:
		betaAbs = (1.85 - float64(serial-2)*0.15) * supplyScale // Podium #2-#3 (~5.5x to 7.5x)
	case serial <= 9:
		betaAbs = (1.42 - (float64(serial-4)/5.0)*0.22) * supplyScale // Single digit #4-#9 (~3.3x to 4.8x)
		if serial == 7 || serial == 8 {
			betaAbs += 0.18 // Lucky #7 & Prosperity #8 single-digit boost
		}
	case serial <= 25:
		t := float64(serial-10) / 15.0
		betaAbs = 1.02 - t*0.28 // #10-#25 (~2.1x to 2.8x)
	case serial <= 99:
		t := float64(serial-26) / 73.0
		betaAbs = 0.65 - t*0.28 // All 2-digit sub-100 badges (#26-#99: ~1.45x to 1.92x)
		if serial%10 == 0 {
			betaAbs += 0.14 // Clean two-digit tens (#20, #30..#90)
		}
		if serial == 69 {
			betaAbs += 0.25
		}
	case serial <= 250:
		t := float64(serial-100) / 150.0
		betaAbs = 0.24 - t*0.14 // Early Mint #100-#250 (~1.11x to 1.27x; stacks with repdigits/rounds like #100, #111, #200, #222!)
	case serial <= 999 && supply >= 5000:
		t := float64(serial-251) / 748.0
		betaAbs = 0.10 - t*0.06 // Clean 3-digit profile badge in large collections (~1.04x to 1.11x)
	default:
		betaAbs = 0.0
	}

	// 2. Numerical Genetics & Vanity Patterns (Stacks cleanly with Early Mint for e.g. #77, #88, #100, #111, #222!)
	switch classified.Category {
	case serials.CategoryOmegaMint:
		betaAbs += 0.58 // Exact Final Mint (#N of N, ~1.78x collector bookend)
	case serials.CategoryRepDigit:
		s := strconv.Itoa(serial)
		switch {
		case stringsContainsAllChars(s, '7'):
			betaAbs += 0.85 // Lucky 7s (#77, #777, #7777 -> ~2.35x+)
		case stringsContainsAllChars(s, '8'):
			betaAbs += 0.78 // Prosperity 8s (#88, #888, #8888 -> ~2.18x+)
		case stringsContainsAllChars(s, '9') || stringsContainsAllChars(s, '1') || stringsContainsAllChars(s, '6'):
			betaAbs += 0.58 // #111, #666, #999, #1111 (~1.78x+)
		default:
			betaAbs += 0.50 // #222, #333, #555, #2222 (~1.65x+, and #222 also gets EarlyMint -> ~2.05x!)
		}
	case serials.CategoryLadder:
		s := strconv.Itoa(serial)
		if len(s) >= 5 {
			betaAbs += 0.72 // #12345, #54321 (~2.05x)
		} else if len(s) == 4 {
			betaAbs += 0.56 // #1234, #4321, #6789 (~1.75x)
		} else {
			betaAbs += 0.36 // #123, #321, #789 (~1.43x)
		}
	case serials.CategoryDoublet:
		switch {
		case serial == 6969 || serial == 420 || serial == 1337 || serial == 520 || serial == 1314 || serial == 168:
			betaAbs += 0.52 // Apex meme / lucky milestones (~1.68x)
		default:
			betaAbs += 0.34 // ABAB / AABB (#1212, #2020, #1122, #7788, #8800 -> ~1.40x)
		}
	case serials.CategoryMilestoneYear:
		if serial == 2024 {
			betaAbs += 0.42 // Telegram Gifts Genesis Year
		} else if serial == 2000 || serial == 2025 || serial == 2026 {
			betaAbs += 0.28
		} else {
			betaAbs += 0.16
		}
	case serials.CategoryPalindrome:
		s := strconv.Itoa(serial)
		if len(s) >= 4 && (s[1] == '0' || s[0] == '7' || s[0] == '8') {
			betaAbs += 0.36 // Clean zero/lucky mirror (#1001, #7007, #8008, #7887)
		} else if len(s) >= 4 {
			betaAbs += 0.26 // #1221, #3443
		} else {
			betaAbs += 0.18 // #101, #707, #808
		}
	case serials.CategoryRoundNumber:
		switch {
		case serial == 100 || serial == 1000 || serial == 10000 || serial == 100000:
			betaAbs += 0.62 // Exact power-of-10 milestone (~1.86x+)
		case serial == 500 || serial == 5000 || serial == 50000:
			betaAbs += 0.48 // Half-power milestone (~1.62x)
		case serial < 1000 && serial%100 == 0:
			betaAbs += 0.38 // #200, #300..#900 (~1.46x+)
		case serial < 10000 && serial%1000 == 0:
			betaAbs += 0.40 // #2000, #3000..#9000 (~1.49x)
		case serial%10000 == 0:
			betaAbs += 0.36 // #20000, #30000..
		case serial%500 == 0:
			betaAbs += 0.22 // #1500, #2500.. (~1.25x)
		case serial%100 == 0:
			s := strconv.Itoa(serial)
			if len(s) == 4 && s[0] == s[1] && (s[0] == '7' || s[0] == '8') {
				betaAbs += 0.26 // #7700, #8800 lucky double-hundred (~1.30x)
			} else {
				betaAbs += 0.08 // Clean double-zero hundred (#1200, #2200 -> ~1.08x)
			}
		}
	}

	return math.Max(0.0, betaAbs)
}

func stringsContainsAllChars(s string, ch rune) bool {
	for _, r := range s {
		if r != ch {
			return false
		}
	}
	return true
}

func isRepdigit(n int) bool {
	if n < 11 {
		return false
	}
	s := strconv.Itoa(n)
	for i := 1; i < len(s); i++ {
		if s[i] != s[0] {
			return false
		}
	}
	return true
}

func (e *ValuationEngine) resolveComps(ctx context.Context, ref *ParsedGiftRef, backdrop, backdropCertainty string, gramUsdRate, hedonicLogP, dominantFloor float64, hasSpecialFeature bool) ([]ComparableGiftSale, float64, float64, string) {
	comps := []ComparableGiftSale{}
	finalLogP := hedonicLogP
	mad := 0.14 // calibrated MAD baseline

	if e.giftsRepo != nil {
		var sales []repository.GiftSaleRecord
		var err error
		priceBasis := "gift_market_trait_comps_bayesian_shrunk"

		// Tier 1: Seek Trait-Aware Comparable Sales ONLY when backdrop is verified on-chain
		traitMatchedComps := false
		if backdropCertainty == "exact" {
			sales, err = e.giftsRepo.GetTraitAwareCompsForGift(ctx, ref.ModelID, ref.SerialNumber, backdrop, 8)
			if err == nil && len(sales) > 0 {
				traitMatchedComps = true
			}
		}

		// Tier 2: Only use generic collection cohort comps when the gift is NOT a Special Collector Grail!
		// Shrinking a 0.3% Mythic Color-Matched or Blackout Grail toward ordinary floor sales destroys its collector premium.
		if !traitMatchedComps && !hasSpecialFeature {
			sales, err = e.giftsRepo.GetCompsForGift(ctx, ref.ModelID, ref.SerialNumber, 10)
			priceBasis = "gift_market_cohort_comps_bayesian_shrunk"
		}

		if err == nil && len(sales) > 0 {
			now := time.Now()
			hedonicEst := math.Exp(hedonicLogP)
			filteredSales := make([]repository.GiftSaleRecord, 0, len(sales))
			compsForMath := make([]core.ComparableSale, 0, len(sales))

			for _, s := range sales {
				pGram, _ := s.SalePriceGRAM.Float64()
				if pGram <= 0 || pGram == 16111.0 {
					continue
				}
				// Serial-tier isolation: never mix Genesis #1 or Single-Digit Grails with standard 3-digit+ serials
				if ref.SerialNumber == 1 && s.SerialNumber > 3 {
					continue
				}
				if ref.SerialNumber >= 2 && ref.SerialNumber <= 9 && s.SerialNumber > 15 {
					continue
				}
				if ref.SerialNumber >= 10 && ref.SerialNumber <= 99 && (s.SerialNumber < 5 || s.SerialNumber > 130) {
					continue
				}
				if ref.SerialNumber >= 100 && s.SerialNumber <= 25 {
					continue
				}
				// Exclude ancient cycle-peak sales (> 45 days old) that exceed 1.65x current hedonic/floor value
				daysAgo := now.Sub(s.SaleDate).Hours() / 24.0
				if daysAgo > 45 && pGram > hedonicEst*1.65 {
					continue
				}
				// For floor-locked standard items, exclude unlabelled rare-trait outlier sales (> 1.45x dominantFloor)
				if !hasSpecialFeature && dominantFloor > 0 && pGram > dominantFloor*1.45 {
					continue
				}

				filteredSales = append(filteredSales, s)
				compsForMath = append(compsForMath, core.ComparableSale{
					ID:          s.ID,
					PriceTON:    pGram,
					RawPriceTON: pGram,
					SaleDate:    s.SaleDate,
				})
				if len(filteredSales) >= 5 {
					break
				}
			}

			// Only blend comps into finalLogP when regime-consistent comps exist.
			// Floor-locked standard items NEVER break above 1.05x dominantFloor (Arbitrage / Law of One Price).
			if len(compsForMath) > 0 {
				compsForMath = core.WinsorizeComparables(compsForMath, 0.05, 0.95)
				decayWeights := core.CalcTimeDecayWeights(compsForMath, 0.015, now) // ~46-day half-life for fast-moving gift cycles
				nEff := core.CalcEffectiveSampleSize(decayWeights)

				if nEff > 0 {
					logPrices := make([]float64, len(compsForMath))
					for i, s := range compsForMath {
						logPrices[i] = math.Log(math.Max(s.PriceTON, 0.5))
					}
					exactMedianLog := core.WeightedMedian(logPrices, decayWeights)
					if hasSpecialFeature {
						finalLogP = core.BayesianShrinkage(exactMedianLog, hedonicLogP, nEff, ShrinkageK)
					} else {
						// Floor-locked regime: bound strictly within [dominantFloor, dominantFloor * 1.04]
						blended := core.BayesianShrinkage(exactMedianLog, hedonicLogP, nEff, ShrinkageK*1.5)
						maxFloorLockLog := math.Log(math.Max(dominantFloor*1.04, 0.5))
						minFloorLockLog := math.Log(math.Max(dominantFloor, 0.5))
						finalLogP = math.Max(minFloorLockLog, math.Min(maxFloorLockLog, blended))
						priceBasis = "market_floor_guaranteed"
					}
					mad = math.Max(0.08, math.Min(0.25, core.WeightedMAD(logPrices, decayWeights, exactMedianLog)))
				}

				tempEstGRAM := math.Exp(finalLogP)
				for i, s := range filteredSales {
					pGram := compsForMath[i].PriceTON
					pUsd := pGram * gramUsdRate

					diffPct := 0.0
					if tempEstGRAM > 0 {
						diffPct = roundPrice(((pGram - tempEstGRAM) / tempEstGRAM) * 100.0)
					}

					tonviewer := ""
					if s.TxHash != "" && !strings.HasPrefix(s.TxHash, "frag-") {
						tonviewer = "https://tonviewer.com/transaction/" + s.TxHash
					}

					comps = append(comps, ComparableGiftSale{
						GiftID:        s.GiftID,
						ModelID:       s.ModelID,
						SerialNumber:  s.SerialNumber,
						Venue:         s.Venue,
						SalePriceGRAM: roundPrice(pGram),
						SalePriceUSD:  roundPrice(pUsd),
						SaleDate:      s.SaleDate,
						BackdropName:  backdrop,
						DiffPercent:   diffPct,
						TonviewerURL:  tonviewer,
					})
				}
				return comps, finalLogP, mad, priceBasis
			}
		}
	}

	// Decision 1: When no regime-consistent comps exist, rely 100% on the calibrated Hedonic & Live Floor model.
	return comps, finalLogP, mad, "hedonic_pure_trait_basis"
}

func buildTraitDNAWithCertainty(col traits.CollectionMeta, serial int, modelName string, modelPct float64, backdropName string, backdropPermille int, colors traits.BackdropColorSet, symbolName string, symbolPermille int, backdropCert, symbolCert string) []TraitDNABar {
	serialPct, _, serialRankText := traits.CalculateSerialPercentile(serial, col.TotalSupply)
	bdRarity := traits.CalculateExactRarity("backdrop", backdropName, backdropPermille, &colors)
	symRarity := traits.CalculateExactRarity("symbol", symbolName, symbolPermille, nil)

	if modelPct <= 0 {
		modelPct = (float64(col.TotalSupply) / 1000000.0) * 100.0
		if modelPct < 0.1 {
			modelPct = 0.1
		}
	}

	modelTier := "Common"
	if modelPct <= 1.0 || col.TotalSupply <= 2000 {
		modelTier = "Legendary"
	} else if modelPct <= 5.0 || col.TotalSupply <= 5000 {
		modelTier = "Epic"
	} else if modelPct <= 15.0 || col.TotalSupply <= 15000 {
		modelTier = "Rare"
	} else if modelPct <= 35.0 || col.TotalSupply <= 50000 {
		modelTier = "Uncommon"
	}

	serialTier := "Common"
	if serialPct <= 1.0 {
		serialTier = "Legendary"
	} else if serialPct <= 5.0 {
		serialTier = "Epic"
	} else if serialPct <= 15.0 {
		serialTier = "Rare"
	} else if serialPct <= 35.0 {
		serialTier = "Uncommon"
	}

	displayName := col.Name
	if modelName != "" && modelName != col.Name {
		displayName = fmt.Sprintf("%s (%s)", col.Name, modelName)
	}

	return []TraitDNABar{
		{
			AxisKey:        "model",
			LabelEn:        "Model Core",
			LabelFa:        "مدل کالکشن",
			Value:          displayName,
			Percentile:     math.Round(modelPct*100.0) / 100.0,
			RarityTier:     modelTier,
			CertaintyLevel: "exact", // Official Collection Model is verified
			Description:    fmt.Sprintf("Official Telegram collection of %s total minted units", formatCount(col.TotalSupply)),
		},
		{
			AxisKey:        "backdrop",
			LabelEn:        "Backdrop Material",
			LabelFa:        "بک‌دراپ و رنگ‌بندی",
			Value:          backdropName,
			Percentile:     bdRarity.Percentile,
			RarityTier:     bdRarity.RarityTier,
			CertaintyLevel: backdropCert,
			Colors:         &colors,
			Description:    fmt.Sprintf("%d/1000 official permille scarcity on-chain", bdRarity.Permille),
		},
		{
			AxisKey:        "symbol",
			LabelEn:        "Emblem Symbol",
			LabelFa:        "نماد و نشان",
			Value:          symbolName,
			Percentile:     symRarity.Percentile,
			RarityTier:     symRarity.RarityTier,
			CertaintyLevel: symbolCert,
			Description:    fmt.Sprintf("%d/1000 permille scarcity emblem layer", symbolPermille),
		},
		{
			AxisKey:        "serial",
			LabelEn:        "Serial Number",
			LabelFa:        "شماره سریال",
			Value:          serialRankText,
			Percentile:     math.Round(serialPct*100.0) / 100.0,
			RarityTier:     serialTier,
			CertaintyLevel: "exact", // Serial number is exact on-chain
			Description:    fmt.Sprintf("Absolute rank #%d out of total supply of %s", serial, formatCount(col.TotalSupply)),
		},
	}
}

func buildTraitDNA(col traits.CollectionMeta, serial int, backdropName string, backdropPermille int, colors traits.BackdropColorSet, symbolPermille int) []TraitDNABar {
	return buildTraitDNAWithCertainty(col, serial, col.Name, 0, backdropName, backdropPermille, colors, "Aero Crest", symbolPermille, "exact", "exact")
}

var defaultLayaGiftEvaluator = NewLayaGiftEvaluator()

func buildGiftRecommendation(ctx context.Context, modelName, backdrop, symbol string, serial int, expectedGRAM float64, exitPlan *venues.ExitPlannerPlan, craftEV *crafting.CraftingEVResult, layaRes *LayaGiftResult) ValuationActionVerdict {
	verdict := "HOLD"
	conf := "Strong Scarcity Hold"
	sumEn := "Deflationary tokenomics and high trait rarity make holding optimal for medium-term yield."
	sumFa := "به دلیل کمیابی بالای صفات و عرضه محدود، نگهداری دارایی برای رشد ارزش میان‌مدت پیشنهاد می‌شود."

	if layaRes == nil && defaultLayaGiftEvaluator != nil {
		layaRes = defaultLayaGiftEvaluator.EvaluateGift(ctx, modelName, backdrop, symbol, serial)
	}

	if craftEV != nil && craftEV.Recommendation == "YES" {
		verdict = "CRAFT_FORGE"
		conf = "High Positive EV"
		sumEn = fmt.Sprintf("Crafting combination has strong positive expected value (+%.2f GRAM). Forge recommended.", craftEV.NetEVGRAM)
		sumFa = fmt.Sprintf("ترکیب کرفتینگ دارای ارزش انتظاری مثبت قوی (+%.2f گرام) است. اجرای کرفت پیشنهاد می‌شود.", craftEV.NetEVGRAM)
	} else if exitPlan != nil && exitPlan.ArbitrageSpread >= 8.0 {
		verdict = "SELL_NOW"
		conf = "Arbitrage Peak"
		sumEn = fmt.Sprintf("Sell on %s to capture %.1f%% cross-market arbitrage premium after all venue fees.", exitPlan.BestVenueName, exitPlan.ArbitrageSpread)
		sumFa = fmt.Sprintf("فروش در %s برای دریافت %.1f٪ پرمیوم خالص آربیتراژ پس از کسر کارمزد پیشنهاد می‌شود.", exitPlan.BestVenueName, exitPlan.ArbitrageSpread)
	} else if layaRes != nil && layaRes.ActionRecommendation != "" {
		verdict = layaRes.ActionRecommendation
		conf = "Laya AI Calibrated"
		sumEn = layaRes.VerdictSummaryEn
		sumFa = layaRes.VerdictSummaryFa
	}

	bestVenue := "fragment"
	if exitPlan != nil {
		bestVenue = string(exitPlan.BestVenueID)
	}

	net := expectedGRAM * 0.95
	if exitPlan != nil {
		net = exitPlan.MaxNetGRAM
	}

	return ValuationActionVerdict{
		Verdict:         verdict,
		ConfidenceTier:  conf,
		BestVenueID:     bestVenue,
		ExpectedNetGRAM: roundPrice(net),
		SummaryEn:       sumEn,
		SummaryFa:       sumFa,
	}
}

func formatCount(n int) string {
	in := fmt.Sprintf("%d", n)
	out := ""
	for i, c := range in {
		if i > 0 && (len(in)-i)%3 == 0 {
			out += ","
		}
		out += string(c)
	}
	return out
}

func roundPrice(v float64) float64 {
	return math.Round(v*100.0) / 100.0
}
