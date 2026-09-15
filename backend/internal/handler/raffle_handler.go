package handler

import (
	"encoding/json"
	"net/http"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/raffle"
)

// RaffleHandler exposes HTTP endpoints for viewing daily raffle results on group and profile pages.
type RaffleHandler struct {
	raffleSvc *raffle.RaffleService
}

// NewRaffleHandler creates a new RaffleHandler instance.
func NewRaffleHandler(raffleSvc *raffle.RaffleService) *RaffleHandler {
	return &RaffleHandler{
		raffleSvc: raffleSvc,
	}
}

// GetLatestDraw returns the latest locked daily gift draw result for public/group view.
func (h *RaffleHandler) GetLatestDraw(w http.ResponseWriter, r *http.Request) {
	if h.raffleSvc == nil {
		RespondError(w, r, http.StatusServiceUnavailable, "raffle service unavailable", nil)
		return
	}

	draw, err := h.raffleSvc.GetLatestDraw(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get latest raffle draw", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if draw == nil {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"latest_draw": nil,
		})
		return
	}

	maskedUsername := ""
	if draw.WinnerUsername != "" {
		if len(draw.WinnerUsername) > 3 {
			maskedUsername = draw.WinnerUsername[:2] + "***" + draw.WinnerUsername[len(draw.WinnerUsername)-1:]
		} else {
			maskedUsername = draw.WinnerUsername[:1] + "***"
		}
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"latest_draw": map[string]interface{}{
			"draw_date":          draw.DrawDate.Format("2006-01-02"),
			"winner_first_name":  draw.WinnerFirstName,
			"winner_username":    maskedUsername,
			"total_messages":     draw.TotalMessages,
			"total_participants": draw.TotalParticipants,
			"prize_usd":          draw.PrizeUSD,
			"prize_stars":        draw.PrizeStars,
			"gift_title":         draw.GiftTitle,
			"auto_sent":          draw.AutoSent,
		},
	})
}

// GetUserProfileRaffle returns raffle status, today's chance, and win history for the authenticated user.
func (h *RaffleHandler) GetUserProfileRaffle(w http.ResponseWriter, r *http.Request) {
	if h.raffleSvc == nil {
		RespondError(w, r, http.StatusServiceUnavailable, "raffle service unavailable", nil)
		return
	}

	userID, _ := middleware.GetUserID(r.Context())
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	uniqueParticipants, totalMessages, entered, err := h.raffleSvc.GetTodayUserStats(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get user raffle stats", err)
		return
	}

	chance := 0.0
	if uniqueParticipants > 0 && entered {
		chance = (1.0 / float64(uniqueParticipants)) * 100.0
	}

	wins, _ := h.raffleSvc.GetUserWins(r.Context(), userID)
	if wins == nil {
		wins = []repository.DailyGiftDraw{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"entered_today":            entered,
		"today_unique_users":       uniqueParticipants,
		"today_total_messages":     totalMessages,
		"today_win_chance_percent": chance,
		"wins_count":               len(wins),
		"wins":                     wins,
	})
}
