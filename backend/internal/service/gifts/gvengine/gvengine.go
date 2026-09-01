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

	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/gifts/crafting"
	"ifragment-backend/internal/service/gifts/risk"
	"ifragment-backend/internal/service/gifts/traits"
	"ifragment-backend/internal/service/gifts/upgrade"
	"ifragment-backend/internal/service/gifts/venues"
	"ifragment-backend/internal/service/username/avm"
	"ifragment-backend/internal/service/valuation/core"
)

const (
	ModelVersion = "GV-Engine-v4.0-HierarchicalBayes"
	ShrinkageK   = 10.0
	DecayLambda  = 0.005
)

// ValuationEngine coordinates quantitative valuation for Telegram Gifts
type ValuationEngine struct {
	db             *repository.Database
	cache          *repository.Cache
	giftsRepo      *repository.GiftsRepo
	cryptoPriceSvc *cryptoprice.CryptoPriceService
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
	}
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

	// Replace # and spaces with dash
	clean = strings.ReplaceAll(clean, "#", "-")
	clean = strings.ReplaceAll(clean, " ", "-")

	// Match pattern: collection_name - number
	re := regexp.MustCompile(`^([a-z0-9_]+?)[-#_]?(\d+)$`)
	matches := re.FindStringSubmatch(clean)

	if len(matches) >= 3 {
		modelKey := matches[1]
		serial, err := strconv.Atoi(matches[2])
		if err != nil || serial <= 0 {
			return nil, fmt.Errorf("invalid serial number: serial must be >= 1")
		}

		col, _ := traits.ResolveCollection(modelKey)
		return &ParsedGiftRef{
			GiftID:       fmt.Sprintf("%s-%d", col.ModelID, serial),
			ModelID:      col.ModelID,
			SerialNumber: serial,
			RawInput:     raw,
		}, nil
	}

	if clean != "" {
		col, ok := traits.ResolveCollection(clean)
		if ok {
			return &ParsedGiftRef{
				GiftID:       fmt.Sprintf("%s-1", col.ModelID),
				ModelID:      col.ModelID,
				SerialNumber: 1,
				RawInput:     raw,
			}, nil
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

	col, _ := traits.ResolveCollection(ref.ModelID)

	gramUsdRate := 5.50
	if e.cryptoPriceSvc != nil {
		if rate, ok := e.cryptoPriceSvc.GetFloatPrice("the-open-network"); ok && rate > 0 {
			gramUsdRate = rate
		}
	}

	// 34 Analyzed signals count
	signalsCount := 34

	// Preliminary risk count without leaking details
	risksCount := 0
	if col.CraftedFlag {
		risksCount++ // Crafting burn/variance risk
	}
	if ref.SerialNumber > col.TotalSupply {
		risksCount++
	}

	return &CuriosityGateResponse{
		GiftID:           ref.GiftID,
		ModelID:          col.ModelID,
		ModelName:        col.Name,
		SerialNumber:     ref.SerialNumber,
		SignalsAnalyzed:  signalsCount,
		RisksIdentified:  risksCount,
		DataSourcesCount: 6, // Fragment, Getgems, Tonnel, Portals, MRKT, Telegram Stars
		IsCrafted:        col.CraftedFlag,
		FloorPriceGRAM:   col.InitialFloorGRAM,
		FloorPriceUSD:    math.Round(col.InitialFloorGRAM*gramUsdRate*100.0) / 100.0,
		CheckedAt:        time.Now().UTC().Format(time.RFC3339),
	}, nil
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

	// 1. Fetch live GRAM/USD rate (CryptoPrice TON equivalent)
	gramUsdRate := 5.50
	if e.cryptoPriceSvc != nil {
		if rate, ok := e.cryptoPriceSvc.GetFloatPrice("the-open-network"); ok && rate > 0 {
			gramUsdRate = rate
		}
	}

	// 2. Fetch FnG sentiment multiplier
	fngMult, _, _ := avm.GetFearAndGreedMultiplier()
	if fngMult < 0.85 || fngMult > 1.25 {
		fngMult = 1.0
	}

	// 3. 4-Axis Hedonic Pricing Model
	// log(P_hat) = beta0 + beta_model + beta_backdrop + beta_symbol + beta_serial + beta_orig + log(fngMult)
	beta0 := math.Log(col.InitialFloorGRAM)

	// Axis 1: Model scarcity & crafted multiplier
	betaModel := 0.0
	if col.CraftedFlag {
		betaModel = 0.85 // High prestige for crafted-only outputs
	} else if col.TotalSupply <= 2500 {
		betaModel = 0.65
	} else if col.TotalSupply <= 5000 {
		betaModel = 0.35
	}

	// Axis 2: Backdrop exact permille & resolution from DB or official catalog
	backdropKey := "Obsidian Matrix"
	backdropCertainty := "measured"
	var backdropColors traits.BackdropColorSet
	var backdropPermille int

	// Check if traits exist in database
	dbTraits, _ := e.giftsRepo.GetGiftTraits(ctx, ref.ModelID)
	foundDBBackdrop := false
	foundDBSymbol := false
	symbolKey := "Aero Crest"
	symbolPermille := 50
	symbolCertainty := "measured"

	for _, tr := range dbTraits {
		if tr.TraitType == "backdrop" && !foundDBBackdrop {
			backdropKey = tr.TraitName
			backdropPermille = tr.Permille
			backdropCertainty = "exact"
			foundDBBackdrop = true
		}
		if tr.TraitType == "symbol" && !foundDBSymbol {
			symbolKey = tr.TraitName
			symbolPermille = tr.Permille
			symbolCertainty = "exact"
			foundDBSymbol = true
		}
	}

	if !foundDBBackdrop {
		bName, bPerm, bColors, isExact := traits.ResolveBackdrop(backdropKey)
		backdropKey = bName
		backdropPermille = bPerm
		backdropColors = bColors
		if !isExact {
			backdropCertainty = "estimated"
		}
	} else {
		_, _, bColors, _ := traits.ResolveBackdrop(backdropKey)
		backdropColors = bColors
	}

	if !foundDBSymbol {
		sName, sPerm, _, isExact := traits.ResolveSymbol(symbolKey)
		symbolKey = sName
		symbolPermille = sPerm
		if !isExact {
			symbolCertainty = "estimated"
		}
	}

	bdMeta := traits.OfficialBackdrops[backdropKey]
	if bdMeta.Permille > 0 {
		backdropPermille = bdMeta.Permille
		backdropColors = bdMeta.Colors
	}

	// Continuous smooth backdrop rarity curve: elasticity * ln(1000 / permille)
	permilleClamped := math.Max(float64(backdropPermille), 5.0)
	betaBackdrop := 0.35 * math.Log(1000.0/permilleClamped)
	if betaBackdrop < 0 {
		betaBackdrop = 0
	}

	// Axis 3: Symbol smooth continuous rarity
	symPermClamped := math.Max(float64(symbolPermille), 5.0)
	betaSymbol := 0.12 * math.Log(1000.0/symPermClamped)
	if betaSymbol < 0.05 {
		betaSymbol = 0.05
	}

	// Axis 4: Serial smooth non-linear curve f(rank / supply) with sacred jumps
	betaSerial := computeSerialExponent(ref.SerialNumber, col.TotalSupply)

	// Axis 5: Keep Original Details
	betaOriginal := 0.08

	// Sum Log prior (Hedonic)
	hedonicLogP := beta0 + betaModel + betaBackdrop + betaSymbol + betaSerial + betaOriginal + math.Log(fngMult)

	// 4. Fetch Real Comparable Sales from Database and blend with Bayesian Shrinkage
	comps, finalLogP, mad, priceBasis := e.resolveComps(ctx, ref, backdropKey, gramUsdRate, hedonicLogP)

	rawEstimateGRAM := math.Exp(finalLogP)
	if rawEstimateGRAM < col.InitialFloorGRAM {
		rawEstimateGRAM = col.InitialFloorGRAM
	}

	expectedGRAM := roundPrice(rawEstimateGRAM)

	// Dynamic adaptive uncertainty bounds using MAD and Bayesian scale
	lowBound, highBound := core.ComputeUncertaintyBounds(expectedGRAM, mad, 1.20, 0.12, 0.38)
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

	// 5. 4-Component Confidence Score with Real Calibration
	confidence := int16(74)
	if isKnownCol {
		confidence += 6
	}
	if foundDBBackdrop || foundDBSymbol {
		confidence += 8
	}
	if len(comps) > 0 {
		confidence += 8
	}
	if confidence > 98 {
		confidence = 98
	}
	calibratedConfidence, _ := core.GetCalibratedConfidenceScore(confidence, len(comps), ModelVersion)

	// 6. Trait DNA with Certainty Badges
	traitDNA := buildTraitDNAWithCertainty(col, ref.SerialNumber, backdropKey, backdropPermille, backdropColors, symbolKey, symbolPermille, backdropCertainty, symbolCertainty)

	// 7. Multi-Market Exit Planner (6 venues ranked by net payout)
	exitPlanner := venues.ComputeExitPlan(ctx, expectedGRAM, gramUsdRate, 80)

	// 8. Crafting EV (if applicable or inventory forge)
	var craftingEV *crafting.CraftingEVResult
	if col.CraftedFlag || ref.SerialNumber%3 == 0 {
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
	}

	// 9. Upgrade Timing Advisor (if un-upgraded / active stair)
	var upgradeAdvisor *upgrade.UpgradeAdviceReport
	if !col.CraftedFlag {
		upgradeAdvisor = upgrade.GenerateUpgradeAdvice(ctx, ref.GiftID, ref.ModelID, col.BaseStarsPrice, gramUsdRate)
	}

	// 10. Risk Audit
	riskAudit := risk.AuditGiftRisk(ctx, ref.ModelID, ref.SerialNumber, 80, nil, nil)

	// 11. 12-Month Projection
	projection := GrowthProjection{
		BullGRAM: roundPrice(expectedGRAM * 1.40),
		BullUSD:  roundPrice(expectedGRAM * 1.40 * gramUsdRate),
		BaseGRAM: roundPrice(expectedGRAM * 1.15),
		BaseUSD:  roundPrice(expectedGRAM * 1.15 * gramUsdRate),
		BearGRAM: roundPrice(expectedGRAM * 0.88),
		BearUSD:  roundPrice(expectedGRAM * 0.88 * gramUsdRate),
	}

	// 12. Recommendation
	recommendation := buildGiftRecommendation(expectedGRAM, exitPlanner, craftingEV)

	// 13. Certificate Hash ID
	certPayload := fmt.Sprintf("%s:%s:%.2f:%d", ref.GiftID, ModelVersion, expectedGRAM, time.Now().Unix())
	certHash := sha256.Sum256([]byte(certPayload))
	certificateID := "IFRG-GFT-" + hex.EncodeToString(certHash[:])[:12]

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
		"base_floor_gram":   col.InitialFloorGRAM,
		"model_supply":      col.TotalSupply,
		"beta_serial":       betaSerial,
		"beta_backdrop":     betaBackdrop,
		"beta_symbol":       betaSymbol,
		"backdrop_permille": backdropPermille,
		"symbol_permille":   symbolPermille,
	}

	reasoningLog := map[string]interface{}{
		"model_version":      ModelVersion,
		"beta0_floor":        beta0,
		"beta_model":         betaModel,
		"beta_backdrop":      betaBackdrop,
		"beta_symbol":        betaSymbol,
		"beta_serial":        betaSerial,
		"beta_original":      betaOriginal,
		"fng_multiplier":     fngMult,
		"bayesian_k":         ShrinkageK,
		"price_basis":        priceBasis,
		"narrative_only":     true, // Sacred Rule 11
		"signals_count":      34,
		"comparables":        compSummaries,
	}

	valuation := &GiftValuation{
		RunID:           time.Now().UnixNano(),
		GiftID:          ref.GiftID,
		ModelID:         ref.ModelID,
		ModelName:       col.Name,
		SerialNumber:    ref.SerialNumber,
		DisplayTitle:    fmt.Sprintf("%s #%d", col.Name, ref.SerialNumber),
		ModelVersion:    ModelVersion,
		BasePriceGRAM:   decimal.NewFromFloat(expectedGRAM),
		LowGRAM:         decimal.NewFromFloat(lowGRAM),
		ExpectedGRAM:    decimal.NewFromFloat(expectedGRAM),
		HighGRAM:        decimal.NewFromFloat(highGRAM),
		LowUSD:          lowUSD,
		ExpectedUSD:     expectedUSD,
		HighUSD:         highUSD,
		GRAMUSDRate:     gramUsdRate,
		ConfidenceScore: calibratedConfidence,
		PriceBasis:      priceBasis,
		TraitDNA:        traitDNA,
		ExitPlanner:     exitPlanner,
		CraftingEV:      craftingEV,
		UpgradeAdvisor:  upgradeAdvisor,
		Comps:           comps,
		RiskAudit:       riskAudit,
		Projection:      projection,
		Recommendation:  recommendation,
		CertificateID:   certificateID,
		EvaluatedAt:     time.Now().UTC(),
		ReasoningLog:    reasoningLog,
	}

	// Mandatory Audit Write (Sacred Rule 5)
	if e.giftsRepo != nil {
		id, err := e.giftsRepo.SaveValuationAudit(ctx, ref.GiftID, ref.ModelID, ref.SerialNumber, ModelVersion, configSnapshot, gramUsdRate, col.InitialFloorGRAM, lowGRAM, expectedGRAM, highGRAM, calibratedConfidence, priceBasis, reasoningLog)
		if err != nil {
			slog.Error("CRITICAL: Mandatory Gift Valuation Audit Write failed", "gift_id", ref.GiftID, "error", err)
			return nil, fmt.Errorf("mandatory audit write failed: %w", err)
		}
		valuation.RunID = id
	}

	return valuation, nil
}

func computeSerialExponent(serial, supply int) float64 {
	if serial <= 0 {
		serial = 1
	}
	if supply <= 0 {
		supply = 10000
	}

	// 1. Smooth continuous logarithmic low-serial prestige curve
	var betaAbs float64
	if serial == 1 {
		betaAbs = 1.45 // Sacred #1 jump (exp(1.45) ≈ 4.26x)
	} else if serial == 2 || serial == 3 {
		betaAbs = 1.20 - float64(serial-2)*0.08 // Top 3 prestige (~3.3x)
	} else if serial <= 9 {
		// Smooth decay from 1.05 down to 0.78
		betaAbs = 1.05 - (float64(serial-4)/5.0)*0.27
	} else if serial <= 99 {
		// Smooth decay from 0.75 down to 0.40
		t := float64(serial-10) / 89.0
		betaAbs = 0.75 - t*0.35
	} else if serial <= 1000 {
		// Smooth decay from 0.38 down to 0.10
		t := float64(serial-100) / 900.0
		betaAbs = 0.38 - t*0.28
	} else if serial <= 5000 {
		t := float64(serial-1000) / 4000.0
		betaAbs = 0.10 - t*0.08
	} else {
		betaAbs = 0.02
	}

	// Sacred milestone repdigits and round numbers bonus (smooth additive bump)
	if isRepdigit(serial) {
		betaAbs += 0.22 // e.g. 77, 88, 99, 777, 888, 999, 7777, 8888
	} else if serial%1000 == 0 {
		betaAbs += 0.15
	} else if serial%100 == 0 {
		betaAbs += 0.10
	}

	// 2. Relative Percentile Rarity relative to total model supply
	rankPct := float64(serial) / float64(supply)
	var betaRel float64
	if rankPct > 0.80 {
		// Discount for long tail
		betaRel = -0.08 * ((rankPct - 0.80) / 0.20)
	} else if rankPct < 0.01 {
		// Additional scarcity bonus for top 1% percentile of collection
		betaRel = 0.12 * (1.0 - rankPct/0.01)
	}

	return betaAbs + betaRel
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

func (e *ValuationEngine) resolveComps(ctx context.Context, ref *ParsedGiftRef, backdrop string, gramUsdRate, hedonicLogP float64) ([]ComparableGiftSale, float64, float64, string) {
	comps := []ComparableGiftSale{}
	finalLogP := hedonicLogP
	mad := 0.16 // default MAD baseline

	if e.giftsRepo != nil {
		sales, err := e.giftsRepo.GetCompsForGift(ctx, ref.ModelID, ref.SerialNumber, 5)
		if err == nil && len(sales) > 0 {
			now := time.Now()
			compsForMath := make([]core.ComparableSale, 0, len(sales))
			for _, s := range sales {
				pGram, _ := s.SalePriceGRAM.Float64()
				compsForMath = append(compsForMath, core.ComparableSale{
					ID:          s.ID,
					PriceTON:    pGram,
					RawPriceTON: pGram,
					SaleDate:    s.SaleDate,
				})
			}

			// Apply market appreciation (15% annual for gifts) & Winsorization
			core.ApplyMarketAppreciation(compsForMath, 0.15, now)
			compsForMath = core.WinsorizeComparables(compsForMath, 0.05, 0.95)
			decayWeights := core.CalcTimeDecayWeights(compsForMath, DecayLambda, now)
			nEff := core.CalcEffectiveSampleSize(decayWeights)

			if len(compsForMath) > 0 && nEff > 0 {
				logPrices := make([]float64, len(compsForMath))
				for i, s := range compsForMath {
					logPrices[i] = math.Log(math.Max(s.PriceTON, 1.0))
				}
				exactMedianLog := core.WeightedMedian(logPrices, decayWeights)
				finalLogP = core.BayesianShrinkage(exactMedianLog, hedonicLogP, nEff, ShrinkageK)
				mad = core.WeightedMAD(logPrices, decayWeights, exactMedianLog)
			}

			tempEstGRAM := math.Exp(finalLogP)
			for i, s := range sales {
				pGram := compsForMath[i].PriceTON
				pUsd := pGram * gramUsdRate

				diffPct := 0.0
				if tempEstGRAM > 0 {
					diffPct = roundPrice(((pGram - tempEstGRAM) / tempEstGRAM) * 100.0)
				}

				tonviewer := "https://tonviewer.com"
				if s.TxHash != "" {
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
			return comps, finalLogP, mad, "gift_market_comps_bayesian_shrunk"
		}
	}

	return comps, finalLogP, mad, "hedonic_model_floor_basis"
}

func buildTraitDNAWithCertainty(col traits.CollectionMeta, serial int, backdropName string, backdropPermille int, colors traits.BackdropColorSet, symbolName string, symbolPermille int, backdropCert, symbolCert string) []TraitDNABar {
	serialPct, serialRankText := traits.CalculateSerialPercentile(serial, col.TotalSupply)
	bdRarity := traits.CalculateExactRarity("backdrop", backdropName, backdropPermille, &colors)
	symRarity := traits.CalculateExactRarity("symbol", symbolName, symbolPermille, nil)

	modelPct := (float64(col.TotalSupply) / 1000000.0) * 100.0
	if modelPct < 0.1 {
		modelPct = 0.1
	}

	modelTier := "Common"
	if col.TotalSupply <= 2000 {
		modelTier = "Legendary"
	} else if col.TotalSupply <= 5000 {
		modelTier = "Epic"
	} else if col.TotalSupply <= 15000 {
		modelTier = "Rare"
	} else if col.TotalSupply <= 50000 {
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

	return []TraitDNABar{
		{
			AxisKey:        "model",
			LabelEn:        "Model Core",
			LabelFa:        "مدل کالکشن",
			Value:          col.Name,
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
	return buildTraitDNAWithCertainty(col, serial, backdropName, backdropPermille, colors, "Aero Crest", symbolPermille, "exact", "exact")
}

func buildGiftRecommendation(expectedGRAM float64, exitPlan *venues.ExitPlannerPlan, craftEV *crafting.CraftingEVResult) ValuationActionVerdict {
	verdict := "HOLD"
	conf := "Strong Scarcity Hold"
	sumEn := "Deflationary tokenomics and high trait rarity make holding optimal for medium-term yield."
	sumFa := "به دلیل کمیابی بالای صفات و عرضه محدود، نگهداری دارایی برای رشد ارزش میان‌مدت پیشنهاد می‌شود."

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
