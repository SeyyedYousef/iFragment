package features

import (
	"fmt"
	"math/rand"
	"testing"
)

func TestExtractFeatures_ATHNumber(t *testing.T) {
	ath := "+888 8888 8888"
	fv, err := ExtractFeatures(ath)
	if err != nil {
		t.Fatalf("unexpected error for ATH: %v", err)
	}

	if fv.MaxRun != 8 {
		t.Errorf("expected MaxRun 8, got %d", fv.MaxRun)
	}
	if fv.DistinctDigits != 1 {
		t.Errorf("expected DistinctDigits 1, got %d", fv.DistinctDigits)
	}
	if !fv.IsPalindrome {
		t.Errorf("expected ATH to be palindrome")
	}
	if fv.RepeatedBlock != "ALL_SAME" {
		t.Errorf("expected RepeatedBlock ALL_SAME, got %s", fv.RepeatedBlock)
	}
	if fv.TailClass != "QUAD_8888" {
		t.Errorf("expected TailClass QUAD_8888, got %s", fv.TailClass)
	}
	if fv.RarityScore < 95 {
		t.Errorf("expected RarityScore >= 95, got %d", fv.RarityScore)
	}
}

func TestExtractFeatures_Palindrome(t *testing.T) {
	num := "+888 1234 4321"
	fv, err := ExtractFeatures(num)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !fv.IsPalindrome {
		t.Errorf("expected palindrome for %s", num)
	}
	if fv.MirrorScore != 1.0 {
		t.Errorf("expected mirror score 1.0, got %f", fv.MirrorScore)
	}
}

func TestExtractFeatures_MonotonicAsc(t *testing.T) {
	num := "+888 1234 5678"
	fv, err := ExtractFeatures(num)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !fv.HasMonotonicAsc {
		t.Errorf("expected monotonic asc for %s", num)
	}
}

func TestExtractFeatures_500RandomCasesInvariant(t *testing.T) {
	r := rand.New(rand.NewSource(42))

	for i := 0; i < 500; i++ {
		// Generate random 8-digit suffix
		suffix := fmt.Sprintf("%08d", r.Intn(100000000))
		num := "+888" + suffix

		fv, err := ExtractFeatures(num)
		if err != nil {
			t.Fatalf("failed on valid input %s: %v", num, err)
		}

		// Invariant 1: MaxRun must be between 1 and 8
		if fv.MaxRun < 1 || fv.MaxRun > 8 {
			t.Errorf("invariant violated: MaxRun %d out of bounds for %s", fv.MaxRun, num)
		}

		// Invariant 2: DistinctDigits must be between 1 and 8
		if fv.DistinctDigits < 1 || fv.DistinctDigits > 8 {
			t.Errorf("invariant violated: DistinctDigits %d out of bounds for %s", fv.DistinctDigits, num)
		}

		// Invariant 3: Digit frequency sum must equal length (8)
		sumFreq := 0
		for _, f := range fv.DigitFreq {
			sumFreq += f
		}
		if sumFreq != 8 {
			t.Errorf("invariant violated: DigitFreq sum %d != 8 for %s", sumFreq, num)
		}

		// Invariant 4: RarityScore between 5 and 100
		if fv.RarityScore < 5 || fv.RarityScore > 100 {
			t.Errorf("invariant violated: RarityScore %d out of bounds for %s", fv.RarityScore, num)
		}
	}
}

func TestCleanNumber_PersianAndArabicNumerals(t *testing.T) {
	// Persian input: +۸۸۸ ۸۸۸۸ ۸۸۸۸
	persian := "+۸۸۸ ۸۸۸۸ ۸۸۸۸"
	normPersian, err := NormalizeNumber(persian)
	if err != nil {
		t.Fatalf("expected Persian numerals to normalize successfully, got err: %v", err)
	}
	if normPersian != "+88888888888" {
		t.Errorf("expected +88888888888, got %s", normPersian)
	}

	// Arabic-Indic input: +٨٨٨ ١٢٣٤ ٥٦٧٨
	arabic := "+٨٨٨ ١٢٣٤ ٥٦٧٨"
	normArabic, err := NormalizeNumber(arabic)
	if err != nil {
		t.Fatalf("expected Arabic numerals to normalize successfully, got err: %v", err)
	}
	if normArabic != "+88812345678" {
		t.Errorf("expected +88812345678, got %s", normArabic)
	}
}

func TestNormalizeNumber_Comprehensive(t *testing.T) {
	testCases := []struct {
		input    string
		expected string
		wantErr  bool
	}{
		{input: "88888888", expected: "+88888888888", wantErr: false},
		{input: "+888 8888 8888", expected: "+88888888888", wantErr: false},
		{input: "88880000", expected: "+88888880000", wantErr: false},
		{input: "+888 8888 0000", expected: "+88888880000", wantErr: false},
		{input: "8888", expected: "+8888888", wantErr: false},
		{input: "+888 8888", expected: "+8888888", wantErr: false},
		{input: "8000", expected: "+8888000", wantErr: false},
		{input: "+888 8000", expected: "+8888000", wantErr: false},
		{input: "8888000", expected: "+8888000", wantErr: false},
		{input: "01234567", expected: "+88801234567", wantErr: false},
		{input: "+888 0123 4567", expected: "+88801234567", wantErr: false},
		{input: "1234", expected: "", wantErr: true},
		{input: "+888 1234", expected: "", wantErr: true},
		{input: "715311", expected: "", wantErr: true},    // 6 digits
		{input: "12345", expected: "", wantErr: true},     // 5 digits
		{input: "123456789", expected: "", wantErr: true}, // 9 digits
	}

	for _, tc := range testCases {
		res, err := NormalizeNumber(tc.input)
		if tc.wantErr {
			if err == nil {
				t.Errorf("expected error for input %q, got %q", tc.input, res)
			}
		} else {
			if err != nil {
				t.Errorf("unexpected error for input %q: %v", tc.input, err)
			}
			if res != tc.expected {
				t.Errorf("for input %q: expected %q, got %q", tc.input, tc.expected, res)
			}
		}
	}
}

func TestFormatDisplayNumber(t *testing.T) {
	testCases := []struct {
		input    string
		expected string
	}{
		{input: "+8888000", expected: "+888 8000"},
		{input: "8888000", expected: "+888 8000"},
		{input: "8000", expected: "+888 8000"},
		{input: "+888 8000", expected: "+888 8000"},
		{input: "+88888880000", expected: "+888 8888 0000"},
		{input: "88880000", expected: "+888 8888 0000"},
		{input: "+88801234567", expected: "+888 0123 4567"},
		{input: "01234567", expected: "+888 0123 4567"},
	}

	for _, tc := range testCases {
		got := FormatDisplayNumber(tc.input)
		if got != tc.expected {
			t.Errorf("FormatDisplayNumber(%q) = %q, expected %q", tc.input, got, tc.expected)
		}
	}
}


