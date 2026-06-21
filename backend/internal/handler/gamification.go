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
	leaderboard, err := h.gamificationService.GetLeaderboard(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get leaderboard", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(leaderboard); err != nil {
		slog.Error("failed to encode leaderboard response", "error", err)
	}
}

// GetDailyCipher returns the daily cipher info
func (h *GamificationHandler) GetDailyCipher(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	info, err := h.gamificationService.GetDailyCipherInfo(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}

// ClaimDailyCipher handles user's cipher submission
func (h *GamificationHandler) ClaimDailyCipher(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		MorseCode string `json:"morse_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	reward, err := h.gamificationService.ClaimDailyCipher(r.Context(), userID, req.MorseCode)
	if err != nil {
		if err.Error() == "already claimed today" {
			http.Error(w, "Already claimed", http.StatusConflict)
		} else if err.Error() == "invalid cipher code" {
			http.Error(w, "Invalid code", http.StatusForbidden)
		} else {
			http.Error(w, "Internal error", http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"reward": reward,
	})
}

func (h *GamificationHandler) GetGlobalClans(w http.ResponseWriter, r *http.Request) {
	clans, err := h.gamificationService.GetGlobalClans(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(clans)
}

func (h *GamificationHandler) GetActiveQuests(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	quests, err := h.gamificationService.GetActiveQuests(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(quests)
}
