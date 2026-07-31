package handler

import (
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service"
	"ifragment-backend/internal/service/payment"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

type ProfileHandler struct {
	profileService *service.ProfileService
	paymentService *payment.StarsService
	settingsRepo   *repository.SettingsRepo
}

func NewProfileHandler(s *service.ProfileService, p *payment.StarsService, r *repository.SettingsRepo) *ProfileHandler {
	return &ProfileHandler{
		profileService: s,
		paymentService: p,
		settingsRepo:   r,
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

	if sys, err := h.settingsRepo.GetSystemSettings(r.Context()); err == nil && sys != nil {
		activeAds := []model.DashboardAd{}
		for _, ad := range sys.DashboardAds {
			if ad.IsActive {
				activeAds = append(activeAds, ad)
			}
		}
		config["dashboard_ads"] = activeAds
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	json.NewEncoder(w).Encode(config)
}

func (h *ProfileHandler) getUserID(r *http.Request) (int64, bool) {
	id, err := middleware.GetUserID(r.Context())
	return id, err == nil
}

type SetLanguageRequest struct {
	Language string `json:"language"`
}

func (h *ProfileHandler) SetLanguage(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	var req SetLanguageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	// Basic validation for language
	if len(req.Language) < 2 || len(req.Language) > 10 {
		RespondError(w, r, http.StatusBadRequest, "invalid language code", nil)
		return
	}

	err := h.profileService.UpdateLanguage(r.Context(), userID, req.Language)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to update language", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
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

	// Alphanumeric + underscore/hyphen, 3 to 32 characters validation (SEC-07)
	if len(req.ReferrerCode) < 3 || len(req.ReferrerCode) > 32 {
		RespondError(w, r, http.StatusBadRequest, "referrerCode must be between 3 and 32 characters", nil)
		return
	}
	for _, char := range req.ReferrerCode {
		if !((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || char == '_' || char == '-') {
			RespondError(w, r, http.StatusBadRequest, "referrerCode contains invalid characters", nil)
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
	Taps       int    `json:"taps"`
	Multiplier int    `json:"multiplier"`
	Nonce      string `json:"nonce"`
	Signature  string `json:"signature"`
	ClientTS   int64  `json:"client_ts"`
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

	if req.Signature == "" {
		RespondError(w, r, http.StatusBadRequest, "missing signature", nil)
		return
	}

	if req.Taps <= 0 {
		RespondError(w, r, http.StatusBadRequest, "taps must be positive", nil)
		return
	}

	// SEC-08: Validate tap count to prevent score manipulation. Clamp at 500 instead of rejecting.
	if req.Taps > 500 {
		req.Taps = 500
	}
	if req.Multiplier <= 0 {
		req.Multiplier = 1
	}

	stats, err := h.profileService.AddTaps(r.Context(), userID, req.Taps, req.Multiplier)
	if err != nil {
		if err.Error() == "not enough energy" {
			RespondError(w, r, http.StatusBadRequest, "not enough energy", err)
			return
		}
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

func (h *ProfileHandler) GetMarketplaceOptions(w http.ResponseWriter, r *http.Request) {
	options := []map[string]interface{}{
		{
			"id":           "pack_starter",
			"title":        "Starter Pack",
			"amount_stars": 50,
			"amount_coins": 10000,
			"frg_amount":   10,
			"price":        0.99,
			"discount":     "",
		},
		{
			"id":           "pack_pro",
			"title":        "Pro Investor Pack",
			"amount_stars": 250,
			"amount_coins": 65000,
			"popular":      true,
			"frg_amount":   70,
			"price":        4.99,
			"discount":     "15% OFF",
		},
		{
			"id":           "pack_whale",
			"title":        "Whale Dominator Pack",
			"amount_stars": 1000,
			"amount_coins": 300000,
			"frg_amount":   350,
			"price":        19.99,
			"discount":     "30% OFF",
		},
	}
	RespondJSON(w, http.StatusOK, options)
}

func (h *ProfileHandler) BuyStarsMarketplace(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	var req struct {
		OptionID string `json:"option_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.OptionID == "" {
		RespondError(w, r, http.StatusBadRequest, "invalid payload", nil)
		return
	}

	stars := 50
	title := "Starter Pack"
	switch req.OptionID {
	case "pack_pro":
		stars = 250
		title = "Pro Investor Pack"
	case "pack_whale":
		stars = 1000
		title = "Whale Dominator Pack"
	}

	if h.paymentService == nil {
		RespondError(w, r, http.StatusInternalServerError, "payment service unavailable", nil)
		return
	}

	payload := fmt.Sprintf("marketplace_%s_%d", req.OptionID, userID)
	link, err := h.paymentService.CreateInvoiceLink(r.Context(), title, fmt.Sprintf("Purchase %s on iFragment", title), payload, stars)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to create invoice link", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"invoice_link": link})
}

func (h *ProfileHandler) ConvertAirdropCoins(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	var req struct {
		Amount float64 `json:"amount"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	RespondJSON(w, http.StatusOK, map[string]interface{}{"success": true, "user_id": userID, "converted_amount": req.Amount})
}

func (h *ProfileHandler) GetFRGBalance(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.getUserID(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	stats, err := h.profileService.GetProfileStats(r.Context(), userID)
	if err != nil || stats == nil {
		RespondJSON(w, http.StatusOK, map[string]interface{}{
			"user_id":      userID,
			"balance":      0.0,
			"total_earned": 0.0,
			"total_spent":  0.0,
			"updated_at":   time.Now().Format(time.RFC3339),
		})
		return
	}
	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"user_id":      userID,
		"balance":      stats.AirdropCoins,
		"total_earned": stats.TotalCoinsEarned,
		"total_spent":  0.0,
		"updated_at":   time.Now().Format(time.RFC3339),
	})
}

func (h *ProfileHandler) GetFRGTransactions(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusOK, []interface{}{})
}
