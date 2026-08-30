package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/service/numbers"
)

type NumbersHandler struct {
	service *numbers.NumbersService
}

func NewNumbersHandler(service *numbers.NumbersService) *NumbersHandler {
	return &NumbersHandler{service: service}
}

// GetIntel returns the free market intelligence dashboard
func (h *NumbersHandler) GetIntel(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	intel, err := h.service.GetNumbersIntel(ctx)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to load numbers intel", nil)
		return
	}
	RespondJSON(w, http.StatusOK, intel)
}

// Verify checks whether a number exists and was minted in the 136,566 Telegram collection
func (h *NumbersHandler) Verify(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	number := r.URL.Query().Get("n")
	if number == "" {
		RespondError(w, r, http.StatusBadRequest, "number parameter 'n' is required", nil)
		return
	}

	result, err := h.service.VerifyNumber(ctx, number)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "verification failed", err)
		return
	}
	RespondJSON(w, http.StatusOK, result)
}

// GetCuriosityGate returns curiosity counters without price leakage (Sacred Rule 3)
func (h *NumbersHandler) GetCuriosityGate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	number := r.URL.Query().Get("n")
	if number == "" {
		RespondError(w, r, http.StatusBadRequest, "number parameter 'n' is required", nil)
		return
	}

	gate, err := h.service.GetCuriosityGate(ctx, number)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid number format", err)
		return
	}
	RespondJSON(w, http.StatusOK, gate)
}

// Valuate computes or fetches the cached 24h valuation report
func (h *NumbersHandler) Valuate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	number := r.URL.Query().Get("n")
	if number == "" {
		RespondError(w, r, http.StatusBadRequest, "number parameter 'n' is required", nil)
		return
	}

	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}
	val, err := h.service.ValuateNumber(ctx, userID, number)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "valuation failed", err)
		return
	}
	RespondJSON(w, http.StatusOK, val)
}

// UnlockWithCoins unlocks report with Airdrop Coins
func (h *NumbersHandler) UnlockWithCoins(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		Number string `json:"number"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Number == "" {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", nil)
		return
	}

	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}
	val, err := h.service.UnlockWithCoins(ctx, userID, req.Number)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "failed to unlock with coins", err)
		return
	}
	RespondJSON(w, http.StatusOK, val)
}

// UnlockWithCredit unlocks report with 1 Intel Credit
func (h *NumbersHandler) UnlockWithCredit(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		Number string `json:"number"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Number == "" {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", nil)
		return
	}

	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}
	val, err := h.service.UnlockWithCredit(ctx, userID, req.Number)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "failed to unlock with credit", err)
		return
	}
	RespondJSON(w, http.StatusOK, val)
}

// ToggleWatchlist enables notifications only if report was purchased (Sacred Rule 4)
func (h *NumbersHandler) ToggleWatchlist(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		Number string `json:"number"`
		Enable bool   `json:"enable"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Number == "" {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", nil)
		return
	}

	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}
	err = h.service.ToggleWatchlist(ctx, userID, req.Number, req.Enable)
	if err != nil {
		if err == numbers.ErrReportNotPurchased {
			RespondError(w, r, http.StatusForbidden, "must purchase report before watching", nil)
			return
		}
		RespondError(w, r, http.StatusInternalServerError, "failed to update watchlist", nil)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"number":  req.Number,
		"enabled": req.Enable,
	})
}

// GetWatchlist returns all watched numbers for the authenticated user
func (h *NumbersHandler) GetWatchlist(w http.ResponseWriter, r *http.Request) {
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

// SearchMask performs fast mask pattern query for the Mask Builder (<150ms p95)
func (h *NumbersHandler) SearchMask(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	pattern := r.URL.Query().Get("q")
	if pattern == "" {
		pattern = "+888 8888 ****"
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	results, err := h.service.SearchMask(ctx, pattern, limit, offset)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to execute mask search", nil)
		return
	}
	RespondJSON(w, http.StatusOK, results)
}

// GetDeals returns top undervalued arbitrage deals
func (h *NumbersHandler) GetDeals(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	deals, err := h.service.GetDealsSniper(ctx)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to fetch deals", nil)
		return
	}
	RespondJSON(w, http.StatusOK, deals)
}

// GetClubs returns curated collectible categories with floor prices
func (h *NumbersHandler) GetClubs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	clubs, err := h.service.GetCategoryClubs(ctx)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to fetch category clubs", nil)
		return
	}
	RespondJSON(w, http.StatusOK, clubs)
}

// ScanPortfolio scans an owner's wallet and computes total portfolio value
func (h *NumbersHandler) ScanPortfolio(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	address := r.URL.Query().Get("address")
	if address == "" {
		RespondError(w, r, http.StatusBadRequest, "query parameter 'address' is required", nil)
		return
	}

	result, err := h.service.ScanWalletPortfolio(ctx, address)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to scan portfolio", err)
		return
	}
	RespondJSON(w, http.StatusOK, result)
}

// GetLiveActivity returns the recent sales activity stream
func (h *NumbersHandler) GetLiveActivity(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	activity, err := h.service.GetLiveActivityTicker(ctx)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to fetch activity ticker", nil)
		return
	}
	RespondJSON(w, http.StatusOK, activity)
}

// GetChartData returns on-chain historical price and volume data for TradingView charts
func (h *NumbersHandler) GetChartData(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	chartData, err := h.service.GetChartData(ctx)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to fetch chart data", err)
		return
	}
	RespondJSON(w, http.StatusOK, chartData)
}


