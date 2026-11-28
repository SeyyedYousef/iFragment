package avm

import (
	"context"
	"testing"
	"time"
)

func TestOverhaul_TypoAndPhoneticShadowHierarchy(t *testing.T) {
	DisableDatamuseNetwork = true
	defer func() { DisableDatamuseNetwork = false }()

	svc := NewValuationService(nil, nil, nil)
	ctx := context.Background()

	pairs := []struct {
		canonical   string
		shadow      string
		minCanonTON float64
		maxShadow   float64
	}{
		{"miner", "mainer", 70000.0, 200.0},
		{"wallet", "walet", 500000.0, 280.0},
		{"crypto", "krypto", 150000.0, 200.0},
		{"bitcoin", "bitcon", 100000.0, 200.0},
		{"market", "markit", 50000.0, 200.0},
	}

	for _, p := range pairs {
		shadowCheck := DetectTypoOrPhoneticShadow(p.shadow)
		if !shadowCheck.IsShadow {
			t.Fatalf("expected @%s to be detected as typo/phonetic shadow of @%s, got IsShadow=false", p.shadow, p.canonical)
		}
		if DetectTypoOrPhoneticShadow(p.canonical).IsShadow {
			t.Fatalf("canonical flagship @%s must NEVER be flagged as a typo shadow", p.canonical)
		}

		resCanon, err := svc.Valuate(ctx, p.canonical, 1.0)
		if err != nil {
			t.Fatalf("Valuate(%q) failed: %v", p.canonical, err)
		}
		resShadow, err := svc.Valuate(ctx, p.shadow, 1.0)
		if err != nil {
			t.Fatalf("Valuate(%q) failed: %v", p.shadow, err)
		}

		canonTON, _ := resCanon.ExpectedTON.Float64()
		shadowTON, _ := resShadow.ExpectedTON.Float64()

		if canonTON < p.minCanonTON {
			t.Errorf("canonical @%s ExpectedTON = %.2f, want >= %.2f", p.canonical, canonTON, p.minCanonTON)
		}
		if shadowTON > p.maxShadow {
			t.Errorf("shadow @%s ExpectedTON = %.2f, want <= %.2f", p.shadow, shadowTON, p.maxShadow)
		}
		if canonTON < shadowTON*100.0 {
			t.Errorf("expected massive valuation gap between @%s (%.2f) and shadow @%s (%.2f)", p.canonical, canonTON, p.shadow, shadowTON)
		}
		if resShadow.PhishingThreat == nil || !resShadow.PhishingThreat.HasThreat {
			t.Errorf("expected PhishingThreat warning on shadow @%s", p.shadow)
		}
	}

	// Ensure clean English plurals are NOT misclassified as extra-char typos
	for _, plural := range []string{"miners", "wallets", "traders", "holders"} {
		if res := DetectTypoOrPhoneticShadow(plural); res.IsShadow {
			t.Errorf("legitimate plural @%s was falsely flagged as typo shadow (%s of @%s)", plural, res.ShadowType, res.CanonicalWord)
		}
	}
}

func TestOverhaul_TetherAnchorAndMADConeBound(t *testing.T) {
	DisableDatamuseNetwork = true
	defer func() { DisableDatamuseNetwork = false }()

	svc := NewValuationService(nil, nil, nil)
	ctx := context.Background()

	// 1. @tether must reflect flagship Web3 anchor (>= 180,000 TON)
	resTether, err := svc.Valuate(ctx, "tether", 1.0)
	if err != nil {
		t.Fatalf("Valuate('tether') failed: %v", err)
	}
	tetherTON, _ := resTether.ExpectedTON.Float64()
	if tetherTON < 180000.0 {
		t.Errorf("expected @tether >= 180,000 TON, got %.2f", tetherTON)
	}

	// 2. Extreme MAD dispersion (e.g. mad=3.0 on @smart) must never explode HighTON > 2.2x ExpectedTON
	cfg := DefaultEngineConfig()
	now := time.Now()
	_, charLen, feat := ClassifyUsername("smart")
	baseLog, _, _, _ := CalcBaseLog(nil, nil, nil, cfg, feat, now)
	exp, low, high := CalcRangeLog(baseLog, 0, 0, 0, 3.0, int(charLen), cfg)
	if high > exp*2.0 || low < exp*0.45 {
		t.Errorf("MAD cone bound failed for mad=3.0: low=%.2f exp=%.2f high=%.2f", low, exp, high)
	}
}
