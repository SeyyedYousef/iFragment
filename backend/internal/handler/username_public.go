package handler

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/username"
	"ifragment-backend/internal/service/username/avm"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"ifragment-backend/internal/service/notification"

	"github.com/google/uuid"
	"github.com/gotd/td/tg"
	"golang.org/x/sync/singleflight"
)

type UsernameHandler struct {
	service       *username.AggregatorService
	reportService *username.AnalysisService
	avmService    *avm.ValuationService
	mtprotoClient mtproto.Client
	cache         *repository.Cache
	sfGroup       singleflight.Group
	activeStreams atomic.Int64
}

func NewUsernameHandler(
	s *username.AggregatorService,
	r *username.AnalysisService,
	m mtproto.Client,
	c *repository.Cache,
	avmSvc *avm.ValuationService,
) *UsernameHandler {
	return &UsernameHandler{
		service:       s,
		reportService: r,
		avmService:    avmSvc,
		mtprotoClient: m,
		cache:         c,
	}
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
		ip := middleware.GetRealIP(r)
		rlKey := "rate_limit:check:" + ip
		count, _ := h.cache.Client.Incr(ctx, rlKey).Result()
		if count == 1 {
			h.cache.Client.Expire(context.Background(), rlKey, time.Minute)
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

	// Singleflight to merge concurrent checks using DoChan to handle client disconnection
	ch := h.sfGroup.DoChan("check:"+u, func() (interface{}, error) {
		// Use detached context for backend queries in singleflight so client cancellation does not fail concurrent requests
		detachedCtx, cancelDetached := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelDetached()

		// Double check cache
		if h.cache != nil {
			if cachedVal, err := h.cache.Client.Get(detachedCtx, cacheKey).Result(); err == nil {
				return cachedVal, nil
			}
		}

		mtStatus, mtErr := h.mtprotoClient.CheckUsername(detachedCtx, u)
		if mtErr != nil {
			return "", mtErr
		}

		var finalStatus string
		switch mtStatus {
		case mtproto.StatusOccupied:
			finalStatus = "taken"
		case mtproto.StatusPurchase:
			finalStatus = "purchase_available"
		case mtproto.StatusAvailable:
			if username.IsBasicEligible(u) {
				finalStatus = "available"
			} else {
				finalStatus = "purchase_available"
			}
		default:
			finalStatus = string(mtStatus)
		}

		// Save to cache
		if h.cache != nil {
			h.cache.Client.Set(detachedCtx, cacheKey, finalStatus, 5*time.Minute)
		}

		return finalStatus, nil
	})

	var res singleflight.Result
	select {
	case <-ctx.Done():
		// Release HTTP handler immediately on client disconnect/context cancel
		return
	case res = <-ch:
	}

	if res.Err != nil {
		if res.Err == context.Canceled {
			w.WriteHeader(499)
			return
		}
		slog.Error("MTProto check failed", "username", u, "error", res.Err)
		RespondError(w, r, http.StatusInternalServerError, "failed to check username", res.Err)
		return
	}

	h.jsonResponse(w, u, res.Val.(string))
}

// getQuickAnalysisCachedOrFetch — Helper method to safely query QuickAnalysis with caching and singleflight
func (h *UsernameHandler) getQuickAnalysisCachedOrFetch(ctx context.Context, u string) ([]byte, error) {
	cacheKey := "quick:" + u
	if h.cache != nil {
		if val, err := h.cache.Client.Get(ctx, cacheKey).Result(); err == nil {
			return []byte(val), nil
		}
	}

	ch := h.sfGroup.DoChan("quick:"+u, func() (interface{}, error) {
		detachedCtx, cancelDetached := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelDetached()

		// Double check cache
		if h.cache != nil {
			if cachedVal, err := h.cache.Client.Get(detachedCtx, cacheKey).Result(); err == nil {
				return []byte(cachedVal), nil
			}
		}

		result, err := h.reportService.QuickAnalysis(detachedCtx, u, 0)
		if err != nil {
			return nil, err
		}

		mtStatus, mtErr := h.mtprotoClient.CheckUsername(detachedCtx, u)
		if mtErr != nil {
			return nil, fmt.Errorf("mtproto check failed: %w", mtErr)
		}

		// Resolve status deterministically
		switch mtStatus {
		case mtproto.StatusPurchase:
			result.Status = "purchase_available"
		case mtproto.StatusOccupied:
			result.Status = "taken"
		case mtproto.StatusAvailable:
			if username.IsBasicEligible(u) {
				result.Status = "available"
			} else {
				result.Status = "purchase_available"
			}
		default:
			result.Status = "taken"
		}

		data, err := json.Marshal(result)
		if err != nil {
			return nil, err
		}

		if h.cache != nil {
			h.cache.Client.Set(detachedCtx, cacheKey, data, 3*time.Minute)
		}

		return data, nil
	})

	var res singleflight.Result
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case res = <-ch:
	}

	if res.Err != nil {
		return nil, res.Err
	}
	return res.Val.([]byte), nil
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
		ip := middleware.GetRealIP(r)
		rlKey := "rate_limit:quick:" + ip
		count, _ := h.cache.Client.Incr(ctx, rlKey).Result()
		if count == 1 {
			h.cache.Client.Expire(context.Background(), rlKey, time.Minute)
		}
		if count > 15 {
			RespondError(w, r, http.StatusTooManyRequests, "Too many requests", nil)
			return
		}
	}

	val, err := h.getQuickAnalysisCachedOrFetch(ctx, u)
	if err != nil {
		if err == context.Canceled {
			w.WriteHeader(499)
			return
		}
		RespondError(w, r, http.StatusInternalServerError, "failed to perform quick analysis", err)
		return
	}

	h.reportService.LogSearch(ctx, u, userID)

	w.Header().Set("Content-Type", "application/json")
	w.Write(val)
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
		ip := middleware.GetRealIP(r)
		rlKey := "rate_limit:stream:" + ip
		count, _ := h.cache.Client.Incr(ctx, rlKey).Result()
		if count == 1 {
			h.cache.Client.Expire(context.Background(), rlKey, time.Minute)
		}
		if count > 10 {
			RespondError(w, r, http.StatusTooManyRequests, "Too many streaming requests. Please try again later.", nil)
			return
		}
	}

	// Concurrent connections limit
	if h.activeStreams.Add(1) > 500 {
		h.activeStreams.Add(-1)
		RespondError(w, r, http.StatusServiceUnavailable, "stream capacity reached", nil)
		return
	}
	defer h.activeStreams.Add(-1)

	flusher, ok := w.(http.Flusher)
	if !ok {
		RespondError(w, r, http.StatusInternalServerError, "streaming unsupported", nil)
		return
	}

	// Set headers for Server-Sent Events
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	// Cap total connection lifetime to 5 minutes to prevent zombie leaks
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// Initial fetch
	if err := h.sendSSEUpdate(w, flusher, ctx, u); err != nil {
		RespondError(w, r, http.StatusInternalServerError, "stream start failed", err)
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Send ping heartbeat first to detect client disconnection
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}
			flusher.Flush()

			// Send the actual update
			if err := h.sendSSEUpdate(w, flusher, ctx, u); err != nil {
				return
			}
		}
	}
}

func (h *UsernameHandler) sendSSEUpdate(w http.ResponseWriter, flusher http.Flusher, ctx context.Context, u string) error {
	val, err := h.getQuickAnalysisCachedOrFetch(ctx, u)
	if err != nil {
		return err
	}

	if _, err := fmt.Fprintf(w, "data: %s\n\n", string(val)); err != nil {
		return err
	}
	flusher.Flush()
	return nil
}

func (h *UsernameHandler) jsonResponse(w http.ResponseWriter, u string, status string) {
	res := map[string]interface{}{
		"username": u,
		"status":   status,
	}
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// GetRates returns the cached TON-to-USD exchange rate
func (h *UsernameHandler) GetRates(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rateUSD, err := h.reportService.GetTONRate(ctx)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get ton rate", err)
		return
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

	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// Valuate performs an AVM (Automated Valuation Model) estimation for a username.
// Returns dual-denominated price range (TON + USD) with confidence score and audit run_id.
func (h *UsernameHandler) Valuate(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		RespondError(w, r, http.StatusBadRequest, "missing username", nil)
		return
	}

	if !username.ValidateUsername(u) {
		RespondError(w, r, http.StatusBadRequest, "invalid username format", nil)
		return
	}

	if h.avmService == nil {
		RespondError(w, r, http.StatusServiceUnavailable, "valuation service not available", nil)
		return
	}

	ctx := r.Context()

	// Rate limit: stricter than QuickAnalysis since valuation involves DB writes
	if h.cache != nil {
		ip := middleware.GetRealIP(r)
		rlKey := "rate_limit:valuate:" + ip
		count, _ := h.cache.Client.Incr(ctx, rlKey).Result()
		if count == 1 {
			h.cache.Client.Expire(context.Background(), rlKey, time.Minute)
		}
		if count > 10 {
			RespondError(w, r, http.StatusTooManyRequests, "Too many valuation requests", nil)
			return
		}
	}

	// Fetch TON/USD rate
	tonRate, err := h.reportService.GetTONRate(ctx)
	if err != nil {
		slog.Warn("AVM: TON rate fetch failed, using fallback", "error", err)
		tonRate = 7.25
	}

	result, err := h.avmService.Valuate(ctx, u, tonRate)
	if err != nil {
		slog.Error("AVM valuation failed", "username", u, "error", err)
		RespondError(w, r, http.StatusInternalServerError, "valuation failed", err)
		return
	}

	h.sendValuationNotification(r, u, result)

	// Fetch similar usernames (with status enrichment)
	similars, _ := h.reportService.FindSimilarUsernames(ctx, u, 3)
	for _, sim := range similars {
		result.Similar = append(result.Similar, avm.ValuationSimilar{
			Username:     sim.Username,
			Reason:       sim.Reason,
			Status:       sim.Status,
			SalePrice:    sim.SalePrice,
			SalePriceUSD: sim.SalePriceUSD,
			SaleDate:     sim.SaleDate,
		})
	}

	// Populate Portfolio if OwnerAddress exists
	if result.History.OwnerAddress != "" && h.reportService != nil {
		p, pErr := h.reportService.GetWalletPortfolio(ctx, result.History.OwnerAddress)
		if pErr == nil && p != nil {
			var items []avm.PortfolioItemDto
			for _, item := range p.Items {
				items = append(items, avm.PortfolioItemDto{
					Username:  item.Username,
					SoldPrice: item.SoldPrice,
					SaleDate:  item.SaleDate,
					Status:    item.Status,
				})
			}
			result.Portfolio = &avm.PortfolioDto{
				OwnerAddress:  result.History.OwnerAddress,
				TotalCount:    p.TotalCount,
				TotalSpentTON: p.TotalSpentTON,
				TotalSpentUSD: p.TotalSpentTON * tonRate,
				TotalValueTON: p.TotalValue,
				Items:         items,
			}
		}
	}

	// Populate OwnerProfile via MTProto if available
	if h.mtprotoClient != nil {
		resolved, err := h.mtprotoClient.ResolveUsername(ctx, u)
		if err == nil && resolved != nil {
			if pUser, ok := resolved.Peer.(*tg.PeerUser); ok {
				for _, uObj := range resolved.Users {
					if user, ok := uObj.(*tg.User); ok && user.ID == pUser.UserID {
						result.OwnerProfile = &avm.OwnerProfileDto{
							UserID:    user.ID,
							FirstName: user.FirstName,
							LastName:  user.LastName,
							Username:  user.Username,
							IsPremium: user.Premium,
							HasPhoto:  user.Photo != nil,
							PeerType:  "user",
						}
						break
					}
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *UsernameHandler) sendValuationNotification(r *http.Request, u string, result *avm.ValuationResult) {
	initData := r.Header.Get("X-Telegram-Init-Data")
	userID := "ناشناس"
	userIdent := "کاربر ناشناس"

	if initData != "" {
		values, _ := url.ParseQuery(initData)
		userData := values.Get("user")
		if userData != "" {
			var userObj map[string]interface{}
			if err := json.Unmarshal([]byte(userData), &userObj); err == nil {
				if idVal, ok := userObj["id"]; ok {
					switch v := idVal.(type) {
					case float64:
						userID = strconv.FormatInt(int64(v), 10)
					case int64:
						userID = strconv.FormatInt(v, 10)
					}
				}
				if uName, ok := userObj["username"].(string); ok && uName != "" {
					userIdent = "@" + uName
				} else if first, ok := userObj["first_name"].(string); ok && first != "" {
					userIdent = first
				}
			}
		}
	}

	msg := fmt.Sprintf(
		"🔍 <b>درخواست ارزش‌گذاری یوزرنیم</b>\n\n"+
			"👤 <b>کاربر:</b> %s (<code>%s</code>)\n"+
			"🆔 <b>یوزرنیم:</b> @%s\n\n"+
			"💰 <b>قیمت نهایی:</b> %s TON\n"+
			"💵 <b>معادل دلاری:</b> $%s\n"+
			"💎 <b>کمیابی:</b> %s",
		telegram.EscapeHTML(userIdent), userID,
		telegram.EscapeHTML(u),
		result.ExpectedTON.StringFixed(2),
		result.ExpectedUSD.StringFixed(2),
		result.Rarity.Tier,
	)

	notification.GetAdminNotifier().NotifyAVM(context.Background(), msg)
}

func (h *UsernameHandler) Share(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Image string `json:"image"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	if payload.Image == "" {
		RespondError(w, r, http.StatusBadRequest, "missing image data", nil)
		return
	}

	// Remove base64 prefix if exists
	base64Data := payload.Image
	if idx := strings.Index(base64Data, ","); idx != -1 {
		base64Data = base64Data[idx+1:]
	}

	dec, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid base64 encoding", err)
		return
	}

	// Create static/shares dir if not exists
	dir := "./static/shares"
	if err := os.MkdirAll(dir, 0755); err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to create storage directory", err)
		return
	}

	fileID := uuid.New().String()
	filePath := fmt.Sprintf("%s/%s.png", dir, fileID)

	if err := os.WriteFile(filePath, dec, 0644); err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to save image file", err)
		return
	}

	// Build the public URL
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := r.Host
	publicURL := fmt.Sprintf("%s://%s/static/shares/%s.png", scheme, host, fileID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"url": publicURL,
	})
}

func (h *UsernameHandler) SendToChat(w http.ResponseWriter, r *http.Request) {
	// 1. Get authenticated user
	telegramID, err := middleware.GetUserID(r.Context())
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "invalid user ID", err)
		return
	}

	// 2. Decode payload
	var payload struct {
		Image string `json:"image"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	if payload.Image == "" {
		RespondError(w, r, http.StatusBadRequest, "missing image data", nil)
		return
	}

	// Remove base64 prefix if exists
	base64Data := payload.Image
	if idx := strings.Index(base64Data, ","); idx != -1 {
		base64Data = base64Data[idx+1:]
	}

	dec, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid base64 encoding", err)
		return
	}

	// 3. Save to disk to get public URL
	dir := "./static/shares"
	if err := os.MkdirAll(dir, 0755); err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to create storage directory", err)
		return
	}

	fileID := uuid.New().String()
	filePath := fmt.Sprintf("%s/%s.png", dir, fileID)

	if err := os.WriteFile(filePath, dec, 0644); err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to save image file", err)
		return
	}

	// 4. Build the public URL
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := r.Host
	publicURL := fmt.Sprintf("%s://%s/static/shares/%s.png", scheme, host, fileID)

	// 5. Send to Telegram Chat
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		RespondError(w, r, http.StatusInternalServerError, "telegram bot token not configured", nil)
		return
	}

	tgClient := telegram.NewBotAPIClient(token)
	caption := "Here is your iFragment valuation card! 💎"
	_, err = tgClient.SendPhoto(r.Context(), telegramID, publicURL, caption, "HTML")
	if err != nil {
		slog.Error("Failed to send photo to user", "user_id", telegramID, "error", err)
		RespondError(w, r, http.StatusInternalServerError, "failed to send photo to chat", err)
		return
	}

	// 6. Return success
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{
		"success": true,
	})
}

func (h *UsernameHandler) GetPortfolio(w http.ResponseWriter, r *http.Request) {
	address := r.URL.Query().Get("address")
	if address == "" {
		RespondError(w, r, http.StatusBadRequest, "missing address parameter", nil)
		return
	}

	p, err := h.reportService.GetWalletPortfolio(r.Context(), address)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get wallet portfolio", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func (h *UsernameHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		RespondError(w, r, http.StatusBadRequest, "missing username parameter", nil)
		return
	}

	report, err := h.reportService.GenerateDeepReport(r.Context(), 0, u)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to fetch username history", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"username":        u,
		"owner_address":   report.OwnerAddress,
		"past_sales":      report.PastSales,
		"previous_owners": report.PreviousOwners,
	})
}

func (h *UsernameHandler) GetContact(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		RespondError(w, r, http.StatusBadRequest, "missing username parameter", nil)
		return
	}

	u = strings.TrimPrefix(u, "@")

	var profile avm.OwnerProfileDto
	profile.Username = u
	profile.PeerType = "unknown"

	if h.mtprotoClient != nil {
		resolved, err := h.mtprotoClient.ResolveUsername(r.Context(), u)
		if err == nil && resolved != nil {
			switch p := resolved.Peer.(type) {
			case *tg.PeerUser:
				profile.PeerType = "user"
				for _, uObj := range resolved.Users {
					if user, ok := uObj.(*tg.User); ok && user.ID == p.UserID {
						profile.UserID = user.ID
						profile.FirstName = user.FirstName
						profile.LastName = user.LastName
						profile.Username = user.Username
						profile.IsPremium = user.Premium
						profile.HasPhoto = user.Photo != nil
						break
					}
				}
			case *tg.PeerChannel:
				profile.PeerType = "channel"
			case *tg.PeerChat:
				profile.PeerType = "chat"
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}


