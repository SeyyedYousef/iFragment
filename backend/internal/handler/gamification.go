package handler

import (
	"encoding/json"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/service"
	"net/http"
)

type GamificationHandler struct {
	gamificationService *service.GamificationService
}

func NewGamificationHandler(s *service.GamificationService) *GamificationHandler {
	return &GamificationHandler{
		gamificationService: s,
	}
}

func (h *GamificationHandler) getUserID(r *http.Request) (int64, bool) {
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

func (h *GamificationHandler) GetDailyStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	status, err := h.gamificationService.GetDailyStatus(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get daily claim status", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func (h *GamificationHandler) ClaimDailyReward(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	status, err := h.gamificationService.ClaimDailyReward(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func (h *GamificationHandler) GetTasksStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	tasks, err := h.gamificationService.GetTasksStatus(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get tasks status", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasks)
}

type CompleteTaskRequest struct {
	TaskKey string `json:"taskKey"`
}

func (h *GamificationHandler) CompleteTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	var req CompleteTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request", err)
		return
	}

	if req.TaskKey == "" {
		RespondError(w, r, http.StatusBadRequest, "missing taskKey", nil)
		return
	}

	status, err := h.gamificationService.CompleteTask(r.Context(), userID, req.TaskKey)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func (h *GamificationHandler) GetBoostsStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	boosts, err := h.gamificationService.GetBoostsStatus(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get boosts status", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(boosts)
}

type UpgradeBoostRequest struct {
	BoostType string `json:"boostType"`
}

func (h *GamificationHandler) UpgradeBoost(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	var req UpgradeBoostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request", err)
		return
	}

	if req.BoostType == "" {
		RespondError(w, r, http.StatusBadRequest, "missing boostType", nil)
		return
	}

	updated, err := h.gamificationService.UpgradeBoost(r.Context(), userID, req.BoostType)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func (h *GamificationHandler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	leaderboard, err := h.gamificationService.GetLeaderboard(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get leaderboard", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(leaderboard)
}
