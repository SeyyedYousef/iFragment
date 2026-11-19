package cardgen

import (
	"bytes"
	"image/png"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func TestGeneratePremiumPromoCard_AllAssetTypes(t *testing.T) {
	cg := NewCardGenerator()

	tests := []struct {
		name   string
		params PromoCardParams
	}{
		{
			name: "Username Legendary",
			params: PromoCardParams{
				AssetType:  "username",
				Title:      "@crypto",
				Eyebrow:    "TELEGRAM DIGITAL USERNAME",
				Badge:      "LEGENDARY",
				FairTON:    "1500.0",
				FairUSD:    "5220",
				LowTON:     "1150.0",
				LowUSD:     "4002",
				HighTON:    "2100.0",
				HighUSD:    "7308",
				Confidence: 94,
				SpecChips:  []string{"GRADE AAA", "BRAND 96/100", "6 CHARS · HIGH LIQ"},
				BotHandle:  "@iFragmentBot",
				CertRef:    "AVM v7.0 · 2026-11-18",
			},
		},
		{
			name: "Username Long Standard",
			params: PromoCardParams{
				AssetType:  "username",
				Title:      "@super_long_username_2026_pro",
				Eyebrow:    "TELEGRAM DIGITAL USERNAME",
				Badge:      "COMMON",
				FairTON:    "18.5",
				FairUSD:    "64",
				LowTON:     "12.0",
				LowUSD:     "42",
				HighTON:    "28.0",
				HighUSD:    "97",
				Confidence: 81,
				SpecChips:  []string{"GRADE B", "BRAND 62/100", "29 CHARS"},
				BotHandle:  "@iFragmentBot",
			},
		},
		{
			name: "Gift With Backdrop Colors",
			params: PromoCardParams{
				AssetType:      "gift",
				Title:          "Plush Pepe #42",
				Eyebrow:        "TELEGRAM COLLECTIBLE GIFT",
				Badge:          "EPIC",
				FairTON:        "420.0",
				FairUSD:        "1462",
				LowTON:         "345.0",
				LowUSD:         "1200",
				HighTON:        "560.0",
				HighUSD:        "1949",
				Confidence:     91,
				ModelName:      "Pepe Classic",
				BackdropName:   "Emerald Glow",
				SymbolName:     "Golden Star",
				BackdropCenter: "#10B981",
				BackdropEdge:   "#042F2E",
				SerialNumber:   42,
				BotHandle:      "@iFragmentBot",
			},
		},
		{
			name: "Collectible Number Rank 1",
			params: PromoCardParams{
				AssetType:  "number",
				Title:      "+888 8888 8888",
				Eyebrow:    "TELEGRAM ANONYMOUS NUMBER",
				Badge:      "RANK #1",
				FairTON:    "350000.0",
				FairUSD:    "1218000",
				LowTON:     "280000.0",
				LowUSD:     "974400",
				HighTON:    "450000.0",
				HighUSD:    "1566000",
				Confidence: 97,
				SpecChips:  []string{"RANK #1 / 136K", "GRAIL MONODIGIT", "HIGH LIQUIDITY"},
				BotHandle:  "@iFragmentBot",
			},
		},
		{
			name: "Non-Latin Input Safety",
			params: PromoCardParams{
				AssetType:  "number",
				Title:      "+888 0123 4567",
				Eyebrow:    "شماره کلکسیونی",
				Badge:      "حماسی",
				FairTON:    "4500.0",
				FairUSD:    "15660",
				LowTON:     "3800.0",
				LowUSD:     "13224",
				HighTON:    "5900.0",
				HighUSD:    "20532",
				Confidence: 88,
				SpecChips:  []string{"کلوب رند", "HIGH LIQUIDITY"},
				BotHandle:  "@iFragmentBot",
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			data, err := cg.GeneratePremiumPromoCard(tc.params)
			if err != nil {
				t.Fatalf("GeneratePremiumPromoCard failed: %v", err)
			}
			if len(data) == 0 {
				t.Fatalf("expected non-empty PNG bytes")
			}
			img, err := png.Decode(bytes.NewReader(data))
			if err != nil {
				t.Fatalf("invalid PNG generated: %v", err)
			}
			if img.Bounds().Dx() != 1080 || img.Bounds().Dy() != 1080 {
				t.Fatalf("expected 1080x1080, got %dx%d", img.Bounds().Dx(), img.Bounds().Dy())
			}
		})
	}
}

func TestGeneratePremiumPromoCard_Concurrent(t *testing.T) {
	cg := NewCardGenerator()
	var wg sync.WaitGroup
	errs := make(chan error, 6)

	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, err := cg.GeneratePremiumPromoCard(PromoCardParams{
				AssetType:  "username",
				Title:      "@ifragment",
				Badge:      "RARE",
				FairTON:    "250",
				FairUSD:    "870",
				Confidence: 89,
			})
			if err != nil {
				errs <- err
			}
		}(i)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatalf("concurrent card generation error: %v", err)
	}
}

// Optional visual inspection export when IFR_EXPORT_PROMO_SAMPLES is set.
func TestExportPromoSamplesToScratch(t *testing.T) {
	outDir := os.Getenv("IFR_EXPORT_PROMO_SAMPLES")
	if outDir == "" {
		return
	}
	cg := NewCardGenerator()
	samples := map[string]PromoCardParams{
		"promo_username.png": {
			AssetType:  "username",
			Title:      "@crypto",
			Eyebrow:    "TELEGRAM DIGITAL USERNAME",
			Badge:      "LEGENDARY",
			FairTON:    "1500.0",
			FairUSD:    "5220",
			LowTON:     "1150.0",
			LowUSD:     "4002",
			HighTON:    "2100.0",
			HighUSD:    "7308",
			Confidence: 94,
			SpecChips:  []string{"GRADE AAA", "BRAND 96/100", "6 CHARS · HIGH LIQ"},
			BotHandle:  "@iFragmentBot",
		},
		"promo_gift.png": {
			AssetType:      "gift",
			Title:          "Plush Pepe #42",
			Eyebrow:        "TELEGRAM COLLECTIBLE GIFT",
			Badge:          "EPIC",
			FairTON:        "420.0",
			FairUSD:        "1462",
			LowTON:         "345.0",
			LowUSD:         "1200",
			HighTON:        "560.0",
			HighUSD:        "1949",
			Confidence:     91,
			ModelName:      "Pepe Classic",
			BackdropName:   "Emerald Glow",
			SymbolName:     "Golden Star",
			BackdropCenter: "#10B981",
			BackdropEdge:   "#042F2E",
			SerialNumber:   42,
			BotHandle:      "@iFragmentBot",
		},
		"promo_number.png": {
			AssetType:  "number",
			Title:      "+888 8888 8888",
			Eyebrow:    "GENESIS & COLLECTIBLE NUMBER",
			Badge:      "RANK #1",
			FairTON:    "100000.0",
			FairUSD:    "348000",
			LowTON:     "82000.0",
			LowUSD:     "285360",
			HighTON:    "128000.0",
			HighUSD:    "445440",
			Confidence: 97,
			SpecChips:  []string{"RANK #1 / 136K", "GRAIL MONODIGIT", "HIGH LIQUIDITY"},
			BotHandle:  "@iFragmentBot",
		},
		"promo_username_common.png": {
			AssetType:  "username",
			Title:      "@amir_hossein_dev",
			Eyebrow:    "TELEGRAM DIGITAL USERNAME",
			Badge:      "COMMON",
			FairTON:    "22.0",
			FairUSD:    "77",
			LowTON:     "15.0",
			LowUSD:     "52",
			HighTON:    "32.0",
			HighUSD:    "111",
			Confidence: 84,
			SpecChips:  []string{"GRADE B", "BRAND 71/100", "16 CHARS"},
			BotHandle:  "@iFragmentBot",
		},
	}
	if err := os.MkdirAll(outDir, 0755); err != nil {
		t.Fatal(err)
	}
	for filename, params := range samples {
		data, err := cg.GeneratePremiumPromoCard(params)
		if err != nil {
			t.Fatalf("failed generating %s: %v", filename, err)
		}
		if err := os.WriteFile(filepath.Join(outDir, filename), data, 0644); err != nil {
			t.Fatalf("failed writing %s: %v", filename, err)
		}
	}
}
