package cardgen

import (
	"bytes"
	_ "embed"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/gomono"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/font/sfnt"
	"golang.org/x/image/math/fixed"
)

//go:embed assets/Outfit-Black.ttf
var outfitBlackBytes []byte

//go:embed assets/Outfit-Bold.ttf
var outfitBoldBytes []byte

//go:embed assets/Vazirmatn-Bold.ttf
var vazirmatnBoldBytes []byte

// Persian shaped glyphs in visual RTL order (ready for LTR drawer)
// "تایید" -> ﺗﺎﯾﯿﺪ -> visual RTL: ﺪ ﯿ ﯾ ﺎ ﺗ
// "شده" -> ﺷﺪﻩ -> visual RTL: ﻩ ﺪ ﺷ
// "قیمت تخمینی بازار" -> visual RTL: ﺑﺎﺯﺍﺭ ﺗﺨﻤﯿﻨﯽ ﻗﯿﻤﺖ
const (
	PersianTayidShaped          = "\uFEAA\uFEF4\uFEF3\uFE8E\uFE97"
	PersianShodeShaped          = "\uFEE9\uFEAA\uFEB5"
	PersianVerifiedShaped       = "\uFEE9\uFEAA\uFEB5 \uFEAA\uFEF4\uFEF3\uFE8E\uFE97"
	PersianEstimatedPriceShaped = "\uFEAD\uFE8D\uFEAF\uFE8E\uFE91 \uFEF0\uFEE8\uFEF4\uFEE4\uFEA4\uFE97 \uFE96\uFEE4\uFEF4\uFED7"
)

// CardGenerator generates rich, high-resolution 600x600 PNG visual asset cards
// matching the iFragment Telegram Mini App dark cyber aesthetics (#08090D).
type CardGenerator struct {
	fontOutfitBlack *sfnt.Font
	fontOutfitBold  *sfnt.Font
	fontVazirBold   *sfnt.Font
	fontBold        *sfnt.Font
	fontRegular     *sfnt.Font
	fontMono        *sfnt.Font
}

func NewCardGenerator() *CardGenerator {
	fBlack, _ := opentype.Parse(outfitBlackBytes)
	fBold, _ := opentype.Parse(outfitBoldBytes)
	fVazir, _ := opentype.Parse(vazirmatnBoldBytes)
	fGoBold, _ := opentype.Parse(gobold.TTF)
	fGoReg, _ := opentype.Parse(goregular.TTF)
	fGoMono, _ := opentype.Parse(gomono.TTF)
	return &CardGenerator{
		fontOutfitBlack: fBlack,
		fontOutfitBold:  fBold,
		fontVazirBold:   fVazir,
		fontBold:        fGoBold,
		fontRegular:     fGoReg,
		fontMono:        fGoMono,
	}
}

// SaveCard saves generated card PNG bytes into ./static/shares/<uuid>.png and returns the fileID
func (cg *CardGenerator) SaveCard(pngBytes []byte) (string, error) {
	dir := "./static/shares"
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create static shares directory: %w", err)
	}
	fileID := uuid.New().String()
	filePath := filepath.Join(dir, fileID+".png")
	if err := os.WriteFile(filePath, pngBytes, 0644); err != nil {
		return "", fmt.Errorf("failed to write card file: %w", err)
	}
	return fileID, nil
}

// GetPublicCardURL returns the full accessible URL for a given card fileID
func (cg *CardGenerator) GetPublicCardURL(fileID string, r *http.Request) string {
	scheme := "https"
	host := ""
	if r != nil {
		if r.TLS == nil && r.Header.Get("X-Forwarded-Proto") != "https" {
			scheme = "http"
		}
		host = r.Host
	}
	if host == "" {
		backendURL := os.Getenv("BACKEND_URL")
		if backendURL == "" {
			backendURL = os.Getenv("API_URL")
		}
		if backendURL == "" {
			backendURL = os.Getenv("APP_URL")
		}
		if backendURL != "" {
			return fmt.Sprintf("%s/static/shares/%s.png", strings.TrimSuffix(backendURL, "/"), fileID)
		}
		host = "109.172.94.139"
	}
	return fmt.Sprintf("%s://%s/static/shares/%s.png", scheme, host, fileID)
}

// TierTheme defines color styling for card borders and glowing auras
type TierTheme struct {
	Border color.RGBA
	Glow   color.RGBA
	Badge  string
}

func getTierTheme(tier string) TierTheme {
	norm := strings.ToUpper(strings.TrimSpace(tier))
	switch {
	case strings.Contains(norm, "LEGENDARY"), strings.Contains(norm, "GENESIS"), strings.Contains(norm, "EXCLUSIVE"):
		// Radiant Gold / Amber
		return TierTheme{
			Border: color.RGBA{R: 0xF5, G: 0xA6, B: 0x23, A: 0xFF},
			Glow:   color.RGBA{R: 0xF5, G: 0xA6, B: 0x23, A: 0xAA},
			Badge:  "EXCLUSIVE",
		}
	case strings.Contains(norm, "EPIC"), strings.Contains(norm, "FLAME"):
		// Electric Crimson
		return TierTheme{
			Border: color.RGBA{R: 0xFF, G: 0x3B, B: 0x30, A: 0xFF},
			Glow:   color.RGBA{R: 0xFF, G: 0x3B, B: 0x30, A: 0xAA},
			Badge:  "EPIC",
		}
	case strings.Contains(norm, "UNIQUE"), strings.Contains(norm, "MINTED"):
		// Emerald Green
		return TierTheme{
			Border: color.RGBA{R: 0x10, G: 0xB9, B: 0x81, A: 0xFF},
			Glow:   color.RGBA{R: 0x10, G: 0xB9, B: 0x81, A: 0xAA},
			Badge:  "UNIQUE",
		}
	default:
		// Signature iFragment Electric Cyan (#00A3FF) - exactly matching Image 1 (APEX, RARE, STANDARD)
		badge := "STANDARD"
		if norm != "" {
			badge = norm
		}
		return TierTheme{
			Border: color.RGBA{R: 0x00, G: 0xA3, B: 0xFF, A: 0xFF},
			Glow:   color.RGBA{R: 0x00, G: 0x98, B: 0xEA, A: 0xBB},
			Badge:  badge,
		}
	}
}

// GenerateUsernameCard creates a high-fidelity 600x600 Flex Card for Telegram Usernames
func (cg *CardGenerator) GenerateUsernameCard(username string, tier string, expectedTON string, expectedUSD string) ([]byte, error) {
	return cg.GenerateUsernameCardLang(username, tier, expectedTON, expectedUSD, "fa")
}

func (cg *CardGenerator) GenerateUsernameCardLang(username string, tier string, expectedTON string, expectedUSD string, lang string) ([]byte, error) {
	theme := getTierTheme(tier)
	if tier != "" {
		theme.Badge = strings.ToUpper(strings.TrimSpace(tier))
	}

	cleanUser := "@" + strings.TrimPrefix(strings.TrimSpace(username), "@")

	return cg.renderFlexCard(cardParams{
		leftPill:    "I F R A G M E N T",
		rightPill:   theme.Badge,
		theme:       theme,
		identifier:  cleanUser,
		subLabel:    "ON-CHAIN TELEGRAM USERNAME",
		expectedTON: expectedTON,
		expectedUSD: expectedUSD,
		lang:        lang,
	})
}

// GenerateNumberCard creates a high-fidelity 600x600 Flex Card for Telegram Anonymous Numbers (+888)
func (cg *CardGenerator) GenerateNumberCard(displayNum string, club string, rank int, expectedTON string, expectedUSD string) ([]byte, error) {
	return cg.GenerateNumberCardLang(displayNum, club, rank, expectedTON, expectedUSD, "fa")
}

func (cg *CardGenerator) GenerateNumberCardLang(displayNum string, club string, rank int, expectedTON string, expectedUSD string, lang string) ([]byte, error) {
	theme := getTierTheme(club)
	rightBadge := "RANK #1"
	if rank > 0 {
		rightBadge = fmt.Sprintf("RANK #%d", rank)
	}

	subLabel := "TELEGRAM ANONYMOUS NUMBER"
	if club != "" {
		subLabel = strings.ToUpper(club)
	}

	return cg.renderFlexCard(cardParams{
		leftPill:    "I F R A G M E N T",
		rightPill:   rightBadge,
		theme:       theme,
		identifier:  displayNum,
		subLabel:    subLabel,
		expectedTON: expectedTON,
		expectedUSD: expectedUSD,
		lang:        lang,
	})
}

// GenerateGiftCard creates a high-fidelity 600x600 Flex Card for Telegram Gifts & NFTs
func (cg *CardGenerator) GenerateGiftCard(title string, giftID string, serialNumber int, rarityTier string, expectedTON string, expectedUSD string) ([]byte, error) {
	return cg.GenerateGiftCardLang(title, giftID, serialNumber, rarityTier, expectedTON, expectedUSD, "fa")
}

func (cg *CardGenerator) GenerateGiftCardLang(title string, giftID string, serialNumber int, rarityTier string, expectedTON string, expectedUSD string, lang string) ([]byte, error) {
	theme := getTierTheme(rarityTier)
	rightBadge := theme.Badge
	if serialNumber > 0 {
		rightBadge = fmt.Sprintf("%s #%d", theme.Badge, serialNumber)
	}

	return cg.renderFlexCard(cardParams{
		leftPill:    "I F R A G M E N T",
		rightPill:   rightBadge,
		theme:       theme,
		identifier:  title,
		subLabel:    "TELEGRAM STAR GIFT NFT",
		expectedTON: expectedTON,
		expectedUSD: expectedUSD,
		lang:        lang,
	})
}

type cardParams struct {
	leftPill    string
	rightPill   string
	theme       TierTheme
	identifier  string
	subLabel    string
	expectedTON string
	expectedUSD string
	lang        string
}

func (cg *CardGenerator) renderFlexCard(p cardParams) ([]byte, error) {
	const (
		width  = 600
		height = 600
		x0     = 24.0
		y0     = 24.0
		x1     = 576.0
		y1     = 576.0
		radius = 48.0
	)

	img := image.NewRGBA(image.Rect(0, 0, width, height))

	// 1. Draw outer neon glow, rounded squircle border, and interior background
	glowRadius := 24.0
	for y := 0; y < height; y++ {
		fy := float64(y) + 0.5
		for x := 0; x < width; x++ {
			fx := float64(x) + 0.5

			dist := signedDistRoundRect(fx, fy, x0, y0, x1, y1, radius)

			if dist > glowRadius {
				// Far outside, transparent
				continue
			}

			if dist > 0.0 {
				// Outer neon glow with quadratic falloff
				factor := 1.0 - (dist / glowRadius)
				alpha := factor * factor * (float64(p.theme.Glow.A) / 255.0) * 0.85
				glowCol := color.RGBA{
					R: uint8(float64(p.theme.Glow.R) * alpha),
					G: uint8(float64(p.theme.Glow.G) * alpha),
					B: uint8(float64(p.theme.Glow.B) * alpha),
					A: uint8(alpha * 255),
				}
				img.Set(x, y, glowCol)
				continue
			}

			// Inside card or on border (dist <= 0)
			if dist >= -2.8 {
				// Border stroke (tier color)
				borderAlpha := 1.0
				if dist > -0.9 {
					borderAlpha = -dist / 0.9
				}
				borderCol := blendColor(
					color.RGBA{R: 0x08, G: 0x09, B: 0x0D, A: 0xFF},
					p.theme.Border,
					borderAlpha,
				)
				img.Set(x, y, borderCol)
				continue
			}

			// Dark obsidian interior gradient (#0A0D15 to #06080D)
			normY := (fy - y0) / (y1 - y0)
			bgR := uint8(10 - normY*4)
			bgG := uint8(13 - normY*5)
			bgB := uint8(21 - normY*9)

			// Ambient radial glow behind the center text
			dx := (fx - 300.0) / 190.0
			dy := (fy - 275.0) / 130.0
			centerDist := math.Hypot(dx, dy)
			if centerDist < 1.0 {
				ambientFactor := 1.0 - centerDist
				ambientAlpha := ambientFactor * ambientFactor * 0.28
				glowR := float64(p.theme.Glow.R)
				glowG := float64(p.theme.Glow.G)
				glowB := float64(p.theme.Glow.B)
				bgR = uint8(float64(bgR)*(1.0-ambientAlpha) + glowR*ambientAlpha)
				bgG = uint8(float64(bgG)*(1.0-ambientAlpha) + glowG*ambientAlpha)
				bgB = uint8(float64(bgB)*(1.0-ambientAlpha) + glowB*ambientAlpha)
			}

			img.Set(x, y, color.RGBA{R: bgR, G: bgG, B: bgB, A: 0xFF})
		}
	}

	// 2. Draw dot matrix cyber grid (spaced every 26px)
	dotSpacing := 26
	for gx := 52; gx <= 548; gx += dotSpacing {
		for gy := 52; gy <= 548; gy += dotSpacing {
			if signedDistRoundRect(float64(gx), float64(gy), x0, y0, x1, y1, radius) < -8.0 {
				drawSoftDot(img, gx, gy, 1.4, color.RGBA{R: 0xFF, G: 0xFF, B: 0xFF, A: 0x18})
			}
		}
	}

	// 3. Top Row: Left Badge & Right Badge
	drawPill(img, 48, 48, 150, 36, 12,
		color.RGBA{R: 0xFF, G: 0xFF, B: 0xFF, A: 0x0E},
		color.RGBA{R: 0xFF, G: 0xFF, B: 0xFF, A: 0x22})
	cg.drawText(img, cg.fontOutfitBold, 11.5, 48+75, 71, p.leftPill,
		color.RGBA{R: 0x8E, G: 0x9C, B: 0xAE, A: 0xFF}, alignCenter)

	// Measure right pill width
	rightFace, _ := cg.getFace(cg.fontOutfitBlack, 12.0)
	rightTextW := font.MeasureString(rightFace, p.rightPill).Ceil()
	pillW := rightTextW + 36
	if pillW < 96 {
		pillW = 96
	}
	pillX := 552 - pillW
	drawPill(img, pillX, 48, pillW, 36, 12,
		color.RGBA{R: p.theme.Border.R, G: p.theme.Border.G, B: p.theme.Border.B, A: 0x22},
		p.theme.Border)
	cg.drawText(img, cg.fontOutfitBlack, 12.0, pillX+pillW/2, 71, p.rightPill,
		p.theme.Border, alignCenter)

	// 4. Center Hero: Sparkles + Main Identifier in OUTFIT-BLACK!
	identLen := len(p.identifier)
	identSize := 54.0
	if identLen > 18 {
		identSize = 30.0
	} else if identLen > 12 {
		identSize = 42.0
	}
	identFace, _ := cg.getFace(cg.fontOutfitBlack, identSize)
	identW := font.MeasureString(identFace, p.identifier).Ceil()

	centerY := 250
	// Drop shadow for 3D pop (2px offset)
	cg.drawText(img, cg.fontOutfitBlack, identSize, 300, centerY+2, p.identifier,
		color.RGBA{R: 0x00, G: 0x00, B: 0x00, A: 0xB0}, alignCenter)
	// Crisp White Text
	cg.drawText(img, cg.fontOutfitBlack, identSize, 300, centerY, p.identifier,
		color.White, alignCenter)

	// Draw diamond sparkles on both sides (aligned with center of text)
	sparkleXLeft := 300 - identW/2 - 32
	sparkleXRight := 300 + identW/2 + 32
	sparkleY := centerY - int(identSize*0.22)
	drawSparkle(img, sparkleXLeft, sparkleY, 18, color.RGBA{R: 0xFF, G: 0xFF, B: 0xFF, A: 0x55})
	drawSparkle(img, sparkleXRight, sparkleY, 18, color.RGBA{R: 0xFF, G: 0xFF, B: 0xFF, A: 0x55})

	// Sub-label below identifier (only if custom and meaningful)
	cleanSubLabel := strings.Trim(p.subLabel, " ✦\t\r\n")
	if cleanSubLabel != "" && cleanSubLabel != "ON-CHAIN TELEGRAM USERNAME" && cleanSubLabel != "TELEGRAM ANONYMOUS NUMBER" && cleanSubLabel != "TELEGRAM STAR GIFT NFT" {
		cg.drawText(img, cg.fontOutfitBold, 11.0, 300, 300, cleanSubLabel,
			color.RGBA{R: 0x8E, G: 0x9C, B: 0xAE, A: 0xBB}, alignCenter)
	}

	// 5. Horizontal divider line
	dividerY := 432
	for x := 48; x <= 552; x++ {
		img.Set(x, dividerY, color.RGBA{R: 0xFF, G: 0xFF, B: 0xFF, A: 0x18})
	}

	// 6. Bottom Row: Left side (Verified + Market Value + USD)
	isFa := p.lang == "fa" || p.lang == ""

	if isFa && cg.fontVazirBold != nil {
		// 2-line Persian Green Verified Pill matching Image 1: [ تایید \n شده  ● ]
		drawPill(img, 48, 452, 68, 36, 12,
			color.RGBA{R: 0x10, G: 0xB9, B: 0x81, A: 0x24},
			color.RGBA{R: 0x10, G: 0xB9, B: 0x81, A: 0x77})
		// Line 1: تایید
		cg.drawText(img, cg.fontVazirBold, 9.5, 54, 465, PersianTayidShaped,
			color.RGBA{R: 0x10, G: 0xB9, B: 0x81, A: 0xFF}, alignLeft)
		// Line 2: شده
		cg.drawText(img, cg.fontVazirBold, 9.5, 54, 479, PersianShodeShaped,
			color.RGBA{R: 0x10, G: 0xB9, B: 0x81, A: 0xFF}, alignLeft)
		// Glowing green circle dot on the right of the text
		drawCircleFilled(img, 100, 470, 3.5, color.RGBA{R: 0x10, G: 0xB9, B: 0x81, A: 0xFF})

		// Next to green pill: 'قیمت تخمینی بازار'
		cg.drawText(img, cg.fontVazirBold, 11.5, 126, 473, PersianEstimatedPriceShaped,
			color.RGBA{R: 0x8E, G: 0x9C, B: 0xAE, A: 0xDD}, alignLeft)
	} else {
		// International 1-line pill
		drawPill(img, 48, 454, 92, 32, 10,
			color.RGBA{R: 0x10, G: 0xB9, B: 0x81, A: 0x24},
			color.RGBA{R: 0x10, G: 0xB9, B: 0x81, A: 0x77})
		drawCircleFilled(img, 60, 470, 3.5, color.RGBA{R: 0x10, G: 0xB9, B: 0x81, A: 0xFF})
		cg.drawText(img, cg.fontOutfitBold, 9.5, 70, 474, "VERIFIED",
			color.RGBA{R: 0x10, G: 0xB9, B: 0x81, A: 0xFF}, alignLeft)
		cg.drawText(img, cg.fontOutfitBold, 10.0, 150, 474, "ESTIMATED MARKET VALUE",
			color.RGBA{R: 0x8E, G: 0x9C, B: 0xAE, A: 0xCC}, alignLeft)
	}

	// USD Price (Outfit-Black 27pt, baseline at y = 528)
	usdDisplay := "$0"
	if p.expectedUSD != "" {
		usdDisplay = fmt.Sprintf("$%s", strings.TrimPrefix(strings.TrimPrefix(p.expectedUSD, "≈"), "$"))
	}
	cg.drawText(img, cg.fontOutfitBlack, 27.0, 48, 528, usdDisplay, color.White, alignLeft)

	// 7. Bottom Row: Right side (TON Diamond Icon + TON Amount + ≈TON)
	iconCenterX := 526
	iconCenterY := 498
	drawTonDiamondIcon(img, iconCenterX, iconCenterY, 24)

	// TON amount in Outfit-Black 44pt (baseline at y = 528)
	tonNumStr := p.expectedTON
	if tonNumStr == "" {
		tonNumStr = "0"
	}
	tonFace, _ := cg.getFace(cg.fontOutfitBlack, 44.0)
	tonNumW := font.MeasureString(tonFace, tonNumStr).Ceil()

	tonEndX := iconCenterX - 36
	tonStartX := tonEndX - tonNumW
	cg.drawTextAt(img, tonFace, tonStartX, 528, tonNumStr, color.White)

	// ≈TON in Outfit-Black 17pt (Electric Cyan)
	tonLabelFace, _ := cg.getFace(cg.fontOutfitBlack, 17.0)
	tonLabelW := font.MeasureString(tonLabelFace, "TON").Ceil()
	approxW := 14
	gap := 5
	labelStartX := tonStartX - (approxW + gap + tonLabelW) - 8

	drawApproxSymbol(img, labelStartX, 510-7, color.RGBA{R: 0x00, G: 0xA3, B: 0xFF, A: 0xFF})
	cg.drawTextAt(img, tonLabelFace, labelStartX+approxW+gap, 510, "TON",
		color.RGBA{R: 0x00, G: 0xA3, B: 0xFF, A: 0xFF})

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// ─────────────────────────────────────────────────────────────
// Typography & Drawing Helpers
// ─────────────────────────────────────────────────────────────

type textAlign int

const (
	alignLeft textAlign = iota
	alignCenter
	alignRight
)

func (cg *CardGenerator) getFace(f *sfnt.Font, pt float64) (font.Face, error) {
	if f == nil {
		if cg.fontOutfitBold != nil {
			f = cg.fontOutfitBold
		} else {
			f = cg.fontBold
		}
	}
	return opentype.NewFace(f, &opentype.FaceOptions{
		Size:    pt,
		DPI:     72,
		Hinting: font.HintingFull,
	})
}

func (cg *CardGenerator) drawText(img *image.RGBA, f *sfnt.Font, pt float64, x, y int, text string, col color.Color, align textAlign) {
	face, err := cg.getFace(f, pt)
	if err != nil {
		return
	}
	textW := font.MeasureString(face, text).Ceil()
	startX := x
	if align == alignCenter {
		startX = x - textW/2
	} else if align == alignRight {
		startX = x - textW
	}

	d := &font.Drawer{
		Dst:  img,
		Src:  image.NewUniform(col),
		Face: face,
		Dot:  fixed.Point26_6{X: fixed.I(startX), Y: fixed.I(y)},
	}
	d.DrawString(text)
}

func (cg *CardGenerator) drawTextAt(img *image.RGBA, face font.Face, x, y int, text string, col color.Color) {
	d := &font.Drawer{
		Dst:  img,
		Src:  image.NewUniform(col),
		Face: face,
		Dot:  fixed.Point26_6{X: fixed.I(x), Y: fixed.I(y)},
	}
	d.DrawString(text)
}

// signedDistRoundRect computes the Euclidean signed distance to a rounded rectangle boundary.
func signedDistRoundRect(x, y, x0, y0, x1, y1, r float64) float64 {
	cx := math.Max(x0+r, math.Min(x, x1-r))
	cy := math.Max(y0+r, math.Min(y, y1-r))
	dx := math.Max(0.0, math.Abs(x-cx))
	dy := math.Max(0.0, math.Abs(y-cy))

	if x >= x0+r && x <= x1-r && y >= y0 && y <= y1 {
		return math.Max(y0-y, math.Max(y-y1, math.Max(x0-x, x-x1)))
	}
	if y >= y0+r && y <= y1-r && x >= x0 && x <= x1 {
		return math.Max(x0-x, math.Max(x-x1, math.Max(y0-y, y-y1)))
	}
	return math.Hypot(dx, dy) - r
}

func blendColor(bg color.RGBA, fg color.RGBA, alpha float64) color.RGBA {
	a := math.Max(0.0, math.Min(1.0, alpha))
	return color.RGBA{
		R: uint8(float64(bg.R)*(1.0-a) + float64(fg.R)*a),
		G: uint8(float64(bg.G)*(1.0-a) + float64(fg.G)*a),
		B: uint8(float64(bg.B)*(1.0-a) + float64(fg.B)*a),
		A: 0xFF,
	}
}

// drawPill draws a smooth rounded rectangle with fill and border
func drawPill(img *image.RGBA, px, py, pw, ph int, r float64, fill, border color.RGBA) {
	x0 := float64(px)
	y0 := float64(py)
	x1 := float64(px + pw)
	y1 := float64(py + ph)

	for y := py; y < py+ph; y++ {
		fy := float64(y) + 0.5
		for x := px; x < px+pw; x++ {
			fx := float64(x) + 0.5
			dist := signedDistRoundRect(fx, fy, x0, y0, x1, y1, r)
			if dist > 0.0 {
				continue
			}

			// Border line
			if dist >= -1.6 {
				drawPixelOver(img, x, y, border)
			} else {
				drawPixelOver(img, x, y, fill)
			}
		}
	}
}

func drawPixelOver(img *image.RGBA, x, y int, src color.RGBA) {
	dst := img.RGBAAt(x, y)
	srcA := float64(src.A) / 255.0
	dstA := float64(dst.A) / 255.0
	outA := srcA + dstA*(1.0-srcA)
	if outA <= 0 {
		return
	}
	outR := (float64(src.R)*srcA + float64(dst.R)*dstA*(1.0-srcA)) / outA
	outG := (float64(src.G)*srcA + float64(dst.G)*dstA*(1.0-srcA)) / outA
	outB := (float64(src.B)*srcA + float64(dst.B)*dstA*(1.0-srcA)) / outA
	img.SetRGBA(x, y, color.RGBA{
		R: uint8(outR),
		G: uint8(outG),
		B: uint8(outB),
		A: uint8(outA * 255),
	})
}

// drawSoftDot draws a small circular dot with anti-aliasing
func drawSoftDot(img *image.RGBA, cx, cy int, r float64, col color.RGBA) {
	ir := int(math.Ceil(r)) + 1
	for y := cy - ir; y <= cy+ir; y++ {
		dy := float64(y - cy)
		for x := cx - ir; x <= cx+ir; x++ {
			dx := float64(x - cx)
			d := math.Hypot(dx, dy)
			if d <= r {
				drawPixelOver(img, x, y, col)
			} else if d <= r+0.8 {
				alpha := (r + 0.8 - d) / 0.8
				fCol := col
				fCol.A = uint8(float64(col.A) * alpha)
				drawPixelOver(img, x, y, fCol)
			}
		}
	}
}

func drawCircleFilled(img *image.RGBA, cx, cy int, r float64, col color.RGBA) {
	drawSoftDot(img, cx, cy, r, col)
}

// drawSparkle draws a sharp 4-pointed diamond star ✦
func drawSparkle(img *image.RGBA, cx, cy int, radius int, col color.RGBA) {
	r := float64(radius)
	ir := radius + 1
	for y := cy - ir; y <= cy+ir; y++ {
		fy := math.Abs(float64(y - cy))
		for x := cx - ir; x <= cx+ir; x++ {
			fx := math.Abs(float64(x - cx))
			// Astroid curve: (x/r)^0.5 + (y/r)^0.5 <= 1
			val := math.Sqrt(fx/r) + math.Sqrt(fy/r)
			if val <= 1.0 {
				drawPixelOver(img, x, y, col)
			} else if val <= 1.15 {
				alpha := (1.15 - val) / 0.15
				fCol := col
				fCol.A = uint8(float64(col.A) * alpha)
				drawPixelOver(img, x, y, fCol)
			}
		}
	}
}

// drawAALine draws a smooth anti-aliased line with rounded end caps and subpixel accuracy
func drawAALine(img *image.RGBA, x0, y0, x1, y1 float64, width float64, col color.RGBA) {
	dx := x1 - x0
	dy := y1 - y0
	l2 := dx*dx + dy*dy

	minX := int(math.Floor(math.Min(x0, x1) - width - 1.0))
	maxX := int(math.Ceil(math.Max(x0, x1) + width + 1.0))
	minY := int(math.Floor(math.Min(y0, y1) - width - 1.0))
	maxY := int(math.Ceil(math.Max(y0, y1) + width + 1.0))

	bounds := img.Bounds()
	if minX < bounds.Min.X {
		minX = bounds.Min.X
	}
	if maxX > bounds.Max.X {
		maxX = bounds.Max.X
	}
	if minY < bounds.Min.Y {
		minY = bounds.Min.Y
	}
	if maxY > bounds.Max.Y {
		maxY = bounds.Max.Y
	}

	halfW := width / 2.0
	for y := minY; y <= maxY; y++ {
		fy := float64(y) + 0.5
		for x := minX; x <= maxX; x++ {
			fx := float64(x) + 0.5
			var dist float64
			if l2 == 0 {
				dist = math.Hypot(fx-x0, fy-y0)
			} else {
				t := math.Max(0.0, math.Min(1.0, ((fx-x0)*dx+(fy-y0)*dy)/l2))
				projX := x0 + t*dx
				projY := y0 + t*dy
				dist = math.Hypot(fx-projX, fy-projY)
			}

			if dist <= halfW {
				drawPixelOver(img, x, y, col)
			} else if dist <= halfW+1.0 {
				alpha := (halfW + 1.0 - dist)
				fCol := col
				fCol.A = uint8(float64(col.A) * alpha)
				drawPixelOver(img, x, y, fCol)
			}
		}
	}
}

// drawTonDiamondIcon draws the official circular blue badge with TON diamond gemstone vector
func drawTonDiamondIcon(img *image.RGBA, cx, cy int, r float64) {
	// 1. Vibrant Telegram Blue circle (#0098EA)
	tonBlue := color.RGBA{R: 0x00, G: 0x98, B: 0xEA, A: 0xFF}
	ir := int(math.Ceil(r)) + 1
	for y := cy - ir; y <= cy+ir; y++ {
		dy := float64(y - cy)
		for x := cx - ir; x <= cx+ir; x++ {
			dx := float64(x - cx)
			d := math.Hypot(dx, dy)
			if d <= r {
				img.SetRGBA(x, y, tonBlue)
			} else if d <= r+1.2 {
				alpha := (r + 1.2 - d) / 1.2
				drawPixelOver(img, x, y, color.RGBA{
					R: tonBlue.R, G: tonBlue.G, B: tonBlue.B,
					A: uint8(float64(tonBlue.A) * alpha),
				})
			}
		}
	}

	// 2. Crisp White TON Diamond Gemstone Vector (matching Telegram Mini App exact SVG)
	white := color.RGBA{R: 0xFF, G: 0xFF, B: 0xFF, A: 0xFF}
	fcx := float64(cx)
	fcy := float64(cy)
	topY := fcy - 9.0
	bottomY := fcy + 13.0
	leftX := fcx - 12.0
	rightX := fcx + 12.0
	strokeW := 2.6

	// Top horizontal bar
	drawAALine(img, leftX, topY, rightX, topY, strokeW, white)
	// Left diagonal
	drawAALine(img, leftX, topY, fcx, bottomY, strokeW, white)
	// Right diagonal
	drawAALine(img, rightX, topY, fcx, bottomY, strokeW, white)
	// Center vertical line
	drawAALine(img, fcx, topY, fcx, bottomY, strokeW, white)
}

// drawApproxSymbol draws the mathematical approx symbol "≈" (two smooth parallel tildes)
func drawApproxSymbol(img *image.RGBA, x, y int, col color.RGBA) {
	width := 14
	for i := 0; i < width; i++ {
		t := float64(i) / float64(width-1)
		// Sine wave curve
		wave := math.Sin(t * 2.0 * math.Pi) * 1.6

		// Top wave
		py1 := int(math.Round(float64(y) - 3.5 - wave))
		drawPixelOver(img, x+i, py1, col)
		drawPixelOver(img, x+i, py1+1, col)

		// Bottom wave
		py2 := int(math.Round(float64(y) + 3.5 - wave))
		drawPixelOver(img, x+i, py2, col)
		drawPixelOver(img, x+i, py2+1, col)
	}
}
