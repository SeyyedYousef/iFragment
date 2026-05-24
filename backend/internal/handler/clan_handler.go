package handler

import (
	"encoding/json"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/service"
	"net/http"
)

type ClanHandler struct {
	clanService *service.ClanService
}

func NewClanHandler(s *service.ClanService) *ClanHandler {
	return &ClanHandler{clanService: s}
}

func (h *ClanHandler) getUserID(r *http.Request) (int64, bool) {
	tgUser, ok := r.Context().Value(middleware.UserContextKey).(map[string]interface{})
	if !ok {
		return 0, false
	}
	var userID int64
	if v, ok := tgUser["id"].(float64); ok {
		userID = int64(v)
	} else if v, ok := tgUser["id"].(int64); ok {
		userID = v
	} else if v, ok := tgUser["id"].(int); ok {
		userID = int64(v)
	}
	return userID, userID != 0
}

func (h *ClanHandler) GetClanDetails(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	details, err := h.clanService.GetClanDetails(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get clan details", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(details)
}

type JoinClanRequest struct {
	Username string `json:"username"`
}

func (h *ClanHandler) JoinClan(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
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

	clan, err := h.clanService.SearchAndJoinClan(r.Context(), userID, req.Username)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(clan)
}

func (h *ClanHandler) LeaveClan(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	err := h.clanService.LeaveClan(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
