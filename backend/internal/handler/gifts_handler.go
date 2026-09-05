package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/service/gifts"
	"ifragment-backend/internal/service/gifts/crafting"
	"ifragment-backend/internal/service/gifts/gvengine"
	"ifragment-backend/internal/service/notification"
)

var (
	slugRegex = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,63}$`)
)

type GiftsHandler struct {
	service *gifts.GiftsService
}

func NewGiftsHandler(service *gifts.GiftsService) *GiftsHandler {
	return &GiftsHandler{service: service}
}

// GetIntel returns the free market intelligence overview
func (h *GiftsHandler) GetIntel(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	intel, err := h.service.GetGiftsIntel(ctx)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to load gifts intel", nil)
		return
	}
	RespondJSON(w, http.StatusOK, intel)
}

// GetCuriosityGate returns curiosity counters without price leakage (Sacred Rule 3)
func (h *GiftsHandler) GetCuriosityGate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	giftID := r.URL.Query().Get("g")
	if giftID == "" {
		RespondError(w, r, http.StatusBadRequest, "gift parameter 'g' is required", nil)
		return
	}

	gate, err := h.service.GetCuriosityGate(ctx, giftID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid gift format", err)
		return
	}
	RespondJSON(w, http.StatusOK, gate)
}

// Valuate computes or fetches the cached 24h valuation report
func (h *GiftsHandler) Valuate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	giftID := r.URL.Query().Get("g")
	if giftID == "" {
		RespondError(w, r, http.StatusBadRequest, "gift parameter 'g' is required", nil)
		return
	}

	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	val, err := h.service.ValuateGift(ctx, userID, giftID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "gift valuation failed", err)
		return
	}
	h.sendGiftNotification(r, val, "free")
	RespondJSON(w, http.StatusOK, val)
}

// GetEnrichedReport returns enriched valuation report with provenance and on-chain metadata
func (h *GiftsHandler) GetEnrichedReport(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	giftID := r.URL.Query().Get("g")
	if giftID == "" {
		RespondError(w, r, http.StatusBadRequest, "gift parameter 'g' is required", nil)
		return
	}

	userID, _ := middleware.GetUserID(ctx)

	report, err := h.service.GetEnrichedReport(ctx, userID, giftID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to generate enriched report", err)
		return
	}
	RespondJSON(w, http.StatusOK, report)
}

// UnlockWithCoins unlocks report with Airdrop Coins
func (h *GiftsHandler) UnlockWithCoins(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		GiftID string `json:"gift_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.GiftID == "" {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", nil)
		return
	}

	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	val, err := h.service.UnlockWithCoins(ctx, userID, req.GiftID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "failed to unlock gift report with coins", err)
		return
	}
	h.sendGiftNotification(r, val, "coins")
	RespondJSON(w, http.StatusOK, val)
}

// UnlockWithCredit unlocks report with 1 Intel Credit
func (h *GiftsHandler) UnlockWithCredit(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		GiftID string `json:"gift_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.GiftID == "" {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", nil)
		return
	}

	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	val, err := h.service.UnlockWithCredit(ctx, userID, req.GiftID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "failed to unlock gift report with credit", err)
		return
	}
	h.sendGiftNotification(r, val, "credit")
	RespondJSON(w, http.StatusOK, val)
}

// CalculateCraftingEV runs public crafting EV simulation
func (h *GiftsHandler) CalculateCraftingEV(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		Inputs []crafting.CraftInputItem `json:"inputs"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Inputs) == 0 {
		RespondError(w, r, http.StatusBadRequest, "invalid crafting inputs", nil)
		return
	}

	res, err := h.service.CalculateCraftingEV(ctx, req.Inputs)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}
	RespondJSON(w, http.StatusOK, res)
}

// GetUpgradeAdvice returns upgrade pricing and timing recommendations
func (h *GiftsHandler) GetUpgradeAdvice(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	giftID := r.URL.Query().Get("g")
	if giftID == "" {
		RespondError(w, r, http.StatusBadRequest, "gift parameter 'g' is required", nil)
		return
	}

	res, err := h.service.GetUpgradeAdvice(ctx, giftID)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "failed to load upgrade advice", err)
		return
	}
	RespondJSON(w, http.StatusOK, res)
}

// ScanPortfolio scans user gift inventory
func (h *GiftsHandler) ScanPortfolio(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	username := r.URL.Query().Get("u")
	if username == "" {
		RespondError(w, r, http.StatusBadRequest, "username parameter 'u' is required", nil)
		return
	}

	callerKey := r.Header.Get("X-Forwarded-For")
	if callerKey == "" {
		callerKey = r.RemoteAddr
	}
	if uid, err := middleware.GetUserID(ctx); err == nil && uid > 0 {
		callerKey = fmt.Sprintf("uid:%d", uid)
	}

	res, err := h.service.ScanPortfolio(ctx, callerKey, username)
	if err != nil {
		if errors.Is(err, gifts.ErrPortfolioRateLimited) {
			RespondError(w, r, http.StatusTooManyRequests, "portfolio scan rate limited (try again in 10 minutes)", nil)
			return
		}
		RespondError(w, r, http.StatusInternalServerError, "failed to scan portfolio", err)
		return
	}
	RespondJSON(w, http.StatusOK, res)
}

// ToggleWatchlist toggles post-purchase watchlist (Sacred Rule 4)
func (h *GiftsHandler) ToggleWatchlist(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		GiftID string `json:"gift_id"`
		Enable bool   `json:"enable"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.GiftID == "" {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", nil)
		return
	}

	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	err = h.service.ToggleWatchlist(ctx, userID, req.GiftID, req.Enable)
	if err != nil {
		if err == gifts.ErrReportNotPurchased {
			RespondError(w, r, http.StatusForbidden, "must purchase report before watching", nil)
			return
		}
		RespondError(w, r, http.StatusInternalServerError, "failed to update watchlist", nil)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"gift_id": req.GiftID,
		"enabled": req.Enable,
	})
}

// GetWatchlist returns all watched gifts
func (h *GiftsHandler) GetWatchlist(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	items, err := h.service.GetWatchlist(ctx, userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to fetch watchlist", nil)
		return
	}
	RespondJSON(w, http.StatusOK, items)
}

// ListCollections returns available gift collections
func (h *GiftsHandler) ListCollections(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	list, err := h.service.ListCollections(ctx)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to list collections", err)
		return
	}
	RespondJSON(w, http.StatusOK, list)
}

// GetCollectionIntel returns deep analytics for a gift collection
func (h *GiftsHandler) GetCollectionIntel(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	slug := r.URL.Query().Get("c")
	if slug == "" {
		RespondError(w, r, http.StatusBadRequest, "collection parameter 'c' is required", nil)
		return
	}
	if !slugRegex.MatchString(slug) {
		RespondError(w, r, http.StatusBadRequest, "invalid collection slug format", nil)
		return
	}

	data, err := h.service.GetCollectionIntel(ctx, slug)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to fetch collection intelligence", err)
		return
	}
	RespondJSON(w, http.StatusOK, data)
}

// GetGiftImage proxies and caches the gift PNG image
func (h *GiftsHandler) GetGiftImage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		slug = r.URL.Query().Get("slug")
	}
	if slug == "" {
		http.Error(w, "slug required", http.StatusBadRequest)
		return
	}
	if !slugRegex.MatchString(slug) {
		http.Error(w, "invalid slug format", http.StatusBadRequest)
		return
	}

	model := r.URL.Query().Get("m")
	if model == "" {
		model = r.URL.Query().Get("model")
	}

	bytes, err := h.service.GetGiftImageBytes(ctx, slug, model)
	if err != nil || len(bytes) == 0 {
		http.Error(w, "image not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(bytes)
}

func (h *GiftsHandler) sendGiftNotification(r *http.Request, val *gvengine.GiftValuation, paymentMethod string) {
	if val == nil {
		return
	}
	ctx := r.Context()
	userIDStr := "ناشناس"
	userIdent := "کاربر ناشناس"
	var parsedUserID int64

	if uid, err := middleware.GetUserID(ctx); err == nil && uid > 0 {
		parsedUserID = uid
		userIDStr = strconv.FormatInt(uid, 10)
	}

	initData := r.Header.Get("X-Telegram-Init-Data")
	if initData != "" {
		values, _ := url.ParseQuery(initData)
		userData := values.Get("user")
		if userData != "" {
			var userObj map[string]interface{}
			if err := json.Unmarshal([]byte(userData), &userObj); err == nil {
				if idVal, ok := userObj["id"]; ok {
					switch v := idVal.(type) {
					case float64:
						parsedUserID = int64(v)
						userIDStr = strconv.FormatInt(int64(v), 10)
					case int64:
						parsedUserID = v
						userIDStr = strconv.FormatInt(v, 10)
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

	paymentMethodLabel := "🎁 رایگان / کاوش اولیه"
	switch paymentMethod {
	case "coins":
		paymentMethodLabel = "🪙 پرداخت با سکه (15,000 FRG)"
	case "credit":
		paymentMethodLabel = "⚡️ کردیت تحلیلی (1 Intel Credit)"
	case "stars":
		paymentMethodLabel = "⭐️ استارز تلگرام (Telegram Stars)"
	case "cached":
		paymentMethodLabel = "📑 گزارش فعال قبلی (24h)"
	}

	miniAppURL := os.Getenv("MINI_APP_URL")
	if miniAppURL == "" {
		miniAppURL = "https://t.me/iFragmentBot/iFragment"
	}
	appLink := fmt.Sprintf("%s?startapp=gift_%s", miniAppURL, val.GiftID)
	fragmentGiftsLink := "https://fragment.com/gifts"

	rarityTier := val.JointRarity.DescriptionFa
	if rarityTier == "" {
		rarityTier = val.JointRarity.RarityClass
	}
	if rarityTier == "" {
		rarityTier = "استاندارد"
	}

	badge := "🎁"
	if val.SerialNumber <= 100 || val.ExpectedUSD >= 200 {
		badge = "🔥"
	}

	timeStr := time.Now().UTC().Format("15:04:05 UTC")

	msg := fmt.Sprintf(
		"╔════ 🎁 <b>ارزش‌گذاری و تحلیل گیفت تلگرام</b> ════╗\n\n"+
			"🏷 <b>عنوان گیفت:</b> %s\n"+
			"🆔 <b>شناسه:</b> <code>%s</code> (سریال: #%d)\n"+
			"👤 <b>کاربر:</b> %s (<code>%s</code>)\n"+
			"💳 <b>نحوه دسترسی:</b> %s\n\n"+
			"📊 <b>ارزیابی ارزش و متادیتا:</b>\n"+
			"├ 💎 <b>ارزش تخمینی:</b> <code>%s GRAM</code>\n"+
			"├ 💵 <b>معادل دلاری:</b> <code>$%.2f</code>\n"+
			"├ %s <b>سطح کمیابی:</b> <b>%s</b>\n"+
			"└ 🎯 <b>ضریب اطمینان:</b> <code>%d%%</code>\n\n"+
			"⏰ <b>زمان ثبت:</b> <code>%s</code>\n"+
			"╚════════════════════════════╝",
		telegram.EscapeHTML(val.DisplayTitle),
		telegram.EscapeHTML(val.GiftID), val.SerialNumber,
		telegram.EscapeHTML(userIdent), userIDStr,
		telegram.EscapeHTML(paymentMethodLabel),
		val.ExpectedGRAM.StringFixed(2),
		val.ExpectedUSD,
		badge, telegram.EscapeHTML(rarityTier),
		val.ConfidenceScore,
		timeStr,
	)

	var row []telegram.InlineButton
	row = append(row, telegram.InlineButton{Text: "🎁 مشاهده در مینی‌اپ", URL: appLink})
	row = append(row, telegram.InlineButton{Text: "🌐 بازار گیفت فرگمنت", URL: fragmentGiftsLink})
	if parsedUserID > 0 {
		row = append(row, telegram.InlineButton{Text: "👤 کاربر", URL: fmt.Sprintf("tg://user?id=%d", parsedUserID)})
	}
	markup := telegram.BuildInlineKeyboard([][]telegram.InlineButton{row})

	notification.GetAdminNotifier().NotifyGift(context.Background(), msg, markup)
}
