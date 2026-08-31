package handler

import (
	"encoding/json"
	"net/http"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/service/gifts"
	"ifragment-backend/internal/service/gifts/crafting"
)

type GiftsHandler struct {
	service *gifts.GiftsService
}

func NewGiftsHandler(service *gifts.GiftsService) *GiftsHandler {
	return &GiftsHandler{service: service}
}

// GetIntel returns the free market intelligence overview
func (h *GiftsHandler) GetIntel(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	intel, err := h.service.GetGiftsIntel(ctx)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to load gifts intel", nil)
		return
	}
	RespondJSON(w, http.StatusOK, intel)
}

// GetCuriosityGate returns curiosity counters without price leakage (Sacred Rule 3)
func (h *GiftsHandler) GetCuriosityGate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	giftID := r.URL.Query().Get("g")
	if giftID == "" {
		RespondError(w, r, http.StatusBadRequest, "gift parameter 'g' is required", nil)
		return
	}

	gate, err := h.service.GetCuriosityGate(ctx, giftID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid gift format", err)
		return
	}
	RespondJSON(w, http.StatusOK, gate)
}

// Valuate computes or fetches the cached 24h valuation report
func (h *GiftsHandler) Valuate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	giftID := r.URL.Query().Get("g")
	if giftID == "" {
		RespondError(w, r, http.StatusBadRequest, "gift parameter 'g' is required", nil)
		return
	}

	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	val, err := h.service.ValuateGift(ctx, userID, giftID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "gift valuation failed", err)
		return
	}
	RespondJSON(w, http.StatusOK, val)
}

// UnlockWithCoins unlocks report with Airdrop Coins
func (h *GiftsHandler) UnlockWithCoins(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		GiftID string `json:"gift_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.GiftID == "" {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", nil)
		return
	}

	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	val, err := h.service.UnlockWithCoins(ctx, userID, req.GiftID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "failed to unlock gift report with coins", err)
		return
	}
	RespondJSON(w, http.StatusOK, val)
}

// UnlockWithCredit unlocks report with 1 Intel Credit
func (h *GiftsHandler) UnlockWithCredit(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		GiftID string `json:"gift_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.GiftID == "" {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", nil)
		return
	}

	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	val, err := h.service.UnlockWithCredit(ctx, userID, req.GiftID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "failed to unlock gift report with credit", err)
		return
	}
	RespondJSON(w, http.StatusOK, val)
}

// CalculateCraftingEV runs public crafting EV simulation
func (h *GiftsHandler) CalculateCraftingEV(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		Inputs []crafting.CraftInputItem `json:"inputs"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Inputs) == 0 {
		RespondError(w, r, http.StatusBadRequest, "invalid crafting inputs", nil)
		return
	}

	res, err := h.service.CalculateCraftingEV(ctx, req.Inputs)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}
	RespondJSON(w, http.StatusOK, res)
}

// GetUpgradeAdvice returns upgrade pricing and timing recommendations
func (h *GiftsHandler) GetUpgradeAdvice(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	giftID := r.URL.Query().Get("g")
	if giftID == "" {
		RespondError(w, r, http.StatusBadRequest, "gift parameter 'g' is required", nil)
		return
	}

	res, err := h.service.GetUpgradeAdvice(ctx, giftID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "failed to load upgrade advice", err)
		return
	}
	RespondJSON(w, http.StatusOK, res)
}

// ScanPortfolio scans user gift inventory
func (h *GiftsHandler) ScanPortfolio(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	username := r.URL.Query().Get("u")
	if username == "" {
		RespondError(w, r, http.StatusBadRequest, "username parameter 'u' is required", nil)
		return
	}

	res, err := h.service.ScanPortfolio(ctx, username)
	if err != nil {
		if err == gifts.ErrPortfolioRateLimited {
			RespondError(w, r, http.StatusTooManyRequests, "portfolio scan rate limited (try again in 10 minutes)", nil)
			return
		}
		RespondError(w, r, http.StatusInternalServerError, "failed to scan portfolio", err)
		return
	}
	RespondJSON(w, http.StatusOK, res)
}

// ToggleWatchlist toggles post-purchase watchlist (Sacred Rule 4)
func (h *GiftsHandler) ToggleWatchlist(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		GiftID string `json:"gift_id"`
		Enable bool   `json:"enable"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.GiftID == "" {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", nil)
		return
	}

	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	err = h.service.ToggleWatchlist(ctx, userID, req.GiftID, req.Enable)
	if err != nil {
		if err == gifts.ErrReportNotPurchased {
			RespondError(w, r, http.StatusForbidden, "must purchase report before watching", nil)
			return
		}
		RespondError(w, r, http.StatusInternalServerError, "failed to update watchlist", nil)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"gift_id": req.GiftID,
		"enabled": req.Enable,
	})
}

// GetWatchlist returns all watched gifts
func (h *GiftsHandler) GetWatchlist(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	items, err := h.service.GetWatchlist(ctx, userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to fetch watchlist", nil)
		return
	}
	RespondJSON(w, http.StatusOK, items)
}

// ListCollections returns available gift collections
func (h *GiftsHandler) ListCollections(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	list, err := h.service.ListCollections(ctx)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to list collections", err)
		return
	}
	RespondJSON(w, http.StatusOK, list)
}

// GetCollectionIntel returns deep analytics for a gift collection
func (h *GiftsHandler) GetCollectionIntel(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	slug := r.URL.Query().Get("c")
	if slug == "" {
		slug = "plush_pepe"
	}

	data, err := h.service.GetCollectionIntel(ctx, slug)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to fetch collection intelligence", err)
		return
	}
	RespondJSON(w, http.StatusOK, data)
}

// GetEnrichedReport returns single gift valuation with provenance & on-chain info
func (h *GiftsHandler) GetEnrichedReport(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	giftID := r.URL.Query().Get("g")
	if giftID == "" {
		RespondError(w, r, http.StatusBadRequest, "gift parameter 'g' is required", nil)
		return
	}

	userID, _ := middleware.GetUserID(ctx)
	report, err := h.service.GetEnrichedReport(ctx, userID, giftID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to generate enriched gift report", err)
		return
	}
	RespondJSON(w, http.StatusOK, report)
}
