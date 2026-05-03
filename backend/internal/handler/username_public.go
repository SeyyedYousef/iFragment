package handler

import (
	"encoding/json"
	"ifragment-backend/internal/client/fragment"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username"
	"log/slog"
	"net/http"
	"time"
)

type UsernameHandler struct {
	service        *username.AggregatorService
	fragmentClient *fragment.Client
	cache          *repository.Cache
}

func NewUsernameHandler(s *username.AggregatorService, f *fragment.Client, c *repository.Cache) *UsernameHandler {
	return &UsernameHandler{
		service:        s,
		fragmentClient: f,
		cache:          c,
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

	ctx := r.Context()
	cacheKey := "fg_cache:" + u

	// Try cache first
	if h.cache != nil {
		if val, err := h.cache.Client.Get(ctx, cacheKey).Result(); err == nil {
			slog.Debug("Fragment cache hit", "username", u)
			h.jsonResponse(w, u, fragment.Status(val))
			return
		}
	}

	status, err := h.fragmentClient.CheckUsername(u)
	if err != nil {
		slog.Error("Fragment check failed", "username", u, "error", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Save to cache for 5 minutes
	if h.cache != nil {
		h.cache.Client.Set(ctx, cacheKey, string(status), 5*time.Minute)
	}

	h.jsonResponse(w, u, status)
}

func (h *UsernameHandler) jsonResponse(w http.ResponseWriter, u string, status fragment.Status) {
	res := map[string]interface{}{
		"username": u,
		"status":   status,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}
