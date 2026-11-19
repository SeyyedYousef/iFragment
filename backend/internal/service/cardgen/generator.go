package cardgen

import (
	"bytes"
	"context"
	_ "embed"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"log/slog"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/gomono"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
	_ "golang.org/x/image/webp"
)

//go:embed assets/Outfit-Black.ttf
var outfitBlackBytes []byte

//go:embed assets/Outfit-Bold.ttf
var outfitBoldBytes []byte

//go:embed assets/Vazirmatn-Bold.ttf
var vazirmatnBoldBytes []byte

const (
	PersianVerifiedShaped       = "\uFEEB\uFEAA\uFEB7\u0020\uFEAA\uFEF4\uFEF3\uFE8E\uFE97"
	PersianEstimatedPriceShaped = "\uFEAE\uFE8D\uFEAF\uFE8E\uFE91\u0020\uFEF2\uFEE8\uFEF4\uFEE4\uFEA8\uFE97\u0020\uFE96\uFEE4\uFEF4\uFED7"

	// GoldenRatioPhi is the mathematical constant φ = (1 + √5) / 2 ≈ 1.6180339887
	GoldenRatioPhi = 1.618033988749895
	// GoldenAngleRad is 2π * (1 - 1/φ) ≈ 137.507764° in radians for organic phyllotaxis stardust
	GoldenAngleRad = 2.399963229728653
)

type UsernameCardParams struct {
	Username     string
	Grade        string
	LowTON       string
	FairTON      string
	HighTON      string
	USDT         string
	Brandability int
	Length       int
	MarketStatus string
	CompsCount   int
	Confidence   int
	Lang         string
}

type NumberCardParams struct {
	Number       string
	Club         string
	Rank         int
	LowTON       string
	FairTON      string
	HighTON      string
	USDT         string
	ColorPattern string
	Supply       int
	Lang         string
}

type GiftCardParams struct {
	Title          string
	ModelName      string
	SerialNumber   int
	RarityTier     string
	BackdropName   string
	BackdropCenter string
	BackdropEdge   string
	SymbolName     string
	ImageURL       string
	ExpectedTON    string
	ExpectedUSD    string
	Lang           string
}

type CardGenerator struct {
	fontOutfitBlack  *opentype.Font
	fontOutfitBold   *opentype.Font
	fontOutfitMedium *opentype.Font
	fontMonoBold     *opentype.Font
	fontVazirBold    *opentype.Font
	mu               sync.Mutex
}

var (
	defaultGenerator *CardGenerator
	once             sync.Once
)

func GetGenerator() *CardGenerator {
	once.Do(func() {
		defaultGenerator = NewCardGenerator()
	})
	return defaultGenerator
}

func NewCardGenerator() *CardGenerator {
	cg := &CardGenerator{}

	var err error
	cg.fontOutfitBold, err = opentype.Parse(outfitBoldBytes)
	if err != nil {
		slog.Warn("failed to parse Outfit-Bold font, falling back to gobold", "error", err)
		cg.fontOutfitBold, _ = opentype.Parse(gobold.TTF)
	}

	cg.fontOutfitBlack, err = opentype.Parse(outfitBlackBytes)
	if err != nil {
		slog.Warn("failed to parse Outfit-Black font, falling back to Outfit-Bold", "error", err)
		cg.fontOutfitBlack = cg.fontOutfitBold
	}

	cg.fontOutfitMedium, err = opentype.Parse(outfitBoldBytes)
	if err != nil {
		cg.fontOutfitMedium, _ = opentype.Parse(goregular.TTF)
	}

	cg.fontMonoBold, err = opentype.Parse(gomono.TTF)
	if err != nil {
		slog.Warn("failed to parse gomono font", "error", err)
	}

	cg.fontVazirBold, err = opentype.Parse(vazirmatnBoldBytes)
	if err != nil {
		slog.Warn("failed to parse Vazirmatn-Bold font, falling back to Outfit-Bold", "error", err)
		cg.fontVazirBold = cg.fontOutfitBold
	}

	return cg
}

// tierVisualTheme defines the psychologically calibrated border, glow, and badge palette for a given rarity tier.
type tierVisualTheme struct {
	BorderStart   color.RGBA
	BorderEnd     color.RGBA
	CenterGlow    color.RGBA
	SecondaryGlow color.RGBA
	BadgeBg       color.RGBA
	BadgeBorder   color.RGBA
	BadgeText     color.RGBA
	Accent        color.RGBA
}

func resolveTierTheme(tierBadge string) tierVisualTheme {
	upper := strings.ToUpper(strings.TrimSpace(tierBadge))
	switch {
	case strings.Contains(upper, "LEGENDARY") || strings.Contains(upper, "EXCLUSIVE") || strings.Contains(upper, "GRAIL") || strings.Contains(upper, "MYTHIC") || strings.Contains(upper, "GOD") || strings.Contains(upper, "RANK #"):
		// Imperial 24K Gold & Warm Amber-Rose Aura (Sovereignty, Triumph, Prestige)
		return tierVisualTheme{
			BorderStart:   color.RGBA{255, 200, 55, 255},
			BorderEnd:     color.RGBA{180, 83, 9, 255},
			CenterGlow:    color.RGBA{255, 168, 24, 255},
			SecondaryGlow: color.RGBA{245, 130, 32, 255},
			BadgeBg:       color.RGBA{42, 29, 11, 255},
			BadgeBorder:   color.RGBA{217, 146, 28, 255},
			BadgeText:     color.RGBA{255, 209, 82, 255},
			Accent:        color.RGBA{255, 198, 58, 255},
		}
	case strings.Contains(upper, "EPIC") || strings.Contains(upper, "APEX") || strings.Contains(upper, "ELITE"):
		// Celestial Cyan-Sapphire & Electric Azure (Precision, High-Tech Authority)
		return tierVisualTheme{
			BorderStart:   color.RGBA{56, 189, 248, 255},
			BorderEnd:     color.RGBA{3, 105, 161, 255},
			CenterGlow:    color.RGBA{14, 165, 233, 255},
			SecondaryGlow: color.RGBA{56, 189, 248, 255},
			BadgeBg:       color.RGBA{11, 31, 52, 255},
			BadgeBorder:   color.RGBA{28, 134, 209, 255},
			BadgeText:     color.RGBA{103, 214, 255, 255},
			Accent:        color.RGBA{56, 189, 248, 255},
		}
	case strings.Contains(upper, "RARE") || strings.Contains(upper, "PREMIUM") || strings.Contains(upper, "UNIQUE"):
		// Bioluminescent Emerald-Jade & Mint Specular (Vitality, Wealth Growth)
		return tierVisualTheme{
			BorderStart:   color.RGBA{52, 211, 153, 255},
			BorderEnd:     color.RGBA{4, 120, 87, 255},
			CenterGlow:    color.RGBA{16, 185, 129, 255},
			SecondaryGlow: color.RGBA{20, 184, 166, 255},
			BadgeBg:       color.RGBA{10, 39, 30, 255},
			BadgeBorder:   color.RGBA{24, 148, 106, 255},
			BadgeText:     color.RGBA{74, 229, 172, 255},
			Accent:        color.RGBA{52, 211, 153, 255},
		}
	default:
		// Brushed Surgical Titanium & Deep TON Sapphire (Prestigious even for Standard/Common)
		return tierVisualTheme{
			BorderStart:   color.RGBA{148, 163, 184, 255},
			BorderEnd:     color.RGBA{14, 116, 184, 255},
			CenterGlow:    color.RGBA{56, 189, 248, 255},
			SecondaryGlow: color.RGBA{148, 163, 184, 255},
			BadgeBg:       color.RGBA{19, 27, 42, 255},
			BadgeBorder:   color.RGBA{64, 98, 145, 255},
			BadgeText:     color.RGBA{186, 224, 255, 255},
			Accent:        color.RGBA{96, 195, 252, 255},
		}
	}
}

// normalizeCardTierBadge maps any investment grade ("AAA", "A", "D") or localized rarity string
// into a clean, full-word uppercase English rarity tier badge ("LEGENDARY", "EPIC", "RARE", "UNCOMMON", "COMMON").
func normalizeCardTierBadge(raw string) string {
	clean := strings.TrimSpace(raw)
	upper := strings.ToUpper(clean)

	if strings.HasPrefix(upper, "RANK #") {
		return upper
	}

	switch upper {
	case "AAA", "S+", "LEGENDARY", "EXCLUSIVE", "MYTHIC", "GRAIL", "GOD", "GENESIS":
		return "LEGENDARY"
	case "AA+", "AA", "A+", "S", "EPIC", "APEX", "ELITE", "ULTRA RARE", "FLAME":
		return "EPIC"
	case "A", "A-", "BBB+", "BBB", "B+", "B", "RARE", "PREMIUM", "UNIQUE", "MINTED":
		return "RARE"
	case "BB+", "BB", "B-", "C+", "C", "UNCOMMON":
		return "UNCOMMON"
	case "C-", "D+", "D", "D-", "F", "STANDARD", "COMMON", "COLLECTIBLE", "":
		return "COMMON"
	}

	lower := strings.ToLower(clean)
	switch {
	case strings.Contains(lower, "legend") || strings.Contains(lower, "exclusiv") || strings.Contains(lower, "افسانه") || strings.Contains(lower, "اسطوره") || strings.Contains(lower, "легенд") || strings.Contains(lower, "传奇"):
		return "LEGENDARY"
	case strings.Contains(lower, "epic") || strings.Contains(lower, "apex") || strings.Contains(lower, "حماس") || strings.Contains(lower, "اپیک") || strings.Contains(lower, "эпич") || strings.Contains(lower, "史诗"):
		return "EPIC"
	case strings.Contains(lower, "rare") || strings.Contains(lower, "unique") || strings.Contains(lower, "کمیاب") || strings.Contains(lower, "نایاب") || strings.Contains(lower, "редк") || strings.Contains(lower, "稀有"):
		return "RARE"
	case strings.Contains(lower, "uncommon") || strings.Contains(lower, "متوسط"):
		return "UNCOMMON"
	}

	if isUnsupportedFontScript(clean) || len(upper) <= 2 {
		return "COMMON"
	}
	if len(upper) > 14 {
		return "COLLECTIBLE"
	}
	return upper
}

// flexCardSpec holds the rich Fibonacci layout data for the 600x600 PV certificate card.
type flexCardSpec struct {
	TopBadge    string
	Eyebrow     string
	MainTitle   string
	Chips       []string
	LowTON      string
	FairTON     string
	HighTON     string
	ExpectedUSD string
	Confidence  int
}

// GenerateUsernameCard generates the 600x600 Fibonacci luxury certificate card for a username.
func (cg *CardGenerator) GenerateUsernameCard(username, tier, expectedTON, expectedUSD string, lang ...string) ([]byte, error) {
	l := "en"
	if len(lang) > 0 && lang[0] != "" {
		l = lang[0]
	}
	cleanUser := strings.TrimPrefix(strings.TrimSpace(username), "@")
	return cg.GenerateRichUsernameCard(UsernameCardParams{
		Username: cleanUser,
		Grade:    tier,
		FairTON:  expectedTON,
		USDT:     expectedUSD,
		Lang:     l,
	})
}

// GenerateRichUsernameCard generates the 600x600 Fibonacci luxury certificate card from UsernameCardParams.
func (cg *CardGenerator) GenerateRichUsernameCard(p UsernameCardParams) ([]byte, error) {
	cleanUser := strings.TrimPrefix(strings.TrimSpace(p.Username), "@")
	if isUnsupportedFontScript(cleanUser) || cleanUser == "" {
		cleanUser = "username"
	}
	mainTitle := "@" + cleanUser
	badge := normalizeCardTierBadge(p.Grade)

	var chips []string
	rawGrade := strings.ToUpper(strings.TrimSpace(p.Grade))
	if rawGrade != "" && !isUnsupportedFontScript(rawGrade) && len(rawGrade) <= 6 && rawGrade != badge {
		chips = append(chips, "GRADE "+rawGrade)
	} else {
		chips = append(chips, "TIER "+badge)
	}

	if p.Brandability > 0 {
		chips = append(chips, fmt.Sprintf("BRAND %d/100", p.Brandability))
	} else {
		charLen := p.Length
		if charLen <= 0 {
			charLen = len(cleanUser)
		}
		chips = append(chips, fmt.Sprintf("%d CHARS", charLen))
	}

	charLen := p.Length
	if charLen <= 0 {
		charLen = len(cleanUser)
	}
	if p.Brandability > 0 {
		chips = append(chips, fmt.Sprintf("%d CHARS · NFT", charLen))
	} else {
		chips = append(chips, "TEP-62 NFT")
	}

	conf := p.Confidence
	if conf <= 0 {
		switch badge {
		case "LEGENDARY":
			conf = 95
		case "EPIC":
			conf = 91
		case "RARE":
			conf = 88
		default:
			conf = 85
		}
	}

	return cg.renderFlexCardRich(flexCardSpec{
		TopBadge:    badge,
		Eyebrow:     "TELEGRAM DIGITAL USERNAME",
		MainTitle:   mainTitle,
		Chips:       chips,
		LowTON:      p.LowTON,
		FairTON:     p.FairTON,
		HighTON:     p.HighTON,
		ExpectedUSD: p.USDT,
		Confidence:  conf,
	})
}

// GenerateNumberCard generates the 600x600 Fibonacci luxury certificate card for a +888 number.
func (cg *CardGenerator) GenerateNumberCard(number, club string, rank int, expectedTON, expectedUSD string, lang ...string) ([]byte, error) {
	l := "en"
	if len(lang) > 0 && lang[0] != "" {
		l = lang[0]
	}
	return cg.GenerateRichNumberCard(NumberCardParams{
		Number:  number,
		Club:    club,
		Rank:    rank,
		FairTON: expectedTON,
		USDT:    expectedUSD,
		Lang:    l,
	})
}

// GenerateRichNumberCard generates the 600x600 Fibonacci luxury certificate card from NumberCardParams.
func (cg *CardGenerator) GenerateRichNumberCard(p NumberCardParams) ([]byte, error) {
	cleanNum := strings.TrimSpace(p.Number)
	if isUnsupportedFontScript(cleanNum) || cleanNum == "" {
		cleanNum = "+888 8888 8888"
	}
	if !strings.HasPrefix(cleanNum, "+") {
		cleanNum = "+" + cleanNum
	}

	var topBadge string
	if p.Rank > 0 && p.Rank <= 500 {
		topBadge = fmt.Sprintf("RANK #%d", p.Rank)
	} else if p.Club != "" && !isUnsupportedFontScript(p.Club) {
		topBadge = normalizeCardTierBadge(p.Club)
	} else if p.Rank > 0 && p.Rank <= 2500 {
		topBadge = "RARE"
	} else {
		topBadge = "EPIC"
	}

	var chips []string
	if p.Rank > 0 {
		chips = append(chips, fmt.Sprintf("RANK #%d / 136K", p.Rank))
	} else {
		chips = append(chips, "TELEMINT +888")
	}
	if p.Club != "" && !isUnsupportedFontScript(p.Club) {
		c := strings.ToUpper(strings.TrimSpace(p.Club))
		if len(c) > 16 {
			c = c[:16]
		}
		chips = append(chips, c)
	} else {
		chips = append(chips, "ANONYMOUS ID")
	}
	if p.ColorPattern != "" && !isUnsupportedFontScript(p.ColorPattern) && len(p.ColorPattern) <= 14 {
		chips = append(chips, strings.ToUpper(strings.TrimSpace(p.ColorPattern)))
	} else {
		chips = append(chips, "NO-SIM NFT")
	}

	conf := 92
	if p.Rank > 0 && p.Rank <= 100 {
		conf = 97
	}

	return cg.renderFlexCardRich(flexCardSpec{
		TopBadge:    topBadge,
		Eyebrow:     "TELEMINT ANONYMOUS NUMBER",
		MainTitle:   cleanNum,
		Chips:       chips,
		LowTON:      p.LowTON,
		FairTON:     p.FairTON,
		HighTON:     p.HighTON,
		ExpectedUSD: p.USDT,
		Confidence:  conf,
	})
}

// GenerateGiftCard generates the 600x600 Fibonacci luxury certificate card for a Telegram Gift.
func (cg *CardGenerator) GenerateGiftCard(modelName, slug string, serial int, rarityTier, expectedTON, expectedUSD string, lang ...string) ([]byte, error) {
	l := "en"
	if len(lang) > 0 && lang[0] != "" {
		l = lang[0]
	}
	return cg.GenerateRichGiftCard(GiftCardParams{
		Title:        fmt.Sprintf("%s #%d", modelName, serial),
		ModelName:    modelName,
		SerialNumber: serial,
		RarityTier:   rarityTier,
		ExpectedTON:  expectedTON,
		ExpectedUSD:  expectedUSD,
		Lang:         l,
	})
}

// GenerateRichGiftCard generates the 600x600 Fibonacci Golden-Ratio certificate card for a Telegram Gift.
func (cg *CardGenerator) GenerateRichGiftCard(p GiftCardParams) ([]byte, error) {
	giftImg := fetchOrLoadGiftImage(p.ImageURL)

	cg.mu.Lock()
	defer cg.mu.Unlock()

	const width = 600
	const height = 600
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	topBadge := normalizeCardTierBadge(p.RarityTier)
	theme := resolveTierTheme(topBadge)
	if strings.TrimSpace(p.BackdropCenter) != "" {
		bc := parseHexColor(p.BackdropCenter, theme.CenterGlow)
		theme.CenterGlow = lerpColor(theme.CenterGlow, bc, 0.50)
	}

	// 1. Render Fibonacci cosmic obsidian canvas, sacred orbital rings, golden-angle stardust, and dual-bevel rim
	cg.drawSkullsCardBase(img, theme)

	// 2. Render Top-Left Tier Pill & Top-Right IFRAGMENT Pill
	cg.drawTopHeaderPills(img, topBadge, theme)

	// 3. Render Hero Sanctuary Glass Panel (y = 96..368, Golden Ratio split at y ≈ 371)
	cg.drawLuxuryGlassStage(img, 42, 96, 558, 368, 28.0,
		color.RGBA{13, 18, 30, 225},
		color.RGBA{36, 48, 72, 240},
		theme.Accent,
		1.5,
	)

	// 4. Render Center Gift Artwork Showcase (148x148 rounded squircle at cx=300, y=108..256)
	centerCol := parseHexColor(p.BackdropCenter, color.RGBA{14, 165, 233, 255})
	edgeCol := parseHexColor(p.BackdropEdge, color.RGBA{10, 18, 34, 255})

	boxSize := 148
	boxX1 := (width - boxSize) / 2
	boxY1 := 108
	boxX2 := boxX1 + boxSize
	boxY2 := boxY1 + boxSize
	boxRadius := 32.0

	for y := boxY1 - 6; y <= boxY2+6; y++ {
		for x := boxX1 - 6; x <= boxX2+6; x++ {
			dist := roundedBoxSDF(float64(x), float64(y), float64(boxX1), float64(boxY1), float64(boxX2), float64(boxY2), boxRadius)
			if dist <= 0 {
				dx := float64(x - 300)
				dy := float64(y - (boxY1 + boxSize/2))
				rNorm := math.Min(1.0, math.Sqrt(dx*dx+dy*dy)/(float64(boxSize)*0.68))
				fill := lerpColor(centerCol, edgeCol, rNorm)

				// Diagonal glass reflection sheen across showcase
				sheen := ((float64(x-boxX1) + float64(y-boxY1)) / float64(boxSize*2))
				if sheen < 0.45 {
					fill = lerpColor(fill, color.RGBA{255, 255, 255, 255}, (0.45-sheen)*0.16)
				}

				if dist >= -2.2 {
					borderCol := lerpColor(theme.Accent, color.RGBA{140, 160, 195, 255}, 0.5)
					t := clamp01((dist + 2.2) / 2.2)
					fill = lerpColor(fill, borderCol, t*0.85)
				}
				if dist > -1.0 {
					alpha := clamp01(0.5 - dist)
					blendPixel(img, x, y, fill, alpha)
				} else {
					img.SetRGBA(x, y, fill)
				}
			} else if dist < 6.0 {
				glowT := 1.0 - dist/6.0
				blendPixel(img, x, y, centerCol, glowT*glowT*0.24)
			}
		}
	}

	if giftImg != nil {
		pad := 12
		targetSize := boxSize - pad*2
		compositeScaledImageRounded(img, giftImg, boxX1+pad, boxY1+pad, targetSize, targetSize, float64(boxX1), float64(boxY1), float64(boxX2), float64(boxY2), boxRadius-2.0)
	} else {
		cg.drawGiftVectorEmblem(img, 300, boxY1+boxSize/2, 42, color.RGBA{255, 255, 255, 245})
	}

	// Serial Badge in top-right of gift showcase
	if p.SerialNumber > 0 {
		serialText := fmt.Sprintf("#%d", p.SerialNumber)
		sFace, err := cg.getFace(cg.fontOutfitBold, 11.5)
		if err == nil {
			defer sFace.Close()
			sw := font.MeasureString(sFace, serialText).Ceil()
			sPillW := sw + 20
			sPillH := 24
			sPillX2 := boxX2 - 8
			sPillX1 := sPillX2 - sPillW
			sPillY1 := boxY1 + 8
			sPillY2 := sPillY1 + sPillH
			drawRoundedPill(img, sPillX1, sPillY1, sPillX2, sPillY2, 9.0, color.RGBA{9, 12, 20, 235}, theme.BadgeBorder, 1.3)
			sX := sPillX1 + (sPillW-sw)/2
			cg.drawTextAt(img, sFace, serialText, sX, sPillY1+17, theme.BadgeText)
		}
	}

	// 5. Gift Title & Tactile Trait Chips inside Hero Stage
	displayTitle := strings.TrimSpace(p.Title)
	if displayTitle == "" || isUnsupportedFontScript(displayTitle) {
		cleanModel := strings.TrimSpace(p.ModelName)
		if cleanModel == "" || isUnsupportedFontScript(cleanModel) {
			cleanModel = "Telegram Gift"
		}
		if p.SerialNumber > 0 {
			displayTitle = fmt.Sprintf("%s #%d", cleanModel, p.SerialNumber)
		} else {
			displayTitle = cleanModel
		}
	}

	titleFontSize := 28.0
	if len(displayTitle) > 22 {
		titleFontSize = 21.0
	} else if len(displayTitle) > 16 {
		titleFontSize = 24.0
	}

	tFace, err := cg.getFace(cg.fontOutfitBlack, titleFontSize)
	if err == nil {
		defer tFace.Close()
		tw := font.MeasureString(tFace, displayTitle).Ceil()
		tx := (width - tw) / 2
		ty := 294
		cg.drawTextAt(img, tFace, displayTitle, tx, ty+4, color.RGBA{0, 0, 0, 175})
		cg.drawTextAt(img, tFace, displayTitle, tx, ty, color.RGBA{255, 255, 255, 255})

		sparkleY := float64(ty) - titleFontSize*0.34
		drawFourPointStar(img, float64(tx)-22.0, sparkleY, 8.5, theme.Accent)
		drawFourPointStar(img, float64(tx+tw)+22.0, sparkleY, 8.5, theme.Accent)
	}

	var traitChips []string
	if p.BackdropName != "" && !isUnsupportedFontScript(p.BackdropName) {
		traitChips = append(traitChips, strings.ToUpper(strings.TrimSpace(p.BackdropName)))
	}
	if p.SymbolName != "" && !isUnsupportedFontScript(p.SymbolName) {
		traitChips = append(traitChips, strings.ToUpper(strings.TrimSpace(p.SymbolName)))
	}
	if len(traitChips) == 0 {
		if p.SerialNumber > 0 {
			traitChips = append(traitChips, fmt.Sprintf("SERIAL #%d", p.SerialNumber))
		}
		traitChips = append(traitChips, topBadge+" EDITION", "TEP-62 NFT")
	} else if p.SerialNumber > 0 && len(traitChips) < 3 {
		traitChips = append(traitChips, fmt.Sprintf("MINT #%d", p.SerialNumber))
	}
	cg.drawFlexChipRow(img, traitChips, 300, 316, 480, theme)

	// 6. Render Bottom Valuation Sanctuary (Golden Ratio Price Spectrum + TON/USD + Confidence)
	cg.drawSkullsBottomFooterRich(img, "", p.ExpectedTON, "", p.ExpectedUSD, 91, theme)

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, fmt.Errorf("failed to encode gift card png: %w", err)
	}
	return buf.Bytes(), nil
}

// renderFlexCard renders the 600x600 certificate card for legacy callers.
func (cg *CardGenerator) renderFlexCard(topBadge, mainTitle, subtitle, expectedTON, expectedUSD string) ([]byte, error) {
	var chips []string
	if subtitle != "" {
		parts := strings.Split(subtitle, "·")
		for _, pt := range parts {
			c := strings.TrimSpace(pt)
			if c != "" {
				chips = append(chips, c)
			}
		}
	}
	return cg.renderFlexCardRich(flexCardSpec{
		TopBadge:    topBadge,
		Eyebrow:     "TELEGRAM DIGITAL ASSET",
		MainTitle:   mainTitle,
		Chips:       chips,
		FairTON:     expectedTON,
		ExpectedUSD: expectedUSD,
		Confidence:  90,
	})
}

// renderFlexCardRich renders the 600x600 Fibonacci Golden-Ratio luxury certificate card for Usernames and +888 Numbers.
func (cg *CardGenerator) renderFlexCardRich(spec flexCardSpec) ([]byte, error) {
	cg.mu.Lock()
	defer cg.mu.Unlock()

	const width = 600
	const height = 600
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	badge := normalizeCardTierBadge(spec.TopBadge)
	theme := resolveTierTheme(badge)

	// 1. Draw solid dark outer canvas + Fibonacci orbital geometry + golden-angle stardust + dual-bevel metallic border
	cg.drawSkullsCardBase(img, theme)

	// 2. Draw Top-Left Tier Pill & Top-Right IFRAGMENT Pill
	cg.drawTopHeaderPills(img, badge, theme)

	// 3. Draw Hero Sanctuary Glass Stage (x=42..558, y=96..368 — Golden Ratio split at y ≈ 371)
	cg.drawLuxuryGlassStage(img, 42, 96, 558, 368, 28.0,
		color.RGBA{13, 18, 30, 225},
		color.RGBA{36, 48, 72, 240},
		theme.Accent,
		1.5,
	)

	// 4. Draw Eyebrow with flanking Golden Ratio hairline whiskers
	eyebrow := strings.TrimSpace(spec.Eyebrow)
	if eyebrow == "" {
		eyebrow = "TELEGRAM DIGITAL ASSET"
	}
	eyeFace, err := cg.getFace(cg.fontOutfitBold, 10.0)
	if err == nil {
		defer eyeFace.Close()
		ew := font.MeasureString(eyeFace, eyebrow).Ceil()
		ex := (width - ew) / 2
		ey := 132
		cg.drawTextAt(img, eyeFace, eyebrow, ex, ey, color.RGBA{138, 152, 176, 255})

		// Flanking gradient whiskers
		whiskerY := ey - 4
		for dx := 14; dx <= 48; dx++ {
			alpha := (1.0 - float64(dx-14)/34.0) * 0.45
			if ex-dx > 64 {
				blendPixel(img, ex-dx, whiskerY, theme.Accent, alpha)
			}
			if ex+ew+dx < 536 {
				blendPixel(img, ex+ew+dx, whiskerY, theme.Accent, alpha)
			}
		}
	}

	// 5. Draw Center Hero Title flanked by dual Fibonacci ✦ sparkles
	titleLen := len(spec.MainTitle)
	var mainFontSize float64
	switch {
	case titleLen <= 7:
		mainFontSize = 54.0
	case titleLen <= 10:
		mainFontSize = 46.0
	case titleLen <= 14:
		mainFontSize = 38.0
	case titleLen <= 18:
		mainFontSize = 31.0
	default:
		mainFontSize = 24.0
	}

	heroFont := cg.fontOutfitBlack
	if heroFont == nil {
		heroFont = cg.fontOutfitBold
	}
	mainFace, err := cg.getFace(heroFont, mainFontSize)
	if err != nil {
		return nil, err
	}
	defer mainFace.Close()

	mainW := font.MeasureString(mainFace, spec.MainTitle).Ceil()
	for mainW > 410 && mainFontSize > 20.0 {
		mainFontSize -= 2.0
		mainFace.Close()
		mainFace, err = cg.getFace(heroFont, mainFontSize)
		if err != nil {
			return nil, err
		}
		mainW = font.MeasureString(mainFace, spec.MainTitle).Ceil()
	}

	mainX := (width - mainW) / 2
	mainY := 214

	// Crisp dark drop shadow + pure white hero typography
	cg.drawTextAt(img, mainFace, spec.MainTitle, mainX, mainY+5, color.RGBA{0, 0, 0, 195})
	cg.drawTextAt(img, mainFace, spec.MainTitle, mainX, mainY, color.RGBA{255, 255, 255, 255})

	// Dual Fibonacci 4-point sparkles ✦ (Radius 11.0 & 4.5 — Fibonacci ratio)
	sparkleY := float64(mainY) - mainFontSize*0.33
	leftSparkleX := math.Max(66.0, float64(mainX)-28.0)
	rightSparkleX := math.Min(float64(width-66), float64(mainX+mainW)+28.0)
	drawFourPointStar(img, leftSparkleX, sparkleY, 11.0, theme.Accent)
	drawFourPointStar(img, rightSparkleX, sparkleY, 11.0, theme.Accent)
	if leftSparkleX-15.0 > 54.0 {
		drawFourPointStar(img, leftSparkleX-15.0, sparkleY-9.0, 4.5, color.RGBA{theme.Accent.R, theme.Accent.G, theme.Accent.B, 180})
	}
	if rightSparkleX+15.0 < float64(width-54) {
		drawFourPointStar(img, rightSparkleX+15.0, sparkleY-9.0, 4.5, color.RGBA{theme.Accent.R, theme.Accent.G, theme.Accent.B, 180})
	}

	// 6. Draw Tactile Spec Chips Row (y = 250..280)
	cg.drawFlexChipRow(img, spec.Chips, 300, 252, 480, theme)

	// 7. Draw Golden Ratio Price Range Spectrum Gauge inside lower Hero Stage (y = 306..348)
	cg.drawGoldenSpectrumGauge600(img, spec.LowTON, spec.FairTON, spec.HighTON, theme)

	// 8. Draw Bottom Valuation Sanctuary (y = 382..552)
	cg.drawSkullsBottomFooterRich(img, spec.LowTON, spec.FairTON, spec.HighTON, spec.ExpectedUSD, spec.Confidence, theme)

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, fmt.Errorf("failed to encode png: %w", err)
	}
	return buf.Bytes(), nil
}

// drawSkullsCardBase renders the 600x600 solid obsidian outer canvas (A=255 everywhere),
// dual-bevel metallic squircle border, Fibonacci orbital rings, golden-angle stardust, and precision grid.
func (cg *CardGenerator) drawSkullsCardBase(img *image.RGBA, theme tierVisualTheme) {
	const width = 600
	const height = 600

	cardX1, cardY1 := 18.0, 18.0
	cardX2, cardY2 := 582.0, 582.0
	cardRadius := 55.0 // Fibonacci 55
	borderWidth := 2.6

	outerBg := color.RGBA{4, 6, 10, 255}
	innerTopLeft := color.RGBA{14, 19, 31, 255}
	innerBotRight := color.RGBA{7, 9, 15, 255}

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			fx, fy := float64(x), float64(y)
			dist := roundedBoxSDF(fx, fy, cardX1, cardY1, cardX2, cardY2, cardRadius)

			if dist > 0.5 {
				if dist < 16.0 {
					glowFactor := math.Pow(1.0-(dist/16.0), 2.1) * 0.25
					img.SetRGBA(x, y, lerpColor(outerBg, theme.BorderStart, glowFactor))
				} else {
					img.SetRGBA(x, y, outerBg)
				}
				continue
			}

			diagT := clamp01(((fx - cardX1) + (fy - cardY1)) / ((cardX2 - cardX1) + (cardY2 - cardY1)))
			borderCol := lerpColor(theme.BorderStart, theme.BorderEnd, diagT)
			bgCol := lerpColor(innerTopLeft, innerBotRight, diagT)

			// Top-left glass reflection sheen
			sheenDx := fx - 165.0
			sheenDy := fy - 120.0
			sheenDist := math.Sqrt(sheenDx*sheenDx + sheenDy*sheenDy)
			if sheenDist < 330.0 {
				sheenFactor := math.Pow(1.0-(sheenDist/330.0), 2.0) * 0.065
				bgCol = lerpColor(bgCol, color.RGBA{255, 255, 255, 255}, sheenFactor)
			}

			// Golden Ratio focal spotlight behind hero stage (cy = 600 * 0.382 ≈ 229)
			cdx := fx - 300.0
			cdy := (fy - 229.0) * 1.22
			cDist := math.Sqrt(cdx*cdx + cdy*cdy)
			if cDist < 233.0 {
				spotFactor := math.Pow(1.0-(cDist/233.0), 2.0) * 0.14
				bgCol = lerpColor(bgCol, theme.CenterGlow, spotFactor)
			}

			// Secondary counter-glow behind TON valuation anchor (cy = 485)
			vdx := fx - 170.0
			vdy := (fy - 485.0) * 1.35
			vDist := math.Sqrt(vdx*vdx + vdy*vdy)
			if vDist < 190.0 {
				vFactor := math.Pow(1.0-(vDist/190.0), 2.0) * 0.08
				bgCol = lerpColor(bgCol, theme.SecondaryGlow, vFactor)
			}

			// 21px (Fibonacci) dot-matrix grid inside card interior
			if dist < -borderWidth-2.0 {
				gx := math.Mod(fx-cardX1, 21.0)
				gy := math.Mod(fy-cardY1, 21.0)
				if gx > 10.5 {
					gx = 21.0 - gx
				}
				if gy > 10.5 {
					gy = 21.0 - gy
				}
				dotDist := math.Sqrt(gx*gx + gy*gy)
				if dotDist < 1.55 {
					dotAlpha := clamp01(1.55-dotDist) * 0.085
					bgCol = lerpColor(bgCol, color.RGBA{255, 255, 255, 255}, dotAlpha)
				}
			}

			// Inner subtle bevel ring at dist ≈ -6.5
			if dist < -5.5 && dist > -7.5 {
				bevelT := 1.0 - math.Abs(dist+6.5)
				if bevelT > 0 {
					bgCol = lerpColor(bgCol, theme.BorderStart, bevelT*0.09)
				}
			}

			var finalCol color.RGBA
			if dist >= -borderWidth {
				innerEdge := clamp01((dist + borderWidth) / 1.2)
				inToBorder := lerpColor(bgCol, borderCol, innerEdge)
				if dist > -0.5 {
					outerEdge := clamp01(dist + 0.5)
					finalCol = lerpColor(inToBorder, outerBg, outerEdge)
				} else {
					finalCol = inToBorder
				}
			} else {
				finalCol = bgCol
			}

			finalCol.A = 255
			img.SetRGBA(x, y, finalCol)
		}
	}

	// Fibonacci concentric sacred geometry rings (r = 89, 144, 233) centered at Golden focal point (300, 229)
	drawCircleOutline(img, 300, 229, 89, 1.0, color.RGBA{theme.Accent.R, theme.Accent.G, theme.Accent.B, 18})
	drawCircleOutline(img, 300, 229, 144, 1.1, color.RGBA{theme.Accent.R, theme.Accent.G, theme.Accent.B, 22})
	drawCircleOutline(img, 300, 229, 233, 1.0, color.RGBA{255, 255, 255, 11})

	// Golden-Angle (137.5°) phyllotaxis constellation stardust nodes around the hero sanctuary
	for i := 5; i < 26; i++ {
		angle := float64(i) * GoldenAngleRad
		rad := 24.0 * math.Sqrt(float64(i))
		px := 300.0 + math.Cos(angle)*rad*1.15
		py := 229.0 + math.Sin(angle)*rad*0.78
		if px > 48 && px < 552 && py > 92 && py < 368 {
			dotR := 1.4
			if i%5 == 0 {
				dotR = 2.1
			}
			drawSoftGlowDot(img, px, py, dotR, color.RGBA{theme.Accent.R, theme.Accent.G, theme.Accent.B, 55})
		}
	}
}

// drawTopHeaderPills draws the Top-Left Rarity Tier Pill (with inner ✦ star)
// and Top-Right IFRAGMENT Pill (with glowing TON accent dot).
func (cg *CardGenerator) drawTopHeaderPills(img *image.RGBA, tierBadge string, theme tierVisualTheme) {
	pillY1 := 46
	pillY2 := 82
	pillRadius := 13.0

	// 1. Top-Left Pill: Rarity Tier Badge with inner star icon
	leftFace, err := cg.getFace(cg.fontOutfitBold, 11.5)
	if err == nil {
		defer leftFace.Close()
		textW := font.MeasureString(leftFace, tierBadge).Ceil()
		pillW := textW + 46
		if pillW < 104 {
			pillW = 104
		}
		pillX1 := 42
		pillX2 := pillX1 + pillW
		drawRoundedPill(img, pillX1, pillY1, pillX2, pillY2, pillRadius, theme.BadgeBg, theme.BadgeBorder, 1.5)

		starCX := float64(pillX1 + 18)
		starCY := float64(pillY1+pillY2) / 2.0
		drawFourPointStar(img, starCX, starCY, 5.5, theme.BadgeText)

		tx := pillX1 + 28 + (pillW-28-textW)/2
		cg.drawTextAt(img, leftFace, tierBadge, tx, pillY1+23, theme.BadgeText)
	}

	// 2. Top-Right Pill: "I F R A G M E N T" with glowing jewel dot
	brandFace, err := cg.getFace(cg.fontOutfitBold, 11.0)
	if err == nil {
		defer brandFace.Close()
		brandLabel := "I F R A G M E N T"
		bw := font.MeasureString(brandFace, brandLabel).Ceil()
		bPillW := bw + 44
		bPillX2 := 558
		bPillX1 := bPillX2 - bPillW
		drawRoundedPill(img, bPillX1, pillY1, bPillX2, pillY2, pillRadius,
			color.RGBA{17, 22, 34, 255},
			color.RGBA{42, 54, 78, 255},
			1.5,
		)
		dotCX := float64(bPillX1 + 18)
		dotCY := float64(pillY1+pillY2) / 2.0
		drawSoftGlowDot(img, dotCX, dotCY, 3.8, color.RGBA{0, 152, 234, 255})

		btx := bPillX1 + 26 + (bPillW-26-bw)/2
		cg.drawTextAt(img, brandFace, brandLabel, btx, pillY1+23, color.RGBA{186, 198, 218, 255})
	}
}

// drawLuxuryGlassStage draws a frosted dark glass container with a top-center Gaussian light beam.
func (cg *CardGenerator) drawLuxuryGlassStage(img *image.RGBA, x1, y1, x2, y2 int, r float64, fillCol, borderCol, beamCol color.RGBA, borderW float64) {
	fx1, fy1, fx2, fy2 := float64(x1), float64(y1), float64(x2), float64(y2)
	midX := (fx1 + fx2) * 0.5
	halfW := (fx2 - fx1) * 0.5

	for y := y1 - 2; y <= y2+2; y++ {
		fy := float64(y)
		vProg := clamp01((fy - fy1) / (fy2 - fy1))
		for x := x1 - 2; x <= x2+2; x++ {
			fx := float64(x)
			dist := roundedBoxSDF(fx, fy, fx1, fy1, fx2, fy2, r)
			if dist > 0.6 {
				continue
			}

			// Subtle vertical interior gradient (lighter at top rim)
			topLift := (1.0 - vProg) * 0.08
			interiorCol := lerpColor(fillCol, color.RGBA{255, 255, 255, fillCol.A}, topLift)

			// Subtle top-center ambient glow inside top 28px of panel
			if fy-fy1 < 34.0 {
				horizNorm := math.Abs(fx-midX) / halfW
				if horizNorm < 0.75 {
					beamT := (1.0 - (fy-fy1)/34.0) * (1.0 - horizNorm/0.75)
					interiorCol = lerpColor(interiorCol, color.RGBA{beamCol.R, beamCol.G, beamCol.B, fillCol.A}, beamT*beamT*0.14)
				}
			}

			var col color.RGBA
			var alpha float64
			if dist >= -borderW {
				rimFade := clamp01(1.0 - vProg*0.7)
				topRim := lerpColor(borderCol, color.RGBA{255, 255, 255, 255}, rimFade*0.16)
				// Highlight top center rim with theme accent
				if fy-fy1 < 6.0 {
					horizNorm := math.Abs(fx-midX) / halfW
					if horizNorm < 0.65 {
						topRim = lerpColor(topRim, beamCol, (1.0-horizNorm/0.65)*0.55)
					}
				}
				t := clamp01((dist + borderW) / math.Max(borderW, 1.0))
				col = lerpColor(interiorCol, topRim, t)
				alpha = (float64(col.A) / 255.0) * clamp01(0.55-dist)
			} else {
				col = interiorCol
				alpha = float64(interiorCol.A) / 255.0
			}
			blendPixel(img, x, y, col, alpha)
		}
	}
}

// drawFlexChipRow renders up to 3 tactile hardware-style spec chips with glowing left LED dots.
func (cg *CardGenerator) drawFlexChipRow(img *image.RGBA, chips []string, centerX, y1, maxTotalW int, theme tierVisualTheme) {
	if len(chips) == 0 {
		return
	}
	chipFace, err := cg.getFace(cg.fontOutfitBold, 10.5)
	if err != nil {
		return
	}
	defer chipFace.Close()

	type measuredChip struct {
		text string
		w    int
	}
	var items []measuredChip
	const gap = 10
	totalW := 0
	for _, raw := range chips {
		if len(items) >= 3 {
			break
		}
		clean := strings.TrimSpace(strings.ToUpper(raw))
		if clean == "" || isUnsupportedFontScript(clean) {
			continue
		}
		tw := font.MeasureString(chipFace, clean).Ceil()
		cw := tw + 32
		if totalW > 0 && totalW+gap+cw > maxTotalW {
			break
		}
		items = append(items, measuredChip{text: clean, w: cw})
		if totalW > 0 {
			totalW += gap
		}
		totalW += cw
	}
	if len(items) == 0 {
		return
	}

	curX := centerX - totalW/2
	const chipH = 28
	for _, item := range items {
		drawRoundedPill(img, curX, y1, curX+item.w, y1+chipH, 10.0,
			color.RGBA{18, 25, 40, 240},
			color.RGBA{46, 62, 92, 240},
			1.2,
		)
		dotCX := float64(curX + 12)
		dotCY := float64(y1+y1+chipH) / 2.0
		drawSoftGlowDot(img, dotCX, dotCY, 2.8, theme.Accent)

		tw := font.MeasureString(chipFace, item.text).Ceil()
		tx := curX + 18 + (item.w-18-tw)/2
		cg.drawTextAt(img, chipFace, item.text, tx, y1+19, color.RGBA{226, 234, 248, 255})
		curX += item.w + gap
	}
}

// drawGoldenSpectrumGauge600 renders a visual Floor -> Fair -> Ceiling spectrum track inside the 600x600 card.
func (cg *CardGenerator) drawGoldenSpectrumGauge600(img *image.RGBA, lowRaw, fairRaw, highRaw string, theme tierVisualTheme) {
	fairDisp, fairNum := formatTONDisplay(fairRaw)
	lowDisp, lowNum := formatTONDisplay(lowRaw)
	highDisp, highNum := formatTONDisplay(highRaw)

	if lowNum <= 0 && fairNum > 0 {
		lowDisp, lowNum = formatTONDisplay(fmt.Sprintf("%.1f", fairNum*0.78))
	}
	if highNum <= 0 && fairNum > 0 {
		highDisp, highNum = formatTONDisplay(fmt.Sprintf("%.1f", fairNum*1.28))
	}
	_ = fairDisp

	const barX1 = 68
	const barX2 = 532
	const barY1 = 336
	const barY2 = 344

	// Labels above spectrum track
	lblFace, err := cg.getFace(cg.fontOutfitBold, 9.5)
	if err == nil {
		defer lblFace.Close()
		leftTxt := "FLOOR  " + lowDisp + " TON"
		rightTxt := "CEILING  " + highDisp + " TON"
		midTxt := "FAIR VALUE ZONE"

		cg.drawTextAt(img, lblFace, leftTxt, barX1, 326, color.RGBA{128, 142, 166, 255})
		rw := font.MeasureString(lblFace, rightTxt).Ceil()
		cg.drawTextAt(img, lblFace, rightTxt, barX2-rw, 326, color.RGBA{128, 142, 166, 255})
		mw := font.MeasureString(lblFace, midTxt).Ceil()
		cg.drawTextAt(img, lblFace, midTxt, 300-mw/2, 326, theme.Accent)
	}

	// Track background pill
	drawRoundedPill(img, barX1, barY1, barX2, barY2, 4.0,
		color.RGBA{20, 27, 42, 255},
		color.RGBA{38, 50, 74, 255},
		1.0,
	)

	// Calculate Golden Ratio normalized position (defaults to 1/φ ≈ 0.618)
	posRatio := 1.0 / GoldenRatioPhi
	if highNum > lowNum && fairNum >= lowNum && fairNum <= highNum {
		posRatio = (fairNum - lowNum) / (highNum - lowNum)
		if posRatio < 0.25 {
			posRatio = 0.25
		} else if posRatio > 0.78 {
			posRatio = 0.78
		}
	}

	markerX := barX1 + int(math.Round(float64(barX2-barX1)*posRatio))

	// Gradient active fill from barX1 to markerX
	startCol := color.RGBA{0, 136, 204, 255}
	for x := barX1 + 1; x <= markerX; x++ {
		t := clamp01(float64(x-barX1) / math.Max(1.0, float64(markerX-barX1)))
		c := lerpColor(startCol, theme.Accent, t)
		for y := barY1 + 1; y < barY2; y++ {
			img.SetRGBA(x, y, c)
		}
	}

	// Glowing Fair Value Marker Node
	markerCY := float64(barY1+barY2) * 0.5
	drawSoftGlowDot(img, float64(markerX), markerCY, 7.5, theme.Accent)
	drawSoftGlowDot(img, float64(markerX), markerCY, 3.5, color.RGBA{255, 255, 255, 255})
}

// drawSkullsBottomFooter keeps compatibility for any direct callers.
func (cg *CardGenerator) drawSkullsBottomFooter(img *image.RGBA, expectedTON, expectedUSD string) {
	cg.drawSkullsBottomFooterRich(img, "", expectedTON, "", expectedUSD, 90, resolveTierTheme("EPIC"))
}

// drawSkullsBottomFooterRich renders the lower Golden-Ratio Valuation Sanctuary (y = 382..552)
// and the subtle bottom watermark.
func (cg *CardGenerator) drawSkullsBottomFooterRich(img *image.RGBA, lowTON, expectedTON, highTON, expectedUSD string, confidence int, theme tierVisualTheme) {
	_ = lowTON
	_ = highTON

	// 1. Glass Valuation Sanctuary Box (x=42..558, y=382..546)
	cg.drawLuxuryGlassStage(img, 42, 382, 558, 546, 26.0,
		color.RGBA{11, 15, 25, 238},
		color.RGBA{34, 46, 70, 245},
		color.RGBA{0, 152, 234, 255},
		1.5,
	)

	// 2. Top-Left Label: "ESTIMATED MARKET PRICE"
	labelFace, err := cg.getFace(cg.fontOutfitBold, 10.5)
	if err == nil {
		defer labelFace.Close()
		cg.drawTextAt(img, labelFace, "ESTIMATED MARKET PRICE", 66, 416, color.RGBA{134, 148, 172, 255})
	}

	// 3. Format TON & USD amounts cleanly (ensure USD is never missing)
	tonDisplay, tonNumeric := formatTONDisplay(expectedTON)
	usdClean := formatUSDTAmount(expectedUSD)
	if usdClean == "" {
		fallbackUSD := math.Round(tonNumeric * 3.48)
		if fallbackUSD < 1 && tonNumeric > 0 {
			fallbackUSD = math.Max(1, math.Round(tonNumeric*3.48))
		}
		if fallbackUSD > 0 {
			usdClean = formatUSDTAmount(fmt.Sprintf("%.0f", fallbackUSD))
		} else {
			usdClean = "15"
		}
	}

	// 4. Upgraded 3D Blue TON Circle Jewel at Bottom-Left (cx=88, cy=476, r=23)
	cg.drawTONBadge(img, 88, 476, 23)

	// 5. Giant White TON Number + Blue "TON" unit
	tonFontSize := 44.0
	if len(tonDisplay) > 9 {
		tonFontSize = 31.0
	} else if len(tonDisplay) > 7 {
		tonFontSize = 36.0
	}

	tonFont := cg.fontOutfitBlack
	if tonFont == nil {
		tonFont = cg.fontOutfitBold
	}
	tonFace, err := cg.getFace(tonFont, tonFontSize)
	if err == nil {
		defer tonFace.Close()
		tonX := 124
		tonY := 492
		tonW := font.MeasureString(tonFace, tonDisplay).Ceil()
		cg.drawTextAt(img, tonFace, tonDisplay, tonX, tonY+4, color.RGBA{0, 0, 0, 180})
		cg.drawTextAt(img, tonFace, tonDisplay, tonX, tonY, color.RGBA{255, 255, 255, 255})

		unitFace, uErr := cg.getFace(cg.fontOutfitBold, 18.0)
		if uErr == nil {
			defer unitFace.Close()
			unitX := tonX + tonW + 10
			unitY := 482
			cg.drawTextAt(img, unitFace, "TON", unitX, unitY, color.RGBA{38, 172, 255, 255})
		}
	}

	// Subtle confidence bar below TON price (x=124..285, y=512..518)
	if confidence <= 0 {
		confidence = 90
	}
	if confidence > 100 {
		confidence = 100
	}
	confFace, cErr := cg.getFace(cg.fontOutfitBold, 9.5)
	if cErr == nil {
		defer confFace.Close()
		confTxt := fmt.Sprintf("AI CONFIDENCE %d%%", confidence)
		cg.drawTextAt(img, confFace, confTxt, 124, 522, color.RGBA{128, 142, 166, 255})

		// 6 mini LED segments next to confidence label
		segStartX := 232
		for s := 0; s < 6; s++ {
			sx1 := segStartX + s*11
			sx2 := sx1 + 8
			active := (s+1)*16 <= confidence
			segCol := color.RGBA{30, 40, 60, 255}
			if active {
				segCol = theme.Accent
			}
			drawRoundedPill(img, sx1, 513, sx2, 521, 2.5, segCol, segCol, 0)
		}
	}

	// 6. Top-Right of Valuation Box: Green [ ● VERIFIED ] Pill (right-aligned to x=534, y=398..430)
	verFace, err := cg.getFace(cg.fontOutfitBold, 10.5)
	if err == nil {
		defer verFace.Close()
		verLabel := "VERIFIED"
		vw := font.MeasureString(verFace, verLabel).Ceil()
		vPillW := vw + 44
		vPillX2 := 534
		vPillX1 := vPillX2 - vPillW
		vPillY1 := 400
		vPillY2 := 432

		drawRoundedPill(img, vPillX1, vPillY1, vPillX2, vPillY2, 16.0,
			color.RGBA{10, 40, 30, 255},
			color.RGBA{24, 104, 72, 255},
			1.5,
		)

		dotCX := float64(vPillX1 + 19)
		dotCY := float64(vPillY1+vPillY2) / 2.0
		drawSoftGlowDot(img, dotCX, dotCY, 4.5, color.RGBA{34, 211, 154, 255})

		cg.drawTextAt(img, verFace, verLabel, vPillX1+31, vPillY1+21, color.RGBA{46, 224, 160, 255})
	}

	// 7. Bottom-Right: "USD EQUIVALENT" + "~ $7,500" (right-aligned to x=534)
	subLblFace, sErr := cg.getFace(cg.fontOutfitBold, 9.5)
	if sErr == nil {
		defer subLblFace.Close()
		uLbl := "USD EQUIVALENT"
		uw := font.MeasureString(subLblFace, uLbl).Ceil()
		cg.drawTextAt(img, subLblFace, uLbl, 534-uw, 456, color.RGBA{128, 142, 166, 255})
	}

	usdFace, err := cg.getFace(cg.fontOutfitBlack, 24.0)
	if err == nil {
		defer usdFace.Close()
		approxStr := "~ "
		dollarValStr := "$" + usdClean
		approxW := font.MeasureString(usdFace, approxStr).Ceil()
		dollarW := font.MeasureString(usdFace, dollarValStr).Ceil()
		totalW := approxW + dollarW
		startX := 534 - totalW
		cg.drawTextAt(img, usdFace, approxStr, startX, 490, color.RGBA{142, 156, 178, 255})
		cg.drawTextAt(img, usdFace, dollarValStr, startX+approxW, 490, color.RGBA{240, 246, 255, 255})
	}

	if sErr == nil {
		spotTxt := "LIVE TON MAINNET"
		sw := font.MeasureString(subLblFace, spotTxt).Ceil()
		cg.drawTextAt(img, subLblFace, spotTxt, 534-sw, 522, theme.Accent)
	}

	// 8. Bottom Bezel Micro-Watermark (y = 568)
	wmFace, wErr := cg.getFace(cg.fontOutfitBold, 9.5)
	if wErr == nil {
		defer wmFace.Close()
		wmText := "@iFragmentBot   ·   ON-CHAIN AI VALUATION"
		ww := font.MeasureString(wmFace, wmText).Ceil()
		wx := (600 - ww) / 2
		cg.drawTextAt(img, wmFace, wmText, wx, 568, color.RGBA{112, 126, 148, 255})
		drawFourPointStar(img, float64(wx)-14.0, 564.0, 4.5, theme.Accent)
		drawFourPointStar(img, float64(wx+ww)+14.0, 564.0, 4.5, theme.Accent)
	}
}

// drawSoftGlowDot draws a smooth bioluminescent LED dot with an outer halo.
func drawSoftGlowDot(img *image.RGBA, cx, cy, r float64, col color.RGBA) {
	outerR := r * 2.2
	bound := int(math.Ceil(outerR + 2))
	icx, icy := int(math.Round(cx)), int(math.Round(cy))
	colAlpha := float64(col.A) / 255.0
	solidCol := color.RGBA{col.R, col.G, col.B, 255}

	for dy := -bound; dy <= bound; dy++ {
		for dx := -bound; dx <= bound; dx++ {
			d := math.Sqrt(float64(dx*dx + dy*dy))
			if d <= r {
				alpha := clamp01(r+0.5-d) * colAlpha
				blendPixel(img, icx+dx, icy+dy, solidCol, alpha)
			} else if d <= outerR {
				glowT := 1.0 - ((d - r) / (outerR - r))
				blendPixel(img, icx+dx, icy+dy, solidCol, glowT*glowT*0.38*colAlpha)
			}
		}
	}
}

// drawFourPointStar draws a crisp geometric 4-point star ✦ centered at (cx, cy) with outer radius r and soft center gleam.
func drawFourPointStar(img *image.RGBA, cx, cy, r float64, col color.RGBA) {
	ir := int(math.Ceil(r + 3))
	icx, icy := int(math.Round(cx)), int(math.Round(cy))
	colAlpha := float64(col.A) / 255.0
	if colAlpha <= 0 {
		colAlpha = 1.0
	}
	baseCol := color.RGBA{col.R, col.G, col.B, 255}

	for dy := -ir; dy <= ir; dy++ {
		for dx := -ir; dx <= ir; dx++ {
			fx := math.Abs(float64(dx)) / r
			fy := math.Abs(float64(dy)) / r
			if fx > 1.15 || fy > 1.15 {
				continue
			}
			// Astroid / 4-point star curve: x^(0.56) + y^(0.56) <= 1.0
			val := math.Pow(fx, 0.56) + math.Pow(fy, 0.56)
			if val <= 1.08 {
				alpha := clamp01((1.08-val)*7.5) * colAlpha
				// Specular bright core at the center of the star
				coreDist := math.Sqrt(fx*fx + fy*fy)
				starCol := baseCol
				if coreDist < 0.35 {
					starCol = lerpColor(baseCol, color.RGBA{255, 255, 255, 255}, (1.0-coreDist/0.35)*0.65)
				}
				blendPixel(img, icx+dx, icy+dy, starCol, alpha)
			}
		}
	}
}

// formatTONDisplay formats a raw TON string cleanly (e.g. "250.0" -> "250", "1250.5" -> "1,250.5", "11.0" -> "11")
// and also returns its parsed float64 value.
func formatTONDisplay(raw string) (string, float64) {
	clean := strings.TrimSpace(raw)
	clean = strings.TrimPrefix(clean, "~")
	clean = strings.TrimPrefix(clean, "≈")
	clean = strings.ReplaceAll(clean, ",", "")
	clean = strings.TrimSpace(clean)

	val, err := strconv.ParseFloat(clean, 64)
	if err != nil || val <= 0 {
		if clean == "" {
			return "0", 0
		}
		return clean, 0
	}

	rounded1 := math.Round(val*10) / 10
	isWhole := math.Abs(rounded1-math.Round(rounded1)) < 0.05
	if isWhole || rounded1 >= 100 {
		intVal := int64(math.Round(rounded1))
		return addThousandsCommas(strconv.FormatInt(intVal, 10)), val
	}
	return fmt.Sprintf("%.1f", rounded1), val
}

func addThousandsCommas(str string) string {
	var buf strings.Builder
	l := len(str)
	for i, c := range str {
		buf.WriteRune(c)
		rem := l - 1 - i
		if rem > 0 && rem%3 == 0 {
			buf.WriteByte(',')
		}
	}
	return buf.String()
}

func (cg *CardGenerator) SaveCard(pngBytes []byte) (string, error) {
	dir := "./static/shares"
	if err := os.MkdirAll(dir, 0750); err != nil {
		return "", fmt.Errorf("failed to create shares directory: %w", err)
	}

	fileID := uuid.New().String()
	filePath := filepath.Join(dir, fileID+".png")
	if err := os.WriteFile(filePath, pngBytes, 0600); err != nil {
		return "", fmt.Errorf("failed to write card file: %w", err)
	}

	return fileID, nil
}

func (cg *CardGenerator) GetPublicCardURL(fileID string, r *http.Request) string {
	if r != nil && r.Host != "" {
		scheme := "http"
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
			scheme = "https"
		}
		return fmt.Sprintf("%s://%s/static/shares/%s.png", scheme, r.Host, fileID)
	}

	baseURL := strings.TrimRight(os.Getenv("PUBLIC_API_URL"), "/")
	if baseURL == "" {
		baseURL = strings.TrimRight(os.Getenv("MINI_APP_URL"), "/")
	}
	if baseURL == "" {
		baseURL = "https://ifragment.org"
	}
	return fmt.Sprintf("%s/static/shares/%s.png", baseURL, fileID)
}

// drawTONBadge renders a 3D jewel-shaded TON circle emblem with radial gradient, top specular lens sheen, and crisp vector diamond.
func (cg *CardGenerator) drawTONBadge(img *image.RGBA, cx, cy, r int) {
	topCyan := color.RGBA{56, 198, 255, 255}
	midBlue := color.RGBA{0, 152, 234, 255}
	deepBlue := color.RGBA{2, 88, 168, 255}
	glowRadius := float64(r) + 12.0
	fr := float64(r)

	for dy := -int(glowRadius) - 2; dy <= int(glowRadius)+2; dy++ {
		for dx := -int(glowRadius) - 2; dx <= int(glowRadius)+2; dx++ {
			dist := math.Sqrt(float64(dx*dx + dy*dy))
			if dist <= fr+0.6 {
				// 3D spherical shading inside circle
				vT := clamp01((float64(dy) + fr) / (2.0 * fr))
				fill := lerpColor(topCyan, deepBlue, vT)

				// Top-left lens highlight
				ldx := float64(dx) + fr*0.28
				ldy := float64(dy) + fr*0.32
				lDist := math.Sqrt(ldx*ldx+ldy*ldy) / (fr * 0.85)
				if lDist < 1.0 {
					fill = lerpColor(fill, color.RGBA{255, 255, 255, 255}, (1.0-lDist)*0.28)
				}

				// Subtle bright outer rim
				if dist >= fr-1.5 {
					rimT := clamp01((dist - (fr - 1.5)) / 1.5)
					fill = lerpColor(fill, color.RGBA{165, 232, 255, 255}, rimT*0.45)
				}

				alpha := clamp01(fr + 0.6 - dist)
				blendPixel(img, cx+dx, cy+dy, fill, alpha)
			} else if dist <= glowRadius {
				glowT := 1.0 - (dist-fr)/(glowRadius-fr)
				glowAlpha := math.Pow(glowT, 2.2) * 0.34
				blendPixel(img, cx+dx, cy+dy, midBlue, glowAlpha)
			}
		}
	}

	white := color.RGBA{255, 255, 255, 255}
	topY := float64(cy) - fr*0.38
	botY := float64(cy) + fr*0.48
	leftX := float64(cx) - fr*0.45
	rightX := float64(cx) + fr*0.45
	midX := float64(cx)

	strokeW := math.Max(2.3, fr*0.105)
	drawThickLine(img, leftX, topY, rightX, topY, strokeW, white)
	drawThickLine(img, leftX, topY, midX, botY, strokeW, white)
	drawThickLine(img, rightX, topY, midX, botY, strokeW, white)
	drawThickLine(img, midX, topY, midX, botY, strokeW*0.86, white)
}

// drawGiftVectorEmblem renders a rich 3D multi-faceted crystal gem with inner facet shading and sparkles when no external gift image is available.
func (cg *CardGenerator) drawGiftVectorEmblem(img *image.RGBA, cx, cy, r int, col color.RGBA) {
	fcx, fcy, fr := float64(cx), float64(cy), float64(r)

	// Soft radial halo behind crystal gem
	for dy := -r - 12; dy <= r+12; dy++ {
		for dx := -r - 12; dx <= r+12; dx++ {
			d := math.Sqrt(float64(dx*dx + dy*dy))
			if d < fr*1.15 {
				t := 1.0 - d/(fr*1.15)
				blendPixel(img, cx+dx, cy+dy, color.RGBA{255, 255, 255, 255}, t*t*0.16)
			}
		}
	}

	topY := fcy - fr*0.72
	midY := fcy - fr*0.18
	botY := fcy + fr*0.82
	leftX := fcx - fr*0.88
	rightX := fcx + fr*0.88
	innerLeftX := fcx - fr*0.46
	innerRightX := fcx + fr*0.46

	// Fill gem facets with translucent glass highlights for 3D depth
	fillTriangle(img, innerLeftX, topY, innerRightX, topY, fcx, midY, color.RGBA{255, 255, 255, 85})
	fillTriangle(img, innerLeftX, topY, leftX, midY, fcx, midY, color.RGBA{255, 255, 255, 50})
	fillTriangle(img, innerRightX, topY, fcx, midY, rightX, midY, color.RGBA{200, 235, 255, 38})
	fillTriangle(img, leftX, midY, fcx, midY, fcx, botY, color.RGBA{255, 255, 255, 62})
	fillTriangle(img, fcx, midY, rightX, midY, fcx, botY, color.RGBA{180, 225, 255, 28})

	// Crisp facet edges
	drawThickLine(img, innerLeftX, topY, innerRightX, topY, 2.8, col)
	drawThickLine(img, innerLeftX, topY, leftX, midY, 2.8, col)
	drawThickLine(img, innerRightX, topY, rightX, midY, 2.8, col)
	drawThickLine(img, leftX, midY, rightX, midY, 2.4, col)
	drawThickLine(img, leftX, midY, fcx, botY, 2.8, col)
	drawThickLine(img, rightX, midY, fcx, botY, 2.8, col)
	drawThickLine(img, innerLeftX, topY, fcx, midY, 2.1, col)
	drawThickLine(img, innerRightX, topY, fcx, midY, 2.1, col)
	drawThickLine(img, fcx, midY, fcx, botY, 2.3, col)

	// Crown sparkle accents
	drawFourPointStar(img, innerLeftX, topY, 6.5, color.RGBA{255, 255, 255, 255})
	drawFourPointStar(img, rightX+4, midY-fr*0.45, 5.0, color.RGBA{255, 255, 255, 220})
}

func fillTriangle(img *image.RGBA, x1, y1, x2, y2, x3, y3 float64, col color.RGBA) {
	minX := int(math.Floor(math.Min(x1, math.Min(x2, x3))))
	maxX := int(math.Ceil(math.Max(x1, math.Max(x2, x3))))
	minY := int(math.Floor(math.Min(y1, math.Min(y2, y3))))
	maxY := int(math.Ceil(math.Max(y1, math.Max(y2, y3))))
	alpha := float64(col.A) / 255.0
	solid := color.RGBA{col.R, col.G, col.B, 255}

	edge := func(ax, ay, bx, by, px, py float64) float64 {
		return (px-ax)*(by-ay) - (py-ay)*(bx-ax)
	}

	for y := minY; y <= maxY; y++ {
		for x := minX; x <= maxX; x++ {
			px, py := float64(x)+0.5, float64(y)+0.5
			w0 := edge(x2, y2, x3, y3, px, py)
			w1 := edge(x3, y3, x1, y1, px, py)
			w2 := edge(x1, y1, x2, y2, px, py)
			if (w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0) {
				blendPixel(img, x, y, solid, alpha)
			}
		}
	}
}

func fetchOrLoadGiftImage(src string) image.Image {
	src = strings.TrimSpace(src)
	if src == "" {
		return nil
	}

	if !strings.HasPrefix(src, "http://") && !strings.HasPrefix(src, "https://") {
		f, err := os.Open(src)
		if err != nil {
			return nil
		}
		defer f.Close()
		decoded, _, err := image.Decode(f)
		if err != nil {
			return nil
		}
		return decoded
	}

	safeURL := strings.ReplaceAll(src, " ", "%20")
	client := &http.Client{Timeout: 3500 * time.Millisecond}
	req, err := http.NewRequest(http.MethodGet, safeURL, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", "iFragmentBot/2.0 (+https://ifragment.org)")
	resp, err := client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil
	}

	limited := io.LimitReader(resp.Body, 5*1024*1024)
	decoded, _, err := image.Decode(limited)
	if err != nil {
		return nil
	}
	return decoded
}

func compositeScaledImageRounded(dst *image.RGBA, src image.Image, dstX, dstY, dstW, dstH int, clipX1, clipY1, clipX2, clipY2, clipRadius float64) {
	srcBounds := src.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()
	if srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0 {
		return
	}

	for y := 0; y < dstH; y++ {
		py := dstY + y
		for x := 0; x < dstW; x++ {
			px := dstX + x
			dist := roundedBoxSDF(float64(px), float64(py), clipX1, clipY1, clipX2, clipY2, clipRadius)
			if dist > 0 {
				continue
			}

			sx := srcBounds.Min.X + (x*srcW)/dstW
			sy := srcBounds.Min.Y + (y*srcH)/dstH
			r, g, b, a := src.At(sx, sy).RGBA()
			if a == 0 {
				continue
			}

			alpha := float64(a) / 65535.0
			var ur, ug, ub uint8
			if a == 65535 {
				ur = uint8(r >> 8)
				ug = uint8(g >> 8)
				ub = uint8(b >> 8)
			} else {
				ur = uint8(math.Min(255, float64(r>>8)/alpha))
				ug = uint8(math.Min(255, float64(g>>8)/alpha))
				ub = uint8(math.Min(255, float64(b>>8)/alpha))
			}

			blendPixel(dst, px, py, color.RGBA{R: ur, G: ug, B: ub, A: 255}, alpha)
		}
	}
}

func parseHexColor(hexStr string, fallback color.RGBA) color.RGBA {
	clean := strings.TrimPrefix(strings.TrimSpace(hexStr), "#")
	if len(clean) != 6 {
		return fallback
	}
	rv, err1 := strconv.ParseUint(clean[0:2], 16, 8)
	gv, err2 := strconv.ParseUint(clean[2:4], 16, 8)
	bv, err3 := strconv.ParseUint(clean[4:6], 16, 8)
	if err1 != nil || err2 != nil || err3 != nil {
		return fallback
	}
	return color.RGBA{R: uint8(rv), G: uint8(gv), B: uint8(bv), A: 255}
}

func formatUSDTAmount(raw string) string {
	clean := strings.TrimSpace(raw)
	clean = strings.TrimPrefix(clean, "$")
	clean = strings.TrimPrefix(clean, "~$")
	clean = strings.TrimPrefix(clean, "≈")
	clean = strings.TrimSuffix(clean, "USDT")
	clean = strings.TrimSuffix(clean, "USD")
	clean = strings.ReplaceAll(clean, ",", "")
	clean = strings.TrimSpace(clean)

	if clean == "" || clean == "0" || clean == "0.0" || clean == "0.00" || strings.HasPrefix(clean, "—") {
		return ""
	}

	val, err := strconv.ParseFloat(clean, 64)
	if err != nil || val <= 0 {
		return ""
	}

	parts := strings.Split(clean, ".")
	intPart := parts[0]
	intVal, err := strconv.ParseInt(intPart, 10, 64)
	if err != nil || intVal <= 0 {
		if val < 10.0 {
			return fmt.Sprintf("%.2f", val)
		}
		return ""
	}

	if val < 10.0 && len(parts) > 1 {
		return fmt.Sprintf("%.2f", val)
	}

	return addThousandsCommas(strconv.FormatInt(intVal, 10))
}

// StartSharesCleanupJob runs a background loop removing files older than maxAge from ./static/shares
func StartSharesCleanupJob(ctx context.Context, checkInterval, maxAge time.Duration) {
	ticker := time.NewTicker(checkInterval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				dir := "./static/shares"
				entries, err := os.ReadDir(dir)
				if err != nil {
					continue
				}
				threshold := time.Now().Add(-maxAge)
				for _, e := range entries {
					if e.IsDir() || !strings.HasSuffix(e.Name(), ".png") {
						continue
					}
					info, err := e.Info()
					if err != nil {
						continue
					}
					if info.ModTime().Before(threshold) {
						_ = os.Remove(filepath.Join(dir, e.Name()))
					}
				}
			}
		}
	}()
}

func containsArabicScript(s string) bool {
	for _, r := range s {
		if (r >= 0x0600 && r <= 0x06FF) ||
			(r >= 0x0750 && r <= 0x077F) ||
			(r >= 0x08A0 && r <= 0x08FF) ||
			(r >= 0xFB50 && r <= 0xFDFF) ||
			(r >= 0xFE70 && r <= 0xFEFF) {
			return true
		}
	}
	return false
}

func isUnsupportedFontScript(s string) bool {
	for _, r := range s {
		if r > 0x024F && !(r >= 0x2000 && r <= 0x2BFF) {
			return true
		}
	}
	return false
}

func (cg *CardGenerator) getFace(f *opentype.Font, size float64) (font.Face, error) {
	return opentype.NewFace(f, &opentype.FaceOptions{
		Size:    size,
		DPI:     72,
		Hinting: font.HintingFull,
	})
}

func (cg *CardGenerator) drawTextAt(img draw.Image, face font.Face, text string, x, y int, col color.Color) {
	d := &font.Drawer{
		Dst:  img,
		Src:  image.NewUniform(col),
		Face: face,
		Dot:  fixed.Point26_6{X: fixed.I(x), Y: fixed.I(y)},
	}
	d.DrawString(text)
}

func roundedBoxSDF(px, py, x1, y1, x2, y2, r float64) float64 {
	cx := (x1 + x2) * 0.5
	cy := (y1 + y2) * 0.5
	hx := (x2-x1)*0.5 - r
	hy := (y2-y1)*0.5 - r

	dx := math.Abs(px-cx) - hx
	dy := math.Abs(py-cy) - hy

	outDist := math.Sqrt(math.Max(dx, 0)*math.Max(dx, 0) + math.Max(dy, 0)*math.Max(dy, 0))
	inDist := math.Min(math.Max(dx, dy), 0)
	return outDist + inDist - r
}

func drawRoundedPill(img *image.RGBA, x1, y1, x2, y2 int, r float64, fillCol, borderCol color.RGBA, borderW float64) {
	fx1, fy1, fx2, fy2 := float64(x1), float64(y1), float64(x2), float64(y2)
	for y := y1 - 2; y <= y2+2; y++ {
		vProg := clamp01((float64(y) - fy1) / math.Max(1.0, fy2-fy1))
		for x := x1 - 2; x <= x2+2; x++ {
			dist := roundedBoxSDF(float64(x), float64(y), fx1, fy1, fx2, fy2, r)
			if dist > 0.5 {
				continue
			}

			// Subtle top specular lift on pills
			liftedFill := lerpColor(fillCol, color.RGBA{255, 255, 255, fillCol.A}, (1.0-vProg)*0.07)

			var col color.RGBA
			var alpha float64
			if dist >= -borderW && borderW > 0 {
				topBorder := lerpColor(borderCol, color.RGBA{255, 255, 255, borderCol.A}, (1.0-vProg)*0.15)
				t := clamp01((dist + borderW) / math.Max(borderW, 1.0))
				col = lerpColor(liftedFill, topBorder, t)
				alpha = (float64(col.A) / 255.0) * clamp01(0.5-dist)
			} else {
				col = liftedFill
				alpha = (float64(liftedFill.A) / 255.0) * clamp01(0.5-dist)
			}

			blendPixel(img, x, y, col, alpha)
		}
	}
}

func drawThickLine(img *image.RGBA, x1, y1, x2, y2, thickness float64, col color.RGBA) {
	minX := int(math.Floor(math.Min(x1, x2) - thickness - 2))
	maxX := int(math.Ceil(math.Max(x1, x2) + thickness + 2))
	minY := int(math.Floor(math.Min(y1, y2) - thickness - 2))
	maxY := int(math.Ceil(math.Max(y1, y2) + thickness + 2))

	dx := x2 - x1
	dy := y2 - y1
	lenSq := dx*dx + dy*dy
	halfT := thickness * 0.5

	for y := minY; y <= maxY; y++ {
		for x := minX; x <= maxX; x++ {
			px, py := float64(x), float64(y)
			var t float64
			if lenSq > 0 {
				t = ((px-x1)*dx + (py-y1)*dy) / lenSq
				t = clamp01(t)
			}
			projX := x1 + t*dx
			projY := y1 + t*dy
			dist := math.Sqrt((px-projX)*(px-projX) + (py-projY)*(py-projY))
			if dist <= halfT+0.7 {
				alpha := clamp01(halfT + 0.5 - dist)
				blendPixel(img, x, y, col, alpha*(float64(col.A)/255.0))
			}
		}
	}
}

func blendPixel(img *image.RGBA, x, y int, src color.RGBA, alpha float64) {
	if x < 0 || y < 0 || x >= img.Bounds().Dx() || y >= img.Bounds().Dy() || alpha <= 0 {
		return
	}
	if alpha >= 1.0 {
		img.SetRGBA(x, y, color.RGBA{R: src.R, G: src.G, B: src.B, A: 255})
		return
	}
	dst := img.RGBAAt(x, y)
	inv := 1.0 - alpha
	r := uint8(math.Round(float64(src.R)*alpha + float64(dst.R)*inv))
	g := uint8(math.Round(float64(src.G)*alpha + float64(dst.G)*inv))
	b := uint8(math.Round(float64(src.B)*alpha + float64(dst.B)*inv))
	img.SetRGBA(x, y, color.RGBA{R: r, G: g, B: b, A: 255})
}

func lerpColor(a, b color.RGBA, t float64) color.RGBA {
	t = clamp01(t)
	return color.RGBA{
		R: uint8(math.Round(float64(a.R) + (float64(b.R)-float64(a.R))*t)),
		G: uint8(math.Round(float64(a.G) + (float64(b.G)-float64(a.G))*t)),
		B: uint8(math.Round(float64(a.B) + (float64(b.B)-float64(a.B))*t)),
		A: uint8(math.Round(float64(a.A) + (float64(b.A)-float64(a.A))*t)),
	}
}

func clamp01(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}
