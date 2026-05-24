package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/channelmgmt"
)

type ChannelHandler struct {
	svc *channelmgmt.ChannelService
}

func NewChannelHandler(svc *channelmgmt.ChannelService) *ChannelHandler {
	return &ChannelHandler{svc: svc}
}

func (h *ChannelHandler) getUserID(r *http.Request) int64 {
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

func (h *ChannelHandler) ListChannels(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	botIDStr := r.URL.Query().Get("bot_id")
	var botID uuid.UUID
	var err error
	if botIDStr != "" && !strings.HasPrefix(botIDStr, "guest") && !strings.HasPrefix(botIDStr, "mock") {
		botID, err = uuid.Parse(botIDStr)
		if err != nil {
			RespondError(w, r, http.StatusBadRequest, "invalid bot_id", err)
			return
		}
	}

	limitStr := r.URL.Query().Get("limit")
	cursorStr := r.URL.Query().Get("cursor")

	var cursor *time.Time
	if cursorStr != "" {
		if t, err := time.Parse(time.RFC3339, cursorStr); err == nil {
			cursor = &t
		}
	}

	limit := 20
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
			if limit > 100 {
				limit = 100
			}
		}
	}

	channels, nextCursor, err := h.svc.ListChannels(r.Context(), userID, botID, cursor, limit)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to list channels", err)
		return
	}

	var nextCursorStr *string
	if nextCursor != nil {
		s := nextCursor.Format(time.RFC3339)
		nextCursorStr = &s
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":        channels,
		"next_cursor": nextCursorStr,
	})
}

type ConnectChannelRequest struct {
	BotID    string `json:"bot_id"`
	Username string `json:"username"`
}

func (h *ChannelHandler) ConnectChannel(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	var req ConnectChannelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	botID, err := uuid.Parse(req.BotID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid bot_id", err)
		return
	}

	ch, err := h.svc.ConnectChannel(r.Context(), userID, botID, req.Username)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	respondJSON(w, http.StatusCreated, ch)
}

func (h *ChannelHandler) GetChannel(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	ch, err := h.svc.GetChannel(r.Context(), userID, channelID)
	if err != nil {
		RespondError(w, r, http.StatusNotFound, "channel not found", err)
		return
	}

	respondJSON(w, http.StatusOK, ch)
}

func (h *ChannelHandler) DisconnectChannel(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	if err := h.svc.DisconnectChannel(r.Context(), userID, channelID); err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to disconnect channel", err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "disconnected"})
}

func (h *ChannelHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	settings, err := h.svc.GetSettings(r.Context(), userID, channelID)
	if err != nil {
		RespondError(w, r, http.StatusForbidden, "access denied", err)
		return
	}

	respondJSON(w, http.StatusOK, settings)
}

type UpdateChannelSettingsRequest struct {
	Category string          `json:"category"`
	Data     json.RawMessage `json:"data"`
	Version  int             `json:"version"`
}

func (h *ChannelHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	var req UpdateChannelSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	settings, err := h.svc.UpdateSettings(r.Context(), userID, channelID, req.Category, req.Data, req.Version)
	if err != nil {
		if errors.Is(err, repository.ErrOptimisticLockConflict) {
			RespondError(w, r, http.StatusConflict, "optimistic lock conflict: settings have been updated by another admin", err)
			return
		}
		RespondError(w, r, http.StatusInternalServerError, "failed to update settings", err)
		return
	}

	respondJSON(w, http.StatusOK, settings)
}

func (h *ChannelHandler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	limit := 20
	offset := 0

	if qLimit := r.URL.Query().Get("limit"); qLimit != "" {
		if val, err := strconv.Atoi(qLimit); err == nil {
			limit = val
		}
	}
	if qOffset := r.URL.Query().Get("offset"); qOffset != "" {
		if val, err := strconv.Atoi(qOffset); err == nil {
			offset = val
		}
	}

	logs, err := h.svc.GetAuditLogs(r.Context(), userID, channelID, limit, offset)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get audit logs", err)
		return
	}

	respondJSON(w, http.StatusOK, logs)
}

func (h *ChannelHandler) GetAnalytics(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	days := 7
	if qDays := r.URL.Query().Get("days"); qDays != "" {
		if val, err := strconv.Atoi(qDays); err == nil {
			days = val
		}
	}

	analytics, err := h.svc.GetAnalytics(r.Context(), userID, channelID, days)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get analytics data", err)
		return
	}

	respondJSON(w, http.StatusOK, analytics)
}

type CreatePostRequest struct {
	Text        string     `json:"text"`
	ScheduledAt *time.Time `json:"scheduled_at,omitempty"`
}

func (h *ChannelHandler) CreatePost(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	var req CreatePostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	if len(req.Text) > 4096 {
		RespondError(w, r, http.StatusBadRequest, "post text length exceeds Telegram's 4096 character limit", nil)
		return
	}

	post := &repository.ChannelPost{
		ChannelID:   channelID,
		Text:        req.Text,
		ScheduledAt: req.ScheduledAt,
	}

	err = h.svc.CreatePost(r.Context(), userID, post)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	respondJSON(w, http.StatusCreated, post)
}

func (h *ChannelHandler) GetForwardingRules(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	rules, err := h.svc.GetForwardingRules(r.Context(), userID, channelID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get forwarding rules", err)
		return
	}

	respondJSON(w, http.StatusOK, rules)
}

func (h *ChannelHandler) CreateForwardingRule(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	var rule repository.ChannelForwardingRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	rule.ChannelID = channelID

	err = h.svc.CreateForwardingRule(r.Context(), userID, &rule)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	respondJSON(w, http.StatusCreated, rule)
}

func (h *ChannelHandler) UpdateForwardingRule(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	ruleIDStr := chi.URLParam(r, "ruleID")
	ruleID, err := uuid.Parse(ruleIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid rule ID", err)
		return
	}

	var rule repository.ChannelForwardingRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	rule.ID = ruleID
	rule.ChannelID = channelID

	err = h.svc.UpdateForwardingRule(r.Context(), userID, &rule)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	respondJSON(w, http.StatusOK, rule)
}

func (h *ChannelHandler) DeleteForwardingRule(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	ruleIDStr := chi.URLParam(r, "ruleID")
	ruleID, err := uuid.Parse(ruleIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid rule ID", err)
		return
	}

	err = h.svc.DeleteForwardingRule(r.Context(), userID, channelID, ruleID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *ChannelHandler) SyncAdmins(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	err = h.svc.SyncAdmins(r.Context(), userID, channelID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "synchronized"})
}

func (h *ChannelHandler) GetAdmins(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	admins, err := h.svc.GetAdmins(r.Context(), userID, channelID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	respondJSON(w, http.StatusOK, admins)
}

func (h *ChannelHandler) GetButtons(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	buttons, err := h.svc.GetButtons(r.Context(), userID, channelID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	respondJSON(w, http.StatusOK, buttons)
}

func (h *ChannelHandler) SaveButtons(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid channel ID", err)
		return
	}

	var buttons []repository.ChannelInlineButton
	if err := json.NewDecoder(r.Body).Decode(&buttons); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	for _, btn := range buttons {
		if btn.Type == "url" {
			u, err := url.ParseRequestURI(btn.Value)
			if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
				RespondError(w, r, http.StatusBadRequest, "invalid URL in buttons: must be a valid http or https address", err)
				return
			}
		}
	}

	err = h.svc.SaveButtons(r.Context(), userID, channelID, buttons)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, err.Error(), err)
		return
	}

	respondJSON(w, http.StatusOK, buttons)
}


