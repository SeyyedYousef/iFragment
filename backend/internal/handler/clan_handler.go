package handler

import (
	"context"
	"encoding/json"
	"errors"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/service"
	"log/slog"
	"net/http"
	"strconv"
	"time"
)

type ClanHandler struct {
	clanService *service.ClanService
}

func NewClanHandler(s *service.ClanService) *ClanHandler {
	return &ClanHandler{clanService: s}
}

func (h *ClanHandler) GetClanDetails(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	details, err := h.clanService.GetClanDetails(r.Context(), userID)
	if err != nil {
		slog.Error("GetClanDetails failed", "user_id", userID, "error", err)
		RespondError(w, r, http.StatusInternalServerError, "failed to get clan details", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(details); err != nil {
		slog.Error("failed to encode clan details response", "error", err)
	}
}

type JoinClanRequest struct {
	Username string `json:"username"`
}

func (h *ClanHandler) JoinClan(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	var req JoinClanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	if req.Username == "" {
		RespondError(w, r, http.StatusBadRequest, "missing channel username", nil)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	clan, err := h.clanService.SearchAndJoinClan(ctx, userID, req.Username)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidUsername):
			RespondError(w, r, http.StatusBadRequest, "invalid_username", err)
		case errors.Is(err, service.ErrChannelNotFound):
			RespondError(w, r, http.StatusNotFound, "channel_not_found", err)
		case errors.Is(err, service.ErrNotChannelMember):
			RespondError(w, r, http.StatusForbidden, "not_channel_member", err)
		case errors.Is(err, service.ErrAlreadyInClan):
			RespondError(w, r, http.StatusBadRequest, "already_in_clan", err)
		case errors.Is(err, service.ErrCooldownActive):
			RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		default:
			slog.Error("JoinClan failed", "user_id", userID, "error", err)
			RespondError(w, r, http.StatusInternalServerError, "internal_error", err)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(clan); err != nil {
		slog.Error("failed to encode join clan response", "error", err)
	}
}

func (h *ClanHandler) LeaveClan(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	err = h.clanService.LeaveClan(r.Context(), userID)
	if err != nil {
		slog.Error("LeaveClan failed", "user_id", userID, "error", err)
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *ClanHandler) GetTopClans(w http.ResponseWriter, r *http.Request) {
	clans, err := h.clanService.GetTopClans(r.Context(), 10)
	if err != nil {
		slog.Error("GetTopClans failed", "error", err)
		RespondError(w, r, http.StatusInternalServerError, "failed to fetch top clans", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(clans); err != nil {
		slog.Error("failed to encode top clans response", "error", err)
	}
}

func (h *ClanHandler) GetClanMembers(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	clanID := r.URL.Query().Get("clan_id")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	members, err := h.clanService.GetClanMembers(r.Context(), userID, clanID, limit)
	if err != nil {
		slog.Error("GetClanMembers failed", "user_id", userID, "error", err)
		RespondError(w, r, http.StatusInternalServerError, "failed to get clan members", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(members); err != nil {
		slog.Error("failed to encode clan members response", "error", err)
	}
}

