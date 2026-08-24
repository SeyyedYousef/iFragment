package handler

import (
	"encoding/json"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/service"
	"log/slog"
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

func (h *GamificationHandler) GetDailyStatus(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	status, err := h.gamificationService.GetDailyStatus(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get daily claim status", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(status); err != nil {
		slog.Error("failed to encode daily status response", "error", err)
	}
}

func (h *GamificationHandler) ClaimDailyReward(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	status, err := h.gamificationService.ClaimDailyReward(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(status); err != nil {
		slog.Error("failed to encode claim reward response", "error", err)
	}
}

func (h *GamificationHandler) GetTasksStatus(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	tasks, err := h.gamificationService.GetTasksStatus(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get tasks status", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(tasks); err != nil {
		slog.Error("failed to encode tasks status response", "error", err)
	}
}

type CompleteTaskRequest struct {
	TaskKey string `json:"taskKey"`
	Answer  string `json:"answer,omitempty"`
}

func (h *GamificationHandler) CompleteTask(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
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

	status, err := h.gamificationService.CompleteTask(r.Context(), userID, req.TaskKey, req.Answer)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(status); err != nil {
		slog.Error("failed to encode complete task response", "error", err)
	}
}

func (h *GamificationHandler) GetBoostsStatus(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	boosts, err := h.gamificationService.GetBoostsStatus(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get boosts status", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(boosts); err != nil {
		slog.Error("failed to encode boosts status response", "error", err)
	}
}

type UpgradeBoostRequest struct {
	BoostType string `json:"boostType"`
}

func (h *GamificationHandler) UpgradeBoost(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
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
	if err := json.NewEncoder(w).Encode(updated); err != nil {
		slog.Error("failed to encode upgrade boost response", "error", err)
	}
}

func (h *GamificationHandler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "day"
	}
	league := r.URL.Query().Get("league")
	userID, _ := middleware.GetUserID(r.Context())

	leaderboard, userRank, totalMiners, err := h.gamificationService.GetLeaderboard(r.Context(), userID, period, league)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get leaderboard", err)
		return
	}

	response := map[string]interface{}{
		"leaderboard":  leaderboard,
		"user_rank":    userRank,
		"total_miners": totalMiners,
		"league":       league,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		slog.Error("failed to encode leaderboard response", "error", err)
	}
}

func (h *GamificationHandler) GetDailyComboStatus(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	status, err := h.gamificationService.GetDailyComboStatus(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get combo status", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(status); err != nil {
		slog.Error("failed to encode combo status", "error", err)
	}
}

func (h *GamificationHandler) ClaimDailyCombo(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	var req struct {
		SecretWord string `json:"secret_word"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request", err)
		return
	}

	err = h.gamificationService.ClaimDailyCombo(r.Context(), userID, req.SecretWord)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success": true}`))
}

func (h *GamificationHandler) GetGlobalClans(w http.ResponseWriter, r *http.Request) {
	clans, err := h.gamificationService.GetGlobalClans(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get global clans", err)
		return
	}
	RespondJSON(w, http.StatusOK, clans)
}

func (h *GamificationHandler) GetActiveQuests(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}
	quests, err := h.gamificationService.GetActiveQuests(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get active quests", err)
		return
	}
	RespondJSON(w, http.StatusOK, quests)
}

func (h *GamificationHandler) CollectOfflineMining(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	res, err := h.gamificationService.CollectOfflineMining(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(res); err != nil {
		slog.Error("failed to encode offline mining response", "error", err)
	}
}

func (h *GamificationHandler) StartOfflineMining(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	err = h.gamificationService.StartOfflineMining(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success": true}`))
}

func (h *GamificationHandler) ApplyTurbo(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	err = h.gamificationService.ApplyTurbo(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *GamificationHandler) ApplyFullEnergy(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	err = h.gamificationService.ApplyFullEnergy(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
