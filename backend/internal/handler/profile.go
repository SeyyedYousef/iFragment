package handler

import (
	"encoding/json"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/service"
	"net/http"
)

type ProfileHandler struct {
	profileService *service.ProfileService
}

func NewProfileHandler(s *service.ProfileService) *ProfileHandler {
	return &ProfileHandler{
		profileService: s,
	}
}

func (h *ProfileHandler) getUserID(r *http.Request) (int64, bool) {
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
	return userID, true
}

func (h *ProfileHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	stats, err := h.profileService.GetStats(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get stats", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func (h *ProfileHandler) GetAchievements(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	achievements, err := h.profileService.GetAchievements(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get achievements", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(achievements)
}

func (h *ProfileHandler) GetReferralData(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	referral, err := h.profileService.GetReferralData(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get referral data", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(referral)
}

type SetReferrerRequest struct {
	ReferrerCode string `json:"referrerCode"`
}

func (h *ProfileHandler) SetReferrerCode(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	var req SetReferrerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request", err)
		return
	}

	if req.ReferrerCode == "" {
		RespondError(w, r, http.StatusBadRequest, "missing referrerCode", nil)
		return
	}

	err := h.profileService.SetReferralCode(r.Context(), userID, req.ReferrerCode)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

type AddTapsRequest struct {
	Taps int `json:"taps"`
}

func (h *ProfileHandler) AddTaps(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	var req AddTapsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	stats, err := h.profileService.AddTaps(r.Context(), userID, req.Taps)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to update taps", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
