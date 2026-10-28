package cardgen

import (
	"bytes"
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
)

//go:embed assets/Outfit-Bold.ttf
var outfitBoldBytes []byte

//go:embed assets/Outfit-Medium.ttf
var outfitMediumBytes []byte

//go:embed assets/SpaceMono-Bold.ttf
var spaceMonoBoldBytes []byte

//go:embed assets/Vazirmatn-Bold.ttf
var vazirmatnBoldBytes []byte

const (
	PersianVerifiedShaped       = "\uFEEB\uFEAA\uFEB7\u0020\uFEAA\uFEF4\uFEF3\uFE8E\uFE97"
	PersianEstimatedPriceShaped = "\uFEAE\uFE8D\uFEAF\uFE8E\uFE91\u0020\uFEF2\uFEE8\uFEF4\uFEE4\uFEA8\uFE97\u0020\uFE96\uFEE4\uFEF4\uFED7"
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

	cg.fontOutfitMedium, err = opentype.Parse(outfitMediumBytes)
	if err != nil {
		slog.Warn("failed to parse Outfit-Medium font, falling back to goregular", "error", err)
		cg.fontOutfitMedium, _ = opentype.Parse(goregular.TTF)
	}

	cg.fontMonoBold, err = opentype.Parse(spaceMonoBoldBytes)
	if err != nil {
		slog.Warn("failed to parse SpaceMono-Bold font, falling back to gomono", "error", err)
		cg.fontMonoBold, _ = opentype.Parse(gomono.TTF)
	}

	cg.fontVazirBold, err = opentype.Parse(vazirmatnBoldBytes)
	if err != nil {
		slog.Warn("failed to parse Vazirmatn-Bold font, falling back to Outfit-Bold", "error", err)
		cg.fontVazirBold = cg.fontOutfitBold
	}

	return cg
}

// tierVisualTheme defines the border and badge palette for a given rarity tier,
// matching the Mini App (@skulls) certificate aesthetic.
type tierVisualTheme struct {
	BorderStart color.RGBA
	BorderEnd   color.RGBA
	CenterGlow  color.RGBA
	BadgeBg     color.RGBA
	BadgeBorder color.RGBA
	BadgeText   color.RGBA
}

func resolveTierTheme(tierBadge string) tierVisualTheme {
	upper := strings.ToUpper(strings.TrimSpace(tierBadge))
	switch {
	case strings.Contains(upper, "LEGENDARY") || strings.Contains(upper, "EXCLUSIVE") || strings.Contains(upper, "GRAIL") || strings.Contains(upper, "MYTHIC") || strings.Contains(upper, "GOD") || strings.Contains(upper, "RANK #1"):
		return tierVisualTheme{
			BorderStart: color.RGBA{255, 170, 0, 255},
			BorderEnd:   color.RGBA{180, 83, 9, 255},
			CenterGlow:  color.RGBA{255, 145, 0, 255},
			BadgeBg:     color.RGBA{38, 27, 12, 255},
			BadgeBorder: color.RGBA{168, 108, 20, 255},
			BadgeText:   color.RGBA{255, 188, 44, 255},
		}
	case strings.Contains(upper, "EPIC") || strings.Contains(upper, "APEX") || strings.Contains(upper, "ELITE"):
		return tierVisualTheme{
			BorderStart: color.RGBA{0, 152, 234, 255},
			BorderEnd:   color.RGBA{0, 75, 135, 255},
			CenterGlow:  color.RGBA{0, 152, 234, 255},
			BadgeBg:     color.RGBA{12, 28, 46, 255},
			BadgeBorder: color.RGBA{20, 110, 176, 255},
			BadgeText:   color.RGBA{56, 189, 248, 255},
		}
	case strings.Contains(upper, "RARE") || strings.Contains(upper, "PREMIUM") || strings.Contains(upper, "UNIQUE"):
		return tierVisualTheme{
			BorderStart: color.RGBA{16, 185, 129, 255},
			BorderEnd:   color.RGBA{4, 120, 87, 255},
			CenterGlow:  color.RGBA{16, 185, 129, 255},
			BadgeBg:     color.RGBA{11, 36, 28, 255},
			BadgeBorder: color.RGBA{20, 125, 90, 255},
			BadgeText:   color.RGBA{52, 211, 153, 255},
		}
	default:
		// Exact @skulls metallic slate-silver theme for COMMON / UNCOMMON / STANDARD
		return tierVisualTheme{
			BorderStart: color.RGBA{104, 116, 139, 255},
			BorderEnd:   color.RGBA{55, 65, 81, 255},
			CenterGlow:  color.RGBA{148, 163, 184, 255},
			BadgeBg:     color.RGBA{26, 30, 40, 255},
			BadgeBorder: color.RGBA{58, 66, 84, 255},
			BadgeText:   color.RGBA{230, 236, 245, 255},
		}
	}
}

// normalizeCardTierBadge maps any investment grade ("AAA", "A", "D") or localized rarity string
// into a clean, full-word uppercase English rarity tier badge ("LEGENDARY", "EPIC", "RARE", "UNCOMMON", "COMMON")
// so single letters like "D" never appear on the certificate card.
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

// GenerateUsernameCard generates the 600x600 @skulls-style certificate card for a username.
func (cg *CardGenerator) GenerateUsernameCard(username, tier, expectedTON, expectedUSD string, lang ...string) ([]byte, error) {
	cleanUser := strings.TrimPrefix(strings.TrimSpace(username), "@")
	if isUnsupportedFontScript(cleanUser) || cleanUser == "" {
		cleanUser = "username"
	}
	mainTitle := "@" + cleanUser
	badge := normalizeCardTierBadge(tier)
	return cg.renderFlexCard(badge, mainTitle, "", expectedTON, expectedUSD)
}

// GenerateRichUsernameCard generates the 600x600 @skulls-style certificate card from UsernameCardParams.
func (cg *CardGenerator) GenerateRichUsernameCard(p UsernameCardParams) ([]byte, error) {
	return cg.GenerateUsernameCard(p.Username, p.Grade, p.FairTON, p.USDT, p.Lang)
}

// GenerateNumberCard generates the 600x600 @skulls-style certificate card for a +888 number.
func (cg *CardGenerator) GenerateNumberCard(number, club string, rank int, expectedTON, expectedUSD string, lang ...string) ([]byte, error) {
	cleanNum := strings.TrimSpace(number)
	if !strings.HasPrefix(cleanNum, "+") {
		cleanNum = "+" + cleanNum
	}

	var topBadge string
	if rank > 0 && rank <= 500 {
		topBadge = fmt.Sprintf("RANK #%d", rank)
	} else if club != "" && !isUnsupportedFontScript(club) {
		topBadge = normalizeCardTierBadge(club)
	} else if rank > 0 && rank <= 2500 {
		topBadge = "RARE"
	} else {
		topBadge = "COMMON"
	}

	var subtitle string
	if rank > 0 {
		if club != "" && !isUnsupportedFontScript(club) && len(club) <= 22 {
			subtitle = fmt.Sprintf("RANK #%d  ·  %s", rank, strings.ToUpper(club))
		} else {
			subtitle = fmt.Sprintf("GLOBAL RANK #%d  ·  TELEMINT +888", rank)
		}
	}

	return cg.renderFlexCard(topBadge, cleanNum, subtitle, expectedTON, expectedUSD)
}

// GenerateRichNumberCard generates the 600x600 @skulls-style certificate card from NumberCardParams.
func (cg *CardGenerator) GenerateRichNumberCard(p NumberCardParams) ([]byte, error) {
	return cg.GenerateNumberCard(p.Number, p.Club, p.Rank, p.FairTON, p.USDT, p.Lang)
}

// GenerateGiftCard generates the 600x600 @skulls-style certificate card for a Telegram Gift.
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

// GenerateRichGiftCard generates the 600x600 @skulls-style certificate card for a Telegram Gift,
// featuring the gift's radial backdrop + 3D artwork showcase in the center and the exact @skulls frame.
func (cg *CardGenerator) GenerateRichGiftCard(p GiftCardParams) ([]byte, error) {
	cg.mu.Lock()
	defer cg.mu.Unlock()

	const width = 600
	const height = 600
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	topBadge := normalizeCardTierBadge(p.RarityTier)
	theme := resolveTierTheme(topBadge)

	// 1. Render the unified @skulls card background, metallic border, and dot matrix
	cg.drawSkullsCardBase(img, theme)

	// 2. Render Top-Left Tier Pill & Top-Right IFRAGMENT Pill
	cg.drawTopHeaderPills(img, topBadge, theme)

	// 3. Render Center Gift Artwork Showcase (184x184 rounded squircle at cx=300, cy=210)
	centerCol := parseHexColor(p.BackdropCenter, color.RGBA{0, 152, 234, 255})
	edgeCol := parseHexColor(p.BackdropEdge, color.RGBA{14, 22, 38, 255})

	boxSize := 180
	boxX1 := (width - boxSize) / 2
	boxY1 := 116
	boxX2 := boxX1 + boxSize
	boxY2 := boxY1 + boxSize
	boxRadius := 36.0

	for y := boxY1 - 4; y <= boxY2+4; y++ {
		for x := boxX1 - 4; x <= boxX2+4; x++ {
			dist := roundedBoxSDF(float64(x), float64(y), float64(boxX1), float64(boxY1), float64(boxX2), float64(boxY2), boxRadius)
			if dist <= 0 {
				dx := float64(x - 300)
				dy := float64(y - (boxY1 + boxSize/2))
				rNorm := math.Min(1.0, math.Sqrt(dx*dx+dy*dy)/(float64(boxSize)*0.68))
				fill := lerpColor(centerCol, edgeCol, rNorm)
				if dist >= -2.0 {
					borderCol := color.RGBA{75, 85, 105, 255}
					t := clamp01((dist + 2.0) / 2.0)
					fill = lerpColor(fill, borderCol, t*0.85)
				}
				if dist > -1.0 {
					alpha := clamp01(0.5 - dist)
					blendPixel(img, x, y, fill, alpha)
				} else {
					img.SetRGBA(x, y, fill)
				}
			}
		}
	}

	giftImg := fetchOrLoadGiftImage(p.ImageURL)
	if giftImg != nil {
		pad := 14
		targetSize := boxSize - pad*2
		compositeScaledImageRounded(img, giftImg, boxX1+pad, boxY1+pad, targetSize, targetSize, float64(boxX1), float64(boxY1), float64(boxX2), float64(boxY2), boxRadius-2.0)
	} else {
		cg.drawGiftVectorEmblem(img, 300, boxY1+boxSize/2, 46, color.RGBA{255, 255, 255, 235})
	}

	// Serial Badge in top-right of gift showcase
	if p.SerialNumber > 0 {
		serialText := fmt.Sprintf("#%d", p.SerialNumber)
		sFace, err := cg.getFace(cg.fontMonoBold, 11.5)
		if err == nil {
			defer sFace.Close()
			sw := font.MeasureString(sFace, serialText).Ceil()
			sPillW := sw + 20
			sPillH := 26
			sPillX2 := boxX2 - 10
			sPillX1 := sPillX2 - sPillW
			sPillY1 := boxY1 + 10
			sPillY2 := sPillY1 + sPillH
			drawRoundedPill(img, sPillX1, sPillY1, sPillX2, sPillY2, 9.0, color.RGBA{11, 13, 19, 225}, color.RGBA{65, 75, 95, 220}, 1.2)
			sX := sPillX1 + (sPillW-sw)/2
			cg.drawTextAt(img, sFace, serialText, sX, sPillY1+18, color.RGBA{255, 255, 255, 255})
		}
	}

	// 4. Gift Title & Trait Subtitle below showcase
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

	titleFontSize := 32.0
	if len(displayTitle) > 22 {
		titleFontSize = 24.0
	} else if len(displayTitle) > 16 {
		titleFontSize = 28.0
	}

	tFace, err := cg.getFace(cg.fontOutfitBold, titleFontSize)
	if err == nil {
		defer tFace.Close()
		tw := font.MeasureString(tFace, displayTitle).Ceil()
		tx := (width - tw) / 2
		ty := 352
		cg.drawTextAt(img, tFace, displayTitle, tx, ty+4, color.RGBA{0, 0, 0, 160})
		cg.drawTextAt(img, tFace, displayTitle, tx, ty, color.RGBA{255, 255, 255, 255})

		// Four-point sparkles ✦ flanking the gift title
		sparkleY := float64(ty) - titleFontSize*0.34
		drawFourPointStar(img, float64(tx)-24.0, sparkleY, 8.5, color.RGBA{64, 72, 88, 255})
		drawFourPointStar(img, float64(tx+tw)+24.0, sparkleY, 8.5, color.RGBA{64, 72, 88, 255})
	}

	var traitsParts []string
	if p.BackdropName != "" && !isUnsupportedFontScript(p.BackdropName) {
		traitsParts = append(traitsParts, strings.ToUpper(strings.TrimSpace(p.BackdropName)))
	}
	if p.SymbolName != "" && !isUnsupportedFontScript(p.SymbolName) {
		traitsParts = append(traitsParts, strings.ToUpper(strings.TrimSpace(p.SymbolName)))
	}
	if len(traitsParts) > 0 {
		subStr := strings.Join(traitsParts, "   ·   ")
		if len(subStr) > 40 {
			subStr = subStr[:37] + "..."
		}
		subFace, err := cg.getFace(cg.fontOutfitBold, 11.5)
		if err == nil {
			defer subFace.Close()
			sw := font.MeasureString(subFace, subStr).Ceil()
			cg.drawTextAt(img, subFace, subStr, (width-sw)/2, 388, color.RGBA{123, 131, 147, 255})
		}
	}

	// 5. Render Bottom Footer (ESTIMATED MARKET PRICE, Blue TON Icon + Value, Green VERIFIED Pill + ≈ $USD)
	cg.drawSkullsBottomFooter(img, p.ExpectedTON, p.ExpectedUSD)

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, fmt.Errorf("failed to encode gift card png: %w", err)
	}
	return buf.Bytes(), nil
}

// renderFlexCard renders the exact 600x600 @skulls certificate card for Usernames and +888 Numbers.
func (cg *CardGenerator) renderFlexCard(topBadge, mainTitle, subtitle, expectedTON, expectedUSD string) ([]byte, error) {
	cg.mu.Lock()
	defer cg.mu.Unlock()

	const width = 600
	const height = 600
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	badge := normalizeCardTierBadge(topBadge)
	theme := resolveTierTheme(badge)

	// 1. Draw solid dark outer canvas + metallic squircle border + obsidian dot-matrix interior
	cg.drawSkullsCardBase(img, theme)

	// 2. Draw Top-Left Tier Pill & Top-Right IFRAGMENT Pill
	cg.drawTopHeaderPills(img, badge, theme)

	// 3. Draw Center Hero Title flanked by ✦ sparkles (exact @skulls layout)
	titleLen := len(mainTitle)
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

	mainFace, err := cg.getFace(cg.fontOutfitBold, mainFontSize)
	if err != nil {
		return nil, err
	}
	defer mainFace.Close()

	mainW := font.MeasureString(mainFace, mainTitle).Ceil()
	for mainW > 400 && mainFontSize > 20.0 {
		mainFontSize -= 2.0
		mainFace.Close()
		mainFace, err = cg.getFace(cg.fontOutfitBold, mainFontSize)
		if err != nil {
			return nil, err
		}
		mainW = font.MeasureString(mainFace, mainTitle).Ceil()
	}

	mainX := (width - mainW) / 2
	mainY := 284
	if subtitle != "" {
		mainY = 272
	}

	// Crisp dark drop shadow behind main text
	cg.drawTextAt(img, mainFace, mainTitle, mainX, mainY+6, color.RGBA{0, 0, 0, 175})
	// Pure white main text
	cg.drawTextAt(img, mainFace, mainTitle, mainX, mainY, color.RGBA{255, 255, 255, 255})

	// Geometric 4-point sparkles ✦ on left and right of @username / +888 number
	sparkleY := float64(mainY) - mainFontSize*0.33
	sparkleColor := color.RGBA{62, 69, 84, 255}
	leftSparkleX := math.Max(46.0, float64(mainX)-28.0)
	rightSparkleX := math.Min(float64(width-46), float64(mainX+mainW)+28.0)
	drawFourPointStar(img, leftSparkleX, sparkleY, 10.5, sparkleColor)
	drawFourPointStar(img, rightSparkleX, sparkleY, 10.5, sparkleColor)

	// Optional subtle subtitle for +888 numbers (e.g. RANK #42 · ROYAL CLUB)
	if subtitle != "" {
		subFace, err := cg.getFace(cg.fontOutfitBold, 11.5)
		if err == nil {
			defer subFace.Close()
			sw := font.MeasureString(subFace, subtitle).Ceil()
			cg.drawTextAt(img, subFace, subtitle, (width-sw)/2, 322, color.RGBA{123, 131, 147, 255})
		}
	}

	// 4. Draw Bottom Footer (Divider, ESTIMATED MARKET PRICE, Blue TON Circle Icon + Value, Green VERIFIED Pill + ≈ $USD)
	cg.drawSkullsBottomFooter(img, expectedTON, expectedUSD)

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, fmt.Errorf("failed to encode png: %w", err)
	}
	return buf.Bytes(), nil
}

// drawSkullsCardBase renders the 600x600 solid obsidian outer canvas (A=255 everywhere so Telegram JPEG never bleeds white),
// the rounded squircle metallic border, the center ambient glow, and the 24px dot-matrix grid.
func (cg *CardGenerator) drawSkullsCardBase(img *image.RGBA, theme tierVisualTheme) {
	const width = 600
	const height = 600

	cardX1, cardY1 := 18.0, 18.0
	cardX2, cardY2 := 582.0, 582.0
	cardRadius := 56.0
	borderWidth := 2.5

	outerBg := color.RGBA{5, 6, 9, 255}
	innerTopLeft := color.RGBA{13, 15, 22, 255}
	innerBotRight := color.RGBA{8, 9, 13, 255}

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			fx, fy := float64(x), float64(y)
			dist := roundedBoxSDF(fx, fy, cardX1, cardY1, cardX2, cardY2, cardRadius)

			if dist > 0.5 {
				// Solid opaque outer background with subtle dark ambient glow near border
				if dist < 14.0 {
					glowFactor := math.Pow(1.0-(dist/14.0), 2.2) * 0.22
					img.SetRGBA(x, y, lerpColor(outerBg, theme.BorderStart, glowFactor))
				} else {
					img.SetRGBA(x, y, outerBg)
				}
				continue
			}

			// Diagonal progress (0 at top-left, 1 at bottom-right)
			diagT := clamp01(((fx - cardX1) + (fy - cardY1)) / ((cardX2 - cardX1) + (cardY2 - cardY1)))
			borderCol := lerpColor(theme.BorderStart, theme.BorderEnd, diagT)

			// Base interior color
			bgCol := lerpColor(innerTopLeft, innerBotRight, diagT)

			// Top-left subtle glass sheen (like @skulls)
			sheenDx := fx - 170.0
			sheenDy := fy - 130.0
			sheenDist := math.Sqrt(sheenDx*sheenDx + sheenDy*sheenDy)
			if sheenDist < 320.0 {
				sheenFactor := math.Pow(1.0-(sheenDist/320.0), 2.0) * 0.06
				bgCol = lerpColor(bgCol, color.RGBA{255, 255, 255, 255}, sheenFactor)
			}

			// Center ambient radial spotlight behind the main title
			cdx := fx - 300.0
			cdy := (fy - 265.0) * 1.25
			cDist := math.Sqrt(cdx*cdx + cdy*cdy)
			if cDist < 220.0 {
				spotFactor := math.Pow(1.0-(cDist/220.0), 2.0) * 0.11
				bgCol = lerpColor(bgCol, theme.CenterGlow, spotFactor)
			}

			// 24px dot-matrix grid inside the card interior
			if dist < -borderWidth-2.0 {
				gx := math.Mod(fx-cardX1, 24.0)
				gy := math.Mod(fy-cardY1, 24.0)
				if gx > 12.0 {
					gx = 24.0 - gx
				}
				if gy > 12.0 {
					gy = 24.0 - gy
				}
				dotDist := math.Sqrt(gx*gx + gy*gy)
				if dotDist < 1.65 {
					dotAlpha := clamp01(1.65-dotDist) * 0.10
					bgCol = lerpColor(bgCol, color.RGBA{255, 255, 255, 255}, dotAlpha)
				}
			}

			// Smooth anti-aliased transition between interior, metallic border, and solid outer canvas
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
}

// drawTopHeaderPills draws the Top-Left Rarity Tier Pill (e.g. COMMON / RARE / LEGENDARY)
// and Top-Right IFRAGMENT Pill (spaced uppercase "I F R A G M E N T"), never swapping them.
func (cg *CardGenerator) drawTopHeaderPills(img *image.RGBA, tierBadge string, theme tierVisualTheme) {
	pillY1 := 58
	pillY2 := 98
	pillRadius := 13.0

	// 1. Top-Left Pill: Rarity Tier Badge
	leftFace, err := cg.getFace(cg.fontOutfitBold, 12.0)
	if err == nil {
		defer leftFace.Close()
		textW := font.MeasureString(leftFace, tierBadge).Ceil()
		pillW := textW + 36
		if pillW < 96 {
			pillW = 96
		}
		pillX1 := 58
		pillX2 := pillX1 + pillW
		drawRoundedPill(img, pillX1, pillY1, pillX2, pillY2, pillRadius, theme.BadgeBg, theme.BadgeBorder, 1.5)
		tx := pillX1 + (pillW-textW)/2
		cg.drawTextAt(img, leftFace, tierBadge, tx, pillY1+25, theme.BadgeText)
	}

	// 2. Top-Right Pill: "I F R A G M E N T"
	brandFace, err := cg.getFace(cg.fontOutfitBold, 11.5)
	if err == nil {
		defer brandFace.Close()
		brandLabel := "I F R A G M E N T"
		bw := font.MeasureString(brandFace, brandLabel).Ceil()
		bPillW := bw + 34
		bPillX2 := 542
		bPillX1 := bPillX2 - bPillW
		drawRoundedPill(img, bPillX1, pillY1, bPillX2, pillY2, pillRadius,
			color.RGBA{20, 23, 32, 255},
			color.RGBA{38, 44, 58, 255},
			1.5,
		)
		btx := bPillX1 + (bPillW-bw)/2
		cg.drawTextAt(img, brandFace, brandLabel, btx, pillY1+25, color.RGBA{138, 146, 163, 255})
	}
}

// drawSkullsBottomFooter draws the horizontal divider line and the exact @skulls bottom section:
// - Bottom-Left: "ESTIMATED MARKET PRICE" + [Blue TON Circle Icon] + Giant White TON Number + Blue "TON"
// - Bottom-Right: Green [ ● VERIFIED ] Pill + "≈ $USD"
func (cg *CardGenerator) drawSkullsBottomFooter(img *image.RGBA, expectedTON, expectedUSD string) {
	// 1. Horizontal Divider Line at y = 426
	dividerY := 426
	for x := 58; x <= 542; x++ {
		img.SetRGBA(x, dividerY, color.RGBA{31, 36, 48, 255})
		img.SetRGBA(x, dividerY+1, color.RGBA{22, 26, 35, 255})
	}

	// 2. Bottom-Left Label: "ESTIMATED MARKET PRICE"
	labelFace, err := cg.getFace(cg.fontOutfitBold, 11.0)
	if err == nil {
		defer labelFace.Close()
		cg.drawTextAt(img, labelFace, "ESTIMATED MARKET PRICE", 58, 462, color.RGBA{123, 131, 147, 255})
	}

	// 3. Format TON & USD amounts cleanly (ensure USD is never missing!)
	tonDisplay, tonNumeric := formatTONDisplay(expectedTON)
	usdClean := formatUSDTAmount(expectedUSD)
	if usdClean == "" {
		// Compute fallback USD from TON so USD is never missing on the certificate card
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

	// 4. Official Blue TON Circle Icon at Bottom-Left (cx=80, cy=502, r=21)
	cg.drawTONBadge(img, 80, 502, 21)

	// 5. Giant White TON Number + Blue "TON" unit
	tonFontSize := 44.0
	if len(tonDisplay) > 9 {
		tonFontSize = 32.0
	} else if len(tonDisplay) > 7 {
		tonFontSize = 37.0
	}

	tonFace, err := cg.getFace(cg.fontOutfitBold, tonFontSize)
	if err == nil {
		defer tonFace.Close()
		tonX := 114
		tonY := 518
		tonW := font.MeasureString(tonFace, tonDisplay).Ceil()
		cg.drawTextAt(img, tonFace, tonDisplay, tonX, tonY, color.RGBA{255, 255, 255, 255})

		unitFace, uErr := cg.getFace(cg.fontOutfitBold, 19.0)
		if uErr == nil {
			defer unitFace.Close()
			unitX := tonX + tonW + 10
			unitY := 506
			cg.drawTextAt(img, unitFace, "TON", unitX, unitY, color.RGBA{29, 155, 240, 255})
		}
	}

	// 6. Bottom-Right Top: Green [ ● VERIFIED ] Pill (right-aligned to x=542, y=446..482)
	verFace, err := cg.getFace(cg.fontOutfitBold, 11.0)
	if err == nil {
		defer verFace.Close()
		verLabel := "VERIFIED"
		vw := font.MeasureString(verFace, verLabel).Ceil()
		vPillW := vw + 48
		vPillX2 := 542
		vPillX1 := vPillX2 - vPillW
		vPillY1 := 446
		vPillY2 := 482

		drawRoundedPill(img, vPillX1, vPillY1, vPillX2, vPillY2, 18.0,
			color.RGBA{11, 40, 30, 255},
			color.RGBA{22, 91, 64, 255},
			1.5,
		)

		// Glowing emerald dot inside the pill
		dotCX := float64(vPillX1 + 21)
		dotCY := float64(vPillY1+vPillY2) / 2.0
		for dy := -9; dy <= 9; dy++ {
			for dx := -9; dx <= 9; dx++ {
				d := math.Sqrt(float64(dx*dx + dy*dy))
				if d <= 4.5 {
					alpha := clamp01(5.0 - d)
					blendPixel(img, int(dotCX)+dx, int(dotCY)+dy, color.RGBA{16, 185, 129, 255}, alpha)
				} else if d <= 8.5 {
					glowA := math.Pow(1.0-((d-4.5)/4.0), 2.0) * 0.35
					blendPixel(img, int(dotCX)+dx, int(dotCY)+dy, color.RGBA{16, 185, 129, 255}, glowA)
				}
			}
		}

		cg.drawTextAt(img, verFace, verLabel, vPillX1+34, vPillY1+23, color.RGBA{31, 208, 145, 255})
	}

	// 7. Bottom-Right Bottom: "≈  $307" (right-aligned to x=542, baseline y=518)
	usdFace, err := cg.getFace(cg.fontOutfitBold, 21.0)
	if err == nil {
		defer usdFace.Close()
		approxStr := "≈  "
		dollarValStr := "$" + usdClean
		approxW := font.MeasureString(usdFace, approxStr).Ceil()
		dollarW := font.MeasureString(usdFace, dollarValStr).Ceil()
		totalW := approxW + dollarW
		startX := 542 - totalW
		cg.drawTextAt(img, usdFace, approxStr, startX, 518, color.RGBA{142, 150, 166, 255})
		cg.drawTextAt(img, usdFace, dollarValStr, startX+approxW, 518, color.RGBA{215, 222, 234, 255})
	}
}

// drawFourPointStar draws a crisp geometric 4-point star ✦ centered at (cx, cy) with outer radius r.
func drawFourPointStar(img *image.RGBA, cx, cy, r float64, col color.RGBA) {
	ir := int(math.Ceil(r + 2))
	icx, icy := int(math.Round(cx)), int(math.Round(cy))
	for dy := -ir; dy <= ir; dy++ {
		for dx := -ir; dx <= ir; dx++ {
			fx := math.Abs(float64(dx)) / r
			fy := math.Abs(float64(dy)) / r
			if fx > 1.0 || fy > 1.0 {
				continue
			}
			// Astroid / 4-point star curve: x^(0.55) + y^(0.55) <= 1.0
			val := math.Pow(fx, 0.58) + math.Pow(fy, 0.58)
			if val <= 1.08 {
				alpha := clamp01((1.08 - val) * 7.5)
				blendPixel(img, icx+dx, icy+dy, col, alpha)
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

	// If integer or >= 100 or ends in .0, format as clean integer with commas (matching @skulls "250 TON")
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

func (cg *CardGenerator) drawTONBadge(img *image.RGBA, cx, cy, r int) {
	blue := color.RGBA{0, 152, 234, 255}
	glowRadius := float64(r) + 10.0
	for dy := -int(glowRadius) - 2; dy <= int(glowRadius)+2; dy++ {
		for dx := -int(glowRadius) - 2; dx <= int(glowRadius)+2; dx++ {
			dist := math.Sqrt(float64(dx*dx + dy*dy))
			if dist <= float64(r)+0.5 {
				alpha := clamp01(float64(r) + 0.5 - dist)
				blendPixel(img, cx+dx, cy+dy, blue, alpha)
			} else if dist <= glowRadius {
				glowT := 1.0 - (dist-float64(r))/(glowRadius-float64(r))
				glowAlpha := math.Pow(glowT, 2.2) * 0.28
				blendPixel(img, cx+dx, cy+dy, blue, glowAlpha)
			}
		}
	}

	white := color.RGBA{255, 255, 255, 255}
	topY := float64(cy) - float64(r)*0.40
	botY := float64(cy) + float64(r)*0.50
	leftX := float64(cx) - float64(r)*0.46
	rightX := float64(cx) + float64(r)*0.46
	midX := float64(cx)

	drawThickLine(img, leftX, topY, rightX, topY, 2.5, white)
	drawThickLine(img, leftX, topY, midX, botY, 2.5, white)
	drawThickLine(img, rightX, topY, midX, botY, 2.5, white)
	drawThickLine(img, midX, topY, midX, botY, 2.1, white)
}

func (cg *CardGenerator) drawGiftVectorEmblem(img *image.RGBA, cx, cy, r int, col color.RGBA) {
	fcx, fcy, fr := float64(cx), float64(cy), float64(r)
	topY := fcy - fr*0.75
	midY := fcy - fr*0.20
	botY := fcy + fr*0.80
	leftX := fcx - fr*0.85
	rightX := fcx + fr*0.85
	innerLeftX := fcx - fr*0.45
	innerRightX := fcx + fr*0.45

	drawThickLine(img, innerLeftX, topY, innerRightX, topY, 3.0, col)
	drawThickLine(img, innerLeftX, topY, leftX, midY, 3.0, col)
	drawThickLine(img, innerRightX, topY, rightX, midY, 3.0, col)
	drawThickLine(img, leftX, midY, rightX, midY, 2.5, col)
	drawThickLine(img, leftX, midY, fcx, botY, 3.0, col)
	drawThickLine(img, rightX, midY, fcx, botY, 3.0, col)
	drawThickLine(img, innerLeftX, topY, fcx, midY, 2.2, col)
	drawThickLine(img, innerRightX, topY, fcx, midY, 2.2, col)
	drawThickLine(img, fcx, midY, fcx, botY, 2.5, col)
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

	client := &http.Client{Timeout: 3500 * time.Millisecond}
	req, err := http.NewRequest(http.MethodGet, src, nil)
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

	if val < 10.0 {
		return fmt.Sprintf("%.2f", val)
	}

	intVal := int64(math.Round(val))
	return addThousandsCommas(strconv.FormatInt(intVal, 10))
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
		for x := x1 - 2; x <= x2+2; x++ {
			dist := roundedBoxSDF(float64(x), float64(y), fx1, fy1, fx2, fy2, r)
			if dist > 0.5 {
				continue
			}

			var col color.RGBA
			var alpha float64
			if dist >= -borderW {
				t := clamp01((dist + borderW) / math.Max(borderW, 1.0))
				col = lerpColor(fillCol, borderCol, t)
				alpha = (float64(col.A) / 255.0) * clamp01(0.5-dist)
			} else {
				col = fillCol
				alpha = float64(fillCol.A) / 255.0
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
