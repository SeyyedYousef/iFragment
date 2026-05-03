package handler

import (
	"encoding/json"
	"ifragment-backend/internal/client/fragment"
	"ifragment-backend/internal/service/username"
	"net/http"
)

type UsernameHandler struct {
	service        *username.AggregatorService
	fragmentClient *fragment.Client
}

func NewUsernameHandler(s *username.AggregatorService, f *fragment.Client) *UsernameHandler {
	return &UsernameHandler{
		service:        s,
		fragmentClient: f,
	}
}

func (h *UsernameHandler) GetCollectionStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.service.GetCollectionStats()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func (h *UsernameHandler) CheckAvailability(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		http.Error(w, "missing username", http.StatusBadRequest)
		return
	}

	if !username.ValidateUsername(u) {
		http.Error(w, "invalid username format", http.StatusBadRequest)
		return
	}

	status, err := h.fragmentClient.CheckUsername(u)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	res := map[string]interface{}{
		"username": u,
		"status":   status,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}
