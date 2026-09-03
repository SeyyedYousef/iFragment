package telegramnft

import (
	"testing"
)

func TestFormatPascalName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"plush_pepe", "PlushPepe"},
		{"durov_cap", "DurovsBlackCap"},
		{"santa_hat", "SantaHat"},
		{"golden_star", "CelestialStar"},
	}

	for _, tt := range tests {
		got := FormatPascalName(tt.input)
		if got != tt.expected {
			t.Errorf("FormatPascalName(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestParseTelegramNFTMetadata(t *testing.T) {
	sampleHTML := `<!DOCTYPE html>
<html>
<head>
<meta property="og:title" content="Plush Pepe #1">
<meta property="og:image" content="https://cdn4.telesco.pe/file/SMU6vIpy9-pepe1.jpg">
<meta property="og:description" content="Model: Pumpkin&#10;Backdrop: Onyx Black&#10;Symbol: Illuminati">
</head>
<body></body>
</html>`

	if m := ogImageRe.FindStringSubmatch(sampleHTML); len(m) >= 2 {
		if m[1] != "https://cdn4.telesco.pe/file/SMU6vIpy9-pepe1.jpg" {
			t.Errorf("expected og:image %q, got %q", "https://cdn4.telesco.pe/file/SMU6vIpy9-pepe1.jpg", m[1])
		}
	} else {
		t.Fatalf("failed to match og:image")
	}

	if m := ogDescRe.FindStringSubmatch(sampleHTML); len(m) >= 2 {
		desc := m[1]
		if mm := descModelRe.FindStringSubmatch(desc); len(mm) >= 2 {
			if mm[1] != "Pumpkin" {
				t.Errorf("expected Model %q, got %q", "Pumpkin", mm[1])
			}
		} else {
			t.Errorf("failed to match Model in description")
		}

		if mm := descBackdropRe.FindStringSubmatch(desc); len(mm) >= 2 {
			if mm[1] != "Onyx Black" {
				t.Errorf("expected Backdrop %q, got %q", "Onyx Black", mm[1])
			}
		} else {
			t.Errorf("failed to match Backdrop in description")
		}

		if mm := descSymbolRe.FindStringSubmatch(desc); len(mm) >= 2 {
			if mm[1] != "Illuminati" {
				t.Errorf("expected Symbol %q, got %q", "Illuminati", mm[1])
			}
		} else {
			t.Errorf("failed to match Symbol in description")
		}
	} else {
		t.Fatalf("failed to match og:description")
	}
}

