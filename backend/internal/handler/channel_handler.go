package handler

import (
	"encoding/json"
	"errors"
	"fmt"
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

// maxBodySize limits request body to 1MB to prevent OOM denial-of-service
const maxBodySize = 1 << 20

type ChannelHandler struct {
	svc *channelmgmt.ChannelService
}

func NewChannelHandler(svc *channelmgmt.ChannelService) *ChannelHandler {
	return &ChannelHandler{svc: svc}
}

func (h *ChannelHandler) getUserID(r *http.Request) int64 {
	id, _ := middleware.GetUserID(r.Context())
	return id
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
	if botIDStr != "" && botIDStr != "all" {
		botID, err = uuid.Parse(botIDStr)
		if err != nil {
			RespondError(w, r, http.StatusBadRequest, "invalid bot_id", err)
			return
		}
	}

	limitStr := r.URL.Query().Get("limit")
	cursorStr := r.URL.Query().Get("cursor")

	var cursor *time.Time
	var cursorID *uuid.UUID
	if cursorStr != "" {
		parts := strings.Split(cursorStr, "_")
		if len(parts) == 2 {
			if t, err := time.Parse(time.RFC3339, parts[0]); err == nil {
				cursor = &t
			}
			if u, err := uuid.Parse(parts[1]); err == nil {
				cursorID = &u
			}
		} else {
			if t, err := time.Parse(time.RFC3339, cursorStr); err == nil {
				cursor = &t
			}
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

	channels, nextCursor, nextCursorID, err := h.svc.ListChannels(r.Context(), userID, botID, cursor, cursorID, limit)
	if err != nil {
		h.respondServerError(w, r, "failed to list channels", err)
		return
	}

	var nextCursorStr *string
	if nextCursor != nil && nextCursorID != nil {
		s := fmt.Sprintf("%s_%s", nextCursor.Format(time.RFC3339), nextCursorID.String())
		nextCursorStr = &s
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
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

	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
	var req ConnectChannelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	var botID uuid.UUID
	if req.BotID != "auto" && req.BotID != "" {
		var err error
		botID, err = uuid.Parse(req.BotID)
		if err != nil {
			RespondError(w, r, http.StatusBadRequest, "invalid bot_id", err)
			return
		}
	}

	ch, err := h.svc.ConnectChannel(r.Context(), userID, botID, req.Username)
	if err != nil {
		h.respondServerError(w, r, "failed to connect channel", err)
		return
	}

	RespondJSON(w, http.StatusCreated, ch)
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
		h.respondServerError(w, r, "failed to get channel", err)
		return
	}

	RespondJSON(w, http.StatusOK, ch)
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
		h.respondServerError(w, r, "failed to disconnect channel", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "disconnected"})
}

func (h *ChannelHandler) VerifyChannel(w http.ResponseWriter, r *http.Request) {
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

	res, err := h.svc.VerifyChannel(r.Context(), userID, channelID)
	if err != nil {
		h.respondServerError(w, r, "failed to verify channel", err)
		return
	}

	RespondJSON(w, http.StatusOK, res)
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
		h.respondServerError(w, r, "failed to get settings", err)
		return
	}

	RespondJSON(w, http.StatusOK, settings)
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

	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
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
		h.respondServerError(w, r, "failed to update settings", err)
		return
	}

	RespondJSON(w, http.StatusOK, settings)
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
	if qLimit := r.URL.Query().Get("limit"); qLimit != "" {
		if val, err := strconv.Atoi(qLimit); err == nil {
			limit = val
			if limit <= 0 {
				limit = 20
			}
			if limit > 100 {
				limit = 100
			}
		}
	}

	cursorStr := r.URL.Query().Get("cursor")
	var cursor *time.Time
	var cursorID *uuid.UUID
	if cursorStr != "" {
		parts := strings.Split(cursorStr, "_")
		if len(parts) == 2 {
			if t, err := time.Parse(time.RFC3339, parts[0]); err == nil {
				cursor = &t
			}
			if u, err := uuid.Parse(parts[1]); err == nil {
				cursorID = &u
			}
		} else {
			if t, err := time.Parse(time.RFC3339, cursorStr); err == nil {
				cursor = &t
			}
		}
	}

	logs, err := h.svc.GetAuditLogs(r.Context(), userID, channelID, cursor, cursorID, limit)
	if err != nil {
		h.respondServerError(w, r, "failed to get audit logs", err)
		return
	}

	var nextCursorStr *string
	if len(logs) == limit && limit > 0 {
		lastLog := logs[len(logs)-1]
		s := fmt.Sprintf("%s_%s", lastLog.CreatedAt.Format(time.RFC3339), lastLog.ID.String())
		nextCursorStr = &s
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"data":        logs,
		"next_cursor": nextCursorStr,
	})
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
			if days <= 0 {
				days = 7
			}
			if days > 365 {
				days = 365
			}
		}
	}

	analytics, err := h.svc.GetAnalytics(r.Context(), userID, channelID, days)
	if err != nil {
		h.respondServerError(w, r, "failed to get analytics data", err)
		return
	}

	RespondJSON(w, http.StatusOK, analytics)
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

	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
	var req CreatePostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	if strings.TrimSpace(req.Text) == "" {
		RespondError(w, r, http.StatusBadRequest, "post text cannot be empty", nil)
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
		h.respondServerError(w, r, "failed to create post", err)
		return
	}

	RespondJSON(w, http.StatusCreated, post)
}

type SimulateAIRequest struct {
	Text   string `json:"text"`
	Action string `json:"action"`
}

func (h *ChannelHandler) SimulateAI(w http.ResponseWriter, r *http.Request) {
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

	var req SimulateAIRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	result, err := h.svc.SimulateAIPost(r.Context(), userID, channelID, req.Text, req.Action)
	if err != nil {
		h.respondServerError(w, r, "AI generation failed", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"text": result})
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
		h.respondServerError(w, r, "failed to get forwarding rules", err)
		return
	}

	RespondJSON(w, http.StatusOK, rules)
}

func (h *ChannelHandler) GetForwardingLogs(w http.ResponseWriter, r *http.Request) {
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

	logs, err := h.svc.GetForwardingLogs(r.Context(), userID, channelID)
	if err != nil {
		h.respondServerError(w, r, "failed to get forwarding logs", err)
		return
	}

	RespondJSON(w, http.StatusOK, logs)
}

func (h *ChannelHandler) VerifyForwardingTarget(w http.ResponseWriter, r *http.Request) {
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

	target := r.URL.Query().Get("target")
	if target == "" {
		RespondError(w, r, http.StatusBadRequest, "target is required", nil)
		return
	}

	chatResult, err := h.svc.VerifyForwardingTarget(r.Context(), userID, channelID, target)
	if err != nil {
		h.respondServerError(w, r, "failed to verify target", err)
		return
	}

	RespondJSON(w, http.StatusOK, chatResult)
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

	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
	var rule repository.ChannelForwardingRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	rule.ChannelID = channelID

	err = h.svc.CreateForwardingRule(r.Context(), userID, &rule)
	if err != nil {
		h.respondServerError(w, r, "failed to create forwarding rule", err)
		return
	}

	RespondJSON(w, http.StatusCreated, rule)
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

	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
	var rule repository.ChannelForwardingRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	rule.ID = ruleID
	rule.ChannelID = channelID

	err = h.svc.UpdateForwardingRule(r.Context(), userID, &rule)
	if err != nil {
		h.respondServerError(w, r, "failed to update forwarding rule", err)
		return
	}

	RespondJSON(w, http.StatusOK, rule)
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
		h.respondServerError(w, r, "failed to delete forwarding rule", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
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
		h.respondServerError(w, r, "failed to synchronize channel administrators", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "synchronized"})
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
		h.respondServerError(w, r, "failed to fetch channel administrators", err)
		return
	}

	RespondJSON(w, http.StatusOK, admins)
}

func (h *ChannelHandler) GetMembers(w http.ResponseWriter, r *http.Request) {
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

	members, err := h.svc.GetMembers(r.Context(), userID, channelID)
	if err != nil {
		h.respondServerError(w, r, "failed to fetch members", err)
		return
	}

	RespondJSON(w, http.StatusOK, members)
}

func (h *ChannelHandler) UpdateAdmin(w http.ResponseWriter, r *http.Request) {
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

	adminIDStr := chi.URLParam(r, "adminID")
	adminID, err := strconv.ParseInt(adminIDStr, 10, 64)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid admin ID", err)
		return
	}

	var req struct {
		CustomTitle string          `json:"custom_title"`
		Permissions map[string]bool `json:"permissions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid JSON body", err)
		return
	}

	err = h.svc.UpdateAdmin(r.Context(), userID, channelID, adminID, req.CustomTitle, req.Permissions)
	if err != nil {
		h.respondServerError(w, r, "failed to update admin", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *ChannelHandler) BanMember(w http.ResponseWriter, r *http.Request) {
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

	memberIDStr := chi.URLParam(r, "memberID")
	memberID, err := strconv.ParseInt(memberIDStr, 10, 64)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid member ID", err)
		return
	}

	if err := h.svc.BanMember(r.Context(), userID, channelID, memberID); err != nil {
		h.respondServerError(w, r, "failed to ban member", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "banned"})
}

func (h *ChannelHandler) RestrictMember(w http.ResponseWriter, r *http.Request) {
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

	memberIDStr := chi.URLParam(r, "memberID")
	memberID, err := strconv.ParseInt(memberIDStr, 10, 64)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid member ID", err)
		return
	}

	if err := h.svc.RestrictMember(r.Context(), userID, channelID, memberID); err != nil {
		h.respondServerError(w, r, "failed to restrict member", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "restricted"})
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
		h.respondServerError(w, r, "failed to fetch channel inline buttons", err)
		return
	}

	RespondJSON(w, http.StatusOK, buttons)
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

	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
	var buttons []repository.ChannelInlineButton
	if err := json.NewDecoder(r.Body).Decode(&buttons); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	for i, btn := range buttons {
		buttons[i].Title = strings.TrimSpace(btn.Title)
		if len(buttons[i].Title) == 0 {
			RespondError(w, r, http.StatusBadRequest, "button title cannot be empty", nil)
			return
		}
		if len(buttons[i].Title) > 64 {
			RespondError(w, r, http.StatusBadRequest, "button title cannot exceed 64 characters to avoid Telegram truncation", nil)
			return
		}

		// Strictly validate button types to prevent injection
		btnType := strings.ToLower(btn.Type)
		buttons[i].Type = btnType
		if btnType != "url" && btnType != "callback" && btnType != "share" && btnType != "webapp" && btnType != "payment" && btnType != "counter" {
			RespondError(w, r, http.StatusBadRequest, "invalid button type: must be url, callback, share, webapp, payment, or counter", nil)
			return
		}

		if btnType == "url" || btnType == "share" {
			if btnType == "share" && btn.Value == "share" {
				// Share preset uses a literal value; the service turns it into Telegram share behavior.
			} else {
				u, err := url.ParseRequestURI(btn.Value)
				if err != nil || (u.Scheme != "http" && u.Scheme != "https" && u.Scheme != "tg") || ((u.Scheme == "http" || u.Scheme == "https") && u.Host == "") {
					RespondError(w, r, http.StatusBadRequest, "invalid URL in buttons: must be a valid http, https, or tg address", err)
					return
				}
			}
		}

		// Webapp buttons MUST use secure https protocol according to Telegram specifications
		if btnType == "webapp" {
			u, err := url.ParseRequestURI(btn.Value)
			if err != nil || u.Scheme != "https" || u.Host == "" {
				RespondError(w, r, http.StatusBadRequest, "invalid WebApp URL: must be a secure https address", err)
				return
			}
		}
	}

	err = h.svc.SaveButtons(r.Context(), userID, channelID, buttons)
	if err != nil {
		h.respondServerError(w, r, "failed to save channel inline buttons", err)
		return
	}

	RespondJSON(w, http.StatusOK, buttons)
}

type CreateFunnelRequest struct {
	InputChannelID string `json:"input_channel_id"`
}

func (h *ChannelHandler) CreateFunnel(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	channelIDStr := chi.URLParam(r, "channelID")
	channelID, err := uuid.Parse(channelIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid output channel ID", err)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
	var req CreateFunnelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	inputChannelID, err := uuid.Parse(req.InputChannelID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid input channel ID", err)
		return
	}

	funnel, err := h.svc.CreateFunnel(r.Context(), userID, channelID, inputChannelID)
	if err != nil {
		h.respondServerError(w, r, "failed to create funnel", err)
		return
	}

	RespondJSON(w, http.StatusCreated, funnel)
}

func (h *ChannelHandler) GetFunnel(w http.ResponseWriter, r *http.Request) {
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

	funnel, err := h.svc.GetFunnelByOutputChannel(r.Context(), userID, channelID)
	if err != nil {
		h.respondServerError(w, r, "failed to get funnel", err)
		return
	}

	if funnel == nil {
		RespondJSON(w, http.StatusOK, map[string]interface{}{"funnel": nil})
		return
	}

	// Also retrieve input channel details to make the response rich for UI
	inChan, err := h.svc.GetChannelByChatID(r.Context(), funnel.InputChatID)
	var inputTitle string
	var inputChannelID string
	if err == nil && inChan != nil {
		inputTitle = inChan.ChatTitle
		inputChannelID = inChan.ID.String()
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"id":               funnel.ID,
		"bot_id":           funnel.BotID,
		"input_chat_id":    funnel.InputChatID,
		"output_chat_id":   funnel.OutputChatID,
		"owner_user_id":    funnel.OwnerUserID,
		"is_active":        funnel.IsActive,
		"created_at":       funnel.CreatedAt,
		"updated_at":       funnel.UpdatedAt,
		"input_title":      inputTitle,
		"input_channel_id": inputChannelID,
	})
}

func (h *ChannelHandler) DeleteFunnel(w http.ResponseWriter, r *http.Request) {
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

	err = h.svc.DeleteFunnel(r.Context(), userID, channelID)
	if err != nil {
		h.respondServerError(w, r, "failed to delete funnel", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *ChannelHandler) respondServerError(w http.ResponseWriter, r *http.Request, publicMsg string, err error) {
	if err == nil {
		RespondError(w, r, http.StatusInternalServerError, publicMsg, nil)
		return
	}

	errStr := err.Error()
	if strings.Contains(errStr, "unauthorized") || strings.Contains(errStr, "access denied") || strings.Contains(errStr, "telegram api error [403]") {
		RespondError(w, r, http.StatusForbidden, errStr, err)
		return
	}

	if strings.Contains(errStr, "not found") {
		RespondError(w, r, http.StatusNotFound, errStr, err)
		return
	}

	// Check for specific, safe-to-expose business validation and PV start messages
	if strings.Contains(errStr, "settings validation failed") ||
		strings.Contains(errStr, "bot must be an administrator") ||
		strings.Contains(errStr, "located chat is not a channel") ||
		strings.Contains(errStr, "لطفاً") ||
		strings.Contains(errStr, "لطفا") ||
		strings.Contains(errStr, "telegram api error [400]") {
		RespondError(w, r, http.StatusBadRequest, errStr, err)
		return
	}

	// Return a secure localized/generic message for internal exceptions, preventing db structure leaks
	RespondError(w, r, http.StatusInternalServerError, publicMsg, err)
}
