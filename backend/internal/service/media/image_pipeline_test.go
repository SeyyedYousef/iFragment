package media

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
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

func createTestJPEG(w, h int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{R: 200, G: uint8(y % 255), B: uint8(x % 255), A: 255})
		}
	}
	buf := new(bytes.Buffer)
	_ = jpeg.Encode(buf, img, &jpeg.Options{Quality: 90})
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

func TestProcessAndStoreAdImageValidJPEG(t *testing.T) {
	jpegData := createTestJPEG(1200, 800)
	r := bytes.NewReader(jpegData)

	res, err := ProcessAndStoreAdImage(r, "dashboard_banner")
	if err != nil {
		t.Fatalf("Failed to process valid JPEG: %v", err)
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

func TestProcessAndStoreAdImageInvestorsPageSlot(t *testing.T) {
	pngData := createTestPNG(600, 1000)
	r := bytes.NewReader(pngData)

	res, err := ProcessAndStoreAdImage(r, "investors_page")
	if err != nil {
		t.Fatalf("Failed to process valid PNG for investors_page slot: %v", err)
	}

	t.Cleanup(func() {
		if res != nil && res.Filename != "" {
			_ = os.Remove(filepath.Join(UploadDirBase, res.Filename))
			_ = os.Remove(filepath.Join(UploadDirBase, strings.TrimSuffix(res.Filename, filepath.Ext(res.Filename))+"_thumb.jpg"))
		}
	})

	if res.Width != 1080 || res.Height != 1920 {
		t.Errorf("Expected 1080x1920 dimensions for investors_page slot, got %dx%d", res.Width, res.Height)
	}
}

func TestProcessAndStoreAdImageInvestorsPageRejectsGIF(t *testing.T) {
	gifHeader := []byte("GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;")
	r := bytes.NewReader(gifHeader)

	_, err := ProcessAndStoreAdImage(r, "investors_page")
	if err == nil {
		t.Fatal("Expected error for GIF in investors_page slot, got nil")
	}
	if !strings.Contains(err.Error(), "GIF format is not supported") {
		t.Errorf("Expected GIF rejection error message, got: %v", err)
	}
}

