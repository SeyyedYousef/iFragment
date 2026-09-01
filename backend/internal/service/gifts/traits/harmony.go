package traits

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// RGB represents linear 0..1 color channels
type RGB struct {
	R, G, B float64
}

// Lab represents CIELAB color space coordinates
type Lab struct {
	L, A, B float64
}

// AestheticHarmonyResult contains the color theory and theme harmony evaluation
type AestheticHarmonyResult struct {
	HarmonyClass      string  `json:"harmony_class"`       // "MONOCHROMATIC_GOLD", "OBSIDIAN_STEALTH", "CYBER_NEON", "EMERALD_VELVET", "ROYAL_SAPPHIRE", "STANDARD"
	HarmonyScore      float64 `json:"harmony_score"`       // 0 to 100
	DeltaECenterEdge  float64 `json:"delta_e_center_edge"` // CIELAB Euclidean color distance between center and edge
	ThemeMatchRating  string  `json:"theme_match_rating"`  // "PERFECT_MATCH", "HIGH_SYNERGY", "HARMONIOUS", "NEUTRAL"
	BetaAesthetic     float64 `json:"beta_aesthetic"`      // Hedonic log-price bonus (0.0 to 0.45)
	DominantPaletteEn string  `json:"dominant_palette_en"`
	DominantPaletteFa string  `json:"dominant_palette_fa"`
}

// HexToRGB parses a hex string (#RRGGBB or RRGGBB) into sRGB [0..1]
func HexToRGB(hex string) RGB {
	clean := strings.TrimPrefix(hex, "#")
	if len(clean) != 6 {
		return RGB{R: 0.5, G: 0.5, B: 0.5}
	}
	r, _ := strconv.ParseInt(clean[0:2], 16, 64)
	g, _ := strconv.ParseInt(clean[2:4], 16, 64)
	b, _ := strconv.ParseInt(clean[4:6], 16, 64)
	return RGB{
		R: float64(r) / 255.0,
		G: float64(g) / 255.0,
		B: float64(b) / 255.0,
	}
}

// RGBToLab converts sRGB to CIELAB using D65 illuminant standard
func RGBToLab(c RGB) Lab {
	// 1. Inverse sRGB gamma companding
	invGamma := func(v float64) float64 {
		if v <= 0.04045 {
			return v / 12.92
		}
		return math.Pow((v+0.055)/1.055, 2.4)
	}
	r := invGamma(c.R)
	g := invGamma(c.G)
	b := invGamma(c.B)

	// 2. Linear sRGB to XYZ (D65)
	x := (r*0.4124564 + g*0.3575761 + b*0.1804375) / 0.95047
	y := (r*0.2126729 + g*0.7151522 + b*0.0721750) / 1.00000
	z := (r*0.0193339 + g*0.1191920 + b*0.9503041) / 1.08883

	// 3. XYZ to CIELAB
	f := func(t float64) float64 {
		if t > 0.008856 {
			return math.Pow(t, 1.0/3.0)
		}
		return (7.787 * t) + (16.0 / 116.0)
	}

	fx := f(x)
	fy := f(y)
	fz := f(z)

	l := (116.0 * fy) - 16.0
	a := 500.0 * (fx - fy)
	bVal := 200.0 * (fy - fz)

	return Lab{L: l, A: a, B: bVal}
}

// DeltaE computes CIELAB Euclidean color distance between two colors
func DeltaE(c1, c2 Lab) float64 {
	dl := c1.L - c2.L
	da := c1.A - c2.A
	db := c1.B - c2.B
	return math.Sqrt(dl*dl + da*da + db*db)
}

// EvaluateAestheticHarmony evaluates the chromatic palette and model synergy
func EvaluateAestheticHarmony(modelID string, backdropName string, colors *BackdropColorSet) AestheticHarmonyResult {
	if colors == nil || colors.CenterHex == "" {
		return AestheticHarmonyResult{
			HarmonyClass:      "STANDARD",
			HarmonyScore:      50.0,
			ThemeMatchRating:  "NEUTRAL",
			BetaAesthetic:     0.0,
			DominantPaletteEn: "Standard Palette",
			DominantPaletteFa: "پالت استاندارد",
		}
	}

	labCenter := RGBToLab(HexToRGB(colors.CenterHex))
	labEdge := RGBToLab(HexToRGB(colors.EdgeHex))
	labPattern := RGBToLab(HexToRGB(colors.PatternHex))

	distCenterEdge := DeltaE(labCenter, labEdge)
	distCenterPattern := DeltaE(labCenter, labPattern)

	harmonyClass := "STANDARD"
	harmonyScore := 65.0
	betaAesthetic := 0.08
	palEn := "Harmonized Gradient"
	palFa := "گرادیان هماهنگ"

	// 1. Detect Special Material & Color Chord Classes
	if labCenter.L < 22.0 && labEdge.L < 25.0 {
		harmonyClass = "OBSIDIAN_STEALTH"
		harmonyScore = 94.0
		betaAesthetic = 0.28
		palEn = "Obsidian Stealth Matrix"
		palFa = "ماتریکس مشکی مات آبسیدین"
	} else if labCenter.B > 28.0 && labEdge.B > 20.0 && labCenter.L > 50.0 {
		harmonyClass = "MONOCHROMATIC_GOLD"
		harmonyScore = 96.0
		betaAesthetic = 0.32
		palEn = "Pure Astral Gold"
		palFa = "طلای ناب کیهانی"
	} else if labCenter.A < -20.0 && labCenter.B > 5.0 {
		harmonyClass = "EMERALD_VELVET"
		harmonyScore = 92.0
		betaAesthetic = 0.25
		palEn = "Emerald Velvet Glow"
		palFa = "درخشش مخمل زمردین"
	} else if distCenterEdge > 55.0 || distCenterPattern > 55.0 {
		harmonyClass = "CYBER_NEON"
		harmonyScore = 88.0
		betaAesthetic = 0.22
		palEn = "Cyber Neon Duo-Tone"
		palFa = "کنتراست نئون سایبرپانک"
	} else if labCenter.B < -20.0 {
		harmonyClass = "ROYAL_SAPPHIRE"
		harmonyScore = 86.0
		betaAesthetic = 0.20
		palEn = "Royal Sapphire Frost"
		palFa = "یاقوت کبود سلطنتی"
	}

	// 2. Model-Specific Aesthetic Synergy Matrix
	themeRating := "HARMONIOUS"
	modelSynergyBonus := 0.0

	switch modelID {
	case "plush_pepe":
		if harmonyClass == "EMERALD_VELVET" || harmonyClass == "OBSIDIAN_STEALTH" || strings.Contains(strings.ToLower(backdropName), "emerald") {
			themeRating = "PERFECT_MATCH"
			modelSynergyBonus = 0.15
		} else if harmonyClass == "CYBER_NEON" {
			themeRating = "HIGH_SYNERGY"
			modelSynergyBonus = 0.10
		}
	case "durov_cap":
		if harmonyClass == "OBSIDIAN_STEALTH" || harmonyClass == "MONOCHROMATIC_GOLD" {
			themeRating = "PERFECT_MATCH"
			modelSynergyBonus = 0.16
		} else if harmonyClass == "ROYAL_SAPPHIRE" {
			themeRating = "HIGH_SYNERGY"
			modelSynergyBonus = 0.09
		}
	case "snoop_dogg":
		if harmonyClass == "MONOCHROMATIC_GOLD" || strings.Contains(strings.ToLower(backdropName), "gold") {
			themeRating = "PERFECT_MATCH"
			modelSynergyBonus = 0.18
		}
	case "cyber_heart":
		if harmonyClass == "CYBER_NEON" || harmonyClass == "ROYAL_SAPPHIRE" {
			themeRating = "PERFECT_MATCH"
			modelSynergyBonus = 0.14
		}
	case "phoenix_feather":
		if harmonyClass == "MONOCHROMATIC_GOLD" || harmonyClass == "CYBER_NEON" {
			themeRating = "PERFECT_MATCH"
			modelSynergyBonus = 0.15
		}
	case "golden_star":
		if harmonyClass == "MONOCHROMATIC_GOLD" || harmonyClass == "OBSIDIAN_STEALTH" {
			themeRating = "PERFECT_MATCH"
			modelSynergyBonus = 0.15
		}
	}

	totalBeta := betaAesthetic + modelSynergyBonus
	if totalBeta > 0.45 {
		totalBeta = 0.45
	}
	if themeRating == "PERFECT_MATCH" {
		harmonyScore = math.Min(99.0, harmonyScore+6.0)
	} else if themeRating == "HIGH_SYNERGY" {
		harmonyScore = math.Min(95.0, harmonyScore+3.0)
	}

	return AestheticHarmonyResult{
		HarmonyClass:      harmonyClass,
		HarmonyScore:      math.Round(harmonyScore*10.0) / 10.0,
		DeltaECenterEdge:  math.Round(distCenterEdge*100.0) / 100.0,
		ThemeMatchRating:  themeRating,
		BetaAesthetic:     math.Round(totalBeta*100.0) / 100.0,
		DominantPaletteEn: palEn,
		DominantPaletteFa: palFa,
	}
}

func FormatColorSummary(res AestheticHarmonyResult) string {
	return fmt.Sprintf("%s (Score: %.1f, Delta-E: %.1f)", res.DominantPaletteEn, res.HarmonyScore, res.DeltaECenterEdge)
}
