package handler

import (
	"encoding/json"
	"net/http"
	"strings"

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

	channels, err := h.svc.ListChannels(r.Context(), userID, botID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to list channels", err)
		return
	}

	respondJSON(w, http.StatusOK, channels)
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
		if err == repository.ErrOptimisticLockConflict {
			RespondError(w, r, http.StatusConflict, "version_mismatch", err)
			return
		}
		RespondError(w, r, http.StatusInternalServerError, "failed to update channel settings", err)
		return
	}

	respondJSON(w, http.StatusOK, settings)
}
