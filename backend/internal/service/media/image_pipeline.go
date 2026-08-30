package media

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"image/draw"
	_ "image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

const (
	MaxAdFileSize   = 5 * 1024 * 1024 // 5 MB
	MaxDimension    = 4096            // Max width/height to protect against decompression bombs
	SlotDashboardW  = 1080
	SlotDashboardH  = 384
	UploadDirBase   = "./uploads/ads"
)

type ProcessedImage struct {
	Filename       string `json:"filename"`
	URL            string `json:"url"`
	Width          int    `json:"width"`
	Height         int    `json:"height"`
	SizeBytes      int64  `json:"size_bytes"`
	MimeType       string `json:"mime_type"`
	ETag           string `json:"etag"`
	ThumbnailURL   string `json:"thumbnail_url,omitempty"`
}

type SlotConfig struct {
	TargetWidth  int
	TargetHeight int
}

var SlotDimensions = map[string]SlotConfig{
	"dashboard_banner": {TargetWidth: SlotDashboardW, TargetHeight: SlotDashboardH},
	"interstitial":    {TargetWidth: 1080, TargetHeight: 1920},
}

// ProcessAndStoreAdImage validates magic bytes, decodes, resizes/crops to slot dimensions,
// strips metadata, generates a unique file, and stores it in the uploads directory.
func ProcessAndStoreAdImage(r io.Reader, slot string) (*ProcessedImage, error) {
	if slot == "" {
		slot = "dashboard_banner"
	}
	cfg, ok := SlotDimensions[slot]
	if !ok {
		cfg = SlotDimensions["dashboard_banner"]
	}

	// 1. Read input with size limit
	lr := io.LimitReader(r, MaxAdFileSize+1)
	data, err := io.ReadAll(lr)
	if err != nil {
		return nil, fmt.Errorf("failed to read upload data: %w", err)
	}
	if len(data) > MaxAdFileSize {
		return nil, errors.New("file size exceeds maximum allowed limit of 5MB")
	}
	if len(data) < 16 {
		return nil, errors.New("uploaded file is too small or corrupt")
	}

	// 2. Magic Bytes Inspection
	mimeType := http.DetectContentType(data[:min(512, len(data))])
	if mimeType != "image/jpeg" && mimeType != "image/png" && mimeType != "image/webp" && mimeType != "image/jpg" && mimeType != "image/gif" {
		// Also check standard PNG/JPEG/WEBP/GIF magic signatures
		if isPNG(data) {
			mimeType = "image/png"
		} else if isJPEG(data) {
			mimeType = "image/jpeg"
		} else if isWEBP(data) {
			mimeType = "image/webp"
		} else if isGIF(data) {
			mimeType = "image/gif"
		} else {
			return nil, fmt.Errorf("invalid file format (%s). Only JPG, PNG, and WebP are allowed", mimeType)
		}
	}

	// 3. Dimension Bomb Check using Config
	imgCfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("invalid image headers: %w", err)
	}
	if imgCfg.Width <= 0 || imgCfg.Height <= 0 {
		return nil, errors.New("corrupt image dimensions")
	}
	if imgCfg.Width > MaxDimension || imgCfg.Height > MaxDimension {
		return nil, fmt.Errorf("image dimensions (%dx%d) exceed maximum allowed resolution of 4096x4096", imgCfg.Width, imgCfg.Height)
	}

	// 4. Decode full image
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image (%s): %w", format, err)
	}

	// 5. Center-crop and scale to target slot dimensions
	processedImg := fitAndCenterCrop(img, cfg.TargetWidth, cfg.TargetHeight)

	// 6. Ensure upload directory exists
	if err := os.MkdirAll(UploadDirBase, 0755); err != nil {
		return nil, fmt.Errorf("failed to create upload directory: %w", err)
	}

	// 7. Encode to PNG (strips all EXIF/metadata, safe from XSS)
	fileUUID := uuid.NewString()
	filename := fmt.Sprintf("%s.png", fileUUID)
	filePath := filepath.Join(UploadDirBase, filename)

	outBuf := new(bytes.Buffer)
	if err := png.Encode(outBuf, processedImg); err != nil {
		return nil, fmt.Errorf("failed to encode processed image: %w", err)
	}
	encodedBytes := outBuf.Bytes()

	if err := os.WriteFile(filePath, encodedBytes, 0644); err != nil {
		return nil, fmt.Errorf("failed to save image to disk: %w", err)
	}

	// 8. Generate Thumbnail
	thumbFilename := fmt.Sprintf("%s_thumb.jpg", fileUUID)
	thumbPath := filepath.Join(UploadDirBase, thumbFilename)
	thumbImg := fitAndCenterCrop(processedImg, cfg.TargetWidth/4, cfg.TargetHeight/4)
	thumbFile, thumbCreateErr := os.Create(thumbPath)
	if thumbCreateErr == nil {
		_ = jpeg.Encode(thumbFile, thumbImg, &jpeg.Options{Quality: 80})
		_ = thumbFile.Close()
	}

	// 9. Compute ETag
	hash := sha256.Sum256(encodedBytes)
	etag := hex.EncodeToString(hash[:])

	return &ProcessedImage{
		Filename:     filename,
		URL:          fmt.Sprintf("/uploads/ads/%s", filename),
		ThumbnailURL: fmt.Sprintf("/uploads/ads/%s", thumbFilename),
		Width:        cfg.TargetWidth,
		Height:       cfg.TargetHeight,
		SizeBytes:    int64(len(encodedBytes)),
		MimeType:     "image/png",
		ETag:         fmt.Sprintf("\"%s\"", etag),
	}, nil
}

// fitAndCenterCrop resizes and center-crops an image to exact target dimensions
func fitAndCenterCrop(src image.Image, targetW, targetH int) image.Image {
	srcBounds := src.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()

	if srcW == targetW && srcH == targetH {
		return src
	}

	dst := image.NewRGBA(image.Rect(0, 0, targetW, targetH))

	// Calculate aspect ratios
	srcAspect := float64(srcW) / float64(srcH)
	targetAspect := float64(targetW) / float64(targetH)

	var cropRect image.Rectangle
	if srcAspect > targetAspect {
		// Source is wider than target -> crop horizontally
		cropW := int(float64(srcH) * targetAspect)
		x0 := srcBounds.Min.X + (srcW-cropW)/2
		cropRect = image.Rect(x0, srcBounds.Min.Y, x0+cropW, srcBounds.Max.Y)
	} else {
		// Source is taller than target -> crop vertically
		cropH := int(float64(srcW) / targetAspect)
		y0 := srcBounds.Min.Y + (srcH-cropH)/2
		cropRect = image.Rect(srcBounds.Min.X, y0, srcBounds.Max.X, y0+cropH)
	}

	// Nearest neighbor / simple scaling from cropRect to dst
	scaleRect(dst, src, cropRect)
	return dst
}

func scaleRect(dst *image.RGBA, src image.Image, cropRect image.Rectangle) {
	dstBounds := dst.Bounds()
	dstW := dstBounds.Dx()
	dstH := dstBounds.Dy()
	cropW := cropRect.Dx()
	cropH := cropRect.Dy()

	if cropW <= 0 || cropH <= 0 || dstW <= 0 || dstH <= 0 {
		draw.Draw(dst, dstBounds, src, image.Point{}, draw.Src)
		return
	}

	for y := 0; y < dstH; y++ {
		srcY := cropRect.Min.Y + (y * cropH / dstH)
		for x := 0; x < dstW; x++ {
			srcX := cropRect.Min.X + (x * cropW / dstW)
			dst.Set(x, y, src.At(srcX, srcY))
		}
	}
}

func isPNG(data []byte) bool {
	return len(data) >= 8 && data[0] == 0x89 && data[1] == 'P' && data[2] == 'N' && data[3] == 'G'
}

func isJPEG(data []byte) bool {
	return len(data) >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF
}

func isWEBP(data []byte) bool {
	return len(data) >= 12 && string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP"
}

func isGIF(data []byte) bool {
	return len(data) >= 6 && (string(data[:6]) == "GIF87a" || string(data[:6]) == "GIF89a")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
