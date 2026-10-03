package cardgen

import (
	"bytes"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/image/font"
)

func TestCardGenerator_GenerateUsernameCard(t *testing.T) {
	cg := NewCardGenerator()

	tests := []struct {
		name        string
		username    string
		tier        string
		expectedTON string
		expectedUSD string
	}{
		{"Exclusive username", "durov", "EXCLUSIVE", "1250.5", "6250"},
		{"Rare username", "@tele", "RARE", "340.0", "1700"},
		{"Standard username", "testuser", "STANDARD", "15.0", "75"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := cg.GenerateUsernameCard(tt.username, tt.tier, tt.expectedTON, tt.expectedUSD)
			if err != nil {
				t.Fatalf("GenerateUsernameCard failed: %v", err)
			}
			if len(data) == 0 {
				t.Fatalf("expected non-empty byte slice")
			}

			// Validate valid PNG
			_, err = png.Decode(strings.NewReader(string(data)))
			if err != nil {
				t.Fatalf("decoded PNG error: %v", err)
			}
		})
	}
}

func TestCardGenerator_GenerateNumberCard(t *testing.T) {
	cg := NewCardGenerator()

	data, err := cg.GenerateNumberCard("+888 0000", "رند چهار صفر", 42, "850.0", "4250")
	if err != nil {
		t.Fatalf("GenerateNumberCard failed: %v", err)
	}
	if len(data) == 0 {
		t.Fatalf("expected non-empty byte slice")
	}

	_, err = png.Decode(strings.NewReader(string(data)))
	if err != nil {
		t.Fatalf("decoded PNG error: %v", err)
	}
}

func TestCardGenerator_GenerateGiftCard(t *testing.T) {
	cg := NewCardGenerator()

	data, err := cg.GenerateGiftCard("Plush Pepe", "plush_pepe-42", 42, "LEGENDARY", "145.0", "725")
	if err != nil {
		t.Fatalf("GenerateGiftCard failed: %v", err)
	}
	if len(data) == 0 {
		t.Fatalf("expected non-empty byte slice")
	}

	_, err = png.Decode(strings.NewReader(string(data)))
	if err != nil {
		t.Fatalf("decoded PNG error: %v", err)
	}
}

func TestCardGenerator_SaveCardAndGetURL(t *testing.T) {
	cg := NewCardGenerator()

	data, err := cg.GenerateUsernameCard("ifragment", "EXCLUSIVE", "500.0", "2500")
	if err != nil {
		t.Fatalf("failed to generate card: %v", err)
	}

	fileID, err := cg.SaveCard(data)
	if err != nil {
		t.Fatalf("failed to save card: %v", err)
	}
	if fileID == "" {
		t.Fatalf("expected non-empty fileID")
	}

	// Verify file exists on disk
	filePath := filepath.Join("./static/shares", fileID+".png")
	defer os.Remove(filePath)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		t.Fatalf("saved file does not exist at %s", filePath)
	}

	// Test URL with HTTP request
	req := httptest.NewRequest(http.MethodGet, "https://api.ifragment.org/test", nil)
	url := cg.GetPublicCardURL(fileID, req)
	expectedPrefix := "https://api.ifragment.org/static/shares/"
	if !strings.HasPrefix(url, expectedPrefix) {
		t.Errorf("expected URL to start with %s, got %s", expectedPrefix, url)
	}

	// Test URL without HTTP request (fallback)
	urlFallback := cg.GetPublicCardURL(fileID, nil)
	if !strings.Contains(urlFallback, "/static/shares/"+fileID+".png") {
		t.Errorf("expected URL fallback to contain path, got %s", urlFallback)
	}
}

func TestPersianVazirmatn(t *testing.T) {
	cg := NewCardGenerator()
	if cg.fontVazirBold == nil {
		t.Fatalf("fontVazirBold is nil")
	}

	face, err := cg.getFace(cg.fontVazirBold, 12.0)
	if err != nil {
		t.Fatalf("getFace failed: %v", err)
	}

	// Test measuring the shaped strings
	w1 := font.MeasureString(face, PersianVerifiedShaped).Ceil()
	w2 := font.MeasureString(face, PersianEstimatedPriceShaped).Ceil()
	t.Logf("PersianVerified width: %d, PersianEstimatedPrice width: %d", w1, w2)
	if w1 <= 0 || w2 <= 0 {
		t.Errorf("expected positive width for Persian strings, got w1=%d, w2=%d", w1, w2)
	}
}

func TestGenerateSampleCards(t *testing.T) {
	cg := NewCardGenerator()

	// 1. Username Card (matches Image 1: @rare, APEX, 138,000 TON, $201,287)
	uData, err := cg.GenerateUsernameCard("@rare", "APEX", "138,000", "201,287")
	if err != nil {
		t.Fatalf("GenerateUsernameCard failed: %v", err)
	}
	_ = os.WriteFile("test_sample_username.png", uData, 0644)
	artifactDir := `C:\Users\DEll\.gemini\antigravity-ide\brain\eedbfa01-a771-4105-8fad-05011484b61c`
	_ = os.WriteFile(filepath.Join(artifactDir, "flex_card_username.png"), uData, 0644)

	// 2. Number Card (matches Image 2: +888 0123 4567, RANK #1011, 44,500.0 TON, $64524)
	nData, err := cg.GenerateNumberCard("+888 0123 4567", "LADDER", 1011, "44,500", "64,524")
	if err != nil {
		t.Fatalf("GenerateNumberCard failed: %v", err)
	}
	_ = os.WriteFile("test_sample_number.png", nData, 0644)
	_ = os.WriteFile(filepath.Join(artifactDir, "flex_card_number.png"), nData, 0644)

	// 3. Rich Gift Card (Plush Pepe #42, LEGENDARY, Emerald Glow, 145.0 TON, $725)
	imgFile := filepath.Join(artifactDir, "scratch", "real_gift_img.jpg")
	gData, err := cg.GenerateRichGiftCard(GiftCardParams{
		Title:          "Plush Pepe #42",
		ModelName:      "Plush Pepe",
		SerialNumber:   42,
		RarityTier:     "LEGENDARY",
		BackdropName:   "Emerald Glow",
		BackdropCenter: "#0098EA",
		BackdropEdge:   "#0A1F30",
		SymbolName:     "Golden Star",
		ImageURL:       imgFile,
		ExpectedTON:    "145.0",
		ExpectedUSD:    "725",
		Lang:           "fa",
	})
	if err != nil {
		t.Fatalf("GenerateRichGiftCard failed: %v", err)
	}
	_ = os.WriteFile("test_sample_gift.png", gData, 0644)
	_ = os.WriteFile(filepath.Join(artifactDir, "flex_card_gift.png"), gData, 0644)
}

func TestCardGenerator_GenerateRichGiftCard_Langs(t *testing.T) {
	cg := NewCardGenerator()
	artifactDir := `C:\Users\DEll\.gemini\antigravity-ide\brain\eedbfa01-a771-4105-8fad-05011484b61c`
	imgFile := filepath.Join(artifactDir, "scratch", "real_gift_img.jpg")

	for _, lang := range []string{"fa", "en", "ru", "zh"} {
		data, err := cg.GenerateRichGiftCard(GiftCardParams{
			Title:          "Plush Pepe #42",
			ModelName:      "Plush Pepe",
			SerialNumber:   42,
			RarityTier:     "LEGENDARY",
			BackdropName:   "Emerald Glow",
			BackdropCenter: "#0098EA",
			SymbolName:     "Golden Star",
			ImageURL:       imgFile,
			ExpectedTON:    "145.0",
			ExpectedUSD:    "725",
			Lang:           lang,
		})
		if err != nil {
			t.Fatalf("GenerateRichGiftCard lang=%s failed: %v", lang, err)
		}
		if len(data) == 0 {
			t.Fatalf("expected non-empty byte slice for lang=%s", lang)
		}
	}
}

func TestCardGenerator_Dimensions(t *testing.T) {
	cg := NewCardGenerator()

	t.Run("Rich Username Card 600x600", func(t *testing.T) {
		p := UsernameCardParams{
			Username:     "crypto",
			Grade:        "EXCLUSIVE",
			LowTON:       "1200.0",
			FairTON:      "1500.0",
			HighTON:      "1800.0",
			USDT:         "7500",
			Brandability: 98,
			Length:       6,
			MarketStatus: "CLAIMED",
			CompsCount:   14,
			Confidence:   92,
			Lang:         "fa",
		}
		data, err := cg.GenerateRichUsernameCard(p)
		if err != nil {
			t.Fatalf("GenerateRichUsernameCard failed: %v", err)
		}
		img, err := png.Decode(bytes.NewReader(data))
		if err != nil {
			t.Fatalf("failed to decode PNG: %v", err)
		}
		if img.Bounds().Dx() != 600 || img.Bounds().Dy() != 600 {
			t.Fatalf("expected 600x600, got %dx%d", img.Bounds().Dx(), img.Bounds().Dy())
		}
	})

	t.Run("Rich Number Card 600x600", func(t *testing.T) {
		p := NumberCardParams{
			Number:       "+888 8888 8888",
			Club:         "Grail Monodigit",
			Rank:         1,
			LowTON:       "80000.0",
			FairTON:      "100000.0",
			HighTON:      "125000.0",
			USDT:         "500000",
			ColorPattern: "Radiant Gold",
			Supply:       1,
			Lang:         "fa",
		}
		data, err := cg.GenerateRichNumberCard(p)
		if err != nil {
			t.Fatalf("GenerateRichNumberCard failed: %v", err)
		}
		img, err := png.Decode(bytes.NewReader(data))
		if err != nil {
			t.Fatalf("failed to decode PNG: %v", err)
		}
		if img.Bounds().Dx() != 600 || img.Bounds().Dy() != 600 {
			t.Fatalf("expected 600x600, got %dx%d", img.Bounds().Dx(), img.Bounds().Dy())
		}
	})

	t.Run("Rich Gift Card 600x600", func(t *testing.T) {
		p := GiftCardParams{
			Title:        "Plush Pepe #42",
			ModelName:    "Plush Pepe",
			SerialNumber: 42,
			RarityTier:   "LEGENDARY",
			ExpectedTON:  "145.0",
			ExpectedUSD:  "725",
			Lang:         "fa",
		}
		data, err := cg.GenerateRichGiftCard(p)
		if err != nil {
			t.Fatalf("GenerateRichGiftCard failed: %v", err)
		}
		img, err := png.Decode(bytes.NewReader(data))
		if err != nil {
			t.Fatalf("failed to decode PNG: %v", err)
		}
		if img.Bounds().Dx() != 600 || img.Bounds().Dy() != 600 {
			t.Fatalf("expected 600x600, got %dx%d", img.Bounds().Dx(), img.Bounds().Dy())
		}
	})
}

func TestExportSampleCards(t *testing.T) {
	cg := NewCardGenerator()
	sampleDir := "./static/sample_cards"
	_ = os.MkdirAll(sampleDir, 0755)

	uParams := UsernameCardParams{
		Username:     "crypto",
		Grade:        "EXCLUSIVE",
		LowTON:       "1200.0",
		FairTON:      "1500.0",
		HighTON:      "1800.0",
		USDT:         "7500",
		Brandability: 98,
		Length:       6,
		MarketStatus: "CLAIMED",
		CompsCount:   14,
		Confidence:   92,
		Lang:         "fa",
	}
	if uData, err := cg.GenerateRichUsernameCard(uParams); err == nil {
		_ = os.WriteFile(filepath.Join(sampleDir, "sample_username_card.png"), uData, 0644)
	}

	nParams := NumberCardParams{
		Number:       "+888 8888 8888",
		Club:         "Grail Monodigit",
		Rank:         1,
		LowTON:       "80000.0",
		FairTON:      "100000.0",
		HighTON:      "125000.0",
		USDT:         "500000",
		ColorPattern: "Radiant Gold",
		Supply:       1,
		Lang:         "fa",
	}
	if nData, err := cg.GenerateRichNumberCard(nParams); err == nil {
		_ = os.WriteFile(filepath.Join(sampleDir, "sample_number_card.png"), nData, 0644)
	}

	gParams := GiftCardParams{
		Title:        "Plush Pepe #42",
		ModelName:    "Plush Pepe",
		SerialNumber: 42,
		RarityTier:   "LEGENDARY",
		ExpectedTON:  "145.0",
		ExpectedUSD:  "725",
		Lang:         "fa",
	}
	if gData, err := cg.GenerateRichGiftCard(gParams); err == nil {
		_ = os.WriteFile(filepath.Join(sampleDir, "sample_gift_card.png"), gData, 0644)
	}
}

func TestContainsArabicScript(t *testing.T) {
	if !containsArabicScript("شماره رند") {
		t.Errorf("expected true for Persian text")
	}
	if containsArabicScript("LADDER") {
		t.Errorf("expected false for Latin text")
	}
}

func TestFormatUSDTAmount(t *testing.T) {
	if res := formatUSDTAmount("12450"); res != "12,450" {
		t.Errorf("expected 12,450, got %s", res)
	}
	if res := formatUSDTAmount("0"); res != "" {
		t.Errorf("expected empty string for 0, got %s", res)
	}
	if res := formatUSDTAmount("$2500.50"); res != "2,500" {
		t.Errorf("expected 2,500, got %s", res)
	}
}

func TestIsUnsupportedFontScript(t *testing.T) {
	cases := []struct {
		input    string
		expected bool
	}{
		{"VERIFIED", false},
		{"RANK #42", false},
		{"Plush Pepe #42", false},
		{"BRAND: 85/100", false},
		{"شماره رند", true},     // Persian
		{"هدایا تلگرام", true},    // Persian
		{"ЭПИЧЕСКИЙ", true},    // Russian (Cyrillic)
		{"Редкий подарок", true}, // Russian
		{"史诗级礼物", true},      // Chinese
		{"@durov", false},
		{"@نام_کاربری", true},
	}

	for _, c := range cases {
		got := isUnsupportedFontScript(c.input)
		if got != c.expected {
			t.Errorf("isUnsupportedFontScript(%q) = %v; want %v", c.input, got, c.expected)
		}
	}
}

func TestCardGenerator_NonLatinInputsDoNotFailOrCrash(t *testing.T) {
	cg := NewCardGenerator()

	// 1. Rich Username Card with localized/Persian values
	uBytes, err := cg.GenerateRichUsernameCard(UsernameCardParams{
		Username:     "نام_کاربری",
		Grade:        "حماسی",
		FairTON:      "150.0",
		USDT:         "750",
		MarketStatus: "فروخته شده",
		Brandability: 85,
		Lang:         "fa",
	})
	if err != nil || len(uBytes) == 0 {
		t.Fatalf("GenerateRichUsernameCard failed for Persian inputs: %v", err)
	}

	// 2. Rich Number Card with localized/Russian values
	nBytes, err := cg.GenerateRichNumberCard(NumberCardParams{
		Number:       "+888 0123 4567",
		Club:         "Клуб Легенд",
		Rank:         12,
		FairTON:      "320.0",
		USDT:         "1600",
		ColorPattern: "Золотой",
		Lang:         "ru",
	})
	if err != nil || len(nBytes) == 0 {
		t.Fatalf("GenerateRichNumberCard failed for Russian inputs: %v", err)
	}

	// 3. Rich Gift Card with Chinese values
	gBytes, err := cg.GenerateRichGiftCard(GiftCardParams{
		Title:        "稀有礼物",
		ModelName:    "米兰之心",
		SerialNumber: 88,
		RarityTier:   "史诗",
		ExpectedTON:  "99.0",
		ExpectedUSD:  "495",
		Lang:         "zh",
	})
	if err != nil || len(gBytes) == 0 {
		t.Fatalf("GenerateRichGiftCard failed for Chinese inputs: %v", err)
	}
}


