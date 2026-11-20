package gvengine

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"ifragment-backend/internal/service/gifts/serials"
	"ifragment-backend/internal/service/gifts/traits"
)

func TestGVEngineV8_FourRegimeFloorLockLaw(t *testing.T) {
	ctx := context.Background()
	engine := NewValuationEngine(nil, nil, nil)
	engine.SetNFTResolver(nil) // Deterministic offline test mode

	// 1. Regime 1: Standard serial (#1235) with no special traits -> Strictly locked at 1.00x Collection Floor!
	stdVal, err := engine.Valuate(ctx, "plush_pepe-1235")
	if err != nil {
		t.Fatalf("unexpected error valuating plush_pepe-1235: %v", err)
	}
	if stdVal.ModelVersion != "GV-Engine-v8.0-FloorLockedQuantum" {
		t.Errorf("expected ModelVersion GV-Engine-v8.0-FloorLockedQuantum, got %s", stdVal.ModelVersion)
	}
	if stdVal.FloorMatrix == nil {
		t.Fatalf("expected non-nil FloorMatrix on GiftValuation")
	}
	if !stdVal.FloorMatrix.IsFloorLocked {
		t.Errorf("expected plush_pepe-1235 (standard serial, no live special traits) to be Floor-Locked, got IsFloorLocked=false (features=%v)", stdVal.FloorMatrix.SpecialFeaturesDetected)
	}
	if stdVal.FloorMatrix.FloorLockRegime != "COLLECTION_FLOOR_LOCKED" && stdVal.FloorMatrix.FloorLockRegime != "MODEL_FLOOR_LOCKED" {
		t.Errorf("unexpected FloorLockRegime for standard item: %s", stdVal.FloorMatrix.FloorLockRegime)
	}
	stdExpected, _ := stdVal.ExpectedGRAM.Float64()
	if stdExpected != stdVal.FloorMatrix.DominantFloorGRAM {
		t.Errorf("Floor-Lock Law violated: expected standard gift ExpectedGRAM (%.2f) == DominantFloorGRAM (%.2f)",
			stdExpected, stdVal.FloorMatrix.DominantFloorGRAM)
	}
	if stdVal.FloorMatrix.CompoundMultiplier != 1.00 {
		t.Errorf("expected CompoundMultiplier=1.00 for floor-locked item, got %.2f", stdVal.FloorMatrix.CompoundMultiplier)
	}

	// Verify Midnight Blue (#1a2035) fallback does NOT falsely trigger OBSIDIAN_STEALTH or inflate backdrop floor
	if stdVal.AestheticHarmony.HarmonyClass == "OBSIDIAN_STEALTH" {
		t.Errorf("regression: default Midnight Blue (#1a2035) must not falsely trigger OBSIDIAN_STEALTH")
	}
	if stdVal.FloorMatrix.BackdropFloorGRAM != stdVal.FloorMatrix.CollectionFloorGRAM {
		t.Errorf("regression: unverified estimated backdrop must not inflate BackdropFloorGRAM (%.2f) above CollectionFloorGRAM (%.2f)",
			stdVal.FloorMatrix.BackdropFloorGRAM, stdVal.FloorMatrix.CollectionFloorGRAM)
	}

	// 2. Regime 4: Special Collector Grails (Genesis #1, Lucky #777, AABB Doublet #1122, Omega Final Mint #N/N)
	col, _ := traits.ResolveCollection("plush_pepe")
	omegaGiftID := fmt.Sprintf("plush_pepe-%d", col.TotalSupply)
	grailCases := []struct {
		giftID   string
		minRatio float64
	}{
		{"plush_pepe-1", 4.50},
		{"plush_pepe-7", 1.75},
		{"plush_pepe-88", 1.35},
		{"plush_pepe-777", 1.35},
		{"plush_pepe-1122", 1.12},
		{omegaGiftID, 1.20}, // Omega Final Mint (#N of N supply)
	}

	for _, tc := range grailCases {
		gv, err := engine.Valuate(ctx, tc.giftID)
		if err != nil {
			t.Fatalf("unexpected error valuating %s: %v", tc.giftID, err)
		}
		if gv.FloorMatrix == nil || !gv.FloorMatrix.HasSpecialFeature {
			t.Errorf("expected %s to have HasSpecialFeature=true", tc.giftID)
		}
		if gv.FloorMatrix.FloorLockRegime != "SPECIAL_COLLECTOR_GRAIL" {
			t.Errorf("expected %s regime SPECIAL_COLLECTOR_GRAIL, got %s", tc.giftID, gv.FloorMatrix.FloorLockRegime)
		}
		expVal, _ := gv.ExpectedGRAM.Float64()
		ratio := expVal / stdExpected
		if ratio < tc.minRatio {
			t.Errorf("expected %s (%.2f GRAM) to be at least %.2fx standard floor item (%.2f GRAM), got %.2fx",
				tc.giftID, expVal, tc.minRatio, stdExpected, ratio)
		}
	}
}

func TestGVEngineV8_CIEDE2000ColorScienceAnd3DModelInference(t *testing.T) {
	// 1. Gold 3D Model ("Midas") on "Astral Gold" backdrop -> Monochrome Grail Match (low Delta-E 2000)
	goldBackdrop := traits.BackdropColorSet{
		CenterHex: "#fbbf24",
		EdgeHex:   "#b45309",
	}
	goldHarmony := traits.EvaluateAestheticHarmonyWithModel("plush_pepe", "Midas", "Astral Gold", &goldBackdrop)
	if !goldHarmony.IsMonochromeColorMatch {
		t.Errorf("expected Midas on Astral Gold to be a perceptual CIEDE2000 Monochrome Color Match (dE00=%.2f)", goldHarmony.DeltaE2000ModelBackdrop)
	}
	if goldHarmony.DeltaE2000ModelBackdrop > 18.0 {
		t.Errorf("expected DeltaE2000ModelBackdrop <= 18.0 for Midas on Astral Gold, got %.2f", goldHarmony.DeltaE2000ModelBackdrop)
	}
	if goldHarmony.ThemeMatchRating != "PERFECT_MATCH" {
		t.Errorf("expected PERFECT_MATCH for Midas on Astral Gold, got %s", goldHarmony.ThemeMatchRating)
	}

	// 2. Gold 3D Model ("Midas") on clashing "Electric Purple" backdrop -> High Delta-E 2000 (not monochrome match)
	purpleBackdrop := traits.BackdropColorSet{
		CenterHex: "#9333ea",
		EdgeHex:   "#3b0764",
	}
	clashHarmony := traits.EvaluateAestheticHarmonyWithModel("plush_pepe", "Midas", "Electric Purple", &purpleBackdrop)
	if clashHarmony.IsMonochromeColorMatch {
		t.Errorf("expected Midas on Electric Purple NOT to be a monochrome match (dE00=%.2f)", clashHarmony.DeltaE2000ModelBackdrop)
	}
	if clashHarmony.DeltaE2000ModelBackdrop <= 35.0 {
		t.Errorf("expected high perceptual DeltaE2000 (>35) between Gold and Purple, got %.2f", clashHarmony.DeltaE2000ModelBackdrop)
	}

	// 3. Dark/Stealth 3D Model ("Ninja") on "Onyx Black" backdrop -> OBSIDIAN_STEALTH + Monochrome Match
	blackBackdrop := traits.BackdropColorSet{
		CenterHex: "#0d0d12",
		EdgeHex:   "#000000",
	}
	stealthHarmony := traits.EvaluateAestheticHarmonyWithModel("plush_pepe", "Ninja", "Onyx Black", &blackBackdrop)
	if stealthHarmony.PrestigeTier != traits.PrestigeTierS {
		t.Errorf("expected PrestigeTierS for Onyx Black, got %s", stealthHarmony.PrestigeTier)
	}
	if !stealthHarmony.IsMonochromeColorMatch {
		t.Errorf("expected Ninja (#141418) on Onyx Black (#0d0d12) to be a monochrome match, got dE00=%.2f", stealthHarmony.DeltaE2000ModelBackdrop)
	}
}

func TestGVEngineV8_MTProtoAndTEP62BinaryForensics(t *testing.T) {
	packed, bits := PackHexToRGB24("#0d0d12")
	if packed != 0x0d0d12 {
		t.Errorf("expected 24-bit RGB integer 0x0d0d12 (855314), got %d", packed)
	}
	if bits != "00001101 00001101 00010010" {
		t.Errorf("unexpected 24-bit binary stream: %s", bits)
	}

	harmony := traits.EvaluateAestheticHarmonyWithModel("plush_pepe", "Midas", "Onyx Black", &traits.BackdropColorSet{
		CenterHex: "#0d0d12",
		EdgeHex:   "#050508",
	})
	bf := ComputeGiftBinaryForensics(
		"plush_pepe",
		42,
		"Midas",
		0.5,
		"Onyx Black",
		"#0d0d12",
		"#050508",
		10,
		"Illuminati",
		5,
		harmony,
	)

	if bf.MTProtoConstructor != "starGiftUnique#5c62d151" {
		t.Errorf("expected starGiftUnique#5c62d151, got %s", bf.MTProtoConstructor)
	}
	if bf.MTProtoModelAttrConstructor != "starGiftAttributeModel#39d99013" {
		t.Errorf("expected starGiftAttributeModel#39d99013, got %s", bf.MTProtoModelAttrConstructor)
	}
	if bf.MTProtoBackdropConstructor != "starGiftAttributeBackdrop#d93d859c" {
		t.Errorf("expected starGiftAttributeBackdrop#d93d859c, got %s", bf.MTProtoBackdropConstructor)
	}
	if bf.MTProtoPatternConstructor != "starGiftAttributePattern#13acff19" {
		t.Errorf("expected starGiftAttributePattern#13acff19, got %s", bf.MTProtoPatternConstructor)
	}
	if !strings.HasPrefix(bf.TVMCellBOCHex, "0xb5ee9c724101010100") {
		t.Errorf("expected TON TVM BOC header with CRC32-C flag 0xb5ee9c724101010100..., got %s", bf.TVMCellBOCHex)
	}
	if bf.CRC32CChecksumHex == "" || !strings.HasPrefix(bf.CRC32CChecksumHex, "0x") || len(bf.CRC32CChecksumHex) != 10 {
		t.Errorf("expected 4-byte 0x-prefixed Castagnoli CRC32-C checksum hex, got %s", bf.CRC32CChecksumHex)
	}
	if !strings.HasPrefix(bf.TEP64ContentCellBOCHex, "0xb5ee9c724101010100") {
		t.Errorf("expected valid TEP-64 content cell BOC, got %s", bf.TEP64ContentCellBOCHex)
	}
	if bf.FragmentGiftWebURI != "https://fragment.com/gift/plushpepe-42" || bf.TGSStickerURI != "https://nft.fragment.com/gift/plushpepe-42.tgs" {
		t.Errorf("expected FragmentGiftWebURI and TGSStickerURI, got %s / %s", bf.FragmentGiftWebURI, bf.TGSStickerURI)
	}
	if !strings.HasPrefix(bf.TEP62ItemIndexSHA256, "0x") || len(bf.TEP62ItemIndexSHA256) != 66 {
		t.Errorf("invalid TEP-62 SHA256 index: %s", bf.TEP62ItemIndexSHA256)
	}
	if bf.ShannonSurprisalBits <= 15.0 {
		t.Errorf("expected high Shannon surprisal bits (>15 bits) for rare trait triplet, got %.2f", bf.ShannonSurprisalBits)
	}
}

func TestGVEngineV8_SerialGeneticsAndLayaCraftFodderGuard(t *testing.T) {
	// 1. Verify Omega Final Mint (#N/N) & AABB Quad-Block Doublet in Serial Classifier
	omega := serials.ClassifySerialWithSupply(2861, 2861, 100.0)
	if omega.Category != serials.CategoryOmegaMint {
		t.Errorf("expected serial #2861/2861 to be classified as CategoryOmegaMint, got %s", omega.Category)
	}
	aabb := serials.ClassifySerialWithSupply(7788, 10000, 100.0)
	if aabb.Category != serials.CategoryDoublet {
		t.Errorf("expected serial #7788 to be classified as CategoryDoublet (AABB), got %s", aabb.Category)
	}
	sub100Rep := serials.ClassifySerialWithSupply(88, 10000, 100.0)
	if sub100Rep.Category != serials.CategoryRepDigit || sub100Rep.Multiplier < 3.0 {
		t.Errorf("expected serial #88 to be sub-100 twin repdigit with multiplier >= 3.0, got %s (%.2fx)", sub100Rep.Category, sub100Rep.Multiplier)
	}

	// 2. Verify Laya System 1 Craft Fodder Protection vs Floor Sweeper
	evaluator := NewLayaGiftEvaluator()
	ctx := context.Background()

	floorLockedRes := evaluator.EvaluateGiftWithTelemetry(ctx, GiftTelemetryInput{
		CollectionID:        "plush_pepe",
		ModelVariant:        "Original",
		ModelRarityPct:      2.5,
		Backdrop:            "Cobalt Blue",
		BackdropPermille:    25,
		Symbol:              "Star",
		SymbolPermille:      30,
		Serial:              1420,
		TotalSupply:         2861,
		SerialCategory:      "standard",
		DeltaE2000:          42.0,
		IsColorMatched:      false,
		DominantFloorDriver: "collection_floor",
		FloorLockRegime:     "COLLECTION_FLOOR_LOCKED",
		HasSpecialFeature:   false,
		HasTelemetry:        true,
	})
	if floorLockedRes.SynergyMultiplier != 1.00 {
		t.Errorf("expected SynergyMultiplier=1.00 for COLLECTION_FLOOR_LOCKED item, got %.2f", floorLockedRes.SynergyMultiplier)
	}
	if floorLockedRes.CollectorAppeal != "floor_sweeper" {
		t.Errorf("expected collector_appeal=floor_sweeper for floor-locked item, got %s", floorLockedRes.CollectorAppeal)
	}
	if floorLockedRes.CraftFodderSuitability < 0.80 {
		t.Errorf("expected high CraftFodderSuitability (>=0.80) for standard collection-floor item, got %.2f", floorLockedRes.CraftFodderSuitability)
	}

	grailRes := evaluator.EvaluateGiftWithTelemetry(ctx, GiftTelemetryInput{
		CollectionID:        "plush_pepe",
		ModelVariant:        "Midas",
		ModelRarityPct:      0.5,
		Backdrop:            "Astral Gold",
		BackdropPermille:    10,
		Symbol:              "Crown",
		SymbolPermille:      5,
		Serial:              7,
		TotalSupply:         2861,
		SerialCategory:      "single_digit",
		DeltaE2000:          7.2,
		IsColorMatched:      true,
		DominantFloorDriver: "backdrop_floor",
		FloorLockRegime:     "SPECIAL_COLLECTOR_GRAIL",
		HasSpecialFeature:   true,
		HasTelemetry:        true,
	})
	if grailRes.SynergyMultiplier <= 1.05 {
		t.Errorf("expected SynergyMultiplier > 1.05 for monochrome #7 Grail, got %.2f", grailRes.SynergyMultiplier)
	}
	if grailRes.CollectorAppeal != "museum_grail" {
		t.Errorf("expected collector_appeal=museum_grail for monochrome #7 Grail, got %s", grailRes.CollectorAppeal)
	}
	if grailRes.CraftFodderSuitability > 0.05 {
		t.Errorf("expected near-zero CraftFodderSuitability (<=0.05) for Grail item so it is never burned in Forge, got %.2f", grailRes.CraftFodderSuitability)
	}
}
