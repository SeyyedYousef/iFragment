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
)

// DailyRecapTick is a single timestamped TON/USD sample plotted on the 24-hour chart.
type DailyRecapTick struct {
	Price     float64
	Timestamp time.Time
}

// DailyRecapCardParams contains all inputs for the 1200x900 viral TONCOIN Daily Recap PNG card.
type DailyRecapCardParams struct {
	DateLabel     string           // e.g. "24 NOV 2026"
	ChannelHandle string           // e.g. "@TheGramPrice"
	OpenPrice     float64          // 00:00 UTC open price
	HighPrice     float64          // 24h peak price
	HighTimeUTC   string           // e.g. "18:40"
	LowPrice      float64          // 24h low price
	LowTimeUTC    string           // e.g. "04:10"
	ClosePrice    float64          // 24:00 / 00:00 UTC close price
	AvgPrice      float64          // 24h mean price
	NetChange     float64          // Close - Open
	PctChange     float64          // (NetChange / Open) * 100
	SpreadPct     float64          // ((High - Low) / Low) * 100
	RangePosPct   float64          // ((Close - Low) / (High - Low)) * 100
	TicksCount    int              // Number of live 10-minute samples collected
	Has7DChange   bool             // Whether 7-day rolling change is available
	Change7DPct   float64          // 7-day percentage change
	StreakDays    int              // Positive = green streak days, negative = red streak days
	Ticks         []DailyRecapTick // Chronological price samples for 24h chart
}

type recapMoodTheme struct {
	IsBullish  bool
	IsBearish  bool
	Label      string
	Accent     color.RGBA
	AccentSoft color.RGBA
	Glow       color.RGBA
	PillBg     color.RGBA
	PillBorder color.RGBA
	PillText   color.RGBA
}

func resolveRecapMoodTheme(pctChange float64) recapMoodTheme {
	switch {
	case pctChange > 0.05:
		return recapMoodTheme{
			IsBullish:  true,
			Label:      "BULLISH",
			Accent:     color.RGBA{52, 211, 153, 255},  // #34D399 Emerald
			AccentSoft: color.RGBA{110, 231, 183, 255}, // #6EE7B7 Mint
			Glow:       color.RGBA{16, 185, 129, 255},
			PillBg:     color.RGBA{18, 48, 39, 255},
			PillBorder: color.RGBA{34, 106, 81, 255},
			PillText:   color.RGBA{74, 222, 128, 255},
		}
	case pctChange < -0.05:
		return recapMoodTheme{
			IsBearish:  true,
			Label:      "BEARISH",
			Accent:     color.RGBA{251, 113, 133, 255}, // #FB7185 Rose Coral
			AccentSoft: color.RGBA{253, 164, 175, 255}, // #FDA4AF Soft Coral
			Glow:       color.RGBA{244, 63, 94, 255},
			PillBg:     color.RGBA{54, 25, 34, 255},
			PillBorder: color.RGBA{122, 46, 65, 255},
			PillText:   color.RGBA{253, 164, 175, 255},
		}
	default:
		return recapMoodTheme{
			Label:      "STEADY",
			Accent:     color.RGBA{77, 178, 255, 255}, // #4DB2FF TON Sky
			AccentSoft: color.RGBA{125, 211, 252, 255},
			Glow:       color.RGBA{36, 139, 218, 255},
			PillBg:     color.RGBA{25, 47, 68, 255},
			PillBorder: color.RGBA{45, 93, 136, 255},
			PillText:   color.RGBA{125, 211, 252, 255},
		}
	}
}

func formatRecapPrice(p float64) string {
	if p <= 0 {
		return "N/A"
	}
	if p >= 100.0 {
		return fmt.Sprintf("$%.2f", p)
	}
	if p >= 1.0 {
		return fmt.Sprintf("$%.3f", p)
	}
	if p >= 0.01 {
		return fmt.Sprintf("$%.4f", p)
	}
	return fmt.Sprintf("$%.5f", p)
}

func formatRecapDeltaUSD(delta float64) string {
	sign := "+"
	absVal := delta
	if delta < 0 {
		sign = "-"
		absVal = -delta
	}
	if absVal >= 1.0 {
		return fmt.Sprintf("%s$%.2f", sign, absVal)
	}
	if absVal >= 0.01 {
		return fmt.Sprintf("%s$%.3f", sign, absVal)
	}
	return fmt.Sprintf("%s$%.4f", sign, absVal)
}

func formatRecapPct(pct float64) string {
	if pct > 0 {
		return fmt.Sprintf("+%.2f%%", pct)
	}
	return fmt.Sprintf("%.2f%%", pct)
}

// GenerateDailyRecapCard renders a 1200x900 editorial-grade TONCOIN Daily Recap PNG card
// designed for instant readability and high organic forwarding across Telegram channels.
func (cg *CardGenerator) GenerateDailyRecapCard(p DailyRecapCardParams) ([]byte, error) {
	cg.mu.Lock()
	defer cg.mu.Unlock()

	const width = 1200
	const height = 900
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	mood := resolveRecapMoodTheme(p.PctChange)

	// 1. Dark Obsidian Slate Canvas + Header Strip + Ambient Mood Glow
	cg.drawRecapBase(img, mood)

	// 2. Top Header Strip (TON Crystal Mark + TONCOIN + DAILY RECAP | Date + Mood Badge)
	cg.drawRecapHeader(img, p, mood)

	// 3. Hero Price Row (Close Price + 24h Delta Pill + Right KPI Pills)
	cg.drawRecapHero(img, p, mood)

	// 4. Full-Width 24-Hour Smooth Area Sparkline Chart with High/Low/Open Callouts
	cg.drawRecapChartPanel(img, p, mood)

	// 5. 4-Column OHLC + Average/Volatility Bento Strip
	cg.drawRecapOHLCBento(img, p)

	// 6. 24-Hour Daily Range Position Bar
	cg.drawRecapRangeBar(img, p, mood)

	// 7. Clean, Forward-Friendly @TheGramPrice Footer
	cg.drawRecapFooter(img, p)

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, fmt.Errorf("failed to encode daily recap card png: %w", err)
	}
	return buf.Bytes(), nil
}

func (cg *CardGenerator) drawRecapBase(img *image.RGBA, mood recapMoodTheme) {
	const width = 1200
	const height = 900
	const cardX1, cardY1 = 24.0, 24.0
	const cardX2, cardY2 = 1176.0, 876.0
	const cardRadius = 30.0
	const borderW = 1.6
	const headerBottomY = 122.0

	outerBg := color.RGBA{18, 23, 29, 255}   // #12171D deep obsidian
	cardBg := color.RGBA{26, 33, 42, 255}    // #1A212A slate card
	headerBg := color.RGBA{33, 43, 54, 255}  // #212B36 header strip
	borderCol := color.RGBA{46, 59, 72, 255} // #2E3B48 hairline

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
				// Soft ambient mood glow behind Hero & Chart top-left
				dx1 := (fx - 310.0) / 480.0
				dy1 := (fy - 230.0) / 260.0
				r1 := dx1*dx1 + dy1*dy1
				if r1 < 1.0 {
					t := 1.0 - math.Sqrt(r1)
					bgCol = lerpColor(bgCol, mood.Glow, t*t*0.075)
				}
				// Subtle TON sapphire secondary ambient glow on right side
				dx2 := (fx - 960.0) / 420.0
				dy2 := (fy - 340.0) / 310.0
				r2 := dx2*dx2 + dy2*dy2
				if r2 < 1.0 {
					t := 1.0 - math.Sqrt(r2)
					bgCol = lerpColor(bgCol, color.RGBA{36, 139, 218, 255}, t*t*0.05)
				}
			}

			// Crisp divider line below header strip
			if fy >= headerBottomY-0.8 && fy <= headerBottomY+0.8 && dist < -borderW {
				bgCol = borderCol
			}

			var finalCol color.RGBA
			if dist >= -borderW {
				innerEdge := clamp01((dist + borderW) / 1.2)
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

	// Signature glowing top accent bar centered along card top border
	for x := 450; x <= 750; x++ {
		t := 1.0 - math.Abs(float64(x-600))/150.0
		blendPixel(img, x, 25, mood.Accent, t*0.90)
		blendPixel(img, x, 26, mood.Accent, t*0.60)
		blendPixel(img, x, 27, mood.Accent, t*0.28)
	}
}

func (cg *CardGenerator) drawRecapHeader(img *image.RGBA, p DailyRecapCardParams, mood recapMoodTheme) {
	// Left: Geometric TON Crystal Mark + TONCOIN + DAILY RECAP pill
	cg.drawFragmentBrandMark(img, 78, 73, 21)

	brandFace, err := cg.displayFont(true, 28.0)
	if err == nil {
		defer brandFace.Close()
		cg.drawTextAt(img, brandFace, "TONCOIN", 112, 83, color.RGBA{255, 255, 255, 255})
		bw := font.MeasureString(brandFace, "TONCOIN").Ceil()

		tagFace, tErr := cg.displayFont(true, 12.5)
		if tErr == nil {
			defer tagFace.Close()
			tagTxt := "DAILY RECAP"
			tw := font.MeasureString(tagFace, tagTxt).Ceil()
			tx1 := 112 + bw + 18
			tx2 := tx1 + tw + 26
			drawRoundedPill(img, tx1, 56, tx2, 90, 10.0,
				color.RGBA{27, 48, 70, 255},
				color.RGBA{46, 90, 134, 255},
				1.2,
			)
			cg.drawTextAt(img, tagFace, tagTxt, tx1+13, 78, color.RGBA{77, 178, 255, 255})
		}
	}

	// Right: Mood Pill (rightmost) + Date Pill
	rightX := 1142
	pillY1, pillY2 := 53, 93

	moodFace, err := cg.displayFont(true, 13.0)
	if err == nil {
		defer moodFace.Close()
		mw := font.MeasureString(moodFace, mood.Label).Ceil()
		mPillW := mw + 52
		mX1 := rightX - mPillW

		drawRoundedPill(img, mX1, pillY1, rightX, pillY2, 12.0, mood.PillBg, mood.PillBorder, 1.3)
		drawTrendGlyph(img, float64(mX1+21), float64(pillY1+pillY2)*0.5, 5.5, mood)
		cg.drawTextAt(img, moodFace, mood.Label, mX1+35, pillY1+25, mood.PillText)

		rightX = mX1 - 14
	}

	dateStr := sanitizePromoASCII(strings.ToUpper(p.DateLabel), time.Now().UTC().Format("02 JAN 2006")) + "  ·  UTC"
	dateFace, err := cg.displayFont(true, 13.0)
	if err == nil {
		defer dateFace.Close()
		dw := font.MeasureString(dateFace, dateStr).Ceil()
		dPillW := dw + 34
		dX1 := rightX - dPillW
		drawRoundedPill(img, dX1, pillY1, rightX, pillY2, 12.0,
			color.RGBA{24, 33, 43, 255},
			color.RGBA{48, 63, 78, 255},
			1.2,
		)
		cg.drawTextAt(img, dateFace, dateStr, dX1+17, pillY1+25, color.RGBA{208, 220, 232, 255})
	}
}

func (cg *CardGenerator) drawRecapHero(img *image.RGBA, p DailyRecapCardParams, mood recapMoodTheme) {
	// Eyebrow
	eyeFace, err := cg.displayFont(true, 12.5)
	if err == nil {
		defer eyeFace.Close()
		cg.drawTextAt(img, eyeFace, "DAILY CLOSE  ·  TON / USD", 60, 162, color.RGBA{138, 154, 170, 255})
	}

	// Giant Close Price
	closeStr := formatRecapPrice(p.ClosePrice)
	priceFace, _, err := cg.fitDisplayFont(true, closeStr, 68.0, 44.0, 390)
	priceRightX := 60
	if err == nil {
		defer priceFace.Close()
		cg.drawTextAt(img, priceFace, closeStr, 58, 236, color.RGBA{255, 255, 255, 255})
		priceRightX = 58 + font.MeasureString(priceFace, closeStr).Ceil()
	}

	// Bold 24h Delta Pill right beside the Close Price
	pctStr := formatRecapPct(p.PctChange)
	usdDeltaStr := formatRecapDeltaUSD(p.NetChange)

	pctFace, pErr := cg.displayFont(true, 23.0)
	usdFace, uErr := cg.displayFont(false, 16.5)
	if pErr == nil && uErr == nil {
		defer pctFace.Close()
		defer usdFace.Close()
		pw := font.MeasureString(pctFace, pctStr).Ceil()
		sepStr := "  ·  "
		sw := font.MeasureString(usdFace, sepStr).Ceil()
		uw := font.MeasureString(usdFace, usdDeltaStr).Ceil()

		px1 := priceRightX + 24
		pillW := 38 + pw + sw + uw + 22
		px2 := px1 + pillW
		py1, py2 := 184, 236

		drawRoundedPill(img, px1, py1, px2, py2, 14.0, mood.PillBg, mood.PillBorder, 1.4)
		drawTrendGlyph(img, float64(px1+22), float64(py1+py2)*0.5, 6.2, mood)
		cg.drawTextAt(img, pctFace, pctStr, px1+38, py1+34, mood.PillText)
		cg.drawTextAt(img, usdFace, sepStr, px1+38+pw, py1+32, color.RGBA{148, 163, 184, 255})
		cg.drawTextAt(img, usdFace, usdDeltaStr, px1+38+pw+sw, py1+32, mood.AccentSoft)
	}

	// Right-aligned secondary KPI pills (Streak / 7D Change / Live Ticks)
	rightX := 1142
	kpiY1, kpiY2 := 188, 232

	// Pill 1 (rightmost): Streak if >= 2 days, otherwise Live Ticks count
	var pill1Text string
	pill1Bg := color.RGBA{27, 36, 46, 255}
	pill1Border := color.RGBA{46, 59, 72, 255}
	pill1Col := color.RGBA{188, 206, 224, 255}
	pill1Dot := color.RGBA{77, 178, 255, 255}

	if p.StreakDays >= 2 {
		pill1Text = fmt.Sprintf("%dD GREEN STREAK", p.StreakDays)
		pill1Bg = color.RGBA{18, 48, 39, 255}
		pill1Border = color.RGBA{34, 106, 81, 255}
		pill1Col = color.RGBA{74, 222, 128, 255}
		pill1Dot = color.RGBA{52, 211, 153, 255}
	} else if p.StreakDays <= -2 {
		pill1Text = fmt.Sprintf("%dD RED STREAK", -p.StreakDays)
		pill1Bg = color.RGBA{54, 25, 34, 255}
		pill1Border = color.RGBA{122, 46, 65, 255}
		pill1Col = color.RGBA{253, 164, 175, 255}
		pill1Dot = color.RGBA{251, 113, 133, 255}
	} else if p.TicksCount > 0 {
		pill1Text = fmt.Sprintf("%d LIVE SAMPLES", p.TicksCount)
	}

	kpiFace, err := cg.displayFont(true, 13.0)
	if err == nil {
		defer kpiFace.Close()

		if pill1Text != "" {
			w := font.MeasureString(kpiFace, pill1Text).Ceil()
			pw := w + 44
			x1 := rightX - pw
			if x1 > priceRightX+320 {
				drawRoundedPill(img, x1, kpiY1, rightX, kpiY2, 12.0, pill1Bg, pill1Border, 1.2)
				drawSoftGlowDot(img, float64(x1+18), float64(kpiY1+kpiY2)*0.5, 3.6, pill1Dot)
				cg.drawTextAt(img, kpiFace, pill1Text, x1+30, kpiY1+27, pill1Col)
				rightX = x1 - 12
			}
		}

		// Pill 2: 7D Change (if available) or Daily Spread
		var pill2Text string
		pill2Bg := color.RGBA{27, 36, 46, 255}
		pill2Border := color.RGBA{46, 59, 72, 255}
		pill2Col := color.RGBA{142, 218, 255, 255}
		if p.Has7DChange {
			pill2Text = "7D  " + formatRecapPct(p.Change7DPct)
			if p.Change7DPct > 0.05 {
				pill2Bg = color.RGBA{18, 48, 39, 255}
				pill2Border = color.RGBA{34, 106, 81, 255}
				pill2Col = color.RGBA{74, 222, 128, 255}
			} else if p.Change7DPct < -0.05 {
				pill2Bg = color.RGBA{54, 25, 34, 255}
				pill2Border = color.RGBA{122, 46, 65, 255}
				pill2Col = color.RGBA{253, 164, 175, 255}
			}
		} else if p.SpreadPct > 0 {
			pill2Text = fmt.Sprintf("RANGE  %.2f%%", p.SpreadPct)
		}

		if pill2Text != "" {
			w := font.MeasureString(kpiFace, pill2Text).Ceil()
			pw := w + 32
			x1 := rightX - pw
			if x1 > priceRightX+320 {
				drawRoundedPill(img, x1, kpiY1, rightX, kpiY2, 12.0, pill2Bg, pill2Border, 1.2)
				cg.drawTextAt(img, kpiFace, pill2Text, x1+16, kpiY1+27, pill2Col)
			}
		}
	}
}

func (cg *CardGenerator) drawRecapChartPanel(img *image.RGBA, p DailyRecapCardParams, mood recapMoodTheme) {
	const panelX1, panelY1 = 56, 272
	const panelX2, panelY2 = 1144, 616

	cg.drawPromoGlassPanel(img, panelX1, panelY1, panelX2, panelY2, 20.0,
		color.RGBA{20, 27, 35, 255},
		color.RGBA{44, 57, 70, 255},
		1.4,
	)

	// Panel header labels
	hdrFace, err := cg.displayFont(true, 11.5)
	if err == nil {
		defer hdrFace.Close()
		cg.drawTextAt(img, hdrFace, "24H INTRADAY PRICE CURVE  ·  10-MIN INTERVAL", panelX1+26, panelY1+30, color.RGBA{124, 142, 160, 255})

		openLbl := "OPEN " + formatRecapPrice(p.OpenPrice)
		ow := font.MeasureString(hdrFace, openLbl).Ceil()
		ox := panelX2 - 26 - ow
		// Small dashed line icon beside OPEN label
		for dx := 0; dx < 18; dx += 6 {
			drawThickLine(img, float64(ox-26+dx), float64(panelY1+26), float64(ox-22+dx), float64(panelY1+26), 2.0, color.RGBA{148, 163, 184, 180})
		}
		cg.drawTextAt(img, hdrFace, openLbl, ox, panelY1+30, color.RGBA{160, 176, 192, 255})
	}

	// Inner chart plot coordinates (generous margins for callouts and axis)
	const plotX1 = 104.0
	const plotX2 = 1106.0
	const plotY1 = 344.0
	const plotY2 = 556.0
	plotW := plotX2 - plotX1
	plotH := plotY2 - plotY1

	// Build usable tick list
	ticks := p.Ticks
	if len(ticks) == 0 {
		now := time.Now().UTC()
		ticks = []DailyRecapTick{
			{Price: p.OpenPrice, Timestamp: now.Add(-24 * time.Hour)},
			{Price: p.ClosePrice, Timestamp: now},
		}
	} else if len(ticks) == 1 {
		ticks = []DailyRecapTick{
			ticks[0],
			{Price: ticks[0].Price, Timestamp: ticks[0].Timestamp.Add(10 * time.Minute)},
		}
	}

	minP := p.LowPrice
	maxP := p.HighPrice
	for _, tk := range ticks {
		if tk.Price > 0 {
			if minP <= 0 || tk.Price < minP {
				minP = tk.Price
			}
			if tk.Price > maxP {
				maxP = tk.Price
			}
		}
	}
	if p.OpenPrice > 0 {
		if p.OpenPrice < minP {
			minP = p.OpenPrice
		}
		if p.OpenPrice > maxP {
			maxP = p.OpenPrice
		}
	}
	span := maxP - minP
	if span < 1e-6 {
		span = math.Max(maxP*0.02, 0.01)
		minP -= span * 0.5
	} else {
		// 12% headroom/footroom so markers & curve breathe comfortably
		pad := span * 0.12
		minP -= pad
		span += pad * 2
	}

	priceToY := func(val float64) float64 {
		norm := clamp01((val - minP) / span)
		return plotY2 - norm*plotH
	}

	// Subtle horizontal gridlines
	gridCol := color.RGBA{36, 47, 59, 175}
	for _, frac := range []float64{0.0, 0.25, 0.5, 0.75, 1.0} {
		gy := plotY1 + frac*plotH
		drawThickLine(img, plotX1, gy, plotX2, gy, 1.0, gridCol)
	}

	// Vertical subtle time gridlines (06:00, 12:00, 18:00)
	for _, frac := range []float64{0.25, 0.5, 0.75} {
		gx := plotX1 + frac*plotW
		drawThickLine(img, gx, plotY1, gx, plotY2, 1.0, color.RGBA{34, 44, 56, 120})
	}

	// Dashed Open Price reference line
	if p.OpenPrice > 0 {
		openY := priceToY(p.OpenPrice)
		dashCol := color.RGBA{148, 163, 184, 105}
		for x := plotX1; x < plotX2; x += 14.0 {
			segEnd := math.Min(x+7.0, plotX2)
			drawThickLine(img, x, openY, segEnd, openY, 1.4, dashCol)
		}
	}

	// Map tick points to screen coordinates
	type pt struct {
		x, y float64
		tick DailyRecapTick
	}
	pts := make([]pt, len(ticks))
	n := len(ticks)
	highIdx, lowIdx := 0, 0
	for i, tk := range ticks {
		tFrac := float64(i) / float64(n-1)
		pts[i] = pt{
			x:    plotX1 + tFrac*plotW,
			y:    priceToY(tk.Price),
			tick: tk,
		}
		if tk.Price > ticks[highIdx].Price {
			highIdx = i
		}
		if tk.Price < ticks[lowIdx].Price {
			lowIdx = i
		}
	}

	// Sample smooth curve per pixel column using monotonic-clamped Catmull-Rom interpolation
	startCol := int(math.Round(plotX1))
	endCol := int(math.Round(plotX2))
	curveY := make([]float64, endCol-startCol+1)
	for col := startCol; col <= endCol; col++ {
		fx := float64(col)
		u := clamp01((fx-plotX1)/plotW) * float64(n-1)
		idx := int(math.Floor(u))
		if idx >= n-1 {
			idx = n - 2
		}
		localT := u - float64(idx)

		i0 := idx - 1
		if i0 < 0 {
			i0 = 0
		}
		i1 := idx
		i2 := idx + 1
		i3 := idx + 2
		if i3 >= n {
			i3 = n - 1
		}

		yVal := catmullRom(pts[i0].y, pts[i1].y, pts[i2].y, pts[i3].y, localT)
		// Clamp between neighboring segment min/max so spline never overshoots true peaks
		segMin := math.Min(pts[i1].y, pts[i2].y)
		segMax := math.Max(pts[i1].y, pts[i2].y)
		if yVal < segMin {
			yVal = segMin
		}
		if yVal > segMax {
			yVal = segMax
		}
		curveY[col-startCol] = yVal
	}

	// Soft vertical area gradient fill beneath curve
	bottomY := int(math.Round(plotY2))
	for col := startCol; col <= endCol; col++ {
		cy := curveY[col-startCol]
		topY := int(math.Floor(cy))
		spanY := math.Max(1.0, plotY2-cy)
		for y := topY; y <= bottomY; y++ {
			if float64(y) < cy {
				continue
			}
			prog := clamp01((float64(y) - cy) / spanY)
			alpha := (1.0 - prog) * (1.0 - prog) * 0.28
			blendPixel(img, col, y, mood.Accent, alpha)
		}
	}

	// Subtle outer glow under the curve + crisp anti-aliased main curve
	const step = 3
	for col := startCol; col < endCol; col += step {
		nextCol := col + step
		if nextCol > endCol {
			nextCol = endCol
		}
		x1, y1 := float64(col), curveY[col-startCol]
		x2, y2 := float64(nextCol), curveY[nextCol-startCol]
		drawThickLine(img, x1, y1, x2, y2, 9.0, color.RGBA{mood.Glow.R, mood.Glow.G, mood.Glow.B, 34})
	}
	for col := startCol; col < endCol; col += step {
		nextCol := col + step
		if nextCol > endCol {
			nextCol = endCol
		}
		x1, y1 := float64(col), curveY[col-startCol]
		x2, y2 := float64(nextCol), curveY[nextCol-startCol]
		drawThickLine(img, x1, y1, x2, y2, 3.6, mood.Accent)
	}

	// High Peak & Low Trough glowing dots + non-overlapping callout pills
	highPt := pts[highIdx]
	lowPt := pts[lowIdx]

	highLabel := "HIGH " + formatRecapPrice(p.HighPrice)
	if p.HighTimeUTC != "" {
		highLabel += " · " + p.HighTimeUTC
	}
	lowLabel := "LOW " + formatRecapPrice(p.LowPrice)
	if p.LowTimeUTC != "" {
		lowLabel += " · " + p.LowTimeUTC
	}

	// Draw High & Low glowing points on curve
	drawSoftGlowDot(img, highPt.x, highPt.y, 7.0, color.RGBA{52, 211, 153, 255})
	drawSoftGlowDot(img, highPt.x, highPt.y, 3.0, color.RGBA{255, 255, 255, 255})

	drawSoftGlowDot(img, lowPt.x, lowPt.y, 7.0, color.RGBA{251, 113, 133, 255})
	drawSoftGlowDot(img, lowPt.x, lowPt.y, 3.0, color.RGBA{255, 255, 255, 255})

	// Floating Callout Pills (High above peak, Low below trough, clamped inside panel bounds)
	cg.drawChartCallout(img, highPt.x, highPt.y-42, highLabel,
		panelX1+22, panelX2-22, panelY1+42, int(plotY2)-36,
		color.RGBA{18, 48, 39, 240},
		color.RGBA{38, 120, 90, 255},
		color.RGBA{110, 231, 183, 255},
	)
	cg.drawChartCallout(img, lowPt.x, lowPt.y+18, lowLabel,
		panelX1+22, panelX2-22, panelY1+42, int(plotY2)+24,
		color.RGBA{54, 25, 34, 240},
		color.RGBA{132, 50, 72, 255},
		color.RGBA{253, 164, 175, 255},
	)

	// Glowing Close Endpoint Node on right edge of curve
	lastPt := pts[len(pts)-1]
	drawSoftGlowDot(img, lastPt.x, lastPt.y, 11.0, mood.Accent)
	drawSoftGlowDot(img, lastPt.x, lastPt.y, 4.4, color.RGBA{255, 255, 255, 255})

	// Left subtle Y-axis high/low labels
	axisFace, err := cg.displayFont(false, 11.0)
	if err == nil {
		defer axisFace.Close()
		axisCol := color.RGBA{112, 130, 148, 255}
		xLabels := []struct {
			frac  float64
			label string
			align int // 0=left, 1=center, 2=right
		}{
			{0.0, "00:00", 0},
			{0.25, "06:00", 1},
			{0.50, "12:00", 1},
			{0.75, "18:00", 1},
			{1.0, "24:00 UTC", 2},
		}
		for _, xl := range xLabels {
			w := font.MeasureString(axisFace, xl.label).Ceil()
			tx := int(math.Round(plotX1 + xl.frac*plotW))
			if xl.align == 1 {
				tx -= w / 2
			} else if xl.align == 2 {
				tx -= w
			}
			cg.drawTextAt(img, axisFace, xl.label, tx, panelY2-16, axisCol)
		}
	}
}

func (cg *CardGenerator) drawChartCallout(img *image.RGBA, centerX, topY float64, text string, minX, maxX, minY, maxY int, bgCol, borderCol, textCol color.RGBA) {
	face, err := cg.displayFont(true, 11.5)
	if err != nil {
		return
	}
	defer face.Close()

	tw := font.MeasureString(face, text).Ceil()
	pillW := tw + 22
	const pillH = 26

	x1 := int(math.Round(centerX)) - pillW/2
	if x1 < minX {
		x1 = minX
	}
	if x1+pillW > maxX {
		x1 = maxX - pillW
	}
	y1 := int(math.Round(topY))
	if y1 < minY {
		y1 = minY
	}
	if y1+pillH > maxY {
		y1 = maxY - pillH
	}

	drawRoundedPill(img, x1, y1, x1+pillW, y1+pillH, 8.0, bgCol, borderCol, 1.1)
	cg.drawTextAt(img, face, text, x1+11, y1+17, textCol)
}

func (cg *CardGenerator) drawRecapOHLCBento(img *image.RGBA, p DailyRecapCardParams) {
	const leftX = 56
	const rightX = 1144
	const gap = 16
	const y1, y2 = 634, 744
	tileW := (rightX - leftX - 3*gap) / 4

	highSub := "DAILY PEAK"
	if p.HighTimeUTC != "" {
		highSub = "AT " + p.HighTimeUTC + " UTC"
	}
	lowSub := "DAILY TROUGH"
	if p.LowTimeUTC != "" {
		lowSub = "AT " + p.LowTimeUTC + " UTC"
	}
	avgSub := fmt.Sprintf("SPREAD %.2f%%", p.SpreadPct)

	tiles := []struct {
		label  string
		val    string
		sub    string
		dotCol color.RGBA
		valCol color.RGBA
	}{
		{
			label:  "OPEN",
			val:    formatRecapPrice(p.OpenPrice),
			sub:    "00:00 UTC",
			dotCol: color.RGBA{77, 178, 255, 255},
			valCol: color.RGBA{255, 255, 255, 255},
		},
		{
			label:  "24H HIGH",
			val:    formatRecapPrice(p.HighPrice),
			sub:    highSub,
			dotCol: color.RGBA{52, 211, 153, 255},
			valCol: color.RGBA{110, 231, 183, 255},
		},
		{
			label:  "24H LOW",
			val:    formatRecapPrice(p.LowPrice),
			sub:    lowSub,
			dotCol: color.RGBA{251, 113, 133, 255},
			valCol: color.RGBA{253, 164, 175, 255},
		},
		{
			label:  "24H AVERAGE",
			val:    formatRecapPrice(p.AvgPrice),
			sub:    avgSub,
			dotCol: color.RGBA{125, 211, 252, 255},
			valCol: color.RGBA{226, 238, 248, 255},
		},
	}

	for i, tile := range tiles {
		tx1 := leftX + i*(tileW+gap)
		tx2 := tx1 + tileW
		if i == len(tiles)-1 {
			tx2 = rightX
		}
		cg.drawRecapMetricTile(img, tx1, y1, tx2, y2, tile.label, tile.val, tile.sub, tile.dotCol, tile.valCol)
	}
}

func (cg *CardGenerator) drawRecapMetricTile(img *image.RGBA, x1, y1, x2, y2 int, label, primaryVal, subVal string, dotCol, valCol color.RGBA) {
	cg.drawPromoGlassPanel(img, x1, y1, x2, y2, 14.0,
		color.RGBA{24, 32, 41, 255},
		color.RGBA{44, 57, 70, 255},
		1.2,
	)

	padX := x1 + 22
	maxW := (x2 - x1) - 44

	drawSoftGlowDot(img, float64(padX+4), float64(y1+26), 3.4, dotCol)
	lblFace, err := cg.displayFont(true, 11.5)
	if err == nil {
		defer lblFace.Close()
		cg.drawTextAt(img, lblFace, label, padX+15, y1+30, color.RGBA{136, 152, 168, 255})
	}

	valFace, _, err := cg.fitDisplayFont(true, primaryVal, 29.0, 18.0, maxW)
	if err == nil {
		defer valFace.Close()
		cg.drawTextAt(img, valFace, primaryVal, padX, y1+70, valCol)
	}

	subFace, err := cg.displayFont(false, 12.5)
	if err == nil {
		defer subFace.Close()
		cg.drawTextAt(img, subFace, subVal, padX, y1+96, color.RGBA{124, 140, 156, 255})
	}
}

func (cg *CardGenerator) drawRecapRangeBar(img *image.RGBA, p DailyRecapCardParams, mood recapMoodTheme) {
	const leftX = 58
	const rightX = 1142
	const barY1, barY2 = 772, 782

	posNorm := clamp01(p.RangePosPct / 100.0)
	leftLbl := "DAILY RANGE  ·  LOW " + formatRecapPrice(p.LowPrice)
	rightLbl := fmt.Sprintf("HIGH %s  ·  CLOSE %d%%", formatRecapPrice(p.HighPrice), int(math.Round(posNorm*100)))

	lblFace, err := cg.displayFont(true, 11.5)
	barX1 := leftX + 225
	barX2 := rightX - 215
	if err == nil {
		defer lblFace.Close()
		lw := font.MeasureString(lblFace, leftLbl).Ceil()
		rw := font.MeasureString(lblFace, rightLbl).Ceil()
		cg.drawTextAt(img, lblFace, leftLbl, leftX, 781, color.RGBA{136, 152, 168, 255})
		cg.drawTextAt(img, lblFace, rightLbl, rightX-rw, 781, mood.PillText)
		barX1 = leftX + lw + 22
		barX2 = rightX - rw - 22
	}

	if barX2-barX1 < 120 {
		return
	}

	// Background track
	drawRoundedPill(img, barX1, barY1, barX2, barY2, 5.0,
		color.RGBA{30, 40, 50, 255},
		color.RGBA{46, 59, 72, 255},
		1.0,
	)

	// Filled portion from Low to Close (clipped to rounded track SDF for clean left cap)
	markerX := barX1 + int(math.Round(posNorm*float64(barX2-barX1)))
	if markerX > barX1+4 {
		for x := barX1; x <= markerX; x++ {
			t := clamp01(float64(x-barX1) / math.Max(1.0, float64(barX2-barX1)))
			col := lerpColor(color.RGBA{36, 139, 218, 255}, mood.Accent, t)
			for y := barY1; y <= barY2; y++ {
				dist := roundedBoxSDF(float64(x), float64(y), float64(barX1), float64(barY1), float64(barX2), float64(barY2), 5.0)
				if dist <= -0.5 {
					blendPixel(img, x, y, col, 0.92*clamp01(-0.5-dist))
				}
			}
		}
	}

	// Glowing Close Position Marker
	cy := float64(barY1+barY2) * 0.5
	drawSoftGlowDot(img, float64(markerX), cy, 8.5, mood.Accent)
	drawSoftGlowDot(img, float64(markerX), cy, 3.8, color.RGBA{255, 255, 255, 255})
}

func (cg *CardGenerator) drawRecapFooter(img *image.RGBA, p DailyRecapCardParams) {
	// Subtle divider above footer
	drawThickLine(img, 56, 808, 1144, 808, 1.0, color.RGBA{40, 52, 65, 200})

	handle := sanitizePromoASCII(p.ChannelHandle, "@TheGramPrice")
	if !strings.HasPrefix(handle, "@") {
		handle = "@" + handle
	}

	cg.drawFragmentBrandMark(img, 70, 842, 11)

	hFace, hErr := cg.displayFont(true, 18.0)
	if hErr == nil {
		defer hFace.Close()
		hw := font.MeasureString(hFace, handle).Ceil()
		cg.drawTextAt(img, hFace, handle, 92, 849, color.RGBA{255, 255, 255, 255})

		subFace, sErr := cg.displayFont(false, 13.0)
		if sErr == nil {
			defer subFace.Close()
			cg.drawTextAt(img, subFace, "  ·  LIVE TONCOIN TRACKER EVERY 10 MIN", 92+hw, 848, color.RGBA{138, 154, 170, 255})
		}
	}

	badgeTxt := "TON / USD  ·  VERIFIED DAILY FEED"
	rFace, rErr := cg.displayFont(true, 12.0)
	if rErr == nil {
		defer rFace.Close()
		rw := font.MeasureString(rFace, badgeTxt).Ceil()
		pillW := rw + 32
		px2 := 1144
		px1 := px2 - pillW
		py1, py2 := 825, 859
		drawRoundedPill(img, px1, py1, px2, py2, 10.0,
			color.RGBA{26, 39, 53, 255},
			color.RGBA{46, 78, 110, 255},
			1.1,
		)
		cg.drawTextAt(img, rFace, badgeTxt, px1+(pillW-rw)/2, py1+21, color.RGBA{77, 178, 255, 255})
	}
}

func drawTrendGlyph(img *image.RGBA, cx, cy, r float64, mood recapMoodTheme) {
	if mood.IsBullish {
		fillTriangle(img, cx, cy-r, cx-r*0.95, cy+r*0.75, cx+r*0.95, cy+r*0.75, mood.PillText)
	} else if mood.IsBearish {
		fillTriangle(img, cx, cy+r, cx-r*0.95, cy-r*0.75, cx+r*0.95, cy-r*0.75, mood.PillText)
	} else {
		drawSoftGlowDot(img, cx, cy, r*0.7, mood.PillText)
	}
}

func catmullRom(p0, p1, p2, p3, t float64) float64 {
	t2 := t * t
	t3 := t2 * t
	return 0.5 * ((2.0 * p1) +
		(-p0+p2)*t +
		(2.0*p0-5.0*p1+4.0*p2-p3)*t2 +
		(-p0+3.0*p1-3.0*p2+p3)*t3)
}
