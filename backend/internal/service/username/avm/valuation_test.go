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
