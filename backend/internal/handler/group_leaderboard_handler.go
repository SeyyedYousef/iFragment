package handler

import (
	"net/http"
	"strconv"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/service"
)

type GroupLeaderboardHandler struct {
	service *service.GroupLeaderboardService
}

func NewGroupLeaderboardHandler(service *service.GroupLeaderboardService) *GroupLeaderboardHandler {
	return &GroupLeaderboardHandler{service: service}
}

// GetLeaderboard returns the Top 100 leaderboard for either messages or boosts
func (h *GroupLeaderboardHandler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	currentUserID, _ := middleware.GetUserID(ctx) // 0 if unauthenticated
	if currentUserID == 0 {
		if uidStr := r.URL.Query().Get("user_id"); uidStr != "" {
			if uid, err := strconv.ParseInt(uidStr, 10, 64); err == nil && uid > 0 {
				currentUserID = uid
			}
		}
	}

	rankType := r.URL.Query().Get("type")
	if rankType != "boosts" {
		rankType = "messages"
	}

	limit := 100
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	res, err := h.service.GetLeaderboard(ctx, rankType, limit, currentUserID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get leaderboard", err)
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=15, stale-while-revalidate=30")
	RespondJSON(w, http.StatusOK, res)
}
