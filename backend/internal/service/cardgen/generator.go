package cardgen

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
)

// CardGenerator generates rich, high-resolution 400x400 PNG visual asset cards
// matching the iFragment Telegram Mini App dark aesthetics (#08090D).
type CardGenerator struct{}

func NewCardGenerator() *CardGenerator {
	return &CardGenerator{}
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

// GenerateUsernameCard creates a 400x400 visual card for Telegram Usernames
func (cg *CardGenerator) GenerateUsernameCard(username string, tier string, expectedTON string, expectedUSD string) ([]byte, error) {
	width := 400
	height := 400
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	// Outer border gradient / color based on tier (Purple Ban strictly respected)
	borderColor := color.RGBA{R: 0x00, G: 0x98, B: 0xEA, A: 0xFF} // Default TON Cyan
	switch strings.ToUpper(tier) {
	case "EXCLUSIVE", "ULTRA RARE":
		borderColor = color.RGBA{R: 0xF5, G: 0xA6, B: 0x23, A: 0xFF} // Radiant Gold
	case "RARE":
		borderColor = color.RGBA{R: 0x2F, G: 0x80, B: 0xED, A: 0xFF} // Electric Sapphire Blue
	case "UNIQUE":
		borderColor = color.RGBA{R: 0x00, G: 0xC8, B: 0x53, A: 0xFF} // Emerald Green
	}

	draw.Draw(img, img.Bounds(), &image.Uniform{C: borderColor}, image.Point{}, draw.Src)

	// Inner dark background (#08090D)
	borderThickness := 3
	innerRect := image.Rect(borderThickness, borderThickness, width-borderThickness, height-borderThickness)
	bgColor := color.RGBA{R: 0x08, G: 0x09, B: 0x0D, A: 0xFF}
	draw.Draw(img, innerRect, &image.Uniform{C: bgColor}, image.Point{}, draw.Src)

	// 1. Header: [Tier Badge] ... [IFRAGMENT]
	tierLabel := strings.ToUpper(tier)
	if tierLabel == "" {
		tierLabel = "STANDARD"
	}
	drawBadge(img, 24, 24, tierLabel, borderColor)
	drawTextRight(img, width-24, 38, "IFRAGMENT", color.RGBA{R: 0x88, G: 0x99, B: 0xA6, A: 0xFF}, 2)

	// 2. Center: @username
	cleanUser := "@" + strings.TrimPrefix(username, "@")
	drawCenteredScaledText(img, width/2, 195, cleanUser, color.White, 3)

	// 3. Separator line
	lineY := 310
	for x := 24; x < width-24; x++ {
		img.Set(x, lineY, color.RGBA{R: 0x2A, G: 0x2E, B: 0x39, A: 0xFF})
	}

	// 4. Footer:
	// ESTIMATED VALUE
	drawText(img, 24, 335, "ESTIMATED VALUE", color.RGBA{R: 0x88, G: 0x99, B: 0xA6, A: 0xFF}, 1)
	
	// Value: "1,250 TON"
	tonValStr := fmt.Sprintf("%s TON", expectedTON)
	drawText(img, 24, 365, tonValStr, color.RGBA{R: 0x00, G: 0x98, B: 0xEA, A: 0xFF}, 2)

	// Value USD: "≈ $6,250"
	if expectedUSD != "" {
		usdStr := fmt.Sprintf("~ $%s", expectedUSD)
		drawTextRight(img, width-24, 365, usdStr, color.RGBA{R: 0xAA, G: 0xBB, B: 0xCC, A: 0xFF}, 2)
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// GenerateNumberCard creates a 400x400 visual card for Telegram Anonymous (+888) Numbers
func (cg *CardGenerator) GenerateNumberCard(displayNum string, club string, rank int, expectedTON string, expectedUSD string) ([]byte, error) {
	width := 400
	height := 400
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	// Outer border in Telegram Blue / Gold
	borderColor := color.RGBA{R: 0x00, G: 0x88, B: 0xCC, A: 0xFF}
	if rank > 0 && rank <= 1000 {
		borderColor = color.RGBA{R: 0xFF, G: 0x77, B: 0x00, A: 0xFF} // Orange/Flame
	}

	draw.Draw(img, img.Bounds(), &image.Uniform{C: borderColor}, image.Point{}, draw.Src)

	// Inner dark background
	borderThickness := 3
	innerRect := image.Rect(borderThickness, borderThickness, width-borderThickness, height-borderThickness)
	bgColor := color.RGBA{R: 0x06, G: 0x0B, B: 0x14, A: 0xFF}
	draw.Draw(img, innerRect, &image.Uniform{C: bgColor}, image.Point{}, draw.Src)

	// 1. Header: [Club Name] ... [RANK #X]
	clubLabel := strings.ToUpper(club)
	if clubLabel == "" {
		clubLabel = "+888 COLLECTIBLE"
	}
	drawBadge(img, 24, 24, clubLabel, borderColor)

	rankLabel := "IFRAGMENT"
	if rank > 0 {
		rankLabel = fmt.Sprintf("RANK #%d", rank)
	}
	drawTextRight(img, width-24, 38, rankLabel, color.RGBA{R: 0x88, G: 0x99, B: 0xA6, A: 0xFF}, 2)

	// 2. Center: Display Number
	drawCenteredScaledText(img, width/2, 195, displayNum, color.White, 3)

	// 3. Separator line
	lineY := 310
	for x := 24; x < width-24; x++ {
		img.Set(x, lineY, color.RGBA{R: 0x2A, G: 0x2E, B: 0x39, A: 0xFF})
	}

	// 4. Footer:
	drawText(img, 24, 335, "FAIR MARKET VALUATION", color.RGBA{R: 0x88, G: 0x99, B: 0xA6, A: 0xFF}, 1)
	tonValStr := fmt.Sprintf("%s TON", expectedTON)
	drawText(img, 24, 365, tonValStr, color.RGBA{R: 0x00, G: 0x98, B: 0xEA, A: 0xFF}, 2)

	if expectedUSD != "" {
		usdStr := fmt.Sprintf("~ $%s", expectedUSD)
		drawTextRight(img, width-24, 365, usdStr, color.RGBA{R: 0xAA, G: 0xBB, B: 0xCC, A: 0xFF}, 2)
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// GenerateGiftCard creates a 400x400 visual card for Telegram Star Gifts / NFTs
func (cg *CardGenerator) GenerateGiftCard(title string, giftID string, serialNumber int, rarityTier string, expectedTON string, expectedUSD string) ([]byte, error) {
	width := 400
	height := 400
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	// Outer border based on Rarity Tier (Purple Ban strictly respected)
	borderColor := color.RGBA{R: 0x00, G: 0x98, B: 0xEA, A: 0xFF} // Default TON Cyan
	switch strings.ToUpper(rarityTier) {
	case "LEGENDARY":
		borderColor = color.RGBA{R: 0xFF, G: 0xD7, B: 0x00, A: 0xFF} // Radiant Gold
	case "EPIC":
		borderColor = color.RGBA{R: 0xFF, G: 0x3B, B: 0x30, A: 0xFF} // Electric Crimson
	case "RARE":
		borderColor = color.RGBA{R: 0x00, G: 0x91, B: 0xEA, A: 0xFF} // Ocean Cyan
	case "UNCOMMON":
		borderColor = color.RGBA{R: 0x00, G: 0xC8, B: 0x53, A: 0xFF} // Emerald Green
	}

	draw.Draw(img, img.Bounds(), &image.Uniform{C: borderColor}, image.Point{}, draw.Src)

	// Inner dark background (#08090D)
	borderThickness := 3
	innerRect := image.Rect(borderThickness, borderThickness, width-borderThickness, height-borderThickness)
	bgColor := color.RGBA{R: 0x08, G: 0x09, B: 0x0D, A: 0xFF}
	draw.Draw(img, innerRect, &image.Uniform{C: bgColor}, image.Point{}, draw.Src)

	// 1. Header: [Rarity Tier] ... [SERIAL #X]
	tierLabel := strings.ToUpper(rarityTier)
	if tierLabel == "" {
		tierLabel = "TELEGRAM GIFT"
	}
	drawBadge(img, 24, 24, tierLabel, borderColor)

	serialLabel := "IFRAGMENT"
	if serialNumber > 0 {
		serialLabel = fmt.Sprintf("#%d", serialNumber)
	}
	drawTextRight(img, width-24, 38, serialLabel, color.RGBA{R: 0x88, G: 0x99, B: 0xA6, A: 0xFF}, 2)

	// 2. Center: Gift Title
	drawCenteredScaledText(img, width/2, 195, title, color.White, 3)

	// 3. Separator line
	lineY := 310
	for x := 24; x < width-24; x++ {
		img.Set(x, lineY, color.RGBA{R: 0x2A, G: 0x2E, B: 0x39, A: 0xFF})
	}

	// 4. Footer:
	drawText(img, 24, 335, "APPRAISED VALUATION", color.RGBA{R: 0x88, G: 0x99, B: 0xA6, A: 0xFF}, 1)
	tonValStr := fmt.Sprintf("%s TON", expectedTON)
	drawText(img, 24, 365, tonValStr, color.RGBA{R: 0x00, G: 0x98, B: 0xEA, A: 0xFF}, 2)

	if expectedUSD != "" {
		usdStr := fmt.Sprintf("~ $%s", expectedUSD)
		drawTextRight(img, width-24, 365, usdStr, color.RGBA{R: 0xAA, G: 0xBB, B: 0xCC, A: 0xFF}, 2)
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// ─────────────────────────────────────────────────────────────
// Drawing Utilities
// ─────────────────────────────────────────────────────────────

func drawBadge(img *image.RGBA, x, y int, text string, badgeColor color.Color) {
	paddingX := 8
	charW := 7
	textW := len(text) * charW
	badgeW := textW + paddingX*2
	badgeH := 18

	// Draw badge border & fill
	for by := y; by < y+badgeH; by++ {
		for bx := x; bx < x+badgeW; bx++ {
			if by == y || by == y+badgeH-1 || bx == x || bx == x+badgeW-1 {
				img.Set(bx, by, badgeColor)
			} else {
				img.Set(bx, by, color.RGBA{R: 0x1A, G: 0x20, B: 0x2C, A: 0xFF})
			}
		}
	}
	drawText(img, x+paddingX, y+badgeH-5, text, color.White, 1)
}

func drawText(img *image.RGBA, x, y int, text string, c color.Color, scale int) {
	if scale <= 1 {
		point := fixed.Point26_6{X: fixed.I(x), Y: fixed.I(y)}
		d := &font.Drawer{
			Dst:  img,
			Src:  image.NewUniform(c),
			Face: basicfont.Face7x13,
			Dot:  point,
		}
		d.DrawString(text)
		return
	}

	// Scaled text drawing
	charW := 7
	charH := 13
	tempImg := image.NewRGBA(image.Rect(0, 0, len(text)*charW+10, charH+5))
	d := &font.Drawer{
		Dst:  tempImg,
		Src:  image.NewUniform(c),
		Face: basicfont.Face7x13,
		Dot:  fixed.Point26_6{X: fixed.I(0), Y: fixed.I(charH)},
	}
	d.DrawString(text)

	for py := 0; py < charH+2; py++ {
		for px := 0; px < len(text)*charW; px++ {
			pixel := tempImg.At(px, py)
			_, _, _, a := pixel.RGBA()
			if a > 0 {
				for sy := 0; sy < scale; sy++ {
					for sx := 0; sx < scale; sx++ {
						img.Set(x+px*scale+sx, y+py*scale+sy-charH*scale, pixel)
					}
				}
			}
		}
	}
}

func drawTextRight(img *image.RGBA, rightX, y int, text string, c color.Color, scale int) {
	charW := 7 * scale
	totalW := len(text) * charW
	drawText(img, rightX-totalW, y, text, c, scale)
}

func drawCenteredScaledText(img *image.RGBA, centerX, centerY int, text string, c color.Color, scale int) {
	charW := 7 * scale
	totalW := len(text) * charW
	totalH := 13 * scale
	startX := centerX - totalW/2
	startY := centerY + totalH/2
	drawText(img, startX, startY, text, c, scale)
}
