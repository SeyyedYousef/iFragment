package handler

import (
	"net/http"

	"ifragment-backend/internal/repository"
)

type InvestorsPublicHandler struct {
	settingsRepo *repository.SettingsRepo
}

func NewInvestorsPublicHandler(settingsRepo *repository.SettingsRepo) *InvestorsPublicHandler {
	return &InvestorsPublicHandler{
		settingsRepo: settingsRepo,
	}
}

func (h *InvestorsPublicHandler) GetInvestorsPage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "public, max-age=60, stale-while-revalidate=300")

	if h.settingsRepo == nil {
		RespondJSON(w, http.StatusOK, map[string]interface{}{
			"image_url":  "",
			"updated_at": nil,
		})
		return
	}

	cfg, err := h.settingsRepo.GetInvestorsPageConfig(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to load investors page configuration", err)
		return
	}

	RespondJSON(w, http.StatusOK, cfg)
}
