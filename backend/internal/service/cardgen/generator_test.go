package cardgen

import (
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
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
