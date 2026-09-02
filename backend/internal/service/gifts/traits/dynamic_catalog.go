package traits

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const (
	BaseAPIURL      = "https://api.changes.tg"
	CatalogCacheTTL = 24 * time.Hour
	SyncWorkerCount = 8
)

// DynamicCatalog manages live 24h-cached Telegram Gift catalog from api.changes.tg without hardcoding
type DynamicCatalog struct {
	httpClient  *http.Client
	mu          sync.RWMutex
	collections map[string]CollectionMeta
	backdrops   map[string]BackdropMeta
	symbols     map[string]SymbolMeta
	lastSynced  time.Time
	isSyncing   bool
}

type BackdropMeta struct {
	Name     string
	Permille int
	Colors   BackdropColorSet
}

type SymbolMeta struct {
	Name     string
	Permille int
	Tier     string
}

// GlobalCatalog singleton instance used across the system
var GlobalCatalog *DynamicCatalog
var globalInitOnce sync.Once

func GetGlobalCatalog() *DynamicCatalog {
	globalInitOnce.Do(func() {
		GlobalCatalog = NewDynamicCatalog()
		// Initial background sync
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
			defer cancel()
			if err := GlobalCatalog.Sync(ctx); err != nil {
				slog.Warn("[DynamicCatalog] Initial 24h catalog sync warning", "error", err)
			}
		}()
		// Start 24-hour background ticker
		go GlobalCatalog.Start24hTicker()
	})
	return GlobalCatalog
}

func NewDynamicCatalog() *DynamicCatalog {
	return &DynamicCatalog{
		httpClient: &http.Client{
			Timeout: 8 * time.Second,
		},
		collections: make(map[string]CollectionMeta),
		backdrops:   make(map[string]BackdropMeta),
		symbols:     make(map[string]SymbolMeta),
	}
}

// Start24hTicker runs automatic sync once every 24 hours
func (dc *DynamicCatalog) Start24hTicker() {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		if err := dc.Sync(ctx); err != nil {
			slog.Error("[DynamicCatalog] 24h scheduled sync failed", "error", err)
		} else {
			slog.Info("[DynamicCatalog] 24h scheduled sync completed successfully", "collections_count", len(dc.collections))
		}
		cancel()
	}
}

// Sync fetches all 120 gifts, models, backdrops, and symbols from api.changes.tg and caches for 24h
func (dc *DynamicCatalog) Sync(ctx context.Context) error {
	dc.mu.Lock()
	if dc.isSyncing {
		dc.mu.Unlock()
		return nil
	}
	dc.isSyncing = true
	dc.mu.Unlock()

	defer func() {
		dc.mu.Lock()
		dc.isSyncing = false
		dc.mu.Unlock()
	}()

	slog.Info("[DynamicCatalog] Starting full 24h Telegram Gift catalog sync from api.changes.tg...")

	// 1. Fetch all live gift names from /gifts
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, BaseAPIURL+"/gifts", nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "iFragment/1.0 (Telegram Mini App; Bot: @iFragmentBot)")
	req.Header.Set("Accept", "application/json")

	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("api.changes.tg/gifts returned HTTP %d", resp.StatusCode)
	}

	var giftNames []string
	if err := json.NewDecoder(resp.Body).Decode(&giftNames); err != nil {
		return err
	}

	if len(giftNames) == 0 {
		return fmt.Errorf("empty gift list from api.changes.tg")
	}

	// 2. Worker pool to fetch all gift details concurrently
	type giftDetailResponse struct {
		Gift struct {
			ID                 string `json:"id"`
			Name               string `json:"name"`
			Slug               string `json:"slug"`
			TotalSupply        int    `json:"totalSupply"`
			AvailabilityRemain int    `json:"availabilityRemains"`
			UpgradedCount      int    `json:"upgradedCount"`
			Upgradable         bool   `json:"upgradable"`
			Limited            bool   `json:"limited"`
			Craftable          bool   `json:"craftable"`
		} `json:"gift"`
		Models []struct {
			Name           string `json:"name"`
			RarityPermille int    `json:"rarityPermille"`
		} `json:"models"`
		Backdrops []struct {
			Name string `json:"name"`
			Hex  struct {
				Center  string `json:"center"`
				Edge    string `json:"edge"`
				Pattern string `json:"pattern"`
				Text    string `json:"text"`
			} `json:"hex"`
			RarityPermille int `json:"rarityPermille"`
		} `json:"backdrops"`
		Symbols []struct {
			Name           string `json:"name"`
			RarityPermille int    `json:"rarityPermille"`
		} `json:"symbols"`
	}

	newCollections := make(map[string]CollectionMeta)
	newBackdrops := make(map[string]BackdropMeta)
	newSymbols := make(map[string]SymbolMeta)
	var syncMu sync.Mutex

	jobs := make(chan string, len(giftNames))
	for _, name := range giftNames {
		jobs <- name
	}
	close(jobs)

	var wg sync.WaitGroup
	for w := 0; w < SyncWorkerCount; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for rawName := range jobs {
				cleanSlug := strings.ToLower(strings.TrimSpace(rawName))
				cleanSlug = strings.ReplaceAll(cleanSlug, " ", "-")
				cleanSlug = strings.ReplaceAll(cleanSlug, "_", "-")

				detailURL := fmt.Sprintf("%s/gift/%s", BaseAPIURL, url.PathEscape(cleanSlug))
				dReq, dErr := http.NewRequestWithContext(ctx, http.MethodGet, detailURL, nil)
				if dErr != nil {
					continue
				}
				dReq.Header.Set("User-Agent", "iFragment/1.0")
				dReq.Header.Set("Accept", "application/json")

				dResp, dErr := dc.httpClient.Do(dReq)
				if dErr != nil || dResp == nil || dResp.StatusCode != http.StatusOK {
					if dResp != nil {
						dResp.Body.Close()
					}
					continue
				}

				var detail giftDetailResponse
				decErr := json.NewDecoder(dResp.Body).Decode(&detail)
				dResp.Body.Close()
				if decErr != nil || detail.Gift.Name == "" {
					continue
				}

				modelID := NormalizeSlug(detail.Gift.Name)
				totalSupply := detail.Gift.TotalSupply
				if totalSupply <= 0 {
					if canonCol, ok := CanonicalCollections[modelID]; ok && canonCol.TotalSupply > 0 {
						totalSupply = canonCol.TotalSupply
					}
				}

				meta := CollectionMeta{
					ModelID:     modelID,
					Name:        detail.Gift.Name,
					TotalSupply: totalSupply,
					CraftedFlag: detail.Gift.Craftable,
					LimitedFlag: detail.Gift.Limited,
					ContractID:  detail.Gift.ID,
					Description: fmt.Sprintf("Official Telegram Collectible %s (Total Supply: %d, Upgraded: %d)", detail.Gift.Name, totalSupply, detail.Gift.UpgradedCount),
				}

				syncMu.Lock()
				newCollections[modelID] = meta
				normKey := strings.ReplaceAll(modelID, "_", "")
				newCollections[normKey] = meta

				// Backdrops
				for _, b := range detail.Backdrops {
					if b.Name != "" {
						newBackdrops[b.Name] = BackdropMeta{
							Name:     b.Name,
							Permille: b.RarityPermille,
							Colors: BackdropColorSet{
								CenterHex:  b.Hex.Center,
								EdgeHex:    b.Hex.Edge,
								PatternHex: b.Hex.Pattern,
								TextHex:    b.Hex.Text,
							},
						}
					}
				}

				// Symbols
				for _, s := range detail.Symbols {
					if s.Name != "" {
						percentile := float64(s.RarityPermille) / 10.0
						tier := ClassifyRarityTier(percentile)
						newSymbols[s.Name] = SymbolMeta{
							Name:     s.Name,
							Permille: s.RarityPermille,
							Tier:     tier,
						}
					}
				}
				syncMu.Unlock()
			}
		}()
	}

	wg.Wait()

	if len(newCollections) > 0 {
		dc.mu.Lock()
		dc.collections = newCollections
		dc.backdrops = newBackdrops
		dc.symbols = newSymbols
		dc.lastSynced = time.Now().UTC()
		dc.mu.Unlock()
		slog.Info("[DynamicCatalog] Sync successfully loaded live catalog", "collections", len(newCollections), "backdrops", len(newBackdrops), "symbols", len(newSymbols))
	}

	return nil
}

// ResolveCollection finds collection metadata from live 24h synced catalog
func (dc *DynamicCatalog) ResolveCollection(key string) (CollectionMeta, bool) {
	dc.mu.RLock()
	defer dc.mu.RUnlock()

	norm := NormalizeSlug(key)
	if col, ok := dc.collections[norm]; ok {
		return col, true
	}

	cleanNoUnderscore := strings.ReplaceAll(norm, "_", "")
	if col, ok := dc.collections[cleanNoUnderscore]; ok {
		return col, true
	}

	return CollectionMeta{}, false
}

// GetAllCollections returns list of all live 24h synced collections
func (dc *DynamicCatalog) GetAllCollections() []CollectionMeta {
	dc.mu.RLock()
	defer dc.mu.RUnlock()

	seen := make(map[string]bool)
	var list []CollectionMeta
	for _, col := range dc.collections {
		if !seen[col.ModelID] && col.ModelID != "" {
			seen[col.ModelID] = true
			list = append(list, col)
		}
	}
	if len(list) == 0 {
		// Fallback to canonical collections
		for _, col := range CanonicalCollections {
			if !seen[col.ModelID] {
				seen[col.ModelID] = true
				list = append(list, col)
			}
		}
	}
	return list
}

// ResolveBackdrop returns live synced backdrop metadata
func (dc *DynamicCatalog) ResolveBackdrop(name string) (string, int, BackdropColorSet, bool) {
	dc.mu.RLock()
	defer dc.mu.RUnlock()

	if bd, ok := dc.backdrops[name]; ok {
		return name, bd.Permille, bd.Colors, true
	}

	// Case-insensitive search
	lower := strings.ToLower(name)
	for k, bd := range dc.backdrops {
		if strings.ToLower(k) == lower {
			return bd.Name, bd.Permille, bd.Colors, true
		}
	}

	return name, 50, BackdropColorSet{
		CenterHex:  "#1a2035",
		EdgeHex:    "#0a0e1a",
		PatternHex: "#ffffff",
		TextHex:    "#ffffff",
	}, false
}

// ResolveSymbol returns live synced symbol metadata
func (dc *DynamicCatalog) ResolveSymbol(name string) (string, int, string, bool) {
	dc.mu.RLock()
	defer dc.mu.RUnlock()

	if sym, ok := dc.symbols[name]; ok {
		return name, sym.Permille, sym.Tier, true
	}

	lower := strings.ToLower(name)
	for k, sym := range dc.symbols {
		if strings.ToLower(k) == lower {
			return sym.Name, sym.Permille, sym.Tier, true
		}
	}

	return name, 50, "Rare", false
}
