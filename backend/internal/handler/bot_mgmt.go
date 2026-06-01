package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"
)

type BotMgmtHandler struct {
	svc         *botmgmt.BotService
	marketplace *botmgmt.MarketplaceService
}

func NewBotMgmtHandler(svc *botmgmt.BotService, marketplace *botmgmt.MarketplaceService) *BotMgmtHandler {
	return &BotMgmtHandler{svc: svc, marketplace: marketplace}
}

func (h *BotMgmtHandler) getUserID(r *http.Request) int64 {
	user, ok := r.Context().Value(middleware.UserContextKey).(map[string]interface{})
	if !ok {
		return 0
	}
	idVal, ok := user["id"]
	if !ok {
		return 0
	}
	switch v := idVal.(type) {
	case float64:
		return int64(v)
	case int64:
		return v
	case int:
		return int64(v)
	default:
		return 0
	}
}

// ─── Bot CRUD ─────────────────────────────────────────────

func (h *BotMgmtHandler) ListBots(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	bots, err := h.svc.ListBots(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to list bots", err)
		return
	}

	RespondJSON(w, http.StatusOK, bots)
}

type RegisterBotRequest struct {
	Token    string `json:"token"`
	Username string `json:"username"`
	Name     string `json:"name"`
	BotID    int64  `json:"bot_id"`
}

func (h *BotMgmtHandler) RegisterBot(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	var req RegisterBotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	if req.Token == "" || req.Username == "" || req.BotID == 0 {
		RespondError(w, r, http.StatusBadRequest, "token, username, and bot_id are required", nil)
		return
	}

	bot, err := h.svc.RegisterBot(r.Context(), userID, req.Token, req.Username, req.Name, req.BotID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to register bot", err)
		return
	}

	RespondJSON(w, http.StatusCreated, bot)
}

func (h *BotMgmtHandler) GetBot(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	botID, err := uuid.Parse(chi.URLParam(r, "botID"))
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid bot ID", err)
		return
	}

	bot, err := h.svc.GetBot(r.Context(), botID, userID)
	if err != nil {
		RespondError(w, r, http.StatusNotFound, "bot not found", err)
		return
	}

	RespondJSON(w, http.StatusOK, bot)
}

func (h *BotMgmtHandler) RevokeBot(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	botID, err := uuid.Parse(chi.URLParam(r, "botID"))
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid bot ID", err)
		return
	}

	if err := h.svc.RevokeBot(r.Context(), botID, userID); err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to revoke bot", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "revoked"})
}

// ─── Groups ───────────────────────────────────────────────

func (h *BotMgmtHandler) ListGroups(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	botID, err := uuid.Parse(chi.URLParam(r, "botID"))
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid bot ID", err)
		return
	}

	groups, err := h.svc.ListGroups(r.Context(), botID, userID)
	if err != nil {
		RespondError(w, r, http.StatusForbidden, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, groups)
}

func (h *BotMgmtHandler) GetGroup(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	groupID, err := uuid.Parse(chi.URLParam(r, "groupID"))
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid group ID", err)
		return
	}
	group, err := h.svc.GetGroup(r.Context(), groupID, userID)
	if err != nil {
		RespondError(w, r, http.StatusForbidden, "access denied", err)
		return
	}
	RespondJSON(w, http.StatusOK, group)
}

// ─── Settings ─────────────────────────────────────────────

func (h *BotMgmtHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	groupID, err := uuid.Parse(chi.URLParam(r, "groupID"))
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid group ID", err)
		return
	}
	settings, err := h.svc.GetSettings(r.Context(), groupID, userID)
	if err != nil {
		RespondError(w, r, http.StatusForbidden, "access denied", err)
		return
	}
	RespondJSON(w, http.StatusOK, settings)
}

type UpdateSettingsRequest struct {
	Category string          `json:"category"`
	Data     json.RawMessage `json:"data"`
	Version  int             `json:"version"`
}

func (h *BotMgmtHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	groupID, err := uuid.Parse(chi.URLParam(r, "groupID"))
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid group ID", err)
		return
	}

	var req UpdateSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	settings, err := h.svc.UpdateSettings(r.Context(), groupID, req.Category, req.Data, userID, req.Version)
	if err != nil {
		if err == repository.ErrOptimisticLockConflict {
			RespondError(w, r, http.StatusConflict, "version_mismatch", err)
			return
		}
		if strings.Contains(err.Error(), "validation failed") {
			RespondError(w, r, http.StatusBadRequest, err.Error(), err)
			return
		}
		RespondError(w, r, http.StatusInternalServerError, "failed to update settings", err)
		return
	}

	RespondJSON(w, http.StatusOK, settings)
}

// ─── Subscription ─────────────────────────────────────────

func (h *BotMgmtHandler) GetPackages(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusOK, h.svc.GetPackages())
}

type SubscribeRequest struct {
	GroupID   string `json:"group_id"`
	PackageID string `json:"package_id"`
}

func (h *BotMgmtHandler) Subscribe(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	var req SubscribeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	groupID, err := uuid.Parse(req.GroupID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid group ID", err)
		return
	}

	if err := h.svc.Subscribe(r.Context(), userID, groupID, req.PackageID); err != nil {
		RespondError(w, r, http.StatusPaymentRequired, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "subscribed"})
}

// ─── Analytics ────────────────────────────────────────────

func (h *BotMgmtHandler) GetAnalytics(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	groupID, err := uuid.Parse(chi.URLParam(r, "groupID"))
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid group ID", err)
		return
	}
	daysStr := r.URL.Query().Get("days")
	days := 7
	if daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil && d > 0 && d <= 90 {
			days = d
		}
	}
	summary, err := h.svc.GetAnalytics(r.Context(), groupID, userID, days)
	if err != nil {
		RespondError(w, r, http.StatusForbidden, "access denied", err)
		return
	}
	growth, _ := h.svc.GetGrowthTimeline(r.Context(), groupID, days)
	activity, _ := h.svc.GetActivityTimeline(r.Context(), groupID, days)
	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"summary":  summary,
		"growth":   growth,
		"activity": activity,
	})
}

// ─── FRG Balance ──────────────────────────────────────────

func (h *BotMgmtHandler) GetFRGBalance(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	balance, err := h.svc.GetFRGBalance(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get balance", err)
		return
	}
	RespondJSON(w, http.StatusOK, balance)
}

func (h *BotMgmtHandler) GetFRGTransactions(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	limit := 20
	offset := 0
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 && l <= 100 {
		limit = l
	}
	if o, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && o >= 0 {
		offset = o
	}

	txs, err := h.svc.GetFRGTransactions(r.Context(), userID, limit, offset)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get transactions", err)
		return
	}
	RespondJSON(w, http.StatusOK, txs)
}

// ─── Marketplace ──────────────────────────────────────────

func (h *BotMgmtHandler) GetPurchaseOptions(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusOK, h.marketplace.GetPurchaseOptions())
}

type PurchaseStarsRequest struct {
	OptionID         string `json:"option_id"`
	TelegramChargeID string `json:"telegram_charge_id"`
}

func (h *BotMgmtHandler) PurchaseWithStars(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	var req PurchaseStarsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	tx, err := h.marketplace.PurchaseWithStars(r.Context(), userID, req.OptionID, req.TelegramChargeID)
	if err != nil {
		RespondError(w, r, http.StatusPaymentRequired, err.Error(), err)
		return
	}
	RespondJSON(w, http.StatusOK, tx)
}

type PurchaseToncoinRequest struct {
	OptionID string `json:"option_id"`
	TxHash   string `json:"tx_hash"`
}

func (h *BotMgmtHandler) PurchaseWithToncoin(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	var req PurchaseToncoinRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	tx, err := h.marketplace.PurchaseWithToncoin(r.Context(), userID, req.OptionID, req.TxHash)
	if err != nil {
		RespondError(w, r, http.StatusPaymentRequired, err.Error(), err)
		return
	}
	RespondJSON(w, http.StatusOK, tx)
}

type ConvertAirdropRequest struct {
	Coins float64 `json:"coins"`
}

func (h *BotMgmtHandler) ConvertAirdropCoins(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	var req ConvertAirdropRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	tx, err := h.marketplace.ConvertAirdropCoins(r.Context(), userID, req.Coins)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}
	RespondJSON(w, http.StatusOK, tx)
}

// ─── Audit Logs ───────────────────────────────────────────

func (h *BotMgmtHandler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	groupID, err := uuid.Parse(chi.URLParam(r, "groupID"))
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid group ID", err)
		return
	}
	limit := 50
	offset := 0
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 && l <= 100 {
		limit = l
	}
	if o, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && o >= 0 {
		offset = o
	}
	logs, err := h.svc.GetAuditLog(r.Context(), groupID, userID, limit, offset)
	if err != nil {
		RespondError(w, r, http.StatusForbidden, "access denied", err)
		return
	}
	RespondJSON(w, http.StatusOK, logs)
}
