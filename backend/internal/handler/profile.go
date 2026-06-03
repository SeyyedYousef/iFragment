package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service"
	"ifragment-backend/internal/service/payment"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
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

func (h *ProfileHandler) GetPublicConfig(w http.ResponseWriter, r *http.Request) {
	config := map[string]interface{}{
		"airdrop_to_frg_rate": 100000.0,
		"boosters": map[string]interface{}{
			"tapPower": map[string]interface{}{
				"maxLevel": 10,
				"baseCost": 2000.0,
			},
			"energyCap": map[string]interface{}{
				"maxLevel": 10,
				"baseCost": 1500.0,
			},
			"tapBot": map[string]interface{}{
				"maxLevel": 1,
				"baseCost": 20000.0,
			},
		},
		"leagues": []map[string]interface{}{
			{"name": "Bronze", "minScore": 0},
			{"name": "Silver", "minScore": 50000},
			{"name": "Gold", "minScore": 200000},
			{"name": "Platinum", "minScore": 500000},
			{"name": "Diamond", "minScore": 1000000},
			{"name": "Legendary", "minScore": 5000000},
		},
		"daily_rewards": []int{500, 1000, 2500, 5000, 10000, 25000, 50000},
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	json.NewEncoder(w).Encode(config)
}

func (h *ProfileHandler) getUserID(r *http.Request) (int64, bool) {
	id, err := middleware.GetUserID(r.Context())
	return id, err == nil
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

	// Alphanumeric, 4 to 16 characters validation (SEC-07)
	if len(req.ReferrerCode) < 4 || len(req.ReferrerCode) > 16 {
		RespondError(w, r, http.StatusBadRequest, "referrerCode must be between 4 and 16 characters", nil)
		return
	}
	for _, char := range req.ReferrerCode {
		if !((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9')) {
			RespondError(w, r, http.StatusBadRequest, "referrerCode must be alphanumeric", nil)
			return
		}
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

	// SEC-08: Validate tap count to prevent score manipulation (synchronized max taps = 50)
	if req.Taps <= 0 || req.Taps > 50 {
		RespondError(w, r, http.StatusBadRequest, "taps must be between 1 and 50", nil)
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

func (h *ProfileHandler) DeleteUserDataGDPR(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	err := h.profileService.DeleteUserDataGDPR(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to wipe user data", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "ok", "message": "all user data successfully deleted under GDPR right to be forgotten"})
}

func (h *ProfileHandler) GetAvatar(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "userID")
	userID, err := strconv.ParseInt(userIDStr, 10, 64)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid user id", err)
		return
	}

	body, contentType, contentLength, err := h.profileService.GetAvatarStream(r.Context(), userID)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	defer body.Close()

	w.Header().Set("Content-Type", contentType)
	if contentLength > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(contentLength, 10))
	}
	w.Header().Set("Cache-Control", "public, max-age=3600")

	_, _ = io.Copy(w, body)
}
