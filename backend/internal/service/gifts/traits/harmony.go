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

// Prestige tiers for secondary market empirical evaluation
const (
	PrestigeTierS = "TIER_S" // Obsidian/Black, Astral Gold, Cyberpunk/Neon, Emerald Velvet
	PrestigeTierA = "TIER_A" // Royal Sapphire, Ruby Velvet, Crimson Blaze, Electric Purple, Electric Indigo, Solar Flare
	PrestigeTierB = "TIER_B" // Lavender, Arctic Ice, Cherry Blossom, Emerald Forest, Royal Purple, Charcoal Stealth
	PrestigeTierC = "TIER_C" // Warm Taupe, Muted Gray, earthy/brown neutral tones
)

// ClassifyColorPrestige evaluates the empirical prestige tier of a backdrop color palette
func ClassifyColorPrestige(backdropName string, harmonyClass string) (string, float64) {
	nameLower := strings.ToLower(strings.TrimSpace(backdropName))

	// Tier S: Apex demand (Obsidian, Gold, Cyberpunk, Emerald Velvet)
	if harmonyClass == "OBSIDIAN_STEALTH" || harmonyClass == "MONOCHROMATIC_GOLD" || harmonyClass == "EMERALD_VELVET" || harmonyClass == "CYBER_NEON" ||
		strings.Contains(nameLower, "black") || strings.Contains(nameLower, "obsidian") || strings.Contains(nameLower, "gold") ||
		strings.Contains(nameLower, "cyberpunk") || strings.Contains(nameLower, "cyber neon") || strings.Contains(nameLower, "emerald velvet") {
		return PrestigeTierS, 0.20
	}

	// Tier A: Vibrant high-demand (Sapphire, Ruby, Crimson, Electric Purple/Indigo, Solar)
	if harmonyClass == "ROYAL_SAPPHIRE" || strings.Contains(nameLower, "sapphire") || strings.Contains(nameLower, "ruby") ||
		strings.Contains(nameLower, "crimson") || strings.Contains(nameLower, "electric purple") || strings.Contains(nameLower, "electric indigo") ||
		strings.Contains(nameLower, "solar flare") {
		return PrestigeTierA, 0.10
	}

	// Tier B: Aesthetic pastels & balanced themes
	if strings.Contains(nameLower, "lavender") || strings.Contains(nameLower, "arctic") || strings.Contains(nameLower, "cherry") ||
		strings.Contains(nameLower, "forest") || strings.Contains(nameLower, "charcoal") || strings.Contains(nameLower, "purple") {
		return PrestigeTierB, 0.04
	}

	// Tier C: Neutral / Earth / Muted tones (Floor-aligned)
	return PrestigeTierC, 0.0
}

// AestheticHarmonyResult contains the color theory and theme harmony evaluation
type AestheticHarmonyResult struct {
	HarmonyClass            string  `json:"harmony_class"`              // "MONOCHROMATIC_GOLD", "OBSIDIAN_STEALTH", "CYBER_NEON", "EMERALD_VELVET", "ROYAL_SAPPHIRE", "STANDARD"
	HarmonyScore            float64 `json:"harmony_score"`              // 0 to 100
	DeltaECenterEdge        float64 `json:"delta_e_center_edge"`        // CIELAB Euclidean color distance between center and edge
	DeltaEScore             float64 `json:"delta_e_score,omitempty"`    // Primary Delta-E metric exposed to UI
	DeltaE2000ModelBackdrop float64 `json:"delta_e_2000_model_backdrop"` // ISO/CIE 11664-6 CIEDE2000 perceptual distance between 3D model and backdrop
	ModelDominantHex        string  `json:"model_dominant_hex,omitempty"`
	IsMonochromeColorMatch  bool    `json:"is_monochrome_color_match"`
	WCAGContrastRatio       float64 `json:"wcag_contrast_ratio"`
	ThemeMatchRating        string  `json:"theme_match_rating"`  // "PERFECT_MATCH", "HIGH_SYNERGY", "HARMONIOUS", "NEUTRAL"
	BetaAesthetic           float64 `json:"beta_aesthetic"`      // Hedonic log-price bonus (0.0 to 0.45)
	DominantPaletteEn       string  `json:"dominant_palette_en"`
	DominantPaletteFa       string  `json:"dominant_palette_fa"`
	PrestigeTier            string  `json:"prestige_tier"`       // "TIER_S", "TIER_A", "TIER_B", "TIER_C"
	BetaColorPrestige       float64 `json:"beta_color_prestige"` // Dedicated empirical secondary market premium
}

// HexToRGB parses a hex string (#RRGGBB or RRGGBB) into sRGB [0..1]
func HexToRGB(hex string) RGB {
	clean := strings.TrimPrefix(strings.TrimSpace(hex), "#")
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

// RelativeLuminance computes WCAG 2.1 relative luminance Y in [0..1]
func RelativeLuminance(c RGB) float64 {
	lin := func(v float64) float64 {
		if v <= 0.04045 {
			return v / 12.92
		}
		return math.Pow((v+0.055)/1.055, 2.4)
	}
	return 0.2126*lin(c.R) + 0.7152*lin(c.G) + 0.0722*lin(c.B)
}

// WCAGContrast computes WCAG 2.1 contrast ratio between two hex colors [1.0 .. 21.0]
func WCAGContrast(hex1, hex2 string) float64 {
	y1 := RelativeLuminance(HexToRGB(hex1))
	y2 := RelativeLuminance(HexToRGB(hex2))
	lighter := math.Max(y1, y2)
	darker := math.Min(y1, y2)
	return math.Round(((lighter+0.05)/(darker+0.05))*100.0) / 100.0
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

// DeltaE computes CIE76 Euclidean color distance between two colors
func DeltaE(c1, c2 Lab) float64 {
	dl := c1.L - c2.L
	da := c1.A - c2.A
	db := c1.B - c2.B
	return math.Sqrt(dl*dl + da*da + db*db)
}

// DeltaE2000 computes the exact ISO/CIE 11664-6:2014 CIEDE2000 perceptual color difference
// with lightness (S_L), chroma (S_C), hue (S_H) weighting and blue-region rotation (R_T).
func DeltaE2000(c1, c2 Lab) float64 {
	deg2rad := func(deg float64) float64 { return deg * math.Pi / 180.0 }
	rad2deg := func(rad float64) float64 { return rad * 180.0 / math.Pi }

	L1, a1, b1 := c1.L, c1.A, c1.B
	L2, a2, b2 := c2.L, c2.A, c2.B

	C1 := math.Sqrt(a1*a1 + b1*b1)
	C2 := math.Sqrt(a2*a2 + b2*b2)
	Cbar := (C1 + C2) / 2.0

	Cbar7 := math.Pow(Cbar, 7.0)
	G := 0.5 * (1.0 - math.Sqrt(Cbar7/(Cbar7+math.Pow(25.0, 7.0))))

	a1Prime := (1.0 + G) * a1
	a2Prime := (1.0 + G) * a2

	C1Prime := math.Sqrt(a1Prime*a1Prime + b1*b1)
	C2Prime := math.Sqrt(a2Prime*a2Prime + b2*b2)

	computeHuePrime := func(b, aPrime float64) float64 {
		if b == 0 && aPrime == 0 {
			return 0.0
		}
		h := rad2deg(math.Atan2(b, aPrime))
		if h < 0 {
			h += 360.0
		}
		return h
	}

	h1Prime := computeHuePrime(b1, a1Prime)
	h2Prime := computeHuePrime(b2, a2Prime)

	dLPrime := L2 - L1
	dCPrime := C2Prime - C1Prime

	var dhPrime float64
	if C1Prime*C2Prime == 0 {
		dhPrime = 0.0
	} else {
		diff := h2Prime - h1Prime
		if math.Abs(diff) <= 180.0 {
			dhPrime = diff
		} else if diff > 180.0 {
			dhPrime = diff - 360.0
		} else {
			dhPrime = diff + 360.0
		}
	}

	dHPrime := 2.0 * math.Sqrt(C1Prime*C2Prime) * math.Sin(deg2rad(dhPrime/2.0))

	LbarPrime := (L1 + L2) / 2.0
	CbarPrime := (C1Prime + C2Prime) / 2.0

	var hbarPrime float64
	if C1Prime*C2Prime == 0 {
		hbarPrime = h1Prime + h2Prime
	} else {
		sum := h1Prime + h2Prime
		if math.Abs(h1Prime-h2Prime) <= 180.0 {
			hbarPrime = sum / 2.0
		} else if sum < 360.0 {
			hbarPrime = (sum + 360.0) / 2.0
		} else {
			hbarPrime = (sum - 360.0) / 2.0
		}
	}

	T := 1.0 -
		0.17*math.Cos(deg2rad(hbarPrime-30.0)) +
		0.24*math.Cos(deg2rad(2.0*hbarPrime)) +
		0.32*math.Cos(deg2rad(3.0*hbarPrime+6.0)) -
		0.20*math.Cos(deg2rad(4.0*hbarPrime-63.0))

	dTheta := 30.0 * math.Exp(-math.Pow((hbarPrime-275.0)/25.0, 2.0))
	CbarPrime7 := math.Pow(CbarPrime, 7.0)
	RC := 2.0 * math.Sqrt(CbarPrime7/(CbarPrime7+math.Pow(25.0, 7.0)))

	Lm50Sq := (LbarPrime - 50.0) * (LbarPrime - 50.0)
	SL := 1.0 + (0.015*Lm50Sq)/math.Sqrt(20.0+Lm50Sq)
	SC := 1.0 + 0.045*CbarPrime
	SH := 1.0 + 0.015*CbarPrime*T
	RT := -math.Sin(deg2rad(2.0*dTheta)) * RC

	termL := dLPrime / SL
	termC := dCPrime / SC
	termH := dHPrime / SH

	de00 := math.Sqrt(termL*termL + termC*termC + termH*termH + RT*termC*termH)
	return math.Round(de00*100.0) / 100.0
}

// InferModelDominantHex infers the primary 3D artwork color hex of a Telegram Gift model variant
func InferModelDominantHex(collectionID, modelVariantName string) string {
	mLower := strings.ToLower(strings.TrimSpace(modelVariantName))
	cLower := strings.ToLower(strings.TrimSpace(collectionID))

	// 1. Check explicit 3D Model Variant chromatic keywords first
	switch {
	case strings.Contains(mLower, "midas") || strings.Contains(mLower, "gold") || strings.Contains(mLower, "golden") || strings.Contains(mLower, "astral") || strings.Contains(mLower, "solar") || strings.Contains(mLower, "crown") || strings.Contains(mLower, "imperial"):
		return "#FFD700" // Pure Gold
	case strings.Contains(mLower, "onyx") || strings.Contains(mLower, "obsidian") || strings.Contains(mLower, "black") || strings.Contains(mLower, "dark") || strings.Contains(mLower, "ninja") || strings.Contains(mLower, "shadow") || strings.Contains(mLower, "stealth") || strings.Contains(mLower, "batman") || strings.Contains(mLower, "vader") || strings.Contains(mLower, "noir"):
		return "#121318" // Obsidian Black
	case strings.Contains(mLower, "emerald") || strings.Contains(mLower, "jade") || strings.Contains(mLower, "pepemint") || strings.Contains(mLower, "matrix") || strings.Contains(mLower, "forest") || strings.Contains(mLower, "green") || strings.Contains(mLower, "goblin") || strings.Contains(mLower, "zombie"):
		return "#007A3D" // Emerald Green
	case strings.Contains(mLower, "ruby") || strings.Contains(mLower, "crimson") || strings.Contains(mLower, "red") || strings.Contains(mLower, "magma") || strings.Contains(mLower, "lava") || strings.Contains(mLower, "devil") || strings.Contains(mLower, "sith") || strings.Contains(mLower, "santa") || strings.Contains(mLower, "hell"):
		return "#C41E3A" // Crimson Ruby
	case strings.Contains(mLower, "pink") || strings.Contains(mLower, "sakura") || strings.Contains(mLower, "rose") || strings.Contains(mLower, "bubblegum") || strings.Contains(mLower, "flamingo") || strings.Contains(mLower, "cupid") || strings.Contains(mLower, "strawberry") || strings.Contains(mLower, "cotton"):
		return "#FF69B4" // Sakura Pink
	case strings.Contains(mLower, "sapphire") || strings.Contains(mLower, "cobalt") || strings.Contains(mLower, "ocean") || strings.Contains(mLower, "navy") || strings.Contains(mLower, "blue") || strings.Contains(mLower, "aqua") || strings.Contains(mLower, "poseidon"):
		return "#0F52BA" // Royal Sapphire
	case strings.Contains(mLower, "arctic") || strings.Contains(mLower, "ice") || strings.Contains(mLower, "frost") || strings.Contains(mLower, "diamond") || strings.Contains(mLower, "crystal") || strings.Contains(mLower, "glacier"):
		return "#A5F2F3" // Diamond Ice
	case strings.Contains(mLower, "cyber") || strings.Contains(mLower, "neon") || strings.Contains(mLower, "galaxy") || strings.Contains(mLower, "amethyst") || strings.Contains(mLower, "purple") || strings.Contains(mLower, "violet") || strings.Contains(mLower, "cosmic") || strings.Contains(mLower, "nebula"):
		return "#7B2CBF" // Cyber Violet
	case strings.Contains(mLower, "silver") || strings.Contains(mLower, "platinum") || strings.Contains(mLower, "chrome") || strings.Contains(mLower, "white") || strings.Contains(mLower, "albino") || strings.Contains(mLower, "ghost") || strings.Contains(mLower, "angel") || strings.Contains(mLower, "pearl"):
		return "#E5E7EB" // Platinum White
	case strings.Contains(mLower, "bronze") || strings.Contains(mLower, "copper") || strings.Contains(mLower, "amber") || strings.Contains(mLower, "orange") || strings.Contains(mLower, "pumpkin") || strings.Contains(mLower, "peach"):
		return "#D97706" // Warm Amber
	}

	// 2. Fallback to canonical collection base palette when model variant is default or unspecified
	switch cLower {
	case "plush_pepe", "kissed_frog":
		return "#1E7E34" // Pepe Emerald Green
	case "durov_cap", "scared_cat", "witch_hat":
		return "#14161D" // Signature Durov Black
	case "snoop_dogg", "golden_star", "signet_ring", "mini_oscar", "genie_lamp", "hanging_star":
		return "#EAC117" // Sovereign Gold
	case "eternal_rose", "trapped_heart", "love_candle", "santa_hat", "spiced_wine":
		return "#B91C1C" // Velvet Crimson
	case "cyber_heart", "evil_eye", "astral_shard", "ion_gem":
		return "#1D4ED8" // Electric Sapphire
	case "precious_peach", "cookie_heart", "vintage_cigar":
		return "#EA580C" // Warm Peach/Amber
	default:
		return "#64748B" // Neutral Slate
	}
}

// EvaluateAestheticHarmony evaluates the chromatic palette and model synergy
func EvaluateAestheticHarmony(modelID string, backdropName string, colors *BackdropColorSet) AestheticHarmonyResult {
	return EvaluateAestheticHarmonyWithModel(modelID, "", backdropName, colors)
}

// EvaluateAestheticHarmonyWithModel evaluates CIEDE2000 perceptual harmony between the 3D Model variant and Backdrop
func EvaluateAestheticHarmonyWithModel(modelID string, modelVariantName string, backdropName string, colors *BackdropColorSet) AestheticHarmonyResult {
	if colors == nil || colors.CenterHex == "" {
		return AestheticHarmonyResult{
			HarmonyClass:            "STANDARD",
			HarmonyScore:            50.0,
			DeltaE2000ModelBackdrop: 35.0,
			WCAGContrastRatio:       4.5,
			ThemeMatchRating:        "NEUTRAL",
			BetaAesthetic:           0.0,
			DominantPaletteEn:       "Standard Palette",
			DominantPaletteFa:       "پالت استاندارد",
			PrestigeTier:            PrestigeTierC,
			BetaColorPrestige:       0.0,
		}
	}

	labCenter := RGBToLab(HexToRGB(colors.CenterHex))
	labEdge := RGBToLab(HexToRGB(colors.EdgeHex))
	labPattern := RGBToLab(HexToRGB(colors.PatternHex))

	distCenterEdge := DeltaE(labCenter, labEdge)
	distCenterPattern := DeltaE(labCenter, labPattern)

	modelHex := InferModelDominantHex(modelID, modelVariantName)
	labModel := RGBToLab(HexToRGB(modelHex))
	de00ModelCenter := DeltaE2000(labModel, labCenter)
	de00ModelEdge := DeltaE2000(labModel, labEdge)
	de00ModelBackdrop := math.Min(de00ModelCenter, de00ModelEdge*0.95+de00ModelCenter*0.05)
	de00ModelBackdrop = math.Round(de00ModelBackdrop*100.0) / 100.0

	wcagRatio := WCAGContrast(colors.CenterHex, colors.TextHex)
	if colors.TextHex == "" {
		wcagRatio = WCAGContrast(colors.CenterHex, colors.PatternHex)
	}

	harmonyClass := "STANDARD"
	harmonyScore := 60.0
	betaAesthetic := 0.0
	palEn := "Harmonized Gradient"
	palFa := "گرادیان هماهنگ"

	bdLower := strings.ToLower(strings.TrimSpace(backdropName))
	centerChroma := math.Sqrt(labCenter.A*labCenter.A + labCenter.B*labCenter.B)
	isExplicitBlackBackdrop := strings.Contains(bdLower, "black") || strings.Contains(bdLower, "obsidian") ||
		strings.Contains(bdLower, "onyx") || strings.Contains(bdLower, "stealth") || strings.Contains(bdLower, "coal") ||
		strings.Contains(bdLower, "shadow")

	// 1. Detect Special Material & Color Chord Classes
	// Guard: Do NOT misclassify dark navy fallback (#1a2035, chroma ~19) as OBSIDIAN_STEALTH unless it is genuinely achromatic/black
	if (labCenter.L < 22.0 && labEdge.L < 25.0) && (isExplicitBlackBackdrop || centerChroma < 8.0) {
		harmonyClass = "OBSIDIAN_STEALTH"
		harmonyScore = 94.0
		betaAesthetic = 0.25
		palEn = "Obsidian Stealth Matrix"
		palFa = "ماتریکس مشکی مات آبسیدین"
	} else if labCenter.B > 28.0 && labEdge.B > 20.0 && labCenter.L > 50.0 {
		harmonyClass = "MONOCHROMATIC_GOLD"
		harmonyScore = 96.0
		betaAesthetic = 0.28
		palEn = "Pure Astral Gold"
		palFa = "طلای ناب کیهانی"
	} else if labCenter.A < -20.0 && labCenter.B > 5.0 {
		harmonyClass = "EMERALD_VELVET"
		harmonyScore = 92.0
		betaAesthetic = 0.22
		palEn = "Emerald Velvet Glow"
		palFa = "درخشش مخمل زمردین"
	} else if distCenterEdge > 55.0 || distCenterPattern > 55.0 {
		harmonyClass = "CYBER_NEON"
		harmonyScore = 88.0
		betaAesthetic = 0.18
		palEn = "Cyber Neon Duo-Tone"
		palFa = "کنتراست نئون سایبرپانک"
	} else if labCenter.B < -20.0 {
		harmonyClass = "ROYAL_SAPPHIRE"
		harmonyScore = 86.0
		betaAesthetic = 0.15
		palEn = "Royal Sapphire Frost"
		palFa = "یاقوت کبود سلطنتی"
	}

	// 2. Classify Prestige Tier & Dedicated Market Color Alpha
	prestigeTier, betaColorPrestige := ClassifyColorPrestige(backdropName, harmonyClass)

	// 3. Model-Specific & CIEDE2000 Perceptual Color-Match Synergy Matrix
	themeRating := "HARMONIOUS"
	modelSynergyBonus := 0.0
	isMonochromeMatch := false

	// Check universal CIEDE2000 perceptual monochrome match between 3D Model and Backdrop
	if de00ModelBackdrop <= 11.5 {
		themeRating = "PERFECT_MATCH"
		modelSynergyBonus = 0.16
		isMonochromeMatch = true
	} else if de00ModelBackdrop <= 18.0 {
		themeRating = "HIGH_SYNERGY"
		modelSynergyBonus = 0.09
		isMonochromeMatch = true
	}

	switch modelID {
	case "plush_pepe":
		if harmonyClass == "EMERALD_VELVET" || harmonyClass == "OBSIDIAN_STEALTH" || strings.Contains(bdLower, "emerald") {
			themeRating = "PERFECT_MATCH"
			if modelSynergyBonus < 0.15 {
				modelSynergyBonus = 0.15
			}
			isMonochromeMatch = true
		} else if harmonyClass == "CYBER_NEON" && themeRating != "PERFECT_MATCH" {
			themeRating = "HIGH_SYNERGY"
			if modelSynergyBonus < 0.10 {
				modelSynergyBonus = 0.10
			}
		}
	case "durov_cap":
		if harmonyClass == "OBSIDIAN_STEALTH" || harmonyClass == "MONOCHROMATIC_GOLD" {
			themeRating = "PERFECT_MATCH"
			if modelSynergyBonus < 0.16 {
				modelSynergyBonus = 0.16
			}
			isMonochromeMatch = true
		} else if harmonyClass == "ROYAL_SAPPHIRE" && themeRating != "PERFECT_MATCH" {
			themeRating = "HIGH_SYNERGY"
			if modelSynergyBonus < 0.09 {
				modelSynergyBonus = 0.09
			}
		}
	case "snoop_dogg":
		if harmonyClass == "MONOCHROMATIC_GOLD" || strings.Contains(bdLower, "gold") {
			themeRating = "PERFECT_MATCH"
			if modelSynergyBonus < 0.18 {
				modelSynergyBonus = 0.18
			}
			isMonochromeMatch = true
		}
	case "cyber_heart":
		if harmonyClass == "CYBER_NEON" || harmonyClass == "ROYAL_SAPPHIRE" {
			themeRating = "PERFECT_MATCH"
			if modelSynergyBonus < 0.14 {
				modelSynergyBonus = 0.14
			}
			isMonochromeMatch = true
		}
	case "phoenix_feather":
		if harmonyClass == "MONOCHROMATIC_GOLD" || harmonyClass == "CYBER_NEON" {
			themeRating = "PERFECT_MATCH"
			if modelSynergyBonus < 0.15 {
				modelSynergyBonus = 0.15
			}
			isMonochromeMatch = true
		}
	case "golden_star":
		if harmonyClass == "MONOCHROMATIC_GOLD" || harmonyClass == "OBSIDIAN_STEALTH" {
			themeRating = "PERFECT_MATCH"
			if modelSynergyBonus < 0.15 {
				modelSynergyBonus = 0.15
			}
			isMonochromeMatch = true
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
		HarmonyClass:            harmonyClass,
		HarmonyScore:            math.Round(harmonyScore*10.0) / 10.0,
		DeltaECenterEdge:        math.Round(distCenterEdge*100.0) / 100.0,
		DeltaEScore:             math.Round(distCenterEdge*100.0) / 100.0,
		DeltaE2000ModelBackdrop: de00ModelBackdrop,
		ModelDominantHex:        modelHex,
		IsMonochromeColorMatch:  isMonochromeMatch,
		WCAGContrastRatio:       wcagRatio,
		ThemeMatchRating:        themeRating,
		BetaAesthetic:           math.Round(totalBeta*100.0) / 100.0,
		DominantPaletteEn:       palEn,
		DominantPaletteFa:       palFa,
		PrestigeTier:            prestigeTier,
		BetaColorPrestige:       betaColorPrestige,
	}
}

func FormatColorSummary(res AestheticHarmonyResult) string {
	return fmt.Sprintf("%s (Score: %.1f, Delta-E: %.1f)", res.DominantPaletteEn, res.HarmonyScore, res.DeltaECenterEdge)
}
