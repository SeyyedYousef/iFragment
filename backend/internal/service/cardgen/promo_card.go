package cardgen

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math"
	"strings"
	"time"

	"golang.org/x/image/font"
	"golang.org/x/image/font/opentype"
)

// PromoCardParams defines all inputs for generating the 1080x1080 high-resolution
// institutional promotional valuation card used by /premium and rich PV reports.
type PromoCardParams struct {
	AssetType       string   // "username", "gift", "number"
	Title           string   // Hero title: "@crypto", "Plush Pepe #42", "+888 8888 8888"
	Eyebrow         string   // Eyebrow header above title
	Badge           string   // Top rarity / rank badge: "LEGENDARY", "EPIC", "RARE", "RANK #12"
	FairTON         string   // Estimated fair value in TON
	FairUSD         string   // Estimated fair value in USD
	LowTON          string   // Floor / Low TON
	LowUSD          string   // Floor / Low USD
	HighTON         string   // Ceiling / High TON
	HighUSD         string   // Ceiling / High USD
	Confidence      int      // Model confidence 0..100
	ConfidenceLabel string   // Optional override for Tile 3 label (defaults to "MODEL CONFIDENCE")
	SpecChips       []string // Up to 3 clean ASCII pills displayed in hero stage
	BotHandle       string   // Promo footer handle (e.g. "@iFragmentBot")
	CertRef         string   // Optional short footer ref/date

	// Gift-specific visual showcase fields
	ImageURL       string
	BackdropCenter string
	BackdropEdge   string
	ModelName      string
	BackdropName   string
	SymbolName     string
	SerialNumber   int
}

type promoTheme struct {
	TierVisual tierVisualTheme
	Accent     color.RGBA
	AccentSoft color.RGBA
	HeroGlow   color.RGBA
	IsPlatinum bool
}

func resolvePromoTheme(badge string, backdropCenter string, isGift bool) promoTheme {
	norm := normalizeCardTierBadge(badge)
	base := resolveTierTheme(norm)
	upper := strings.ToUpper(norm)

	pt := promoTheme{
		TierVisual: base,
		Accent:     base.Accent,
		HeroGlow:   base.CenterGlow,
	}

	switch {
	case strings.Contains(upper, "LEGENDARY") || strings.Contains(upper, "RANK #"):
		pt.Accent = color.RGBA{255, 198, 58, 255}
		pt.AccentSoft = color.RGBA{255, 198, 58, 48}
		pt.HeroGlow = color.RGBA{245, 158, 11, 255}
	case strings.Contains(upper, "EPIC"):
		pt.Accent = color.RGBA{56, 189, 248, 255}
		pt.AccentSoft = color.RGBA{14, 165, 233, 48}
		pt.HeroGlow = color.RGBA{14, 165, 233, 255}
	case strings.Contains(upper, "RARE"):
		pt.Accent = color.RGBA{52, 211, 153, 255}
		pt.AccentSoft = color.RGBA{16, 185, 129, 48}
		pt.HeroGlow = color.RGBA{16, 185, 129, 255}
	default:
		// Luxury Platinum + TON Sapphire palette so standard assets also look prestigious
		pt.IsPlatinum = true
		pt.TierVisual = tierVisualTheme{
			BorderStart:   color.RGBA{165, 180, 202, 255},
			BorderEnd:     color.RGBA{14, 132, 214, 255},
			CenterGlow:    color.RGBA{14, 165, 233, 255},
			SecondaryGlow: color.RGBA{148, 163, 184, 255},
			BadgeBg:       color.RGBA{17, 27, 44, 255},
			BadgeBorder:   color.RGBA{56, 114, 176, 255},
			BadgeText:     color.RGBA{142, 218, 255, 255},
			Accent:        color.RGBA{72, 198, 255, 255},
		}
		pt.Accent = color.RGBA{72, 198, 255, 255}
		pt.AccentSoft = color.RGBA{14, 165, 233, 44}
		pt.HeroGlow = color.RGBA{14, 165, 233, 255}
	}

	if isGift && strings.TrimSpace(backdropCenter) != "" {
		bc := parseHexColor(backdropCenter, pt.HeroGlow)
		pt.HeroGlow = lerpColor(pt.HeroGlow, bc, 0.55)
	}

	return pt
}

// sanitizePromoASCII ensures text rendered by Outfit never contains unsupported scripts/tofu glyphs.
func sanitizePromoASCII(s, fallback string) string {
	clean := strings.TrimSpace(s)
	if clean == "" {
		return fallback
	}
	var out strings.Builder
	for _, r := range clean {
		if r >= 0x20 && r <= 0x7E {
			out.WriteRune(r)
		} else if r == 0x00B7 || r == 0x2022 {
			out.WriteRune(r)
		}
	}
	res := strings.TrimSpace(out.String())
	if res == "" {
		return fallback
	}
	return res
}

// GeneratePremiumPromoCard renders a 1080x1080 Retina Fibonacci Golden-Ratio luxury valuation card PNG.
func (cg *CardGenerator) GeneratePremiumPromoCard(p PromoCardParams) ([]byte, error) {
	// Fetch external gift artwork BEFORE locking mutex so concurrent renders don't block on I/O.
	var giftImg image.Image
	if p.AssetType == "gift" && strings.TrimSpace(p.ImageURL) != "" {
		giftImg = fetchOrLoadGiftImage(p.ImageURL)
	}

	cg.mu.Lock()
	defer cg.mu.Unlock()

	const width = 1080
	const height = 1080
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	badge := normalizeCardTierBadge(p.Badge)
	theme := resolvePromoTheme(badge, p.BackdropCenter, p.AssetType == "gift")

	// 1. Authentic Fragment.com dark slate canvas (#1a2026), surface card (#212a33), and header strip (#293440)
	cg.drawPromoCardBase(img, theme)

	// 2. Top Fragment.com Header (Fragment Diamond + FRAGMENT + iFRAGMENT tag + Tier Pill + ● VERIFIED)
	cg.drawPromoHeader(img, badge, theme)

	// 3. Hero Stage Container (y = 172 .. 476) in #242e38 with crisp #2e3b48 border
	cg.drawPromoGlassPanel(img, 64, 172, 1016, 476, 20.0,
		color.RGBA{36, 46, 56, 255},
		color.RGBA{46, 59, 72, 255},
		1.5,
	)

	if p.AssetType == "gift" {
		cg.drawPromoGiftHero(img, p, theme, giftImg)
	} else {
		cg.drawPromoTextAssetHero(img, p, theme)
	}

	// 4. Fragment Valuation Table Panel (y = 500 .. 944)
	cg.drawPromoValuationBento(img, p, theme)

	// 5. Attribution Footer (y = 964 .. 1024)
	cg.drawPromoFooter(img, p, theme)

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, fmt.Errorf("failed to encode promo card png: %w", err)
	}
	return buf.Bytes(), nil
}

func (cg *CardGenerator) drawPromoCardBase(img *image.RGBA, theme promoTheme) {
	const width = 1080
	const height = 1080
	const cardX1, cardY1 = 28.0, 28.0
	const cardX2, cardY2 = 1052.0, 1052.0
	const cardRadius = 32.0
	const borderWidth = 1.8
	const headerBottomY = 142.0

	outerBg := color.RGBA{26, 32, 38, 255}   // #1a2026 Fragment canvas
	cardBg := color.RGBA{33, 42, 51, 255}    // #212a33 Fragment card
	headerBg := color.RGBA{41, 52, 64, 255}  // #293440 Fragment sticky header
	borderCol := color.RGBA{46, 59, 72, 255} // #2e3b48 Fragment hairline

	for y := 0; y < height; y++ {
		fy := float64(y)
		for x := 0; x < width; x++ {
			fx := float64(x)
			dist := roundedBoxSDF(fx, fy, cardX1, cardY1, cardX2, cardY2, cardRadius)
			if dist > 0.6 {
				img.SetRGBA(x, y, outerBg)
				continue
			}

			bgCol := cardBg
			if fy <= headerBottomY {
				bgCol = headerBg
			} else {
				dx := (fx - 540.0) / 460.0
				dy := (fy - 310.0) / 260.0
				rSq := dx*dx + dy*dy
				if rSq < 1.0 {
					t := 1.0 - math.Sqrt(rSq)
					bgCol = lerpColor(bgCol, color.RGBA{36, 139, 218, 255}, t*t*0.055)
				}
			}
			if fy >= headerBottomY-0.8 && fy <= headerBottomY+0.8 && dist < -borderWidth {
				bgCol = borderCol
			}

			var finalCol color.RGBA
			if dist >= -borderWidth {
				innerEdge := clamp01((dist + borderWidth) / 1.2)
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

	// Crisp signature top accent bar centered along top edge
	for x := 430; x <= 650; x++ {
		t := 1.0 - math.Abs(float64(x-540))/110.0
		blendPixel(img, x, 29, theme.Accent, t*0.85)
		blendPixel(img, x, 30, theme.Accent, t*0.55)
	}
}

func (cg *CardGenerator) drawPromoHeader(img *image.RGBA, badge string, theme promoTheme) {
	// 1. Left: Fragment Geometric Shard Mark + FRAGMENT + iFRAGMENT Pill
	cg.drawFragmentBrandMark(img, 86, 86, 22)

	brandFace, err := cg.displayFont(true, 28.0)
	if err == nil {
		defer brandFace.Close()
		cg.drawTextAt(img, brandFace, "FRAGMENT", 124, 96, color.RGBA{255, 255, 255, 255})
		bw := font.MeasureString(brandFace, "FRAGMENT").Ceil()

		tagFace, tErr := cg.displayFont(true, 13.0)
		if tErr == nil {
			defer tagFace.Close()
			tagTxt := "iFRAGMENT"
			tw := font.MeasureString(tagFace, tagTxt).Ceil()
			tx1 := 124 + bw + 18
			tx2 := tx1 + tw + 26
			drawRoundedPill(img, tx1, 68, tx2, 104, 10.0,
				color.RGBA{30, 50, 70, 255},
				color.RGBA{46, 86, 126, 255},
				1.3,
			)
			cg.drawTextAt(img, tagFace, tagTxt, tx1+13, 91, color.RGBA{77, 178, 255, 255})
		}
	}

	// 2. Right: Emerald [ ● VERIFIED ] pill + Tier Pill
	verRightX := 1016
	pillY1 := 64
	pillY2 := 108

	verFace, err := cg.displayFont(false, 13.0)
	if err == nil {
		defer verFace.Close()
		verLabel := "VERIFIED"
		vw := font.MeasureString(verFace, verLabel).Ceil()
		vPillW := vw + 52
		vPillX1 := verRightX - vPillW

		drawRoundedPill(img, vPillX1, pillY1, verRightX, pillY2, 12.0,
			color.RGBA{24, 52, 42, 255},
			color.RGBA{44, 118, 82, 255},
			1.4,
		)

		dotCX := float64(vPillX1 + 22)
		dotCY := float64(pillY1+pillY2) / 2.0
		drawSoftGlowDot(img, dotCX, dotCY, 4.8, color.RGBA{90, 236, 140, 255})
		cg.drawTextAt(img, verFace, verLabel, vPillX1+36, pillY1+27, color.RGBA{90, 236, 140, 255})

		verRightX = vPillX1 - 14
	}

	// Tier Pill
	tierFace, err := cg.displayFont(true, 13.5)
	if err == nil {
		defer tierFace.Close()
		tw := font.MeasureString(tierFace, badge).Ceil()
		tPillW := tw + 52
		if tPillW < 126 {
			tPillW = 126
		}
		tPillX2 := verRightX
		tPillX1 := tPillX2 - tPillW
		drawRoundedPill(img, tPillX1, pillY1, tPillX2, pillY2, 12.0,
			theme.TierVisual.BadgeBg,
			theme.TierVisual.BadgeBorder,
			1.4,
		)
		drawSoftGlowDot(img, float64(tPillX1+22), float64(pillY1+pillY2)/2.0, 4.6, theme.TierVisual.BadgeText)

		tx := tPillX1 + 34 + (tPillW-34-tw)/2
		cg.drawTextAt(img, tierFace, badge, tx, pillY1+27, theme.TierVisual.BadgeText)
	}
}

func (cg *CardGenerator) drawPromoTextAssetHero(img *image.RGBA, p PromoCardParams, theme promoTheme) {
	const stageX1, stageX2 = 64, 1016
	const stageW = stageX2 - stageX1

	eyebrow := sanitizePromoASCII(p.Eyebrow, "TELEGRAM DIGITAL ASSET")
	eyeFace, err := cg.displayFont(false, 13.5)
	if err == nil {
		defer eyeFace.Close()
		ew := font.MeasureString(eyeFace, eyebrow).Ceil()
		ex := stageX1 + (stageW-ew)/2
		cg.drawTextAt(img, eyeFace, eyebrow, ex, 224, color.RGBA{140, 154, 169, 255})
	}

	mainTitle := sanitizePromoASCII(p.Title, "TELEGRAM ASSET")
	maxTextW := 840
	mainFace, _, err := cg.fitDisplayFont(true, mainTitle, 74.0, 28.0, maxTextW)
	if err == nil {
		defer mainFace.Close()
		mw := font.MeasureString(mainFace, mainTitle).Ceil()
		mx := stageX1 + (stageW-mw)/2
		my := 318
		cg.drawTextAt(img, mainFace, mainTitle, mx, my+4, color.RGBA{14, 18, 24, 180})
		cg.drawTextAt(img, mainFace, mainTitle, mx, my, color.RGBA{255, 255, 255, 255})
	}

	// Authentic fragment.com deep-link subline
	var fragSub string
	if p.AssetType == "number" {
		digits := strings.NewReplacer("+", "", " ", "", "-", "").Replace(mainTitle)
		fragSub = "fragment.com/number/" + digits
	} else {
		cleanUser := strings.TrimPrefix(strings.ToLower(mainTitle), "@")
		fragSub = "fragment.com/username/" + cleanUser
	}
	subFace, sErr := cg.displayFont(true, 16.0)
	if sErr == nil {
		defer subFace.Close()
		sw := font.MeasureString(subFace, fragSub).Ceil()
		cg.drawTextAt(img, subFace, fragSub, stageX1+(stageW-sw)/2, 360, color.RGBA{77, 178, 255, 255})
	}

	cg.drawPromoChipRow(img, p.SpecChips, 540, 396, 872, theme)
}

func (cg *CardGenerator) drawPromoGiftHero(img *image.RGBA, p PromoCardParams, theme promoTheme, giftImg image.Image) {
	// Left 252x252 artwork showcase frame
	const boxSize = 252
	const boxX1 = 102
	const boxY1 = 192
	const boxX2 = boxX1 + boxSize
	const boxY2 = boxY1 + boxSize
	const boxRadius = 44.0

	centerCol := parseHexColor(p.BackdropCenter, color.RGBA{14, 165, 233, 255})
	edgeCol := parseHexColor(p.BackdropEdge, color.RGBA{11, 20, 38, 255})

	for y := boxY1 - 8; y <= boxY2+8; y++ {
		for x := boxX1 - 8; x <= boxX2+8; x++ {
			dist := roundedBoxSDF(float64(x), float64(y), float64(boxX1), float64(boxY1), float64(boxX2), float64(boxY2), boxRadius)
			if dist <= 0 {
				dx := float64(x - (boxX1 + boxSize/2))
				dy := float64(y - (boxY1 + boxSize/2))
				rNorm := math.Min(1.0, math.Sqrt(dx*dx+dy*dy)/(float64(boxSize)*0.68))
				fill := lerpColor(centerCol, edgeCol, rNorm)

				// Diagonal glass sheen
				sheen := (float64(x-boxX1) + float64(y-boxY1)) / float64(boxSize*2)
				if sheen < 0.44 {
					fill = lerpColor(fill, color.RGBA{255, 255, 255, 255}, (0.44-sheen)*0.16)
				}

				if dist >= -2.6 {
					t := clamp01((dist + 2.6) / 2.6)
					borderTint := lerpColor(theme.Accent, color.RGBA{140, 165, 205, 255}, 0.45)
					fill = lerpColor(fill, borderTint, t*0.85)
				}
				if dist > -1.0 {
					blendPixel(img, x, y, fill, clamp01(0.5-dist))
				} else {
					img.SetRGBA(x, y, fill)
				}
			} else if dist < 8.0 {
				glowT := 1.0 - dist/8.0
				blendPixel(img, x, y, centerCol, glowT*glowT*0.26)
			}
		}
	}

	if giftImg != nil {
		const pad = 18
		target := boxSize - pad*2
		compositeScaledImageRounded(img, giftImg, boxX1+pad, boxY1+pad, target, target,
			float64(boxX1), float64(boxY1), float64(boxX2), float64(boxY2), boxRadius-2.0)
	} else {
		cg.drawGiftVectorEmblem(img, boxX1+boxSize/2, boxY1+boxSize/2, 66, color.RGBA{255, 255, 255, 245})
	}

	// Serial pill in top-right of gift showcase
	if p.SerialNumber > 0 {
		serialText := fmt.Sprintf("#%d", p.SerialNumber)
		sFace, err := cg.displayFont(true, 14.5)
		if err == nil {
			defer sFace.Close()
			sw := font.MeasureString(sFace, serialText).Ceil()
			sPillW := sw + 28
			sPillH := 34
			sPillX2 := boxX2 - 12
			sPillX1 := sPillX2 - sPillW
			sPillY1 := boxY1 + 12
			sPillY2 := sPillY1 + sPillH
			drawRoundedPill(img, sPillX1, sPillY1, sPillX2, sPillY2, 12.0,
				color.RGBA{10, 14, 24, 238},
				theme.TierVisual.BadgeBorder,
				1.5,
			)
			cg.drawTextAt(img, sFace, serialText, sPillX1+(sPillW-sw)/2, sPillY1+23, theme.TierVisual.BadgeText)
		}
	}

	// Right Metadata Column (x = 392 .. 976)
	const colX = 392
	const maxColW = 580

	eyebrow := sanitizePromoASCII(p.Eyebrow, "TELEGRAM COLLECTIBLE GIFT")
	eyeFace, err := cg.displayFont(false, 12.5)
	if err == nil {
		defer eyeFace.Close()
		drawSoftGlowDot(img, float64(colX+5), 217.0, 3.2, theme.Accent)
		cg.drawTextAt(img, eyeFace, eyebrow, colX+16, 222, theme.Accent)
	}

	// Gift Title
	giftTitle := sanitizePromoASCII(p.Title, "Telegram Gift")
	tFace, _, err := cg.fitDisplayFont(true, giftTitle, 44.0, 24.0, maxColW)
	if err == nil {
		defer tFace.Close()
		cg.drawTextAt(img, tFace, giftTitle, colX, 275, color.RGBA{0, 0, 0, 195})
		cg.drawTextAt(img, tFace, giftTitle, colX, 271, color.RGBA{255, 255, 255, 255})
	}

	// Trait rows (Model / Backdrop / Symbol or fallback specs) with left glowing accent bar
	type traitRow struct {
		Label string
		Value string
		Color color.RGBA
	}
	var rows []traitRow
	if m := sanitizePromoASCII(p.ModelName, ""); m != "" {
		rows = append(rows, traitRow{Label: "3D MODEL", Value: m, Color: theme.Accent})
	}
	if b := sanitizePromoASCII(p.BackdropName, ""); b != "" {
		rows = append(rows, traitRow{Label: "BACKDROP DNA", Value: b, Color: centerCol})
	}
	if s := sanitizePromoASCII(p.SymbolName, ""); s != "" {
		rows = append(rows, traitRow{Label: "SYMBOL PATTERN", Value: s, Color: color.RGBA{255, 200, 68, 255}})
	}
	if len(rows) == 0 {
		for _, chip := range p.SpecChips {
			if c := sanitizePromoASCII(chip, ""); c != "" {
				rows = append(rows, traitRow{Label: "ON-CHAIN TRAIT", Value: c, Color: theme.Accent})
			}
		}
	}

	lblFace, lErr := cg.displayFont(false, 12.0)
	valFace, vErr := cg.displayFont(true, 15.5)
	if lErr == nil && vErr == nil {
		defer lblFace.Close()
		defer valFace.Close()

		rowY := 302
		for i, tr := range rows {
			if i >= 3 {
				break
			}
			y1 := rowY
			y2 := rowY + 44
			cg.drawPromoGlassPanel(img, colX, y1, 976, y2, 14.0,
				color.RGBA{17, 24, 39, 232},
				color.RGBA{40, 54, 80, 235},
				1.3,
			)
			// Left vertical accent pill inside trait row
			drawRoundedPill(img, colX+10, y1+10, colX+15, y2-10, 2.5, tr.Color, tr.Color, 0)

			cg.drawTextAt(img, lblFace, tr.Label, colX+26, y1+27, color.RGBA{134, 148, 174, 255})

			valText := tr.Value
			if len(valText) > 26 {
				valText = valText[:23] + "..."
			}
			vw := font.MeasureString(valFace, valText).Ceil()
			cg.drawTextAt(img, valFace, valText, 976-20-vw, y1+28, color.RGBA{240, 246, 255, 255})

			rowY += 51
		}
	}
}

func (cg *CardGenerator) drawPromoValuationBento(img *image.RGBA, p PromoCardParams, theme promoTheme) {
	// Main Fragment Valuation Container (x=64..1016, y=500..944)
	cg.drawPromoGlassPanel(img, 64, 500, 1016, 944, 20.0,
		color.RGBA{36, 46, 56, 255},
		color.RGBA{46, 59, 72, 255},
		1.5,
	)

	// Format TON & USD
	fairTONDisp, fairTONNum := formatTONDisplay(p.FairTON)
	fairUSDClean := formatUSDTAmount(p.FairUSD)
	if fairUSDClean == "" && fairTONNum > 0 {
		fallbackUSD := math.Round(fairTONNum * 3.48)
		if fallbackUSD < 1 {
			fallbackUSD = 1
		}
		fairUSDClean = formatUSDTAmount(fmt.Sprintf("%.0f", fallbackUSD))
	}
	if fairUSDClean == "" {
		fairUSDClean = "0"
	}

	// Top-Left & Top-Right Labels
	lblFace, err := cg.displayFont(false, 13.0)
	if err == nil {
		defer lblFace.Close()
		cg.drawTextAt(img, lblFace, "ESTIMATED FAIR MARKET VALUE", 108, 550, color.RGBA{134, 148, 174, 255})

		usdLbl := "USD EQUIVALENT"
		uw := font.MeasureString(lblFace, usdLbl).Ceil()
		cg.drawTextAt(img, lblFace, usdLbl, 972-uw, 550, color.RGBA{134, 148, 174, 255})
	}

	// 3D Glowing TON Jewel Badge (cx=140, cy=628, r=33)
	cg.drawTONBadge(img, 140, 628, 33)

	// Right-side USD value + Live Spot Pill
	usdStr := "~ $" + fairUSDClean
	usdFace, _, uErr := cg.fitDisplayFont(true, usdStr, 48.0, 26.0, 290)
	usdStartX := 972
	if uErr == nil {
		defer usdFace.Close()
		uw := font.MeasureString(usdFace, usdStr).Ceil()
		usdStartX = 972 - uw
		cg.drawTextAt(img, usdFace, usdStr, usdStartX, 634, color.RGBA{240, 246, 255, 255})

		// Sleek Live Market Rate Pill below USD
		tagFace, tErr := cg.displayFont(true, 10.5)
		if tErr == nil {
			defer tagFace.Close()
			rateTag := "LIVE TON SPOT"
			rw := font.MeasureString(tagFace, rateTag).Ceil()
			pillW := rw + 34
			px2 := 972
			px1 := px2 - pillW
			py1 := 650
			py2 := 676
			drawRoundedPill(img, px1, py1, px2, py2, 13.0,
				color.RGBA{17, 25, 42, 245},
				color.RGBA{42, 58, 88, 245},
				1.2,
			)
			drawSoftGlowDot(img, float64(px1+13), float64(py1+py2)*0.5, 3.0, theme.Accent)
			cg.drawTextAt(img, tagFace, rateTag, px1+23, py1+17, theme.Accent)
		}
	}

	// Giant White TON Figure + Glowing Blue TON Unit
	maxTonBlockW := usdStartX - 194 - 28
	if maxTonBlockW < 260 {
		maxTonBlockW = 260
	}
	unitFace, unitErr := cg.displayFont(true, 26.0)
	unitW := 68
	if unitErr == nil {
		defer unitFace.Close()
		unitW = font.MeasureString(unitFace, "TON").Ceil() + 14
	}

	tonFace, _, tonErr := cg.fitDisplayFont(true, fairTONDisp, 72.0, 34.0, maxTonBlockW-unitW)
	if tonErr == nil {
		defer tonFace.Close()
		tonX := 194
		tonY := 652
		tw := font.MeasureString(tonFace, fairTONDisp).Ceil()
		cg.drawTextAt(img, tonFace, fairTONDisp, tonX, tonY+5, color.RGBA{0, 0, 0, 195})
		cg.drawTextAt(img, tonFace, fairTONDisp, tonX, tonY, color.RGBA{255, 255, 255, 255})

		if unitErr == nil {
			cg.drawTextAt(img, unitFace, "TON", tonX+tw+14, 636, color.RGBA{38, 172, 255, 255})
		}
	}

	// Parse Floor & Ceiling values
	lowTONDisp, lowTONNum := formatTONDisplay(p.LowTON)
	highTONDisp, highTONNum := formatTONDisplay(p.HighTON)
	if lowTONNum <= 0 && fairTONNum > 0 {
		lowTONDisp, lowTONNum = formatTONDisplay(fmt.Sprintf("%.1f", fairTONNum*0.76))
	}
	if highTONNum <= 0 && fairTONNum > 0 {
		highTONDisp, highTONNum = formatTONDisplay(fmt.Sprintf("%.1f", fairTONNum*1.28))
	}

	lowUSDClean := formatUSDTAmount(p.LowUSD)
	if lowUSDClean == "" && lowTONNum > 0 {
		lowUSDClean = formatUSDTAmount(fmt.Sprintf("%.0f", math.Max(1, math.Round(lowTONNum*3.48))))
	}
	highUSDClean := formatUSDTAmount(p.HighUSD)
	if highUSDClean == "" && highTONNum > 0 {
		highUSDClean = formatUSDTAmount(fmt.Sprintf("%.0f", math.Max(1, math.Round(highTONNum*3.48))))
	}

	// Golden Ratio Price Range Spectrum Gauge (y = 702..740)
	cg.drawPromoSpectrumBar(img, 108, 972, 722, lowTONNum, fairTONNum, highTONNum, theme)

	// Lower 3-Tile Bento Matrix (y = 762..910)
	// Tile X bounds: [108..380], [404..676], [700..972] (each 272w, gap 24)
	cg.drawMetricTile(img, 108, 762, 380, 910, "LIQUIDITY FLOOR", lowTONDisp+" TON", "~ $"+fallbackNonEmpty(lowUSDClean, "0"), color.RGBA{56, 189, 248, 255}, color.RGBA{234, 242, 252, 255})
	cg.drawMetricTile(img, 404, 762, 676, 910, "OPTIMISTIC CEILING", highTONDisp+" TON", "~ $"+fallbackNonEmpty(highUSDClean, "0"), theme.Accent, color.RGBA{234, 242, 252, 255})

	// Tile 3: Confidence with 12-segment Fibonacci LED progress bar
	conf := p.Confidence
	if conf <= 0 {
		conf = 88
	}
	if conf > 100 {
		conf = 100
	}
	confLabel := sanitizePromoASCII(p.ConfidenceLabel, "MODEL CONFIDENCE")
	cg.drawConfidenceTile(img, 700, 762, 972, 910, confLabel, conf, theme)
}

func (cg *CardGenerator) drawPromoSpectrumBar(img *image.RGBA, x1, x2, barY int, lowNum, fairNum, highNum float64, theme promoTheme) {
	const barH = 10
	barY1 := barY
	barY2 := barY + barH

	// Micro labels above spectrum bar
	sFace, err := cg.displayFont(true, 10.0)
	if err == nil {
		defer sFace.Close()
		cg.drawTextAt(img, sFace, "FLOOR SUPPORT", x1, barY1-10, color.RGBA{116, 132, 158, 255})
		rightTxt := "CEILING POTENTIAL"
		rw := font.MeasureString(sFace, rightTxt).Ceil()
		cg.drawTextAt(img, sFace, rightTxt, x2-rw, barY1-10, color.RGBA{116, 132, 158, 255})
	}

	// Track capsule
	drawRoundedPill(img, x1, barY1, x2, barY2, 5.0,
		color.RGBA{19, 26, 42, 255},
		color.RGBA{38, 52, 78, 255},
		1.2,
	)

	// Compute Golden Ratio position along spectrum
	posRatio := 1.0 / GoldenRatioPhi // 0.618 default
	if highNum > lowNum && fairNum >= lowNum && fairNum <= highNum {
		posRatio = (fairNum - lowNum) / (highNum - lowNum)
		if posRatio < 0.24 {
			posRatio = 0.24
		} else if posRatio > 0.78 {
			posRatio = 0.78
		}
	}
	markerX := x1 + int(math.Round(float64(x2-x1)*posRatio))

	// Gradient active fill from x1 to markerX
	leftCol := color.RGBA{14, 148, 224, 255}
	for x := x1 + 2; x <= markerX; x++ {
		t := clamp01(float64(x-x1) / math.Max(1.0, float64(markerX-x1)))
		c := lerpColor(leftCol, theme.Accent, t)
		for y := barY1 + 2; y < barY2-1; y++ {
			img.SetRGBA(x, y, c)
		}
	}

	// Center label above marker
	if err == nil {
		midTxt := "FAIR VALUE ANCHOR"
		mw := font.MeasureString(sFace, midTxt).Ceil()
		mx := markerX - mw/2
		if mx < x1+130 {
			mx = x1 + 130
		}
		if mx+mw > x2-140 {
			mx = x2 - 140 - mw
		}
		cg.drawTextAt(img, sFace, midTxt, mx, barY1-10, theme.Accent)
	}

	// Glowing Fair Value Marker Node
	cy := float64(barY1+barY2) * 0.5
	drawSoftGlowDot(img, float64(markerX), cy, 10.0, theme.Accent)
	drawSoftGlowDot(img, float64(markerX), cy, 4.8, color.RGBA{255, 255, 255, 255})
}

func (cg *CardGenerator) drawMetricTile(img *image.RGBA, x1, y1, x2, y2 int, label, primaryVal, subVal string, dotCol, valCol color.RGBA) {
	cg.drawPromoGlassPanel(img, x1, y1, x2, y2, 14.0,
		color.RGBA{30, 39, 48, 255},
		color.RGBA{46, 59, 72, 255},
		1.2,
	)

	padX := x1 + 22
	maxW := (x2 - x1) - 44

	drawSoftGlowDot(img, float64(padX+4), float64(y1+32), 3.4, dotCol)
	lblFace, err := cg.displayFont(false, 11.5)
	if err == nil {
		defer lblFace.Close()
		cg.drawTextAt(img, lblFace, label, padX+15, y1+36, color.RGBA{140, 154, 169, 255})
	}

	valFace, _, err := cg.fitDisplayFont(true, primaryVal, 27.0, 16.0, maxW)
	if err == nil {
		defer valFace.Close()
		cg.drawTextAt(img, valFace, primaryVal, padX, y1+84, valCol)
	}

	subFace, err := cg.displayFont(false, 14.5)
	if err == nil {
		defer subFace.Close()
		cg.drawTextAt(img, subFace, subVal, padX, y1+120, color.RGBA{140, 154, 169, 255})
	}
}

func (cg *CardGenerator) drawConfidenceTile(img *image.RGBA, x1, y1, x2, y2 int, label string, pct int, theme promoTheme) {
	cg.drawPromoGlassPanel(img, x1, y1, x2, y2, 14.0,
		color.RGBA{30, 39, 48, 255},
		color.RGBA{46, 59, 72, 255},
		1.2,
	)

	padX := x1 + 22
	drawSoftGlowDot(img, float64(padX+4), float64(y1+32), 3.4, color.RGBA{90, 236, 140, 255})
	lblFace, err := cg.displayFont(false, 11.5)
	if err == nil {
		defer lblFace.Close()
		cg.drawTextAt(img, lblFace, label, padX+15, y1+36, color.RGBA{140, 154, 169, 255})
	}

	valStr := fmt.Sprintf("%d%%", pct)
	valFace, err := cg.displayFont(true, 29.0)
	if err == nil {
		defer valFace.Close()
		vw := font.MeasureString(valFace, valStr).Ceil()
		cg.drawTextAt(img, valFace, valStr, padX, y1+84, color.RGBA{90, 236, 140, 255})

		qFace, qErr := cg.displayFont(true, 10.0)
		if qErr == nil {
			defer qFace.Close()
			qLabel := "VERIFIED"
			if pct < 80 {
				qLabel = "ESTIMATED"
			}
			qw := font.MeasureString(qFace, qLabel).Ceil()
			qx1 := x2 - 22 - (qw + 20)
			if qx1 > padX+vw+10 {
				drawRoundedPill(img, qx1, y1+60, x2-22, y1+84, 8.0,
					color.RGBA{24, 52, 42, 255},
					color.RGBA{44, 118, 82, 255},
					1.0,
				)
				cg.drawTextAt(img, qFace, qLabel, qx1+10, y1+76, color.RGBA{90, 236, 140, 255})
			}
		}
	}

	// 12-Segment Fragment Emerald Progress Bar
	barX1 := padX
	barX2 := x2 - 22
	barY1 := y1 + 106
	barY2 := y1 + 120
	const segments = 12
	const segGap = 5
	totalBarW := barX2 - barX1
	segW := (totalBarW - (segments-1)*segGap) / segments
	activeSegs := int(math.Round(float64(segments) * float64(pct) / 100.0))
	if activeSegs < 1 {
		activeSegs = 1
	}

	for s := 0; s < segments; s++ {
		sx1 := barX1 + s*(segW+segGap)
		sx2 := sx1 + segW
		if s == segments-1 {
			sx2 = barX2
		}
		if s < activeSegs {
			segT := float64(s) / float64(segments-1)
			segCol := lerpColor(color.RGBA{36, 139, 218, 255}, color.RGBA{90, 236, 140, 255}, segT)
			drawRoundedPill(img, sx1, barY1, sx2, barY2, 4.0, segCol, segCol, 0)
		} else {
			drawRoundedPill(img, sx1, barY1, sx2, barY2, 4.0,
				color.RGBA{41, 52, 64, 255},
				color.RGBA{46, 59, 72, 255},
				1.0,
			)
		}
	}
	_ = theme
}

func (cg *CardGenerator) drawPromoChipRow(img *image.RGBA, chips []string, centerX, y1, maxTotalW int, theme promoTheme) {
	if len(chips) == 0 {
		return
	}
	chipFace, err := cg.displayFont(true, 13.0)
	if err != nil {
		return
	}
	defer chipFace.Close()

	type measuredChip struct {
		text string
		w    int
	}
	var items []measuredChip
	const gap = 14
	totalW := 0
	for _, raw := range chips {
		if len(items) >= 3 {
			break
		}
		clean := sanitizePromoASCII(strings.ToUpper(raw), "")
		if clean == "" {
			continue
		}
		tw := font.MeasureString(chipFace, clean).Ceil()
		cw := tw + 48
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
	const chipH = 42
	for _, item := range items {
		drawRoundedPill(img, curX, y1, curX+item.w, y1+chipH, 12.0,
			color.RGBA{30, 39, 48, 255},
			color.RGBA{46, 59, 72, 255},
			1.2,
		)
		dotCX := float64(curX + 19)
		dotCY := float64(y1+y1+chipH) * 0.5
		drawSoftGlowDot(img, dotCX, dotCY, 3.4, theme.Accent)

		tw := font.MeasureString(chipFace, item.text).Ceil()
		tx := curX + 28 + (item.w-28-tw)/2
		cg.drawTextAt(img, chipFace, item.text, tx, y1+26, color.RGBA{212, 223, 233, 255})
		curX += item.w + gap
	}
}

func (cg *CardGenerator) drawPromoFooter(img *image.RGBA, p PromoCardParams, theme promoTheme) {
	botHandle := sanitizePromoASCII(p.BotHandle, "@iFragmentBot")
	if !strings.HasPrefix(botHandle, "@") {
		botHandle = "@" + botHandle
	}

	cg.drawFragmentBrandMark(img, 80, 992, 11)

	hFace, hErr := cg.displayFont(true, 17.0)
	if hErr == nil {
		defer hFace.Close()
		hw := font.MeasureString(hFace, botHandle).Ceil()
		cg.drawTextAt(img, hFace, botHandle, 102, 998, color.RGBA{255, 255, 255, 255})

		subFace, sErr := cg.displayFont(false, 13.0)
		if sErr == nil {
			defer subFace.Close()
			cg.drawTextAt(img, subFace, "  ·  ON-CHAIN AVM VALUATION TERMINAL", 102+hw, 997, color.RGBA{140, 154, 169, 255})
		}
	}

	ref := sanitizePromoASCII(p.CertRef, "")
	if ref == "" {
		ref = "FRAGMENT.COM  ·  " + time.Now().UTC().Format("2006-01-02")
	} else {
		ref = strings.ReplaceAll(ref, "|", "·")
	}

	rFace, rErr := cg.displayFont(true, 12.0)
	if rErr == nil {
		defer rFace.Close()
		rw := font.MeasureString(rFace, ref).Ceil()
		pillW := rw + 36
		px2 := 1016
		px1 := px2 - pillW
		py1 := 974
		py2 := 1010
		drawRoundedPill(img, px1, py1, px2, py2, 10.0,
			color.RGBA{36, 46, 56, 255},
			color.RGBA{46, 59, 72, 255},
			1.1,
		)
		cg.drawTextAt(img, rFace, ref, px1+(pillW-rw)/2, py1+22, color.RGBA{77, 178, 255, 255})
	}
	_ = theme
}

func (cg *CardGenerator) drawPromoGlassPanel(img *image.RGBA, x1, y1, x2, y2 int, r float64, fillCol, borderCol color.RGBA, borderW float64) {
	fx1, fy1, fx2, fy2 := float64(x1), float64(y1), float64(x2), float64(y2)
	for y := y1 - 2; y <= y2+2; y++ {
		for x := x1 - 2; x <= x2+2; x++ {
			dist := roundedBoxSDF(float64(x), float64(y), fx1, fy1, fx2, fy2, r)
			if dist > 0.6 {
				continue
			}

			var col color.RGBA
			var alpha float64
			if dist >= -borderW {
				rimFade := clamp01(1.0 - (float64(y)-fy1)/(fy2-fy1)*0.6)
				topRim := lerpColor(borderCol, color.RGBA{255, 255, 255, 255}, rimFade*0.12)
				t := clamp01((dist + borderW) / math.Max(borderW, 1.0))
				col = lerpColor(fillCol, topRim, t)
				alpha = (float64(col.A) / 255.0) * clamp01(0.55-dist)
			} else {
				col = fillCol
				alpha = float64(fillCol.A) / 255.0
			}
			blendPixel(img, x, y, col, alpha)
		}
	}
}

func drawCircleOutline(img *image.RGBA, cx, cy, r int, thickness float64, col color.RGBA) {
	fr := float64(r)
	halfT := thickness * 0.5
	bound := r + int(math.Ceil(thickness)) + 2
	for dy := -bound; dy <= bound; dy++ {
		for dx := -bound; dx <= bound; dx++ {
			d := math.Abs(math.Sqrt(float64(dx*dx+dy*dy)) - fr)
			if d <= halfT+0.8 {
				a := clamp01(halfT + 0.5 - d)
				blendPixel(img, cx+dx, cy+dy, col, a*(float64(col.A)/255.0))
			}
		}
	}
}

func (cg *CardGenerator) displayFont(black bool, size float64) (font.Face, error) {
	f := cg.fontOutfitBold
	if black && cg.fontOutfitBlack != nil {
		f = cg.fontOutfitBlack
	}
	if f == nil {
		f = cg.fontOutfitMedium
	}
	return cg.getFace(f, size)
}

func (cg *CardGenerator) fitDisplayFont(black bool, text string, startSize, minSize float64, maxWidth int) (font.Face, float64, error) {
	size := startSize
	for {
		face, err := cg.displayFont(black, size)
		if err != nil {
			return nil, 0, err
		}
		w := font.MeasureString(face, text).Ceil()
		if w <= maxWidth || size <= minSize {
			return face, size, nil
		}
		face.Close()
		size -= 2.0
		if size < minSize {
			size = minSize
		}
	}
}

func fallbackNonEmpty(s, def string) string {
	if strings.TrimSpace(s) == "" {
		return def
	}
	return s
}

var _ *opentype.Font
