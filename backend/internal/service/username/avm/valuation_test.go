package avm

import (
	"testing"
)

func TestClassifyUsername(t *testing.T) {
	tests := []struct {
		name        string
		username    string
		wantSegment string
		wantLen     int16
		wantNumbers bool
		wantUndscr  bool
	}{
		{"pure_alpha", "crypto", "alpha", 6, false, false},
		{"pure_numeric", "12345", "numeric", 5, true, false},
		{"mixed", "abc123", "mixed", 6, true, false},
		{"underscore", "my_name", "underscore", 7, false, true},
		{"underscore_with_nums", "a_1b", "underscore", 4, true, true},
		{"short_4", "gold", "alpha", 4, false, false},
		{"short_5", "money", "alpha", 5, false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			seg, cLen, feat := ClassifyUsername(tt.username)
			if seg != tt.wantSegment {
				t.Errorf("segment = %q, want %q", seg, tt.wantSegment)
			}
			if cLen != tt.wantLen {
				t.Errorf("charLen = %d, want %d", cLen, tt.wantLen)
			}
			if feat.HasNumbers != tt.wantNumbers {
				t.Errorf("HasNumbers = %v, want %v", feat.HasNumbers, tt.wantNumbers)
			}
			if feat.HasUnderscore != tt.wantUndscr {
				t.Errorf("HasUnderscore = %v, want %v", feat.HasUnderscore, tt.wantUndscr)
			}
		})
	}
}

func TestClassifyUsername_Dictionary(t *testing.T) {
	_, _, feat := ClassifyUsername("crypto")
	if !feat.IsDictionary {
		t.Error("'crypto' should be classified as dictionary word")
	}

	_, _, feat2 := ClassifyUsername("xyzqwk")
	if feat2.IsDictionary {
		t.Error("'xyzqwk' should NOT be a dictionary word")
	}
}

func TestCalcConfidenceScore(t *testing.T) {
	tests := []struct {
		name        string
		nEff        float64
		saleCount   int
		mad         float64
		hasMomentum bool
		wantMin     int16
		wantMax     int16
	}{
		{"no_data", 0, 0, 0, false, 35, 40},
		{"minimal", 1, 1, 1.5, false, 35, 45},
		{"moderate", 8, 15, 0.4, true, 40, 70},
		{"strong", 25, 60, 0.15, true, 85, 100},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := CalcConfidenceScore(tt.nEff, tt.saleCount, tt.mad, tt.hasMomentum)
			if score < tt.wantMin || score > tt.wantMax {
				t.Errorf("confidence = %d, want [%d, %d]", score, tt.wantMin, tt.wantMax)
			}
		})
	}
}

func TestIsGibberishString(t *testing.T) {
	if !IsGibberishString("fhhff", false, 0, 0.20) {
		t.Error("'fhhff' should be classified as gibberish")
	}
	if !IsGibberishString("xqzkw", false, 0, 0.10) {
		t.Error("'xqzkw' should be classified as gibberish")
	}
	if IsGibberishString("rare", true, 2660, 0.90) {
		t.Error("'rare' should NOT be classified as gibberish")
	}
}

func TestCalculateSemanticKNNFloor(t *testing.T) {
	// @rare should get high KNN floor (100k - 150k TON)
	rareFeat := MorphFeatures{
		IsDictionary:  true,
		SemanticScore: 85,
		IsGibberish:   false,
	}
	semRes := &SemanticResult{
		TotalScore: 85,
		Tags:       []string{"exclusivity_status_premium"},
	}

	floor := CalculateSemanticKNNFloor("rare", rareFeat, semRes)
	if floor < 100000 || floor > 160000 {
		t.Errorf("KNN floor for 'rare' = %f, expected between 100000 and 160000", floor)
	}

	// @fhhff should get 0 KNN floor (gibberish protection)
	gibberishFeat := MorphFeatures{
		IsDictionary:  false,
		SemanticScore: 10,
		IsGibberish:   true,
	}
	gibberishSem := &SemanticResult{
		TotalScore: 10,
		Tags:       []string{},
	}
	fhhffFloor := CalculateSemanticKNNFloor("fhhff", gibberishFeat, gibberishSem)
	if fhhffFloor != 0 {
		t.Errorf("KNN floor for gibberish 'fhhff' = %f, expected 0", fhhffFloor)
	}

	// @cats and @dogs should get 0 KNN floor (rely on historical benchmark ~12.5k TON, not 110k floor)
	commonFeat := MorphFeatures{
		IsDictionary:  true,
		SemanticScore: 60,
		IsGibberish:   false,
	}
	commonSem := &SemanticResult{
		TotalScore: 60,
		Tags:       []string{"animal", "noun"},
	}
	catsFloor := CalculateSemanticKNNFloor("cats", commonFeat, commonSem)
	if catsFloor != 0 {
		t.Errorf("KNN floor for common noun 'cats' = %f, expected 0", catsFloor)
	}

	dogsFloor := CalculateSemanticKNNFloor("dogs", commonFeat, commonSem)
	if dogsFloor != 0 {
		t.Errorf("KNN floor for common noun 'dogs' = %f, expected 0", dogsFloor)
	}
}

func TestValuationEngine_CatsAndRare(t *testing.T) {
	svc := NewValuationService(nil, nil, nil)
	cfg := DefaultEngineConfig()
	
	// 1. Check scoreToMultiplier for 4-letter status word (e.g. rare)
	rareMult := svc.semanticEngine.scoreToMultiplier(92, 4, []string{"exclusivity_status_premium"}, true)
	estimatedRare := cfg.FallbackLen4 * rareMult
	if estimatedRare < 100000 || estimatedRare > 150000 {
		t.Errorf("Estimated price for 'rare' = %f, expected between 100000 and 150000", estimatedRare)
	}

	// 2. Check cats multiplier calculation
	catsMult := svc.semanticEngine.scoreToMultiplier(67, 4, []string{"noun"}, true)
	estimatedCats := cfg.FallbackLen4 * catsMult
	if estimatedCats < 10000 || estimatedCats > 15000 {
		t.Errorf("Estimated price for 'cats' = %f, expected between 10000 and 15000", estimatedCats)
	}
}

func TestValuationEngine_CompoundRatioAndEcosystem(t *testing.T) {
	svc := NewValuationService(nil, nil, nil)

	// 1. Single Pure Word vs Compound Word ratio
	cryptoMult := svc.semanticEngine.scoreToMultiplier(95, 6, []string{"crypto_ultra_premium"}, true)
	compoundMult := svc.semanticEngine.scoreToMultiplier(95, 10, []string{"crypto_ultra_premium", "compound_word"}, false)

	if compoundMult >= cryptoMult {
		t.Errorf("Compound word multiplier (%f) should be significantly lower than pure word multiplier (%f)", compoundMult, cryptoMult)
	}

	// 2. Telegram System Handle Anchor (@wallet)
	walletPrice, ok := HistoricalSales["wallet"]
	if !ok || walletPrice < 500000 {
		t.Errorf("Official system handle 'wallet' should be anchored >= 500000 TON, got %f", walletPrice)
	}

	// 3. Telegram Ecosystem Tag (@notcoin, @major)
	notcoinPrice, ok := HistoricalSales["notcoin"]
	if !ok || notcoinPrice < 100000 {
		t.Errorf("Ecosystem handle 'notcoin' should be anchored >= 100000 TON, got %f", notcoinPrice)
	}
}

func TestValuationEngine_MultiTierBenchmarks(t *testing.T) {
	svc := NewValuationService(nil, nil, nil)
	cfg := DefaultEngineConfig()

	// 1. 5-letter common noun (@money, @tesla) -> ~2,000 - 8,000 TON
	moneyMult := svc.semanticEngine.scoreToMultiplier(75, 5, []string{"general_ultra_premium"}, true)
	moneyPrice := cfg.FallbackLen5 * moneyMult
	if moneyPrice < 2000 || moneyPrice > 10000 {
		t.Errorf("5-letter term 'money' price = %f, expected between 2000 and 10000", moneyPrice)
	}

	// 2. Gibberish protection (@xqzkw) -> < 100 TON
	gibberishMult := svc.semanticEngine.scoreToMultiplier(10, 5, []string{}, false)
	gibberishPrice := cfg.FallbackLen5 * gibberishMult
	if gibberishPrice > 100 {
		t.Errorf("Gibberish term 'xqzkw' price = %f, expected < 100 TON", gibberishPrice)
	}

	// 3. 3-letter ultra status (@vip) -> > 50x multiplier
	vipMult := svc.semanticEngine.scoreToMultiplier(90, 3, []string{"exclusivity_status_premium"}, true)
	if vipMult < 50 {
		t.Errorf("3-letter status term 'vip' multiplier (%f) should yield high value", vipMult)
	}
}


