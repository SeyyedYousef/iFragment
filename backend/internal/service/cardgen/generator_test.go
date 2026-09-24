package cardgen

import (
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

	// 3. Gift Card
	gData, err := cg.GenerateGiftCard("Plush Pepe", "plush_pepe-42", 42, "LEGENDARY", "145", "725")
	if err != nil {
		t.Fatalf("GenerateGiftCard failed: %v", err)
	}
	_ = os.WriteFile("test_sample_gift.png", gData, 0644)
	_ = os.WriteFile(filepath.Join(artifactDir, "flex_card_gift.png"), gData, 0644)
}

