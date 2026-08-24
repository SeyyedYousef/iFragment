package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/model"
	"ifragment-backend/internal/service"

	"github.com/go-chi/chi/v5"
)

type OwnerHandler struct {
	ownerService *service.OwnerService
}

func NewOwnerHandler(ownerService *service.OwnerService) *OwnerHandler {
	return &OwnerHandler{
		ownerService: ownerService,
	}
}

func (h *OwnerHandler) writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func (h *OwnerHandler) writeError(w http.ResponseWriter, status int, message string) {
	h.writeJSON(w, status, map[string]string{"error": message})
}

// ─── Authentication & MFA ───────────────────────────────────────────────────

func (h *OwnerHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TelegramUserID int64  `json:"telegram_user_id"`
		Password       string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.TelegramUserID == 0 || req.Password == "" {
		h.writeError(w, http.StatusBadRequest, "telegram_user_id and password are required")
		return
	}

	ip := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		ip = strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}
	ua := r.Header.Get("User-Agent")

	authRes, err := h.ownerService.Authenticate(r.Context(), req.TelegramUserID, req.Password, ip, ua)
	if err != nil {
		h.writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, authRes)
}

func (h *OwnerHandler) VerifyTOTP(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TempToken string `json:"temp_token"`
		Code      string `json:"code"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.TempToken == "" || req.Code == "" {
		h.writeError(w, http.StatusBadRequest, "temp_token and code are required")
		return
	}

	ip := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		ip = strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}
	ua := r.Header.Get("User-Agent")

	token, err := h.ownerService.VerifyTOTPLogin(r.Context(), req.TempToken, req.Code, ip, ua)
	if err != nil {
		h.writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]string{
		"token": token,
	})
}

func (h *OwnerHandler) SetupTOTP(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok || adminID == 0 {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	resp, err := h.ownerService.SetupTOTP(r.Context(), adminID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, resp)
}

func (h *OwnerHandler) VerifyTOTPSetup(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok || adminID == 0 {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		h.writeError(w, http.StatusBadRequest, "code is required")
		return
	}

	if err := h.ownerService.VerifyTOTPSetup(r.Context(), adminID, req.Code); err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *OwnerHandler) DisableTOTP(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok || adminID == 0 {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		h.writeError(w, http.StatusBadRequest, "current code is required to disable TOTP")
		return
	}

	if err := h.ownerService.DisableTOTP(r.Context(), adminID, req.Code); err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ─── Dashboard Stats & Audit Logs ───────────────────────────────────────────

func (h *OwnerHandler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	adminID, _ := r.Context().Value(middleware.UserIDKey).(int64)
	stats, err := h.ownerService.GetDashboardStats(r.Context(), adminID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, stats)
}

func (h *OwnerHandler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	action := strings.TrimSpace(r.URL.Query().Get("action"))
	search := strings.TrimSpace(r.URL.Query().Get("search"))

	limit := 50
	offset := 0
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = min(l, 100)
	}
	if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
		offset = o
	}

	logs, total, err := h.ownerService.GetAuditLogsFiltered(r.Context(), limit, offset, action, search)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"logs":   logs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// ─── User Management & Impersonation ────────────────────────────────────────

func (h *OwnerHandler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	filter := r.URL.Query().Get("filter")

	limit := 50
	offset := 0
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = min(l, 100)
	}
	if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
		offset = o
	}

	users, total, err := h.ownerService.SearchUsersPaginated(r.Context(), query, limit, offset, filter)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"users":  users,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *OwnerHandler) Impersonate(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		TargetUserID int64 `json:"target_user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.TargetUserID == 0 {
		h.writeError(w, http.StatusBadRequest, "target_user_id is required")
		return
	}

	ip := r.RemoteAddr
	ua := r.Header.Get("User-Agent")

	token, err := h.ownerService.ImpersonateUser(r.Context(), adminID, req.TargetUserID, ip, ua)
	if err != nil {
		h.writeError(w, http.StatusForbidden, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]string{
		"token": token,
	})
}

func (h *OwnerHandler) EndImpersonation(w http.ResponseWriter, r *http.Request) {
	adminID, _ := r.Context().Value(middleware.UserIDKey).(int64)
	var req struct {
		SessionID    string   `json:"session_id"`
		ActionsTaken []string `json:"actions_taken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SessionID == "" {
		h.writeError(w, http.StatusBadRequest, "session_id is required")
		return
	}

	if err := h.ownerService.EndImpersonation(r.Context(), adminID, req.SessionID, req.ActionsTaken); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *OwnerHandler) BanUser(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		TargetUserID    int64  `json:"target_user_id"`
		BanType         string `json:"ban_type"`
		Reason          string `json:"reason"`
		DurationSeconds int64  `json:"duration_seconds"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.TargetUserID == 0 || req.BanType == "" {
		h.writeError(w, http.StatusBadRequest, "target_user_id and ban_type are required")
		return
	}

	ip := r.RemoteAddr
	ua := r.Header.Get("User-Agent")

	err := h.ownerService.SetUserBan(r.Context(), adminID, req.TargetUserID, req.BanType, req.Reason, req.DurationSeconds, ip, ua)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *OwnerHandler) UnbanUser(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		TargetUserID int64 `json:"target_user_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.TargetUserID == 0 {
		h.writeError(w, http.StatusBadRequest, "target_user_id is required")
		return
	}

	ip := r.RemoteAddr
	ua := r.Header.Get("User-Agent")

	err := h.ownerService.RemoveUserBan(r.Context(), adminID, req.TargetUserID, ip, ua)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *OwnerHandler) FlagUser(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		TargetUserID int64  `json:"target_user_id"`
		IsFlagged    bool   `json:"is_flagged"`
		Reason       string `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.TargetUserID == 0 {
		h.writeError(w, http.StatusBadRequest, "target_user_id is required")
		return
	}

	ip := r.RemoteAddr
	ua := r.Header.Get("User-Agent")

	err := h.ownerService.FlagUser(r.Context(), adminID, req.TargetUserID, req.IsFlagged, req.Reason, ip, ua)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *OwnerHandler) AdjustBalance(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req service.AdjustAirdropCoinsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	ip := r.RemoteAddr
	newBalance, err := h.ownerService.AdjustAirdropCoins(r.Context(), req, adminID, ip)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":     true,
		"new_balance": newBalance,
	})
}

// ─── Broadcasts ─────────────────────────────────────────────────────────────

func (h *OwnerHandler) CreateBroadcast(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		TargetAudience string     `json:"target_audience"`
		Message        string     `json:"message"`
		ScheduledAt    *time.Time `json:"scheduled_at"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	ip := r.RemoteAddr
	ua := r.Header.Get("User-Agent")

	id, err := h.ownerService.CreateBroadcast(r.Context(), adminID, req.TargetAudience, req.Message, req.ScheduledAt, ip, ua)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusCreated, map[string]string{
		"id": id,
	})
}

func (h *OwnerHandler) ListBroadcasts(w http.ResponseWriter, r *http.Request) {
	list, err := h.ownerService.ListBroadcasts(r.Context())
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, list)
}

func (h *OwnerHandler) GetAudienceCount(w http.ResponseWriter, r *http.Request) {
	audience := r.URL.Query().Get("audience")
	if audience == "" {
		audience = "all"
	}

	count, err := h.ownerService.GetAudienceCount(r.Context(), audience)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"audience": audience,
		"count":    count,
	})
}

func (h *OwnerHandler) PauseBroadcast(w http.ResponseWriter, r *http.Request) {
	adminID, _ := r.Context().Value(middleware.UserIDKey).(int64)
	id := chi.URLParam(r, "id")
	if id == "" {
		h.writeError(w, http.StatusBadRequest, "broadcast id is required")
		return
	}

	if err := h.ownerService.PauseBroadcast(r.Context(), id, adminID); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *OwnerHandler) ResumeBroadcast(w http.ResponseWriter, r *http.Request) {
	adminID, _ := r.Context().Value(middleware.UserIDKey).(int64)
	id := chi.URLParam(r, "id")
	if id == "" {
		h.writeError(w, http.StatusBadRequest, "broadcast id is required")
		return
	}

	if err := h.ownerService.ResumeBroadcast(r.Context(), id, adminID); err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *OwnerHandler) CancelBroadcast(w http.ResponseWriter, r *http.Request) {
	adminID, _ := r.Context().Value(middleware.UserIDKey).(int64)
	id := chi.URLParam(r, "id")
	if id == "" {
		h.writeError(w, http.StatusBadRequest, "broadcast id is required")
		return
	}

	if err := h.ownerService.CancelBroadcast(r.Context(), id, adminID); err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ─── Entities (Channels & Groups) ───────────────────────────────────────────

func (h *OwnerHandler) GetAllChannels(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	limit, offset := 50, 0
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = min(l, 100)
	}
	if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
		offset = o
	}

	channels, err := h.ownerService.GetAllChannels(r.Context(), limit, offset)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, channels)
}

func (h *OwnerHandler) GetAllGroups(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	limit, offset := 50, 0
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = min(l, 100)
	}
	if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
		offset = o
	}

	groups, err := h.ownerService.GetAllGroups(r.Context(), limit, offset)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, groups)
}

func (h *OwnerHandler) ExtendEntitySubscription(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		EntityType string `json:"entity_type"`
		EntityID   string `json:"entity_id"`
		Days       int    `json:"days"`
		Reason     string `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	ip := r.RemoteAddr
	newUntil, err := h.ownerService.ExtendEntitySubscription(r.Context(), req.EntityType, req.EntityID, req.Days, req.Reason, adminID, ip)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":   true,
		"new_until": newUntil,
	})
}

func (h *OwnerHandler) GrantEntityCoins(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		EntityType string  `json:"entity_type"`
		EntityID   string  `json:"entity_id"`
		Coins      float64 `json:"coins"`
		Reason     string  `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	ip := r.RemoteAddr
	newBalance, err := h.ownerService.GrantEntityCoins(r.Context(), req.EntityType, req.EntityID, req.Coins, req.Reason, adminID, ip)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":     true,
		"new_balance": newBalance,
	})
}

// ─── Finance ────────────────────────────────────────────────────────────────

func (h *OwnerHandler) GetFinanceSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.ownerService.GetFinanceSummary(r.Context())
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, summary)
}

func (h *OwnerHandler) GetOrdersList(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	limit, offset := 50, 0
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = min(l, 100)
	}
	if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
		offset = o
	}

	orders, err := h.ownerService.GetOrdersList(r.Context(), limit, offset)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, orders)
}

func (h *OwnerHandler) GetPremiumEntities(w http.ResponseWriter, r *http.Request) {
	entities, err := h.ownerService.GetPremiumEntities(r.Context())
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, entities)
}

// ─── Userbots ───────────────────────────────────────────────────────────────

func (h *OwnerHandler) UserbotSendCode(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PhoneNumber string `json:"phone_number"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PhoneNumber == "" {
		h.writeError(w, http.StatusBadRequest, "phone_number is required")
		return
	}

	hash, err := h.ownerService.UserbotSendCode(r.Context(), req.PhoneNumber)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]string{"phone_code_hash": hash})
}

func (h *OwnerHandler) UserbotVerifyCode(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PhoneNumber   string `json:"phone_number"`
		Code          string `json:"code"`
		PhoneCodeHash string `json:"phone_code_hash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid payload")
		return
	}

	err := h.ownerService.UserbotVerifyCode(r.Context(), req.PhoneNumber, req.Code, req.PhoneCodeHash)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *OwnerHandler) ListUserbots(w http.ResponseWriter, r *http.Request) {
	bots, err := h.ownerService.ListUserbots(r.Context())
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, bots)
}

func (h *OwnerHandler) DeleteUserbot(w http.ResponseWriter, r *http.Request) {
	adminID, _ := r.Context().Value(middleware.UserIDKey).(int64)
	id := chi.URLParam(r, "id")
	if id == "" {
		h.writeError(w, http.StatusBadRequest, "userbot id is required")
		return
	}

	ip := r.RemoteAddr
	err := h.ownerService.DeleteUserbot(r.Context(), id, adminID, ip)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ─── Ads Management ─────────────────────────────────────────────────────────

func (h *OwnerHandler) UploadAdImage(w http.ResponseWriter, r *http.Request) {
	adminID, _ := r.Context().Value(middleware.UserIDKey).(int64)

	// Max 5 MB form
	if err := r.ParseMultipartForm(5 * 1024 * 1024); err != nil {
		h.writeError(w, http.StatusBadRequest, "file size exceeds 5MB limit")
		return
	}

	file, _, err := r.FormFile("image")
	if err != nil {
		file, _, err = r.FormFile("file")
	}
	if err != nil {
		h.writeError(w, http.StatusBadRequest, "image file is required in 'image' form field")
		return
	}
	defer file.Close()

	slot := r.FormValue("slot")
	if slot == "" {
		slot = "dashboard_banner"
	}

	ip := r.RemoteAddr
	processed, err := h.ownerService.UploadAdImage(r.Context(), file, slot, adminID, ip)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, processed)
}

func (h *OwnerHandler) CreateAdCampaign(w http.ResponseWriter, r *http.Request) {
	adminID, _ := r.Context().Value(middleware.UserIDKey).(int64)
	var ad model.AdCampaign
	if err := json.NewDecoder(r.Body).Decode(&ad); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	ip := r.RemoteAddr
	if err := h.ownerService.CreateAdCampaign(r.Context(), &ad, adminID, ip); err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusCreated, ad)
}

func (h *OwnerHandler) ListAdCampaigns(w http.ResponseWriter, r *http.Request) {
	slot := r.URL.Query().Get("slot")
	campaigns, err := h.ownerService.ListAdCampaigns(r.Context(), slot)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, campaigns)
}

func (h *OwnerHandler) UpdateAdCampaign(w http.ResponseWriter, r *http.Request) {
	adminID, _ := r.Context().Value(middleware.UserIDKey).(int64)
	id := chi.URLParam(r, "id")
	var ad model.AdCampaign
	if err := json.NewDecoder(r.Body).Decode(&ad); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	ad.ID = id

	ip := r.RemoteAddr
	if err := h.ownerService.UpdateAdCampaign(r.Context(), &ad, adminID, ip); err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, ad)
}

func (h *OwnerHandler) DeleteAdCampaign(w http.ResponseWriter, r *http.Request) {
	adminID, _ := r.Context().Value(middleware.UserIDKey).(int64)
	id := chi.URLParam(r, "id")
	if id == "" {
		h.writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	ip := r.RemoteAddr
	if err := h.ownerService.DeleteAdCampaign(r.Context(), id, adminID, ip); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *OwnerHandler) TrackAdImpression(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_ = h.ownerService.TrackAdImpression(r.Context(), id)
	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *OwnerHandler) TrackAdClick(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_ = h.ownerService.TrackAdClick(r.Context(), id)
	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ─── Settings ───────────────────────────────────────────────────────────────

func (h *OwnerHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.ownerService.GetSystemSettings(r.Context())
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, settings)
}

func (h *OwnerHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req model.SystemSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	ip := r.RemoteAddr
	ua := r.Header.Get("User-Agent")

	err := h.ownerService.UpdateSystemSettings(r.Context(), &req, adminID, ip, ua)
	if err != nil {
		if strings.Contains(err.Error(), "OPTIMISTIC_LOCK_CONFLICT") {
			h.writeError(w, http.StatusConflict, err.Error())
			return
		}
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ─── Health & Metrics ───────────────────────────────────────────────────────

func (h *OwnerHandler) GetHealth(w http.ResponseWriter, r *http.Request) {
	metrics, err := h.ownerService.GetSystemHealthMetrics(r.Context())
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, metrics)
}

func (h *OwnerHandler) GetSystemErrors(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 100
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = min(l, 500)
	}

	errorsList, err := h.ownerService.GetSystemErrors(r.Context(), limit)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, errorsList)
}

// ─── Combos & Promos & Quests ───────────────────────────────────────────────

func (h *OwnerHandler) ListCombos(w http.ResponseWriter, r *http.Request) {
	combos, err := h.ownerService.AdminListCombos(r.Context())
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, combos)
}

func (h *OwnerHandler) UpsertCombo(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Date   string `json:"date"`
		Word   string `json:"word"`
		Reward int64  `json:"reward"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.Date == "" || req.Word == "" {
		h.writeError(w, http.StatusBadRequest, "date and word are required")
		return
	}

	err := h.ownerService.AdminCreateCombo(r.Context(), req.Date, req.Word, req.Reward)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *OwnerHandler) CreatePromo(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		Code         string     `json:"code"`
		RewardAmount float64    `json:"reward_amount"`
		MaxUses      int        `json:"max_uses"`
		ExpiresAt    *time.Time `json:"expires_at"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	ip := r.RemoteAddr
	ua := r.Header.Get("User-Agent")

	err := h.ownerService.CreatePromoCode(r.Context(), adminID, req.Code, req.RewardAmount, req.MaxUses, req.ExpiresAt, ip, ua)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusCreated, map[string]bool{"success": true})
}

func (h *OwnerHandler) ListPromos(w http.ResponseWriter, r *http.Request) {
	list, err := h.ownerService.ListPromoCodes(r.Context())
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, list)
}

func (h *OwnerHandler) DeletePromo(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	code := chi.URLParam(r, "code")
	if code == "" {
		h.writeError(w, http.StatusBadRequest, "code is required")
		return
	}

	ip := r.RemoteAddr
	ua := r.Header.Get("User-Agent")

	err := h.ownerService.DeletePromoCode(r.Context(), adminID, code, ip, ua)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *OwnerHandler) RedeemPromo(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		h.writeError(w, http.StatusBadRequest, "code is required")
		return
	}

	if err := h.ownerService.RedeemPromoCode(r.Context(), userID, req.Code); err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *OwnerHandler) ListQuests(w http.ResponseWriter, r *http.Request) {
	quests, err := h.ownerService.ListAllQuests(r.Context())
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, quests)
}

func (h *OwnerHandler) CreateQuest(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var q model.Quest
	if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	ip := r.RemoteAddr
	ua := r.Header.Get("User-Agent")

	err := h.ownerService.CreateQuest(r.Context(), adminID, q, ip, ua)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusCreated, map[string]bool{"success": true})
}

func (h *OwnerHandler) UpdateQuest(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var q model.Quest
	if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	key := chi.URLParam(r, "key")
	if key != "" {
		q.Key = key
	}

	ip := r.RemoteAddr
	ua := r.Header.Get("User-Agent")

	err := h.ownerService.UpdateQuest(r.Context(), adminID, q, ip, ua)
	if err != nil {
		h.writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *OwnerHandler) DeleteQuest(w http.ResponseWriter, r *http.Request) {
	adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
	if !ok {
		h.writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	key := chi.URLParam(r, "key")
	if key == "" {
		h.writeError(w, http.StatusBadRequest, "key is required")
		return
	}

	ip := r.RemoteAddr
	ua := r.Header.Get("User-Agent")

	err := h.ownerService.DeleteQuest(r.Context(), adminID, key, ip, ua)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}


