package nvengine

import (
	"context"
	"strings"
	"testing"

	"ifragment-backend/internal/service/numbers/features"
)

func TestNVEngineV8_BinaryBCDAndTVMBOCForensics(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	// 1. Test +888 8888 0000 (Pure MSB 8/0 BCD Wave)
	val, err := engine.Valuate(ctx, "+888 8888 0000")
	if err != nil {
		t.Fatalf("Valuate failed: %v", err)
	}
	if val.BinaryForensics == nil {
		t.Fatalf("expected non-nil BinaryForensics")
	}
	bf := val.BinaryForensics
	if !bf.IsPureMSB80Wave {
		t.Errorf("expected IsPureMSB80Wave=true for +888 8888 0000, got false")
	}
	if bf.BCDHammingWeight != 4 {
		// Four '8's (1000_2 each -> 1 bit) + Four '0's (0000_2 each -> 0 bits) = 4 bits total in BCD!
		t.Errorf("expected BCDHammingWeight=4 for 88880000, got %d", bf.BCDHammingWeight)
	}
	if !strings.HasPrefix(bf.TokenNameBOCHex, "0xb5ee9c72") {
		t.Errorf("expected valid TVM BOC header 0xb5ee9c72, got %s", bf.TokenNameBOCHex)
	}
	if !strings.HasPrefix(bf.TEP62IndexSHA256Hex, "0x") || len(bf.TEP62IndexSHA256Hex) != 66 {
		t.Errorf("expected 66-char 0x-prefixed SHA256 hex, got %s", bf.TEP62IndexSHA256Hex)
	}
	if len(bf.DigitsMatrix) != 8 {
		t.Errorf("expected 8 cells in DigitsMatrix, got %d", len(bf.DigitsMatrix))
	}
	// Verify ITU-T Q.23 DTMF frequencies for '8' (852 Hz row, 1336 Hz col) and '0' (941 Hz row, 1336 Hz col)
	if bf.DigitsMatrix[0].DTMFRowHz != 852 || bf.DigitsMatrix[0].DTMFColHz != 1336 {
		t.Errorf("expected '8' DTMF 852+1336Hz, got %d+%dHz", bf.DigitsMatrix[0].DTMFRowHz, bf.DigitsMatrix[0].DTMFColHz)
	}
	if bf.DigitsMatrix[4].DTMFRowHz != 941 || bf.DigitsMatrix[4].DTMFColHz != 1336 {
		t.Errorf("expected '0' DTMF 941+1336Hz, got %d+%dHz", bf.DigitsMatrix[4].DTMFRowHz, bf.DigitsMatrix[4].DTMFColHz)
	}
}

func TestNVEngineV8_FittsLawAndDTMFAcousticConsonance(t *testing.T) {
	// 1. Stationary Monodigit (+888 8888 8888) vs Central Spine (+888 2580 2580) vs Random Jump (+888 1937 0264)
	fvMono, _ := features.ExtractFeatures("+888 8888 8888")
	fvSpine, _ := features.ExtractFeatures("+888 2580 2580")
	fvRand, _ := features.ExtractFeatures("+888 1937 0264")

	if fvMono.DialPad.FittsIndexBits != 0.0 {
		t.Errorf("expected FittsIndexBits=0.0 for stationary monodigit, got %.3f", fvMono.DialPad.FittsIndexBits)
	}
	if fvMono.DialPad.DTMFConsonanceScore < 99.0 {
		t.Errorf("expected DTMFConsonanceScore >= 99.0 for monodigit, got %.1f", fvMono.DialPad.DTMFConsonanceScore)
	}

	// Central spine (2-5-8-0) shares the 1336 Hz column carrier across all 8 digits!
	if fvSpine.DialPad.DTMFConsonanceScore <= fvRand.DialPad.DTMFConsonanceScore {
		t.Errorf("expected 1336Hz spine +888 2580 2580 DTMF consonance (%.1f) > random +888 1937 0264 (%.1f)",
			fvSpine.DialPad.DTMFConsonanceScore, fvRand.DialPad.DTMFConsonanceScore)
	}
	if fvSpine.DialPad.FittsErgonomicScore <= fvRand.DialPad.FittsErgonomicScore {
		t.Errorf("expected spine FittsErgonomicScore (%.1f) > random (%.1f)",
			fvSpine.DialPad.FittsErgonomicScore, fvRand.DialPad.FittsErgonomicScore)
	}
}

func TestNVEngineV8_FullDialPalindromeAndPairProgression(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	// 1. Full-11-digit E.164 Palindrome: +888 1232 1888 -> "88812321888" is a palindrome!
	valFullPal, err := engine.Valuate(ctx, "+888 1232 1888")
	if err != nil {
		t.Fatalf("failed on +888 1232 1888: %v", err)
	}
	if !valFullPal.Features.IsFullDialPalindrome {
		t.Errorf("expected IsFullDialPalindrome=true for +888 1232 1888")
	}
	if valFullPal.Features.EchoHarmonics != "FULL_DIAL_PALINDROME_888" {
		t.Errorf("expected EchoHarmonics=FULL_DIAL_PALINDROME_888, got %s", valFullPal.Features.EchoHarmonics)
	}

	// Compare against non-palindromic triple-888 tail (+888 1239 1888)
	valNonPal, _ := engine.Valuate(ctx, "+888 1239 1888")
	expFullPal, _ := valFullPal.ExpectedTON.Float64()
	expNonPal, _ := valNonPal.ExpectedTON.Float64()
	if expFullPal <= expNonPal {
		t.Errorf("expected Full-11-Digit Palindrome +888 1232 1888 (%.2f TON) > non-palindrome +888 1239 1888 (%.2f TON)",
			expFullPal, expNonPal)
	}

	// 2. Arithmetic 2-Digit Pair Progression: +888 1020 3040 vs Random +888 1029 3847
	valPairProg, err := engine.Valuate(ctx, "+888 1020 3040")
	if err != nil {
		t.Fatalf("failed on +888 1020 3040: %v", err)
	}
	if !valPairProg.Features.HasPairProgression {
		t.Errorf("expected HasPairProgression=true for +888 1020 3040")
	}
	valRandom, _ := engine.Valuate(ctx, "+888 1029 3847")
	expPair, _ := valPairProg.ExpectedTON.Float64()
	expRand, _ := valRandom.ExpectedTON.Float64()
	if expPair <= expRand*1.8 {
		t.Errorf("expected Pair Progression +888 1020 3040 (%.2f TON) > 1.8x random +888 1029 3847 (%.2f TON)",
			expPair, expRand)
	}

	// 3. Dual Mirror Block ABBA_ABBA: +888 8008 8008
	valABBA, _ := engine.Valuate(ctx, "+888 8008 8008")
	if valABBA.Features.RepeatedBlock != "ABBA_ABBA" {
		t.Errorf("expected RepeatedBlock=ABBA_ABBA for +888 8008 8008, got %s", valABBA.Features.RepeatedBlock)
	}
	expABBA, _ := valABBA.ExpectedTON.Float64()
	if expABBA < 20000.0 {
		t.Errorf("expected Dual Mirror +888 8008 8008 >= 20,000 TON, got %.2f TON", expABBA)
	}
}

func TestNVEngineV8_LayaSystemOneMultiRegionalDifferentiation(t *testing.T) {
	engine := NewValuationEngine(nil, nil, nil)
	ctx := context.Background()

	// 1. Auspicious Chinese 8-rich number (+888 0888 8888) vs Tetraphobic 4-rich number (+888 0444 4414)
	val8, _ := engine.Valuate(ctx, "+888 0888 8888")
	val4, _ := engine.Valuate(ctx, "+888 0444 4414")

	if val8.LayaSystemOne == nil || val4.LayaSystemOne == nil {
		t.Fatalf("expected non-nil LayaSystemOne on NumberValuation")
	}
	if val8.LayaSystemOne.ScoreChina <= val4.LayaSystemOne.ScoreChina+25 {
		t.Errorf("expected +888 0888 8888 ScoreChina (%d) >> +888 0444 4414 ScoreChina (%d)",
			val8.LayaSystemOne.ScoreChina, val4.LayaSystemOne.ScoreChina)
	}
	if val8.LayaSystemOne.DecisionMultiplier <= val4.LayaSystemOne.DecisionMultiplier {
		t.Errorf("expected +888 0888 8888 DecisionMultiplier (%.3f) > +888 0444 4414 (%.3f)",
			val8.LayaSystemOne.DecisionMultiplier, val4.LayaSystemOne.DecisionMultiplier)
	}

	// 2. 0-Prefixed 7-Run Sovereign Grail (+888 0888 8888) vs 7-Run of 4s (+888 0444 4444)
	val0444, _ := engine.Valuate(ctx, "+888 0444 4444")
	exp0888, _ := val8.ExpectedTON.Float64()
	exp0444, _ := val0444.ExpectedTON.Float64()
	if exp0888 <= exp0444*1.35 {
		t.Errorf("expected +888 0888 8888 (%.2f TON) > 1.35x +888 0444 4444 (%.2f TON)", exp0888, exp0444)
	}
}

