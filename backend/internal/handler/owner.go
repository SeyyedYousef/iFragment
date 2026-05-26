package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/service"
)

type OwnerHandler struct {
	srv *service.OwnerService
}

func NewOwnerHandler(srv *service.OwnerService) *OwnerHandler {
	return &OwnerHandler{srv: srv}
}

func (h *OwnerHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TelegramUserID int64  `json:"telegram_user_id"`
		Code           string `json:"code"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if req.TelegramUserID == 0 || req.Code == "" {
		RespondError(w, r, http.StatusBadRequest, "telegram_user_id and code are required", nil)
		return
	}

	ip := r.RemoteAddr
	ua := r.UserAgent()

	token, err := h.srv.Authenticate(r.Context(), req.TelegramUserID, req.Code, ip, ua)
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
	rawUser := r.Context().Value(middleware.UserContextKey)
	user, _ := rawUser.(map[string]interface{})
	ownerIDVal, _ := user["id"]
	var ownerID int64
	switch v := ownerIDVal.(type) {
	case int64:
		ownerID = v
	case float64:
		ownerID = int64(v)
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

	newBalance, err := h.srv.AdjustFRG(r.Context(), ownerID, req.UserID, req.Amount, req.Reason, r.RemoteAddr, r.UserAgent())
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
	rawUser := r.Context().Value(middleware.UserContextKey)
	user, _ := rawUser.(map[string]interface{})
	ownerIDVal, _ := user["id"]
	var ownerID int64
	switch v := ownerIDVal.(type) {
	case int64:
		ownerID = v
	case float64:
		ownerID = int64(v)
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

	token, err := h.srv.ImpersonateUser(r.Context(), ownerID, req.UserID, r.RemoteAddr, r.UserAgent())
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
	rawUser := r.Context().Value(middleware.UserContextKey)
	user, _ := rawUser.(map[string]interface{})
	ownerIDVal, _ := user["id"]
	var ownerID int64
	switch v := ownerIDVal.(type) {
	case int64:
		ownerID = v
	case float64:
		ownerID = int64(v)
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

	err := h.srv.SetUserBan(r.Context(), ownerID, req.UserID, req.BanType, req.Reason, req.DurationSeconds, r.RemoteAddr, r.UserAgent())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *OwnerHandler) UnbanUser(w http.ResponseWriter, r *http.Request) {
	rawUser := r.Context().Value(middleware.UserContextKey)
	user, _ := rawUser.(map[string]interface{})
	ownerIDVal, _ := user["id"]
	var ownerID int64
	switch v := ownerIDVal.(type) {
	case int64:
		ownerID = v
	case float64:
		ownerID = int64(v)
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

	err := h.srv.RemoveUserBan(r.Context(), ownerID, req.UserID, r.RemoteAddr, r.UserAgent())
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

	logs, err := h.srv.GetAuditLogs(r.Context(), limit, offset)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to load audit logs", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

func (h *OwnerHandler) CreatePromo(w http.ResponseWriter, r *http.Request) {
	rawUser := r.Context().Value(middleware.UserContextKey)
	user, _ := rawUser.(map[string]interface{})
	ownerIDVal, _ := user["id"]
	var ownerID int64
	switch v := ownerIDVal.(type) {
	case int64:
		ownerID = v
	case float64:
		ownerID = int64(v)
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

	var expiresAt *time.Time
	if req.ExpiresInHours != nil && *req.ExpiresInHours > 0 {
		exp := time.Now().Add(time.Duration(*req.ExpiresInHours * float64(time.Hour)))
		expiresAt = &exp
	}

	err := h.srv.CreatePromoCode(r.Context(), ownerID, req.Code, req.RewardAmount, req.MaxUses, expiresAt, r.RemoteAddr, r.UserAgent())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *OwnerHandler) DeletePromo(w http.ResponseWriter, r *http.Request) {
	rawUser := r.Context().Value(middleware.UserContextKey)
	user, _ := rawUser.(map[string]interface{})
	ownerIDVal, _ := user["id"]
	var ownerID int64
	switch v := ownerIDVal.(type) {
	case int64:
		ownerID = v
	case float64:
		ownerID = int64(v)
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		RespondError(w, r, http.StatusBadRequest, "Query parameter 'code' is required", errors.New("missing code"))
		return
	}

	err := h.srv.DeletePromoCode(r.Context(), ownerID, code, r.RemoteAddr, r.UserAgent())
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
	rawUser := r.Context().Value(middleware.UserContextKey)
	user, _ := rawUser.(map[string]interface{})
	userIDVal, _ := user["id"]
	var userID int64
	switch v := userIDVal.(type) {
	case int64:
		userID = v
	case float64:
		userID = int64(v)
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

	err := h.srv.RedeemPromoCode(r.Context(), userID, req.Code)
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

