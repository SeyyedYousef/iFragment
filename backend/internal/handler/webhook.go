package handler

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/config"
	"ifragment-backend/internal/crypto"
	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/gifts"
	"ifragment-backend/internal/service/notification"
	"ifragment-backend/internal/service/raffle"
	"ifragment-backend/internal/telemetry"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

var webhookHTTPClient = &http.Client{Timeout: 10 * time.Second}

type WebhookHandler struct {
	db            *repository.Database
	cache         *repository.Cache
	botRepo       *repository.BotRepo
	raffleSvc     *raffle.RaffleService
	giftsService  *gifts.GiftsService
	mtprotoClient mtproto.Client
}

func (h *WebhookHandler) SetGiftsService(s *gifts.GiftsService) {
	h.giftsService = s
}

func (h *WebhookHandler) SetMTProtoClient(c mtproto.Client) {
	h.mtprotoClient = c
}

func NewWebhookHandler(db *repository.Database, cache *repository.Cache, botRepo *repository.BotRepo, raffleSvc *raffle.RaffleService) *WebhookHandler {
	return &WebhookHandler{
		db:        db,
		cache:     cache,
		botRepo:   botRepo,
		raffleSvc: raffleSvc,
	}
}

func (h *WebhookHandler) processUpdateAsync(parentCtx context.Context, bot *repository.ManagedBot, update *TelegramUpdate) {
	defer func() {
		*update = TelegramUpdate{}
		telegramUpdatePool.Put(update)
	}()

	ctx, cancel := context.WithTimeout(parentCtx, 60*time.Second)
	defer cancel()

	cacheKey := fmt.Sprintf("update:%s:%d", bot.ID.String(), update.UpdateID)

	if update.CallbackQuery != nil {
		h.handleCallbackQuery(ctx, bot, update.CallbackQuery)
	} else if update.InlineQuery != nil {
		h.handleInlineQuery(ctx, bot, update.InlineQuery)
	} else if update.ManagedBotUpdated != nil {
		h.handleManagedBotUpdated(ctx, bot, update.ManagedBotUpdated)
	} else if update.BotSubscriptionUpdated != nil {
		h.handleBotSubscriptionUpdated(ctx, bot, update.BotSubscriptionUpdated)
	} else if update.GuestMessage != nil {
		h.handleGuestMessage(ctx, bot, update.GuestMessage)
	} else if update.Message != nil {
		if update.Message.SuccessfulPayment != nil {
			h.handleSuccessfulPaymentUpdate(ctx, bot, update.Message)
		} else {
			h.handleRegularMessageUpdate(ctx, bot, update.Message)
		}
	} else if update.EditedMessage != nil {
		h.handleRegularMessageUpdate(ctx, bot, update.EditedMessage)
	}

	if h.cache != nil && h.cache.Client != nil {
		h.cache.Client.Set(context.Background(), cacheKey, "processed", 7*24*time.Hour)
	}
}

func (h *WebhookHandler) HandleTelegramWebhook(w http.ResponseWriter, r *http.Request) {
	// Initialize the worker pool exactly once dynamically
	initWorkerPool(h)

	startTime := time.Now()
	var webhookStatus = "failed"
	botIDStr := chi.URLParam(r, "botID")
	var cacheKey string

	botID, err := uuid.Parse(botIDStr)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	// Enforce 25-second hard deadline so Telegram never times out (60s limit).
	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()

	// Verify bot exists (with negative caching and pre-auth token cache checking)
	cache := h.cache
	var bot *repository.ManagedBot
	var cachedSecret string
	var cacheHit = false

	if cache != nil && cache.Client != nil {
		// 1. Check negative cache first to mitigate DDoS on non-existent bots
		notFoundKey := "bot_not_found:" + botID.String()
		if exists, err := cache.Client.Exists(ctx, notFoundKey).Result(); err == nil && exists > 0 {
			w.WriteHeader(http.StatusNotFound)
			return
		}

		// 2. Check secret token cache
		secretKey := "bot_secret:" + botID.String()
		if val, err := cache.Client.Get(ctx, secretKey).Result(); err == nil {
			cachedSecret = val
			cacheHit = true
		}
	}

	secretToken := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")

	// If cached, validate secret token FIRST before doing any DB lookups or body parsing
	if cacheHit {
		isProd := os.Getenv("APP_ENV") == "production"
		if isProd && cachedSecret == "" {
			slog.Warn("Security Alert: bot.WebhookSecretToken is empty in cache/production", "bot_id", botID)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if cachedSecret != "" {
			expectedHash := sha256.Sum256([]byte(cachedSecret))
			tokenHash := sha256.Sum256([]byte(secretToken))

			if subtle.ConstantTimeCompare(tokenHash[:], expectedHash[:]) != 1 {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
		}
	}

	// Now fetch the actual bot if we don't have it or need the full bot object
	bot, err = h.botRepo.GetBotByID(ctx, botID)
	if err != nil || bot == nil {
		// Bot not found: cache it negatively for 5 minutes to protect DB from floods
		if cache != nil && cache.Client != nil {
			notFoundKey := "bot_not_found:" + botID.String()
			cache.Client.Set(ctx, notFoundKey, "1", 5*time.Minute)
		}
		w.WriteHeader(http.StatusNotFound)
		return
	}

	// Cache the bot secret if it wasn't a cache hit
	if !cacheHit && cache != nil && cache.Client != nil {
		secretKey := "bot_secret:" + botID.String()
		cache.Client.Set(ctx, secretKey, bot.WebhookSecretToken, 1*time.Hour)
	}

	// Validate secret token if we didn't do it via cache hit
	if !cacheHit {
		expectedSecret := bot.WebhookSecretToken
		isProd := os.Getenv("APP_ENV") == "production"
		if isProd && expectedSecret == "" {
			slog.Warn("Security Alert: bot.WebhookSecretToken is empty in production", "bot_id", bot.ID)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if expectedSecret != "" {
			expectedHash := sha256.Sum256([]byte(expectedSecret))
			tokenHash := sha256.Sum256([]byte(secretToken))

			if subtle.ConstantTimeCompare(tokenHash[:], expectedHash[:]) != 1 {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
		}
	}

	// Read raw body bytes (limit to 512KB to prevent DoS)
	bodyBytes, err := io.ReadAll(io.LimitReader(r.Body, 512*1024))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	// Central panic recovery and latency telemetry
	defer func() {
		duration := time.Since(startTime).Seconds()

		if rec := recover(); rec != nil {
			webhookStatus = "failed"
			slog.Error("CRITICAL: Panic during webhook processing. Sending to DLQ.", "panic", rec, "bot_id", botIDStr)

			if cacheKey != "" && cache != nil && cache.Client != nil {
				cache.Client.Del(context.Background(), cacheKey)
			}

			if cache != nil && cache.Client != nil {
				errStr := fmt.Sprintf("%v", rec)
				_, errX := cache.Client.XAdd(context.Background(), &redis.XAddArgs{
					Stream: "webhook:dlq",
					MaxLen: 10000,
					Values: map[string]interface{}{
						"bot_id":    botIDStr,
						"payload":   string(bodyBytes),
						"error":     errStr,
						"timestamp": time.Now().Format(time.RFC3339),
					},
				}).Result()
				if errX != nil {
					slog.Error("Failed to write to webhook DLQ", "error", errX)
				}
			}
			w.WriteHeader(http.StatusInternalServerError)
		}

		telemetry.RecordChannelWebhookLatency(botIDStr, webhookStatus, duration)
	}()

	update := telegramUpdatePool.Get().(*TelegramUpdate)
	dispatched := false
	defer func() {
		if !dispatched {
			*update = TelegramUpdate{}
			telegramUpdatePool.Put(update)
		}
	}()

	if err := json.Unmarshal(bodyBytes, update); err != nil {
		slog.Error("Error decoding update", "error", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	var updateDate int
	if update.Message != nil {
		updateDate = update.Message.Date
	} else if update.EditedMessage != nil {
		updateDate = update.EditedMessage.Date
	} else if update.ChatJoinRequest != nil {
		updateDate = update.ChatJoinRequest.Date
	} else if update.MyChatMember != nil {
		updateDate = update.MyChatMember.Date
	} else if update.ChatMember != nil {
		updateDate = update.ChatMember.Date
	}

	if updateDate > 0 {
		now := time.Now().Unix()
		diff := now - int64(updateDate)
		if diff < -300 || diff > 86400*2 {
			slog.Warn("Rejected replay attack webhook payload: dropping extremely stale message", "update_id", update.UpdateID, "date", updateDate, "server_time", now, "diff_seconds", diff)
			w.WriteHeader(http.StatusOK)
			return
		}
	}

	webhookStatus = "success"

	// ING-P1-005: Webhook state machine received -> processing (5m lease) -> processed (committed)
	cacheKey = fmt.Sprintf("update:%s:%d", botIDStr, update.UpdateID)
	if cache != nil && cache.Client != nil {
		locked, err := cache.Client.SetNX(ctx, cacheKey, "processing", 5*time.Minute).Result()
		if err != nil {
			slog.Warn("Redis error in idempotency check", "error", err, "update_id", update.UpdateID, "bot_id", botIDStr)
		} else if !locked {
			slog.Info("Duplicate/replay Telegram update dropped (already processed)", "update_id", update.UpdateID, "bot_id", botIDStr)
			w.WriteHeader(http.StatusOK)
			return
		}
	}

	if update.PreCheckoutQuery != nil {
		h.handlePreCheckoutUpdate(ctx, bot, update.PreCheckoutQuery)
		w.WriteHeader(http.StatusOK)
		return
	}

	job := WebhookJob{
		ctx:    context.WithoutCancel(ctx),
		bot:    bot,
		update: update,
		chatID: extractChatIDFromUpdate(update),
	}
	if EnqueueWebhookJob(job) {
		dispatched = true
		w.WriteHeader(http.StatusOK)
	} else {
		if cache != nil && cache.Client != nil {
			cache.Client.Del(context.Background(), cacheKey)
		}
		w.WriteHeader(http.StatusServiceUnavailable)
	}
}

func (h *WebhookHandler) handlePreCheckoutUpdate(ctx context.Context, bot *repository.ManagedBot, pq *PreCheckoutQuery) {
	botToken, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	if strings.HasPrefix(pq.InvoicePayload, "sub_stars_") {
		if pq.Currency != "XTR" {
			h.answerPreCheckout(botToken, pq.ID, false, "Invalid currency")
			return
		}
		h.answerPreCheckout(botToken, pq.ID, true, "")
		return
	}

	order, err := h.db.GetOrderByPayload(ctx, pq.InvoicePayload)
	if err != nil {
		slog.Warn("Pre-checkout failed: Order not found for payload", "payload", pq.InvoicePayload)
		h.answerPreCheckout(botToken, pq.ID, false, "Order verification failed")
	} else if order.Status == "paid" {
		slog.Warn("Pre-checkout failed: Order already paid", "payload", pq.InvoicePayload)
		h.answerPreCheckout(botToken, pq.ID, false, "Order already paid")
	} else if pq.Currency != "XTR" {
		slog.Warn("Pre-checkout failed: Invalid currency", "expected", "XTR", "got", pq.Currency)
		h.answerPreCheckout(botToken, pq.ID, false, "Invalid currency")
	} else if order.Amount != pq.TotalAmount {
		slog.Warn("Pre-checkout failed: Amount mismatch", "expected", order.Amount, "got", pq.TotalAmount)
		h.answerPreCheckout(botToken, pq.ID, false, "Price mismatch")
	} else if pq.From == nil || pq.From.ID != order.UserID {
		slog.Warn("Pre-checkout failed: User mismatch", "payload", pq.InvoicePayload)
		h.answerPreCheckout(botToken, pq.ID, false, "User mismatch")
	} else {
		h.answerPreCheckout(botToken, pq.ID, true, "")
	}
}

func (h *WebhookHandler) handleSuccessfulPaymentUpdate(ctx context.Context, bot *repository.ManagedBot, msg *Message) {
	pay := msg.SuccessfulPayment
	slog.Info("Successful payment received for payload", "payload", pay.InvoicePayload)

	if strings.HasPrefix(pay.InvoicePayload, "stars_premium_1m:") {
		parts := strings.Split(pay.InvoicePayload, ":")
		if len(parts) == 2 {
			userID, parseErr := strconv.ParseInt(parts[1], 10, 64)
			if parseErr == nil {
				err := h.db.CompleteStarsPremiumPayment(ctx, pay.InvoicePayload, pay.TelegramPaymentChargeID, userID, 30*24*time.Hour)
				if err != nil {
					slog.Error("CRITICAL: Failed to complete Stars premium payment atomically", "error", err, "user_id", userID, "payload", pay.InvoicePayload)
					return
				}
				slog.Info("Granted 30-day Premium access to User via Stars Webhook", "user_id", userID)

				auditRepo := repository.NewAuditRepo(h.db)
				targetType := "user"
				targetID := strconv.FormatInt(userID, 10)
				_ = auditRepo.Log(ctx, &repository.AuditLog{
					ActorID:    userID,
					Action:     "premium.grant",
					TargetType: &targetType,
					TargetID:   &targetID,
				})
			}
		}
	} else if strings.HasPrefix(pay.InvoicePayload, "val_pro:") {
		parts := strings.Split(pay.InvoicePayload, ":")
		if len(parts) >= 2 {
			userID, parseErr := strconv.ParseInt(parts[1], 10, 64)
			discountPercent := 0
			if len(parts) >= 4 {
				discountPercent, _ = strconv.Atoi(parts[3])
			}
			if parseErr == nil && userID > 0 {
				tx, err := h.db.Pool.Begin(ctx)
				if err != nil {
					slog.Error("CRITICAL: Failed to begin transaction for val_pro payment", "error", err, "user_id", userID, "payload", pay.InvoicePayload)
					h.pushPaymentDLQ(ctx, "begin_tx_failed", pay.InvoicePayload, err)
					notification.GetAdminNotifier().NotifyPayment(ctx, fmt.Sprintf("🚨 <b>Payment TX Error</b>\nFailed to begin TX for user %d (payload: %s): %v", userID, pay.InvoicePayload, err))
					return
				}
				defer tx.Rollback(ctx)

				if discountPercent > 0 {
					_, requiredCoins := config.CalculateRequiredCoinsForDiscount(config.Economics.ProValuationStars, discountPercent)
					if err := h.db.DeductCreditsFIFO(ctx, tx, userID, requiredCoins); err != nil {
						slog.Error("CRITICAL: Failed to deduct credits for val_pro payment", "error", err, "user_id", userID, "required_coins", requiredCoins)
						_ = tx.Rollback(ctx)
						h.pushPaymentDLQ(ctx, "deduct_credits_failed", pay.InvoicePayload, err)
						notification.GetAdminNotifier().NotifyPayment(ctx, fmt.Sprintf("🚨 <b>Credit Deduction Failed</b>\nUser %d failed to deduct %.0f coins: %v", userID, requiredCoins, err))

						userLang, _ := h.db.GetUserLanguage(ctx, userID)
						lang := i18n.DetectLanguage(userLang)
						token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
						tg := telegram.NewBotAPIClient(token)
						if tg != nil {
							failMsg := i18n.T(lang, "payment.credit_deduct_failed", nil)
							if failMsg == "" || failMsg == "payment.credit_deduct_failed" {
								failMsg = "⚠️ Your payment was received, but coin deduction encountered an issue. Our team is reviewing this."
							}
							_ = tg.SendMessage(ctx, userID, failMsg, nil, nil)
						}
						return
					}
				}

				if err := h.db.CompleteStarsPremiumPaymentTx(ctx, tx, pay.InvoicePayload, pay.TelegramPaymentChargeID, userID, config.Economics.ProValuationDuration); err != nil {
					slog.Error("CRITICAL: Failed to complete Stars pro valuation payment atomically", "error", err, "user_id", userID, "payload", pay.InvoicePayload)
					_ = tx.Rollback(ctx)
					h.pushPaymentDLQ(ctx, "complete_order_failed", pay.InvoicePayload, err)
					notification.GetAdminNotifier().NotifyPayment(ctx, fmt.Sprintf("🚨 <b>Order Completion Failed</b>\nUser %d payload %s: %v", userID, pay.InvoicePayload, err))
					return
				}

				if err := tx.Commit(ctx); err != nil {
					slog.Error("CRITICAL: Failed to commit transaction for val_pro payment", "error", err, "user_id", userID)
					h.pushPaymentDLQ(ctx, "commit_tx_failed", pay.InvoicePayload, err)
					notification.GetAdminNotifier().NotifyPayment(ctx, fmt.Sprintf("🚨 <b>TX Commit Failed</b>\nUser %d payload %s: %v", userID, pay.InvoicePayload, err))
					return
				}

				slog.Info("Granted Pro Valuation access to User via Stars Webhook", "user_id", userID, "duration", config.Economics.ProValuationDuration)

				if h.cache != nil && h.cache.Client != nil {
					h.cache.Client.Set(ctx, fmt.Sprintf("user_val_pro:%d", userID), "true", config.Economics.ProValuationDuration)
				}

				userLang, _ := h.db.GetUserLanguage(ctx, userID)
				lang := i18n.DetectLanguage(userLang)
				token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
				tg := telegram.NewBotAPIClient(token)
				if tg != nil {
					welcomeMsg := i18n.T(lang, "notifications.pro_pass_activated", nil)
					if welcomeMsg == "" || welcomeMsg == "notifications.pro_pass_activated" {
						welcomeMsg = "👑 <b>iFragment Pro Pass Activated!</b>\n\nYou now have 30 days of:\n• 3 Deep Daily Valuations\n• 70%+ Fragment Arbitrage Alerts\n• Official Digital Valuation Certificate\n\nEnjoy trading on Fragment!"
					}
					_ = tg.SendMessage(ctx, userID, welcomeMsg, nil, nil)
				}

				auditRepo := repository.NewAuditRepo(h.db)
				targetType := "user"
				targetID := strconv.FormatInt(userID, 10)
				_ = auditRepo.Log(ctx, &repository.AuditLog{
					ActorID:    userID,
					Action:     "valuation.pro.grant",
					TargetType: &targetType,
					TargetID:   &targetID,
				})
			}
		}
	}
}

func (h *WebhookHandler) handleRegularMessageUpdate(ctx context.Context, bot *repository.ManagedBot, msg *Message) {
	if msg.Chat == nil || (msg.From == nil && msg.SenderChat == nil) {
		return
	}

	raw := strings.TrimSpace(msg.Text)
	if raw == "" {
		raw = strings.TrimSpace(msg.Caption)
	}

	// 1. If message contains a Gift link, sniff & analyze automatically
	if giftLinkRegex.MatchString(raw) {
		h.handleGiftLinkSniff(ctx, bot, msg, raw)
		return
	}

	// 2. Private chat commands (/start, /language, /help, /gift, /gifts, /ping)
	if msg.Chat.Type == "private" {
		h.handlePrivateCommand(ctx, bot, msg)
		return
	}

	// 3. Paid-message raffle ticket registration for @FragmentInvestors group
	if raffle.IsFragmentInvestorsGroup(msg.Chat.Title, msg.Chat.Username) && msg.From != nil {
		if !msg.From.IsBot && h.raffleSvc != nil {
			token, err := crypto.DecryptToken(bot.BotTokenEncrypted)
			if err == nil && token != "" {
				tgClient := telegram.NewBotAPIClient(token)
				uComp := raffle.UserCompact{
					ID:        msg.From.ID,
					IsBot:     msg.From.IsBot,
					FirstName: msg.From.FirstName,
					Username:  msg.From.Username,
					IsPremium: msg.From.IsPremium,
				}
				_ = h.raffleSvc.RecordMessageTicket(ctx, tgClient, msg.Chat.ID, uComp, msg.MessageID)
			}
		}
		return
	}
}

func (h *WebhookHandler) handlePrivateCommand(ctx context.Context, bot *repository.ManagedBot, m *Message) {
	cmdText := m.Text
	if cmdText == "" {
		cmdText = m.Caption
	}

	if strings.HasPrefix(cmdText, "/start") {
		miniAppURL := os.Getenv("MINI_APP_URL")
		if miniAppURL == "" {
			miniAppURL = "https://t.me/iFragmentBot/iFragment"
		}

		var startParam string
		parts := strings.Split(cmdText, " ")
		if len(parts) > 1 {
			startParam = parts[1]
		}

		if startParam != "" {
			sanitized := make([]byte, 0, len(startParam))
			for _, char := range []byte(startParam) {
				if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || char == '_' || char == '-' {
					sanitized = append(sanitized, char)
				}
			}
			startParam = string(sanitized)
		}

		if startParam != "" && !strings.HasPrefix(startParam, "group_") && !strings.HasPrefix(startParam, "gift_") && !strings.HasPrefix(startParam, "channel_") && !strings.HasPrefix(startParam, "nft_") {
			err := h.db.UpsertUser(ctx, repository.User{
				TelegramID:   m.From.ID,
				Username:     m.From.Username,
				FirstName:    m.From.FirstName,
				LastName:     "",
				LanguageCode: m.From.LanguageCode,
			})
			if err == nil {
				_, err := h.db.SetReferredBy(ctx, m.From.ID, startParam)
				if err != nil {
					slog.Debug("Referred_by skipped or invalid", "user_id", m.From.ID, "referrer_code", startParam, "error", err)
				}
			} else {
				slog.Error("Failed to upsert user for referral via webhook", "error", err)
			}
		}

		targetURL := miniAppURL
		if startParam != "" {
			if strings.Contains(miniAppURL, "?") {
				targetURL = fmt.Sprintf("%s&startapp=%s", miniAppURL, startParam)
			} else {
				targetURL = fmt.Sprintf("%s?startapp=%s", miniAppURL, startParam)
			}
		}

		userLangFromDB, _ := h.db.GetUserLanguage(ctx, m.From.ID)
		langCode := m.From.LanguageCode
		if userLangFromDB != "" {
			langCode = userLangFromDB
		}
		lang := i18n.DetectLanguage(langCode)
		userName := m.From.FirstName

		welcome := i18n.T(lang, "onboarding.welcome_public", userName)

		token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
		tg := telegram.NewBotAPIClient(token)

		btnText := i18n.T(lang, "onboarding.open_app")
		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{
						"text": btnText,
						"url":  targetURL,
					},
				},
			},
		}

		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, welcome, markup, m.MessageThreadID)
	} else if strings.HasPrefix(cmdText, "/language") {
		token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
		tg := telegram.NewBotAPIClient(token)

		msgText := i18n.T("en", "language.prompt")
		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{"text": "🇺🇸 English", "callback_data": "lang:en"},
					{"text": "🇮🇷 فارسی", "callback_data": "lang:fa"},
				},
				{
					{"text": "🇷🇺 Русский", "callback_data": "lang:ru"},
					{"text": "🇨🇳 中文", "callback_data": "lang:zh"},
				},
				{
					{"text": "🇸🇦 العربية", "callback_data": "lang:ar"},
				},
			},
		}
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, msgText, markup, m.MessageThreadID)
	} else if strings.HasPrefix(m.Text, "/help") || strings.HasPrefix(m.Text, "/commands") {
		token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
		tg := telegram.NewBotAPIClient(token)

		userLangFromDB, _ := h.db.GetUserLanguage(ctx, m.From.ID)
		langCode := m.From.LanguageCode
		if userLangFromDB != "" {
			langCode = userLangFromDB
		}
		lang := i18n.DetectLanguage(langCode)

		helpText := i18n.T(lang, "help.admin_help")
		if lang == "fa" {
			helpText += "\n\n🎁 <b>دستورات تلگرام گیفت (Day-0):</b>\n• /gift &lt;نام یا شناسه&gt; [شماره] — کارشناسی هوشمند ارزش منصفانه و کمیابی\n• /gifts — نبض زنده بازار گیفت‌ها و حجم نقدینگی\n• ارسال مستقیم لینک <code>t.me/nft/...</code> یا <code>fragment.com/gift/...</code> برای ارزیابی آنی"
		} else {
			helpText += "\n\n🎁 <b>Telegram Gifts Commands (Day-0):</b>\n• /gift &lt;name/slug&gt; [num] — 4-Pillar Fair Valuation & Rarity Appraisal\n• /gifts — Telegram Gifts Market Pulse & Macro Stats\n• Send any <code>t.me/nft/...</code> or <code>fragment.com/gift/...</code> link for instant appraisal"
		}
		_ = tg.SendMessage(ctx, m.Chat.ID, helpText, &m.MessageID, m.MessageThreadID)
	} else if strings.HasPrefix(m.Text, "/gift ") || m.Text == "/gift" {
		h.handleGiftCommand(ctx, bot, m)
	} else if strings.HasPrefix(m.Text, "/gifts") {
		h.handleGiftsCommand(ctx, bot, m)
	} else if strings.HasPrefix(m.Text, "/ping") {
		token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
		tg := telegram.NewBotAPIClient(token)

		msgTime := time.Unix(int64(m.Date), 0)
		latency := time.Since(msgTime).Milliseconds()
		if latency < 0 {
			latency = 0
		}
		_ = tg.SendMessage(ctx, m.Chat.ID, fmt.Sprintf("🏓 <b>Pong!</b> Latency: <code>%dms</code>", latency), &m.MessageID, m.MessageThreadID)
	}
}

func (h *WebhookHandler) handleCallbackQuery(ctx context.Context, bot *repository.ManagedBot, cq *CallbackQuery) {
	if strings.HasPrefix(cq.Data, "lang:") {
		parts := strings.Split(cq.Data, ":")
		if len(parts) >= 2 {
			newLang := parts[1]
			err := h.db.UpdateUserLanguage(ctx, cq.From.ID, newLang)

			token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
			tg := telegram.NewBotAPIClient(token)

			var msg string
			if err == nil {
				msg = i18n.T(newLang, "profile.languageSettings") + " ✅"
			} else {
				msg = "Error updating language"
			}

			_ = tg.AnswerCallbackQuery(ctx, cq.ID, msg, false)
			if cq.Message != nil {
				_ = tg.DeleteMessage(ctx, cq.Message.Chat.ID, cq.Message.MessageID)
			}
		}
		return
	}
}

func (h *WebhookHandler) HandleTonAPIWebhook(w http.ResponseWriter, r *http.Request) {
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	sigHeader := r.Header.Get("X-Tonapi-Signature")
	if sigHeader == "" {
		sigHeader = r.Header.Get("x-tonapi-signature")
	}

	secret := os.Getenv("TONAPI_WEBHOOK_SECRET")
	isProd := os.Getenv("APP_ENV") == "production"

	if isProd && secret == "" {
		slog.Warn("Security Alert: TONAPI_WEBHOOK_SECRET is empty in production, rejecting webhook request")
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	if secret != "" {
		if sigHeader == "" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(bodyBytes)
		expectedMAC := mac.Sum(nil)

		sigBytes, err := hex.DecodeString(sigHeader)
		if err != nil || subtle.ConstantTimeCompare(sigBytes, expectedMAC) != 1 {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
	}

	var payload struct {
		Event      string `json:"event"`
		Account    string `json:"account"`
		NFTAddress string `json:"nft_address"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	slog.Info("Received TonAPI webhook event", "event", payload.Event, "account", payload.Account, "nft", payload.NFTAddress)
	w.WriteHeader(http.StatusOK)
}

func (h *WebhookHandler) answerPreCheckout(botToken string, id string, ok bool, errorMessage string) {
	tg := telegram.NewBotAPIClient(botToken)
	payload := map[string]interface{}{
		"pre_checkout_query_id": id,
		"ok":                    ok,
	}
	if !ok {
		payload["error_message"] = errorMessage
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	_, err := tg.Request(ctx, "answerPreCheckoutQuery", payload)
	if err != nil {
		slog.Error("CRITICAL: Failed to answer pre-checkout query", "error", err, "query_id", id)
	}
}

func (h *WebhookHandler) pushPaymentDLQ(ctx context.Context, reason string, payload string, err error) {
	if h.cache != nil && h.cache.Client != nil {
		_, errX := h.cache.Client.XAdd(ctx, &redis.XAddArgs{
			Stream: "payment:dlq",
			MaxLen: 10000,
			Values: map[string]interface{}{
				"reason":    reason,
				"payload":   payload,
				"error":     fmt.Sprintf("%v", err),
				"timestamp": time.Now().Format(time.RFC3339),
			},
		}).Result()
		if errX != nil {
			slog.Error("Failed to write to payment DLQ", "error", errX)
		}
	}
}

func GoSafe(fn func()) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("GoSafe recovered from panic", "panic", r)
			}
		}()
		fn()
	}()
}

func logIfErr(err error, msg string, args ...interface{}) {
	if err != nil {
		slog.Error(msg, append(args, "error", err)...)
	}
}
