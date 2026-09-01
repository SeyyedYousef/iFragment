package telegramnft

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"ifragment-backend/internal/service/gifts/traits"
)

// LiveNFTDetails contains parsed on-chain attributes from t.me/nft
type LiveNFTDetails struct {
	CollectionName  string  `json:"collection_name"`
	CollectionSlug  string  `json:"collection_slug"`
	SerialNumber    int     `json:"serial_number"`
	OwnerName       string  `json:"owner_name"`
	Model           string  `json:"model"`
	ModelRarityPct  float64 `json:"model_rarity_pct"`
	Backdrop        string  `json:"backdrop"`
	BackdropRarity  float64 `json:"backdrop_rarity_pct"`
	Symbol          string  `json:"symbol"`
	SymbolRarityPct float64 `json:"symbol_rarity_pct"`
	IssuedCount     int     `json:"issued_count"`
	TotalSupply     int     `json:"total_supply"`
	ImageURL        string  `json:"image_url"`
	CheckedAt       time.Time `json:"checked_at"`
}

// Resolver fetches and parses official Telegram NFT details from t.me/nft
type Resolver struct {
	httpClient *http.Client
	mu         sync.RWMutex
	cache      map[string]*cacheEntry
}

type cacheEntry struct {
	details   *LiveNFTDetails
	expiresAt time.Time
}

var (
	ownerRe    = regexp.MustCompile(`(?i)<th>Owner</th>\s*<td>.*?<span[^>]*dir="auto">([^<]+)</span>`)
	modelRe    = regexp.MustCompile(`(?is)<th>Model</th>\s*<td>([^<\n\r]+?)(?:\s*<mark>([\d\.]+)%?</mark>)?\s*</td>`)
	backdropRe = regexp.MustCompile(`(?is)<th>Backdrop</th>\s*<td>([^<\n\r]+?)(?:\s*<mark>([\d\.]+)%?</mark>)?\s*</td>`)
	symbolRe   = regexp.MustCompile(`(?is)<th>Symbol</th>\s*<td>([^<\n\r]+?)(?:\s*<mark>([\d\.]+)%?</mark>)?\s*</td>`)
	qtyRe      = regexp.MustCompile(`(?i)<th>Quantity</th>\s*<td>\s*(\d+)\s*/\s*(\d+)\s*issued`)
)

func NewResolver() *Resolver {
	return &Resolver{
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
		cache: make(map[string]*cacheEntry),
	}
}

// telegramNFTSlugOverrides maps internal model IDs to official Telegram t.me/nft URL slugs
var telegramNFTSlugOverrides = map[string]string{
	"durov_cap":   "DurovsBlackCap",
	"golden_star": "CelestialStar",
}

// FormatPascalName converts model slug/name to Telegram NFT PascalCase slug
func FormatPascalName(raw string) string {
	clean := strings.ToLower(strings.TrimSpace(raw))
	clean = strings.ReplaceAll(clean, "-", "_")
	if override, ok := telegramNFTSlugOverrides[clean]; ok {
		return override
	}

	col, ok := traits.ResolveCollection(raw)
	name := raw
	if ok && col.Name != "" {
		name = col.Name
	}
	// Remove apostrophes, special characters
	name = strings.ReplaceAll(name, "'", "")
	name = strings.ReplaceAll(name, "’", "")
	words := strings.FieldsFunc(name, func(r rune) bool {
		return r == ' ' || r == '-' || r == '_'
	})
	for i, w := range words {
		if len(w) > 0 {
			words[i] = strings.ToUpper(w[:1]) + strings.ToLower(w[1:])
		}
	}
	return strings.Join(words, "")
}

// ResolveGiftNFT fetches real attributes for any gift serial (e.g. "plush_pepe", 1)
func (r *Resolver) ResolveGiftNFT(ctx context.Context, modelID string, serial int) (*LiveNFTDetails, error) {
	if serial <= 0 {
		serial = 1
	}

	cleanModel := strings.ToLower(strings.TrimSpace(modelID))
	cleanModel = strings.ReplaceAll(cleanModel, "-", "_")
	col, _ := traits.ResolveCollection(cleanModel)
	if col.ModelID != "" {
		cleanModel = col.ModelID
	}

	cacheKey := fmt.Sprintf("nft_live:%s:%d", cleanModel, serial)
	r.mu.RLock()
	if entry, ok := r.cache[cacheKey]; ok && time.Now().Before(entry.expiresAt) {
		r.mu.RUnlock()
		return entry.details, nil
	}
	r.mu.RUnlock()

	pascal := FormatPascalName(cleanModel)
	targetURL := fmt.Sprintf("https://t.me/nft/%s-%d", pascal, serial)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; iFragmentBot/1.0; +https://ifragment.app)")

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("t.me returned HTTP %d for %s", resp.StatusCode, targetURL)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	html := string(bodyBytes)

	details := &LiveNFTDetails{
		CollectionName: col.Name,
		CollectionSlug: cleanModel,
		SerialNumber:   serial,
		CheckedAt:      time.Now().UTC(),
	}

	// 1. Parse Owner
	if m := ownerRe.FindStringSubmatch(html); len(m) >= 2 {
		details.OwnerName = strings.TrimSpace(m[1])
	}

	// 2. Parse Model
	if m := modelRe.FindStringSubmatch(html); len(m) >= 2 {
		details.Model = strings.TrimSpace(m[1])
		if len(m) >= 3 && m[2] != "" {
			if pct, err := strconv.ParseFloat(m[2], 64); err == nil {
				details.ModelRarityPct = pct
			}
		}
	}

	// 3. Parse Backdrop
	if m := backdropRe.FindStringSubmatch(html); len(m) >= 2 {
		details.Backdrop = strings.TrimSpace(m[1])
		if len(m) >= 3 && m[2] != "" {
			if pct, err := strconv.ParseFloat(m[2], 64); err == nil {
				details.BackdropRarity = pct
			}
		}
	}

	// 4. Parse Symbol
	if m := symbolRe.FindStringSubmatch(html); len(m) >= 2 {
		details.Symbol = strings.TrimSpace(m[1])
		if len(m) >= 3 && m[2] != "" {
			if pct, err := strconv.ParseFloat(m[2], 64); err == nil {
				details.SymbolRarityPct = pct
			}
		}
	}

	// 5. Parse Quantity
	if m := qtyRe.FindStringSubmatch(html); len(m) >= 3 {
		if issued, err := strconv.Atoi(m[1]); err == nil {
			details.IssuedCount = issued
		}
		if total, err := strconv.Atoi(m[2]); err == nil {
			details.TotalSupply = total
		}
	}

	if details.Model != "" {
		slugParam := strings.ReplaceAll(cleanModel, "_", "-")
		details.ImageURL = fmt.Sprintf("https://api.changes.tg/model/%s/%s.png?size=256", slugParam, details.Model)
	}

	// Cache valid details for 6 hours (NFT metadata is immutable on-chain)
	r.mu.Lock()
	r.cache[cacheKey] = &cacheEntry{
		details:   details,
		expiresAt: time.Now().Add(6 * time.Hour),
	}
	r.mu.Unlock()

	return details, nil
}
