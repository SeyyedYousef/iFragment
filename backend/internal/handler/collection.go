package handler

import (
	"net/http"

	"ifragment-backend/internal/repository"
)

type CollectionHandler struct {
	repo *repository.CollectionRepo
}

func NewCollectionHandler(repo *repository.CollectionRepo) *CollectionHandler {
	return &CollectionHandler{repo: repo}
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

	RespondJSON(w, http.StatusOK, data)
}
