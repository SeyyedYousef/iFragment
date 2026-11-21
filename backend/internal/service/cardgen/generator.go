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
		// Fragment Warm Amber-Gold Accent (for Grail / Legendary / Top Rank assets)
		return tierVisualTheme{
			BorderStart:   color.RGBA{245, 190, 66, 255},
			BorderEnd:     color.RGBA{46, 59, 72, 255},
			CenterGlow:    color.RGBA{245, 178, 46, 255},
			SecondaryGlow: color.RGBA{36, 139, 218, 255},
			BadgeBg:       color.RGBA{49, 41, 24, 255},
			BadgeBorder:   color.RGBA{138, 108, 42, 255},
			BadgeText:     color.RGBA{255, 207, 84, 255},
			Accent:        color.RGBA{245, 190, 66, 255},
		}
	case strings.Contains(upper, "EPIC") || strings.Contains(upper, "APEX") || strings.Contains(upper, "ELITE"):
		// Authentic Fragment TON Blue Accent (#248bda / #4db2ff)
		return tierVisualTheme{
			BorderStart:   color.RGBA{77, 178, 255, 255},
			BorderEnd:     color.RGBA{46, 59, 72, 255},
			CenterGlow:    color.RGBA{36, 139, 218, 255},
			SecondaryGlow: color.RGBA{77, 178, 255, 255},
			BadgeBg:       color.RGBA{26, 46, 66, 255},
			BadgeBorder:   color.RGBA{46, 108, 162, 255},
			BadgeText:     color.RGBA{77, 178, 255, 255},
			Accent:        color.RGBA{77, 178, 255, 255},
		}
	case strings.Contains(upper, "RARE") || strings.Contains(upper, "PREMIUM") || strings.Contains(upper, "UNIQUE"):
		// Authentic Fragment Emerald Green (#5aec8c)
		return tierVisualTheme{
			BorderStart:   color.RGBA{90, 236, 140, 255},
			BorderEnd:     color.RGBA{46, 59, 72, 255},
			CenterGlow:    color.RGBA{90, 236, 140, 255},
			SecondaryGlow: color.RGBA{36, 139, 218, 255},
			BadgeBg:       color.RGBA{24, 52, 42, 255},
			BadgeBorder:   color.RGBA{44, 118, 82, 255},
			BadgeText:     color.RGBA{90, 236, 140, 255},
			Accent:        color.RGBA{90, 236, 140, 255},
		}
	default:
		// Crisp Fragment Slate + TON Blue (#4db2ff)
		return tierVisualTheme{
			BorderStart:   color.RGBA{77, 178, 255, 255},
			BorderEnd:     color.RGBA{46, 59, 72, 255},
			CenterGlow:    color.RGBA{36, 139, 218, 255},
			SecondaryGlow: color.RGBA{140, 154, 169, 255},
			BadgeBg:       color.RGBA{32, 43, 56, 255},
			BadgeBorder:   color.RGBA{58, 76, 96, 255},
			BadgeText:     color.RGBA{186, 214, 240, 255},
			Accent:        color.RGBA{77, 178, 255, 255},
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

// flexCardSpec holds the Fragment.com-styled layout data for the 600x600 PV valuation card.
type flexCardSpec struct {
	TopBadge    string
	Eyebrow     string
	MainTitle   string
	FragmentURL string
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
		Eyebrow:     "COLLECTIBLE USERNAME",
		MainTitle:   mainTitle,
		FragmentURL: "fragment.com/username/" + strings.ToLower(cleanUser),
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

	digitsOnly := strings.NewReplacer("+", "", " ", "", "-", "").Replace(cleanNum)
	return cg.renderFlexCardRich(flexCardSpec{
		TopBadge:    topBadge,
		Eyebrow:     "ANONYMOUS NUMBER",
		MainTitle:   cleanNum,
		FragmentURL: "fragment.com/number/" + digitsOnly,
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

// GenerateRichGiftCard generates the 600x600 Fragment.com-styled valuation card for a Telegram Gift.
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
		theme.CenterGlow = lerpColor(theme.CenterGlow, bc, 0.45)
	}

	// 1. Render Fragment.com dark slate canvas & crisp card shell
	cg.drawSkullsCardBase(img, theme)

	// 2. Render Fragment.com top header bar (#293440) with brand mark + tier badge
	cg.drawTopHeaderPills(img, topBadge, theme)

	// 3. Left Gift Artwork Showcase (x=40..186, y=94..240, 146x146)
	centerCol := parseHexColor(p.BackdropCenter, color.RGBA{36, 139, 218, 255})
	edgeCol := parseHexColor(p.BackdropEdge, color.RGBA{20, 32, 46, 255})

	const boxSize = 146
	const boxX1 = 40
	const boxY1 = 94
	const boxX2 = boxX1 + boxSize
	const boxY2 = boxY1 + boxSize
	const boxRadius = 20.0

	for y := boxY1 - 4; y <= boxY2+4; y++ {
		for x := boxX1 - 4; x <= boxX2+4; x++ {
			dist := roundedBoxSDF(float64(x), float64(y), float64(boxX1), float64(boxY1), float64(boxX2), float64(boxY2), boxRadius)
			if dist <= 0 {
				dx := float64(x - (boxX1 + boxSize/2))
				dy := float64(y - (boxY1 + boxSize/2))
				rNorm := math.Min(1.0, math.Sqrt(dx*dx+dy*dy)/(float64(boxSize)*0.72))
				fill := lerpColor(centerCol, edgeCol, rNorm)

				if dist >= -1.6 {
					t := clamp01((dist + 1.6) / 1.6)
					fill = lerpColor(fill, color.RGBA{56, 74, 94, 255}, t*0.9)
				}
				if dist > -0.8 {
					blendPixel(img, x, y, fill, clamp01(0.5-dist))
				} else {
					img.SetRGBA(x, y, fill)
				}
			}
		}
	}

	if giftImg != nil {
		pad := 10
		targetSize := boxSize - pad*2
		compositeScaledImageRounded(img, giftImg, boxX1+pad, boxY1+pad, targetSize, targetSize, float64(boxX1), float64(boxY1), float64(boxX2), float64(boxY2), boxRadius-2.0)
	} else {
		cg.drawGiftVectorEmblem(img, boxX1+boxSize/2, boxY1+boxSize/2, 38, color.RGBA{255, 255, 255, 240})
	}

	// Serial Badge in top-right of gift showcase
	if p.SerialNumber > 0 {
		serialText := fmt.Sprintf("#%d", p.SerialNumber)
		sFace, err := cg.getFace(cg.fontOutfitBold, 10.5)
		if err == nil {
			defer sFace.Close()
			sw := font.MeasureString(sFace, serialText).Ceil()
			sPillW := sw + 16
			sPillH := 22
			sPillX2 := boxX2 - 8
			sPillX1 := sPillX2 - sPillW
			sPillY1 := boxY1 + 8
			sPillY2 := sPillY1 + sPillH
			drawRoundedPill(img, sPillX1, sPillY1, sPillX2, sPillY2, 7.0, color.RGBA{26, 32, 38, 235}, color.RGBA{56, 74, 94, 255}, 1.0)
			cg.drawTextAt(img, sFace, serialText, sPillX1+(sPillW-sw)/2, sPillY1+15, color.RGBA{255, 255, 255, 255})
		}
	}

	// 4. Right Column: Eyebrow + Gift Title + Fragment Key-Value Trait Table
	const colX = 204
	const colX2 = 560
	const colW = colX2 - colX

	eyeFace, err := cg.getFace(cg.fontOutfitBold, 9.5)
	if err == nil {
		defer eyeFace.Close()
		cg.drawTextAt(img, eyeFace, "COLLECTIBLE GIFT  ·  TELEGRAM NFT", colX, 108, color.RGBA{77, 178, 255, 255})
	}

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

	titleFontSize := 24.0
	tFace, err := cg.getFace(cg.fontOutfitBlack, titleFontSize)
	if err == nil {
		for font.MeasureString(tFace, displayTitle).Ceil() > colW && titleFontSize > 16.0 {
			titleFontSize -= 1.5
			tFace.Close()
			tFace, err = cg.getFace(cg.fontOutfitBlack, titleFontSize)
			if err != nil {
				break
			}
		}
		if err == nil {
			defer tFace.Close()
			cg.drawTextAt(img, tFace, displayTitle, colX, 138, color.RGBA{255, 255, 255, 255})
		}
	}

	type kvRow struct {
		K string
		V string
	}
	var rows []kvRow
	if p.ModelName != "" && !isUnsupportedFontScript(p.ModelName) {
		rows = append(rows, kvRow{K: "MODEL", V: strings.TrimSpace(p.ModelName)})
	}
	if p.BackdropName != "" && !isUnsupportedFontScript(p.BackdropName) {
		rows = append(rows, kvRow{K: "BACKDROP", V: strings.TrimSpace(p.BackdropName)})
	}
	if p.SymbolName != "" && !isUnsupportedFontScript(p.SymbolName) {
		rows = append(rows, kvRow{K: "SYMBOL", V: strings.TrimSpace(p.SymbolName)})
	}
	if len(rows) < 2 && p.SerialNumber > 0 {
		rows = append(rows, kvRow{K: "SERIAL", V: fmt.Sprintf("#%d", p.SerialNumber)})
	}
	if len(rows) < 3 {
		rows = append(rows, kvRow{K: "STANDARD", V: "TEP-62 NFT"})
	}
	if len(rows) > 3 {
		rows = rows[:3]
	}

	// Draw Fragment-style key-value rows container (x=204..560, y=152..240)
	drawRoundedPill(img, colX, 152, colX2, 240, 10.0, color.RGBA{36, 46, 56, 255}, color.RGBA{46, 59, 72, 255}, 1.0)
	kFace, kErr := cg.getFace(cg.fontOutfitBold, 9.5)
	vFace, vErr := cg.getFace(cg.fontOutfitBold, 11.0)
	if kErr == nil && vErr == nil {
		defer kFace.Close()
		defer vFace.Close()
		for i, r := range rows {
			rowTop := 152 + i*29
			if i > 0 {
				for hx := colX + 1; hx < colX2-1; hx++ {
					img.SetRGBA(hx, rowTop, color.RGBA{46, 59, 72, 255})
				}
			}
			cg.drawTextAt(img, kFace, r.K, colX+12, rowTop+19, color.RGBA{140, 154, 169, 255})
			valTxt := r.V
			if len(valTxt) > 22 {
				valTxt = valTxt[:19] + "..."
			}
			vw := font.MeasureString(vFace, valTxt).Ceil()
			cg.drawTextAt(img, vFace, valTxt, colX2-12-vw, rowTop+19, color.RGBA{241, 245, 249, 255})
		}
	}

	// 5. Fragment Price Range Spectrum Bar below Gift showcase (y=260..302)
	cg.drawGoldenSpectrumGauge600(img, "", p.ExpectedTON, "", theme)

	// 6. Render Bottom Fragment Table Valuation Panel (y=318..534) + Footer
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

// renderFlexCardRich renders the 600x600 authentic Fragment.com-styled valuation card for Usernames and +888 Numbers.
func (cg *CardGenerator) renderFlexCardRich(spec flexCardSpec) ([]byte, error) {
	cg.mu.Lock()
	defer cg.mu.Unlock()

	const width = 600
	const height = 600
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	badge := normalizeCardTierBadge(spec.TopBadge)
	theme := resolveTierTheme(badge)

	// 1. Draw authentic Fragment.com dark slate canvas (#1a2026) & crisp surface card (#212a33)
	cg.drawSkullsCardBase(img, theme)

	// 2. Draw Fragment.com Top Header Strip (#293440) with Fragment Shard + FRAGMENT + Tier Pill
	cg.drawTopHeaderPills(img, badge, theme)

	// 3. Eyebrow label
	eyebrow := strings.TrimSpace(spec.Eyebrow)
	if eyebrow == "" {
		eyebrow = "TELEGRAM DIGITAL ASSET"
	}
	eyeFace, err := cg.getFace(cg.fontOutfitBold, 10.0)
	if err == nil {
		defer eyeFace.Close()
		ew := font.MeasureString(eyeFace, eyebrow).Ceil()
		ex := (width - ew) / 2
		cg.drawTextAt(img, eyeFace, eyebrow, ex, 108, color.RGBA{140, 154, 169, 255})
	}

	// 4. Crisp Pure-White Hero Asset Title (@username or +888 number)
	titleLen := len(spec.MainTitle)
	var mainFontSize float64
	switch {
	case titleLen <= 8:
		mainFontSize = 50.0
	case titleLen <= 12:
		mainFontSize = 42.0
	case titleLen <= 16:
		mainFontSize = 35.0
	default:
		mainFontSize = 27.0
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
	for mainW > 500 && mainFontSize > 20.0 {
		mainFontSize -= 2.0
		mainFace.Close()
		mainFace, err = cg.getFace(heroFont, mainFontSize)
		if err != nil {
			return nil, err
		}
		mainW = font.MeasureString(mainFace, spec.MainTitle).Ceil()
	}

	mainX := (width - mainW) / 2
	mainY := 166
	cg.drawTextAt(img, mainFace, spec.MainTitle, mainX, mainY+2, color.RGBA{14, 18, 24, 180})
	cg.drawTextAt(img, mainFace, spec.MainTitle, mainX, mainY, color.RGBA{255, 255, 255, 255})

	// 5. Authentic Fragment URL sub-line (#4db2ff)
	fragSub := strings.TrimSpace(spec.FragmentURL)
	if fragSub == "" {
		fragSub = "fragment.com"
	}
	if len(fragSub) > 42 {
		fragSub = fragSub[:39] + "..."
	}
	subFace, sErr := cg.getFace(cg.fontOutfitBold, 11.5)
	if sErr == nil {
		defer subFace.Close()
		sw := font.MeasureString(subFace, fragSub).Ceil()
		cg.drawTextAt(img, subFace, fragSub, (width-sw)/2, 196, color.RGBA{77, 178, 255, 255})
	}

	// 6. Clean Fragment Spec Chips Row (y = 216..244)
	cg.drawFlexChipRow(img, spec.Chips, 300, 216, 520, theme)

	// 7. Fragment Price Range Spectrum Gauge (y = 262..302)
	cg.drawGoldenSpectrumGauge600(img, spec.LowTON, spec.FairTON, spec.HighTON, theme)

	// 8. Bottom Fragment Table Valuation Panel (y = 318..534) + Footer
	cg.drawSkullsBottomFooterRich(img, spec.LowTON, spec.FairTON, spec.HighTON, spec.ExpectedUSD, spec.Confidence, theme)

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, fmt.Errorf("failed to encode png: %w", err)
	}
	return buf.Bytes(), nil
}

// drawSkullsCardBase renders the authentic Fragment.com dark slate canvas (#1a2026)
// and crisp surface card (#212a33) with a clean #293440 header strip and subtle #2e3b48 1px border.
func (cg *CardGenerator) drawSkullsCardBase(img *image.RGBA, theme tierVisualTheme) {
	const width = 600
	const height = 600

	cardX1, cardY1 := 18.0, 18.0
	cardX2, cardY2 := 582.0, 582.0
	cardRadius := 20.0
	borderWidth := 1.4
	const headerBottomY = 74.0

	outerBg := color.RGBA{26, 32, 38, 255}     // #1a2026 Fragment canvas
	cardBg := color.RGBA{33, 42, 51, 255}      // #212a33 Fragment table/card surface
	headerBg := color.RGBA{41, 52, 64, 255}    // #293440 Fragment sticky header
	borderCol := color.RGBA{46, 59, 72, 255}   // #2e3b48 Fragment hairline border

	for y := 0; y < height; y++ {
		fy := float64(y)
		for x := 0; x < width; x++ {
			fx := float64(x)
			dist := roundedBoxSDF(fx, fy, cardX1, cardY1, cardX2, cardY2, cardRadius)
			if dist > 0.5 {
				img.SetRGBA(x, y, outerBg)
				continue
			}

			bgCol := cardBg
			if fy <= headerBottomY {
				bgCol = headerBg
			} else {
				// Very subtle Fragment TON-blue ambient mist near upper center of hero stage
				dx := (fx - 300.0) / 260.0
				dy := (fy - 165.0) / 145.0
				rSq := dx*dx + dy*dy
				if rSq < 1.0 {
					t := 1.0 - math.Sqrt(rSq)
					bgCol = lerpColor(bgCol, color.RGBA{36, 139, 218, 255}, t*t*0.06)
				}
			}

			// Hairline separator beneath top header bar
			if fy >= headerBottomY-0.6 && fy <= headerBottomY+0.6 && dist < -borderWidth {
				bgCol = borderCol
			}

			var finalCol color.RGBA
			if dist >= -borderWidth {
				innerEdge := clamp01((dist + borderWidth) / 1.0)
				inToBorder := lerpColor(bgCol, borderCol, innerEdge)
				if dist > -0.5 {
					finalCol = lerpColor(inToBorder, outerBg, clamp01(dist+0.5))
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

	// Crisp 2px TON-blue accent line across the very top center edge of the card (signature Fragment accent)
	for x := 240; x <= 360; x++ {
		t := 1.0 - math.Abs(float64(x-300))/60.0
		blendPixel(img, x, 19, theme.Accent, t*0.85)
		blendPixel(img, x, 20, theme.Accent, t*0.45)
	}
}

// drawFragmentBrandMark draws a sharp geometric Fragment diamond shard icon.
func (cg *CardGenerator) drawFragmentBrandMark(img *image.RGBA, cx, cy, r int) {
	fcx, fcy, fr := float64(cx), float64(cy), float64(r)
	topY := fcy - fr
	midY := fcy - fr*0.12
	botY := fcy + fr
	leftX := fcx - fr*0.92
	rightX := fcx + fr*0.92

	// Upper-left crisp white facet, upper-right sky blue facet, lower facets in TON blue
	fillTriangle(img, fcx, topY, leftX, midY, fcx, midY, color.RGBA{255, 255, 255, 255})
	fillTriangle(img, fcx, topY, fcx, midY, rightX, midY, color.RGBA{77, 178, 255, 255})
	fillTriangle(img, leftX, midY, fcx, midY, fcx, botY, color.RGBA{77, 178, 255, 255})
	fillTriangle(img, fcx, midY, rightX, midY, fcx, botY, color.RGBA{36, 139, 218, 255})
}

// drawTopHeaderPills draws the Fragment.com header bar content:
// Left: Fragment Diamond Mark + FRAGMENT wordmark + iFRAGMENT tag.
// Right: Crisp Fragment-style Rarity / Rank status badge.
func (cg *CardGenerator) drawTopHeaderPills(img *image.RGBA, tierBadge string, theme tierVisualTheme) {
	// Left: Fragment Geometric Diamond + FRAGMENT bold title
	cg.drawFragmentBrandMark(img, 48, 46, 11)

	brandFace, err := cg.getFace(cg.fontOutfitBlack, 15.0)
	if err == nil {
		defer brandFace.Close()
		cg.drawTextAt(img, brandFace, "FRAGMENT", 68, 52, color.RGBA{255, 255, 255, 255})

		bw := font.MeasureString(brandFace, "FRAGMENT").Ceil()
		tagFace, tErr := cg.getFace(cg.fontOutfitBold, 9.0)
		if tErr == nil {
			defer tagFace.Close()
			tagTxt := "iFRAGMENT"
			tw := font.MeasureString(tagFace, tagTxt).Ceil()
			tx1 := 68 + bw + 10
			tx2 := tx1 + tw + 14
			drawRoundedPill(img, tx1, 36, tx2, 56, 6.0,
				color.RGBA{30, 50, 70, 255},
				color.RGBA{46, 86, 126, 255},
				1.0,
			)
			cg.drawTextAt(img, tagFace, tagTxt, tx1+7, 49, color.RGBA{77, 178, 255, 255})
		}
	}

	// Right: Crisp Tier Status Pill
	rightFace, err := cg.getFace(cg.fontOutfitBold, 10.5)
	if err == nil {
		defer rightFace.Close()
		textW := font.MeasureString(rightFace, tierBadge).Ceil()
		pillW := textW + 34
		if pillW < 88 {
			pillW = 88
		}
		pillX2 := 562
		pillX1 := pillX2 - pillW
		pillY1 := 32
		pillY2 := 60
		drawRoundedPill(img, pillX1, pillY1, pillX2, pillY2, 8.0, theme.BadgeBg, theme.BadgeBorder, 1.1)

		drawSoftGlowDot(img, float64(pillX1+14), float64(pillY1+pillY2)*0.5, 3.2, theme.BadgeText)
		tx := pillX1 + 22 + (pillW-22-textW)/2
		cg.drawTextAt(img, rightFace, tierBadge, tx, pillY1+18, theme.BadgeText)
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
	const chipH = 26
	for _, item := range items {
		drawRoundedPill(img, curX, y1, curX+item.w, y1+chipH, 8.0,
			color.RGBA{36, 46, 56, 255},
			color.RGBA{46, 59, 72, 255},
			1.0,
		)
		dotCX := float64(curX + 12)
		dotCY := float64(y1+y1+chipH) / 2.0
		drawSoftGlowDot(img, dotCX, dotCY, 2.5, theme.Accent)

		tw := font.MeasureString(chipFace, item.text).Ceil()
		tx := curX + 18 + (item.w-18-tw)/2
		cg.drawTextAt(img, chipFace, item.text, tx, y1+17, color.RGBA{212, 223, 233, 255})
		curX += item.w + gap
	}
}

// drawGoldenSpectrumGauge600 renders a crisp Fragment-style Floor -> Fair -> Ceiling spectrum track.
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

	const barX1 = 42
	const barX2 = 558
	const barY1 = 288
	const barY2 = 296

	// Labels above spectrum track
	lblFace, err := cg.getFace(cg.fontOutfitBold, 9.5)
	if err == nil {
		defer lblFace.Close()
		leftTxt := "FLOOR  " + lowDisp + " TON"
		rightTxt := "CEILING  " + highDisp + " TON"
		midTxt := "FAIR VALUE"

		cg.drawTextAt(img, lblFace, leftTxt, barX1, 278, color.RGBA{140, 154, 169, 255})
		rw := font.MeasureString(lblFace, rightTxt).Ceil()
		cg.drawTextAt(img, lblFace, rightTxt, barX2-rw, 278, color.RGBA{140, 154, 169, 255})
		mw := font.MeasureString(lblFace, midTxt).Ceil()
		cg.drawTextAt(img, lblFace, midTxt, 300-mw/2, 278, color.RGBA{77, 178, 255, 255})
	}

	// Recessed #1a2026 track capsule
	drawRoundedPill(img, barX1, barY1, barX2, barY2, 4.0,
		color.RGBA{26, 32, 38, 255},
		color.RGBA{46, 59, 72, 255},
		1.0,
	)

	posRatio := 0.56
	if highNum > lowNum && fairNum >= lowNum && fairNum <= highNum {
		posRatio = (fairNum - lowNum) / (highNum - lowNum)
		if posRatio < 0.22 {
			posRatio = 0.22
		} else if posRatio > 0.78 {
			posRatio = 0.78
		}
	}

	markerX := barX1 + int(math.Round(float64(barX2-barX1)*posRatio))

	// Fragment TON Blue fill (#248bda -> #4db2ff)
	startCol := color.RGBA{36, 139, 218, 255}
	endCol := color.RGBA{77, 178, 255, 255}
	for x := barX1 + 1; x <= markerX; x++ {
		t := clamp01(float64(x-barX1) / math.Max(1.0, float64(markerX-barX1)))
		c := lerpColor(startCol, endCol, t)
		for y := barY1 + 1; y < barY2; y++ {
			img.SetRGBA(x, y, c)
		}
	}

	// Crisp Fair Value Marker Node
	markerCY := float64(barY1+barY2) * 0.5
	drawSoftGlowDot(img, float64(markerX), markerCY, 6.5, color.RGBA{36, 139, 218, 255})
	drawSoftGlowDot(img, float64(markerX), markerCY, 3.5, color.RGBA{255, 255, 255, 255})
}

// drawSkullsBottomFooter keeps compatibility for any direct callers.
func (cg *CardGenerator) drawSkullsBottomFooter(img *image.RGBA, expectedTON, expectedUSD string) {
	cg.drawSkullsBottomFooterRich(img, "", expectedTON, "", expectedUSD, 90, resolveTierTheme("EPIC"))
}

// drawSkullsBottomFooterRich renders the authentic Fragment.com table-style Valuation Panel (y = 318..534)
// with header strip, TON/USD anchor row, 3-column Floor / Ceiling / Confidence footer, and subtle watermark.
func (cg *CardGenerator) drawSkullsBottomFooterRich(img *image.RGBA, lowTON, expectedTON, highTON, expectedUSD string, confidence int, theme tierVisualTheme) {
	const bx1, by1, bx2, by2 = 38, 318, 562, 534
	const headerEndY = 356
	const statsDivY = 456
	borderCol := color.RGBA{46, 59, 72, 255}
	panelBg := color.RGBA{36, 46, 56, 255}  // #242e38
	headerBg := color.RGBA{41, 52, 64, 255} // #293440
	cellBg := color.RGBA{30, 39, 48, 255}   // #1e2730

	// 1. Draw Table Card Container with top header row & bottom 3-column stat row
	for y := by1 - 2; y <= by2+2; y++ {
		fy := float64(y)
		for x := bx1 - 2; x <= bx2+2; x++ {
			fx := float64(x)
			dist := roundedBoxSDF(fx, fy, float64(bx1), float64(by1), float64(bx2), float64(by2), 14.0)
			if dist > 0.5 {
				continue
			}
			fill := panelBg
			if y <= headerEndY {
				fill = headerBg
			} else if y >= statsDivY {
				fill = cellBg
			}
			// Internal horizontal & vertical table grid dividers
			if (y == headerEndY || y == statsDivY) && dist < -1.2 {
				fill = borderCol
			}
			if y > statsDivY && (x == 212 || x == 388) && dist < -1.2 {
				fill = borderCol
			}

			var col color.RGBA
			var alpha float64
			if dist >= -1.2 {
				t := clamp01((dist + 1.2) / 1.2)
				col = lerpColor(fill, borderCol, t)
				alpha = clamp01(0.5 - dist)
			} else {
				col = fill
				alpha = 1.0
			}
			blendPixel(img, x, y, col, alpha)
		}
	}

	// 2. Table Header Row: "ESTIMATED MARKET VALUE" + Emerald [ ● VERIFIED ] Pill
	labelFace, err := cg.getFace(cg.fontOutfitBold, 10.0)
	if err == nil {
		defer labelFace.Close()
		cg.drawTextAt(img, labelFace, "ESTIMATED MARKET VALUE", bx1+18, by1+23, color.RGBA{140, 154, 169, 255})
	}

	verFace, err := cg.getFace(cg.fontOutfitBold, 9.5)
	if err == nil {
		defer verFace.Close()
		verLabel := "VERIFIED"
		vw := font.MeasureString(verFace, verLabel).Ceil()
		vPillW := vw + 32
		vPillX2 := bx2 - 14
		vPillX1 := vPillX2 - vPillW
		vPillY1 := by1 + 8
		vPillY2 := by1 + 30

		drawRoundedPill(img, vPillX1, vPillY1, vPillX2, vPillY2, 7.0,
			color.RGBA{24, 52, 42, 255},
			color.RGBA{44, 118, 82, 255},
			1.0,
		)
		drawSoftGlowDot(img, float64(vPillX1+13), float64(vPillY1+vPillY2)*0.5, 3.0, color.RGBA{90, 236, 140, 255})
		cg.drawTextAt(img, verFace, verLabel, vPillX1+22, vPillY1+15, color.RGBA{90, 236, 140, 255})
	}

	// 3. Format TON, Floor, Ceiling & USD amounts cleanly
	tonDisplay, tonNumeric := formatTONDisplay(expectedTON)
	lowDisp, lowNum := formatTONDisplay(lowTON)
	highDisp, highNum := formatTONDisplay(highTON)
	if lowNum <= 0 && tonNumeric > 0 {
		lowDisp, _ = formatTONDisplay(fmt.Sprintf("%.1f", tonNumeric*0.78))
	}
	if highNum <= 0 && tonNumeric > 0 {
		highDisp, _ = formatTONDisplay(fmt.Sprintf("%.1f", tonNumeric*1.28))
	}

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

	// 4. Flat Crisp Fragment TON Diamond Emblem (cx=78, cy=406, r=21)
	cg.drawTONBadge(img, 78, 406, 21)

	// 5. Right-side USD value + Live Spot Sub-label
	subLblFace, sErr := cg.getFace(cg.fontOutfitBold, 9.0)
	if sErr == nil {
		defer subLblFace.Close()
		uLbl := "USD EQUIVALENT"
		uw := font.MeasureString(subLblFace, uLbl).Ceil()
		cg.drawTextAt(img, subLblFace, uLbl, bx2-18-uw, 386, color.RGBA{140, 154, 169, 255})
	}

	usdStartX := bx2 - 18
	usdFace, err := cg.getFace(cg.fontOutfitBlack, 22.0)
	if err == nil {
		defer usdFace.Close()
		approxStr := "~ "
		dollarValStr := "$" + usdClean
		approxW := font.MeasureString(usdFace, approxStr).Ceil()
		dollarW := font.MeasureString(usdFace, dollarValStr).Ceil()
		totalW := approxW + dollarW
		usdStartX = bx2 - 18 - totalW
		cg.drawTextAt(img, usdFace, approxStr, usdStartX, 417, color.RGBA{140, 154, 169, 255})
		cg.drawTextAt(img, usdFace, dollarValStr, usdStartX+approxW, 417, color.RGBA{241, 245, 249, 255})
	}
	if sErr == nil {
		spotTxt := "LIVE TON MAINNET"
		sw := font.MeasureString(subLblFace, spotTxt).Ceil()
		cg.drawTextAt(img, subLblFace, spotTxt, bx2-18-sw, 437, color.RGBA{77, 178, 255, 255})
	}

	// 6. Giant Crisp White TON Amount + #4db2ff "TON" unit
	tonFontSize := 40.0
	if len(tonDisplay) > 9 {
		tonFontSize = 27.0
	} else if len(tonDisplay) > 7 {
		tonFontSize = 33.0
	}

	tonFont := cg.fontOutfitBlack
	if tonFont == nil {
		tonFont = cg.fontOutfitBold
	}
	tonFace, err := cg.getFace(tonFont, tonFontSize)
	if err == nil {
		defer tonFace.Close()
		maxTonW := usdStartX - 112 - 64
		if maxTonW < 120 {
			maxTonW = 120
		}
		for font.MeasureString(tonFace, tonDisplay).Ceil() > maxTonW && tonFontSize > 22.0 {
			tonFontSize -= 2.0
			tonFace.Close()
			tonFace, err = cg.getFace(tonFont, tonFontSize)
			if err != nil {
				break
			}
		}
		if err == nil {
			tonX := 112
			tonY := 421
			tonW := font.MeasureString(tonFace, tonDisplay).Ceil()
			cg.drawTextAt(img, tonFace, tonDisplay, tonX, tonY, color.RGBA{255, 255, 255, 255})

			unitFace, uErr := cg.getFace(cg.fontOutfitBold, 16.0)
			if uErr == nil {
				defer unitFace.Close()
				cg.drawTextAt(img, unitFace, "TON", tonX+tonW+8, 414, color.RGBA{77, 178, 255, 255})
			}
		}
	}

	// 7. 3-Column Fragment Footer Stat Cells (y=456..534)
	if confidence <= 0 {
		confidence = 90
	}
	if confidence > 100 {
		confidence = 100
	}

	cellValFace, cvErr := cg.getFace(cg.fontOutfitBlack, 15.0)
	if sErr == nil && cvErr == nil {
		defer cellValFace.Close()
		// Col 1: Liquidity Floor (x=38..212)
		cg.drawTextAt(img, subLblFace, "LIQUIDITY FLOOR", bx1+18, statsDivY+26, color.RGBA{140, 154, 169, 255})
		cg.drawTextAt(img, cellValFace, lowDisp+" TON", bx1+18, statsDivY+54, color.RGBA{241, 245, 249, 255})

		// Col 2: Ceiling Target (x=212..388)
		cg.drawTextAt(img, subLblFace, "CEILING TARGET", 212+18, statsDivY+26, color.RGBA{140, 154, 169, 255})
		cg.drawTextAt(img, cellValFace, highDisp+" TON", 212+18, statsDivY+54, color.RGBA{77, 178, 255, 255})

		// Col 3: Confidence (x=388..562)
		cg.drawTextAt(img, subLblFace, "AVM CONFIDENCE", 388+18, statsDivY+26, color.RGBA{140, 154, 169, 255})
		confStr := fmt.Sprintf("%d%%", confidence)
		cg.drawTextAt(img, cellValFace, confStr, 388+18, statsDivY+54, color.RGBA{90, 236, 140, 255})

		// Crisp 6-segment emerald confidence bar
		segStartX := 388 + 72
		for s := 0; s < 6; s++ {
			sx1 := segStartX + s*11
			sx2 := sx1 + 8
			active := (s+1)*16 <= confidence
			segCol := color.RGBA{41, 52, 64, 255}
			if active {
				segCol = color.RGBA{90, 236, 140, 255}
			}
			drawRoundedPill(img, sx1, statsDivY+43, sx2, statsDivY+53, 2.5, segCol, segCol, 0)
		}
	}

	// 8. Clean Fragment Bottom Attribution Row (y = 562)
	wmFace, wErr := cg.getFace(cg.fontOutfitBold, 10.0)
	if wErr == nil {
		defer wmFace.Close()
		leftHandle := "@iFragmentBot"
		cg.drawTextAt(img, wmFace, leftHandle, 40, 562, color.RGBA{212, 223, 233, 255})
		hw := font.MeasureString(wmFace, leftHandle).Ceil()
		cg.drawTextAt(img, wmFace, "  ·  On-Chain AVM Valuation", 40+hw, 562, color.RGBA{140, 154, 169, 255})

		rightTxt := "FRAGMENT.COM"
		rw := font.MeasureString(wmFace, rightTxt).Ceil()
		cg.drawTextAt(img, wmFace, rightTxt, 560-rw, 562, color.RGBA{77, 178, 255, 255})
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

// drawTONBadge renders an authentic crisp Fragment.com flat TON circle emblem (#248bda) with clean vector diamond.
func (cg *CardGenerator) drawTONBadge(img *image.RGBA, cx, cy, r int) {
	topBlue := color.RGBA{46, 156, 232, 255}
	botBlue := color.RGBA{30, 126, 204, 255}
	fr := float64(r)

	for dy := -r - 2; dy <= r+2; dy++ {
		for dx := -r - 2; dx <= r+2; dx++ {
			dist := math.Sqrt(float64(dx*dx + dy*dy))
			if dist <= fr+0.6 {
				vT := clamp01((float64(dy) + fr) / (2.0 * fr))
				fill := lerpColor(topBlue, botBlue, vT)
				alpha := clamp01(fr + 0.6 - dist)
				blendPixel(img, cx+dx, cy+dy, fill, alpha)
			}
		}
	}

	white := color.RGBA{255, 255, 255, 255}
	topY := float64(cy) - fr*0.36
	botY := float64(cy) + fr*0.48
	leftX := float64(cx) - fr*0.44
	rightX := float64(cx) + fr*0.44
	midX := float64(cx)

	strokeW := math.Max(2.2, fr*0.105)
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
