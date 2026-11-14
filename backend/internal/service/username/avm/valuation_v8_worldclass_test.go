package avm

import (
	"context"
	"math"
	"strings"
	"testing"
	"time"

	"ifragment-backend/internal/client/marketapp"
)

func TestViterbiWordSegmentation(t *testing.T) {
	cases := []struct {
		username        string
		wantTokens      []string
		wantCompound    bool
		minCoverage     float64
	}{
		{"crypto", []string{"crypto"}, false, 1.0},
		{"cryptoking", []string{"crypto", "king"}, true, 1.0},
		{"web3pay", []string{"web3", "pay"}, true, 1.0},
		{"telegramwalletbot", []string{"telegram", "wallet", "bot"}, true, 1.0},
		{"xqzkw", []string{"xqzkw"}, false, 0.0},
	}

	for _, tc := range cases {
		seg := ViterbiSegmentUsername(tc.username)
		if seg.IsCleanCompound != tc.wantCompound {
			t.Errorf("ViterbiSegmentUsername(%q).IsCleanCompound = %v, want %v (tokens=%v)",
				tc.username, seg.IsCleanCompound, tc.wantCompound, seg.Tokens)
		}
		if seg.CoverageRatio < tc.minCoverage {
			t.Errorf("ViterbiSegmentUsername(%q).CoverageRatio = %.2f, want >= %.2f",
				tc.username, seg.CoverageRatio, tc.minCoverage)
		}
		if strings.Join(seg.Tokens, "|") != strings.Join(tc.wantTokens, "|") {
			t.Errorf("ViterbiSegmentUsername(%q).Tokens = %v, want %v",
				tc.username, seg.Tokens, tc.wantTokens)
		}
	}
}

func TestDecodeLeetSmart_PreservesTechTokens(t *testing.T) {
	if got := DecodeLeetSmart("web3"); got != "web3" {
		t.Errorf("DecodeLeetSmart(\"web3\") = %q, want \"web3\"", got)
	}
	if got := DecodeLeetSmart("p2p"); got != "p2p" {
		t.Errorf("DecodeLeetSmart(\"p2p\") = %q, want \"p2p\"", got)
	}
	if got := DecodeLeetSmart("l2"); got != "l2" {
		t.Errorf("DecodeLeetSmart(\"l2\") = %q, want \"l2\"", got)
	}
	if got := DecodeLeetSmart("c4sh"); got != "cash" {
		t.Errorf("DecodeLeetSmart(\"c4sh\") = %q, want \"cash\"", got)
	}
}

func TestBiomechanicalFittsAndKerning(t *testing.T) {
	// "ton": t(L) -> o(R) -> n(R), short & fast
	fittsTon, ergoTon, altTon := ComputeFittsBiomechanics("ton")
	// "qwert_zxc_1": long, same-hand runs + underscore layer switches
	fittsAwk, ergoAwk, _ := ComputeFittsBiomechanics("qwert_zxc_1")

	if ergoTon <= ergoAwk {
		t.Errorf("Expected ergonomic score of 'ton' (%.3f) > 'qwert_zxc_1' (%.3f)", ergoTon, ergoAwk)
	}
	if fittsTon >= fittsAwk {
		t.Errorf("Expected Fitts ID of 'ton' (%.2f bits) < 'qwert_zxc_1' (%.2f bits)", fittsTon, fittsAwk)
	}
	if altTon <= 0 {
		t.Errorf("Expected positive hand alternation for 'ton', got %d%%", altTon)
	}

	// Optical kerning symmetry: "otto" (symmetric glyph widths) vs "mwil" (extreme width disparity)
	symOtto := ComputeOpticalKerningSymmetry("otto")
	symMwil := ComputeOpticalKerningSymmetry("mwil")
	if symOtto <= symMwil {
		t.Errorf("Expected optical kerning symmetry of 'otto' (%.3f) > 'mwil' (%.3f)", symOtto, symMwil)
	}
}

func TestBinaryAndTVMBOCForensics(t *testing.T) {
	bf, caps := ComputeBinaryAndBiomechanicalForensics("ton")
	if bf == nil || caps == nil {
		t.Fatal("Expected non-nil BinaryForensics and FragmentCapabilities")
	}
	if bf.AsciiHexPayload != "0x746f6e" {
		t.Errorf("Expected AsciiHexPayload 0x746f6e for 'ton', got %s", bf.AsciiHexPayload)
	}
	if bf.ByteLength != 3 || bf.TotalBits != 24 {
		t.Errorf("Expected 3 bytes / 24 bits for 'ton', got %d / %d", bf.ByteLength, bf.TotalBits)
	}
	if !strings.HasPrefix(bf.TvmBocCellHex, "b5ee9c72") {
		t.Errorf("Expected standard TVM BOC magic prefix b5ee9c72, got %s", bf.TvmBocCellHex)
	}
	if len(bf.Tep62IndexSha256) != 66 || !strings.HasPrefix(bf.Tep62IndexSha256, "0x") {
		t.Errorf("Expected 66-char 0x-prefixed SHA-256 index, got %s", bf.Tep62IndexSha256)
	}
	if caps.TonDnsDomain != "ton.t.me" {
		t.Errorf("Expected TonDnsDomain ton.t.me, got %s", caps.TonDnsDomain)
	}
}

func TestDeterministic6DKNN(t *testing.T) {
	_, _, featRare := ClassifyUsername("rare")
	featRare.SemanticScore = 88.0
	semRare := &SemanticResult{
		TotalScore:    88.0,
		WordFreqScore: 85.0,
		WikiScore:     70.0,
		Tags:          []string{"exclusivity_status_premium"},
	}

	firstVal := CalculateSemanticKNNFloor("rare", featRare, semRare)
	if firstVal <= 50000 {
		t.Fatalf("Expected KNN floor for 'rare' > 50,000 TON, got %.2f", firstVal)
	}

	// Run 50 iterations to prove 0% map-order randomness
	for i := 0; i < 50; i++ {
		v := CalculateSemanticKNNFloor("rare", featRare, semRare)
		if math.Abs(v-firstVal) > 1e-9 {
			t.Fatalf("Non-deterministic KNN floor detected on iteration %d: got %.6f, want %.6f", i, v, firstVal)
		}
	}

	// Gibberish must strictly get 0
	_, _, featGib := ClassifyUsername("fhhff")
	if gibFloor := CalculateSemanticKNNFloor("fhhff", featGib, nil); gibFloor != 0 {
		t.Errorf("Expected 0 KNN floor for gibberish 'fhhff', got %.2f", gibFloor)
	}
}

func TestMonotonicBayesianPriorSliding(t *testing.T) {
	cfg := DefaultEngineConfig()
	now := time.Now()

	// Database sample with a low median (~80 TON)
	lowBroad := []ComparableSale{
		{ID: 1, PriceTON: 70, CharLength: 5, SaleDate: now.AddDate(0, 0, -5)},
		{ID: 2, PriceTON: 80, CharLength: 5, SaleDate: now.AddDate(0, 0, -10)},
		{ID: 3, PriceTON: 90, CharLength: 5, SaleDate: now.AddDate(0, 0, -15)},
	}

	lowSemFeatures := MorphFeatures{CharLength: 5, SemanticScore: 15.0}
	highSemFeatures := MorphFeatures{CharLength: 5, SemanticScore: 90.0}

	baseLogLow, _, _, _ := CalcBaseLog(nil, nil, lowBroad, cfg, lowSemFeatures, now)
	baseLogHigh, _, _, _ := CalcBaseLog(nil, nil, lowBroad, cfg, highSemFeatures, now)

	if baseLogHigh <= baseLogLow {
		t.Errorf("Bayesian Prior Sliding inversion bug: SemanticScore=90 produced baseLog=%.4f <= SemanticScore=15 baseLog=%.4f",
			baseLogHigh, baseLogLow)
	}
}

func TestLayaSystemOneWorldClass(t *testing.T) {
	eval := NewLayaUsernameEvaluator()
	ctx := context.Background()

	resCrypto := eval.Evaluate(ctx, "crypto")
	resRare := eval.Evaluate(ctx, "rare")
	resGib := eval.Evaluate(ctx, "xqzkw")

	if resCrypto == nil || resRare == nil || resGib == nil {
		t.Fatal("Expected non-nil LayaUsernameResult for all test handles")
	}

	if resCrypto.CulturalResonance != "web3_crypto" {
		t.Errorf("Expected 'crypto' CulturalResonance=web3_crypto, got %s", resCrypto.CulturalResonance)
	}
	if resRare.CulturalResonance != "luxury_status" {
		t.Errorf("Expected 'rare' CulturalResonance=luxury_status, got %s", resRare.CulturalResonance)
	}
	if resGib.CulturalResonance != "obscure_filler" {
		t.Errorf("Expected gibberish 'xqzkw' CulturalResonance=obscure_filler, got %s", resGib.CulturalResonance)
	}
	if resGib.TotalScore > 25.0 {
		t.Errorf("Expected gibberish 'xqzkw' TotalScore <= 25.0, got %.2f", resGib.TotalScore)
	}
	if resCrypto.TotalScore <= resGib.TotalScore+40.0 {
		t.Errorf("Expected massive Laya score separation between 'crypto' (%.2f) and 'xqzkw' (%.2f)",
			resCrypto.TotalScore, resGib.TotalScore)
	}
}

func TestLiveMarketVanityAskDetection(t *testing.T) {
	vanityItem := &marketapp.ItemData{
		SaleStatus:  "on_sale",
		BuyNowPrice: 500000.0, // 500x fair value
	}
	lmVanity := buildLiveMarket("testword", vanityItem, "on_sale", 1000.0, 5.0)
	if !lmVanity.IsVanityAsk || lmVanity.ArbitrageSignal != "OVERPRICED_VANITY_ASK" {
		t.Errorf("Expected Vanity Ask detection for 500,000 TON ask vs 1,000 TON estimate, got IsVanityAsk=%v Signal=%s",
			lmVanity.IsVanityAsk, lmVanity.ArbitrageSignal)
	}

	bargainItem := &marketapp.ItemData{
		SaleStatus:  "on_sale",
		BuyNowPrice: 650.0, // 35% discount vs fair value
	}
	lmBargain := buildLiveMarket("testword", bargainItem, "on_sale", 1000.0, 5.0)
	if lmBargain.IsVanityAsk || lmBargain.ArbitrageSignal != "UNDERVALUED_BUY_OPPORTUNITY" {
		t.Errorf("Expected UNDERVALUED_BUY_OPPORTUNITY for 650 TON ask vs 1,000 TON estimate, got %s",
			lmBargain.ArbitrageSignal)
	}
}

