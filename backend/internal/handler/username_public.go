package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/fragment"
	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username"
	"ifragment-backend/internal/middleware"
	"log/slog"
	"net/http"
	"strconv"
	"sync/atomic"
	"time"

	"golang.org/x/sync/singleflight"
)

type UsernameHandler struct {
	service        *username.AggregatorService
	reportService  *username.ReportService
	fragmentClient *fragment.Client
	mtprotoClient  mtproto.Client
	cache          *repository.Cache
	sfGroup        singleflight.Group
	activeStreams  atomic.Int64
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

	w.Header().Set("Cache-Control", "public, max-age=300")
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
		ip := ClientIP(r)
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

	// Singleflight to merge concurrent checks
	val, err, _ := h.sfGroup.Do("check:"+u, func() (interface{}, error) {
		// Double check cache
		if h.cache != nil {
			if cachedVal, err := h.cache.Client.Get(ctx, cacheKey).Result(); err == nil {
				return cachedVal, nil
			}
		}

		var finalStatus string
		mtStatus, err := h.mtprotoClient.CheckUsername(ctx, u)
		if err != nil {
			return "", err
		}

		switch mtStatus {
		case mtproto.StatusAvailable:
			if username.IsBasicEligible(u) {
				finalStatus = "available"
			} else {
				finalStatus = "purchase_available"
			}
		case mtproto.StatusOccupied:
			finalStatus = "taken"
		case mtproto.StatusPurchase:
			fragStatus, _ := h.fragmentClient.CheckUsername(ctx, u)
			switch fragStatus {
			case fragment.StatusAuction:
				finalStatus = "on_auction"
			case fragment.StatusSale:
				finalStatus = "on_sale"
			default:
				finalStatus = "purchase_available"
			}
		default:
			finalStatus = string(mtStatus)
		}

		// Save to cache
		if h.cache != nil {
			h.cache.Client.Set(ctx, cacheKey, finalStatus, 5*time.Minute)
		}

		return finalStatus, nil
	})

	if err != nil {
		slog.Error("MTProto check failed", "username", u, "error", err)
		RespondError(w, r, http.StatusInternalServerError, "failed to check username", err)
		return
	}

	h.jsonResponse(w, u, val.(string))
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

	var userID int64
	if rawUser := ctx.Value(middleware.UserContextKey); rawUser != nil {
		if user, ok := rawUser.(map[string]interface{}); ok {
			if id, ok := user["id"].(int64); ok {
				userID = id
			} else if id, ok := user["id"].(float64); ok {
				userID = int64(id)
			}
		}
	}

	// Rate limit
	if h.cache != nil {
		ip := ClientIP(r)
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

	// Singleflight to merge concurrent quick analysis fetches
	val, err, _ := h.sfGroup.Do("quick:"+u, func() (interface{}, error) {
		// Double check cache
		if h.cache != nil {
			if cachedVal, err := h.cache.Client.Get(ctx, cacheKey).Result(); err == nil {
				return []byte(cachedVal), nil
			}
		}

		result, err := h.reportService.QuickAnalysis(ctx, u, 0)
		if err != nil {
			return nil, err
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
				switch fragStatus {
				case fragment.StatusAuction:
					result.Status = "on_auction"
				case fragment.StatusSale:
					result.Status = "on_sale"
				default:
					result.Status = "purchase_available"
				}
			default:
				result.Status = string(mtStatus)
			}
		}

		data, err := json.Marshal(result)
		if err != nil {
			return nil, err
		}

		// Cache result for 3 minutes
		if h.cache != nil {
			h.cache.Client.Set(ctx, cacheKey, data, 3*time.Minute)
		}

		return data, nil
	})

	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to perform quick analysis", err)
		return
	}

	h.reportService.LogSearch(ctx, u, userID)

	w.Header().Set("Content-Type", "application/json")
	w.Write(val.([]byte))
}

// StreamQuickAnalysis — SSE endpoint for real-time price and status updates
func (h *UsernameHandler) StreamQuickAnalysis(w http.ResponseWriter, r *http.Request) {
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

	// Rate limit check for stream creation
	if h.cache != nil {
		ip := ClientIP(r)
		rlKey := "rate_limit:stream:" + ip
		count, _ := h.cache.Client.Incr(ctx, rlKey).Result()
		if count == 1 {
			h.cache.Client.Expire(ctx, rlKey, time.Minute)
		}
		if count > 10 {
			RespondError(w, r, http.StatusTooManyRequests, "Too many streaming requests. Please try again later.", nil)
			return
		}
	}

	// Concurrent connections limit
	if h.activeStreams.Load() >= 500 {
		RespondError(w, r, http.StatusServiceUnavailable, "stream capacity reached", nil)
		return
	}
	h.activeStreams.Add(1)
	defer h.activeStreams.Add(-1)

	// Set headers for Server-Sent Events
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		RespondError(w, r, http.StatusInternalServerError, "streaming unsupported", nil)
		return
	}

	// Cap total connection lifetime to 5 minutes to prevent zombie leaks
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// Initial fetch
	h.sendSSEUpdate(w, flusher, ctx, u)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.sendSSEUpdate(w, flusher, ctx, u)
		}
	}
}

func (h *UsernameHandler) sendSSEUpdate(w http.ResponseWriter, flusher http.Flusher, ctx context.Context, u string) {
	result, err := h.reportService.QuickAnalysis(ctx, u, 0)
	if err != nil {
		return
	}

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
			switch fragStatus {
			case fragment.StatusAuction:
				result.Status = "on_auction"
			case fragment.StatusSale:
				result.Status = "on_sale"
			default:
				result.Status = "purchase_available"
			}
		default:
			result.Status = string(mtStatus)
		}
	}

	data, err := json.Marshal(result)
	if err != nil {
		return
	}

	fmt.Fprintf(w, "data: %s\n\n", string(data))
	flusher.Flush()
}

func (h *UsernameHandler) jsonResponse(w http.ResponseWriter, u string, status string) {
	res := map[string]interface{}{
		"username": u,
		"status":   status,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// GetTrending returns real-time trending usernames
func (h *UsernameHandler) GetTrending(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	list, err := h.service.GetTrendingUsernames(ctx)
	if err != nil {
		list = []string{"news", "auto", "bank", "crypto"}
	}

	w.Header().Set("Cache-Control", "public, max-age=180")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

// GetRates returns the cached TON-to-USD exchange rate
func (h *UsernameHandler) GetRates(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rateUSD, err := h.reportService.GetTONRate(ctx)
	if err != nil {
		rateUSD = 7.25
	}

	w.Header().Set("Cache-Control", "public, max-age=60")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]float64{"ton_to_usd": rateUSD})
}

func (h *UsernameHandler) GetSimilar(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		RespondError(w, r, http.StatusBadRequest, "missing username", nil)
		return
	}
	if !username.ValidateUsername(u) {
		RespondError(w, r, http.StatusBadRequest, "invalid username format", nil)
		return
	}

	limit := 10
	if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err != nil || parsed < 1 || parsed > 25 {
			RespondError(w, r, http.StatusBadRequest, "invalid limit", nil)
			return
		}
		limit = parsed
	}

	results, err := h.reportService.FindSimilarUsernames(r.Context(), u, limit)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to find similar usernames", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
