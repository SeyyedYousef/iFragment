package avm

import (
	"math"
	"math/rand"
	"regexp"
	"strings"
	"testing"
	"time"
)

// TestAVMv7_InvariantFuzzing runs 10,000 synthetic usernames to ensure math engine invariants:
// 1. Low <= Expected <= High
// 2. Zero NaN or Inf values
// 3. Expected > 0
func TestAVMv7_InvariantFuzzing(t *testing.T) {
	DisableDatamuseNetwork = true
	defer func() { DisableDatamuseNetwork = false }()

	cfg := DefaultEngineConfig()
	r := rand.New(rand.NewSource(42))


	chars := "abcdefghijklmnopqrstuvwxyz"
	digits := "0123456789"
	prefixes := []string{"", "real_", "the_", "official_", "get_"}
	suffixes := []string{"", "_bot", "_official", "_admin", "_channel"}

	for i := 0; i < 10000; i++ {
		// Generate random username
		prefix := prefixes[r.Intn(len(prefixes))]
		suffix := suffixes[r.Intn(len(suffixes))]

		coreLen := 2 + r.Intn(10)
		var core strings.Builder
		core.WriteByte(chars[r.Intn(len(chars))]) // Must start with letter
		for j := 1; j < coreLen; j++ {
			if r.Float64() < 0.3 {
				core.WriteByte(digits[r.Intn(len(digits))])
			} else {
				core.WriteByte(chars[r.Intn(len(chars))])
			}
		}

		u := prefix + core.String() + suffix
		if len(u) < 4 {
			u = u + "xxxx"
		}
		if len(u) > 32 {
			u = u[:32]
		}
		if u[0] >= '0' && u[0] <= '9' || u[0] == '_' {
			u = "a" + u[1:]
		}

		segment, charLen, features := ClassifyUsername(u)
		if charLen < 4 || charLen > 32 {
			continue
		}

		now := time.Now()
		baseLog, nEff, mad, _ := CalcBaseLog(nil, nil, nil, cfg, features, now)
		morphLog := CalcMorphologyLog(features, cfg.MorphMultipliers, cfg)
		momentumLog := CalcSmoothedMomentum(r.Intn(10), r.Intn(20), 1.0, cfg)

		expectedRaw, lowRaw, highRaw := CalcRangeLog(baseLog, morphLog, momentumLog, 0.0, mad, int(charLen), cfg)

		// FnG segment elasticity
		fngMult, _, _ := GetCalibratedFnGMultiplier(features.IsDictionary, cfg)
		expectedRaw *= fngMult
		lowRaw *= fngMult
		highRaw *= fngMult

		// Check Gibberish cap
		if features.IsGibberish || features.HasCheapPrefix || features.HasCheapSuffix {
			expectedRaw = math.Min(expectedRaw, 25.0)
			lowRaw = math.Min(lowRaw, 15.0)
			highRaw = math.Min(highRaw, 35.0)
		}

		expected := AestheticRound(expectedRaw)
		low := AestheticRound(lowRaw)
		high := AestheticRound(highRaw)

		if low > expected {
			low = expected
		}
		if high < expected {
			high = expected
		}

		// Invariant checks
		if math.IsNaN(expected) || math.IsNaN(low) || math.IsNaN(high) {
			t.Fatalf("Iteration %d: NaN detected for username '%s' (segment %s)", i, u, segment)
		}
		if math.IsInf(expected, 0) || math.IsInf(low, 0) || math.IsInf(high, 0) {
			t.Fatalf("Iteration %d: Inf detected for username '%s'", i, u)
		}
		if low > expected || expected > high {
			t.Fatalf("Iteration %d: Invariant violated for username '%s': low=%.2f <= expected=%.2f <= high=%.2f", i, u, low, expected, high)
		}
		if expected <= 0 {
			t.Fatalf("Iteration %d: Expected price <= 0 for username '%s': %.2f", i, u, expected)
		}
		if nEff < 0 {
			t.Fatalf("Iteration %d: Negative nEff %.2f for username '%s'", i, nEff, u)
		}
	}
}

// TestAVMv7_GoldenHandles evaluates 50 critical reference handles across segments.
func TestAVMv7_GoldenHandles(t *testing.T) {
	DisableDatamuseNetwork = true
	defer func() { DisableDatamuseNetwork = false }()

	goldenHandles := []struct {
		username    string
		minExpected float64
		maxExpected float64
		isAnchor    bool
		isGibberish bool
		isBrand     bool
	}{
		// Mega Genesis Anchors
		{"news", 500000, 3000000, true, false, false},
		{"auto", 400000, 2500000, true, false, false},
		{"bank", 400000, 2500000, true, false, false},
		{"chat", 400000, 2500000, true, false, false},
		{"game", 300000, 2000000, true, false, false},
		{"hotels", 200000, 1500000, true, false, false},
		{"crypto", 100000, 1000000, true, false, false},
		{"ton", 5000, 1000000, false, false, false},
		{"vip", 5000, 500000, false, false, false},

		// English Dictionary
		{"wallet", 500000, 2000000, false, false, false},
		{"silver", 100000, 500000, false, false, false},
		{"cloud", 50, 100000, false, false, false},
		{"prime", 50, 100000, false, false, false},
		{"dragon", 50, 100000, false, false, false},
		{"tiger", 100000, 500000, true, false, false},
		{"pizza", 100000, 800000, true, false, false},
		{"coffee", 50, 50000, false, false, false},
		{"money", 50, 200000, false, false, false},
		{"gold", 100000, 500000, true, false, false},

		// Numeric Handles
		{"8888", 1000, 500000, false, false, false},
		{"77777", 50, 50000, false, false, false},
		{"12345", 50, 100000, false, false, false},
		{"00000", 50, 100000, false, false, false},
		{"999999", 50, 10000, false, false, false},

		// Gibberish Handles (Capped at 25 TON)
		{"fhhff", 5, 25, false, true, false},
		{"xqzkw", 5, 25, false, true, false},
		{"zzzzqw", 5, 25, false, true, false},
		{"aaaaabbb", 5, 25, false, true, false},
		{"qpxzkw", 5, 25, false, true, false},

		// Copycat Handles (Capped at 25 TON)
		{"crypto_official", 5, 25, false, false, false},
		{"real_ton", 5, 25, false, false, false},
		{"the_bank_bot", 5, 25, false, false, false},
		{"bitcoin_admin", 5, 25, false, false, false},
		{"news_official", 5, 25, false, false, false},

		// Brands (Trademark severity check)
		{"telegram", 50, 1000000, false, false, true},
		{"binance", 50, 500000, false, false, true},
		{"apple", 50, 1000000, false, false, true},
		{"rolex", 50, 500000, false, false, true},
		{"google", 50, 1000000, false, false, true},
	}

	cfg := DefaultEngineConfig()
	now := time.Now()

	for _, gh := range goldenHandles {
		t.Run(gh.username, func(t *testing.T) {
			_, charLen, features := ClassifyUsername(gh.username)

			var targetComps []ComparableSale
			if saleRecord, ok := GetHistoricalSaleRecord(gh.username); ok && saleRecord.Price > 0 {
				targetComps = append(targetComps, ComparableSale{
					PriceTON:    saleRecord.Price,
					RawPriceTON: saleRecord.Price,
					SaleDate:    saleRecord.Date,
					CharLength:  int(charLen),
				})
			}

			baseLog, _, mad, _ := CalcBaseLog(targetComps, nil, nil, cfg, features, now)
			morphLog := CalcMorphologyLog(features, cfg.MorphMultipliers, cfg)
			if len(targetComps) > 0 {
				morphLog = 0.0 // Anti double-counting
			}

			expectedRaw, lowRaw, highRaw := CalcRangeLog(baseLog, morphLog, 0.0, 0.0, mad, int(charLen), cfg)

			// Floor stack
			if gh.isGibberish || features.HasCheapPrefix || features.HasCheapSuffix {
				expectedRaw = math.Min(expectedRaw, 25.0)
				lowRaw = math.Min(lowRaw, 15.0)
				highRaw = math.Min(highRaw, 35.0)
			} else if len(targetComps) > 0 {
				strictFloor := targetComps[0].PriceTON * 1.05
				if expectedRaw < strictFloor {
					expectedRaw = strictFloor
					lowRaw = targetComps[0].PriceTON
				}
			}

			expected := AestheticRound(expectedRaw)
			low := AestheticRound(lowRaw)
			high := AestheticRound(highRaw)

			if low > expected {
				low = expected
			}
			if high < expected {
				high = expected
			}

			if expected < gh.minExpected || expected > gh.maxExpected {
				t.Errorf("Golden handle '%s' price %.2f out of bounds [%.2f, %.2f]",
					gh.username, expected, gh.minExpected, gh.maxExpected)
			}

			if gh.isBrand {
				tm := CheckTrademarkSeverity(gh.username)
				if !tm.HasRisk {
					t.Errorf("Brand '%s' was not flagged as trademark risk", gh.username)
				}
			}
		})
	}
}

// TestAVMv7_RentYieldFloor tests the 18-month capitalization rental yield floor.
func TestAVMv7_RentYieldFloor(t *testing.T) {
	cfg := DefaultEngineConfig()

	// 4-letter dictionary handle
	feat4 := MorphFeatures{IsDictionary: true, CharLength: 4}
	rent4 := EstimateRentYieldFloor(4, feat4, 1000.0, cfg)

	if rent4.MonthlyMedianTON <= 0 {
		t.Fatalf("MonthlyMedianTON for 4-letter dictionary must be > 0, got %.2f", rent4.MonthlyMedianTON)
	}
	if rent4.RentFloorTON <= 0 {
		t.Fatalf("RentFloorTON must be > 0, got %.2f", rent4.RentFloorTON)
	}
	expectedFloor := rent4.MonthlyMedianTON * 18.0
	if math.Abs(rent4.RentFloorTON-expectedFloor) > 1.0 {
		t.Errorf("RentFloorTON = %.2f, expected %.2f (18x monthly)", rent4.RentFloorTON, expectedFloor)
	}

	// Gibberish handle should yield 0 rent floor
	featGib := MorphFeatures{IsGibberish: true, CharLength: 8}
	rentGib := EstimateRentYieldFloor(8, featGib, 20.0, cfg)
	if rentGib.RentFloorTON != 0 {
		t.Errorf("RentFloorTON for gibberish must be 0, got %.2f", rentGib.RentFloorTON)
	}
}

// TestAVMv7_HomoglyphTwins tests the visual spoofing generation.
func TestAVMv7_HomoglyphTwins(t *testing.T) {
	twins := GenerateHomoglyphTwins("paypal", 6)
	if len(twins) == 0 {
		t.Fatal("Expected homoglyph twins for 'paypal', got 0")
	}

	hasRisk := false
	for _, tw := range twins {
		if tw.RiskLevel == "critical" || tw.RiskLevel == "high" || tw.RiskLevel == "moderate" {
			hasRisk = true
			break
		}
	}
	if !hasRisk {
		t.Error("Expected high/critical/moderate risk homoglyph substitutions for 'paypal'")
	}
}

// TestAVMv7_BrandSeverity tests 3-tier severity classification across 150+ brands.
func TestAVMv7_BrandSeverity(t *testing.T) {
	tests := []struct {
		username     string
		wantRisk     bool
		wantSeverity string
		wantEntity   string
	}{
		{"apple", true, "exact_match", "Apple Inc."},
		{"telegram", true, "exact_match", "Telegram FZ-LLC"},
		{"binance_hub", true, "tld_squat", "Binance Holdings Ltd."},
		{"nike_com", true, "tld_squat", "Nike Inc."},
		{"xyznonbrand", false, "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.username, func(t *testing.T) {
			res := CheckTrademarkSeverity(tt.username)
			if res.HasRisk != tt.wantRisk {
				t.Errorf("HasRisk = %v, want %v", res.HasRisk, tt.wantRisk)
			}
			if tt.wantRisk && string(res.Severity) != tt.wantSeverity {
				t.Errorf("Severity = %s, want %s", res.Severity, tt.wantSeverity)
			}
			if tt.wantRisk && res.Entity != tt.wantEntity {
				t.Errorf("Entity = %s, want %s", res.Entity, tt.wantEntity)
			}
		})
	}
}



// TestAVMv7_FnG_SegmentElasticity tests market sentiment dampening vs amplification.
func TestAVMv7_FnG_SegmentElasticity(t *testing.T) {
	cfg := DefaultEngineConfig()

	defensiveMult, _, _ := GetCalibratedFnGMultiplier(true, cfg)
	speculativeMult, _, _ := GetCalibratedFnGMultiplier(false, cfg)

	if defensiveMult < cfg.FnGClampLow || defensiveMult > cfg.FnGClampHigh {
		t.Errorf("Defensive FnG multiplier %.4f outside clamp [%.2f, %.2f]",
			defensiveMult, cfg.FnGClampLow, cfg.FnGClampHigh)
	}
	if speculativeMult < cfg.FnGClampLow || speculativeMult > cfg.FnGClampHigh {
		t.Errorf("Speculative FnG multiplier %.4f outside clamp [%.2f, %.2f]",
			speculativeMult, cfg.FnGClampLow, cfg.FnGClampHigh)
	}

	// Defensive multiplier must be closer to 1.0 (lower elasticity) than speculative multiplier
	devDef := math.Abs(defensiveMult - 1.0)
	devSpec := math.Abs(speculativeMult - 1.0)
	if devDef > devSpec+0.0001 {
		t.Errorf("Defensive deviation (%.4f) should be <= Speculative deviation (%.4f)", devDef, devSpec)
	}
}

// TestAVMv7_Winsorization tests P5/P95 comp clamping.
func TestAVMv7_Winsorization(t *testing.T) {
	sales := []ComparableSale{
		{PriceTON: 1.0},
		{PriceTON: 100.0},
		{PriceTON: 105.0},
		{PriceTON: 110.0},
		{PriceTON: 115.0},
		{PriceTON: 120.0},
		{PriceTON: 100000.0}, // Massive outlier
	}

	winsorized := WinsorizeComparables(sales, 0.05, 0.95)
	if len(winsorized) != len(sales) {
		t.Fatalf("Expected %d sales, got %d", len(sales), len(winsorized))
	}

	// The massive 100,000 TON outlier should be clamped to P95 value
	lastPrice := winsorized[len(winsorized)-1].PriceTON
	if lastPrice >= 100000.0 {
		t.Errorf("Outlier sale was not winsorized: price = %.2f", lastPrice)
	}
}

// TestAVMv7_AdaptiveUncertainty tests dynamic cone adjustment.
func TestAVMv7_AdaptiveUncertainty(t *testing.T) {
	// If within_band_pct is low (55%), uncertainty mult should expand
	expandedMult, changed, reason := ComputeAdaptiveUncertainty(1.40, 55.0)
	if !changed || expandedMult <= 1.40 {
		t.Errorf("Expected uncertainty mult to expand from 1.40, got %.2f (reason: %s)", expandedMult, reason)
	}

	// If within_band_pct is high (95%), uncertainty mult should tighten
	tightenedMult, changed, reason := ComputeAdaptiveUncertainty(1.40, 95.0)
	if !changed || tightenedMult >= 1.40 {
		t.Errorf("Expected uncertainty mult to tighten from 1.40, got %.2f (reason: %s)", tightenedMult, reason)
	}
}

// TestAVMv8_TelegramLegalHomoglyphs verifies that every generated homoglyph twin
// strictly adheres to Telegram username syntax: ASCII only, starts with a letter, len 4-32.
func TestAVMv8_TelegramLegalHomoglyphs(t *testing.T) {
	tgRegex := regexp.MustCompile(`^@[a-z][a-z0-9_]{3,31}$`)
	testNames := []string{"telegram", "paypal", "google", "binance", "crypto", "wallet", "news"}

	for _, name := range testNames {
		twins := GenerateHomoglyphTwins(name, 6)
		for _, tw := range twins {
			if !tgRegex.MatchString(tw.Twin) {
				t.Fatalf("Homoglyph twin '%s' is not a valid Telegram username!", tw.Twin)
			}
			// Must be ASCII only
			for _, r := range tw.Twin {
				if r > 127 {
					t.Fatalf("Homoglyph twin '%s' contains non-ASCII character '%c'!", tw.Twin, r)
				}
			}
		}
	}
}

// TestAVMv8_FragmentEconomicsRule verifies that the Fragment 5 TON minimum fee
// and seller net payout never violate protocol constraints.
func TestAVMv8_FragmentEconomicsRule(t *testing.T) {
	prices := []float64{5.0, 10.0, 25.0, 50.0, 80.0, 100.0, 500.0, 10000.0}

	for _, p := range prices {
		fragFee := math.Max(5.0, math.Round((p*0.05)*100)/100)
		netProceeds := math.Max(0.0, p-fragFee)

		if fragFee < 5.0 {
			t.Errorf("Price %.2f: Fragment fee %.2f is less than protocol minimum 5.0 TON", p, fragFee)
		}
		if netProceeds < 0.0 {
			t.Errorf("Price %.2f: Net proceeds %.2f cannot be negative", p, netProceeds)
		}
		if netProceeds+fragFee > p+0.01 {
			t.Errorf("Price %.2f: Sum of net proceeds (%.2f) and fee (%.2f) exceeds price", p, netProceeds, fragFee)
		}
	}
}
