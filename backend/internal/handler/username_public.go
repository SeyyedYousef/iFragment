package handler

import (
	"encoding/json"
	"ifragment-backend/internal/client/fragment"
	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username"
	"log/slog"
	"net/http"
	"time"
)

type UsernameHandler struct {
	service        *username.AggregatorService
	reportService  *username.ReportService
	fragmentClient *fragment.Client
	mtprotoClient  mtproto.Client
	cache          *repository.Cache
}

func NewUsernameHandler(
	s *username.AggregatorService,
	rs *username.ReportService,
	f *fragment.Client,
	m mtproto.Client,
	c *repository.Cache,
) *UsernameHandler {
	return &UsernameHandler{
		service:        s,
		reportService:  rs,
		fragmentClient: f,
		mtprotoClient:  m,
		cache:          c,
	}
}

func (h *UsernameHandler) GetCollectionStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.service.GetCollectionStats()
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get collection stats", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func (h *UsernameHandler) CheckAvailability(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		RespondError(w, r, http.StatusBadRequest, "missing username", nil)
		return
	}

	ctx := r.Context()

	// Rate Limiting
	if h.cache != nil {
		ip := r.RemoteAddr
		rlKey := "rate_limit:check:" + ip
		count, _ := h.cache.Client.Incr(ctx, rlKey).Result()
		if count == 1 {
			h.cache.Client.Expire(ctx, rlKey, time.Minute)
		}
		if count > 20 {
			RespondError(w, r, http.StatusTooManyRequests, "Too many requests. Please try again later.", nil)
			return
		}
	}

	if !username.ValidateUsername(u) {
		RespondError(w, r, http.StatusBadRequest, "invalid username format", nil)
		return
	}
	cacheKey := "check_cache:" + u

	// Try cache first
	if h.cache != nil {
		if val, err := h.cache.Client.Get(ctx, cacheKey).Result(); err == nil {
			slog.Debug("Check cache hit", "username", u)
			h.jsonResponse(w, u, val)
			return
		}
	}

	var finalStatus string

	mtStatus, err := h.mtprotoClient.CheckUsername(ctx, u)
	if err != nil {
		slog.Error("MTProto check failed", "username", u, "error", err)
		RespondError(w, r, http.StatusInternalServerError, "failed to check username", err)
		return
	}

	if mtStatus == mtproto.StatusAvailable {
		if username.IsBasicEligible(u) {
			finalStatus = "available"
		} else {
			finalStatus = "purchase_available"
		}
	} else if mtStatus == mtproto.StatusOccupied {
		finalStatus = "taken"
	} else if mtStatus == mtproto.StatusPurchase {
		fragStatus, _ := h.fragmentClient.CheckUsername(ctx, u)
		if fragStatus == fragment.StatusAuction {
			finalStatus = "on_auction"
		} else if fragStatus == fragment.StatusSale {
			finalStatus = "on_sale"
		} else {
			finalStatus = "purchase_available"
		}
	} else {
		finalStatus = string(mtStatus)
	}

	// Save to cache
	if h.cache != nil {
		h.cache.Client.Set(ctx, cacheKey, finalStatus, 5*time.Minute)
	}

	h.jsonResponse(w, u, finalStatus)
}

// QuickAnalysis — Free endpoint returning rich preview data for ActionArea
func (h *UsernameHandler) QuickAnalysis(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		RespondError(w, r, http.StatusBadRequest, "missing username", nil)
		return
	}

	if !username.ValidateUsername(u) {
		RespondError(w, r, http.StatusBadRequest, "invalid username format", nil)
		return
	}

	ctx := r.Context()

	// Rate limit
	if h.cache != nil {
		ip := r.RemoteAddr
		rlKey := "rate_limit:quick:" + ip
		count, _ := h.cache.Client.Incr(ctx, rlKey).Result()
		if count == 1 {
			h.cache.Client.Expire(ctx, rlKey, time.Minute)
		}
		if count > 15 {
			RespondError(w, r, http.StatusTooManyRequests, "Too many requests", nil)
			return
		}
	}

	// Cache check
	cacheKey := "quick:" + u
	if h.cache != nil {
		if val, err := h.cache.Client.Get(ctx, cacheKey).Result(); err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(val))
			return
		}
	}

	result, err := h.reportService.QuickAnalysis(ctx, u, 0)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to perform quick analysis", err)
		return
	}

	// Also set the status from MTProto check
	mtStatus, err := h.mtprotoClient.CheckUsername(ctx, u)
	if err == nil {
		switch mtStatus {
		case mtproto.StatusAvailable:
			if username.IsBasicEligible(u) {
				result.Status = "available"
			} else {
				result.Status = "purchase_available"
			}
		case mtproto.StatusOccupied:
			result.Status = "taken"
		case mtproto.StatusPurchase:
			fragStatus, _ := h.fragmentClient.CheckUsername(ctx, u)
			if fragStatus == fragment.StatusAuction {
				result.Status = "on_auction"
			} else if fragStatus == fragment.StatusSale {
				result.Status = "on_sale"
			} else {
				result.Status = "purchase_available"
			}
		default:
			result.Status = string(mtStatus)
		}
	}

	// Cache result for 3 minutes
	if h.cache != nil {
		data, _ := json.Marshal(result)
		h.cache.Client.Set(ctx, cacheKey, data, 3*time.Minute)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *UsernameHandler) jsonResponse(w http.ResponseWriter, u string, status string) {
	res := map[string]interface{}{
		"username": u,
		"status":   status,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}
