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
	// @rare should get high 5D KNN floor (> 100,000 TON)
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
	if floor < 100000 {
		t.Errorf("KNN floor for 'rare' = %f, expected > 100000 TON", floor)
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

	// @cats and @dogs should receive valid grounded KNN estimates (> 10,000 TON)
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
	if catsFloor < 10000 {
		t.Errorf("KNN floor for common noun 'cats' = %f, expected > 10000 TON", catsFloor)
	}

	dogsFloor := CalculateSemanticKNNFloor("dogs", commonFeat, commonSem)
	if dogsFloor < 10000 {
		t.Errorf("KNN floor for common noun 'dogs' = %f, expected > 10000 TON", dogsFloor)
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

	// 1. 5-letter common noun (@money, @tesla) -> ~10,000 - 100,000 TON
	moneyMult := svc.semanticEngine.scoreToMultiplier(75, 5, []string{"general_ultra_premium"}, true)
	moneyPrice := cfg.FallbackLen5 * moneyMult
	if moneyPrice < 10000 || moneyPrice > 100000 {
		t.Errorf("5-letter term 'money' price = %f, expected between 10000 and 100000", moneyPrice)
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

func TestValuationEngine_UserCustomParameters(t *testing.T) {
	// 1. Check famous personal names (@alex, @john) -> ~25,000 - 35,000 TON
	alexPrice, ok1 := HistoricalSales["alex"]
	johnPrice, ok2 := HistoricalSales["john"]
	if !ok1 || !ok2 {
		t.Fatal("alex or john missing from HistoricalSales")
	}
	// Appreciated 3.7 yrs @ 20% = ~1.975x
	appreciatedAlex := alexPrice * 1.975
	appreciatedJohn := johnPrice * 1.975

	if appreciatedAlex < 25000 || appreciatedAlex > 35000 {
		t.Errorf("Appreciated price for @alex = %f, expected between 25000 and 35000", appreciatedAlex)
	}
	if appreciatedJohn < 25000 || appreciatedJohn > 35000 {
		t.Errorf("Appreciated price for @john = %f, expected between 25000 and 35000", appreciatedJohn)
	}

	// 2. Check mid-tier generic (@work) -> > 100,000 TON
	workPrice, ok3 := HistoricalSales["work"]
	if !ok3 {
		t.Fatal("work missing from HistoricalSales")
	}
	appreciatedWork := workPrice * 1.975
	if appreciatedWork < 100000 {
		t.Errorf("Appreciated price for @work = %f, expected > 100,000 TON", appreciatedWork)
	}

	// 3. Check ultra-top generic (@news, @bank) -> > 1,000,000 TON
	newsPrice, ok4 := HistoricalSales["news"]
	bankPrice, ok5 := HistoricalSales["bank"]
	if !ok4 || !ok5 {
		t.Fatal("news or bank missing from HistoricalSales")
	}
	appreciatedNews := newsPrice * 1.975
	appreciatedBank := bankPrice * 1.975

	if appreciatedNews < 1000000 {
		t.Errorf("Appreciated price for @news = %f, expected > 1,000,000 TON", appreciatedNews)
	}
	if appreciatedBank < 1000000 {
		t.Errorf("Appreciated price for @bank = %f, expected > 1,000,000 TON", appreciatedBank)
	}

	// 3. Underscore penalty (50% - 70% drop)
	cfg := DefaultEngineConfig()
	undMult := cfg.MorphMultipliers["has_underscore"]
	if undMult < 0.30 || undMult > 0.50 {
		t.Errorf("has_underscore multiplier (%f) should represent 50%% - 70%% penalty", undMult)
	}

	// 4. Fake prefix penalty (80% - 85% drop)
	fakeMult := cfg.MorphMultipliers["fake_prefix"]
	if fakeMult < 0.15 || fakeMult > 0.25 {
		t.Errorf("fake_prefix multiplier (%f) should represent 75%% - 85%% penalty", fakeMult)
	}
}

func TestRareUsernameValuationRegression(t *testing.T) {
	// 1. Check frequency rank for "rare"
	rank := RankWord("rare")
	if rank == 0 {
		t.Error("'rare' should exist in wordFrequencyRank with non-zero rank")
	}

	// 2. Check historical sales anchor for "rare"
	rarePrice, ok := HistoricalSales["rare"]
	if !ok || rarePrice < 100000 {
		t.Errorf("Historical sales anchor for 'rare' missing or < 100000 TON, got %f", rarePrice)
	}
}

