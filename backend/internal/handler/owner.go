package handler

import (
	"fmt"
	"log/slog"

	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

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
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if req.InitData == "" || req.Password == "" {
		RespondError(w, r, http.StatusBadRequest, "init_data and password are required", nil)
		return
	}

	tgUserID, err := middleware.VerifyInitDataAndExtractUserID(req.InitData)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "Invalid Telegram authentication data: "+err.Error(), err)
		return
	}

	ip := middleware.GetRealIP(r)
	ua := r.UserAgent()

	token, err := h.srv.Authenticate(r.Context(), tgUserID, req.Password, ip, ua)
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

// FlagUser Request struct
type FlagUserRequest struct {
	UserID      int64  `json:"user_id"`
	IsFlagged   bool   `json:"is_flagged"`
	FraudReason string `json:"fraud_reason"`
}

func (h *OwnerHandler) FlagUser(w http.ResponseWriter, r *http.Request) {
	ownerID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, err.Error(), err)
		return
	}

	var req FlagUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	ip := middleware.GetRealIP(r)
	ua := r.UserAgent()

	if err := h.srv.FlagUser(r.Context(), ownerID, req.UserID, req.IsFlagged, req.FraudReason, ip, ua); err != nil {
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

func (h *OwnerHandler) AdminListCombos(w http.ResponseWriter, r *http.Request) {
	combos, err := h.srv.AdminListCombos(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get combos", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(combos)
}

func (h *OwnerHandler) AdminCreateCombo(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Date         string `json:"date"`
		SecretWord   string `json:"secret_word"`
		RewardAmount int64  `json:"reward_amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request", err)
		return
	}
	if req.Date == "" || req.SecretWord == "" || req.RewardAmount <= 0 {
		RespondError(w, r, http.StatusBadRequest, "invalid parameters", nil)
		return
	}

	err := h.srv.AdminCreateCombo(r.Context(), req.Date, req.SecretWord, req.RewardAmount)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success": true}`))
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

// UserbotSendCode initiates the MTProto Userbot login process
func (h *OwnerHandler) UserbotSendCode(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Phone string `json:"phone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}
	if req.Phone == "" {
		RespondError(w, r, http.StatusBadRequest, "phone is required", nil)
		return
	}

	hash, err := h.srv.UserbotSendCode(r.Context(), req.Phone)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"phone_code_hash": hash})
}

// UserbotVerifyCode completes the MTProto Userbot login process
func (h *OwnerHandler) UserbotVerifyCode(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Phone         string `json:"phone"`
		Code          string `json:"code"`
		PhoneCodeHash string `json:"phone_code_hash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}
	if req.Phone == "" || req.Code == "" || req.PhoneCodeHash == "" {
		RespondError(w, r, http.StatusBadRequest, "phone, code, and phone_code_hash are required", nil)
		return
	}

	err := h.srv.UserbotVerifyCode(r.Context(), req.Phone, req.Code, req.PhoneCodeHash)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *OwnerHandler) ListUserbots(w http.ResponseWriter, r *http.Request) {
	bots, err := h.srv.ListUserbots(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}
	RespondJSON(w, http.StatusOK, bots)
}

func (h *OwnerHandler) DeleteUserbot(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		RespondError(w, r, http.StatusBadRequest, "Missing ID", nil)
		return
	}
	if err := h.srv.DeleteUserbot(r.Context(), id); err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Broadcasts
func (h *OwnerHandler) CreateBroadcast(w http.ResponseWriter, r *http.Request) {
	ownerID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, err.Error(), err)
		return
	}

	var req struct {
		TargetAudience string `json:"target_audience"`
		Message        string `json:"message"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	id, err := h.srv.CreateBroadcast(r.Context(), ownerID, req.TargetAudience, req.Message, middleware.GetRealIP(r), r.UserAgent())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"id": id, "status": "pending"})
}

func (h *OwnerHandler) ListBroadcasts(w http.ResponseWriter, r *http.Request) {
	list, err := h.srv.ListBroadcasts(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	if list == nil {
		list = []model.Broadcast{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

// AdjustAirdropCoins Handler
func (h *OwnerHandler) AdjustAirdropCoins(w http.ResponseWriter, r *http.Request) {
	var req service.AdjustAirdropCoinsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	ownerID, _ := middleware.GetUserID(r.Context())
	ip := middleware.GetRealIP(r)

	newBalance, err := h.srv.AdjustAirdropCoins(r.Context(), req, ownerID, ip)
	if err != nil {
		slog.Error("Failed to adjust airdrop coins", "error", err)
		http.Error(w, "Failed to adjust airdrop coins", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"success":true,"new_balance":%f}`, newBalance)))
}

// AddEntityCredit Handler
func (h *OwnerHandler) AddEntityCredit(w http.ResponseWriter, r *http.Request) {
	var req service.AddEntityCreditRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	ownerID, _ := middleware.GetUserID(r.Context())
	ip := middleware.GetRealIP(r)

	err := h.srv.AddEntityCredit(r.Context(), req, ownerID, ip)
	if err != nil {
		slog.Error("Failed to add credit to entity", "error", err)
		http.Error(w, "Failed to add credit", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true}`))
}

func (h *OwnerHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.srv.GetSystemSettings(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to get settings", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

// ─── Finance & Subscriptions ────────────────────────────────────────────────
func (h *OwnerHandler) GetFinanceOrders(w http.ResponseWriter, r *http.Request) {
	limit := 50
	offset := 0
	// parsing limit and offset from query can be added if needed
	records, err := h.srv.GetOrdersList(r.Context(), limit, offset)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to get orders", err)
		return
	}
	if records == nil {
		records = []model.OrderRecord{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(records)
}

func (h *OwnerHandler) GetPremiumEntities(w http.ResponseWriter, r *http.Request) {
	entities, err := h.srv.GetPremiumEntities(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to get premium entities", err)
		return
	}
	if entities == nil {
		entities = []model.PremiumEntity{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entities)
}

// ─── System Health & Logs ───────────────────────────────────────────────────
func (h *OwnerHandler) GetSystemErrors(w http.ResponseWriter, r *http.Request) {
	limit := 50
	logs, err := h.srv.GetSystemErrors(r.Context(), limit)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to get system errors", err)
		return
	}
	if logs == nil {
		logs = []model.SystemErrorLog{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

func (h *OwnerHandler) GetSystemHealthMetrics(w http.ResponseWriter, r *http.Request) {
	metrics, err := h.srv.GetSystemHealthMetrics(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to get health metrics", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

// ─── Entities (Channels & Groups) ───────────────────────────────────────────
func (h *OwnerHandler) GetAllChannels(w http.ResponseWriter, r *http.Request) {
	limit := 100
	offset := 0
	entities, err := h.srv.GetAllChannels(r.Context(), limit, offset)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to get channels", err)
		return
	}
	if entities == nil {
		entities = []model.EntityRecord{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entities)
}

func (h *OwnerHandler) GetAllGroups(w http.ResponseWriter, r *http.Request) {
	limit := 100
	offset := 0
	entities, err := h.srv.GetAllGroups(r.Context(), limit, offset)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to get groups", err)
		return
	}
	if entities == nil {
		entities = []model.EntityRecord{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entities)
}

func (h *OwnerHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	ownerID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, err.Error(), err)
		return
	}

	var req model.SystemSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	err = h.srv.UpdateSystemSettings(r.Context(), &req, ownerID, middleware.GetRealIP(r), r.UserAgent())
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
