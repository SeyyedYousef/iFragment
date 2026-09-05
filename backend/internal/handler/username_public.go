package handler

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username"
	"ifragment-backend/internal/service/username/avm"
	"log/slog"
	"math"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"ifragment-backend/internal/service/notification"
	"ifragment-backend/internal/service/payment"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/gotd/td/tg"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/singleflight"
)

type UsernameHandler struct {
	service       *username.AggregatorService
	reportService *username.AnalysisService
	avmService    *avm.ValuationService
	mtprotoClient mtproto.Client
	cache         *repository.Cache
	db            *repository.Database
	starsService  *payment.StarsService
	sfGroup       singleflight.Group
	activeStreams atomic.Int64
}

func NewUsernameHandler(
	s *username.AggregatorService,
	r *username.AnalysisService,
	m mtproto.Client,
	c *repository.Cache,
	avmSvc *avm.ValuationService,
	db *repository.Database,
	starsSvc *payment.StarsService,
) *UsernameHandler {
	return &UsernameHandler{
		service:       s,
		reportService: r,
		avmService:    avmSvc,
		mtprotoClient: m,
		cache:         c,
		db:            db,
		starsService:  starsSvc,
	}
}

func (h *UsernameHandler) CheckAvailability(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		RespondError(w, r, http.StatusBadRequest, "missing username", nil)
		return
	}

	ctx := r.Context()

	// Rate Limiting
	if h.cache != nil {
		ip := middleware.GetRealIP(r)
		rlKey := "rate_limit:check:" + ip
		count, _ := h.cache.Client.Incr(ctx, rlKey).Result()
		if count == 1 {
			h.cache.Client.Expire(context.Background(), rlKey, time.Minute)
		}
		if count > 20 {
			RespondError(w, r, http.StatusTooManyRequests, "Too many requests. Please try again later.", nil)
			return
		}
	}

	if !username.ValidateUsername(u) {
		RespondError(w, r, http.StatusBadRequest, "invalid username format", nil)
		return
	}
	cacheKey := "check_cache:" + u

	// Try cache first
	if h.cache != nil {
		if val, err := h.cache.Client.Get(ctx, cacheKey).Result(); err == nil {
			slog.Debug("Check cache hit", "username", u)
			h.jsonResponse(w, u, val)
			return
		}
	}

	// Singleflight to merge concurrent checks using DoChan to handle client disconnection
	ch := h.sfGroup.DoChan("check:"+u, func() (interface{}, error) {
		// Use detached context for backend queries in singleflight so client cancellation does not fail concurrent requests
		detachedCtx, cancelDetached := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelDetached()

		// Double check cache
		if h.cache != nil {
			if cachedVal, err := h.cache.Client.Get(detachedCtx, cacheKey).Result(); err == nil {
				return cachedVal, nil
			}
		}

		mtStatus, mtErr := h.mtprotoClient.CheckUsername(detachedCtx, u)
		if mtErr != nil {
			return "", mtErr
		}

		var finalStatus string
		switch mtStatus {
		case mtproto.StatusOccupied:
			finalStatus = "taken"
		case mtproto.StatusPurchase:
			finalStatus = "purchase_available"
		case mtproto.StatusAvailable:
			if username.IsBasicEligible(u) {
				finalStatus = "available"
			} else {
				finalStatus = "purchase_available"
			}
		default:
			finalStatus = string(mtStatus)
		}

		// Save to cache
		if h.cache != nil {
			h.cache.Client.Set(detachedCtx, cacheKey, finalStatus, 5*time.Minute)
		}

		return finalStatus, nil
	})

	var res singleflight.Result
	select {
	case <-ctx.Done():
		// Release HTTP handler immediately on client disconnect/context cancel
		return
	case res = <-ch:
	}

	if res.Err != nil {
		if res.Err == context.Canceled {
			w.WriteHeader(499)
			return
		}
		slog.Error("MTProto check failed", "username", u, "error", res.Err)
		RespondError(w, r, http.StatusInternalServerError, "failed to check username", res.Err)
		return
	}

	h.jsonResponse(w, u, res.Val.(string))
}

// getQuickAnalysisCachedOrFetch — Helper method to safely query QuickAnalysis with caching and singleflight
func (h *UsernameHandler) getQuickAnalysisCachedOrFetch(ctx context.Context, u string) ([]byte, error) {
	cacheKey := "quick:" + u
	if h.cache != nil {
		if val, err := h.cache.Client.Get(ctx, cacheKey).Result(); err == nil {
			return []byte(val), nil
		}
	}

	ch := h.sfGroup.DoChan("quick:"+u, func() (interface{}, error) {
		detachedCtx, cancelDetached := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelDetached()

		// Double check cache
		if h.cache != nil {
			if cachedVal, err := h.cache.Client.Get(detachedCtx, cacheKey).Result(); err == nil {
				return []byte(cachedVal), nil
			}
		}

		result, err := h.reportService.QuickAnalysis(detachedCtx, u, 0)
		if err != nil {
			return nil, err
		}

		mtStatus, mtErr := h.mtprotoClient.CheckUsername(detachedCtx, u)
		if mtErr != nil {
			return nil, fmt.Errorf("mtproto check failed: %w", mtErr)
		}

		// Resolve status deterministically
		switch mtStatus {
		case mtproto.StatusPurchase:
			result.Status = "purchase_available"
		case mtproto.StatusOccupied:
			result.Status = "taken"
		case mtproto.StatusAvailable:
			if username.IsBasicEligible(u) {
				result.Status = "available"
			} else {
				result.Status = "purchase_available"
			}
		default:
			result.Status = "taken"
		}

		data, err := json.Marshal(result)
		if err != nil {
			return nil, err
		}

		if h.cache != nil {
			h.cache.Client.Set(detachedCtx, cacheKey, data, 3*time.Minute)
		}

		return data, nil
	})

	var res singleflight.Result
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case res = <-ch:
	}

	if res.Err != nil {
		return nil, res.Err
	}
	return res.Val.([]byte), nil
}

// QuickAnalysis — Free endpoint returning rich preview data for ActionArea
func (h *UsernameHandler) QuickAnalysis(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		RespondError(w, r, http.StatusBadRequest, "missing username", nil)
		return
	}

	if !username.ValidateUsername(u) {
		RespondError(w, r, http.StatusBadRequest, "invalid username format", nil)
		return
	}

	ctx := r.Context()

	var userID int64
	if rawUser := ctx.Value(middleware.UserContextKey); rawUser != nil {
		if user, ok := rawUser.(map[string]interface{}); ok {
			if id, ok := user["id"].(int64); ok {
				userID = id
			} else if id, ok := user["id"].(float64); ok {
				userID = int64(id)
			}
		}
	}

	// Rate limit
	if h.cache != nil {
		ip := middleware.GetRealIP(r)
		rlKey := "rate_limit:quick:" + ip
		count, _ := h.cache.Client.Incr(ctx, rlKey).Result()
		if count == 1 {
			h.cache.Client.Expire(context.Background(), rlKey, time.Minute)
		}
		if count > 15 {
			RespondError(w, r, http.StatusTooManyRequests, "Too many requests", nil)
			return
		}
	}

	val, err := h.getQuickAnalysisCachedOrFetch(ctx, u)
	if err != nil {
		if err == context.Canceled {
			w.WriteHeader(499)
			return
		}
		RespondError(w, r, http.StatusInternalServerError, "failed to perform quick analysis", err)
		return
	}

	h.reportService.LogSearch(ctx, u, userID)

	w.Header().Set("Content-Type", "application/json")
	w.Write(val)
}

// StreamQuickAnalysis — SSE endpoint for real-time price and status updates
func (h *UsernameHandler) StreamQuickAnalysis(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		RespondError(w, r, http.StatusBadRequest, "missing username", nil)
		return
	}

	if !username.ValidateUsername(u) {
		RespondError(w, r, http.StatusBadRequest, "invalid username format", nil)
		return
	}

	ctx := r.Context()

	var userID int64
	if rawUser := ctx.Value(middleware.UserContextKey); rawUser != nil {
		if user, ok := rawUser.(map[string]interface{}); ok {
			if id, ok := user["id"].(int64); ok {
				userID = id
			} else if id, ok := user["id"].(float64); ok {
				userID = int64(id)
			}
		}
	}

	// Rate limit check for stream creation
	if h.cache != nil {
		ip := middleware.GetRealIP(r)
		rlKey := "rate_limit:stream:" + ip
		pipe := h.cache.Client.Pipeline()
		incrCmd := pipe.Incr(ctx, rlKey)
		pipe.Expire(ctx, rlKey, time.Minute)
		_, _ = pipe.Exec(ctx)
		if incrCmd.Val() > 10 {
			RespondError(w, r, http.StatusTooManyRequests, "Too many streaming requests. Please try again later.", nil)
			return
		}
	}

	h.reportService.LogSearch(ctx, u, userID)

	// Concurrent connections limit
	if h.activeStreams.Add(1) > 500 {
		h.activeStreams.Add(-1)
		RespondError(w, r, http.StatusServiceUnavailable, "stream capacity reached", nil)
		return
	}
	defer h.activeStreams.Add(-1)

	flusher, ok := w.(http.Flusher)
	if !ok {
		RespondError(w, r, http.StatusInternalServerError, "streaming unsupported", nil)
		return
	}

	// Set headers for Server-Sent Events
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	// Cap total connection lifetime to 5 minutes to prevent zombie leaks
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// Initial fetch
	if err := h.sendSSEUpdate(w, flusher, ctx, u); err != nil {
		RespondError(w, r, http.StatusInternalServerError, "stream start failed", err)
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Send ping heartbeat first to detect client disconnection
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}
			flusher.Flush()

			// Send the actual update
			if err := h.sendSSEUpdate(w, flusher, ctx, u); err != nil {
				return
			}
		}
	}
}

func (h *UsernameHandler) sendSSEUpdate(w http.ResponseWriter, flusher http.Flusher, ctx context.Context, u string) error {
	val, err := h.getQuickAnalysisCachedOrFetch(ctx, u)
	if err != nil {
		return err
	}

	if _, err := fmt.Fprintf(w, "data: %s\n\n", string(val)); err != nil {
		return err
	}
	flusher.Flush()
	return nil
}

func (h *UsernameHandler) jsonResponse(w http.ResponseWriter, u string, status string) {
	res := map[string]interface{}{
		"username": u,
		"status":   status,
	}
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// GetRates returns the cached TON-to-USD exchange rate
func (h *UsernameHandler) GetRates(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rateUSD, err := h.reportService.GetTONRate(ctx)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get ton rate", err)
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=60")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]float64{"ton_to_usd": rateUSD})
}

func (h *UsernameHandler) GetSimilar(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		RespondError(w, r, http.StatusBadRequest, "missing username", nil)
		return
	}
	if !username.ValidateUsername(u) {
		RespondError(w, r, http.StatusBadRequest, "invalid username format", nil)
		return
	}

	limit := 10
	if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err != nil || parsed < 1 || parsed > 25 {
			RespondError(w, r, http.StatusBadRequest, "invalid limit", nil)
			return
		}
		limit = parsed
	}

	results, err := h.reportService.FindSimilarUsernames(r.Context(), u, limit)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to find similar usernames", err)
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

const (
	// maxSimilarResults caps the "concept similar" list. Beyond this the card
	// turns into a scroll of low-signal rows.
	maxSimilarResults = 6
	// maxPortfolioItems caps the holder's other collectibles shown per report.
	maxPortfolioItems = 12
	// whaleMinHoldings is the number of verified collectibles in one wallet that
	// earns the "whale holder" badge.
	whaleMinHoldings = 5
)

// similarEvidenceRank scores how much verifiable market evidence a similar-username
// entry carries, so the strongest rows lead the list.
func similarEvidenceRank(s avm.ValuationSimilar) int {
	switch {
	case s.SalePrice > 0 && s.Status == "sold":
		return 4
	case s.SalePrice > 0 && (s.Status == "on_sale" || s.Status == "on_auction"):
		return 3
	case s.Status == "on_sale" || s.Status == "on_auction":
		return 2
	case s.Status == "taken":
		return 1
	default:
		return 0
	}
}

// portfolioItemValue returns the item's known TON value, or 0 when unpriced.
func portfolioItemValue(item avm.PortfolioItemDto) float64 {
	if item.LastSaleTON != nil {
		return *item.LastSaleTON
	}
	return 0
}

// Valuate performs an AVM (Automated Valuation Model) estimation for a username.
// Returns dual-denominated price range (TON + USD) with confidence score and audit run_id.
func (h *UsernameHandler) Valuate(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		RespondError(w, r, http.StatusBadRequest, "missing username", nil)
		return
	}

	if !username.ValidateUsername(u) {
		RespondError(w, r, http.StatusBadRequest, "invalid username format", nil)
		return
	}

	if h.avmService == nil {
		RespondError(w, r, http.StatusServiceUnavailable, "valuation service not available", nil)
		return
	}

	ctx := r.Context()
	cleanU := strings.ToLower(strings.TrimPrefix(u, "@"))

	userID, errUser := middleware.GetUserID(ctx)
	if errUser != nil || userID <= 0 {
		RespondError(w, r, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	// Verify user valuation access for this username (24h granted access or Pro quota)
	hasAccess := false
	isPro := false
	if h.cache != nil {
		if val, err := h.cache.Client.Get(ctx, fmt.Sprintf("user_val_pro:%d", userID)).Result(); err == nil && val == "true" {
			isPro = true
		}
	}
	if !isPro && h.db != nil {
		query := `SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'paid' AND (payload LIKE 'val_pro:%' OR amount = 249) AND created_at >= NOW() - INTERVAL '30 days'`
		var count int
		if err := h.db.Pool.QueryRow(ctx, query, userID).Scan(&count); err == nil && count > 0 {
			isPro = true
		}
	}

	if isPro {
		todayStr := time.Now().UTC().Format("2006-01-02")
		dailyKey := fmt.Sprintf("val_daily_used:%d:%s", userID, todayStr)
		dailyUsed := 0
		if h.cache != nil {
			if cntStr, err := h.cache.Client.Get(ctx, dailyKey).Result(); err == nil {
				dailyUsed, _ = strconv.Atoi(cntStr)
			}
		}
		if dailyUsed < 3 {
			hasAccess = true
			if h.cache != nil {
				cnt, _ := h.cache.Client.Incr(ctx, dailyKey).Result()
				if cnt == 1 {
					h.cache.Client.Expire(ctx, dailyKey, 24*time.Hour)
				}
			}
		}
	}

	if !hasAccess && h.cache != nil {
		accessKey := fmt.Sprintf("val_access:%d:%s", userID, cleanU)
		if val, err := h.cache.Client.Get(ctx, accessKey).Result(); err == nil && val != "" {
			hasAccess = true
		}
	}

	if !hasAccess && h.db != nil {
		paid, payMethod, err := h.db.HasPaidValuation(ctx, userID, cleanU)
		if err == nil && paid {
			hasAccess = true
			if h.cache != nil {
				h.cache.Client.Set(ctx, fmt.Sprintf("val_access:%d:%s", userID, cleanU), payMethod, 24*time.Hour)
			}
		}
	}

	if !hasAccess {
		RespondError(w, r, http.StatusForbidden, "Access denied. Valuation requires active Pro subscription or payment.", nil)
		return
	}

	// Redis Cache hit check (centralized version-bound key format)
	nocache := r.URL.Query().Get("nocache") == "true" || r.URL.Query().Get("refresh") == "true" || r.URL.Query().Get("force") == "true"
	valCacheKey := fmt.Sprintf("valuation:%s:%s", avm.ModelVersion, cleanU)
	if h.cache != nil && !nocache {
		if cachedData, err := h.cache.Client.Get(ctx, valCacheKey).Result(); err == nil && cachedData != "" {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache", "HIT")
			w.Write([]byte(cachedData))
			return
		}
	}

	// Rate limit: stricter than QuickAnalysis since valuation involves DB writes
	if h.cache != nil {
		ip := middleware.GetRealIP(r)
		rlKey := "rate_limit:valuate:" + ip
		count, _ := h.cache.Client.Incr(ctx, rlKey).Result()
		if count == 1 {
			h.cache.Client.Expire(context.Background(), rlKey, time.Minute)
		}
		if count > 10 {
			RespondError(w, r, http.StatusTooManyRequests, "Too many valuation requests", nil)
			return
		}
	}

	// Fetch TON/USD rate
	tonRate, err := h.reportService.GetTONRate(ctx)
	if err != nil {
		slog.Warn("AVM: TON rate fetch failed, using fallback", "error", err)
		tonRate = 7.25
	}

	result, err := h.avmService.Valuate(ctx, u, tonRate)
	if err != nil {
		slog.Error("AVM valuation failed", "username", u, "error", err)
		RespondError(w, r, http.StatusInternalServerError, "valuation failed", err)
		return
	}
	h.sendValuationNotification(r, u, result)

	// Fetch similar usernames, portfolio enrichment, and MTProto profile concurrently using errgroup
	gVal, gCtx := errgroup.WithContext(ctx)

	// 1. Fetch similar usernames (with status enrichment and deduplication)
	gVal.Go(func() error {
		lowerU := strings.ToLower(u)
		seen := map[string]bool{lowerU: true}

		merged := make([]avm.ValuationSimilar, 0, maxSimilarResults*2)
		for _, sim := range result.Similar {
			name := strings.ToLower(sim.Username)
			if name == "" || seen[name] {
				continue
			}
			seen[name] = true
			merged = append(merged, sim)
		}

		similars, _ := h.reportService.FindSimilarUsernames(gCtx, u, maxSimilarResults)
		for _, sim := range similars {
			simName := strings.ToLower(sim.Username)
			if simName == "" || seen[simName] {
				continue
			}
			seen[simName] = true

			status := sim.Status
			if status == "" && sim.SalePrice > 0 {
				status = "sold"
			}
			salePriceUSD := sim.SalePriceUSD
			if salePriceUSD == 0 && sim.SalePrice > 0 && tonRate > 0 {
				salePriceUSD = math.Round(sim.SalePrice*tonRate*100) / 100
			}

			merged = append(merged, avm.ValuationSimilar{
				Username:     sim.Username,
				Reason:       sim.Reason,
				Status:       status,
				SalePrice:    sim.SalePrice,
				SalePriceUSD: salePriceUSD,
				SaleDate:     sim.SaleDate,
				PriceSource:  sim.PriceSource,
			})
		}

		// Rank so that entries carrying real market evidence lead the list, then
		// trim: an unranked wall of ten mostly-empty rows was the main reason this
		// section read as noise.
		sort.SliceStable(merged, func(i, j int) bool {
			return similarEvidenceRank(merged[i]) > similarEvidenceRank(merged[j])
		})
		if len(merged) > maxSimilarResults {
			merged = merged[:maxSimilarResults]
		}

		// Resolve occupancy for the rows we are actually going to render. The
		// concept generator has no idea whether "auto" or "bitcoin" is registered,
		// and an unchecked default of "available" was the most visible wrong claim
		// on the card.
		var unresolved []string
		for _, sim := range merged {
			if sim.Status == "" {
				unresolved = append(unresolved, sim.Username)
			}
		}
		if len(unresolved) > 0 {
			statuses := h.reportService.ResolveOccupancy(gCtx, unresolved)
			for i := range merged {
				if merged[i].Status != "" {
					continue
				}
				if st, ok := statuses[strings.ToLower(merged[i].Username)]; ok {
					merged[i].Status = st
				}
			}
		}

		result.Similar = merged
		return nil
	})

	// 2. Populate Portfolio if OwnerAddress or latest buyer address exists
	gVal.Go(func() error {
		ownerAddr := result.History.OwnerAddress
		if (ownerAddr == "" || !tonapi.IsValidTONAddress(ownerAddr)) && len(result.History.Transactions) > 0 {
			buyer := result.History.Transactions[0].Buyer
			if tonapi.IsValidTONAddress(buyer) {
				ownerAddr = buyer
			} else {
				ownerAddr = ""
			}
		}
		if ownerAddr == "" || !tonapi.IsValidTONAddress(ownerAddr) || h.reportService == nil {
			return nil
		}

		lowerU := strings.ToLower(u)
		p, pErr := h.reportService.GetWalletPortfolio(gCtx, ownerAddr)
		var items []avm.PortfolioItemDto
		totalLastSaleTON := 0.0
		totalAcquisitionCostTON := 0.0
		estValueTON := 0.0
		pricedItems := 0
		unknownItems := 0

		if pErr == nil && p != nil && len(p.Items) > 0 {
			estValueTON = p.TotalValue
			for _, item := range p.Items {
				// The queried username is the subject of the report, not a
				// "other collectible in the same wallet" entry.
				if strings.EqualFold(item.Username, lowerU) {
					continue
				}

				var lastSaleTON *float64
				var lastSaleUSD *float64
				var lastSaleDate *string
				acquiredByOwner := false
				var acqCostTON *float64

				if item.SoldPrice > 0 {
					sPrice := item.SoldPrice
					sUSD := math.Round(sPrice * tonRate)
					lastSaleTON = &sPrice
					lastSaleUSD = &sUSD
					if item.SaleDate != "" {
						sDate := item.SaleDate
						lastSaleDate = &sDate
					}
					totalLastSaleTON += sPrice
					pricedItems++

					// An "on_sale" price is a live ask, not something the holder paid.
					if item.Status != "on_sale" {
						acquiredByOwner = true
						acqCostTON = lastSaleTON
						totalAcquisitionCostTON += sPrice
					}
				} else {
					unknownItems++
				}

				items = append(items, avm.PortfolioItemDto{
					Username:               item.Username,
					Status:                 item.Status,
					LastSaleTON:            lastSaleTON,
					LastSaleUSD:            lastSaleUSD,
					LastSaleDate:           lastSaleDate,
					SaleSource:             "fragment_history",
					AcquiredByCurrentOwner: acquiredByOwner,
					AcquisitionCostTON:     acqCostTON,
				})
			}
		}

		if len(items) == 0 {
			// Nothing verifiable in this wallet beyond the queried handle itself —
			// leave Portfolio nil so the client hides the section instead of
			// rendering placeholder totals.
			return nil
		}

		// Most valuable holdings first; unpriced items sink to the bottom.
		sort.SliceStable(items, func(i, j int) bool {
			return portfolioItemValue(items[i]) > portfolioItemValue(items[j])
		})
		if len(items) > maxPortfolioItems {
			items = items[:maxPortfolioItems]
		}

		result.Portfolio = &avm.PortfolioDto{
			OwnerAddress:            ownerAddr,
			TotalCount:              len(items),
			TotalLastSaleTON:        totalLastSaleTON,
			TotalLastSaleUSD:        math.Round(totalLastSaleTON * tonRate),
			TotalAcquisitionCostTON: totalAcquisitionCostTON,
			TotalEstValueTON:        math.Round(estValueTON),
			TotalEstValueUSD:        math.Round(estValueTON * tonRate),
			PricedItems:             pricedItems,
			UnknownItems:            unknownItems,
			Items:                   items,
		}
		return nil
	})

	// 3. Attach the model's measured track record (cached hourly, never blocking).
	gVal.Go(func() error {
		result.ModelAccuracy = h.avmService.GetModelAccuracy(gCtx)
		return nil
	})

	// 4. Populate OwnerProfile via MTProto if available (with 1s strict timeout)
	gVal.Go(func() error {
		if h.mtprotoClient != nil {
			mtCtx, mtCancel := context.WithTimeout(gCtx, 1000*time.Millisecond)
			defer mtCancel()
			resolved, err := h.mtprotoClient.ResolveUsername(mtCtx, u)
			if err == nil && resolved != nil {
				if pUser, ok := resolved.Peer.(*tg.PeerUser); ok {
					for _, uObj := range resolved.Users {
						if user, ok := uObj.(*tg.User); ok && user.ID == pUser.UserID {
							result.OwnerProfile = &avm.OwnerProfileDto{
								UserID:    user.ID,
								FirstName: user.FirstName,
								LastName:  user.LastName,
								Username:  user.Username,
								IsPremium: user.Premium,
								HasPhoto:  user.Photo != nil,
								PeerType:  "user",
							}
							break
						}
					}
				}
			}
		}
		return nil
	})

	_ = gVal.Wait()

	// Reconcile the wallet summary with what the on-chain lookup actually returned.
	// WalletInfo used to ship hardcoded counts ("12 NFTs" for any short handle),
	// which then drove the whale badge on the portfolio card.
	if result.WalletInfo != nil {
		holdings := 0
		if result.Portfolio != nil {
			holdings = result.Portfolio.TotalCount + 1 // + the queried username itself
		} else if result.History.OwnerAddress != "" {
			holdings = 1
		}
		result.WalletInfo.NFTCount = holdings
		if holdings >= whaleMinHoldings {
			result.WalletInfo.IsWhale = true
		}
	}

	outBytes, err := json.Marshal(result)
	if err == nil && h.cache != nil {
		h.cache.Client.Set(context.Background(), valCacheKey, outBytes, 10*time.Minute)
	}

	w.Header().Set("Content-Type", "application/json")
	if len(outBytes) > 0 {
		w.Write(outBytes)
	} else {
		json.NewEncoder(w).Encode(result)
	}
}

func (h *UsernameHandler) sendValuationNotification(r *http.Request, u string, result *avm.ValuationResult) {
	ctx := r.Context()
	initData := r.Header.Get("X-Telegram-Init-Data")
	userIDStr := "ناشناس"
	userIdent := "کاربر ناشناس"
	var parsedUserID int64

	if uid, err := middleware.GetUserID(ctx); err == nil && uid > 0 {
		parsedUserID = uid
		userIDStr = strconv.FormatInt(uid, 10)
	}

	if initData != "" {
		values, _ := url.ParseQuery(initData)
		userData := values.Get("user")
		if userData != "" {
			var userObj map[string]interface{}
			if err := json.Unmarshal([]byte(userData), &userObj); err == nil {
				if idVal, ok := userObj["id"]; ok {
					switch v := idVal.(type) {
					case float64:
						parsedUserID = int64(v)
						userIDStr = strconv.FormatInt(int64(v), 10)
					case int64:
						parsedUserID = v
						userIDStr = strconv.FormatInt(v, 10)
					}
				}
				if uName, ok := userObj["username"].(string); ok && uName != "" {
					userIdent = "@" + uName
				} else if first, ok := userObj["first_name"].(string); ok && first != "" {
					userIdent = first
				}
			}
		}
	}

	paymentMethodLabel := "❓ نامشخص"
	if parsedUserID > 0 {
		payMethod := ""
		if h.cache != nil {
			accessKey := fmt.Sprintf("val_access:%d:%s", parsedUserID, u)
			if val, err := h.cache.Client.Get(ctx, accessKey).Result(); err == nil && val != "" {
				payMethod = val
			}
		}
		if payMethod == "" && h.db != nil {
			paid, dbMethod, err := h.db.HasPaidValuation(ctx, parsedUserID, u)
			if err == nil && paid {
				payMethod = dbMethod
			}
		}

		switch payMethod {
		case "free":
			paymentMethodLabel = "🎁 هدیه عضویت (کانال و گروه)"
		case "coins":
			paymentMethodLabel = "🪙 پرداخت با سکه (88,000 FRG)"
		case "stars":
			paymentMethodLabel = "⭐️ استارز تلگرام (Telegram Stars)"
		case "credit":
			paymentMethodLabel = "⚡️ کردیت تحلیلی (Intel Credit)"
		case "owner":
			paymentMethodLabel = "👑 مالک سیستم / ادمین"
		default:
			if payMethod != "" {
				paymentMethodLabel = payMethod
			}
		}
	}

	miniAppURL := os.Getenv("MINI_APP_URL")
	if miniAppURL == "" {
		miniAppURL = "https://t.me/iFragmentBot/iFragment"
	}
	appLink := fmt.Sprintf("%s?startapp=username_%s", miniAppURL, u)
	fragmentLink := fmt.Sprintf("https://fragment.com/username/%s", u)

	badgeEmoji := "💎"
	if result.Rarity.Tier == "Exclusive" || result.Rarity.Tier == "Ultra Rare" {
		badgeEmoji = "🔥"
	}

	timeStr := time.Now().UTC().Format("15:04:05 UTC")

	msg := fmt.Sprintf(
		"╔════ 🔍 <b>ارزش‌گذاری هوشمند یوزرنیم (AVM)</b> ════╗\n\n"+
			"🆔 <b>یوزرنیم:</b> @%s\n"+
			"👤 <b>کاربر:</b> %s (<code>%s</code>)\n"+
			"💳 <b>نحوه دسترسی:</b> %s\n\n"+
			"📊 <b>تحلیل مالی AVM:</b>\n"+
			"├ 💰 <b>قیمت تخمینی:</b> <code>%s TON</code>\n"+
			"├ 💵 <b>معادل دلاری:</b> <code>$%s</code>\n"+
			"├ %s <b>سطح کمیابی:</b> <b>%s</b>\n"+
			"└ 🎯 <b>ضریب اطمینان:</b> <code>%d%%</code>\n\n"+
			"⏰ <b>زمان ثبت:</b> <code>%s</code>\n"+
			"╚════════════════════════════╝",
		telegram.EscapeHTML(u),
		telegram.EscapeHTML(userIdent), userIDStr,
		telegram.EscapeHTML(paymentMethodLabel),
		result.ExpectedTON.StringFixed(2),
		result.ExpectedUSD.StringFixed(2),
		badgeEmoji, telegram.EscapeHTML(result.Rarity.Tier),
		result.ConfidenceScore,
		timeStr,
	)

	var row []telegram.InlineButton
	row = append(row, telegram.InlineButton{Text: "🔎 مشاهده در مینی‌اپ", URL: appLink})
	row = append(row, telegram.InlineButton{Text: "🌐 فرگمنت", URL: fragmentLink})
	if parsedUserID > 0 {
		row = append(row, telegram.InlineButton{Text: "👤 کاربر", URL: fmt.Sprintf("tg://user?id=%d", parsedUserID)})
	}
	markup := telegram.BuildInlineKeyboard([][]telegram.InlineButton{row})

	notification.GetAdminNotifier().NotifyAVM(context.Background(), msg, markup)
}

func (h *UsernameHandler) Share(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Image string `json:"image"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	if payload.Image == "" {
		RespondError(w, r, http.StatusBadRequest, "missing image data", nil)
		return
	}

	// Remove base64 prefix if exists
	base64Data := payload.Image
	if idx := strings.Index(base64Data, ","); idx != -1 {
		base64Data = base64Data[idx+1:]
	}

	dec, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid base64 encoding", err)
		return
	}

	// Create static/shares dir if not exists
	dir := "./static/shares"
	if err := os.MkdirAll(dir, 0755); err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to create storage directory", err)
		return
	}

	fileID := uuid.New().String()
	filePath := fmt.Sprintf("%s/%s.png", dir, fileID)

	if err := os.WriteFile(filePath, dec, 0644); err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to save image file", err)
		return
	}

	// Build the public URL
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := r.Host
	publicURL := fmt.Sprintf("%s://%s/static/shares/%s.png", scheme, host, fileID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"url": publicURL,
	})
}

func (h *UsernameHandler) SendToChat(w http.ResponseWriter, r *http.Request) {
	// 1. Get authenticated user
	telegramID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "invalid user ID", err)
		return
	}

	// 2. Decode payload
	var payload struct {
		Image string `json:"image"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	if payload.Image == "" {
		RespondError(w, r, http.StatusBadRequest, "missing image data", nil)
		return
	}

	// Remove base64 prefix if exists
	base64Data := payload.Image
	if idx := strings.Index(base64Data, ","); idx != -1 {
		base64Data = base64Data[idx+1:]
	}

	dec, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid base64 encoding", err)
		return
	}

	// 3. Save to disk to get public URL
	dir := "./static/shares"
	if err := os.MkdirAll(dir, 0755); err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to create storage directory", err)
		return
	}

	fileID := uuid.New().String()
	filePath := fmt.Sprintf("%s/%s.png", dir, fileID)

	if err := os.WriteFile(filePath, dec, 0644); err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to save image file", err)
		return
	}

	// 4. Build the public URL
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := r.Host
	publicURL := fmt.Sprintf("%s://%s/static/shares/%s.png", scheme, host, fileID)

	// 5. Send to Telegram Chat
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		RespondError(w, r, http.StatusInternalServerError, "telegram bot token not configured", nil)
		return
	}

	tgClient := telegram.NewBotAPIClient(token)
	caption := "Here is your iFragment valuation card! 💎"
	_, err = tgClient.SendPhoto(r.Context(), telegramID, publicURL, caption, "HTML")
	if err != nil {
		slog.Error("Failed to send photo to user", "user_id", telegramID, "error", err)
		RespondError(w, r, http.StatusInternalServerError, "failed to send photo to chat", err)
		return
	}

	// 6. Return success
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{
		"success": true,
	})
}

func (h *UsernameHandler) GetPortfolio(w http.ResponseWriter, r *http.Request) {
	address := r.URL.Query().Get("address")
	if address == "" {
		RespondError(w, r, http.StatusBadRequest, "missing address parameter", nil)
		return
	}

	p, err := h.reportService.GetWalletPortfolio(r.Context(), address)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get wallet portfolio", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func (h *UsernameHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		RespondError(w, r, http.StatusBadRequest, "missing username parameter", nil)
		return
	}

	report, err := h.reportService.GenerateDeepReport(r.Context(), 0, u)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to fetch username history", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"username":        u,
		"owner_address":   report.OwnerAddress,
		"past_sales":      report.PastSales,
		"previous_owners": report.PreviousOwners,
	})
}

func (h *UsernameHandler) GetContact(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		RespondError(w, r, http.StatusBadRequest, "missing username parameter", nil)
		return
	}

	u = strings.TrimPrefix(u, "@")

	var profile avm.OwnerProfileDto
	profile.Username = u
	profile.PeerType = "unknown"

	if h.mtprotoClient != nil {
		resolved, err := h.mtprotoClient.ResolveUsername(r.Context(), u)
		if err == nil && resolved != nil {
			switch p := resolved.Peer.(type) {
			case *tg.PeerUser:
				profile.PeerType = "user"
				for _, uObj := range resolved.Users {
					if user, ok := uObj.(*tg.User); ok && user.ID == p.UserID {
						profile.UserID = user.ID
						profile.FirstName = user.FirstName
						profile.LastName = user.LastName
						profile.Username = user.Username
						profile.IsPremium = user.Premium
						profile.HasPhoto = user.Photo != nil
						break
					}
				}
			case *tg.PeerChannel:
				profile.PeerType = "channel"
			case *tg.PeerChat:
				profile.PeerType = "chat"
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}

func (h *UsernameHandler) checkTelegramMembership(ctx context.Context, userID int64) (inChannel bool, inGroup bool) {
	if userID <= 0 {
		return false, false
	}

	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if botToken == "" {
		botToken = os.Getenv("BOT_TOKEN")
	}

	if botToken == "" {
		if os.Getenv("APP_ENV") == "production" {
			return false, false
		}
		return true, true
	}

	tg := telegram.NewBotAPIClient(botToken)

	channelTarget := os.Getenv("OFFICIAL_CHANNEL_USERNAME")
	if channelTarget == "" {
		channelTarget = "@FragmentsCommunity"
	}
	if !strings.HasPrefix(channelTarget, "@") && !strings.HasPrefix(channelTarget, "-") {
		channelTarget = "@" + channelTarget
	}

	groupTarget := os.Getenv("OFFICIAL_GROUP_USERNAME")
	if groupTarget == "" {
		groupTarget = "@FragmentInvestors"
	}
	if !strings.HasPrefix(groupTarget, "@") && !strings.HasPrefix(groupTarget, "-") {
		groupTarget = "@" + groupTarget
	}

	inChannel = h.isMemberCached(ctx, tg, channelTarget, userID)
	inGroup = h.isMemberCached(ctx, tg, groupTarget, userID)

	return inChannel, inGroup
}

func (h *UsernameHandler) isMemberCached(ctx context.Context, tg *telegram.BotAPIClient, chatTarget string, userID int64) bool {
	cacheKey := fmt.Sprintf("tg_member:%s:%d", chatTarget, userID)
	if h.cache != nil {
		if val, err := h.cache.Client.Get(ctx, cacheKey).Result(); err == nil {
			return val == "true"
		}
	}

	status, err := tg.GetChatMember(ctx, chatTarget, userID)
	isMember := false
	if err == nil {
		s := strings.ToLower(status)
		if s == "creator" || s == "administrator" || s == "member" || s == "restricted" {
			isMember = true
		}
	} else {
		slog.Warn("Failed to check Telegram chat member status", "chat", chatTarget, "user_id", userID, "err", err)
	}

	if h.cache != nil {
		ttl := 3 * time.Minute
		if !isMember {
			ttl = 30 * time.Second
		}
		valStr := "false"
		if isMember {
			valStr = "true"
		}
		h.cache.Client.Set(ctx, cacheKey, valStr, ttl)
	}

	return isMember
}

type valuationPayRequest struct {
	Username        string `json:"username"`
	PackID          string `json:"pack_id,omitempty"`
	DiscountPercent int    `json:"discount_percent,omitempty"`
}

type valuationMonitorRequest struct {
	Username   string   `json:"username"`
	Enabled    bool     `json:"enabled"`
	AlertTypes []string `json:"alert_types"`
}

func (h *UsernameHandler) ValuationAccess(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		RespondError(w, r, http.StatusBadRequest, "missing username", nil)
		return
	}
	u = strings.ToLower(strings.TrimPrefix(u, "@"))
	ctx := r.Context()
	userID, _ := middleware.GetUserID(ctx)

	hasAccess := false
	method := ""
	isPro := false
	dailyUsed := 0
	const dailyLimit = 3
	firstReportDiscountEligible := true
	isMonitored := false

	// 1. Check if user has active Pro pass
	if userID > 0 && h.cache != nil {
		if val, err := h.cache.Client.Get(ctx, fmt.Sprintf("user_val_pro:%d", userID)).Result(); err == nil && val == "true" {
			isPro = true
		}
	}
	if !isPro && userID > 0 && h.db != nil {
		query := `SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'paid' AND (payload LIKE 'val_pro:%' OR amount = 249) AND created_at >= NOW() - INTERVAL '30 days'`
		var count int
		if err := h.db.Pool.QueryRow(ctx, query, userID).Scan(&count); err == nil && count > 0 {
			isPro = true
			if h.cache != nil {
				h.cache.Client.Set(ctx, fmt.Sprintf("user_val_pro:%d", userID), "true", 24*time.Hour)
			}
		}
	}

	if isPro && userID > 0 && h.cache != nil {
		todayStr := time.Now().UTC().Format("2006-01-02")
		dailyKey := fmt.Sprintf("val_daily_used:%d:%s", userID, todayStr)
		if cntStr, err := h.cache.Client.Get(ctx, dailyKey).Result(); err == nil {
			dailyUsed, _ = strconv.Atoi(cntStr)
		}
		if dailyUsed < dailyLimit {
			hasAccess = true
			method = "pro"
		}
	}

	// 2. Check cached single access
	if !hasAccess && userID > 0 && h.cache != nil {
		accessKey := fmt.Sprintf("val_access:%d:%s", userID, u)
		if val, err := h.cache.Client.Get(ctx, accessKey).Result(); err == nil && val != "" {
			hasAccess = true
			method = val
		}
	}

	if !hasAccess && userID > 0 && h.db != nil {
		paid, payMethod, err := h.db.HasPaidValuation(ctx, userID, u)
		if err == nil && paid {
			hasAccess = true
			method = payMethod
			if h.cache != nil {
				h.cache.Client.Set(ctx, fmt.Sprintf("val_access:%d:%s", userID, u), payMethod, 24*time.Hour)
			}
		}
	}

	freeQuotaUsed := false
	if userID > 0 {
		if h.cache != nil {
			if val, err := h.cache.Client.Get(ctx, fmt.Sprintf("val_free_used:%d", userID)).Result(); err == nil && val == "true" {
				freeQuotaUsed = true
			}
		}
		if !freeQuotaUsed && h.db != nil {
			used, err := h.db.HasUsedFreeValuationQuota(ctx, userID)
			if err == nil && used {
				freeQuotaUsed = true
				if h.cache != nil {
					h.cache.Client.Set(ctx, fmt.Sprintf("val_free_used:%d", userID), "true", 30*24*time.Hour)
				}
			}
		}
		// Check if eligible for first report discount (has user bought any valuation order before?)
		if h.db != nil {
			var orderCount int
			_ = h.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'paid' AND starts_with(payload, 'val_')`, userID).Scan(&orderCount)
			if orderCount > 0 {
				firstReportDiscountEligible = false
			}
		}
		if h.cache != nil {
			monVal, err := h.cache.Client.Get(ctx, fmt.Sprintf("val_monitor:%d:%s", userID, u)).Result()
			if err == nil && monVal == "true" {
				isMonitored = true
			}
		}
	}

	inChannel, inGroup := h.checkTelegramMembership(ctx, userID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"has_access":                      hasAccess,
		"method":                          method,
		"is_pro":                          isPro,
		"daily_used":                      dailyUsed,
		"daily_limit":                     dailyLimit,
		"free_quota_used":                 freeQuotaUsed,
		"first_report_discount_eligible":  firstReportDiscountEligible,
		"is_monitored":                    isMonitored,
		"in_channel":                      inChannel,
		"in_group":                        inGroup,
	})
}

func (h *UsernameHandler) ValuationOrderStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, errUser := middleware.GetUserID(ctx)
	if errUser != nil || userID <= 0 {
		RespondError(w, r, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	payload := r.URL.Query().Get("payload")
	u := strings.ToLower(strings.TrimPrefix(r.URL.Query().Get("u"), "@"))

	isPaid := false
	status := "pending"

	if payload != "" && h.db != nil {
		order, err := h.db.GetOrderByPayload(ctx, payload)
		if err == nil && order != nil {
			status = order.Status
			if order.Status == "paid" {
				isPaid = true
			}
		}
	}

	if !isPaid && u != "" && h.db != nil {
		paid, _, err := h.db.HasPaidValuation(ctx, userID, u)
		if err == nil && paid {
			isPaid = true
			status = "paid"
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"paid":   isPaid,
		"status": status,
	})
}

func (h *UsernameHandler) ValuationPayAirdrop(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, errUser := middleware.GetUserID(ctx)
	if errUser != nil || userID <= 0 {
		RespondError(w, r, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	var req valuationPayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Username == "" {
		RespondError(w, r, http.StatusBadRequest, "Invalid request body", nil)
		return
	}
	u := strings.ToLower(strings.TrimPrefix(req.Username, "@"))

	if h.db == nil {
		RespondError(w, r, http.StatusServiceUnavailable, "Database unavailable", nil)
		return
	}

	// 1. Check if user has free valuation report credits from referral invites (1 per 3 frens)
	var totalInvited int
	_ = h.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE referred_by = $1`, userID).Scan(&totalInvited)
	freeCreditsTotal := totalInvited / 3

	var creditsUsed int
	_ = h.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'paid' AND payload LIKE 'val_credit:%'`, userID).Scan(&creditsUsed)

	useFreeCredit := (freeCreditsTotal > creditsUsed)

	if useFreeCredit {
		payload := fmt.Sprintf("val_credit:%s:%d:%d", u, userID, time.Now().Unix())
		_, _ = h.db.CreateOrder(ctx, repository.Order{
			UserID:  userID,
			Amount:  0,
			Status:  "paid",
			Payload: payload,
		})

		if h.cache != nil {
			h.cache.Client.Set(ctx, fmt.Sprintf("val_access:%d:%s", userID, u), "credit", 24*time.Hour)
		}

		profile, _ := h.db.GetProfileStats(ctx, userID)
		currentBalance := 0.0
		if profile != nil {
			currentBalance = profile.AirdropCoins
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":         true,
			"method":          "free_credit",
			"remaining_coins": currentBalance,
		})
		return
	}

	// 2. Economic Formula: P_report = 10 * E (with E=1500 -> 15,000 coins)
	// First report discount = 50% (7,500 coins)
	priceFRG := 15000.0
	var prevOrders int
	_ = h.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'paid' AND starts_with(payload, 'val_')`, userID).Scan(&prevOrders)
	if prevOrders == 0 {
		priceFRG = 7500.0
	}

	profile, err := h.db.GetProfileStats(ctx, userID)
	if err != nil || profile == nil || profile.AirdropCoins < priceFRG {
		currentBalance := 0.0
		if profile != nil {
			currentBalance = profile.AirdropCoins
		}
		RespondError(w, r, http.StatusBadRequest, fmt.Sprintf("Insufficient coin balance. Required: %.0f FRG (You have %.0f)", priceFRG, currentBalance), nil)
		return
	}

	// 3. FIFO Deductions inside locked database transaction (Sacred Rule #4)
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to begin transaction", err)
		return
	}
	defer tx.Rollback(ctx)

	err = h.db.DeductCreditsFIFO(ctx, tx, userID, priceFRG)
	if err != nil {
		slog.Error("FIFO deduction failed for valuation report", "user_id", userID, "err", err)
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	_, err = tx.Exec(ctx, `
		UPDATE user_stats
		SET airdrop_coins = airdrop_coins - $1
		WHERE user_id = $2 AND airdrop_coins >= $1
	`, priceFRG, userID)
	if err != nil {
		slog.Error("Failed to update user_stats airdrop_coins", "user_id", userID, "err", err)
		RespondError(w, r, http.StatusInternalServerError, "Failed to update balance", err)
		return
	}

	payload := fmt.Sprintf("val_coins:%s:%d:%d", u, userID, time.Now().Unix())
	_, err = tx.Exec(ctx, `
		INSERT INTO orders (user_id, amount, status, payload, created_at)
		VALUES ($1, $2, 'paid', $3, CURRENT_TIMESTAMP)
	`, userID, int(priceFRG), payload)
	if err != nil {
		slog.Error("Failed to record valuation order", "user_id", userID, "err", err)
		RespondError(w, r, http.StatusInternalServerError, "Failed to record order", err)
		return
	}

	if err = tx.Commit(ctx); err != nil {
		slog.Error("Failed to commit valuation transaction", "user_id", userID, "err", err)
		RespondError(w, r, http.StatusInternalServerError, "Transaction commit failed", err)
		return
	}

	if h.cache != nil {
		h.cache.Client.Set(ctx, fmt.Sprintf("val_access:%d:%s", userID, u), "coins", 24*time.Hour)
		h.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	updatedProfile, _ := h.db.GetProfileStats(ctx, userID)
	remainingCoins := 0.0
	if updatedProfile != nil {
		remainingCoins = updatedProfile.AirdropCoins
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":         true,
		"method":          "coins",
		"remaining_coins": remainingCoins,
	})
}

func (h *UsernameHandler) ValuationPayStars(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, errUser := middleware.GetUserID(ctx)
	if errUser != nil || userID <= 0 {
		RespondError(w, r, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	var req valuationPayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Username = ""
	}

	if h.starsService == nil {
		RespondError(w, r, http.StatusServiceUnavailable, "Stars payment service unavailable", nil)
		return
	}

	finalStars := 100
	title := "⭐️ iFragment Starter Intel Pack (3 Credits)"
	description := "3 Deep Valuation Reports for Telegram Usernames, Numbers & Gifts"
	payload := fmt.Sprintf("val_credits:3:%d:%d", userID, time.Now().Unix())

	switch req.PackID {
	case "pack_value_10":
		finalStars = 250
		title = "⭐️ iFragment Pro Analyst Pack (10 Credits)"
		description = "10 Deep Valuation Reports for Telegram Usernames, Numbers & Gifts (25% Savings)"
		payload = fmt.Sprintf("val_credits:10:%d:%d", userID, time.Now().Unix())
	case "pro":
		finalStars = 249
		title = "👑 iFragment Pro Analyst Pass (30 Days)"
		description = "3 Daily Deep Valuations + 2x Coin Earning + Digital Appraisal Certificate"
		payload = fmt.Sprintf("val_pro:%d:%d:0", userID, time.Now().Unix())
	}

	invoiceLink, err := h.starsService.CreateInvoiceLink(
		title,
		description,
		payload,
		finalStars,
	)
	if err != nil {
		slog.Error("Failed to create Stars invoice", "user_id", userID, "err", err)
		RespondError(w, r, http.StatusInternalServerError, "Failed to generate Stars invoice", nil)
		return
	}

	if h.db != nil {
		_, _ = h.db.CreateOrder(ctx, repository.Order{
			UserID:  userID,
			Amount:  finalStars,
			Status:  "pending",
			Payload: payload,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"invoice_link": invoiceLink,
		"payload":      payload,
		"final_stars":  finalStars,
	})
}

func (h *UsernameHandler) ValuationVerifyFree(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, errUser := middleware.GetUserID(ctx)
	if errUser != nil || userID <= 0 {
		RespondError(w, r, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	var req valuationPayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Username == "" {
		RespondError(w, r, http.StatusBadRequest, "Invalid request body", nil)
		return
	}
	u := strings.ToLower(strings.TrimPrefix(req.Username, "@"))

	if h.db != nil {
		used, err := h.db.HasUsedFreeValuationQuota(ctx, userID)
		if err == nil && used {
			RespondError(w, r, http.StatusBadRequest, "Free valuation quota has already been used", nil)
			return
		}
	}

	inChannel, inGroup := h.checkTelegramMembership(ctx, userID)
	if !inChannel || !inGroup {
		RespondError(w, r, http.StatusBadRequest, fmt.Sprintf("Must join both official channel and group first (in_channel=%v, in_group=%v)", inChannel, inGroup), nil)
		return
	}

	if h.cache != nil {
		h.cache.Client.Set(ctx, fmt.Sprintf("val_free_used:%d", userID), "true", 30*24*time.Hour)
		h.cache.Client.Set(ctx, fmt.Sprintf("val_access:%d:%s", userID, u), "free", 24*time.Hour)
	}

	if h.db != nil {
		payload := fmt.Sprintf("val_free:%d:%s:%d", userID, u, time.Now().Unix())
		_, _ = h.db.CreateOrder(ctx, repository.Order{
			UserID:  userID,
			Amount:  0,
			Status:  "paid",
			Payload: payload,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"has_access": true,
		"in_channel": true,
		"in_group":   true,
	})
}

func (h *UsernameHandler) ValuationMonitor(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, errUser := middleware.GetUserID(ctx)
	if errUser != nil || userID <= 0 {
		RespondError(w, r, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	var req valuationMonitorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Username == "" {
		RespondError(w, r, http.StatusBadRequest, "Invalid request body", nil)
		return
	}
	u := strings.ToLower(strings.TrimPrefix(req.Username, "@"))

	// Strict requirement: User MUST have purchased valuation report for this username
	hasAccess := false
	if h.db != nil {
		paid, _, err := h.db.HasPaidValuation(ctx, userID, u)
		if err == nil && paid {
			hasAccess = true
		}
	}
	if !hasAccess && h.cache != nil {
		if val, err := h.cache.Client.Get(ctx, fmt.Sprintf("val_access:%d:%s", userID, u)).Result(); err == nil && val != "" {
			hasAccess = true
		}
	}

	if !hasAccess {
		RespondError(w, r, http.StatusForbidden, "Monitoring is only available for usernames with a purchased report", nil)
		return
	}

	if h.cache != nil {
		val := "false"
		if req.Enabled {
			val = "true"
		}
		h.cache.Client.Set(ctx, fmt.Sprintf("val_monitor:%d:%s", userID, u), val, 90*24*time.Hour)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"is_monitored": req.Enabled,
	})
}

// GetOrderStatus returns the payment status for an order ID
func (h *UsernameHandler) GetOrderStatus(w http.ResponseWriter, r *http.Request) {
	orderIDStr := chi.URLParam(r, "id")
	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid order UUID format", err)
		return
	}

	order, err := h.db.GetOrderByID(r.Context(), orderID)
	if err != nil || order == nil {
		RespondError(w, r, http.StatusNotFound, "Order not found", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"id":      order.ID.String(),
		"user_id": order.UserID,
		"status":  order.Status,
		"amount":  order.Amount,
		"payload": order.Payload,
	})
}

// GetOrderStatusByPayload returns the payment status for an order by payload
func (h *UsernameHandler) GetOrderStatusByPayload(w http.ResponseWriter, r *http.Request) {
	payload := chi.URLParam(r, "payload")
	if payload == "" {
		RespondError(w, r, http.StatusBadRequest, "Payload cannot be empty", nil)
		return
	}

	order, err := h.db.GetOrderByPayload(r.Context(), payload)
	if err != nil || order == nil {
		RespondError(w, r, http.StatusNotFound, "Order not found", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"id":      order.ID.String(),
		"user_id": order.UserID,
		"status":  order.Status,
		"amount":  order.Amount,
		"payload": order.Payload,
	})
}

// GetAVMCalibration returns empirical calibration metrics and evaluation summary for AVM v7.0.
func (h *UsernameHandler) GetAVMCalibration(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	summary, err := h.avmService.GetCalibrationSummary(ctx)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get calibration summary", err)
		return
	}
	RespondJSON(w, http.StatusOK, summary)
}


