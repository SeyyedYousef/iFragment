package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cardgen"
	"ifragment-backend/internal/service/intelcredit"
	"ifragment-backend/internal/service/username/avm"
)

type IntelCreditHandler struct {
	service    *intelcredit.IntelCreditService
	cache      *repository.Cache
	cardGen    *cardgen.CardGenerator
	tgClient   *telegram.BotAPIClient
	avmService *avm.ValuationService
}

func NewIntelCreditHandler(service *intelcredit.IntelCreditService, cache *repository.Cache) *IntelCreditHandler {
	return &IntelCreditHandler{service: service, cache: cache}
}

func (h *IntelCreditHandler) SetCardGenerator(cg *cardgen.CardGenerator) {
	h.cardGen = cg
}

func (h *IntelCreditHandler) SetTelegramClient(tg *telegram.BotAPIClient) {
	h.tgClient = tg
}

func (h *IntelCreditHandler) SetAVMService(avm *avm.ValuationService) {
	h.avmService = avm
}

type ConsumeCreditRequest struct {
	Reason  string `json:"reason"`   // e.g. "report:number", "report:gift", "report:username"
	Entity  string `json:"entity"`   // e.g. "+88888888888", "plush_pepe-42", "@durov"
	IdemKey string `json:"idem_key"` // Client-generated UUID for idempotency
}

// GetBalance returns user's active Intel Credit balance and nearest expiry
func (h *IntelCreditHandler) GetBalance(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	bal, err := h.service.GetBalance(ctx, userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get intel credits balance", err)
		return
	}

	w.Header().Set("Cache-Control", "private, no-cache, no-store, must-revalidate")
	RespondJSON(w, http.StatusOK, bal)
}

// Consume processes an atomic credit deduction or returns HTTP 402 if balance is insufficient
func (h *IntelCreditHandler) Consume(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	var req ConsumeCreditRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", nil)
		return
	}

	if req.IdemKey == "" {
		req.IdemKey = r.Header.Get("Idempotency-Key")
		if req.IdemKey == "" {
			req.IdemKey = r.Header.Get("X-Idempotency-Key")
		}
	}

	if req.Reason == "" {
		req.Reason = "report:intel"
	}

	remaining, err := h.service.ConsumeCredit(ctx, userID, req.Reason, req.Entity, req.IdemKey)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientIntelCredits) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusPaymentRequired) // HTTP 402
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "insufficient_credits",
				"message": "no intel credits remaining",
				"balance": 0,
			})
			return
		}
		RespondError(w, r, http.StatusInternalServerError, "failed to consume credit", err)
		return
	}

	// Proactively cache valuation access in Redis if this credit was consumed for a username report
	if req.Entity != "" {
		cleanEntity := strings.ToLower(strings.TrimPrefix(req.Entity, "@"))
		if req.Reason == "username" || req.Reason == "report:username" || req.Reason == "val_username" {
			if h.cache != nil {
				_ = h.cache.Client.Set(ctx, fmt.Sprintf("val_access:%d:%s", userID, cleanEntity), "credit", 24*time.Hour).Err()
			}
			h.deliverUsernameReportToUser(r, userID, cleanEntity)
		}
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"balance": remaining,
	})
}

// GetStoreConfig returns the server-authoritative credit store pricing.
// The Mini App must render prices exclusively from this response.
func (h *IntelCreditHandler) GetStoreConfig(w http.ResponseWriter, r *http.Request) {
	store := intelcredit.NewStoreService(nil)
	w.Header().Set("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
	RespondJSON(w, http.StatusOK, store.GetConfig())
}

type PurchaseCreditsRequest struct {
	Method string `json:"method"` // currently only "stars"
	Pack   string `json:"pack"`   // "c1", "c3p1", "c10p3"
}

// Purchase creates a pending order and returns a Telegram Stars invoice link.
// Credits are granted asynchronously by the bot webhook after successful payment.
func (h *IntelCreditHandler) Purchase(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	var req PurchaseCreditsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Pack == "" {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", nil)
		return
	}
	if req.Method != "" && req.Method != "stars" {
		RespondError(w, r, http.StatusBadRequest, "unsupported purchase method", nil)
		return
	}

	store := intelcredit.NewStoreService(h.service.DB())
	link, err := store.CreateStarsInvoice(ctx, userID, req.Pack)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to create invoice", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success":      true,
		"invoice_link": link,
	})
}

// ExchangeCoins atomically converts Airdrop Coins into 1 Intel Credit (HTTP 402 when short).
func (h *IntelCreditHandler) ExchangeCoins(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	store := intelcredit.NewStoreService(h.service.DB())
	balance, err := store.ExchangeCoins(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientCoins) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusPaymentRequired)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "insufficient_coins",
				"message": "not enough airdrop coins for exchange",
			})
			return
		}
		RespondError(w, r, http.StatusInternalServerError, "failed to exchange coins", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"balance": balance,
	})
}

func (h *IntelCreditHandler) deliverUsernameReportToUser(r *http.Request, userID int64, username string) {
	cleanUser := strings.ToLower(strings.TrimPrefix(username, "@"))
	if cleanUser == "" || userID <= 0 {
		return
	}
	tg := h.tgClient
	if tg == nil {
		token := os.Getenv("TELEGRAM_BOT_TOKEN")
		if token == "" {
			token = os.Getenv("BOT_TOKEN")
		}
		if token != "" {
			tg = telegram.NewBotAPIClient(token)
		}
	}
	if tg == nil {
		return
	}

	scheme := "https"
	host := ""
	if r != nil {
		if r.TLS == nil && r.Header.Get("X-Forwarded-Proto") != "https" {
			scheme = "http"
		}
		host = r.Host
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		miniAppURL := os.Getenv("MINI_APP_URL")
		if miniAppURL == "" {
			miniAppURL = "https://t.me/iFragmentBot/iFragment"
		}
		appLink := fmt.Sprintf("%s?startapp=val_%s", miniAppURL, cleanUser)
		fragmentLink := fmt.Sprintf("https://fragment.com/username/%s", cleanUser)

		var reportText string
		tier := "STANDARD"
		expectedTONStr := "0.0"
		expectedUSDStr := "0"

		if h.avmService != nil {
			res, err := h.avmService.Valuate(ctx, cleanUser, 0)
			if err == nil && res != nil {
				tier = res.InvestmentGrade
				expectedTONStr = res.ExpectedTON.StringFixed(1)
				expectedUSDStr = res.ExpectedUSD.StringFixed(0)

				var gradeEmoji string
				switch res.InvestmentGrade {
				case "AAA", "AA":
					gradeEmoji = "💎"
				case "A", "BBB":
					gradeEmoji = "⭐"
				default:
					gradeEmoji = "📊"
				}

				reportText = fmt.Sprintf(`🏷️ <b>کارشناسی تحلیلی نام کاربری: @%s</b>

%s درجه سرمایه‌گذاری: <b>%s</b>
📈 شاخص برندپذیری: <b>%d / 100</b>
📉 بازه برآورد ارزش: <b>%s الی %s TON</b>
💰 میانگین برآورد منصفانه: <b>~%s TON (معادل $%s)</b>

━━━━━━━━━━━━━━━━━━━
🧬 <b>ویژگی‌های ساختاری:</b>
• طول شناسه: <b>%d کاراکتر</b>
• رتبه نقدشوندگی: <b>%s</b>
• افق زمانی فروش: <b>%s</b>
• مخاطب هدف: <b>%s</b>
━━━━━━━━━━━━━━━━━━━

⚡ <i>برآورد تحلیلی موتور هوشمند AVM بر پایه سیگنال‌های معاملات فرگمنت</i>`,
					cleanUser,
					gradeEmoji, res.InvestmentGrade,
					res.Brandability,
					res.LowTON.StringFixed(1), res.HighTON.StringFixed(1),
					res.ExpectedTON.StringFixed(1), res.ExpectedUSD.StringFixed(0),
					res.Length,
					res.LiquidityRating,
					res.EstimatedSellTime,
					res.TargetBuyerProfile,
				)
			}
		}

		if reportText == "" {
			reportText = fmt.Sprintf(`🏷️ <b>کارشناسی نام کاربری: @%s</b>

گزارش کامل شاخص‌های برندپذیری، تحلیل تقاضا و ارزش‌گذاری این نام کاربری هم‌اکنون در مینی‌اپ در دسترس شماست.`, cleanUser)
		}

		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{"text": "📊 مشاهده تحلیل کامل در مینی‌اپ", "url": appLink},
				},
				{
					{"text": "🌐 مشاهده در فرگمنت", "url": fragmentLink},
				},
			},
		}

		if h.cardGen != nil {
			if pngBytes, err := h.cardGen.GenerateUsernameCard(cleanUser, tier, expectedTONStr, expectedUSDStr); err == nil {
				if fileID, err := h.cardGen.SaveCard(pngBytes); err == nil {
					var publicURL string
					if host != "" {
						publicURL = fmt.Sprintf("%s://%s/static/shares/%s.png", scheme, host, fileID)
					} else {
						publicURL = h.cardGen.GetPublicCardURL(fileID, nil)
					}
					if _, err := tg.SendPhotoWithMarkup(ctx, userID, publicURL, reportText, markup); err == nil {
						return
					}
				}
			}
		}

		_, _ = tg.SendMessageWithMarkup(ctx, userID, reportText, markup, nil)
	}()
}

