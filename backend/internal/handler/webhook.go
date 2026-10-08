package handler

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"

	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/config"
	"ifragment-backend/internal/crypto"
	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service"
	"ifragment-backend/internal/service/cardgen"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/gifts"
	"ifragment-backend/internal/service/intelcredit"
	"ifragment-backend/internal/service/notification"
	"ifragment-backend/internal/service/numbers"
	"ifragment-backend/internal/service/numbers/features"
	"ifragment-backend/internal/service/raffle"
	"ifragment-backend/internal/service/username/avm"
	"ifragment-backend/internal/telemetry"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

var webhookHTTPClient = &http.Client{Timeout: 10 * time.Second}

type WebhookHandler struct {
	db                 *repository.Database
	cache              *repository.Cache
	botRepo            *repository.BotRepo
	raffleSvc          *raffle.RaffleService
	premiumGroupSvc    *raffle.PremiumGroupService
	giftsService       *gifts.GiftsService
	mtprotoClient      mtproto.Client
	webhookInbox       *repository.WebhookInboxRepo
	numbersService     *numbers.NumbersService
	avmService         *avm.ValuationService
	cryptoPrice        *cryptoprice.CryptoPriceService
	intelCreditService *intelcredit.IntelCreditService
	intelStoreService  *intelcredit.StoreService
	profileService     *service.ProfileService
	cardGen            *cardgen.CardGenerator
	settingsRepo       *repository.SettingsRepo
	ownerRepo          *repository.OwnerRepo
	templateRepo       *repository.BotTemplateRepo
	groupLeaderboardSvc *service.GroupLeaderboardService
	botClients         sync.Map // map[string]*telegram.BotAPIClient keyed by bot token
}


// getBotClient returns a cached *telegram.BotAPIClient or creates and stores a new one thread-safely
func (h *WebhookHandler) getBotClient(bot *repository.ManagedBot) *telegram.BotAPIClient {
	if bot == nil {
		return nil
	}
	token, err := crypto.DecryptToken(bot.BotTokenEncrypted)
	if err != nil || token == "" {
		slog.Error("getBotClient: failed to decrypt bot token", "bot_id", bot.ID, "error", err)
		return nil
	}
	if client, ok := h.botClients.Load(token); ok {
		if tg, ok := client.(*telegram.BotAPIClient); ok {
			return tg
		}
	}
	newClient := telegram.NewBotAPIClient(token)
	h.botClients.Store(token, newClient)
	return newClient
}

func (h *WebhookHandler) SetCardGenerator(cg *cardgen.CardGenerator) {
	h.cardGen = cg
}

func (h *WebhookHandler) SetGiftsService(s *gifts.GiftsService) {
	h.giftsService = s
}

func (h *WebhookHandler) SetMTProtoClient(c mtproto.Client) {
	h.mtprotoClient = c
}

func (h *WebhookHandler) SetNumbersService(s *numbers.NumbersService) {
	h.numbersService = s
}

func (h *WebhookHandler) SetAVMService(s *avm.ValuationService) {
	h.avmService = s
}

func (h *WebhookHandler) SetCryptoPriceService(s *cryptoprice.CryptoPriceService) {
	h.cryptoPrice = s
}

func (h *WebhookHandler) SetIntelCreditService(s *intelcredit.IntelCreditService) {
	h.intelCreditService = s
}

func (h *WebhookHandler) SetProfileService(s *service.ProfileService) {
	h.profileService = s
}

func (h *WebhookHandler) SetSettingsRepo(r *repository.SettingsRepo) {
	h.settingsRepo = r
}

func (h *WebhookHandler) SetOwnerRepo(r *repository.OwnerRepo) {
	h.ownerRepo = r
}

func (h *WebhookHandler) SetTemplateRepo(r *repository.BotTemplateRepo) {
	h.templateRepo = r
}

func (h *WebhookHandler) SetPremiumGroupService(s *raffle.PremiumGroupService) {
	h.premiumGroupSvc = s
}

func (h *WebhookHandler) SetGroupLeaderboardService(s *service.GroupLeaderboardService) {
	h.groupLeaderboardSvc = s
}

func NewWebhookHandler(db *repository.Database, cache *repository.Cache, botRepo *repository.BotRepo, raffleSvc *raffle.RaffleService, premiumGroupSvc ...*raffle.PremiumGroupService) *WebhookHandler {
	var pgs *raffle.PremiumGroupService
	if len(premiumGroupSvc) > 0 && premiumGroupSvc[0] != nil {
		pgs = premiumGroupSvc[0]
	} else if raffleSvc != nil {
		pgs = raffle.NewPremiumGroupService(raffleSvc.GetRepo())
	}

	return &WebhookHandler{
		db:              db,
		cache:           cache,
		botRepo:         botRepo,
		raffleSvc:       raffleSvc,
		premiumGroupSvc: pgs,
		webhookInbox:    repository.NewWebhookInboxRepo(db),
		templateRepo:    repository.NewBotTemplateRepo(db, cache),
	}
}

func (h *WebhookHandler) processUpdateAsync(parentCtx context.Context, bot *repository.ManagedBot, update *TelegramUpdate) {
	cleanExit := false
	defer func() {
		if cleanExit {
			*update = TelegramUpdate{}
			telegramUpdatePool.Put(update)
		}
	}()

	ctx, cancel := context.WithTimeout(parentCtx, 60*time.Second)
	defer cancel()

	cacheKey := fmt.Sprintf("update:%s:%d", bot.ID.String(), update.UpdateID)

	var processErr error
	func() {
		defer func() {
			if r := recover(); r != nil {
				processErr = fmt.Errorf("panic during update processing: %v", r)
				slog.Error("Panic recovered in processUpdateAsync", "bot_id", bot.ID, "update_id", update.UpdateID, "panic", r)
			}
		}()

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
		} else if update.ChatJoinRequest != nil {
			h.handleChatJoinRequest(ctx, bot, update.ChatJoinRequest)
		} else if update.ChatMember != nil {
			h.handleChatMemberUpdated(ctx, bot, update.ChatMember)
		} else if update.Message != nil {
			if update.Message.GuestQueryID != "" {
				h.handleGuestMessage(ctx, bot, &GuestMessageUpdate{
					GuestQueryID: update.Message.GuestQueryID,
					From:         *update.Message.From,
					Message:      *update.Message,
				})
			} else if update.Message.SuccessfulPayment != nil {
				h.handleSuccessfulPaymentUpdate(ctx, bot, update.Message)
			} else {
				h.handleRegularMessageUpdate(ctx, bot, update.Message, false)
			}
		} else if update.EditedMessage != nil {
			h.handleRegularMessageUpdate(ctx, bot, update.EditedMessage, true)
		} else if update.ChatBoost != nil {
			h.handleChatBoost(ctx, bot, update.ChatBoost)
		} else if update.RemovedChatBoost != nil {
			h.handleRemovedChatBoost(ctx, bot, update.RemovedChatBoost)
		}
	}()

	if processErr != nil {
		// On error, delete processing lease from Redis so Telegram / webhook retries can be processed
		if h.cache != nil && h.cache.Client != nil {
			h.cache.Client.Del(context.Background(), cacheKey)
		}
		if h.webhookInbox != nil {
			_ = h.webhookInbox.MarkFailedOrDLQ(context.Background(), bot.ID, int64(update.UpdateID), processErr.Error())
		}
		return
	}

	if h.cache != nil && h.cache.Client != nil {
		h.cache.Client.Set(context.Background(), cacheKey, "processed", 7*24*time.Hour)
	}
	if h.webhookInbox != nil {
		if err := h.webhookInbox.MarkProcessed(context.Background(), bot.ID, int64(update.UpdateID)); err != nil {
			slog.Error("Failed to mark update as processed in durable inbox", "bot_id", bot.ID, "update_id", update.UpdateID, "error", err)
		}
	}
	cleanExit = true
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
		isNotFound := errors.Is(err, pgx.ErrNoRows) || (err != nil && strings.Contains(strings.ToLower(err.Error()), "not found"))
		if isNotFound {
			// Bot genuinely not found: cache it negatively for 5 minutes to protect DB from floods
			if cache != nil && cache.Client != nil {
				notFoundKey := "bot_not_found:" + botID.String()
				cache.Client.Set(ctx, notFoundKey, "1", 5*time.Minute)
			}
			w.WriteHeader(http.StatusNotFound)
			return
		}
		// Transient DB error: return 500 so Telegram retries instead of caching a 5-minute 404
		slog.Error("Database error during bot lookup in webhook", "bot_id", botID, "error", err)
		w.WriteHeader(http.StatusInternalServerError)
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

	var update *TelegramUpdate

	update = telegramUpdatePool.Get().(*TelegramUpdate)
	dispatched := false
	panicked := false
	var incomingUpdateID int
	defer func() {
		if !dispatched && !panicked {
			*update = TelegramUpdate{}
			telegramUpdatePool.Put(update)
		}
	}()

	// Central panic recovery and latency telemetry
	defer func() {
		duration := time.Since(startTime).Seconds()

		if rec := recover(); rec != nil {
			panicked = true
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

			if h.webhookInbox != nil && bot != nil && incomingUpdateID != 0 {
				_ = h.webhookInbox.MarkFailedOrDLQ(context.Background(), bot.ID, int64(incomingUpdateID), fmt.Sprintf("%v", rec))
			}

			w.WriteHeader(http.StatusInternalServerError)
		}

		telemetry.RecordChannelWebhookLatency(botIDStr, webhookStatus, duration)
	}()

	if err := json.Unmarshal(bodyBytes, update); err != nil {
		slog.Error("Error decoding update", "error", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	incomingUpdateID = update.UpdateID

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

	// Finding 5: Durable PostgreSQL Inbox State Machine + Redis Fast-path
	payloadHashBytes := sha256.Sum256(bodyBytes)
	payloadHash := hex.EncodeToString(payloadHashBytes[:])
	chatID := extractChatIDFromUpdate(update)

	if h.webhookInbox != nil {
		isDup, err := h.webhookInbox.RecordIncoming(ctx, bot.ID, int64(update.UpdateID), chatID, payloadHash, bodyBytes)
		if err != nil {
			slog.Warn("Webhook inbox record warning", "error", err, "update_id", update.UpdateID, "bot_id", botIDStr)
		} else if isDup {
			slog.Info("Duplicate/replay Telegram update dropped by durable inbox", "update_id", update.UpdateID, "bot_id", botIDStr)
			w.WriteHeader(http.StatusOK)
			return
		}
	}

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
	if strings.HasPrefix(pq.InvoicePayload, "sub_stars_") {
		if pq.Currency != "XTR" {
			h.answerPreCheckout(bot, pq.ID, false, "Invalid currency")
			return
		}
		h.answerPreCheckout(bot, pq.ID, true, "")
		return
	}

	order, err := h.db.GetOrderByPayload(ctx, pq.InvoicePayload)
	if err != nil {
		slog.Warn("Pre-checkout failed: Order not found for payload", "payload", pq.InvoicePayload)
		h.answerPreCheckout(bot, pq.ID, false, "Order verification failed")
	} else if order.Status == "paid" {
		slog.Warn("Pre-checkout failed: Order already paid", "payload", pq.InvoicePayload)
		h.answerPreCheckout(bot, pq.ID, false, "Order already paid")
	} else if pq.Currency != "XTR" {
		slog.Warn("Pre-checkout failed: Invalid currency", "expected", "XTR", "got", pq.Currency)
		h.answerPreCheckout(bot, pq.ID, false, "Invalid currency")
	} else if order.Amount != pq.TotalAmount {
		slog.Warn("Pre-checkout failed: Amount mismatch", "expected", order.Amount, "got", pq.TotalAmount)
		h.answerPreCheckout(bot, pq.ID, false, "Price mismatch")
	} else if pq.From == nil || pq.From.ID != order.UserID {
		slog.Warn("Pre-checkout failed: User mismatch", "payload", pq.InvoicePayload)
		h.answerPreCheckout(bot, pq.ID, false, "User mismatch")
	} else {
		h.answerPreCheckout(bot, pq.ID, true, "")
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
				if err := auditRepo.Log(ctx, &repository.AuditLog{
					ActorID:    userID,
					Action:     "premium.grant",
					TargetType: &targetType,
					TargetID:   &targetID,
				}); err != nil {
					slog.Error("Failed to log audit for premium grant", "user_id", userID, "operation", "premium.grant", "error", err)
				}
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
						tg := h.getBotClient(bot)
						if tg != nil {
							failMsg := i18n.T(lang, "payments.credit_deduct_failed", nil)
							if failMsg == "" || failMsg == "payments.credit_deduct_failed" {
								failMsg = "⚠️ Your payment was received, but coin deduction encountered an issue. Our team is reviewing this."
							}
							_ = tg.SendMessage(ctx, userID, failMsg, nil, nil)
						}
						return
					}
				}

				if err := h.db.CompleteStarsPremiumPaymentTx(ctx, tx, pay.InvoicePayload, pay.TelegramPaymentChargeID, userID, config.Economics.ProValuationDuration); err != nil {
					slog.Error("CRITICAL: Failed to complete Stars pro valuation payment atomically", "error", err, "user_id", userID, "operation", "payment.complete_stars_val_pro", "payload", pay.InvoicePayload)
					_ = tx.Rollback(ctx)
					h.pushPaymentDLQ(ctx, "complete_order_failed", pay.InvoicePayload, err)
					notification.GetAdminNotifier().NotifyPayment(ctx, fmt.Sprintf("🚨 <b>Order Completion Failed</b>\nUser %d payload %s: %v", userID, pay.InvoicePayload, err))
					return
				}

				if err := tx.Commit(ctx); err != nil {
					slog.Error("CRITICAL: Failed to commit transaction for val_pro payment", "error", err, "user_id", userID, "operation", "payment.commit_val_pro")
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
				tg := h.getBotClient(bot)
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
				if err := auditRepo.Log(ctx, &repository.AuditLog{
					ActorID:    userID,
					Action:     "valuation.pro.grant",
					TargetType: &targetType,
					TargetID:   &targetID,
				}); err != nil {
					slog.Error("Failed to log audit for pro valuation grant", "user_id", userID, "operation", "valuation.pro.grant", "error", err)
				}
			}
		}
	} else if strings.HasPrefix(pay.InvoicePayload, "intel_credits:") {
		parts := strings.Split(pay.InvoicePayload, ":")
		if len(parts) >= 3 {
			packID := parts[1]
			userID, parseErr := strconv.ParseInt(parts[2], 10, 64)
			if parseErr == nil && userID > 0 {
				storeSvc := h.intelStoreService
				if storeSvc == nil {
					storeSvc = intelcredit.NewStoreService(h.db)
				}
				fulfilled, err := storeSvc.FulfillStarsPurchase(ctx, userID, packID, pay.TelegramPaymentChargeID)
				if err != nil {
					slog.Error("CRITICAL: Failed to fulfill Intel Credits Stars purchase", "error", err, "user_id", userID, "operation", "payment.fulfill_intel_credits", "pack_id", packID, "charge_id", pay.TelegramPaymentChargeID)
					h.pushPaymentDLQ(ctx, "fulfill_intel_credits_failed", pay.InvoicePayload, err)
					notification.GetAdminNotifier().NotifyPayment(ctx, fmt.Sprintf("🚨 <b>Intel Credits Fulfillment Failed</b>\nUser %d pack %s charge %s: %v", userID, packID, pay.TelegramPaymentChargeID, err))

					tg := h.getBotClient(bot)
					if tg != nil {
						// Attempt immediate refund via Telegram Stars API
						refundErr := tg.RefundStarPayment(ctx, userID, pay.TelegramPaymentChargeID)
						userLang, _ := h.db.GetUserLanguage(ctx, userID)
						lang := i18n.DetectLanguage(userLang)

						var failNotice string
						if refundErr == nil {
							slog.Info("Successfully refunded Stars payment after fulfillment error", "user_id", userID, "charge_id", pay.TelegramPaymentChargeID)
							if lang == "fa" {
								failNotice = "⚠️ در اعطای بسته اعتباری خطایی رخ داد. مبلغ ستاره‌های پرداختی به حساب تلگرام شما استرداد (Refund) گردید."
							} else {
								failNotice = "⚠️ A technical issue occurred while granting your credit pack. Your Telegram Stars have been automatically refunded."
							}
						} else {
							slog.Error("CRITICAL: Failed to refund Stars payment after fulfillment error", "error", refundErr, "user_id", userID, "charge_id", pay.TelegramPaymentChargeID)
							if lang == "fa" {
								failNotice = "⚠️ پرداخت شما دریافت شد، اما در شارژ خودکار اعتبار مشکلی پیش آمد. تیم پشتیبانی در حال پیگیری و واریز اعتبار شماست."
							} else {
								failNotice = "⚠️ Your payment was received, but credit activation encountered a delay. Our team has been alerted and will fulfill it promptly."
							}
						}
						_ = tg.SendMessage(ctx, userID, failNotice, nil, nil)
					}
					return
				} else if fulfilled {
					creditsGranted := intelcredit.PackCredits(packID)
					slog.Info("Successfully granted Intel Credits via Stars", "user_id", userID, "credits", creditsGranted, "pack_id", packID)

					// Update order status if order exists
					if err := h.db.UpdateOrderStatus(ctx, pay.InvoicePayload, "paid", pay.TelegramPaymentChargeID); err != nil {
						slog.Error("Failed to update order status to paid", "user_id", userID, "operation", "order.update_status_paid", "payload", pay.InvoicePayload, "error", err)
					}

					tg := h.getBotClient(bot)
					if tg != nil {
						userLang, _ := h.db.GetUserLanguage(ctx, userID)
						lang := i18n.DetectLanguage(userLang)
						var successText string
						if lang == "fa" {
							successText = fmt.Sprintf("✅ <b>خرید بسته کریدت با موفقیت انجام شد!</b>\n\nتعداد <b>%d کریدت تحلیل</b> به حساب شما افزوده شد.\nاکنون می‌توانید گزارش‌های موشکافانه دارایی‌ها را آزاد کنید.", creditsGranted)
						} else {
							successText = fmt.Sprintf("✅ <b>Credit Pack Purchase Successful!</b>\n\n<b>%d Intel Credits</b> have been added to your account.\nYou can now unlock deep asset intelligence reports.", creditsGranted)
						}
						_ = tg.SendMessage(ctx, userID, successText, nil, nil)
					}
				}
			}
		}
	}
}

func (h *WebhookHandler) handleRegularMessageUpdate(ctx context.Context, bot *repository.ManagedBot, msg *Message, isEdited bool) {
	if msg.Chat == nil || (msg.From == nil && msg.SenderChat == nil) {
		return
	}

	raw := strings.TrimSpace(msg.Text)
	if raw == "" {
		raw = strings.TrimSpace(msg.Caption)
	}

	// Always ensure user exists in repository so foreign key references never fail
	if msg.From != nil && !msg.From.IsBot && h.db != nil {
		if err := h.db.UpsertUser(ctx, repository.User{
			TelegramID:   msg.From.ID,
			Username:     msg.From.Username,
			FirstName:    msg.From.FirstName,
			LastName:     msg.From.LastName,
			LanguageCode: msg.From.LanguageCode,
		}); err != nil {
			slog.Error("Failed to upsert user on message", "user_id", msg.From.ID, "operation", "user.upsert", "error", err)
		}
	}

	// Edited messages should not re-trigger gate, commands, or automated sniffing
	if isEdited {
		return
	}

	// 1. If message contains a Gift link, sniff & analyze automatically (only in private chat or when bot is explicitly mentioned in groups)
	if giftLinkRegex.MatchString(raw) {
		isGroup := msg.Chat.Type == "group" || msg.Chat.Type == "supergroup"
		botMention := "@" + strings.TrimPrefix(bot.BotUsername, "@")
		isMentioned := bot.BotUsername != "" && strings.Contains(raw, botMention)
		if !isGroup || isMentioned {
			h.handleGiftLinkSniff(ctx, bot, msg, raw)
			return
		}
	}

	// 2. Private chat commands (/start, /language, /help, /gift, /gifts, /ping)
	if msg.Chat.Type == "private" {
		h.handlePrivateCommand(ctx, bot, msg)
		return
	}

	// 3. Activity tracking for @FragmentInvestors group
	if (msg.Chat.ID == -1001972125896 || raffle.IsFragmentInvestorsGroup(msg.Chat.Title, msg.Chat.Username)) && msg.From != nil {
		// Record message in Leaderboard & grant 1 Intel Credit (1 message = 1 credit)
		if !msg.From.IsBot && h.groupLeaderboardSvc != nil {
			_ = h.groupLeaderboardSvc.RecordGroupMessage(ctx, msg.From.ID, msg.From.Username, msg.From.FirstName, "", msg.MessageID)
		}

		// Check if message is mentioning the bot or requesting an asset valuation / command
		botMention := "@" + strings.TrimPrefix(bot.BotUsername, "@")
		isMentioned := bot.BotUsername != "" && strings.Contains(raw, botMention)
		isSniffable := giftLinkRegex.MatchString(raw) || SniffAsset(raw) != nil

		if !isMentioned && !isSniffable && !strings.HasPrefix(raw, "/") {
			return
		}
	}

	// 4. Group / Supergroup Mention & Command handling: when bot is tagged or addressed in a group
	if (msg.Chat.Type == "group" || msg.Chat.Type == "supergroup") && bot.BotUsername != "" {
		botMention := "@" + strings.TrimPrefix(bot.BotUsername, "@")
		isFI := msg.Chat.ID == -1001972125896 || raffle.IsFragmentInvestorsGroup(msg.Chat.Title, msg.Chat.Username)
		isMentioned := strings.Contains(raw, botMention)
		isDirectCmd := isFI && (strings.HasPrefix(raw, "/") || SniffAsset(raw) != nil)

		if isMentioned || isDirectCmd {
			var senderID int64
			if msg.From != nil {
				senderID = msg.From.ID
			} else if msg.SenderChat != nil {
				senderID = msg.SenderChat.ID
			}

			cleanText := strings.TrimSpace(strings.ReplaceAll(raw, botMention, ""))
			sniff := SniffAsset(cleanText)
			if sniff != nil {
				h.sendPreCheckGate(ctx, bot, msg.Chat.ID, senderID, sniff.Type, sniff.Entity, nil, msg.MessageThreadID)
			} else if isMentioned {
				h.sendHelpView(ctx, bot, msg.Chat.ID, senderID, nil, msg.MessageThreadID)
			}
			return
		}
	}
}

func (h *WebhookHandler) handleChatJoinRequest(ctx context.Context, bot *repository.ManagedBot, req *ChatJoinRequest) {
	if req == nil {
		return
	}
	slog.Info("Processing chat join request", "chat_id", req.Chat.ID, "user_id", req.From.ID, "title", req.Chat.Title)

	if req.Chat.ID == -1001972125896 || raffle.IsFragmentInvestorsGroup(req.Chat.Title, req.Chat.Username) {
		tg := h.getBotClient(bot)
		if tg != nil {
			uComp := raffle.UserCompact{
				ID:        req.From.ID,
				Username:  req.From.Username,
				FirstName: req.From.FirstName,
				IsPremium: req.From.IsPremium,
				IsBot:     req.From.IsBot,
			}
			userLang := i18n.DetectLanguage(req.From.LanguageCode)
			if h.premiumGroupSvc != nil {
				_ = h.premiumGroupSvc.HandleChatJoinRequest(ctx, tg, req.Chat.ID, req.Chat.Title, uComp, req.UserChatID, userLang)
			} else {
				_ = tg.ApproveChatJoinRequest(ctx, req.Chat.ID, req.From.ID)
			}
		}
	}
}

func (h *WebhookHandler) handleChatMemberUpdated(ctx context.Context, bot *repository.ManagedBot, cmu *ChatMemberUpdated) {
	if cmu == nil {
		return
	}
	// Premium restriction has been removed; all users are allowed without kick.
}

func (h *WebhookHandler) handlePrivateCommand(ctx context.Context, bot *repository.ManagedBot, m *Message) {
	// 0. Intercept text input if owner is currently editing a bot text or button
	if h.processOwnerInput(ctx, bot, m) {
		return
	}

	cmdText := m.Text
	if cmdText == "" {
		cmdText = m.Caption
	}

	isStartCmd := cmdText == "/start" || strings.HasPrefix(cmdText, "/start ") || strings.HasPrefix(cmdText, "/start@")
	if isStartCmd {
		miniAppURL := os.Getenv("MINI_APP_URL")
		if miniAppURL == "" {
			if bot != nil && bot.BotUsername != "" {
				miniAppURL = fmt.Sprintf("https://t.me/%s/iFragment", bot.BotUsername)
			} else {
				miniAppURL = "https://t.me/iFragmentBot/iFragment"
			}
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

		if startParam != "" {
			// Deep link routing: if user clicked a link for a specific asset, take them straight to precheck gate
			if strings.HasPrefix(startParam, "username_") || strings.HasPrefix(startParam, "val_") {
				rawEntity := strings.TrimPrefix(strings.TrimPrefix(startParam, "username_"), "val_")
				sniff := SniffAsset(rawEntity)
				if sniff != nil && sniff.Type == "username" {
					h.sendPreCheckGate(ctx, bot, m.Chat.ID, m.From.ID, "username", sniff.Entity, nil, m.MessageThreadID)
					return
				}
			} else if strings.HasPrefix(startParam, "number_") || strings.HasPrefix(startParam, "num_") {
				rawEntity := strings.TrimPrefix(strings.TrimPrefix(startParam, "number_"), "num_")
				normNum, err := features.NormalizeNumber(rawEntity)
				if err == nil && normNum != "" {
					h.sendPreCheckGate(ctx, bot, m.Chat.ID, m.From.ID, "number", normNum, nil, m.MessageThreadID)
					return
				}
			} else if strings.HasPrefix(startParam, "gift_") || strings.HasPrefix(startParam, "nft_") {
				rawEntity := strings.TrimPrefix(strings.TrimPrefix(startParam, "gift_"), "nft_")
				sniff := SniffAsset(rawEntity)
				if sniff != nil && sniff.Type == "gift" {
					h.sendPreCheckGate(ctx, bot, m.Chat.ID, m.From.ID, "gift", sniff.Entity, nil, m.MessageThreadID)
					return
				}
			}

			if !strings.HasPrefix(startParam, "group_") && !strings.HasPrefix(startParam, "channel_") {
				err := h.db.UpsertUser(ctx, repository.User{
					TelegramID:   m.From.ID,
					Username:     m.From.Username,
					FirstName:    m.From.FirstName,
					LastName:     m.From.LastName,
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
		}

		targetURL := appendStartParam(miniAppURL, startParam)

		// Send Main Interactive Menu
		firstName := m.From.FirstName
		if firstName == "" {
			firstName = m.From.Username
		}
		h.sendMainMenuWithURL(ctx, bot, m.Chat.ID, m.From.ID, firstName, targetURL, nil, m.MessageThreadID)
	} else if cmdText == "/menu" || strings.HasPrefix(cmdText, "/menu ") || strings.HasPrefix(cmdText, "/menu@") {
		firstName := m.From.FirstName
		if firstName == "" {
			firstName = m.From.Username
		}
		h.sendMainMenu(ctx, bot, m.Chat.ID, m.From.ID, firstName, nil, m.MessageThreadID)
	} else if cmdText == "/profile" || strings.HasPrefix(cmdText, "/profile ") || strings.HasPrefix(cmdText, "/profile@") {
		h.sendProfileView(ctx, bot, m.Chat.ID, m.From.ID, nil, m.MessageThreadID)
	} else if cmdText == "/language" || strings.HasPrefix(cmdText, "/language ") || strings.HasPrefix(cmdText, "/language@") {
		tg := h.getBotClient(bot)
		if tg == nil {
			return
		}

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
			},
		}
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, msgText, markup, m.MessageThreadID)
	} else if strings.HasPrefix(m.Text, "/help") || strings.HasPrefix(m.Text, "/commands") {
		h.sendHelpView(ctx, bot, m.Chat.ID, m.From.ID, nil, m.MessageThreadID)
	} else if strings.HasPrefix(m.Text, "/gift ") || m.Text == "/gift" {
		h.handleGiftCommand(ctx, bot, m)
	} else if strings.HasPrefix(m.Text, "/gifts") {
		h.handleGiftsCommand(ctx, bot, m)
	} else if strings.HasPrefix(m.Text, "/panel") || strings.HasPrefix(m.Text, "/admin") {
		h.handleAdminPanelCommand(ctx, bot, m)
	} else if strings.HasPrefix(m.Text, "/cancel") {
		tg := h.getBotClient(bot)
		if tg != nil {
			_ = tg.SendMessage(ctx, m.Chat.ID, "عملیات فعالی برای لغو وجود ندارد.", &m.MessageID, m.MessageThreadID)
		}
	} else if strings.HasPrefix(m.Text, "/ping") {
		tg := h.getBotClient(bot)
		if tg == nil {
			return
		}

		msgTime := time.Unix(int64(m.Date), 0)
		latency := time.Since(msgTime).Milliseconds()
		if latency < 0 {
			latency = 0
		}
		_ = tg.SendMessage(ctx, m.Chat.ID, fmt.Sprintf("🏓 <b>Pong!</b> Latency: <code>%dms</code>", latency), &m.MessageID, m.MessageThreadID)
	} else {
		// Smart Sniffer Fallback for direct text input in private chat
		sniff := SniffAsset(cmdText)
		if sniff != nil {
			h.sendPreCheckGate(ctx, bot, m.Chat.ID, m.From.ID, sniff.Type, sniff.Entity, nil, m.MessageThreadID)
		} else {
			// Not recognized as asset: send helpful guidance with examples
			h.sendHelpView(ctx, bot, m.Chat.ID, m.From.ID, nil, m.MessageThreadID)
		}
	}
}

func (h *WebhookHandler) handleCallbackQuery(ctx context.Context, bot *repository.ManagedBot, cq *CallbackQuery) {
	if cq.From.ID != 0 && h.db != nil {
		if err := h.db.UpsertUser(ctx, repository.User{
			TelegramID:   cq.From.ID,
			Username:     cq.From.Username,
			FirstName:    cq.From.FirstName,
			LastName:     cq.From.LastName,
			LanguageCode: cq.From.LanguageCode,
		}); err != nil {
			slog.Error("Failed to upsert user on callback query", "user_id", cq.From.ID, "operation", "user.upsert", "error", err)
		}
	}

	tg := h.getBotClient(bot)
	if tg == nil {
		return
	}

	if strings.HasPrefix(cq.Data, "lang:") {
		parts := strings.Split(cq.Data, ":")
		if len(parts) >= 2 {
			newLang := parts[1]
			// Strict whitelist for supported languages
			validLangs := map[string]bool{"en": true, "fa": true, "ru": true, "zh": true}
			if !validLangs[newLang] {
				_ = tg.AnswerCallbackQuery(ctx, cq.ID, "Invalid language", false)
				return
			}

			err := h.db.UpdateUserLanguage(ctx, cq.From.ID, newLang)
			var msg string
			if err == nil {
				msg = i18n.T(newLang, "profile.languageSettings") + " ✅"
			} else {
				slog.Error("Failed to update user language", "user_id", cq.From.ID, "operation", "user.update_language", "error", err)
				msg = "Error updating language"
			}

			_ = tg.AnswerCallbackQuery(ctx, cq.ID, msg, false)
			if cq.Message != nil {
				var msgID *int
				if cq.Message != nil {
					msgID = &cq.Message.MessageID
				}
				firstName := cq.From.FirstName
				if firstName == "" {
					firstName = cq.From.Username
				}
				h.sendMainMenu(ctx, bot, cq.Message.Chat.ID, cq.From.ID, firstName, msgID, cq.Message.MessageThreadID)
			}
		}
		return
	}

	// Acknowledge callback query early to dismiss Telegram's loading spinner instantly,
	// EXCEPT for exchange confirmation actions which require answering with a specific alert modal (showAlert=true).
	data := cq.Data
	if !strings.HasPrefix(data, "confirm_exchange:") && !strings.HasPrefix(data, "confirm_exchange_n:") {
		_ = tg.AnswerCallbackQuery(ctx, cq.ID, "", false)
	}

	var msgID *int
	var chatID int64
	var threadID *int
	if cq.Message != nil {
		msgID = &cq.Message.MessageID
		chatID = cq.Message.Chat.ID
		threadID = cq.Message.MessageThreadID
	} else {
		chatID = cq.From.ID
	}

	// 1. Navigation callbacks
	switch data {
	case "nav:menu":
		firstName := cq.From.FirstName
		if firstName == "" {
			firstName = cq.From.Username
		}
		h.sendMainMenu(ctx, bot, chatID, cq.From.ID, firstName, msgID, threadID)
		return
	case "nav:profile":
		h.sendProfileView(ctx, bot, chatID, cq.From.ID, msgID, threadID)
		return
	case "nav:help":
		h.sendHelpView(ctx, bot, chatID, cq.From.ID, msgID, threadID)
		return
	case "nav:asset_username":
		h.sendAssetPrompt(ctx, bot, chatID, cq.From.ID, "username", msgID, threadID)
		return
	case "nav:asset_number":
		h.sendAssetPrompt(ctx, bot, chatID, cq.From.ID, "number", msgID, threadID)
		return
	case "nav:asset_gifts":
		h.sendAssetPrompt(ctx, bot, chatID, cq.From.ID, "gifts", msgID, threadID)
		return
	case "nav:language":
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
					{"text": "🔙 بازگشت / Back", "callback_data": "nav:menu"},
				},
			},
		}
		h.sendOrEditMessage(ctx, tg, chatID, msgID, msgText, markup, threadID)
		return
	}

	// 2. Precheck Gate callback: precheck:<type>:<entity>
	if strings.HasPrefix(data, "precheck:") {
		parts := strings.SplitN(data, ":", 3)
		if len(parts) == 3 {
			h.sendPreCheckGate(ctx, bot, chatID, cq.From.ID, parts[1], parts[2], msgID, threadID)
		}
		return
	}

	// 3. Unlock & Valuate Report callback: unlock:<type>:<entity>
	if strings.HasPrefix(data, "unlock:") {
		parts := strings.SplitN(data, ":", 3)
		if len(parts) == 3 {
			h.executeUnlockAndReport(ctx, bot, chatID, cq.From.ID, parts[1], parts[2], msgID, threadID)
		}
		return
	}

	// 4. Exchange Coins Confirmation callback: exchange:<type>:<entity> or exchange_coins:profile
	if strings.HasPrefix(data, "exchange:") {
		parts := strings.SplitN(data, ":", 3)
		if len(parts) == 3 {
			h.sendExchangeConfirmView(ctx, bot, chatID, cq.From.ID, parts[1], parts[2], msgID, threadID)
		}
		return
	} else if data == "exchange_coins:profile" {
		h.sendExchangeConfirmView(ctx, bot, chatID, cq.From.ID, "", "", msgID, threadID)
		return
	}

	// 4b. Confirm Exchange Execution callback: confirm_exchange:... or confirm_exchange_n:<count>:...
	if strings.HasPrefix(data, "confirm_exchange:") || strings.HasPrefix(data, "confirm_exchange_n:") {
		count := 1
		var assetType, entity string
		if strings.HasPrefix(data, "confirm_exchange_n:") {
			parts := strings.Split(data, ":")
			if len(parts) >= 3 {
				if n, err := strconv.Atoi(parts[1]); err == nil && n > 0 {
					count = n
				}
				if len(parts) == 3 && parts[2] == "profile" {
					assetType = ""
					entity = ""
				} else if len(parts) == 4 && parts[2] == "t" {
					// Task 7: Short token lookup in Redis
					shortToken := parts[3]
					if h.cache != nil && h.cache.Client != nil {
						if stored, err := h.cache.Client.Get(ctx, fmt.Sprintf("ex_tok:%s", shortToken)).Result(); err == nil && stored != "" {
							tokParts := strings.SplitN(stored, ":", 2)
							if len(tokParts) == 2 {
								assetType = tokParts[0]
								entity = tokParts[1]
							}
						}
					}
				} else if len(parts) >= 4 {
					assetType = parts[2]
					entity = parts[3]
				}
			}
		} else {
			parts := strings.SplitN(data, ":", 3)
			if len(parts) == 3 {
				assetType = parts[1]
				entity = parts[2]
			}
		}
		h.handleCreditExchange(ctx, bot, chatID, cq.From.ID, assetType, entity, msgID, threadID, cq.ID, count)
		return
	}

	// 5. Stars Pack Selection callback: stars_pack:<type>:<entity> or buy_credits:profile
	if strings.HasPrefix(data, "stars_pack:") {
		parts := strings.SplitN(data, ":", 3)
		var assetType, entity string
		if len(parts) == 3 {
			assetType = parts[1]
			entity = parts[2]
		}
		h.sendStarsPacksList(ctx, bot, chatID, cq.From.ID, assetType, entity, msgID, threadID)
		return
	} else if data == "buy_credits:profile" {
		h.sendStarsPacksList(ctx, bot, chatID, cq.From.ID, "", "", msgID, threadID)
		return
	}

	// 6. Buy Pack Invoice callback: buy_pack:<packID>:<type>:<entity>
	if strings.HasPrefix(data, "buy_pack:") {
		parts := strings.SplitN(data, ":", 4)
		if len(parts) >= 2 {
			packID := parts[1]
			var assetType, entity string
			if len(parts) == 4 {
				assetType = parts[2]
				entity = parts[3]
			}
			h.createAndSendStarsInvoice(ctx, bot, chatID, cq.From.ID, packID, assetType, entity, msgID, threadID)
		}
		return
	}

	// 7. Admin Panel callback: panel:*
	if strings.HasPrefix(data, "panel:") {
		h.handleAdminPanelCallback(ctx, bot, cq)
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

func (h *WebhookHandler) answerPreCheckout(bot *repository.ManagedBot, id string, ok bool, errorMessage string) {
	tg := h.getBotClient(bot)
	if tg == nil {
		slog.Error("answerPreCheckout: cannot get bot client", "query_id", id)
		return
	}
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


// getMiniAppURL determines the full Telegram Mini App link
func (h *WebhookHandler) getMiniAppURL(bot *repository.ManagedBot) string {
	miniAppURL := os.Getenv("MINI_APP_URL")
	if miniAppURL != "" {
		return miniAppURL
	}
	if bot != nil && bot.BotUsername != "" {
		return fmt.Sprintf("https://t.me/%s/iFragment", bot.BotUsername)
	}
	return "https://t.me/iFragmentBot/iFragment"
}

// appendStartParam attaches ?startapp=... or &startapp=... to the base URL cleanly.
func appendStartParam(base, param string) string {
	if param == "" {
		return base
	}
	if strings.Contains(base, "?") {
		return fmt.Sprintf("%s&startapp=%s", base, param)
	}
	return fmt.Sprintf("%s?startapp=%s", base, param)
}

func (h *WebhookHandler) handleChatBoost(ctx context.Context, bot *repository.ManagedBot, update *ChatBoostUpdated) {
	if update == nil || h.groupLeaderboardSvc == nil {
		return
	}
	if update.Chat.ID != -1001972125896 && !raffle.IsFragmentInvestorsGroup(update.Chat.Title, update.Chat.Username) {
		return
	}
	user := update.Boost.Source.User
	if user == nil || user.ID <= 0 {
		return
	}
	tgClient := h.getBotClient(bot)
	if tgClient != nil {
		_, _ = h.groupLeaderboardSvc.SyncUserBoosts(ctx, tgClient, update.Chat.ID, user.ID, user.Username, user.FirstName, "")
	} else {
		_ = h.groupLeaderboardSvc.UpdateUserBoostCount(ctx, user.ID, user.Username, user.FirstName, "", 1)
	}
}

func (h *WebhookHandler) handleRemovedChatBoost(ctx context.Context, bot *repository.ManagedBot, update *ChatBoostRemoved) {
	if update == nil || h.groupLeaderboardSvc == nil {
		return
	}
	if update.Chat.ID != -1001972125896 && !raffle.IsFragmentInvestorsGroup(update.Chat.Title, update.Chat.Username) {
		return
	}
	user := update.Source.User
	if user == nil || user.ID <= 0 {
		return
	}
	tgClient := h.getBotClient(bot)
	if tgClient != nil {
		_, _ = h.groupLeaderboardSvc.SyncUserBoosts(ctx, tgClient, update.Chat.ID, user.ID, user.Username, user.FirstName, "")
	}
}
