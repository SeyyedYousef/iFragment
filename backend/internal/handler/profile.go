package handler

import (
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service"
	"ifragment-backend/internal/service/payment"
	"net/http"
)

type ProfileHandler struct {
	profileService *service.ProfileService
	paymentService *payment.StarsService
}

func NewProfileHandler(s *service.ProfileService, p *payment.StarsService) *ProfileHandler {
	return &ProfileHandler{
		profileService: s,
		paymentService: p,
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
	return userID, userID != 0
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

func (h *ProfileHandler) GetAchievementDefs(w http.ResponseWriter, r *http.Request) {
	keys := []string{
		"first_steps", "home_base", "tap_novice", "mining_machine", "frg_millionaire",
		"first_scan", "whale_hunter", "data_scientist", "social_butterfly", "army_builder",
		"network_king", "group_guardian", "channel_commander", "empire_builder", "week_warrior",
		"month_master", "legendary", "early_adopter", "premium_user", "bug_hunter",
	}
	defs := make([]model.AchievementDef, 0, len(keys))
	for _, k := range keys {
		if target, exists := repository.PredefinedAchievements[k]; exists {
			defs = append(defs, model.AchievementDef{
				ID:     k,
				Target: target,
			})
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(defs)
}

func (h *ProfileHandler) GetCosmetics(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	items, err := h.profileService.GetCosmetics(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get cosmetics", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

type PurchaseCosmeticRequest struct {
	CosmeticID string `json:"cosmeticId"`
}

func (h *ProfileHandler) PurchaseCosmetic(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	var req PurchaseCosmeticRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	err := h.profileService.PurchaseCosmetic(r.Context(), userID, req.CosmeticID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

type EquipCosmeticRequest struct {
	CosmeticID string `json:"cosmeticId"`
	Type       string `json:"type"` // "border" or "skin"
}

func (h *ProfileHandler) EquipCosmetic(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	var req EquipCosmeticRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	err := h.profileService.EquipCosmetic(r.Context(), userID, req.CosmeticID, req.Type)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

type SetEmojiStatusRequest struct {
	Emoji string `json:"emoji"`
}

func (h *ProfileHandler) SetEmojiStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	var req SetEmojiStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	err := h.profileService.SetEmojiStatus(r.Context(), userID, req.Emoji)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func (h *ProfileHandler) CreatePremiumCheckout(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	// Pay 50 Stars for 30 days premium (very cheap test price)
	amountStars := 50
	payload := fmt.Sprintf("stars_premium_1m:%d", userID)

	link, err := h.paymentService.CreateInvoiceLink(
		"iFragment Premium Profile",
		"Unlock exclusive animated CSS borders, custom emoji status, and premium search features.",
		payload,
		amountStars,
	)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to create invoice link", err)
		return
	}

	// Create a pending order
	_, err = h.paymentService.DB.CreateOrder(r.Context(), repository.Order{
		UserID:  userID,
		Amount:  amountStars,
		Status:  "pending",
		Payload: payload,
	})
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to create order", err)
		return
	}

	auditRepo := repository.NewAuditRepo(h.paymentService.DB)
	targetType := "user"
	targetID := fmt.Sprintf("%d", userID)
	_ = auditRepo.Log(r.Context(), &repository.AuditLog{
		ActorID:    userID,
		Action:     "premium.checkout.create",
		TargetType: &targetType,
		TargetID:   &targetID,
	})

	RespondJSON(w, http.StatusOK, map[string]string{"invoice_link": link})
}

func RespondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}
