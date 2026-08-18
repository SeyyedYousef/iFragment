package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"
	"ifragment-backend/internal/service/payment"
)

type BotMgmtHandler struct {
	svc            *botmgmt.BotService
	paymentService *payment.StarsService
}

func NewBotMgmtHandler(svc *botmgmt.BotService, paymentSvc *payment.StarsService) *BotMgmtHandler {
	return &BotMgmtHandler{
		svc:            svc,
		paymentService: paymentSvc,
	}
}

func (h *BotMgmtHandler) getUserID(r *http.Request) int64 {
	id, _ := middleware.GetUserID(r.Context())
	return id
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

func (h *BotMgmtHandler) DeleteGroup(w http.ResponseWriter, r *http.Request) {
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

	if err := h.svc.DeleteGroup(r.Context(), groupID, userID); err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to delete group", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
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
	GroupID         string `json:"group_id"`
	PackageID       string `json:"package_id"`
	DiscountPercent int    `json:"discount_percent,omitempty"`
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

func (h *BotMgmtHandler) SubscribeWithAirdrop(w http.ResponseWriter, r *http.Request) {
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

	if err := h.svc.SubscribeWithAirdrop(r.Context(), userID, groupID, req.PackageID); err != nil {
		RespondError(w, r, http.StatusPaymentRequired, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "subscribed_via_airdrop"})
}

func (h *BotMgmtHandler) SubscribeStarsInvoice(w http.ResponseWriter, r *http.Request) {
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

	pkg := h.svc.GetPackageByID(req.PackageID)
	if pkg == nil {
		RespondError(w, r, http.StatusBadRequest, "invalid package", nil)
		return
	}

	group, err := h.svc.GetGroup(r.Context(), groupID, userID)
	if err != nil {
		RespondError(w, r, http.StatusForbidden, "access denied to group", err)
		return
	}

	finalStars := pkg.PriceStars
	if req.DiscountPercent > 0 {
		discountPercent := req.DiscountPercent
		if discountPercent > 70 {
			discountPercent = 70
		}
		savedStars := (pkg.PriceStars * discountPercent) / 100
		finalStars = pkg.PriceStars - savedStars
		if finalStars < 1 {
			finalStars = 1
		}
		requiredCoins := float64(savedStars * 1032)

		tx, err := h.svc.BotRepo().DB().Pool.Begin(r.Context())
		if err != nil {
			RespondError(w, r, http.StatusInternalServerError, "failed to start transaction", err)
			return
		}
		defer tx.Rollback(r.Context())

		if err := h.svc.BotRepo().DB().DeductCreditsFIFO(r.Context(), tx, userID, requiredCoins); err != nil {
			RespondError(w, r, http.StatusBadRequest, err.Error(), err)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			RespondError(w, r, http.StatusInternalServerError, "failed to commit credit deduction", err)
			return
		}
	}

	title := fmt.Sprintf("Subscription: %s", group.ChatTitle)
	desc := fmt.Sprintf("%s subscription for %s", pkg.Name, group.ChatTitle)
	payload := fmt.Sprintf("sub_stars_%s_%s", groupID.String(), pkg.ID)

	link, err := h.paymentService.CreateInvoiceLink(title, desc, payload, finalStars)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to generate invoice link", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"invoice_link": link,
		"final_stars":  finalStars,
	})
}

type ChannelSubscribeRequest struct {
	ChannelID       string `json:"channel_id"`
	PackageID       string `json:"package_id"`
	DiscountPercent int    `json:"discount_percent,omitempty"`
}

func (h *BotMgmtHandler) SubscribeChannel(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	var req ChannelSubscribeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	channelID, err := uuid.Parse(req.ChannelID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	if err := h.svc.SubscribeChannel(r.Context(), userID, channelID, req.PackageID); err != nil {
		RespondError(w, r, http.StatusPaymentRequired, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "subscribed"})
}

func (h *BotMgmtHandler) SubscribeChannelWithAirdrop(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	var req ChannelSubscribeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	channelID, err := uuid.Parse(req.ChannelID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	if err := h.svc.SubscribeChannelWithAirdrop(r.Context(), userID, channelID, req.PackageID); err != nil {
		RespondError(w, r, http.StatusPaymentRequired, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "subscribed_via_airdrop"})
}

func (h *BotMgmtHandler) SubscribeChannelStarsInvoice(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	var req ChannelSubscribeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	channelID, err := uuid.Parse(req.ChannelID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	pkg := h.svc.GetPackageByID(req.PackageID)
	if pkg == nil {
		RespondError(w, r, http.StatusBadRequest, "invalid package", nil)
		return
	}

	finalStars := pkg.PriceStars
	if req.DiscountPercent > 0 {
		discountPercent := req.DiscountPercent
		if discountPercent > 70 {
			discountPercent = 70
		}
		savedStars := (pkg.PriceStars * discountPercent) / 100
		finalStars = pkg.PriceStars - savedStars
		if finalStars < 1 {
			finalStars = 1
		}
		requiredCoins := float64(savedStars * 1032)

		tx, err := h.svc.BotRepo().DB().Pool.Begin(r.Context())
		if err != nil {
			RespondError(w, r, http.StatusInternalServerError, "failed to start transaction", err)
			return
		}
		defer tx.Rollback(r.Context())

		if err := h.svc.BotRepo().DB().DeductCreditsFIFO(r.Context(), tx, userID, requiredCoins); err != nil {
			RespondError(w, r, http.StatusBadRequest, err.Error(), err)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			RespondError(w, r, http.StatusInternalServerError, "failed to commit credit deduction", err)
			return
		}
	}

	title := "Channel Subscription"
	desc := fmt.Sprintf("%s subscription for your channel", pkg.Name)
	payload := fmt.Sprintf("sub_chan_stars_%s_%s", channelID.String(), pkg.ID)

	link, err := h.paymentService.CreateInvoiceLink(title, desc, payload, finalStars)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to generate invoice link", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"invoice_link": link,
		"final_stars":  finalStars,
	})
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
	growth, err := h.svc.GetGrowthTimeline(r.Context(), groupID, days)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get growth timeline", err)
		return
	}
	activity, err := h.svc.GetActivityTimeline(r.Context(), groupID, days)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get activity timeline", err)
		return
	}
	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"summary":  summary,
		"growth":   growth,
		"activity": activity,
	})
}

// ─── FRG Balance ──────────────────────────────────────────

// ─── Marketplace ──────────────────────────────────────────

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
