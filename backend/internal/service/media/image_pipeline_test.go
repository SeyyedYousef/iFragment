package media

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func createTestPNG(w, h int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 255), G: uint8(y % 255), B: 120, A: 255})
		}
	}
	buf := new(bytes.Buffer)
	_ = png.Encode(buf, img)
	return buf.Bytes()
}

func TestProcessAndStoreAdImageValidPNG(t *testing.T) {
	pngData := createTestPNG(800, 600)
	r := bytes.NewReader(pngData)

	res, err := ProcessAndStoreAdImage(r, "dashboard_banner")
	if err != nil {
		t.Fatalf("Failed to process valid PNG: %v", err)
	}

	t.Cleanup(func() {
		if res != nil && res.Filename != "" {
			_ = os.Remove(filepath.Join(UploadDirBase, res.Filename))
			_ = os.Remove(filepath.Join(UploadDirBase, strings.TrimSuffix(res.Filename, filepath.Ext(res.Filename))+"_thumb.jpg"))
		}
	})

	if res.Width != 1080 || res.Height != 384 {
		t.Errorf("Expected 1080x384 dimensions, got %dx%d", res.Width, res.Height)
	}
	if !strings.HasPrefix(res.URL, "/uploads/ads/") {
		t.Errorf("Unexpected URL format: %s", res.URL)
	}
	if res.ETag == "" {
		t.Error("Expected valid ETag")
	}
}

func TestProcessAndStoreAdImageMagicByteRejection(t *testing.T) {
	// Text/HTML disguised as image
	fakeData := []byte("<html><body>Fake Image</body></html>")
	r := bytes.NewReader(fakeData)

	_, err := ProcessAndStoreAdImage(r, "dashboard_banner")
	if err == nil {
		t.Fatal("Expected error for non-image data, got nil")
	}
}
