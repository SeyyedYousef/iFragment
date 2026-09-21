package handler

import (
	"net/http"

	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cryptoprice"
)

type CollectionHandler struct {
	repo        *repository.CollectionRepo
	cryptoPrice *cryptoprice.CryptoPriceService
}

func NewCollectionHandler(repo *repository.CollectionRepo, cryptoPrice *cryptoprice.CryptoPriceService) *CollectionHandler {
	return &CollectionHandler{
		repo:        repo,
		cryptoPrice: cryptoPrice,
	}
}

func (h *CollectionHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	data, err := h.repo.GetLatestCollectionData(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to fetch collection data", err)
		return
	}

	if data == nil {
		RespondJSON(w, http.StatusOK, map[string]interface{}{"status": "pending", "message": "No data collected yet"})
		return
	}

	// Enrich with live TON/USD rate from CryptoPriceService if available
	if h.cryptoPrice != nil {
		if rate, ok, isStale, fetchedAt := h.cryptoPrice.GetPriceWithFreshness("the-open-network"); ok && rate > 0 {
			data.FX = &repository.FXRateInfo{
				TonUsd:     rate,
				Source:     "TonAPI / CoinGecko",
				ObservedAt: fetchedAt,
				IsStale:    isStale,
			}
		}
	}

	RespondJSON(w, http.StatusOK, data)
}

func (h *CollectionHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	tf := r.URL.Query().Get("timeframe")
	if tf == "" {
		tf = "30d"
	}

	points, err := h.repo.GetCollectionHistory(r.Context(), tf)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to fetch collection history", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"timeframe": tf,
		"points":    points,
	})
}
