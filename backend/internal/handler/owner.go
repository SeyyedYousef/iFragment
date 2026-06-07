package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/service"
)

var promoCodeRe = regexp.MustCompile(`^[A-Z0-9]{4,20}$`)

type OwnerHandler struct {
	srv *service.OwnerService
}

func NewOwnerHandler(srv *service.OwnerService) *OwnerHandler {
	return &OwnerHandler{srv: srv}
}

func (h *OwnerHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		InitData string `json:"init_data"`
		Code     string `json:"code"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if req.InitData == "" || req.Code == "" {
		RespondError(w, r, http.StatusBadRequest, "init_data and code are required", nil)
		return
	}

	tgUserID, err := middleware.VerifyInitDataAndExtractUserID(req.InitData)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "Invalid Telegram authentication data: "+err.Error(), err)
		return
	}

	ip := middleware.GetRealIP(r)
	ua := r.UserAgent()

	token, err := h.srv.Authenticate(r.Context(), tgUserID, req.Code, ip, ua)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": token})
}

func (h *OwnerHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.srv.GetDashboardStats(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to retrieve statistics", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func (h *OwnerHandler) AdjustFrg(w http.ResponseWriter, r *http.Request) {
	ownerID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, err.Error(), err)
		return
	}

	var req struct {
		UserID int64   `json:"user_id"`
		Amount float64 `json:"amount"`
		Reason string  `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if req.UserID == 0 || req.Amount == 0 || req.Reason == "" {
		RespondError(w, r, http.StatusBadRequest, "user_id, amount, and reason are required", nil)
		return
	}

	if req.Amount < -1000000 || req.Amount > 1000000 {
		RespondError(w, r, http.StatusBadRequest, "amount must be between -1,000,000 and 1,000,000", errors.New("invalid amount bounds"))
		return
	}

	newBalance, err := h.srv.AdjustFRG(r.Context(), ownerID, req.UserID, req.Amount, req.Reason, middleware.GetRealIP(r), r.UserAgent())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"new_balance": newBalance,
	})
}

func (h *OwnerHandler) Impersonate(w http.ResponseWriter, r *http.Request) {
	ownerID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, err.Error(), err)
		return
	}

	var req struct {
		UserID int64 `json:"user_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if req.UserID == 0 {
		RespondError(w, r, http.StatusBadRequest, "user_id is required", nil)
		return
	}

	token, err := h.srv.ImpersonateUser(r.Context(), ownerID, req.UserID, middleware.GetRealIP(r), r.UserAgent())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"token": token,
	})
}

func (h *OwnerHandler) BanUser(w http.ResponseWriter, r *http.Request) {
	ownerID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, err.Error(), err)
		return
	}

	var req struct {
		UserID          int64  `json:"user_id"`
		BanType         string `json:"ban_type"`
		Reason          string `json:"reason"`
		DurationSeconds int64  `json:"duration_seconds"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if req.UserID == 0 || req.BanType == "" {
		RespondError(w, r, http.StatusBadRequest, "user_id and ban_type are required", nil)
		return
	}

	if req.DurationSeconds < 0 || req.DurationSeconds > 3153600000 {
		RespondError(w, r, http.StatusBadRequest, "duration_seconds must be between 0 and 3,153,600,000 (100 years)", errors.New("invalid duration bounds"))
		return
	}

	err = h.srv.SetUserBan(r.Context(), ownerID, req.UserID, req.BanType, req.Reason, req.DurationSeconds, middleware.GetRealIP(r), r.UserAgent())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *OwnerHandler) UnbanUser(w http.ResponseWriter, r *http.Request) {
	ownerID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, err.Error(), err)
		return
	}

	var req struct {
		UserID int64 `json:"user_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if req.UserID == 0 {
		RespondError(w, r, http.StatusBadRequest, "user_id is required", nil)
		return
	}

	err = h.srv.RemoveUserBan(r.Context(), ownerID, req.UserID, middleware.GetRealIP(r), r.UserAgent())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *OwnerHandler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		RespondError(w, r, http.StatusBadRequest, "Query parameter 'q' is required", errors.New("missing query"))
		return
	}

	// Validation check on search query (at least 3 characters long, or numeric Telegram ID)
	isNumeric := true
	for _, c := range query {
		if c < '0' || c > '9' {
			isNumeric = false
			break
		}
	}
	if len(query) < 3 && !isNumeric {
		RespondError(w, r, http.StatusBadRequest, "Query must be at least 3 characters long or a numeric Telegram ID", errors.New("search query too short"))
		return
	}

	results, err := h.srv.SearchUsers(r.Context(), query)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Search failed", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func (h *OwnerHandler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 20
	offset := 0

	if limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
			limit = val
		}
	}
	if offsetStr != "" {
		if val, err := strconv.Atoi(offsetStr); err == nil && val >= 0 {
			offset = val
		}
	}

	// Limit ceiling to prevent query memory exhaustion DoS
	if limit > 200 {
		limit = 200
	}

	logs, err := h.srv.GetAuditLogs(r.Context(), limit, offset)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to load audit logs", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

func (h *OwnerHandler) CreatePromo(w http.ResponseWriter, r *http.Request) {
	ownerID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, err.Error(), err)
		return
	}

	var req struct {
		Code           string   `json:"code"`
		RewardAmount   float64  `json:"reward_amount"`
		MaxUses        int      `json:"max_uses"`
		ExpiresInHours *float64 `json:"expires_in_hours,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if req.Code == "" || req.RewardAmount <= 0 || req.MaxUses <= 0 {
		RespondError(w, r, http.StatusBadRequest, "code, reward_amount (>0), and max_uses (>0) are required", nil)
		return
	}

	// Alphanumeric, Reward bounds and MaxUses limits validation
	if !promoCodeRe.MatchString(strings.ToUpper(req.Code)) {
		RespondError(w, r, http.StatusBadRequest, "code must be 4-20 alphanumeric characters", errors.New("invalid promo code charset or length"))
		return
	}
	if req.RewardAmount <= 0 || req.RewardAmount > 100000 {
		RespondError(w, r, http.StatusBadRequest, "reward_amount must be between 0 and 100000", errors.New("invalid reward amount bounds"))
		return
	}
	if req.MaxUses <= 0 || req.MaxUses > 1000000 {
		RespondError(w, r, http.StatusBadRequest, "max_uses must be between 0 and 1000000", errors.New("invalid max uses bounds"))
		return
	}

	var expiresAt *time.Time
	if req.ExpiresInHours != nil && *req.ExpiresInHours > 0 {
		exp := time.Now().Add(time.Duration(*req.ExpiresInHours * float64(time.Hour)))
		expiresAt = &exp
	}

	err = h.srv.CreatePromoCode(r.Context(), ownerID, req.Code, req.RewardAmount, req.MaxUses, expiresAt, middleware.GetRealIP(r), r.UserAgent())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *OwnerHandler) DeletePromo(w http.ResponseWriter, r *http.Request) {
	ownerID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, err.Error(), err)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		RespondError(w, r, http.StatusBadRequest, "Query parameter 'code' is required", errors.New("missing code"))
		return
	}

	err = h.srv.DeletePromoCode(r.Context(), ownerID, code, middleware.GetRealIP(r), r.UserAgent())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *OwnerHandler) ListPromos(w http.ResponseWriter, r *http.Request) {
	list, err := h.srv.ListPromoCodes(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to retrieve promo codes", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

func (h *OwnerHandler) RedeemPromo(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, err.Error(), err)
		return
	}

	var req struct {
		Code string `json:"code"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if req.Code == "" {
		RespondError(w, r, http.StatusBadRequest, "code is required", nil)
		return
	}

	err = h.srv.RedeemPromoCode(r.Context(), userID, req.Code)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Promo code redeemed successfully! Check your FRG balance.",
	})
}

func (h *OwnerHandler) ListQuests(w http.ResponseWriter, r *http.Request) {
	list, err := h.srv.ListAllQuests(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to retrieve quests", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

func (h *OwnerHandler) CreateQuest(w http.ResponseWriter, r *http.Request) {
	ownerID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, err.Error(), err)
		return
	}

	var req model.Quest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	err = h.srv.CreateQuest(r.Context(), ownerID, req, middleware.GetRealIP(r), r.UserAgent())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *OwnerHandler) UpdateQuest(w http.ResponseWriter, r *http.Request) {
	ownerID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, err.Error(), err)
		return
	}

	var req model.Quest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	err = h.srv.UpdateQuest(r.Context(), ownerID, req, middleware.GetRealIP(r), r.UserAgent())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *OwnerHandler) DeleteQuest(w http.ResponseWriter, r *http.Request) {
	ownerID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, err.Error(), err)
		return
	}

	key := r.URL.Query().Get("key")
	if key == "" {
		RespondError(w, r, http.StatusBadRequest, "Query parameter 'key' is required", errors.New("missing key"))
		return
	}

	err = h.srv.DeleteQuest(r.Context(), ownerID, key, middleware.GetRealIP(r), r.UserAgent())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

