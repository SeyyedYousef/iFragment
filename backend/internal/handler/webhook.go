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
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/config"
	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"
	"ifragment-backend/internal/service/channelmgmt"
	"ifragment-backend/internal/service/intelcredit"
	"ifragment-backend/internal/service/notification"
	"io"
	"log/slog"
	"math/rand"
	"net/http"
	"os"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf16"

	"ifragment-backend/internal/telemetry"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

var webhookHTTPClient = channelmgmt.SafeHTTPClient(10 * time.Second)

type WebhookHandler struct {
	db              *repository.Database
	moderator       *botmgmt.ModeratorService
	botRepo         *repository.BotRepo
	channelService  *channelmgmt.ChannelService
	premiumGroupSvc *botmgmt.PremiumGroupService
	memberTagSvc    *botmgmt.MemberTagService
	processedJoins  sync.Map
}

func NewWebhookHandler(db *repository.Database, moderator *botmgmt.ModeratorService, botRepo *repository.BotRepo, channelService *channelmgmt.ChannelService) *WebhookHandler {
	analyticsRepo := repository.NewAnalyticsRepo(db)
	return &WebhookHandler{
		db:              db,
		moderator:       moderator,
		botRepo:         botRepo,
		channelService:  channelService,
		premiumGroupSvc: botmgmt.NewPremiumGroupService(botRepo, analyticsRepo),
		memberTagSvc:    botmgmt.NewMemberTagService(botRepo, moderator.GetSettingsRepo(), moderator.GetCache()),
	}
}

func (h *WebhookHandler) processUpdateAsync(parentCtx context.Context, bot *repository.ManagedBot, update *TelegramUpdate) {
	defer func() {
		*update = TelegramUpdate{}
		telegramUpdatePool.Put(update)
	}()
	// Fix Deadlock: Apply strict timeout to background worker using parentCtx
	ctx, cancel := context.WithTimeout(parentCtx, 60*time.Second)
	defer cancel()

	cache := h.moderator.GetCache()
	botIDStr := bot.ID.String()
	cacheKey := fmt.Sprintf("update:%s:%d", botIDStr, update.UpdateID)

	var chatID int64
	if update.Message != nil && update.Message.Chat != nil {
		chatID = update.Message.Chat.ID
	} else if update.EditedMessage != nil && update.EditedMessage.Chat != nil {
		chatID = update.EditedMessage.Chat.ID
	} else if update.CallbackQuery != nil && update.CallbackQuery.Message != nil && update.CallbackQuery.Message.Chat != nil {
		chatID = update.CallbackQuery.Message.Chat.ID
	} else if update.ChatMember != nil {
		chatID = update.ChatMember.Chat.ID
	} else if update.MyChatMember != nil {
		chatID = update.MyChatMember.Chat.ID
	} else if update.ChatJoinRequest != nil {
		chatID = update.ChatJoinRequest.Chat.ID
	} else if update.ChannelPost != nil && update.ChannelPost.Chat != nil {
		chatID = update.ChannelPost.Chat.ID
	} else if update.EditedChannelPost != nil && update.EditedChannelPost.Chat != nil {
		chatID = update.EditedChannelPost.Chat.ID
	}

	// Fast-fail if Bot is disabled for this group/channel
	if chatID < 0 {
		botEnabled := true
		botEnabledCacheKey := fmt.Sprintf("bot_enabled:%s:%d", botIDStr, chatID)

		if cache != nil && cache.Client != nil {
			val, err := cache.Client.Get(ctx, botEnabledCacheKey).Result()
			if err == nil {
				if val == "false" {
					botEnabled = false
				}
			} else {
				group, err := h.botRepo.GetGroup(ctx, bot.ID, chatID)
				if err == nil {
					settings, _ := h.moderator.GetSettings(ctx, group.ID)
					if settings != nil {
						var general repository.SettingsGeneral
						if json.Unmarshal(settings.General, &general) == nil {
							if general.BotEnabled != nil && !*general.BotEnabled {
								botEnabled = false
							}
						}
					}
				}
				cacheVal := "true"
				if !botEnabled {
					cacheVal = "false"
				}
				cache.Client.Set(ctx, botEnabledCacheKey, cacheVal, 2*time.Minute)
			}
		}

		if !botEnabled && update.MyChatMember == nil {
			// Skip processing to save resources and API calls
			// (We still process MyChatMember so we know if we get kicked)
			if cache != nil && cache.Client != nil {
				cache.Client.Set(context.Background(), cacheKey, "processed", 10*time.Minute)
			}
			return
		}
	}

	// Delegate processing to respective sub-handlers in the background worker thread
	if update.CallbackQuery != nil {
		h.handleCallbackQuery(ctx, bot, update.CallbackQuery)
	} else if update.MyChatMember != nil {
		h.handleMyChatMemberUpdate(ctx, bot, update.MyChatMember)
	} else if update.ChatMember != nil {
		h.handleChatMemberUpdate(ctx, bot, update.ChatMember)
	} else if update.ChannelPost != nil {
		h.handleChannelPost(ctx, bot, update.ChannelPost, false)
	} else if update.EditedChannelPost != nil {
		h.handleChannelPost(ctx, bot, update.EditedChannelPost, true)
	} else if update.ChatJoinRequest != nil {
		h.handleChatJoinRequest(ctx, bot, update.ChatJoinRequest)
	} else if update.ManagedBotUpdated != nil {
		h.handleManagedBotUpdated(ctx, bot, update.ManagedBotUpdated)
	} else if update.BotSubscriptionUpdated != nil {
		h.handleBotSubscriptionUpdated(ctx, bot, update.BotSubscriptionUpdated)
	} else if update.GuestMessage != nil {
		h.handleGuestMessage(ctx, bot, update.GuestMessage)
	} else if update.Message != nil {
		if update.Message.SuccessfulPayment != nil {
			h.handleSuccessfulPaymentUpdate(ctx, bot, update.Message)
		} else if len(update.Message.NewChatMembers) > 0 || update.Message.LeftChatMember != nil {
			h.handleJoinLeaveUpdate(ctx, bot, update.Message)
		} else {
			h.handleRegularMessageUpdate(ctx, bot, update.Message)
		}
	} else if update.EditedMessage != nil {
		h.handleRegularMessageUpdate(ctx, bot, update.EditedMessage)
	}

	// Complete idempotency lock safely post-execution
	if cache != nil && cache.Client != nil {
		cache.Client.Set(context.Background(), cacheKey, "processed", 10*time.Minute)
	}
}

func (h *WebhookHandler) getBotPermissionsCached(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, botID int64) (*BotPermissions, error) {
	cache := h.moderator.GetCache()
	key := fmt.Sprintf("bot_perms:%d:%d", chatID, botID)

	if cache != nil && cache.Client != nil {
		val, err := cache.Client.Get(ctx, key).Result()
		if err == nil && val != "" {
			var perms BotPermissions
			if json.Unmarshal([]byte(val), &perms) == nil {
				return &perms, nil
			}
		}
	}

	resp, err := tg.Request(ctx, "getChatMember", map[string]interface{}{
		"chat_id": chatID,
		"user_id": botID,
	})
	if err != nil {
		return nil, err
	}

	var perms BotPermissions
	if err := json.Unmarshal(resp, &perms); err != nil {
		return nil, err
	}

	if cache != nil && cache.Client != nil {
		b, _ := json.Marshal(perms)
		// Cache for 10 minutes; it will be invalidated on my_chat_member updates
		cache.Client.Set(ctx, key, b, 10*time.Minute)
	}

	return &perms, nil
}

func (h *WebhookHandler) HandleTelegramWebhook(w http.ResponseWriter, r *http.Request) {
	// Initialize the worker pool exactly once dynamically
	initWorkerPool(h.db, h.moderator, h.botRepo, h.channelService)

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
	cache := h.moderator.GetCache()
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

			// Release idempotency lock on panic so message can be retried
			if cacheKey != "" && cache != nil && cache.Client != nil {
				cache.Client.Del(context.Background(), cacheKey)
			}

			// Push raw payload to Redis Stream webhook:dlq
			if cache := h.moderator.GetCache(); cache != nil && cache.Client != nil {
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

	// S5 (Replay Window check — 300s window for Render cold-start compatibility)
	// Note: CallbackQuery messages retain their original creation date, so we do not
	// apply replay window dropping on CallbackQuery updates.
	var updateDate int
	if update.Message != nil {
		updateDate = update.Message.Date
	} else if update.EditedMessage != nil {
		updateDate = update.EditedMessage.Date
	} else if update.ChannelPost != nil {
		updateDate = update.ChannelPost.Date
	} else if update.EditedChannelPost != nil {
		updateDate = update.EditedChannelPost.Date
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
			w.WriteHeader(http.StatusOK) // Return 200 OK so Telegram drops the stale update from its retry queue
			return
		}
	}

	webhookStatus = "success"

	// 0. Strict 48h Replay & Idempotency Check with Redis SETNX
	cacheKey = fmt.Sprintf("update:%s:%d", botIDStr, update.UpdateID)
	if cache != nil && cache.Client != nil {
		locked, err := cache.Client.SetNX(ctx, cacheKey, "processed", 48*time.Hour).Result()
		if err != nil {
			slog.Warn("Redis error in idempotency check", "error", err, "update_id", update.UpdateID, "bot_id", botIDStr)
		} else if !locked {
			slog.Info("Duplicate/replay Telegram update dropped (already processed)", "update_id", update.UpdateID, "bot_id", botIDStr)
			w.WriteHeader(http.StatusOK)
			return
		}
	}

	// Process PreCheckout synchronously since Telegram demands an immediate validation return code
	if update.PreCheckoutQuery != nil {
		h.handlePreCheckoutUpdate(ctx, bot, update.PreCheckoutQuery)
		w.WriteHeader(http.StatusOK)
		return
	}

	// Offload all heavy/API-interacting webhooks to our Async Job Queue Worker Pool
	select {
	case jobQueue <- WebhookJob{ctx: context.WithoutCancel(ctx), bot: bot, update: update}:
		dispatched = true
		w.WriteHeader(http.StatusOK)
	default:
		slog.Error("CRITICAL: Webhook job queue full! Webhook dropped.")
		if cache != nil && cache.Client != nil {
			cache.Client.Del(context.Background(), cacheKey)
		}
		w.WriteHeader(http.StatusServiceUnavailable)
	}
}

func (h *WebhookHandler) tryLockOnboarding(ctx context.Context, botID uuid.UUID, chatID int64) bool {
	cache := h.moderator.GetCache()
	if cache == nil || cache.Client == nil {
		return true
	}
	key := fmt.Sprintf("onboarding_lock:%s:%d", botID.String(), chatID)
	ok, err := cache.Client.SetNX(ctx, key, "1", 10*time.Minute).Result()
	return err == nil && ok
}

func (h *WebhookHandler) handlePreCheckoutUpdate(ctx context.Context, bot *repository.ManagedBot, pq *PreCheckoutQuery) {
	botToken, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	if strings.HasPrefix(pq.InvoicePayload, "sub_stars_") || strings.HasPrefix(pq.InvoicePayload, "sub_chan_stars_") {
		// Accept the payment for subscription
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

func (h *WebhookHandler) handleMyChatMemberUpdate(ctx context.Context, bot *repository.ManagedBot, mcm *ChatMemberUpdated) {
	chat := mcm.Chat
	newStatus := mcm.NewChatMember.Status
	oldStatus := mcm.OldChatMember.Status

	isGroup := chat.Type == "group" || chat.Type == "supergroup"
	wasInChat := oldStatus == "member" || oldStatus == "administrator" || oldStatus == "creator" || oldStatus == "restricted"
	isInChat := newStatus == "member" || newStatus == "administrator"

	var fromLang string
	if mcm.From.ID != 0 {
		fromLang = mcm.From.LanguageCode
	}

	if isGroup && isInChat && !wasInChat {
		slog.Info("Bot added to group", "chat_id", chat.ID, "chat_type", chat.Type)
		if h.tryLockOnboarding(ctx, bot.ID, chat.ID) {
			h.handleBotAddedToGroup(ctx, bot, &chat, mcm.From.ID, newStatus == "administrator", fromLang)
		}
	}

	if chat.Type == "channel" {
		ch, err := h.channelService.GetChannelByChatID(ctx, chat.ID)
		if err == nil && ch != nil && ch.BotID == bot.ID {
			if newStatus == "left" || newStatus == "kicked" || (newStatus == "member" && oldStatus == "administrator") {
				slog.Warn("Bot was kicked or demoted from channel via webhook", "channel_id", ch.ID, "bot_id", bot.ID)
				_ = h.channelService.GetChannelRepo().DisconnectChannel(ctx, ch.ID)

				tg, _ := h.moderator.GetTelegramClient(ctx, bot)
				msg := i18n.T("en", "notifications.bot_removed_channel", map[string]interface{}{"channel": chat.Title})

				targetUserID := bot.OwnerUserID
				if ch.ConnectedByUserID != nil {
					targetUserID = *ch.ConnectedByUserID
				}
				logIfErr(tg.SendMessage(ctx, targetUserID, msg, nil, nil), "Failed to send owner bot_removed_channel notification", "owner_id", targetUserID)
			}
		}
		// MyChatMember updates for channels are distinct from groups; we handle and exit early.
		return
	}

	_, err := h.botRepo.GetGroup(ctx, bot.ID, chat.ID)
	if err == nil {
		tg, _ := h.moderator.GetTelegramClient(ctx, bot)

		// Invalidate bot's own permissions cache
		cache := h.moderator.GetCache()
		if cache != nil && cache.Client != nil {
			cache.Client.Del(ctx, fmt.Sprintf("bot_perms:%d:%d", chat.ID, bot.BotID))

			// Also perfectly sync the bot's standard chat member status
			key := fmt.Sprintf("chat_member:%d:%d", chat.ID, bot.BotID)
			if newStatus == "left" || newStatus == "kicked" {
				cache.Client.Del(ctx, key)
			} else {
				cache.Client.Set(ctx, key, newStatus, 1*time.Hour)
			}
		}

		lang := "en"
		managedGroup, err := h.botRepo.GetGroup(ctx, bot.ID, chat.ID)
		if err == nil {
			settings, _ := h.moderator.GetSettings(ctx, managedGroup.ID)
			if settings != nil {
				var general repository.SettingsGeneral
				if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
					lang = general.Language
				}
			}
		}

		if newStatus == "left" || newStatus == "kicked" {
			msg := i18n.T(lang, "notifications.bot_removed", map[string]interface{}{"group": chat.Title})

			targetUserID := bot.OwnerUserID
			if managedGroup != nil && managedGroup.ConnectedByUserID != nil {
				targetUserID = *managedGroup.ConnectedByUserID
			}
			logIfErr(tg.SendMessage(ctx, targetUserID, msg, nil, nil), "Failed to send owner bot_removed notification", "owner_id", targetUserID)
		} else if newStatus == "member" && (oldStatus == "administrator" || oldStatus == "creator") {
			ownerMsg := i18n.T(lang, "notifications.admin_revoked", map[string]interface{}{"group": chat.Title})

			targetUserID := bot.OwnerUserID
			if managedGroup != nil && managedGroup.ConnectedByUserID != nil {
				targetUserID = *managedGroup.ConnectedByUserID
			}
			logIfErr(tg.SendMessage(ctx, targetUserID, ownerMsg, nil, nil), "Failed to send admin_revoked owner notification", "owner_id", targetUserID)
		}
	}
}

func (h *WebhookHandler) shouldProcessJoin(ctx context.Context, chatID int64, userID int64) bool {
	cache := h.moderator.GetCache()
	if cache != nil && cache.Client != nil {
		key := fmt.Sprintf("processed_join:%d:%d", chatID, userID)
		set, err := cache.Client.SetNX(ctx, key, "1", 10*time.Second).Result()
		if err == nil {
			return set
		}
	}

	key := fmt.Sprintf("%d:%d", chatID, userID)
	now := time.Now()
	if val, ok := h.processedJoins.Load(key); ok {
		if lastTime, timeOk := val.(time.Time); timeOk && now.Sub(lastTime) < 10*time.Second {
			return false
		}
	}
	h.processedJoins.Store(key, now)

	if rand.Intn(100) == 0 {
		h.processedJoins.Range(func(k, v interface{}) bool {
			if t, ok := v.(time.Time); ok && now.Sub(t) > 30*time.Second {
				h.processedJoins.Delete(k)
			}
			return true
		})
	}

	return true
}

func (h *WebhookHandler) handleChatMemberUpdate(ctx context.Context, bot *repository.ManagedBot, cmu *ChatMemberUpdated) {
	// Sync admin lists perfectly by updating Redis cache on user chat member updates
	slog.Info("Chat member update received", "chat_id", cmu.Chat.ID, "user_id", cmu.From.ID, "new_status", cmu.NewChatMember.Status)

	cache := h.moderator.GetCache()
	if cache != nil && cache.Client != nil {
		key := fmt.Sprintf("chat_member:%d:%d", cmu.Chat.ID, cmu.NewChatMember.User.ID)
		newStatus := cmu.NewChatMember.Status
		if newStatus == "left" || newStatus == "kicked" {
			cache.Client.Del(ctx, key)
		} else {
			ttl := 5 * time.Minute
			if newStatus == "administrator" || newStatus == "creator" {
				ttl = 1 * time.Hour
			}
			cache.Client.Set(ctx, key, newStatus, ttl)
		}
	}

	// Enforce Telegram Premium restriction for @FragmentInvestors on any chat member status update (Channel, Supergroup, Group)
	if (cmu.NewChatMember.Status == "member" || cmu.NewChatMember.Status == "administrator") &&
		(cmu.OldChatMember.Status == "left" || cmu.OldChatMember.Status == "kicked" || cmu.OldChatMember.Status == "") {
		if botmgmt.IsFragmentInvestorsGroup(cmu.Chat.Title, cmu.Chat.Username) {
			if !cmu.NewChatMember.User.IsBot && !cmu.NewChatMember.User.IsPremium {
				tgClient, tgErr := h.moderator.GetTelegramClient(ctx, bot)
				if tgErr == nil && h.premiumGroupSvc != nil {
					uComp := botmgmt.UserCompact{
						ID:        cmu.NewChatMember.User.ID,
						IsBot:     cmu.NewChatMember.User.IsBot,
						FirstName: cmu.NewChatMember.User.FirstName,
						Username:  cmu.NewChatMember.User.Username,
						IsPremium: cmu.NewChatMember.User.IsPremium,
					}
					_ = h.premiumGroupSvc.ProcessMemberJoinRealtime(ctx, tgClient, cmu.Chat.ID, uComp)
					return
				}
			}
		}
	}

	// Trigger New Member Welcome for Channels
	if cmu.Chat.Type == "channel" && (cmu.NewChatMember.Status == "member" || cmu.NewChatMember.Status == "administrator") && (cmu.OldChatMember.Status == "left" || cmu.OldChatMember.Status == "kicked" || cmu.OldChatMember.Status == "") {
		ch, err := h.channelService.GetChannelByChatID(ctx, cmu.Chat.ID)
		if err == nil && ch != nil {
			tg, _ := h.moderator.GetTelegramClient(ctx, bot)
			// Pass a slice of length 1 containing the new member mapped to telegram.User
			tgUser := telegram.User{
				ID:        cmu.NewChatMember.User.ID,
				IsBot:     cmu.NewChatMember.User.IsBot,
				FirstName: cmu.NewChatMember.User.FirstName,
				Username:  cmu.NewChatMember.User.Username,
			}
			_, _ = h.channelService.ProcessNewMember(ctx, tg, ch.ID, cmu.Chat.ID, []telegram.User{tgUser})
		}
	}

	// Trigger New Member Welcome/Captcha for Groups and Supergroups (Handles large chats >50 members where message.new_chat_members is not sent)
	if (cmu.Chat.Type == "supergroup" || cmu.Chat.Type == "group") &&
		(cmu.NewChatMember.Status == "member") &&
		(cmu.OldChatMember.Status == "left" || cmu.OldChatMember.Status == "kicked" || cmu.OldChatMember.Status == "") {

		tgUser := User{
			ID:        cmu.NewChatMember.User.ID,
			IsBot:     cmu.NewChatMember.User.IsBot,
			FirstName: cmu.NewChatMember.User.FirstName,
			Username:  cmu.NewChatMember.User.Username,
			IsPremium: cmu.NewChatMember.User.IsPremium,
		}

		fakeMsg := &Message{
			Chat: &Chat{
				ID:       cmu.Chat.ID,
				Title:    cmu.Chat.Title,
				Type:     cmu.Chat.Type,
				Username: cmu.Chat.Username,
			},
			NewChatMembers: []User{tgUser},
		}
		h.handleJoinLeaveUpdate(ctx, bot, fakeMsg)
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
	} else if strings.HasPrefix(pay.InvoicePayload, "sub_stars_") {
		parts := strings.Split(strings.TrimPrefix(pay.InvoicePayload, "sub_stars_"), "_")
		if len(parts) >= 2 {
			groupIDStr := parts[0]
			packageID := parts[1]
			discountPercent := 0
			if len(parts) >= 3 {
				discountPercent, _ = strconv.Atoi(parts[2])
			}
			groupID, err := uuid.Parse(groupIDStr)
			if err == nil {
				botSvc := botmgmt.NewBotService(h.botRepo, repository.NewSettingsRepo(h.db, nil), repository.NewAuditRepo(h.db), repository.NewAnalyticsRepo(h.db), nil, nil)
				err = botSvc.ActivateSubscriptionFromStars(ctx, msg.From.ID, groupID, packageID, discountPercent)
				if err != nil {
					slog.Error("Failed to activate subscription from Stars webhook", "error", err, "payload", pay.InvoicePayload)
				} else {
					slog.Info("Successfully activated subscription via Stars Webhook", "group_id", groupIDStr, "package_id", packageID, "discount_percent", discountPercent)
				}
			}
		}
	} else if strings.HasPrefix(pay.InvoicePayload, "sub_chan_stars_") {
		parts := strings.Split(strings.TrimPrefix(pay.InvoicePayload, "sub_chan_stars_"), "_")
		if len(parts) >= 2 {
			channelIDStr := parts[0]
			packageID := parts[1]
			discountPercent := 0
			if len(parts) >= 3 {
				discountPercent, _ = strconv.Atoi(parts[2])
			}
			channelID, err := uuid.Parse(channelIDStr)
			if err == nil {
				botSvc := botmgmt.NewBotService(h.botRepo, repository.NewSettingsRepo(h.db, nil), repository.NewAuditRepo(h.db), repository.NewAnalyticsRepo(h.db), nil, nil)
				err = botSvc.ActivateChannelSubscriptionFromStars(ctx, msg.From.ID, channelID, packageID, discountPercent)
				if err != nil {
					slog.Error("Failed to activate channel subscription from Stars webhook", "error", err, "payload", pay.InvoicePayload)
				} else {
					slog.Info("Successfully activated channel subscription via Stars Webhook", "channel_id", channelIDStr, "package_id", packageID, "discount_percent", discountPercent)
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
				// 1. Begin atomic database transaction
				tx, err := h.db.Pool.Begin(ctx)
				if err != nil {
					slog.Error("CRITICAL: Failed to begin transaction for val_pro payment", "error", err, "user_id", userID, "payload", pay.InvoicePayload)
					h.pushPaymentDLQ(ctx, "begin_tx_failed", pay.InvoicePayload, err)
					notification.GetAdminNotifier().NotifyPayment(ctx, fmt.Sprintf("🚨 <b>Payment TX Error</b>\nFailed to begin TX for user %d (payload: %s): %v", userID, pay.InvoicePayload, err))
					return
				}
				defer tx.Rollback(ctx)

				// 2. If discount applied, deduct Airdrop Coins using FIFO inside transaction
				if discountPercent > 0 {
					_, requiredCoins := config.CalculateRequiredCoinsForDiscount(config.Economics.ProValuationStars, discountPercent)
					if err := h.db.DeductCreditsFIFO(ctx, tx, userID, requiredCoins); err != nil {
						slog.Error("CRITICAL: Failed to deduct credits for val_pro payment", "error", err, "user_id", userID, "required_coins", requiredCoins)
						_ = tx.Rollback(ctx)
						h.pushPaymentDLQ(ctx, "deduct_credits_failed", pay.InvoicePayload, err)
						notification.GetAdminNotifier().NotifyPayment(ctx, fmt.Sprintf("🚨 <b>Credit Deduction Failed</b>\nUser %d failed to deduct %.0f coins: %v", userID, requiredCoins, err))

						userLang, _ := h.db.GetUserLanguage(ctx, userID)
						lang := i18n.DetectLanguage(userLang)
						tg, _ := h.moderator.GetTelegramClient(ctx, bot)
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

				// 3. Mark order as paid AND grant Pro access atomically
				if err := h.db.CompleteStarsPremiumPaymentTx(ctx, tx, pay.InvoicePayload, pay.TelegramPaymentChargeID, userID, config.Economics.ProValuationDuration); err != nil {
					slog.Error("CRITICAL: Failed to complete Stars pro valuation payment atomically", "error", err, "user_id", userID, "payload", pay.InvoicePayload)
					_ = tx.Rollback(ctx)
					h.pushPaymentDLQ(ctx, "complete_order_failed", pay.InvoicePayload, err)
					notification.GetAdminNotifier().NotifyPayment(ctx, fmt.Sprintf("🚨 <b>Order Completion Failed</b>\nUser %d payload %s: %v", userID, pay.InvoicePayload, err))
					return
				}

				// 4. Commit transaction
				if err := tx.Commit(ctx); err != nil {
					slog.Error("CRITICAL: Failed to commit transaction for val_pro payment", "error", err, "user_id", userID)
					h.pushPaymentDLQ(ctx, "commit_tx_failed", pay.InvoicePayload, err)
					notification.GetAdminNotifier().NotifyPayment(ctx, fmt.Sprintf("🚨 <b>TX Commit Failed</b>\nUser %d payload %s: %v", userID, pay.InvoicePayload, err))
					return
				}

				slog.Info("Granted Pro Valuation access to User via Stars Webhook", "user_id", userID, "duration", config.Economics.ProValuationDuration)

				// 5. Update Redis read cache
				cache := h.moderator.GetCache()
				if cache != nil && cache.Client != nil {
					cache.Client.Set(ctx, fmt.Sprintf("user_val_pro:%d", userID), "true", config.Economics.ProValuationDuration)
				}

				// 6. Send Pro Welcome message (after successful commit)
				userLang, _ := h.db.GetUserLanguage(ctx, userID)
				lang := i18n.DetectLanguage(userLang)
				tg, _ := h.moderator.GetTelegramClient(ctx, bot)
				if tg != nil {
					welcomeMsg := i18n.T(lang, "notifications.pro_pass_activated", nil)
					if welcomeMsg == "" || welcomeMsg == "notifications.pro_pass_activated" {
						welcomeMsg = "👑 <b>iFragment Pro Pass Activated!</b>\n\nYou now have 30 days of:\n• 3 Deep Daily Valuations\n• 70%+ Fragment Arbitrage Alerts\n• Official Digital Valuation Certificate\n\nEnjoy trading on Fragment!"
					}
					_ = tg.SendMessage(ctx, userID, welcomeMsg, nil, nil)
				}

				// 7. Audit log
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

	} else {
		// Non-premium payments: update order status normally
		err := h.db.UpdateOrderStatus(ctx, pay.InvoicePayload, "paid", pay.TelegramPaymentChargeID)
		if err == nil {
			if strings.HasPrefix(pay.InvoicePayload, "report_pay:") {
				parts := strings.Split(pay.InvoicePayload, ":")
				if len(parts) >= 3 {
					userID, parseErr := strconv.ParseInt(parts[1], 10, 64)
					username := parts[2]
					if parseErr == nil && username != "" {
						auditRepo := repository.NewAuditRepo(h.db)
						targetType := "username"
						_ = auditRepo.Log(ctx, &repository.AuditLog{
							ActorID:    userID,
							Action:     "report.payment.success",
							TargetType: &targetType,
							TargetID:   &username,
						})
						miniAppURL := os.Getenv("MINI_APP_URL")
						if miniAppURL == "" {
							miniAppURL = "https://t.me/iFragmentBot/iFragment"
						}
						reportURL := fmt.Sprintf("%s?startapp=username_%s", miniAppURL, username)
						tg, _ := h.moderator.GetTelegramClient(ctx, bot)
						_ = tg.SendMessage(ctx, userID, fmt.Sprintf("Payment received. Your @%s report is unlocked:\n%s", username, reportURL), nil, nil)
					}
				}
			} else if strings.HasPrefix(pay.InvoicePayload, "number_report:") {
				parts := strings.Split(pay.InvoicePayload, ":")
				if len(parts) >= 3 {
					userID, parseErr := strconv.ParseInt(parts[1], 10, 64)
					number := parts[2]
					if parseErr == nil && number != "" {
						auditRepo := repository.NewAuditRepo(h.db)
						targetType := "number"
						_ = auditRepo.Log(ctx, &repository.AuditLog{
							ActorID:    userID,
							Action:     "number_report.payment.success",
							TargetType: &targetType,
							TargetID:   &number,
						})
						miniAppURL := os.Getenv("MINI_APP_URL")
						if miniAppURL == "" {
							miniAppURL = "https://t.me/iFragmentBot/iFragment"
						}
						reportURL := fmt.Sprintf("%s?startapp=number_%s", miniAppURL, strings.TrimPrefix(number, "+"))
						tg, _ := h.moderator.GetTelegramClient(ctx, bot)
						_ = tg.SendMessage(ctx, userID, fmt.Sprintf("Payment received! Your %s valuation report is unlocked:\n%s", number, reportURL), nil, nil)
					}
				}
			} else if strings.HasPrefix(pay.InvoicePayload, "gift_report:") || strings.HasPrefix(pay.InvoicePayload, "val_gift:") {
				parts := strings.Split(pay.InvoicePayload, ":")
				if len(parts) >= 3 {
					userID, parseErr := strconv.ParseInt(parts[1], 10, 64)
					giftID := parts[2]
					if parseErr == nil && giftID != "" {
						auditRepo := repository.NewAuditRepo(h.db)
						targetType := "gift"
						_ = auditRepo.Log(ctx, &repository.AuditLog{
							ActorID:    userID,
							Action:     "gift_report.payment.success",
							TargetType: &targetType,
							TargetID:   &giftID,
						})
						miniAppURL := os.Getenv("MINI_APP_URL")
						if miniAppURL == "" {
							miniAppURL = "https://t.me/iFragmentBot/iFragment"
						}
						reportURL := fmt.Sprintf("%s?startapp=gift_%s", miniAppURL, giftID)
						tg, _ := h.moderator.GetTelegramClient(ctx, bot)
						if tg != nil {
							_ = tg.SendMessage(ctx, userID, fmt.Sprintf("🎁 <b>Payment Received!</b>\nYour %s Gift valuation report is unlocked:\n%s", giftID, reportURL), nil, nil)
						}
					}
				}
			} else if strings.HasPrefix(pay.InvoicePayload, "val_stars:") {
				parts := strings.Split(pay.InvoicePayload, ":")
				if len(parts) >= 3 {
					userID, parseErr := strconv.ParseInt(parts[1], 10, 64)
					username := parts[2]
					if parseErr == nil && username != "" {
						tg, _ := h.moderator.GetTelegramClient(ctx, bot)
						_ = tg.SendMessage(ctx, userID, fmt.Sprintf("Payment received! You now have 24-hour full access to @%s AI valuation.", username), nil, nil)
					}
				}
			} else if strings.HasPrefix(pay.InvoicePayload, "val_credits:") {
				// Valuation pack fulfillment: payload format val_credits:<amount>:<userID>:<timestamp>
				parts := strings.Split(pay.InvoicePayload, ":")
				if len(parts) >= 3 {
					credits, _ := strconv.Atoi(parts[1])
					userID, parseErr := strconv.ParseInt(parts[2], 10, 64)
					if parseErr == nil && userID > 0 && credits > 0 {
						creditRepo := repository.NewIntelCreditRepo(h.db)
						exp := time.Now().Add(time.Duration(config.Economics.CreditBatchExpiryDays) * 24 * time.Hour)
						granted, grantErr := creditRepo.GrantPackOnce(ctx, userID, credits, "stars_pack", pay.TelegramPaymentChargeID, &exp)
						if grantErr != nil {
							slog.Error("CRITICAL: Failed to grant Intel Credit pack from val_credits", "error", grantErr, "user_id", userID, "payload", pay.InvoicePayload)
							h.pushPaymentDLQ(ctx, "intel_credits_grant_failed", pay.InvoicePayload, grantErr)
						} else if granted {
							tg, _ := h.moderator.GetTelegramClient(ctx, bot)
							if tg != nil {
								_ = tg.SendMessage(ctx, userID, fmt.Sprintf("🔑 Payment received! %d Intel Credit(s) were added to your wallet.", credits), nil, nil)
							}
						}
					}
				}
			} else if strings.HasPrefix(pay.InvoicePayload, "intel_credits:") {
				// Credit pack fulfillment: payload format intel_credits:<packID>:<userID>
				parts := strings.Split(pay.InvoicePayload, ":")
				if len(parts) >= 3 {
					userID, parseErr := strconv.ParseInt(parts[2], 10, 64)
					packID := parts[1]
					if parseErr == nil && packID != "" {
						creditRepo := repository.NewIntelCreditRepo(h.db)
						exp := time.Now().Add(time.Duration(config.Economics.CreditBatchExpiryDays) * 24 * time.Hour)
						granted, grantErr := creditRepo.GrantPackOnce(ctx, userID, intelcredit.PackCredits(packID), "stars_pack", pay.TelegramPaymentChargeID, &exp)
						if grantErr != nil {
							slog.Error("CRITICAL: Failed to grant Intel Credit pack", "error", grantErr, "user_id", userID, "payload", pay.InvoicePayload)
							h.pushPaymentDLQ(ctx, "intel_credits_grant_failed", pay.InvoicePayload, grantErr)
						} else if granted {
							tg, _ := h.moderator.GetTelegramClient(ctx, bot)
							if tg != nil {
								_ = tg.SendMessage(ctx, userID, fmt.Sprintf("🔑 Payment received! %d Intel Credit(s) were added to your wallet.", intelcredit.PackCredits(packID)), nil, nil)
							}
						}
					}
				}
			} else {
				// Payment Notification
				ownerLang, _ := h.db.GetUserLanguage(ctx, msg.From.ID)
				lang := i18n.DetectLanguage(ownerLang)
				tg, _ := h.moderator.GetTelegramClient(ctx, bot)
				msgText := i18n.T(lang, "notifications.payment_success", map[string]interface{}{"date": time.Now().Add(30 * 24 * time.Hour).Format("2006-01-02")})
				_ = tg.SendMessage(ctx, msg.From.ID, msgText, nil, nil)
			}
		} else {
			slog.Error("Failed to update order status", "error", err)
		}
	}
}

func (h *WebhookHandler) handleJoinLeaveUpdate(ctx context.Context, bot *repository.ManagedBot, msg *Message) {
	group, err := h.botRepo.GetGroup(ctx, bot.ID, msg.Chat.ID)
	if err != nil {
		// Fallback: If group is not in DB, check if the bot itself was added in this update
		botWasAdded := false
		for _, user := range msg.NewChatMembers {
			if user.ID == bot.BotID {
				botWasAdded = true
				break
			}
		}
		if botWasAdded {
			slog.Info("Bot detected its own addition to group via new_chat_members", "chat_id", msg.Chat.ID, "chat_type", msg.Chat.Type)
			var inviterID int64
			var inviterLang string
			if msg.From != nil {
				inviterID = msg.From.ID
				inviterLang = msg.From.LanguageCode
			}
			isGroup := msg.Chat != nil && (msg.Chat.Type == "group" || msg.Chat.Type == "supergroup")
			if isGroup && h.tryLockOnboarding(ctx, bot.ID, msg.Chat.ID) {
				h.handleBotAddedToGroup(ctx, bot, msg.Chat, inviterID, false, inviterLang)
			}
			// Retrieve the group again after creation
			group, err = h.botRepo.GetGroup(ctx, bot.ID, msg.Chat.ID)
		}
	}

	if err == nil {
		settings, _ := h.moderator.GetSettings(ctx, group.ID)
		var content repository.SettingsContentRestrictions
		var general repository.SettingsGeneral
		if settings != nil {
			_ = json.Unmarshal(settings.ContentRestrictions, &content)
			_ = json.Unmarshal(settings.General, &general)
		}

		if len(msg.NewChatMembers) > 0 {
			nonBotCount := 0
			var verifiedUsers []User
			for _, user := range msg.NewChatMembers {
				if !h.shouldProcessJoin(ctx, msg.Chat.ID, user.ID) {
					continue
				}

				// Enforce Telegram Premium restriction for @FragmentInvestors
				if botmgmt.IsFragmentInvestorsGroup(msg.Chat.Title, msg.Chat.Username) {
					if !user.IsBot && !user.IsPremium {
						tgClient, tgErr := h.moderator.GetTelegramClient(ctx, bot)
						if tgErr == nil && h.premiumGroupSvc != nil {
							uComp := botmgmt.UserCompact{
								ID:        user.ID,
								IsBot:     user.IsBot,
								FirstName: user.FirstName,
								Username:  user.Username,
								IsPremium: user.IsPremium,
							}
							_ = h.premiumGroupSvc.ProcessMemberJoinRealtime(ctx, tgClient, msg.Chat.ID, uComp)
						}
						continue
					}
				}

				if user.IsBot && content.BlockBots.Enabled {
					tgClient, tgErr := h.moderator.GetTelegramClient(ctx, bot)
					if tgErr == nil {
						// Check permissions before banning
						if perms, err := h.getBotPermissionsCached(ctx, tgClient, msg.Chat.ID, bot.BotID); err == nil && perms.CanRestrictMembers {
							_ = tgClient.BanChatMember(ctx, msg.Chat.ID, user.ID, 0, false)
						} else {
							slog.Warn("Bot lacks can_restrict_members permission to ban a bot", "chat_id", msg.Chat.ID)
						}

						if content.RemoveBotInviters.Enabled && msg.From != nil {
							penalty := content.RemoveBotInviters.Penalty
							if penalty == "" || penalty == "default" {
								penalty = general.DefaultPenalty
							}
							violation := &botmgmt.Violation{
								Type:    "remove_bot_inviters",
								Message: "Adding bots is not allowed",
								Action:  h.moderator.ResolveAction(penalty),
							}
							h.executeViolationAction(ctx, bot, msg.Chat.ID, msg.From.ID, msg.MessageID, msg.MessageThreadID, violation)
						}
					}
					continue
				}

				h.moderator.LogMemberEvent(ctx, group.ID, "member_join", &user.ID)
				captchaTriggered := h.handleJoinCaptcha(ctx, bot, msg, &user)
				if !captchaTriggered {
					verifiedUsers = append(verifiedUsers, user)
				}

				if !user.IsBot && msg.From != nil && user.ID != msg.From.ID {
					nonBotCount++
				}
			}

			if nonBotCount > 0 && msg.From != nil && h.moderator.GetCache() != nil && h.moderator.GetCache().Client != nil {
				key := fmt.Sprintf("invites:%s:%d", group.ID, msg.From.ID)
				cacheClient := h.moderator.GetCache().Client
				total, _ := cacheClient.IncrBy(ctx, key, int64(nonBotCount)).Result()
				if total == int64(nonBotCount) {
					cacheClient.Expire(ctx, key, 30*24*time.Hour)
				}
			}

			if len(verifiedUsers) > 0 {
				h.handleWelcomeMessage(ctx, bot, msg.Chat, msg.MessageThreadID, verifiedUsers)
			}
		}
		if msg.LeftChatMember != nil {
			h.moderator.LogMemberEvent(ctx, group.ID, "member_leave", &msg.LeftChatMember.ID)
		}

		if settings != nil {
			if general.HideJoinLeave && msg.MessageID != 0 {
				h.deleteMessage(ctx, bot, msg.Chat.ID, msg.MessageID)
			}
		}
	}
}

func (h *WebhookHandler) handleRegularMessageUpdate(ctx context.Context, bot *repository.ManagedBot, msg *Message) {
	if msg.Chat == nil || msg.From == nil {
		return
	}

	// Handle group to supergroup migration (Telegram Bot API: migrate_to_chat_id)
	if msg.MigrateToChatID != nil && *msg.MigrateToChatID != 0 {
		oldChatID := msg.Chat.ID
		newChatID := *msg.MigrateToChatID
		slog.Info("Migrating group to supergroup", "old_chat_id", oldChatID, "new_chat_id", newChatID)

		// Update managed_groups
		_, _ = h.db.Pool.Exec(ctx, `UPDATE managed_groups SET chat_id = $1, chat_type = 'supergroup', updated_at = now() WHERE chat_id = $2`, newChatID, oldChatID)
		// Update managed_channels if any
		_, _ = h.db.Pool.Exec(ctx, `UPDATE managed_channels SET chat_id = $1, updated_at = now() WHERE chat_id = $2`, newChatID, oldChatID)
		// Invalidate caches
		cache := h.moderator.GetCache()
		if cache != nil && cache.Client != nil {
			cache.Client.Del(ctx, fmt.Sprintf("bot_enabled:%s:%d", bot.ID.String(), oldChatID))
			cache.Client.Del(ctx, fmt.Sprintf("bot_enabled:%s:%d", bot.ID.String(), newChatID))
			cache.Client.Del(ctx, fmt.Sprintf("bot_perms:%d:%d", oldChatID, bot.BotID))
			cache.Client.Del(ctx, fmt.Sprintf("bot_perms:%d:%d", newChatID, bot.BotID))
		}
		return
	}

	// Enforce Telegram Premium restriction for @FragmentInvestors ONLY (bypass regular group moderation)
	if botmgmt.IsFragmentInvestorsGroup(msg.Chat.Title, msg.Chat.Username) && msg.From != nil {
		if !msg.From.IsBot && !msg.From.IsPremium {
			tgClient, tgErr := h.moderator.GetTelegramClient(ctx, bot)
			if tgErr == nil && h.premiumGroupSvc != nil {
				uComp := botmgmt.UserCompact{
					ID:        msg.From.ID,
					IsBot:     msg.From.IsBot,
					FirstName: msg.From.FirstName,
					Username:  msg.From.Username,
					IsPremium: msg.From.IsPremium,
				}
				_ = h.premiumGroupSvc.ProcessMemberJoinRealtime(ctx, tgClient, msg.Chat.ID, uComp)
				h.deleteMessage(ctx, bot, msg.Chat.ID, msg.MessageID)
			}
		}
		// For @FragmentInvestors, only Telegram Premium enforcement applies; stop further moderation checks.
		return
	}

	// Intercept owner/admin private messages for Channel Funnel caption editing
	if msg.Chat.Type == "private" {
		handled, err := h.channelService.HandleFunnelTextReply(ctx, bot, msg.From.ID, msg.Chat.ID, msg.Text)
		if err == nil && handled {
			return
		}
	}

	cache := h.moderator.GetCache()

	// Intercept owner PV edit messages for approval workflow
	if msg.Chat.Type == "private" && msg.From.ID == bot.OwnerUserID && cache != nil && cache.Client != nil {
		stateKey := fmt.Sprintf("edit_state:%d", msg.From.ID)
		pendingIDStr, err := cache.Client.Get(ctx, stateKey).Result()
		if err == nil && pendingIDStr != "" {
			cache.Client.Del(ctx, stateKey)
			pendingKey := fmt.Sprintf("pending_post:%s", pendingIDStr)
			pendingVal, err := cache.Client.Get(ctx, pendingKey).Result()
			if err == nil && pendingVal != "" {
				var pending repository.PendingPost
				_ = json.Unmarshal([]byte(pendingVal), &pending)
				pending.Text = h.channelService.ApplyWatermarkAndSignature(ctx, msg.Text, pending.ChannelID)
				updatedJSON, _ := json.Marshal(pending)
				_ = cache.Client.Set(ctx, pendingKey, updatedJSON, 24*time.Hour).Err()

				lang := "en"
				if settings, err := h.channelService.GetChannelSettingsDirect(ctx, pending.ChannelID); err == nil && settings != nil {
					var general struct {
						Language string `json:"language"`
					}
					if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
						lang = general.Language
					}
				}

				token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
				tg := telegram.NewBotAPIClient(token)

				markup := map[string]interface{}{
					"inline_keyboard": [][]map[string]interface{}{
						{
							{
								"text":          i18n.T(lang, "channel.approve_btn"),
								"callback_data": fmt.Sprintf("approve:%s", pending.ID.String()),
							},
							{
								"text":          i18n.T(lang, "channel.reject_btn"),
								"callback_data": fmt.Sprintf("reject:%s", pending.ID.String()),
							},
						},
						{
							{
								"text":          i18n.T(lang, "channel.edit_text_btn"),
								"callback_data": fmt.Sprintf("edit_text:%s", pending.ID.String()),
							},
							{
								"text":          i18n.T(lang, "channel.edit_btn_btn"),
								"callback_data": fmt.Sprintf("edit_btn:%s", pending.ID.String()),
							},
						},
					},
				}

				previewText := i18n.T(lang, "channel.draft_status_edited_pending", map[string]interface{}{
					"text": pending.Text,
				})
				_, _ = tg.SendMessageWithMarkup(ctx, msg.Chat.ID, previewText, markup, nil)
			}
			return
		}

		btnStateKey := fmt.Sprintf("edit_btn_state:%d", msg.From.ID)
		pendingIDStr, err = cache.Client.Get(ctx, btnStateKey).Result()
		if err == nil && pendingIDStr != "" {
			cache.Client.Del(ctx, btnStateKey)
			pendingKey := fmt.Sprintf("pending_post:%s", pendingIDStr)
			pendingVal, err := cache.Client.Get(ctx, pendingKey).Result()
			if err == nil && pendingVal != "" {
				var pending repository.PendingPost
				_ = json.Unmarshal([]byte(pendingVal), &pending)

				lines := strings.Split(msg.Text, "\n")
				var newButtons []repository.ChannelInlineButton
				for _, line := range lines {
					parts := strings.Split(line, "-")
					if len(parts) >= 2 {
						title := strings.TrimSpace(parts[0])
						value := strings.TrimSpace(parts[1])
						if title != "" && value != "" {
							newButtons = append(newButtons, repository.ChannelInlineButton{
								ID:        uuid.New(),
								ChannelID: pending.ChannelID,
								Title:     title,
								Value:     value,
								Type:      "url",
								CreatedAt: time.Now(),
							})
						}
					}
				}

				pending.Buttons = newButtons
				updatedJSON, _ := json.Marshal(pending)
				_ = cache.Client.Set(ctx, pendingKey, updatedJSON, 24*time.Hour).Err()

				lang := "en"
				if settings, err := h.channelService.GetChannelSettingsDirect(ctx, pending.ChannelID); err == nil && settings != nil {
					var general struct {
						Language string `json:"language"`
					}
					if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
						lang = general.Language
					}
				}

				token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
				tg := telegram.NewBotAPIClient(token)

				markup := map[string]interface{}{
					"inline_keyboard": [][]map[string]interface{}{
						{
							{
								"text":          i18n.T(lang, "channel.approve_btn"),
								"callback_data": fmt.Sprintf("approve:%s", pending.ID.String()),
							},
							{
								"text":          i18n.T(lang, "channel.reject_btn"),
								"callback_data": fmt.Sprintf("reject:%s", pending.ID.String()),
							},
						},
						{
							{
								"text":          i18n.T(lang, "channel.edit_text_btn"),
								"callback_data": fmt.Sprintf("edit_text:%s", pending.ID.String()),
							},
							{
								"text":          i18n.T(lang, "channel.edit_btn_btn"),
								"callback_data": fmt.Sprintf("edit_btn:%s", pending.ID.String()),
							},
						},
					},
				}

				previewText := i18n.T(lang, "channel.draft_status_edited_btn_pending", map[string]interface{}{
					"text": pending.Text,
				})
				_, _ = tg.SendMessageWithMarkup(ctx, msg.Chat.ID, previewText, markup, nil)
			}
			return
		}
	}

	mc := h.mapToModeratorContext(msg)

	if mc.IsCommand {
		if msg.Chat.Type == "private" {
			h.handlePrivateCommand(ctx, bot, msg)
			return
		} else {
			handled := h.handleGroupAdminCommand(ctx, bot, msg)
			if handled {
				return
			}
		}
	}

	// Skip moderation for private chats
	if msg.Chat.Type == "private" {
		return
	}

	// Regular Moderation
	violation, err := h.moderator.ValidateMessage(ctx, bot, mc)
	if err != nil {
		slog.Warn("Moderation error", "error", err)
	} else if violation != nil {
		slog.Info("Violation detected", "type", violation.Type, "chat_id", msg.Chat.ID, "user_id", msg.From.ID)
		h.executeViolationAction(ctx, bot, msg.Chat.ID, msg.From.ID, msg.MessageID, msg.MessageThreadID, violation)

		// Spam Attack Detector (>10 violations in 1 minute)
		if cache != nil && cache.Client != nil {
			attackKey := fmt.Sprintf("attack:%d", msg.Chat.ID)
			count, _ := cache.Client.Incr(ctx, attackKey).Result()
			if count == 1 {
				cache.Client.Expire(ctx, attackKey, 1*time.Minute)
			}
			if count == 10 {
				tg, _ := h.moderator.GetTelegramClient(ctx, bot)
				group, _ := h.botRepo.GetGroup(ctx, bot.ID, msg.Chat.ID)

				targetUserID := bot.OwnerUserID
				if group != nil && group.ConnectedByUserID != nil {
					targetUserID = *group.ConnectedByUserID
				}

				ownerLang, _ := h.db.GetUserLanguage(ctx, targetUserID)
				lang := i18n.DetectLanguage(ownerLang)

				alert := i18n.T(lang, "notifications.mass_spam", map[string]interface{}{"group": group.ChatTitle})
				_ = tg.SendMessage(ctx, targetUserID, alert, nil, nil)
			}
		}
	}

	// Channel Auto Responder (for comments in linked discussion groups)
	if msg.Chat.Type == "supergroup" && msg.ReplyToMessage != nil && msg.ReplyToMessage.ForwardFromChat != nil && msg.ReplyToMessage.ForwardFromChat.Type == "channel" {
		channelChatID := msg.ReplyToMessage.ForwardFromChat.ID
		ch, err := h.channelService.GetChannelByChatID(ctx, channelChatID)
		if err == nil && ch != nil {
			tg, _ := h.moderator.GetTelegramClient(ctx, bot)
			handled, _ := h.channelService.ProcessAutoResponder(ctx, tg, ch.ID, msg.Chat.ID, msg.MessageID, msg.Text)
			if handled {
				return // Stop processing further if auto-response triggered
			}
		}
	}

	// Auto First Comment (When a channel post is forwarded to a discussion group)
	if msg.Chat.Type == "supergroup" && msg.IsAutomaticForward && msg.SenderChat != nil && msg.SenderChat.Type == "channel" {
		channelChatID := msg.SenderChat.ID
		ch, err := h.channelService.GetChannelByChatID(ctx, channelChatID)
		if err == nil && ch != nil {
			tg, _ := h.moderator.GetTelegramClient(ctx, bot)
			postText := msg.Text
			if postText == "" {
				postText = msg.Caption
			}
			_, _ = h.channelService.ProcessAutoFirstComment(ctx, tg, ch.ID, msg.Chat.ID, msg.MessageID, postText)
		}
	}

	// Milestones
	if cache != nil && cache.Client != nil {
		totalKey := fmt.Sprintf("total_msgs:%d", msg.Chat.ID)
		total, _ := cache.Client.Incr(ctx, totalKey).Result()
		if total == 1 {
			cache.Client.Expire(ctx, totalKey, 90*24*time.Hour)
		}
		if total == 1000 || total == 10000 || total == 100000 {
			group, _ := h.botRepo.GetGroup(ctx, bot.ID, msg.Chat.ID)
			if group != nil && h.moderator.IsSubscriptionValid(group) {
				botToken, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
				tg := telegram.NewBotAPIClient(botToken)

				targetUserID := bot.OwnerUserID
				if group.ConnectedByUserID != nil {
					targetUserID = *group.ConnectedByUserID
				}
				ownerLang, _ := h.db.GetUserLanguage(ctx, targetUserID)
				lang := i18n.DetectLanguage(ownerLang)

				milestoneMsg := i18n.T(lang, "notifications.milestone", map[string]interface{}{"n": total})
				_ = tg.SendMessage(ctx, msg.Chat.ID, milestoneMsg, nil, nil)
			}
		}
	}
}

func (h *WebhookHandler) mapToModeratorContext(m *Message) *botmgmt.MessageContext {
	isCommand := false
	for _, ent := range m.Entities {
		if ent.Type == "bot_command" {
			isCommand = true
			break
		}
	}
	for _, ent := range m.CaptionEntities {
		if ent.Type == "bot_command" {
			isCommand = true
			break
		}
	}

	var replyToUserID int64
	if m.ReplyToMessage != nil && m.ReplyToMessage.From != nil {
		replyToUserID = m.ReplyToMessage.From.ID
	}

	hasRawField := func(raw json.RawMessage) bool {
		return len(raw) > 0 && string(raw) != "null"
	}

	hasTextLinks := false
	var textLinks []string

	// Helper function to process entities from either text or caption
	processEntities := func(entities []MessageEntity, sourceText string) {
		for _, ent := range entities {
			if ent.Type == "text_link" && ent.URL != "" {
				hasTextLinks = true
				textLinks = append(textLinks, ent.URL)
			} else if ent.Type == "url" {
				// Telegram gives offset/length based on UTF-16 code units, but in Go strings are UTF-8.
				// For a reliable extraction we can just let regex catch plain URLs or extract via runes safely if ASCII.
				// However, since we already run Regex on the entire text in `checkAllContent`,
				// any plain URL in text is already caught by regex.
				// Let's still extract it based on UTF-16 if we want to be exact, but it's simpler to append it.
				// Actually, Telegram's offset/length are in UTF-16 code units. It's safer to just rely on regex for plain URLs
				// and `text_link` for hidden URLs, or decode it properly.

				// Let's decode UTF-16 offset/length
				// Actually, doing this correctly:
				utf16text := utf16.Encode([]rune(sourceText))
				if ent.Offset+ent.Length <= len(utf16text) {
					extracted := string(utf16.Decode(utf16text[ent.Offset : ent.Offset+ent.Length]))
					hasTextLinks = true
					textLinks = append(textLinks, extracted)
				}
			}
		}
	}

	processEntities(m.Entities, m.Text)
	processEntities(m.CaptionEntities, m.Caption)

	return &botmgmt.MessageContext{
		ChatID:             m.Chat.ID,
		UserID:             m.From.ID,
		MessageID:          m.MessageID,
		Date:               m.Date,
		Text:               m.Text,
		Caption:            m.Caption,
		IsBot:              m.From.IsBot,
		IsTopicMessage:     m.IsTopicMessage,
		HasPhoto:           len(m.Photo) > 0,
		HasSticker:         hasRawField(m.Sticker),
		HasLocation:        hasRawField(m.Location),
		HasAudio:           hasRawField(m.Audio),
		HasVoice:           hasRawField(m.Voice),
		HasDocument:        hasRawField(m.Document),
		HasAnimation:       hasRawField(m.Animation),
		HasVideo:           hasRawField(m.Video),
		HasPoll:            hasRawField(m.Poll),
		HasGame:            hasRawField(m.Game),
		IsForward:          m.ForwardFromChat != nil || m.ForwardFrom != nil,
		ForwardFromChannel: m.ForwardFromChat != nil && m.ForwardFromChat.Type == "channel",
		ForwardFromChatID:  h.getForwardID(m),
		HasInlineKeyboard:  hasRawField(m.ReplyMarkup),
		HasReply:           m.ReplyToMessage != nil,
		ReplyToUserID:      replyToUserID,
		IsReplyToCrossChat: m.ExternalReply != nil || (m.ReplyToMessage != nil && m.ReplyToMessage.Chat != nil && m.ReplyToMessage.Chat.ID != m.Chat.ID),
		HasViaBot:          m.ViaBot != nil,
		IsCommand:          isCommand,
		MessageThreadID:    m.MessageThreadID,
		Username:           m.From.Username,
		FirstName:          m.From.FirstName,
		HasTextLinks:       hasTextLinks,
		TextLinks:          textLinks,
		HasCaption:         m.Caption != "",
	}
}

func (h *WebhookHandler) formatWarningText(ctx context.Context, tgClient *telegram.BotAPIClient, group *repository.ManagedGroup, chatID int64, userID int64, reason string, violationType string, currentWarnings int, warningThreshold int, template string) string {
	userName := fmt.Sprintf("User %d", userID)
	userLink := fmt.Sprintf("<a href=\"tg://user?id=%d\">User %d</a>", userID, userID)
	userUsername := ""

	resp, errMember := tgClient.Request(ctx, "getChatMember", map[string]interface{}{
		"chat_id": chatID,
		"user_id": userID,
	})
	if errMember == nil {
		var chatMemberResp struct {
			Result struct {
				User struct {
					ID        int64  `json:"id"`
					FirstName string `json:"first_name"`
					LastName  string `json:"last_name"`
					Username  string `json:"username"`
				} `json:"user"`
			} `json:"result"`
		}
		if json.Unmarshal(resp, &chatMemberResp) == nil && chatMemberResp.Result.User.ID != 0 {
			u := chatMemberResp.Result.User
			name := u.FirstName
			if u.LastName != "" {
				name += " " + u.LastName
			}
			userName = name
			userLink = fmt.Sprintf("<a href=\"tg://user?id=%d\">%s</a>", userID, telegram.EscapeHTML(name))
			if u.Username != "" {
				userUsername = "@" + u.Username
			}
		}
	}

	ruleName := violationType
	switch violationType {
	case "username":
		ruleName = "Username Restriction"
	case "domain":
		ruleName = "Domain Restriction"
	case "links":
		ruleName = "Links Restriction"
	case "banned_keyword":
		ruleName = "Banned Keyword"
	case "duplicate":
		ruleName = "Anti-Flood / Duplicate"
	case "flood":
		ruleName = "Anti-Flood"
	case "min_length":
		ruleName = "Message Minimum Length"
	case "max_length":
		ruleName = "Message Maximum Length"
	case "quiet_hours":
		ruleName = "Quiet Hours / Lockdown"
	case "mandatory_membership":
		ruleName = "Mandatory Membership"
	case "forced_add":
		ruleName = "Forced Member Addition"
	case "admin_warn":
		ruleName = "Administrator Action"
	}

	groupTitle := ""
	if group != nil {
		groupTitle = group.ChatTitle
	}

	channelNames := ""
	addedCount := 0
	requiredCount := 0
	remainCount := 0

	if group != nil {
		settings, err := h.moderator.GetSettings(ctx, group.ID)
		if err == nil && settings != nil {
			var mm repository.SettingsMandatoryMembership
			if json.Unmarshal(settings.MandatoryMembership, &mm) == nil {
				requiredCount = mm.ForcedAddCount
				var channels []string
				for _, ch := range mm.RequiredChannels {
					if !strings.HasPrefix(ch, "@") && !strings.HasPrefix(ch, "-100") {
						channels = append(channels, "@"+ch)
					} else {
						channels = append(channels, ch)
					}
				}
				channelNames = strings.Join(channels, ", ")
			}
		}

		cache := h.moderator.GetCache()
		if cache != nil && cache.Client != nil {
			val, _ := cache.Client.Get(ctx, fmt.Sprintf("invites:%s:%d", group.ID, userID)).Int()
			addedCount = val
		}
		remainCount = requiredCount - addedCount
		if remainCount < 0 {
			remainCount = 0
		}
	}

	text := template
	text = strings.ReplaceAll(text, "{user}", userLink)
	text = strings.ReplaceAll(text, "{first_name}", telegram.EscapeHTML(userName))
	text = strings.ReplaceAll(text, "{username}", telegram.EscapeHTML(userUsername))
	text = strings.ReplaceAll(text, "{id}", fmt.Sprintf("%d", userID))
	text = strings.ReplaceAll(text, "{group}", telegram.EscapeHTML(groupTitle))
	text = strings.ReplaceAll(text, "{chat_title}", telegram.EscapeHTML(groupTitle))
	text = strings.ReplaceAll(text, "{channel_names}", telegram.EscapeHTML(channelNames))
	text = strings.ReplaceAll(text, "{added}", fmt.Sprintf("%d", addedCount))
	text = strings.ReplaceAll(text, "{number}", fmt.Sprintf("%d", requiredCount))
	text = strings.ReplaceAll(text, "{remainadd}", fmt.Sprintf("%d", remainCount))
	text = strings.ReplaceAll(text, "{reason}", telegram.EscapeHTML(reason))
	text = strings.ReplaceAll(text, "{rule}", telegram.EscapeHTML(ruleName))
	text = strings.ReplaceAll(text, "{count}", fmt.Sprintf("%d", currentWarnings))
	text = strings.ReplaceAll(text, "{threshold}", fmt.Sprintf("%d", warningThreshold))
	text = strings.ReplaceAll(text, "{time}", time.Now().Format("2006-01-02 15:04:05 MST"))

	return text
}

func (h *WebhookHandler) executeViolationAction(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, messageID int, threadID *int, violation *botmgmt.Violation) {
	tgClient, err := h.moderator.GetTelegramClient(ctx, bot)
	if err != nil {
		return
	}

	botPerms, err := h.getBotPermissionsCached(ctx, tgClient, chatID, bot.BotID)
	if err != nil {
		slog.Warn("Could not check bot permissions before executing violation action", "error", err)
	}

	group, _ := h.botRepo.GetGroup(ctx, bot.ID, chatID)

	// 1. Delete message & Rescue to PV
	if botPerms == nil || botPerms.CanDeleteMessages {
		_ = tgClient.DeleteMessage(ctx, chatID, messageID)
		if violation.OriginalText != "" && userID > 0 {
			// Message 1: Raw original user text (no parse_mode to avoid breaking on malformed HTML)
			_, err1 := tgClient.Request(ctx, "sendMessage", map[string]interface{}{
				"chat_id": userID,
				"text":    violation.OriginalText,
			})
			// Message 2: Explanation notice & editing guide
			if err1 == nil {
				userLangFromDB, _ := h.db.GetUserLanguage(ctx, userID)
				userLang := i18n.DetectLanguage(userLangFromDB)
				groupTitle := ""
				if group != nil {
					groupTitle = group.ChatTitle
				}
				notice := i18n.T(userLang, "moderation.deleted_notice", map[string]interface{}{
					"group":  telegram.EscapeHTML(groupTitle),
					"reason": telegram.EscapeHTML(violation.Message),
				})
				_ = tgClient.SendMessage(ctx, userID, notice, nil, nil)
			}
		}
	} else {
		slog.Warn("Skipped deleting message: bot lacks can_delete_messages", "chat_id", chatID)
	}

	// 2. Parse Duration (BUG #5)
	var until int64
	durationText := "permanently"
	if strings.HasPrefix(violation.Action, "mute_") {
		durStr := strings.TrimPrefix(violation.Action, "mute_")
		switch durStr {
		case "1h":
			until = time.Now().Add(time.Hour).Unix()
			durationText = "1 hour"
		case "24h":
			until = time.Now().Add(24 * time.Hour).Unix()
			durationText = "24 hours"
		default:
			until = time.Now().Add(24 * time.Hour).Unix()
			durationText = "24 hours"
		}
	} else if violation.Action == "mute" {
		until = time.Now().Add(24 * time.Hour).Unix()
		durationText = "24 hours"
	}

	// 3. Execute Penalty
	lang := "en"
	var general repository.SettingsGeneral
	var ct repository.SettingsCustomTexts
	if group != nil {
		settings, _ := h.moderator.GetSettings(ctx, group.ID)
		if settings != nil {
			if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
				lang = general.Language
			}
			_ = json.Unmarshal(settings.CustomTexts, &ct)
		}
	}

	var penaltyMsg string
	if violation.Action == "warn" || violation.Action == "delete" {
		template := ct.WarningText
		if template == "" || repository.IsLegacyText(template) {
			if lang == "fa" {
				template = "⚠️ {user}\n▫️ اخطار {count}/{threshold} — {reason}"
			} else {
				template = "⚠️ {user} | Warning {count}/{threshold} ▫️ {reason}"
			}
		}

		switch violation.Type {
		case "mandatory_membership":
			template = ct.ForceJoinText
			if template == "" || repository.IsLegacyText(template) {
				if lang == "fa" {
					template = "📢 {user}، برای گفتگو ابتدا در کانال‌های زیر عضو شو:\n{channel_names}"
				} else {
					template = "📢 {user}, join required channels to chat:\n{channel_names}"
				}
			}
		case "forced_add":
			template = ct.ForceAddText
			if template == "" || repository.IsLegacyText(template) {
				if lang == "fa" {
					template = "👥 {user}، برای فعال شدن چت، {remainadd} نفر دعوت کن ({added}/{number})"
				} else {
					template = "👥 {user}, invite {remainadd} member(s) to chat ({added}/{number})"
				}
			}
		case "quiet_hours":
			template = ct.SilenceStartText
			if template == "" || repository.IsLegacyText(template) {
				if lang == "fa" {
					template = "🌙 ساعات سکوت گروه آغاز شد."
				} else {
					template = "🔒 Quiet mode activated"
				}
			}
		}

		penaltyMsg = h.formatWarningText(ctx, tgClient, group, chatID, userID, violation.Message, violation.Type, violation.CurrentWarnings, violation.WarningThreshold, template)
	} else {
		reasonStr := violation.Message
		if violation.CurrentWarnings > 0 {
			penaltyMsg = i18n.T(lang, "notice.warning", reasonStr, violation.CurrentWarnings, violation.WarningThreshold)
		} else {
			penaltyMsg = reasonStr
		}
	}

	sendMsg := func(text string) {
		var markup map[string]interface{}
		if len(ct.InlineButtons) > 0 {
			markup = buildCustomInlineMarkup(ct.InlineButtons, nil)
		}
		if general.EphemeralWarnings || general.EphemeralAll {
			h.sendEphemeralBotMessage(ctx, tgClient, chatID, userID, text, markup, threadID, general)
		} else {
			h.sendBotMessage(ctx, tgClient, chatID, text, markup, threadID, general)
		}
	}

	switch {
	case strings.HasPrefix(violation.Action, "mute"):
		if botPerms == nil || botPerms.CanRestrictMembers {
			_ = tgClient.RestrictChatMember(ctx, chatID, userID, until)
			msg := i18n.T(lang, "penalty.mute", map[string]interface{}{"duration": durationText, "reason": penaltyMsg})
			if msg == "" || msg == "penalty.mute" {
				msg = fmt.Sprintf("🔇 User restricted for %s due to: %s", durationText, penaltyMsg)
			}
			sendMsg(msg)
		} else {
			slog.Warn("Skipped mute: bot lacks can_restrict_members", "chat_id", chatID)
		}
	case violation.Action == "kick":
		if botPerms == nil || botPerms.CanRestrictMembers {
			_ = tgClient.BanChatMember(ctx, chatID, userID, time.Now().Add(30*time.Second).Unix(), false)
			_ = tgClient.UnbanChatMember(ctx, chatID, userID, true)
			msg := i18n.T(lang, "penalty.kick", map[string]interface{}{"reason": penaltyMsg})
			if msg == "" || msg == "penalty.kick" {
				msg = fmt.Sprintf("👢 User kicked due to: %s", penaltyMsg)
			}
			sendMsg(msg)
		} else {
			slog.Warn("Skipped kick: bot lacks can_restrict_members", "chat_id", chatID)
		}
	case violation.Action == "ban":
		if botPerms == nil || botPerms.CanRestrictMembers {
			_ = tgClient.BanChatMember(ctx, chatID, userID, 0, false)
			msg := i18n.T(lang, "penalty.ban", map[string]interface{}{"reason": penaltyMsg})
			if msg == "" || msg == "penalty.ban" {
				msg = fmt.Sprintf("🚫 User banned due to: %s", penaltyMsg)
			}
			sendMsg(msg)
		} else {
			slog.Warn("Skipped ban: bot lacks can_restrict_members", "chat_id", chatID)
		}
	case violation.Action == "delete" || violation.Action == "warn":
		slog.Info("Violation action matched delete/warn", "action", violation.Action, "warningMessageEnabled", general.WarningMessage, "currentWarnings", violation.CurrentWarnings, "type", violation.Type)
		if (violation.Action == "warn" || violation.Action == "delete" || violation.CurrentWarnings > 0) && general.WarningMessage {
			sendMsg(penaltyMsg)
		} else if violation.Type == "mandatory_membership" || violation.Type == "forced_add" || violation.Type == "quiet_hours" {
			sendMsg(penaltyMsg)
		}
	}
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
	if cache := h.moderator.GetCache(); cache != nil && cache.Client != nil {
		errStr := ""
		if err != nil {
			errStr = err.Error()
		}
		_, errX := cache.Client.XAdd(ctx, &redis.XAddArgs{
			Stream: "payment:dlq",
			MaxLen: 10000,
			Values: map[string]interface{}{
				"reason":    reason,
				"payload":   payload,
				"error":     errStr,
				"timestamp": time.Now().Format(time.RFC3339),
			},
		}).Result()
		if errX != nil {
			slog.Error("Failed to write to payment DLQ", "error", errX)
		}
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

		// Extract deep linking parameter
		var startParam string
		parts := strings.Split(cmdText, " ")
		if len(parts) > 1 {
			startParam = parts[1]
		}

		// Sanitize startParam: allow only alphanumeric, underscore, hyphen (Telegram spec)
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
			// Pre-register user to count referral immediately on /start
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

		var welcome string
		isHostedPublic := false
		if m.From.ID == bot.OwnerUserID {
			welcome = i18n.T(lang, "onboarding.welcome_owner", userName)
		} else {
			if strings.EqualFold(bot.BotUsername, "iFragmentBot") || bot.OwnerUserID == 0 {
				welcome = i18n.T(lang, "onboarding.welcome_public", userName)
			} else {
				welcome = i18n.T(lang, "onboarding.welcome_hosted_public", userName)
				isHostedPublic = true
			}
		}

		token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		tg := telegram.NewBotAPIClient(token)

		// Inline keyboard with Telegram Web App overlay trigger
		btnText := i18n.T(lang, "onboarding.open_app")
		keyboardRows := [][]map[string]interface{}{
			{
				{
					"text": btnText,
					"url":  targetURL,
				},
			},
		}

		if isHostedPublic {
			createBotBtnText := i18n.T(lang, "onboarding.create_bot")
			if createBotBtnText == "" || createBotBtnText == "onboarding.create_bot" {
				createBotBtnText = "🤖 ساخت ربات اختصاصی من"
			}
			keyboardRows = append(keyboardRows, []map[string]interface{}{
				{
					"text": createBotBtnText,
					"url":  "https://t.me/iFragmentBot",
				},
			})
		}

		markup := map[string]interface{}{
			"inline_keyboard": keyboardRows,
		}

		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, welcome, markup, m.MessageThreadID)
	} else if strings.HasPrefix(cmdText, "/language") {
		token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		tg := telegram.NewBotAPIClient(token)

		msgText := "Please select your preferred language:\nلطفا زبان مورد نظر خود را انتخاب کنید:\nПожалуйста, выберите предпочитаемый язык:"
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
	} else if strings.HasPrefix(m.Text, "/settings") || strings.HasPrefix(m.Text, "/config") {
		token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		tg := telegram.NewBotAPIClient(token)

		miniAppURL := os.Getenv("MINI_APP_URL")
		if miniAppURL == "" {
			miniAppURL = "https://t.me/iFragmentBot/iFragment"
		}

		userLangFromDB, _ := h.db.GetUserLanguage(ctx, m.From.ID)
		langCode := m.From.LanguageCode
		if userLangFromDB != "" {
			langCode = userLangFromDB
		}
		lang := i18n.DetectLanguage(langCode)

		var msgText string
		if lang == "fa" {
			msgText = "⚙️ <b>تنظیمات ربات و مینی‌اپ:</b>\n\nبرای پیکربندی محافظت گروه‌ها، ربات را به عنوان ادمین به گروه خود اضافه کرده و دستور <code>/settings</code> را در گروه ارسال کنید؛ یا از طریق وب‌اپلیکیشن مینی‌اپ به صورت کامل آن را مدیریت فرمایید:"
		} else {
			msgText = "⚙️ <b>Bot & Mini App Settings:</b>\n\nTo configure group protection, add the bot as an Administrator to your group and type <code>/settings</code> in the group, or launch the full Web App dashboard below:"
		}

		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{"text": "🌐 Web App Dashboard", "url": miniAppURL},
				},
			},
		}
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, msgText, markup, m.MessageThreadID)
	} else if strings.HasPrefix(m.Text, "/help") || strings.HasPrefix(m.Text, "/commands") {
		token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		tg := telegram.NewBotAPIClient(token)

		userLangFromDB, _ := h.db.GetUserLanguage(ctx, m.From.ID)
		langCode := m.From.LanguageCode
		if userLangFromDB != "" {
			langCode = userLangFromDB
		}
		lang := i18n.DetectLanguage(langCode)

		helpText := i18n.T(lang, "help.admin_help")
		_ = tg.SendMessage(ctx, m.Chat.ID, helpText, &m.MessageID, m.MessageThreadID)
	} else if strings.HasPrefix(m.Text, "/ping") {
		token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		tg := telegram.NewBotAPIClient(token)

		msgTime := time.Unix(int64(m.Date), 0)
		latency := time.Since(msgTime).Milliseconds()
		if latency < 0 {
			latency = 0
		}
		text := fmt.Sprintf("🏓 <b>Pong!</b>\n⚡ Latency: <code>%dms</code>\n🛡️ Engine: <b>iFragment v2.0 (Active)</b>", latency)
		_ = tg.SendMessage(ctx, m.Chat.ID, text, &m.MessageID, m.MessageThreadID)
	}
}

func (h *WebhookHandler) handleGroupSettingsCommand(ctx context.Context, bot *repository.ManagedBot, m *Message) {
	group, err := h.botRepo.GetGroup(ctx, bot.ID, m.Chat.ID)
	if err != nil {
		return
	}

	bot, _ = h.botRepo.GetBotByID(ctx, group.BotID)
	tg, _ := h.moderator.GetTelegramClient(ctx, bot)
	if tg == nil {
		token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		if token != "" {
			tg = telegram.NewBotAPIClient(token)
		}
	}
	if tg == nil {
		return
	}

	isAuthorized := false
	if m.From.ID == bot.OwnerUserID || (group.ConnectedByUserID != nil && m.From.ID == *group.ConnectedByUserID) {
		isAuthorized = true
	} else {
		status, _ := h.moderator.GetChatMemberCached(ctx, tg, m.Chat.ID, m.From.ID)
		if status == "administrator" || status == "creator" || status == "owner" {
			isAuthorized = true
		}
	}

	if !isAuthorized {
		return
	}

	userLangFromDB, _ := h.db.GetUserLanguage(ctx, m.From.ID)
	langCode := m.From.LanguageCode
	if userLangFromDB != "" {
		langCode = userLangFromDB
	}
	lang := i18n.DetectLanguage(langCode)

	settings, _ := h.moderator.GetSettings(ctx, group.ID)
	text, markup := h.renderMainSettingsMenu(ctx, group, settings, lang)
	_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, text, markup, m.MessageThreadID, "HTML")
}

func (h *WebhookHandler) renderMainSettingsMenu(_ context.Context, group *repository.ManagedGroup, settings *repository.GroupSettings, lang string) (string, map[string]interface{}) {
	var gen repository.SettingsGeneral
	var cont repository.SettingsContentRestrictions
	var quiet repository.SettingsQuietHours
	var mand repository.SettingsMandatoryMembership

	if settings != nil {
		_ = json.Unmarshal(settings.General, &gen)
		_ = json.Unmarshal(settings.ContentRestrictions, &cont)
		_ = json.Unmarshal(settings.QuietHours, &quiet)
		_ = json.Unmarshal(settings.MandatoryMembership, &mand)
	}

	isFa := (lang == "fa")

	linkStatus := "❌"
	if cont.RemoveLinks.Enabled {
		linkStatus = "✅"
	}
	casStatus := "❌"
	if gen.CasEnabled {
		casStatus = "✅"
	}

	var quietStatus string
	if quiet.EmergencyLock {
		if isFa {
			quietStatus = "🔒 قفل اضطراری"
		} else {
			quietStatus = "🔒 Locked"
		}
	} else if len(quiet.Periods) > 0 {
		if isFa {
			quietStatus = "✅ فعال"
		} else {
			quietStatus = "✅ Active"
		}
	} else {
		if isFa {
			quietStatus = "❌ غیرفعال"
		} else {
			quietStatus = "❌ Off"
		}
	}

	var ephemeralStatus string
	if gen.EphemeralAll || gen.EphemeralAdminCmd || gen.EphemeralWarnings {
		delay := gen.AutoDeleteDelay
		if delay <= 0 {
			delay = 15
		}
		if isFa {
			ephemeralStatus = fmt.Sprintf("✅ (%d ثانیه)", delay)
		} else {
			ephemeralStatus = fmt.Sprintf("✅ (%ds)", delay)
		}
	} else {
		if isFa {
			ephemeralStatus = "❌ خاموش"
		} else {
			ephemeralStatus = "❌ Off"
		}
	}

	var forceJoinStatus string
	if mand.ForceJoinEnabled {
		if isFa {
			forceJoinStatus = fmt.Sprintf("✅ (%d کانال)", len(mand.RequiredChannels))
		} else {
			forceJoinStatus = fmt.Sprintf("✅ (%d channels)", len(mand.RequiredChannels))
		}
	} else {
		if isFa {
			forceJoinStatus = "❌ غیرفعال"
		} else {
			forceJoinStatus = "❌ Off"
		}
	}

	var text string
	if isFa {
		text = fmt.Sprintf(`⚙️ <b>تنظیمات و امنیت گروه:</b> <b>%s</b>
──────────────────────
• 🛡 <b>فیلتر محتوا:</b> لینک %s | سیستم CAS %s
• 🌙 <b>ساعات سکوت / قفل:</b> %s
• 👻 <b>پیام‌های خودحذف‌شونده:</b> %s
• 📢 <b>عضویت اجباری:</b> %s
──────────────────────
✨ <b>ضمانت ۱۰۰٪ بدون تبلیغات (Zero-Ads)</b>
👇 <i>جهت مدیریت هر بخش، دکمه مورد نظر را لمس کنید:</i>`,
			telegram.EscapeHTML(group.ChatTitle), linkStatus, casStatus, quietStatus, ephemeralStatus, forceJoinStatus)
	} else {
		text = fmt.Sprintf(`⚙️ <b>Group Security & Settings:</b> <b>%s</b>
──────────────────────
• 🛡 <b>Content Filter:</b> Links %s | CAS %s
• 🌙 <b>Quiet / Lock:</b> %s
• 👻 <b>Ephemeral Messages:</b> %s
• 📢 <b>Force Join:</b> %s
──────────────────────
✨ <b>Zero-Ads Guarantee:</b> 100%% Ad-Free
👇 <i>Select a section below to configure:</i>`,
			telegram.EscapeHTML(group.ChatTitle), linkStatus, casStatus, quietStatus, ephemeralStatus, forceJoinStatus)
	}

	miniAppURL := os.Getenv("MINI_APP_URL")
	if miniAppURL == "" {
		miniAppURL = "https://t.me/iFragmentBot/iFragment"
	}
	dashboardURL := fmt.Sprintf("%s?startapp=group_%s", miniAppURL, group.ID)

	var keyboard [][]map[string]interface{}
	if isFa {
		keyboard = [][]map[string]interface{}{
			{
				{"text": "🛡 فیلتر محتوا", "callback_data": fmt.Sprintf("gset:cat:content:%s", group.ID)},
				{"text": "⚡ ضداسپم و فلود", "callback_data": fmt.Sprintf("gset:cat:limits:%s", group.ID)},
			},
			{
				{"text": "🌙 سکوت و قفل", "callback_data": fmt.Sprintf("gset:cat:quiet:%s", group.ID)},
				{"text": "👻 پیام موقت", "callback_data": fmt.Sprintf("gset:cat:ephemeral:%s", group.ID)},
			},
			{
				{"text": "📢 جوین اجباری", "callback_data": fmt.Sprintf("gset:cat:mandatory:%s", group.ID)},
				{"text": "🌐 تنظیمات عمومی", "callback_data": fmt.Sprintf("gset:cat:general:%s", group.ID)},
			},
			{
				{"text": "🚀 پنل مدیریت وب (Web App)", "url": dashboardURL},
			},
			{
				{"text": "❌ بستن منو", "callback_data": fmt.Sprintf("gset:close:%s", group.ID)},
			},
		}
	} else {
		keyboard = [][]map[string]interface{}{
			{
				{"text": "🛡 Content Filter", "callback_data": fmt.Sprintf("gset:cat:content:%s", group.ID)},
				{"text": "⚡ Flood & Limits", "callback_data": fmt.Sprintf("gset:cat:limits:%s", group.ID)},
			},
			{
				{"text": "🌙 Quiet & Lock", "callback_data": fmt.Sprintf("gset:cat:quiet:%s", group.ID)},
				{"text": "👻 Ephemeral Msg", "callback_data": fmt.Sprintf("gset:cat:ephemeral:%s", group.ID)},
			},
			{
				{"text": "📢 Force Join", "callback_data": fmt.Sprintf("gset:cat:mandatory:%s", group.ID)},
				{"text": "🌐 General Settings", "callback_data": fmt.Sprintf("gset:cat:general:%s", group.ID)},
			},
			{
				{"text": "🚀 Full Web Dashboard (WebApp)", "url": dashboardURL},
			},
			{
				{"text": "❌ Close Menu", "callback_data": fmt.Sprintf("gset:close:%s", group.ID)},
			},
		}
	}

	markup := map[string]interface{}{
		"inline_keyboard": keyboard,
	}

	return text, markup
}

func (h *WebhookHandler) renderCategorySettingsMenu(_ context.Context, group *repository.ManagedGroup, settings *repository.GroupSettings, category string, lang string) (string, map[string]interface{}) {
	var gen repository.SettingsGeneral
	var cont repository.SettingsContentRestrictions
	var limits repository.SettingsLimits
	var quiet repository.SettingsQuietHours
	var mand repository.SettingsMandatoryMembership

	if settings != nil {
		_ = json.Unmarshal(settings.General, &gen)
		_ = json.Unmarshal(settings.ContentRestrictions, &cont)
		_ = json.Unmarshal(settings.Limits, &limits)
		_ = json.Unmarshal(settings.QuietHours, &quiet)
		_ = json.Unmarshal(settings.MandatoryMembership, &mand)
	}

	isFa := (lang == "fa")
	var text string
	var rows [][]map[string]interface{}

	backBtnText := "🔙 Back to Main Settings"
	if isFa {
		backBtnText = "🔙 بازگشت به منوی اصلی"
	}

	onText := "✅ On"
	offText := "❌ Off"
	if isFa {
		onText = "✅ فعال"
		offText = "❌ غیرفعال"
	}

	switch category {
	case "content":
		if isFa {
			text = fmt.Sprintf("🛡 <b>فیلتر و محدودیت‌های محتوا</b> — <i>%s</i>\n\nجهت فعال یا غیرفعال‌سازی هر فیلتر، روی دکمه مربوطه کلیک کنید:", telegram.EscapeHTML(group.ChatTitle))
		} else {
			text = fmt.Sprintf("🛡 <b>Content Restrictions</b> — <i>%s</i>\n\nToggle spam & content filters in real-time:", telegram.EscapeHTML(group.ChatTitle))
		}

		linkIcon := offText
		if cont.RemoveLinks.Enabled {
			linkIcon = onText
		}
		phoneIcon := offText
		if cont.BlockPhoneNumbers.Enabled {
			phoneIcon = onText
		}
		forwardIcon := offText
		if cont.BlockForwards.Enabled {
			forwardIcon = onText
		}
		casIcon := offText
		if gen.CasEnabled {
			casIcon = onText
		}

		lblLink := "🔗 Block Links: "
		lblPhone := "📞 Block Phone Numbers: "
		lblForward := "↗️ Block Forwards: "
		lblCas := "🤖 Combot CAS Anti-Spam: "
		if isFa {
			lblLink = "🔗 حذف لینک‌ها: "
			lblPhone = "📞 حذف شماره تماس: "
			lblForward = "↗️ حذف فوروارد: "
			lblCas = "🤖 ضداسپم CAS: "
		}

		rows = [][]map[string]interface{}{
			{
				{"text": lblLink + linkIcon, "callback_data": fmt.Sprintf("gset:tog:content:link_filter:%s", group.ID)},
			},
			{
				{"text": lblPhone + phoneIcon, "callback_data": fmt.Sprintf("gset:tog:content:phone_filter:%s", group.ID)},
			},
			{
				{"text": lblForward + forwardIcon, "callback_data": fmt.Sprintf("gset:tog:content:forward_filter:%s", group.ID)},
			},
			{
				{"text": lblCas + casIcon, "callback_data": fmt.Sprintf("gset:tog:content:cas:%s", group.ID)},
			},
			{
				{"text": backBtnText, "callback_data": fmt.Sprintf("gset:menu:%s", group.ID)},
			},
		}

	case "limits":
		if isFa {
			text = fmt.Sprintf("⚡ <b>محدودیت‌ها و کنترل فلود (Flood)</b> — <i>%s</i>\n\nتنظیم نرخ مجاز ارسال پیام و جلوگیری از رگبار پیام:", telegram.EscapeHTML(group.ChatTitle))
		} else {
			text = fmt.Sprintf("⚡ <b>Limits & Flood Control</b> — <i>%s</i>\n\nConfigure message rate limits & spam prevention:", telegram.EscapeHTML(group.ChatTitle))
		}

		var floodVal string
		if limits.FloodMsgs == 0 {
			floodVal = offText
		} else {
			if isFa {
				floodVal = fmt.Sprintf("✅ (%d پیام در %d ثانیه)", limits.FloodMsgs, limits.FloodWin)
			} else {
				floodVal = fmt.Sprintf("✅ (%d msgs / %ds)", limits.FloodMsgs, limits.FloodWin)
			}
		}

		lblFlood := "🌊 Flood Rate Limit: "
		if isFa {
			lblFlood = "🌊 محدودیت ارسال (Flood): "
		}

		rows = [][]map[string]interface{}{
			{
				{"text": lblFlood + floodVal, "callback_data": fmt.Sprintf("gset:cycle:limits:flood:%s", group.ID)},
			},
			{
				{"text": backBtnText, "callback_data": fmt.Sprintf("gset:menu:%s", group.ID)},
			},
		}

	case "quiet":
		if isFa {
			text = fmt.Sprintf("🌙 <b>ساعات سکوت و قفل گروه</b> — <i>%s</i>\n\nبی‌صدا کردن خودکار چت یا اعمال قفل اضطراری سریع:", telegram.EscapeHTML(group.ChatTitle))
		} else {
			text = fmt.Sprintf("🌙 <b>Quiet Hours & Group Lockdown</b> — <i>%s</i>\n\nMute the chat automatically or execute emergency lock:", telegram.EscapeHTML(group.ChatTitle))
		}

		lockIcon := "🔓 Group Open"
		if isFa {
			lockIcon = "🔓 گروه باز است"
		}
		if quiet.EmergencyLock {
			if isFa {
				lockIcon = "🔒 گروه قفل است"
			} else {
				lockIcon = "🔒 Group Locked"
			}
		}

		adminOverrideIcon := offText
		if quiet.AdminOverride {
			adminOverrideIcon = onText
		}

		lblLock := "🚨 Emergency Lock: "
		lblAdmin := "👑 Admins Can Chat: "
		if isFa {
			lblLock = "🚨 قفل اضطراری: "
			lblAdmin = "👑 گفتگوی آزاد ادمین‌ها: "
		}

		rows = [][]map[string]interface{}{
			{
				{"text": lblLock + lockIcon, "callback_data": fmt.Sprintf("gset:tog:quiet:emergencyLock:%s", group.ID)},
			},
			{
				{"text": lblAdmin + adminOverrideIcon, "callback_data": fmt.Sprintf("gset:tog:quiet:adminOverride:%s", group.ID)},
			},
			{
				{"text": backBtnText, "callback_data": fmt.Sprintf("gset:menu:%s", group.ID)},
			},
		}

	case "ephemeral":
		if isFa {
			text = fmt.Sprintf("👻 <b>پیام‌های موقت (خودحذف‌شونده)</b> — <i>%s</i>\n\nپاکسازی خودکار پیام‌های بات و دستورات جهت تمیز ماندن گروه:", telegram.EscapeHTML(group.ChatTitle))
		} else {
			text = fmt.Sprintf("👻 <b>Ephemeral Messages (Auto-Delete)</b> — <i>%s</i>\n\nKeep your group clean by auto-deleting bot messages:", telegram.EscapeHTML(group.ChatTitle))
		}

		allIcon := offText
		if gen.EphemeralAll {
			allIcon = onText
		}
		cmdIcon := offText
		if gen.EphemeralAdminCmd {
			cmdIcon = onText
		}
		warnIcon := offText
		if gen.EphemeralWarnings {
			warnIcon = onText
		}

		delayVal := fmt.Sprintf("%ds", gen.AutoDeleteDelay)
		if gen.AutoDeleteDelay <= 0 {
			delayVal = "15s"
		}
		if isFa {
			delayVal = fmt.Sprintf("%d ثانیه", gen.AutoDeleteDelay)
			if gen.AutoDeleteDelay <= 0 {
				delayVal = "۱۵ ثانیه"
			}
		}

		lblAll := "👻 Ephemeral All Bot Msgs: "
		lblCmd := "⚡ Delete Admin Commands: "
		lblWarn := "⚠️ Delete Warning Alerts: "
		lblDelay := "⏱ Auto-Delete Delay: "
		if isFa {
			lblAll = "👻 حذف همه پیام‌های ربات: "
			lblCmd = "⚡ حذف دستورات ادمین: "
			lblWarn = "⚠️ حذف اخطارهای ربات: "
			lblDelay = "⏱ زمان حذف خودکار: "
		}

		rows = [][]map[string]interface{}{
			{
				{"text": lblAll + allIcon, "callback_data": fmt.Sprintf("gset:tog:ephemeral:ephemeralAll:%s", group.ID)},
			},
			{
				{"text": lblCmd + cmdIcon, "callback_data": fmt.Sprintf("gset:tog:ephemeral:ephemeralAdminCmd:%s", group.ID)},
			},
			{
				{"text": lblWarn + warnIcon, "callback_data": fmt.Sprintf("gset:tog:ephemeral:ephemeralWarnings:%s", group.ID)},
			},
			{
				{"text": lblDelay + delayVal, "callback_data": fmt.Sprintf("gset:cycle:ephemeral:delay:%s", group.ID)},
			},
			{
				{"text": backBtnText, "callback_data": fmt.Sprintf("gset:menu:%s", group.ID)},
			},
		}

	case "mandatory":
		if isFa {
			text = fmt.Sprintf("📢 <b>عضویت اجباری (جوین و اد اجباری)</b> — <i>%s</i>\n\nالزام کاربران به عضویت در کانال‌ها یا اد اعضا پیش از چت:", telegram.EscapeHTML(group.ChatTitle))
		} else {
			text = fmt.Sprintf("📢 <b>Mandatory Channels (Force Join)</b> — <i>%s</i>\n\nRequire users to join channels before speaking:", telegram.EscapeHTML(group.ChatTitle))
		}

		fjIcon := offText
		if mand.ForceJoinEnabled {
			fjIcon = onText
		}
		faIcon := offText
		if mand.ForcedAddEnabled {
			if isFa {
				faIcon = fmt.Sprintf("✅ فعال (%d عضو)", mand.ForcedAddCount)
			} else {
				faIcon = fmt.Sprintf("✅ On (%d members)", mand.ForcedAddCount)
			}
		}

		lblFj := "📢 Force Join Required: "
		lblFa := "👥 Force Add Members: "
		if isFa {
			lblFj = "📢 جوین اجباری در کانال: "
			lblFa = "👥 اد اجباری اعضا: "
		}

		rows = [][]map[string]interface{}{
			{
				{"text": lblFj + fjIcon, "callback_data": fmt.Sprintf("gset:tog:mandatory:force_join:%s", group.ID)},
			},
			{
				{"text": lblFa + faIcon, "callback_data": fmt.Sprintf("gset:tog:mandatory:forced_add:%s", group.ID)},
			},
			{
				{"text": backBtnText, "callback_data": fmt.Sprintf("gset:menu:%s", group.ID)},
			},
		}

	case "general":
		if isFa {
			text = fmt.Sprintf("🌐 <b>تنظیمات عمومی گروه</b> — <i>%s</i>\n\nسایر گزینه‌ها و تنظیمات ظاهری ربات در گروه:", telegram.EscapeHTML(group.ChatTitle))
		} else {
			text = fmt.Sprintf("🌐 <b>General Settings</b> — <i>%s</i>\n\nGeneral group and bot preferences:", telegram.EscapeHTML(group.ChatTitle))
		}

		pubCmdIcon := "❌ Admins Only"
		if isFa {
			pubCmdIcon = "❌ فقط ادمین‌ها"
		}
		if gen.PublicCommands {
			if isFa {
				pubCmdIcon = "✅ همه اعضا"
			} else {
				pubCmdIcon = "✅ All Members"
			}
		}

		hideJoinIcon := offText
		if gen.HideJoinLeave {
			hideJoinIcon = onText
		}

		lblPub := "💬 Public /rules & /stats: "
		lblHide := "🚪 Delete Join/Leave Msgs: "
		if isFa {
			lblPub = "💬 دستورات عمومی (/rules و ...): "
			lblHide = "🚪 حذف پیام ورود و خروج: "
		}

		rows = [][]map[string]interface{}{
			{
				{"text": lblPub + pubCmdIcon, "callback_data": fmt.Sprintf("gset:tog:general:public_commands:%s", group.ID)},
			},
			{
				{"text": lblHide + hideJoinIcon, "callback_data": fmt.Sprintf("gset:tog:general:hide_join:%s", group.ID)},
			},
			{
				{"text": backBtnText, "callback_data": fmt.Sprintf("gset:menu:%s", group.ID)},
			},
		}
	}

	markup := map[string]interface{}{
		"inline_keyboard": rows,
	}

	return text, markup
}

func (h *WebhookHandler) handleBotAddedToGroup(ctx context.Context, bot *repository.ManagedBot, chat *Chat, inviterID int64, _ bool, inviterLang string) {
	token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	var tg *telegram.BotAPIClient
	if token != "" {
		tg = telegram.NewBotAPIClient(token)
	}

	var liveMembersCount int
	var livePhotoURL string
	if tg != nil {
		liveMembersCount, _ = tg.GetChatMemberCount(ctx, chat.ID)
		if chat.Username != "" {
			livePhotoURL = fmt.Sprintf("https://t.me/i/userpic/320/%s.jpg", chat.Username)
		} else {
			livePhotoURL, _ = tg.GetChatPhotoURL(ctx, chat.ID)
		}
	}

	managedGroup, err := h.botRepo.GetGroup(ctx, bot.ID, chat.ID)
	if err != nil {
		// Group not found under this bot. Check if it exists under another bot to migrate and preserve settings.
		var existingGroupID uuid.UUID
		var oldBotID uuid.UUID
		var oldConnectedUserID *int64
		query := `SELECT id, bot_id, connected_by_user_id FROM managed_groups WHERE chat_id = $1 ORDER BY updated_at DESC LIMIT 1`
		errScan := h.db.Pool.QueryRow(ctx, query, chat.ID).Scan(&existingGroupID, &oldBotID, &oldConnectedUserID)
		if errScan == nil {
			oldBot, errOldBot := h.botRepo.GetBotByID(ctx, oldBotID)

			// Determine if migration is allowed:
			// 1. Same user owns both bots (oldBot.OwnerUserID == bot.OwnerUserID)
			// 2. Old bot is the main / mother bot (@ifragmentbot) being replaced by user's dedicated bot
			// 3. User who originally connected the group is the current bot's owner
			// 4. User who invited the current bot is the current bot's owner
			// 5. Fallback: Old bot is replaced by newly added active bot in the group
			isOldMain := false
			if oldBot != nil {
				if strings.EqualFold(oldBot.BotUsername, "iFragmentBot") {
					isOldMain = true
				}
				mainBotToken := strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN"))
				if mainBotToken == "" {
					mainBotToken = strings.TrimSpace(os.Getenv("BOT_TOKEN"))
				}
				if mainBotToken != "" {
					if strings.HasPrefix(strings.ToLower(mainBotToken), "bot") {
						mainBotToken = mainBotToken[3:]
					}
					parts := strings.SplitN(mainBotToken, ":", 2)
					if len(parts) >= 1 {
						if mainID, parseErr := strconv.ParseInt(strings.TrimSpace(parts[0]), 10, 64); parseErr == nil && mainID > 0 && oldBot.BotID == mainID {
							isOldMain = true
						}
					}
				}
				if mainBot, mainErr := h.botRepo.GetMainBot(ctx); mainErr == nil && mainBot != nil && (oldBot.ID == mainBot.ID || oldBot.BotID == mainBot.BotID) {
					isOldMain = true
				}
			}

			shouldMigrate := false
			if errOldBot == nil && oldBot != nil {
				if oldBot.OwnerUserID == bot.OwnerUserID || isOldMain {
					shouldMigrate = true
				} else if (oldConnectedUserID != nil && *oldConnectedUserID == bot.OwnerUserID) || (inviterID != 0 && inviterID == bot.OwnerUserID) {
					shouldMigrate = true
				} else {
					shouldMigrate = true
				}
			} else {
				shouldMigrate = true
			}

			if shouldMigrate {
				connectedUserID := bot.OwnerUserID
				if inviterID != 0 {
					connectedUserID = inviterID
				}
				// Migrate the group to the new bot and update connected_by_user_id
				updateQuery := `UPDATE managed_groups SET bot_id = $1, connected_by_user_id = $2, updated_at = now() WHERE id = $3`
				_, errUpdate := h.db.Pool.Exec(ctx, updateQuery, bot.ID, connectedUserID, existingGroupID)
				if errUpdate != nil {
					slog.Error("Failed to migrate group to new bot", "error", errUpdate, "group_id", existingGroupID, "new_bot_id", bot.ID)
					return
				}
				slog.Info("Successfully migrated group to new bot", "group_id", existingGroupID, "old_bot_id", oldBotID, "new_bot_id", bot.ID, "is_main_bot", isOldMain)

				// Clear Redis caches for old bot and new bot
				cache := h.moderator.GetCache()
				if cache != nil && cache.Client != nil {
					cache.Client.Del(ctx, fmt.Sprintf("bot_enabled:%s:%d", oldBotID.String(), chat.ID))
					cache.Client.Del(ctx, fmt.Sprintf("bot_enabled:%s:%d", bot.ID.String(), chat.ID))
					cache.Client.Del(ctx, fmt.Sprintf("bot_perms:%d:%d", chat.ID, bot.BotID))
				}

				managedGroup, err = h.botRepo.GetGroup(ctx, bot.ID, chat.ID)
				if err != nil {
					slog.Error("Failed to fetch migrated group", "error", err)
					return
				}
				if liveMembersCount > 0 || livePhotoURL != "" {
					_ = h.botRepo.UpdateGroupDetails(ctx, managedGroup.ID, chat.Title, liveMembersCount, livePhotoURL)
				}
			} else {
				slog.Warn("Group migration rejected", "chat_id", chat.ID, "old_bot_id", oldBotID, "new_bot_id", bot.ID)
			}
		} else {
			status := "trial"

			hasHadTrial, _ := h.botRepo.HasChatHadTrial(ctx, chat.ID)
			activeTrials, _ := h.botRepo.GetActiveTrialsCount(ctx, bot.OwnerUserID)

			if hasHadTrial || activeTrials >= 3 {
				status = "expired"
			} else {
				_ = h.botRepo.RecordTrial(ctx, chat.ID)
			}

			connectedUserID := inviterID
			if connectedUserID == 0 {
				connectedUserID = bot.OwnerUserID
			}

			managedGroup = &repository.ManagedGroup{
				BotID:              bot.ID,
				ChatID:             chat.ID,
				ChatTitle:          chat.Title,
				ChatType:           chat.Type,
				MembersCount:       liveMembersCount,
				PhotoURL:           livePhotoURL,
				SubscriptionStatus: status,
				TrialEndsAt:        time.Now().Add(72 * time.Hour),
				ConnectedByUserID:  &connectedUserID,
			}
			err = h.botRepo.CreateGroup(ctx, managedGroup)
			if err != nil {
				slog.Error("Failed to auto-create group in DB", "error", err)
				return
			}
		}
	} else if liveMembersCount > 0 || livePhotoURL != "" {
		_ = h.botRepo.UpdateGroupDetails(ctx, managedGroup.ID, chat.Title, liveMembersCount, livePhotoURL)
	}

	if tg == nil {
		token, _ = botmgmt.DecryptToken(bot.BotTokenEncrypted)
		tg = telegram.NewBotAPIClient(token)
	}

	// Single consolidated onboarding message
	GoSafe(func() {
		ctx := context.Background()

		lang := i18n.DetectLanguage(inviterLang)
		mGroup, errFetch := h.botRepo.GetGroup(ctx, bot.ID, chat.ID)
		if errFetch == nil && mGroup != nil {
			settings, _ := h.moderator.GetSettings(ctx, mGroup.ID)
			if settings != nil {
				var general repository.SettingsGeneral
				if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
					lang = general.Language
				}
			}
		}
		_ = lang

		miniAppURL := os.Getenv("MINI_APP_URL")
		if miniAppURL == "" {
			miniAppURL = "https://t.me/iFragmentBot/iFragment"
		}
		dashboardURL := ""
		if mGroup != nil {
			dashboardURL = fmt.Sprintf("%s?startapp=group_%s", miniAppURL, mGroup.ID)
		} else {
			dashboardURL = miniAppURL
		}

		var welcomeMsg string
		var btnSettingsText, btnDashboardText string
		if lang == "fa" {
			welcomeMsg = fmt.Sprintf(`🛡️ <b>محافظ هوشمند iFragment فعال شد!</b>

گروه <b>%s</b> تحت حفاظت هوشمند قرار گرفت.

✨ <b>ضمانت ۱۰۰٪ بدون تبلیغات (Zero-Ads Guarantee):</b>
تحت هیچ شرایطی پیام‌های تبلیغاتی، اسپم یا ایردراپ در گروه شما ارسال نخواهد شد.

⚡ <b>دسترسی سریع مدیریت:</b>
• دستور <code>/settings</code> یا <code>/config</code> برای منوی تعاملی دکمه‌های شیشه‌ای
• دستورات فوری: <code>/lock</code>, <code>/mute</code>, <code>/warn</code>, <code>/slowmode</code>, <code>/ephemeral</code>, <code>/rules</code>

⚙️ <b>دسترسی‌های لازم ادمین:</b>
✅ حذف پیام‌ها  ✅ محدودسازی اعضا  ✅ بن کاربران  ✅ سنجاق پیام`, telegram.EscapeHTML(chat.Title))
			btnSettingsText = "⚙️ تنظیمات گروه (Inline Settings)"
			btnDashboardText = "🌐 ورود به وب داشبورد (Web App)"
		} else {
			welcomeMsg = fmt.Sprintf(`🛡️ <b>iFragment Smart Guardian Activated!</b>

Group <b>%s</b> is now under smart protection.

✨ <b>100%% Zero-Ads Guarantee:</b>
No promotional messages, ads, or unwanted broadcasts will ever be sent to your group.

⚡ <b>Quick Admin Access:</b>
• <code>/settings</code> or <code>/config</code> for interactive button settings
• Quick commands: <code>/lock</code>, <code>/mute</code>, <code>/warn</code>, <code>/slowmode</code>, <code>/ephemeral</code>, <code>/rules</code>

⚙️ <b>Required Admin Permissions:</b>
✅ Delete Messages  ✅ Restrict Members  ✅ Ban Users  ✅ Pin Messages`, telegram.EscapeHTML(chat.Title))
			btnSettingsText = "⚙️ Group Settings (Inline)"
			btnDashboardText = "🌐 Open Web Dashboard (Web App)"
		}

		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{"text": btnSettingsText, "callback_data": fmt.Sprintf("gset:menu:%s", mGroup.ID)},
				},
				{
					{"text": btnDashboardText, "url": dashboardURL},
				},
			},
		}

		msg, _ := tg.SendMessageWithMarkup(ctx, chat.ID, welcomeMsg, markup, nil, "HTML")
		if msg != nil {
			msgID := msg.MessageID
			chatID := chat.ID
			time.AfterFunc(3*time.Minute, func() {
				bgCtx := context.Background()
				_ = tg.DeleteMessage(bgCtx, chatID, msgID)
			})
		}
	})
}

func (h *WebhookHandler) handleWelcomeMessage(ctx context.Context, bot *repository.ManagedBot, chat *Chat, threadID *int, newMembers []User) {
	slog.Info("handleWelcomeMessage triggered", "chat_id", chat.ID, "members_count", len(newMembers))
	group, err := h.botRepo.GetGroup(ctx, bot.ID, chat.ID)
	if err != nil {
		slog.Error("Welcome message: group not found", "error", err, "bot_id", bot.ID, "chat_id", chat.ID)
		return
	}
	settings, err := h.moderator.GetSettings(ctx, group.ID)
	if err != nil || settings == nil {
		slog.Error("Welcome message: settings not found", "error", err, "group_id", group.ID)
		return
	}

	var general repository.SettingsGeneral
	var ct repository.SettingsCustomTexts
	json.Unmarshal(settings.General, &general)
	json.Unmarshal(settings.CustomTexts, &ct)

	slog.Info("Welcome message check", "enabled", general.WelcomeMessage, "customTextLen", len(ct.WelcomeText))

	if !general.WelcomeMessage {
		return
	}

	welcomeText := ct.WelcomeText
	if welcomeText == "" || repository.IsLegacyText(welcomeText) {
		welcomeText = "👋 Welcome {user}"
	}

	bot, _ = h.botRepo.GetBotByID(ctx, group.BotID)
	tg, _ := h.moderator.GetTelegramClient(ctx, bot)

	// Gather all non-bot users
	var userLinks []string
	var firstNames []string
	var usernames []string
	for _, user := range newMembers {
		if user.IsBot {
			continue
		}
		name := user.FirstName
		firstNames = append(firstNames, telegram.EscapeHTML(user.FirstName))
		if user.Username != "" {
			name = "@" + user.Username
			usernames = append(usernames, "@"+telegram.EscapeHTML(user.Username))
		} else {
			usernames = append(usernames, telegram.EscapeHTML(user.FirstName))
		}
		// Fix markdown formatting to proper Telegram HTML <a> tag and escape the user name
		userLinks = append(userLinks, fmt.Sprintf(`<a href="tg://user?id=%d">%s</a>`, user.ID, telegram.EscapeHTML(name)))
	}
	if len(userLinks) == 0 {
		return
	}

	// Removed the 10-second rate limit because it permanently drops welcome messages
	// for users who solve the captcha shortly after another user.
	// AutoDeleteBot settings will clean up old welcome messages.

	// Format welcome text with placeholders, escaping dynamic inputs
	text := welcomeText
	usersStr := strings.Join(userLinks, ", ")
	text = strings.ReplaceAll(text, "{user}", usersStr)
	text = strings.ReplaceAll(text, "{first_name}", strings.Join(firstNames, ", "))
	text = strings.ReplaceAll(text, "{username}", strings.Join(usernames, ", "))
	text = strings.ReplaceAll(text, "{group}", telegram.EscapeHTML(chat.Title))
	text = strings.ReplaceAll(text, "{chat_title}", telegram.EscapeHTML(chat.Title))

	var ids []string
	for _, u := range newMembers {
		if !u.IsBot {
			ids = append(ids, fmt.Sprintf("%d", u.ID))
		}
	}
	text = strings.ReplaceAll(text, "{id}", strings.Join(ids, ", "))
	text = strings.ReplaceAll(text, "{time}", time.Now().Format("2006-01-02 15:04:05 MST"))

	// Member count placeholder
	count := 0
	if tg != nil {
		if cnt, err := tg.GetChatMemberCount(ctx, chat.ID); err == nil {
			count = cnt
		}
	}
	if count == 0 {
		count = group.MembersCount
	}
	text = strings.ReplaceAll(text, "{count}", fmt.Sprintf("%d", count))

	// Rules placeholder
	rules := ct.RulesText
	if rules == "" {
		rules = "📜 <b>Rules</b>: Respect others • No spam or links"
	}
	text = strings.ReplaceAll(text, "{rules}", rules)

	var markup map[string]interface{}
	if len(ct.InlineButtons) > 0 {
		var inlineKeyboard [][]map[string]interface{}
		var currentRow []map[string]interface{}
		for _, btn := range ct.InlineButtons {
			if btn.Title == "" || btn.URL == "" {
				continue
			}
			ikb := map[string]interface{}{
				"text": btn.Title,
				"url":  btn.URL,
			}
			if len(btn.Title) > 20 {
				if len(currentRow) > 0 {
					inlineKeyboard = append(inlineKeyboard, currentRow)
					currentRow = nil
				}
				inlineKeyboard = append(inlineKeyboard, []map[string]interface{}{ikb})
			} else {
				currentRow = append(currentRow, ikb)
				if len(currentRow) == 2 {
					inlineKeyboard = append(inlineKeyboard, currentRow)
					currentRow = nil
				}
			}
		}
		if len(currentRow) > 0 {
			inlineKeyboard = append(inlineKeyboard, currentRow)
		}
		if len(inlineKeyboard) > 0 {
			markup = map[string]interface{}{
				"inline_keyboard": inlineKeyboard,
			}
		}
	}

	if general.EphemeralWelcome || general.EphemeralAll {
		for _, u := range newMembers {
			if u.IsBot {
				continue
			}
			name := u.FirstName
			if u.Username != "" {
				name = "@" + u.Username
			}
			userLink := fmt.Sprintf(`<a href="tg://user?id=%d">%s</a>`, u.ID, telegram.EscapeHTML(name))

			personalText := welcomeText
			personalText = strings.ReplaceAll(personalText, "{user}", userLink)
			personalText = strings.ReplaceAll(personalText, "{first_name}", telegram.EscapeHTML(u.FirstName))
			if u.Username != "" {
				personalText = strings.ReplaceAll(personalText, "{username}", "@"+telegram.EscapeHTML(u.Username))
			} else {
				personalText = strings.ReplaceAll(personalText, "{username}", telegram.EscapeHTML(u.FirstName))
			}
			personalText = strings.ReplaceAll(personalText, "{group}", telegram.EscapeHTML(chat.Title))
			personalText = strings.ReplaceAll(personalText, "{chat_title}", telegram.EscapeHTML(chat.Title))
			personalText = strings.ReplaceAll(personalText, "{id}", fmt.Sprintf("%d", u.ID))
			personalText = strings.ReplaceAll(personalText, "{time}", time.Now().Format("2006-01-02 15:04:05 MST"))
			personalText = strings.ReplaceAll(personalText, "{count}", fmt.Sprintf("%d", count))
			personalText = strings.ReplaceAll(personalText, "{rules}", rules)

			h.sendEphemeralBotMessage(ctx, tg, chat.ID, u.ID, personalText, markup, threadID, general)
		}
		return
	}

	h.sendBotMessage(ctx, tg, chat.ID, text, markup, threadID, general)
}

func (h *WebhookHandler) deleteMessage(ctx context.Context, bot *repository.ManagedBot, chatID int64, messageID int) {
	token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)

	perms, err := h.getBotPermissionsCached(ctx, tg, chatID, bot.BotID)
	if err == nil && perms != nil && !perms.CanDeleteMessages {
		slog.Warn("Skipping delete message: bot lacks can_delete_messages", "chat_id", chatID)
		return
	}

	_ = tg.DeleteMessage(ctx, chatID, messageID)
}

func (h *WebhookHandler) handleGroupAdminCommand(ctx context.Context, bot *repository.ManagedBot, m *Message) bool {
	if m.From == nil || m.Chat == nil {
		return false
	}

	// Command check
	cmd := ""
	for _, ent := range m.Entities {
		if ent.Type == "bot_command" && ent.Offset == 0 {
			cmd = strings.Split(m.Text, "@")[0]
			cmd = strings.Split(cmd, " ")[0]

			// Check if command is addressed to a specific bot username (e.g. /ping@OtherBot)
			parts := strings.Split(strings.Fields(m.Text)[0], "@")
			if len(parts) > 1 && bot.BotUsername != "" {
				targetBot := parts[1]
				if !strings.EqualFold(targetBot, bot.BotUsername) {
					return false // Addressed to another bot in the group
				}
			}
			break
		}
	}
	if cmd == "" {
		return false
	}

	group, err := h.botRepo.GetGroup(ctx, bot.ID, m.Chat.ID)
	if err != nil {
		return false
	}
	tg, _ := h.moderator.GetTelegramClient(ctx, bot)

	// 1. Get Group Settings for publicCommands flag
	var general repository.SettingsGeneral
	settings, err := h.moderator.GetSettings(ctx, group.ID)
	if err == nil && settings != nil {
		_ = json.Unmarshal(settings.General, &general)
	}

	// 2. Classify commands
	isPublicCmd := cmd == "/rules" || cmd == "/info" || cmd == "/stats" || cmd == "/report" || cmd == "/ping" || cmd == "/id" || cmd == "/whois"

	isAdmin := h.isAdmin(ctx, tg, m.Chat.ID, m.From.ID)

	// 3. Admin Check
	if !isAdmin {
		if cmd == "/report" {
			// /report is always allowed for regular users (replies to reported message)
		} else if isPublicCmd && (general.PublicCommands || cmd == "/report") {
			// rules, info, stats, ping, id are allowed if publicCommands is true
		} else {
			return false
		}
	}

	userLangFromDB, _ := h.db.GetUserLanguage(ctx, m.From.ID)
	langCode := m.From.LanguageCode
	if userLangFromDB != "" {
		langCode = userLangFromDB
	}
	lang := i18n.DetectLanguage(langCode)

	switch cmd {
	case "/help", "/commands":
		return h.adminHelp(ctx, tg, m, lang)
	case "/tag":
		args := strings.TrimSpace(strings.TrimPrefix(m.Text, cmd))
		h.memberTagSvc.HandleTagCommand(ctx, tg, h.mapToModeratorContext(m), group, bot.ID, args)
		return true
	case "/lock", "/lockdown":
		return h.adminLock(ctx, bot, tg, m, lang, group.ID)
	case "/unlock":
		return h.adminUnlock(ctx, bot, tg, m, lang, group.ID)
	case "/ban", "/tban":
		return h.adminBan(ctx, bot, tg, m, lang, group.ID)
	case "/unban":
		return h.adminUnban(ctx, bot, tg, m, lang, group.ID)
	case "/kick":
		return h.adminKick(ctx, bot, tg, m, lang, group.ID)
	case "/mute", "/tmute":
		return h.adminMute(ctx, bot, tg, m, lang, group.ID)
	case "/unmute":
		return h.adminUnmute(ctx, bot, tg, m, lang, group.ID)
	case "/warn":
		return h.adminWarn(ctx, bot, m, lang, group.ID)
	case "/unwarn", "/resetwarns":
		return h.adminResetWarns(ctx, bot, tg, m, lang, group.ID)
	case "/warns":
		return h.adminCheckWarns(ctx, bot, tg, m, lang, group.ID)
	case "/ephemeral":
		return h.adminEphemeral(ctx, bot, tg, m, lang, group.ID)
	case "/del":
		return h.adminDel(ctx, tg, m)
	case "/purge", "/clear":
		return h.adminPurge(ctx, tg, m, lang)
	case "/rules":
		return h.adminRules(ctx, tg, m, lang, group.ID)
	case "/setrules":
		return h.adminSetRules(ctx, bot, tg, m, lang, group.ID)
	case "/welcome":
		return h.adminWelcome(ctx, tg, m, group.ID)
	case "/setwelcome":
		return h.adminSetWelcome(ctx, bot, tg, m, group.ID)
	case "/settitle", "/title":
		return h.adminSetTitle(ctx, tg, m)
	case "/setdesc", "/setdescription", "/description":
		return h.adminSetDescription(ctx, tg, m)
	case "/antispam":
		return h.adminAntispam(ctx, bot, tg, m, lang, group.ID)
	case "/quiet":
		return h.adminQuiet(ctx, bot, tg, m, lang, group.ID)
	case "/settings", "/config":
		h.handleGroupSettingsCommand(ctx, bot, m)
		return true
	case "/report":
		targetUserID := bot.OwnerUserID
		if group.ConnectedByUserID != nil {
			targetUserID = *group.ConnectedByUserID
		}
		return h.adminReport(ctx, tg, m, lang, targetUserID)
	case "/pin":
		return h.adminPin(ctx, bot, tg, m)
	case "/unpin":
		return h.adminUnpin(ctx, bot, tg, m)
	case "/unpinall":
		return h.adminUnpinAll(ctx, bot, tg, m)
	case "/id", "/whois":
		return h.adminID(ctx, tg, m)
	case "/ping":
		return h.adminPing(ctx, tg, m)
	case "/debug", "/status":
		return h.adminDebug(ctx, bot, tg, m, lang, group)
	case "/admins", "/staff":
		return h.adminAdmins(ctx, tg, m)
	case "/link", "/invitelink":
		return h.adminLink(ctx, tg, m)
	case "/info":
		return h.adminInfo(ctx, tg, m, lang, group, bot)
	case "/stats":
		return h.adminStats(ctx, tg, m, lang, group)
	case "/clean":
		return h.adminClean(ctx, tg, m, lang)
	}

	return false
}

func (h *WebhookHandler) isAdmin(ctx context.Context, tg *telegram.BotAPIClient, chatID, userID int64) bool {
	status, _ := h.moderator.GetChatMemberCached(ctx, tg, chatID, userID)
	return status == "administrator" || status == "creator"
}

func parseDurationStr(s string, defaultDur time.Duration) time.Duration {
	s = strings.TrimSpace(s)
	if s == "" {
		return defaultDur
	}
	if strings.HasSuffix(s, "d") {
		daysStr := strings.TrimSuffix(s, "d")
		if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
			return time.Duration(d) * 24 * time.Hour
		}
	}
	if dur, err := time.ParseDuration(s); err == nil && dur > 0 {
		return dur
	}
	return defaultDur
}

func (h *WebhookHandler) adminLock(ctx context.Context, _ *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, _ string, groupID uuid.UUID) bool {
	bFalse := false
	_ = tg.SetChatPermissions(ctx, m.Chat.ID, telegram.ChatPermissions{
		CanSendMessages:       &bFalse,
		CanSendPhotos:         &bFalse,
		CanSendVideos:         &bFalse,
		CanSendAudios:         &bFalse,
		CanSendDocuments:      &bFalse,
		CanSendOtherMessages:  &bFalse,
		CanAddWebPagePreviews: &bFalse,
	}, false)

	settings, _ := h.moderator.GetSettings(ctx, groupID)
	var quiet repository.SettingsQuietHours
	if settings != nil {
		_ = json.Unmarshal(settings.QuietHours, &quiet)
	}
	quiet.EmergencyLock = true
	data, _ := json.Marshal(quiet)
	_ = h.moderator.ForceUpdateCategory(ctx, groupID, "quiet_hours", data)

	msg := "🔒 <b>Group Locked.</b> Regular members can no longer send messages."
	_ = tg.SendMessage(ctx, m.Chat.ID, msg, &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminUnlock(ctx context.Context, _ *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, _ string, groupID uuid.UUID) bool {
	bTrue := true
	_ = tg.SetChatPermissions(ctx, m.Chat.ID, telegram.ChatPermissions{
		CanSendMessages:       &bTrue,
		CanSendPhotos:         &bTrue,
		CanSendVideos:         &bTrue,
		CanSendAudios:         &bTrue,
		CanSendDocuments:      &bTrue,
		CanSendOtherMessages:  &bTrue,
		CanAddWebPagePreviews: &bTrue,
	}, false)

	settings, _ := h.moderator.GetSettings(ctx, groupID)
	var quiet repository.SettingsQuietHours
	if settings != nil {
		_ = json.Unmarshal(settings.QuietHours, &quiet)
	}
	quiet.EmergencyLock = false
	data, _ := json.Marshal(quiet)
	_ = h.moderator.ForceUpdateCategory(ctx, groupID, "quiet_hours", data)

	msg := "🔓 <b>Group Unlocked.</b> Regular members can now send messages."
	_ = tg.SendMessage(ctx, m.Chat.ID, msg, &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminBan(ctx context.Context, bot *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, lang string, _ uuid.UUID) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 {
		return false
	}

	if perms, err := h.getBotPermissionsCached(ctx, tg, m.Chat.ID, bot.BotID); err == nil && perms != nil && !perms.CanRestrictMembers {
		_ = tg.SendMessage(ctx, m.Chat.ID, i18n.T(lang, "moderation.no_ban_perm"), &m.MessageID, m.MessageThreadID)
		return true
	}

	_ = tg.BanChatMember(ctx, m.Chat.ID, targetID, 0, false)
	_ = tg.SendMessage(ctx, m.Chat.ID, i18n.T(lang, "moderation.user_banned", map[string]interface{}{"id": targetID, "name": targetName}), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminUnban(ctx context.Context, bot *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, lang string, _ uuid.UUID) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 {
		return false
	}

	if perms, err := h.getBotPermissionsCached(ctx, tg, m.Chat.ID, bot.BotID); err == nil && perms != nil && !perms.CanRestrictMembers {
		_ = tg.SendMessage(ctx, m.Chat.ID, i18n.T(lang, "moderation.no_unban_perm"), &m.MessageID, m.MessageThreadID)
		return true
	}

	_ = tg.UnbanChatMember(ctx, m.Chat.ID, targetID, false)
	_ = tg.SendMessage(ctx, m.Chat.ID, i18n.T(lang, "moderation.user_unbanned", map[string]interface{}{"id": targetID, "name": targetName}), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminKick(ctx context.Context, bot *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, lang string, _ uuid.UUID) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 {
		return false
	}

	if perms, err := h.getBotPermissionsCached(ctx, tg, m.Chat.ID, bot.BotID); err == nil && perms != nil && !perms.CanRestrictMembers {
		_ = tg.SendMessage(ctx, m.Chat.ID, i18n.T(lang, "moderation.no_ban_perm"), &m.MessageID, m.MessageThreadID)
		return true
	}

	_ = tg.BanChatMember(ctx, m.Chat.ID, targetID, 0, false)
	_ = tg.UnbanChatMember(ctx, m.Chat.ID, targetID, false)
	msg := fmt.Sprintf("👢 <b>User kicked:</b> %s (ID: <code>%d</code>)", telegram.EscapeHTML(targetName), targetID)
	_ = tg.SendMessage(ctx, m.Chat.ID, msg, &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminMute(ctx context.Context, bot *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, lang string, _ uuid.UUID) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 {
		return false
	}

	if perms, err := h.getBotPermissionsCached(ctx, tg, m.Chat.ID, bot.BotID); err == nil && perms != nil && !perms.CanRestrictMembers {
		_ = tg.SendMessage(ctx, m.Chat.ID, i18n.T(lang, "moderation.no_mute_perm"), &m.MessageID, m.MessageThreadID)
		return true
	}

	args := strings.Fields(m.Text)
	dur := 24 * time.Hour
	if len(args) > 1 {
		dur = parseDurationStr(args[1], 24*time.Hour)
	}

	until := time.Now().Add(dur).Unix()
	_ = tg.RestrictChatMember(ctx, m.Chat.ID, targetID, until)
	msg := fmt.Sprintf("🔇 <b>User muted:</b> %s (Duration: <code>%s</code>)", telegram.EscapeHTML(targetName), dur.String())
	_ = tg.SendMessage(ctx, m.Chat.ID, msg, &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminUnmute(ctx context.Context, bot *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, lang string, _ uuid.UUID) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 {
		return false
	}

	if perms, err := h.getBotPermissionsCached(ctx, tg, m.Chat.ID, bot.BotID); err == nil && perms != nil && !perms.CanRestrictMembers {
		_ = tg.SendMessage(ctx, m.Chat.ID, i18n.T(lang, "moderation.no_unmute_perm"), &m.MessageID, m.MessageThreadID)
		return true
	}

	_ = tg.UnrestrictChatMember(ctx, m.Chat.ID, targetID)
	_ = tg.SendMessage(ctx, m.Chat.ID, i18n.T(lang, "moderation.user_unmuted", map[string]interface{}{"id": targetID, "name": targetName}), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminWarn(ctx context.Context, bot *repository.ManagedBot, m *Message, _ string, _ uuid.UUID) bool {
	targetID, _ := h.getTarget(m)
	if targetID == 0 {
		return false
	}

	violation := &botmgmt.Violation{
		Type:    "admin_warn",
		Action:  "warn",
		Message: "Warned by administrator",
	}
	h.executeViolationAction(ctx, bot, m.Chat.ID, targetID, m.MessageID, m.MessageThreadID, violation)
	return true
}

func (h *WebhookHandler) adminResetWarns(ctx context.Context, _ *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, _ string, groupID uuid.UUID) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 {
		return false
	}

	cache := h.moderator.GetCache()
	if cache != nil && cache.Client != nil {
		warnKey := fmt.Sprintf("warn_count:%s:%d", groupID, targetID)
		_ = cache.Client.Del(ctx, warnKey)
	}

	msg := fmt.Sprintf("✅ <b>Warnings cleared for user</b> %s (ID: <code>%d</code>).", telegram.EscapeHTML(targetName), targetID)
	_ = tg.SendMessage(ctx, m.Chat.ID, msg, &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminCheckWarns(ctx context.Context, _ *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, _ string, groupID uuid.UUID) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 {
		return false
	}

	count := 0
	cache := h.moderator.GetCache()
	if cache != nil && cache.Client != nil {
		warnKey := fmt.Sprintf("warn_count:%s:%d", groupID, targetID)
		if val, err := cache.Client.Get(ctx, warnKey).Result(); err == nil {
			fmt.Sscanf(val, "%d", &count)
		}
	}

	msg := fmt.Sprintf("⚠️ <b>User %s</b> has <b>%d</b> active warnings.", telegram.EscapeHTML(targetName), count)
	_ = tg.SendMessage(ctx, m.Chat.ID, msg, &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminEphemeral(ctx context.Context, _ *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, _ string, groupID uuid.UUID) bool {
	args := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(m.Text, strings.Split(m.Text, " ")[0])))

	settings, _ := h.moderator.GetSettings(ctx, groupID)
	var gen repository.SettingsGeneral
	if settings != nil {
		_ = json.Unmarshal(settings.General, &gen)
	}

	var msg string
	if args == "off" || args == "false" || args == "disable" {
		gen.EphemeralAll = false
		gen.AutoDeleteBot = false
		msg = "👻 <b>Ephemeral mode disabled.</b> Bot messages will remain in chat."
	} else {
		gen.EphemeralAll = true
		gen.AutoDeleteBot = true
		delay := 15
		if args != "" && args != "on" && args != "enable" {
			dur := parseDurationStr(args, 15*time.Second)
			delay = int(dur.Seconds())
			if delay <= 0 {
				delay = 15
			}
		}
		gen.AutoDeleteDelay = delay
		msg = fmt.Sprintf("👻 <b>Ephemeral mode enabled.</b> Bot messages will auto-delete in %ds.", delay)
	}

	data, _ := json.Marshal(gen)
	_ = h.moderator.ForceUpdateCategory(ctx, groupID, "general", data)

	_ = tg.SendMessage(ctx, m.Chat.ID, msg, &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminDel(ctx context.Context, tg *telegram.BotAPIClient, m *Message) bool {
	if m.ReplyToMessage != nil {
		_ = tg.DeleteMessage(ctx, m.Chat.ID, m.ReplyToMessage.MessageID)
	}
	_ = tg.DeleteMessage(ctx, m.Chat.ID, m.MessageID)
	return true
}

func (h *WebhookHandler) adminPurge(ctx context.Context, tg *telegram.BotAPIClient, m *Message, _ string) bool {
	if m.ReplyToMessage == nil {
		_ = tg.SendMessage(ctx, m.Chat.ID, "⚠️ Reply to a message to purge up to that point.", &m.MessageID, m.MessageThreadID)
		return true
	}

	startID := m.ReplyToMessage.MessageID
	endID := m.MessageID

	if startID > endID {
		startID, endID = endID, startID
	}

	count := endID - startID + 1
	if count > 100 {
		count = 100
		startID = endID - 99
	}

	var msgIDs []int
	for id := startID; id <= endID; id++ {
		msgIDs = append(msgIDs, id)
	}

	_ = tg.DeleteMessages(ctx, m.Chat.ID, msgIDs)
	confirmMsg := fmt.Sprintf("🧹 <b>Purged %d messages.</b>", len(msgIDs))
	res, err := tg.SendMessageWithResult(ctx, m.Chat.ID, confirmMsg, nil, m.MessageThreadID)
	if err == nil && res != nil {
		go func(chatID int64, msgID int) {
			time.Sleep(5 * time.Second)
			_ = tg.DeleteMessage(context.Background(), chatID, msgID)
		}(m.Chat.ID, res.MessageID)
	}
	return true
}

func (h *WebhookHandler) adminSetRules(ctx context.Context, _ *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, _ string, groupID uuid.UUID) bool {
	newRules := strings.TrimSpace(strings.TrimPrefix(m.Text, strings.Split(m.Text, " ")[0]))
	if newRules == "" {
		_ = tg.SendMessage(ctx, m.Chat.ID, "⚠️ Usage: <code>/setrules [Your Group Rules Here]</code>", &m.MessageID, m.MessageThreadID)
		return true
	}

	settings, _ := h.moderator.GetSettings(ctx, groupID)
	var ct repository.SettingsCustomTexts
	if settings != nil {
		_ = json.Unmarshal(settings.CustomTexts, &ct)
	}
	ct.RulesText = newRules
	data, _ := json.Marshal(ct)
	_ = h.moderator.ForceUpdateCategory(ctx, groupID, "custom_texts", data)

	_ = tg.SendMessage(ctx, m.Chat.ID, "📜 <b>Group rules updated successfully!</b>", &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminAntispam(ctx context.Context, _ *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, _ string, groupID uuid.UUID) bool {
	args := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(m.Text, strings.Split(m.Text, " ")[0])))

	settings, _ := h.moderator.GetSettings(ctx, groupID)
	var cont repository.SettingsContentRestrictions
	var gen repository.SettingsGeneral
	if settings != nil {
		_ = json.Unmarshal(settings.ContentRestrictions, &cont)
		_ = json.Unmarshal(settings.General, &gen)
	}

	enable := true
	if args == "off" || args == "false" || args == "disable" {
		enable = false
	}

	cont.RemoveLinks.Enabled = enable
	cont.BlockPhoneNumbers.Enabled = enable
	cont.BlockForwards.Enabled = enable
	gen.CasEnabled = enable

	dataCont, _ := json.Marshal(cont)
	dataGen, _ := json.Marshal(gen)
	_ = h.moderator.ForceUpdateCategory(ctx, groupID, "content_restrictions", dataCont)
	_ = h.moderator.ForceUpdateCategory(ctx, groupID, "general", dataGen)

	var msg string
	if enable {
		msg = "🛡 <b>Anti-spam protection is now ENABLED.</b> (Link filter, CAS, phone filter active)"
	} else {
		msg = "🛡 <b>Anti-spam protection is now DISABLED.</b>"
	}
	_ = tg.SendMessage(ctx, m.Chat.ID, msg, &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminQuiet(ctx context.Context, _ *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, _ string, groupID uuid.UUID) bool {
	args := strings.Fields(strings.TrimSpace(strings.TrimPrefix(m.Text, strings.Split(m.Text, " ")[0])))

	settings, _ := h.moderator.GetSettings(ctx, groupID)
	var quiet repository.SettingsQuietHours
	if settings != nil {
		_ = json.Unmarshal(settings.QuietHours, &quiet)
	}

	if len(args) == 0 {
		status := "Disabled"
		if quiet.EmergencyLock {
			status = "Emergency Lock (Chat Muted)"
		} else if len(quiet.Periods) > 0 {
			status = fmt.Sprintf("Scheduled: %s - %s", quiet.Periods[0].Start, quiet.Periods[0].End)
		}
		_ = tg.SendMessage(ctx, m.Chat.ID, fmt.Sprintf("🌙 <b>Quiet Hours Status:</b> %s\n\nUsage: <code>/quiet 23:00 07:00</code> or <code>/quiet off</code>", status), &m.MessageID, m.MessageThreadID)
		return true
	}

	if args[0] == "off" || args[0] == "disable" {
		quiet.Periods = nil
		quiet.EmergencyLock = false
		data, _ := json.Marshal(quiet)
		_ = h.moderator.ForceUpdateCategory(ctx, groupID, "quiet_hours", data)
		_ = tg.SendMessage(ctx, m.Chat.ID, "🌙 <b>Quiet hours disabled.</b>", &m.MessageID, m.MessageThreadID)
		return true
	}

	if len(args) >= 2 {
		start := args[0]
		end := args[1]
		quiet.Periods = []repository.QuietPeriod{
			{ID: "p1", Start: start, End: end},
		}
		data, _ := json.Marshal(quiet)
		_ = h.moderator.ForceUpdateCategory(ctx, groupID, "quiet_hours", data)
		_ = tg.SendMessage(ctx, m.Chat.ID, fmt.Sprintf("🌙 <b>Quiet hours set to %s - %s.</b>", start, end), &m.MessageID, m.MessageThreadID)
		return true
	}

	_ = tg.SendMessage(ctx, m.Chat.ID, "⚠️ Usage: <code>/quiet 23:00 07:00</code> or <code>/quiet off</code>", &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminRules(ctx context.Context, tg *telegram.BotAPIClient, m *Message, lang string, groupID uuid.UUID) bool {
	settings, err := h.moderator.GetSettings(ctx, groupID)
	var general repository.SettingsGeneral
	if settings != nil {
		_ = json.Unmarshal(settings.General, &general)
	}

	if err != nil || settings == nil {
		if m.From != nil && (general.EphemeralAdminCmd || general.EphemeralAll) {
			h.sendEphemeralBotMessage(ctx, tg, m.Chat.ID, m.From.ID, i18n.T(lang, "moderation.no_rules"), nil, m.MessageThreadID, general)
		} else {
			_ = tg.SendMessage(ctx, m.Chat.ID, i18n.T(lang, "moderation.no_rules"), &m.MessageID, m.MessageThreadID)
		}
		return true
	}

	var ct repository.SettingsCustomTexts
	_ = json.Unmarshal(settings.CustomTexts, &ct)

	if ct.RulesText == "" {
		if m.From != nil && (general.EphemeralAdminCmd || general.EphemeralAll) {
			h.sendEphemeralBotMessage(ctx, tg, m.Chat.ID, m.From.ID, i18n.T(lang, "moderation.no_rules"), nil, m.MessageThreadID, general)
		} else {
			_ = tg.SendMessage(ctx, m.Chat.ID, i18n.T(lang, "moderation.no_rules"), &m.MessageID, m.MessageThreadID)
		}
		return true
	}

	rulesText := ct.RulesText
	if m.From != nil {
		rulesText = strings.ReplaceAll(rulesText, "{first_name}", telegram.EscapeHTML(m.From.FirstName))
		if m.From.Username != "" {
			rulesText = strings.ReplaceAll(rulesText, "{username}", "@"+telegram.EscapeHTML(m.From.Username))
		} else {
			rulesText = strings.ReplaceAll(rulesText, "{username}", telegram.EscapeHTML(m.From.FirstName))
		}
	}

	text := i18n.T(lang, "moderation.rules_title", map[string]interface{}{"rules": rulesText})
	var markup map[string]interface{}
	if len(ct.InlineButtons) > 0 {
		markup = buildCustomInlineMarkup(ct.InlineButtons, nil)
	}
	if m.From != nil && (general.EphemeralAdminCmd || general.EphemeralAll) {
		h.sendEphemeralBotMessage(ctx, tg, m.Chat.ID, m.From.ID, text, markup, m.MessageThreadID, general)
	} else {
		h.sendBotMessage(ctx, tg, m.Chat.ID, text, markup, m.MessageThreadID, general)
	}
	return true
}

func (h *WebhookHandler) adminReport(ctx context.Context, tg *telegram.BotAPIClient, m *Message, _ string, ownerID int64) bool {
	if m.ReplyToMessage == nil || m.ReplyToMessage.From == nil {
		return false
	}

	reportMsg := fmt.Sprintf("🚨 <b>گزارش تخلف جدید</b>\n\n📌 <b>گروه:</b> %s\n👤 <b>گزارش‌دهنده:</b> <code>%d</code>\n🚫 <b>متخلف:</b> <code>%d</code>\n🔗 <b>پیام:</b> <a href=\"https://t.me/c/%s/%d\">مشاهده پیام در گروه</a>",
		telegram.EscapeHTML(m.Chat.Title), m.From.ID, m.ReplyToMessage.From.ID, strings.TrimPrefix(fmt.Sprintf("%d", m.Chat.ID), "-100"), m.ReplyToMessage.MessageID)

	_ = tg.SendMessage(ctx, ownerID, reportMsg, nil, nil)
	_ = tg.SendMessage(ctx, m.Chat.ID, "✅ گزارش با موفقیت برای مدیریت ارسال شد.", &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminPin(ctx context.Context, bot *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message) bool {
	if m.ReplyToMessage == nil {
		return false
	}

	if perms, err := h.getBotPermissionsCached(ctx, tg, m.Chat.ID, bot.BotID); err == nil && perms != nil && !perms.CanPinMessages {
		_ = tg.SendMessage(ctx, m.Chat.ID, "❌ I don't have permission to pin messages.", &m.MessageID, m.MessageThreadID)
		return true
	}

	_ = tg.PinChatMessage(ctx, m.Chat.ID, m.ReplyToMessage.MessageID)
	return true
}

func (h *WebhookHandler) adminUnpin(ctx context.Context, _ *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message) bool {
	msgID := 0
	if m.ReplyToMessage != nil {
		msgID = m.ReplyToMessage.MessageID
	}
	err := tg.UnpinChatMessage(ctx, m.Chat.ID, msgID)
	if err != nil {
		_ = tg.SendMessage(ctx, m.Chat.ID, "❌ Failed to unpin message.", &m.MessageID, m.MessageThreadID)
		return true
	}
	_ = tg.SendMessage(ctx, m.Chat.ID, "📌 Message unpinned successfully.", &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminUnpinAll(ctx context.Context, _ *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message) bool {
	err := tg.UnpinAllChatMessages(ctx, m.Chat.ID)
	if err != nil {
		_ = tg.SendMessage(ctx, m.Chat.ID, "❌ Failed to unpin all messages.", &m.MessageID, m.MessageThreadID)
		return true
	}
	_ = tg.SendMessage(ctx, m.Chat.ID, "📌 All pinned messages have been unpinned.", &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminHelp(ctx context.Context, tg *telegram.BotAPIClient, m *Message, lang string) bool {
	helpText := i18n.T(lang, "help.admin_help")
	_ = tg.SendMessage(ctx, m.Chat.ID, helpText, &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminID(ctx context.Context, tg *telegram.BotAPIClient, m *Message) bool {
	var targetUserID int64
	var targetUserName string
	if m.ReplyToMessage != nil && m.ReplyToMessage.From != nil {
		targetUserID = m.ReplyToMessage.From.ID
		targetUserName = m.ReplyToMessage.From.FirstName
		if m.ReplyToMessage.From.Username != "" {
			targetUserName = "@" + m.ReplyToMessage.From.Username
		}
	}

	replyID := 0
	if m.ReplyToMessage != nil {
		replyID = m.ReplyToMessage.MessageID
	}

	text := fmt.Sprintf("🆔 <b>Chat & User ID Info:</b>\n\n• <b>Chat ID:</b> <code>%d</code>\n• <b>Chat Title:</b> %s\n• <b>Sender ID:</b> <code>%d</code>",
		m.Chat.ID, telegram.EscapeHTML(m.Chat.Title), m.From.ID)

	if targetUserID != 0 {
		text += fmt.Sprintf("\n• <b>Target User:</b> %s (<code>%d</code>)", telegram.EscapeHTML(targetUserName), targetUserID)
	}
	if replyID != 0 {
		text += fmt.Sprintf("\n• <b>Replied Message ID:</b> <code>%d</code>", replyID)
	}
	if m.MessageThreadID != nil {
		text += fmt.Sprintf("\n• <b>Topic/Thread ID:</b> <code>%d</code>", *m.MessageThreadID)
	}

	_ = tg.SendMessage(ctx, m.Chat.ID, text, &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminPing(ctx context.Context, tg *telegram.BotAPIClient, m *Message) bool {
	msgTime := time.Unix(int64(m.Date), 0)
	latency := time.Since(msgTime).Milliseconds()
	if latency < 0 {
		latency = 0
	}
	text := fmt.Sprintf("🏓 <b>Pong!</b>\n⚡ Latency: <code>%dms</code>\n🛡️ Engine: <b>iFragment v2.0 (Active)</b>", latency)
	_ = tg.SendMessage(ctx, m.Chat.ID, text, &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminAdmins(ctx context.Context, tg *telegram.BotAPIClient, m *Message) bool {
	admins, err := tg.GetChatAdministrators(ctx, m.Chat.ID)
	if err != nil || len(admins) == 0 {
		_ = tg.SendMessage(ctx, m.Chat.ID, "❌ Failed to retrieve administrators.", &m.MessageID, m.MessageThreadID)
		return true
	}

	text := fmt.Sprintf("👥 <b>Administrators of %s:</b>\n\n", telegram.EscapeHTML(m.Chat.Title))
	for _, adm := range admins {
		icon := "👤"
		if adm.Status == "creator" {
			icon = "👑"
		} else if adm.CustomTitle != "" {
			icon = "⭐"
		}
		name := adm.User.FirstName
		if adm.User.Username != "" {
			name = fmt.Sprintf("<a href=\"https://t.me/%s\">%s</a>", adm.User.Username, telegram.EscapeHTML(name))
		} else {
			name = telegram.EscapeHTML(name)
		}
		if adm.CustomTitle != "" {
			text += fmt.Sprintf("%s %s (<i>%s</i>)\n", icon, name, telegram.EscapeHTML(adm.CustomTitle))
		} else {
			text += fmt.Sprintf("%s %s [%s]\n", icon, name, adm.Status)
		}
	}

	_ = tg.SendMessage(ctx, m.Chat.ID, text, &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminLink(ctx context.Context, tg *telegram.BotAPIClient, m *Message) bool {
	if m.Chat.Username != "" {
		link := fmt.Sprintf("https://t.me/%s", m.Chat.Username)
		_ = tg.SendMessage(ctx, m.Chat.ID, fmt.Sprintf("🔗 <b>Group Link:</b> %s", link), &m.MessageID, m.MessageThreadID)
		return true
	}
	link, err := tg.ExportChatInviteLink(ctx, m.Chat.ID)
	if err != nil || link == "" {
		_ = tg.SendMessage(ctx, m.Chat.ID, "❌ Unable to export invite link. Ensure bot has 'Invite Users' permission.", &m.MessageID, m.MessageThreadID)
		return true
	}
	_ = tg.SendMessage(ctx, m.Chat.ID, fmt.Sprintf("🔗 <b>Group Invite Link:</b>\n%s", link), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminWelcome(ctx context.Context, tg *telegram.BotAPIClient, m *Message, groupID uuid.UUID) bool {
	settings, _ := h.moderator.GetSettings(ctx, groupID)
	var ct repository.SettingsCustomTexts
	var gen repository.SettingsGeneral
	if settings != nil {
		_ = json.Unmarshal(settings.CustomTexts, &ct)
		_ = json.Unmarshal(settings.General, &gen)
	}

	status := "❌ Disabled"
	if gen.WelcomeMessage {
		status = "✅ Enabled"
	}

	preview := ct.WelcomeText
	if preview == "" {
		preview = "(Default Welcome Message)"
	}

	text := fmt.Sprintf("👋 <b>Welcome Message Status:</b> %s\n\n<b>Current Template:</b>\n<code>%s</code>\n\n<i>Use <code>/setwelcome [text]</code> to change it.</i>", status, telegram.EscapeHTML(preview))
	_ = tg.SendMessage(ctx, m.Chat.ID, text, &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminSetWelcome(ctx context.Context, _ *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, groupID uuid.UUID) bool {
	newWelcome := strings.TrimSpace(strings.TrimPrefix(m.Text, strings.Split(m.Text, " ")[0]))
	if newWelcome == "" {
		_ = tg.SendMessage(ctx, m.Chat.ID, "⚠️ Usage: <code>/setwelcome Welcome to {group}, {first_name}!</code>", &m.MessageID, m.MessageThreadID)
		return true
	}

	settings, _ := h.moderator.GetSettings(ctx, groupID)
	var ct repository.SettingsCustomTexts
	var gen repository.SettingsGeneral
	if settings != nil {
		_ = json.Unmarshal(settings.CustomTexts, &ct)
		_ = json.Unmarshal(settings.General, &gen)
	}
	ct.WelcomeText = newWelcome
	gen.WelcomeMessage = true

	dataCT, _ := json.Marshal(ct)
	dataGen, _ := json.Marshal(gen)
	_ = h.moderator.ForceUpdateCategory(ctx, groupID, "custom_texts", dataCT)
	_ = h.moderator.ForceUpdateCategory(ctx, groupID, "general", dataGen)

	_ = tg.SendMessage(ctx, m.Chat.ID, "👋 <b>Welcome message updated & enabled!</b>", &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminSetTitle(ctx context.Context, tg *telegram.BotAPIClient, m *Message) bool {
	newTitle := strings.TrimSpace(strings.TrimPrefix(m.Text, strings.Split(m.Text, " ")[0]))
	if newTitle == "" {
		_ = tg.SendMessage(ctx, m.Chat.ID, "⚠️ Usage: <code>/settitle [New Group Title]</code>", &m.MessageID, m.MessageThreadID)
		return true
	}
	err := tg.SetChatTitle(ctx, m.Chat.ID, newTitle)
	if err != nil {
		_ = tg.SendMessage(ctx, m.Chat.ID, "❌ Failed to change group title.", &m.MessageID, m.MessageThreadID)
		return true
	}
	_ = tg.SendMessage(ctx, m.Chat.ID, fmt.Sprintf("✅ Group title changed to: <b>%s</b>", telegram.EscapeHTML(newTitle)), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminSetDescription(ctx context.Context, tg *telegram.BotAPIClient, m *Message) bool {
	newDesc := strings.TrimSpace(strings.TrimPrefix(m.Text, strings.Split(m.Text, " ")[0]))
	err := tg.SetChatDescription(ctx, m.Chat.ID, newDesc)
	if err != nil {
		_ = tg.SendMessage(ctx, m.Chat.ID, "❌ Failed to change group description.", &m.MessageID, m.MessageThreadID)
		return true
	}
	_ = tg.SendMessage(ctx, m.Chat.ID, "✅ Group description updated successfully.", &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) getTarget(m *Message) (int64, string) {
	if m.ReplyToMessage != nil && m.ReplyToMessage.From != nil {
		name := m.ReplyToMessage.From.FirstName
		if m.ReplyToMessage.From.Username != "" {
			name = "@" + m.ReplyToMessage.From.Username
		}
		return m.ReplyToMessage.From.ID, name
	}

	// Check text_mention in entities
	for _, ent := range m.Entities {
		if ent.Type == "text_mention" && ent.User != nil {
			name := ent.User.FirstName
			if ent.User.Username != "" {
				name = "@" + ent.User.Username
			}
			return ent.User.ID, name
		}
	}

	// Check numeric ID in arguments (e.g. /ban 123456789)
	fields := strings.Fields(m.Text)
	if len(fields) > 1 {
		if id, err := strconv.ParseInt(fields[1], 10, 64); err == nil && id > 0 {
			return id, fmt.Sprintf("%d", id)
		}
	}

	return 0, ""
}

func (h *WebhookHandler) handleGroupSettingsCallback(ctx context.Context, bot *repository.ManagedBot, cq *CallbackQuery) {
	if cq.Message == nil || cq.From.ID == 0 {
		return
	}

	// ⚡ Fast immediate ACK to stop Telegram loading spinner immediately
	token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	var tg *telegram.BotAPIClient
	if token != "" {
		tg = telegram.NewBotAPIClient(token)
		_ = tg.AnswerCallbackQuery(ctx, cq.ID, "", false)
	}

	parts := strings.Split(cq.Data, ":")
	if len(parts) < 3 {
		return
	}

	action := parts[1]
	groupIDStr := parts[len(parts)-1]
	groupID, err := uuid.Parse(groupIDStr)
	if err != nil {
		return
	}

	userLangFromDB, _ := h.db.GetUserLanguage(ctx, cq.From.ID)
	langCode := cq.From.LanguageCode
	if userLangFromDB != "" {
		langCode = userLangFromDB
	}
	lang := i18n.DetectLanguage(langCode)
	isFa := (lang == "fa")

	if tg == nil {
		tgClient, errTg := h.moderator.GetTelegramClient(ctx, bot)
		if errTg == nil && tgClient != nil {
			tg = tgClient
		}
	}
	if tg == nil {
		return
	}

	group, err := h.botRepo.GetGroupByID(ctx, groupID)
	if err != nil || group == nil {
		group, _ = h.botRepo.GetGroup(ctx, bot.ID, cq.Message.Chat.ID)
	}
	if group == nil {
		msg := "❌ گروه یافت نشد."
		if !isFa {
			msg = "❌ Group not found."
		}
		_ = tg.AnswerCallbackQuery(ctx, cq.ID, msg, true)
		return
	}

	isAuthorized := false
	if cq.From.ID == bot.OwnerUserID || (group.ConnectedByUserID != nil && cq.From.ID == *group.ConnectedByUserID) {
		isAuthorized = true
	} else {
		status, _ := h.moderator.GetChatMemberCached(ctx, tg, cq.Message.Chat.ID, cq.From.ID)
		if status == "administrator" || status == "creator" || status == "owner" {
			isAuthorized = true
		}
	}

	if !isAuthorized {
		msg := "❌ فقط مدیران گروه مجاز به تغییر تنظیمات هستند."
		if !isFa {
			msg = "❌ Only administrators can modify group settings."
		}
		_ = tg.AnswerCallbackQuery(ctx, cq.ID, msg, true)
		return
	}

	settings, _ := h.moderator.GetSettings(ctx, group.ID)

	if action == "close" {
		_ = tg.DeleteMessage(ctx, cq.Message.Chat.ID, cq.Message.MessageID)
		msg := "منوی تنظیمات بسته شد."
		if !isFa {
			msg = "Settings closed."
		}
		_ = tg.AnswerCallbackQuery(ctx, cq.ID, msg, false)
		return
	}

	if action == "menu" {
		text, markup := h.renderMainSettingsMenu(ctx, group, settings, lang)
		if err := tg.EditMessageTextWithMarkup(ctx, cq.Message.Chat.ID, cq.Message.MessageID, text, markup, "HTML"); err != nil {
			slog.Warn("Settings main menu edit failed", "err", err, "group_id", group.ID)
		}
		return
	}

	if action == "cat" && len(parts) >= 4 {
		category := parts[2]
		text, markup := h.renderCategorySettingsMenu(ctx, group, settings, category, lang)
		if err := tg.EditMessageTextWithMarkup(ctx, cq.Message.Chat.ID, cq.Message.MessageID, text, markup, "HTML"); err != nil {
			slog.Warn("Settings category menu edit failed", "err", err, "group_id", group.ID, "category", category)
		}
		return
	}

	if action == "tog" && len(parts) >= 5 {
		category := parts[2]
		key := parts[3]

		var updateErr error

		switch category {
		case "content":
			var cont repository.SettingsContentRestrictions
			if settings != nil {
				_ = json.Unmarshal(settings.ContentRestrictions, &cont)
			}
			var gen repository.SettingsGeneral
			if settings != nil {
				_ = json.Unmarshal(settings.General, &gen)
			}

			switch key {
			case "link_filter":
				cont.RemoveLinks.Enabled = !cont.RemoveLinks.Enabled
				data, _ := json.Marshal(cont)
				updateErr = h.moderator.ForceUpdateCategory(ctx, group.ID, "content_restrictions", data)
			case "phone_filter":
				cont.BlockPhoneNumbers.Enabled = !cont.BlockPhoneNumbers.Enabled
				data, _ := json.Marshal(cont)
				updateErr = h.moderator.ForceUpdateCategory(ctx, group.ID, "content_restrictions", data)
			case "forward_filter":
				cont.BlockForwards.Enabled = !cont.BlockForwards.Enabled
				data, _ := json.Marshal(cont)
				updateErr = h.moderator.ForceUpdateCategory(ctx, group.ID, "content_restrictions", data)
			case "cas":
				gen.CasEnabled = !gen.CasEnabled
				data, _ := json.Marshal(gen)
				updateErr = h.moderator.ForceUpdateCategory(ctx, group.ID, "general", data)
			}

		case "quiet":
			var quiet repository.SettingsQuietHours
			if settings != nil {
				_ = json.Unmarshal(settings.QuietHours, &quiet)
			}
			switch key {
			case "emergencyLock":
				quiet.EmergencyLock = !quiet.EmergencyLock
				data, _ := json.Marshal(quiet)
				updateErr = h.moderator.ForceUpdateCategory(ctx, group.ID, "quiet_hours", data)
				if updateErr == nil {
					var customTexts repository.SettingsCustomTexts
					_ = json.Unmarshal(settings.CustomTexts, &customTexts)
					if quiet.EmergencyLock {
						msg := customTexts.SilenceStartText
						if msg == "" {
							msg = "🔒 <b>حالت سکوت اضطراری در گروه فعال شد.</b> اعضای عادی موقتاً امکان ارسال پیام ندارند."
						}
						_ = tg.SendMessage(ctx, group.ChatID, msg, nil, nil)
					} else {
						msg := customTexts.SilenceEndText
						if msg == "" {
							msg = "🔓 <b>حالت سکوت اضطراری به پایان رسید.</b> اعضا اکنون می‌توانند پیام ارسال کنند."
						}
						_ = tg.SendMessage(ctx, group.ChatID, msg, nil, nil)
					}
				}
			case "adminOverride":
				quiet.AdminOverride = !quiet.AdminOverride
				data, _ := json.Marshal(quiet)
				updateErr = h.moderator.ForceUpdateCategory(ctx, group.ID, "quiet_hours", data)
			}

		case "ephemeral":
			var gen repository.SettingsGeneral
			if settings != nil {
				_ = json.Unmarshal(settings.General, &gen)
			}
			switch key {
			case "ephemeralAll":
				gen.EphemeralAll = !gen.EphemeralAll
			case "ephemeralAdminCmd":
				gen.EphemeralAdminCmd = !gen.EphemeralAdminCmd
			case "ephemeralWarnings":
				gen.EphemeralWarnings = !gen.EphemeralWarnings
			}
			data, _ := json.Marshal(gen)
			updateErr = h.moderator.ForceUpdateCategory(ctx, group.ID, "general", data)

		case "mandatory":
			var mand repository.SettingsMandatoryMembership
			if settings != nil {
				_ = json.Unmarshal(settings.MandatoryMembership, &mand)
			}
			switch key {
			case "force_join":
				mand.ForceJoinEnabled = !mand.ForceJoinEnabled
			case "forced_add":
				mand.ForcedAddEnabled = !mand.ForcedAddEnabled
				if mand.ForcedAddCount == 0 {
					mand.ForcedAddCount = 3
				}
			}
			data, _ := json.Marshal(mand)
			updateErr = h.moderator.ForceUpdateCategory(ctx, group.ID, "mandatory_membership", data)

		case "general":
			var gen repository.SettingsGeneral
			if settings != nil {
				_ = json.Unmarshal(settings.General, &gen)
			}
			switch key {
			case "public_commands":
				gen.PublicCommands = !gen.PublicCommands
			case "hide_join":
				gen.HideJoinLeave = !gen.HideJoinLeave
			}
			data, _ := json.Marshal(gen)
			updateErr = h.moderator.ForceUpdateCategory(ctx, group.ID, "general", data)
		}

		if updateErr != nil {
			slog.Error("Failed to update setting category", "err", updateErr, "group_id", group.ID, "category", category)
			errMsg := "⚠️ خطا در ذخیره تنظیمات"
			if !isFa {
				errMsg = "⚠️ Error updating setting"
			}
			_ = tg.AnswerCallbackQuery(ctx, cq.ID, errMsg, true)
			return
		}

		updatedSettings, _ := h.moderator.GetSettings(ctx, group.ID)
		text, markup := h.renderCategorySettingsMenu(ctx, group, updatedSettings, category, lang)
		if err := tg.EditMessageTextWithMarkup(ctx, cq.Message.Chat.ID, cq.Message.MessageID, text, markup, "HTML"); err != nil {
			slog.Warn("Settings toggle menu edit failed", "err", err, "group_id", group.ID)
		}
		return
	}

	if action == "cycle" && len(parts) >= 5 {
		category := parts[2]
		key := parts[3]

		var updateErr error

		switch category {
		case "limits":
			var limits repository.SettingsLimits
			if settings != nil {
				_ = json.Unmarshal(settings.Limits, &limits)
			}
			switch key {
			case "flood":
				switch limits.FloodMsgs {
				case 0:
					limits.FloodMsgs = 5
					limits.FloodWin = 5
				case 5:
					limits.FloodMsgs = 10
					limits.FloodWin = 5
				default:
					limits.FloodMsgs = 0
					limits.FloodWin = 0
				}
			}
			data, _ := json.Marshal(limits)
			updateErr = h.moderator.ForceUpdateCategory(ctx, group.ID, "limits", data)

		case "ephemeral":
			var gen repository.SettingsGeneral
			if settings != nil {
				_ = json.Unmarshal(settings.General, &gen)
			}
			if key == "delay" {
				switch gen.AutoDeleteDelay {
				case 5:
					gen.AutoDeleteDelay = 15
				case 15:
					gen.AutoDeleteDelay = 30
				case 30:
					gen.AutoDeleteDelay = 60
				default:
					gen.AutoDeleteDelay = 5
				}
				data, _ := json.Marshal(gen)
				updateErr = h.moderator.ForceUpdateCategory(ctx, group.ID, "general", data)
			}
		}

		if updateErr != nil {
			slog.Error("Failed to cycle setting", "err", updateErr, "group_id", group.ID, "category", category)
			errMsg := "⚠️ خطا در ذخیره مقدار"
			if !isFa {
				errMsg = "⚠️ Error cycling value"
			}
			_ = tg.AnswerCallbackQuery(ctx, cq.ID, errMsg, true)
			return
		}

		updatedSettings, _ := h.moderator.GetSettings(ctx, group.ID)
		text, markup := h.renderCategorySettingsMenu(ctx, group, updatedSettings, category, lang)
		if err := tg.EditMessageTextWithMarkup(ctx, cq.Message.Chat.ID, cq.Message.MessageID, text, markup, "HTML"); err != nil {
			slog.Warn("Settings cycle menu edit failed", "err", err, "group_id", group.ID)
		}
		return
	}
}

func (h *WebhookHandler) handleCallbackQuery(ctx context.Context, bot *repository.ManagedBot, cq *CallbackQuery) {
	if strings.HasPrefix(cq.Data, "verify_join:") {
		parts := strings.Split(cq.Data, ":")
		if len(parts) >= 3 {
			groupIDStr := parts[1]
			userIDStr := parts[2]
			if gid, err := uuid.Parse(groupIDStr); err == nil {
				group, errGroup := h.botRepo.GetGroupByID(ctx, gid)
				if errGroup == nil && group != nil {
					targetUserID, _ := strconv.ParseInt(userIDStr, 10, 64)
					if targetUserID == cq.From.ID {
						tg, tgErr := h.moderator.GetTelegramClient(ctx, bot)
						if tgErr == nil {
							_ = tg.ApproveChatJoinRequest(ctx, group.ChatID, cq.From.ID)
							userLang := i18n.DetectLanguage(cq.From.LanguageCode)
							successMsg := "✅ شما تأیید شدید و درخواست شما پذیرفته شد!"
							if userLang != "fa" {
								successMsg = "✅ You have been verified and approved to join!"
							}
							_ = tg.AnswerCallbackQuery(ctx, cq.ID, successMsg, true)
							if cq.Message != nil {
								_ = tg.DeleteMessage(ctx, cq.Message.Chat.ID, cq.Message.MessageID)
							}
						}
					}
				}
			}
		}
		return
	}

	if strings.HasPrefix(cq.Data, "gset:") {
		h.handleGroupSettingsCallback(ctx, bot, cq)
		return
	}

	if strings.HasPrefix(cq.Data, "lang:") {

		parts := strings.Split(cq.Data, ":")
		if len(parts) >= 2 {
			newLang := parts[1]
			err := h.db.UpdateUserLanguage(ctx, cq.From.ID, newLang)

			token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
			tg := telegram.NewBotAPIClient(token)

			var msg string
			if err == nil {
				msg = i18n.T(newLang, "profile.languageSettings") + " ✅"
			} else {
				msg = "Error updating language"
			}

			_ = tg.AnswerCallbackQuery(ctx, cq.ID, msg, false)
			// Optionally delete the message after language is selected
			if cq.Message != nil {
				_ = tg.DeleteMessage(ctx, cq.Message.Chat.ID, cq.Message.MessageID)
			}
		}
		return
	}

	if strings.HasPrefix(cq.Data, "f_") {
		err := h.channelService.HandleFunnelCallback(ctx, channelmgmt.FunnelCallbackData{
			QueryID:          cq.ID,
			Data:             cq.Data,
			FromID:           cq.From.ID,
			FromLanguageCode: cq.From.LanguageCode,
			ChatID:           cq.Message.Chat.ID,
			ChatTitle:        cq.Message.Chat.Title,
			MessageID:        cq.Message.MessageID,
		}, bot)
		if err != nil {
			slog.Error("Failed to handle channel funnel callback query", "error", err)
		}
		return
	}

	if strings.HasPrefix(cq.Data, "captcha:") {
		parts := strings.Split(cq.Data, ":")
		if len(parts) < 2 {
			return
		}
		expectedUserID := parts[1]

		_, err := h.botRepo.GetGroup(ctx, bot.ID, cq.Message.Chat.ID)
		if err != nil {
			return
		}

		if fmt.Sprintf("%d", cq.From.ID) != expectedUserID {
			_ = h.moderator.AnswerCallbackQuery(ctx, bot, cq.ID, "This is not for you!", false)
			return
		}

		tg, _ := h.moderator.GetTelegramClient(ctx, bot)

		// Atomically check and clear pending captcha in Redis to prevent race conditions
		// where a user clicks the button multiple times and gets multiple welcome messages.
		cache := h.moderator.GetCache()
		var redisVal string
		if cache != nil && cache.Client != nil {
			pendingKey := fmt.Sprintf("captcha_pending:%d:%d", cq.Message.Chat.ID, cq.From.ID)
			if val, err := cache.Client.Get(ctx, pendingKey).Result(); err == nil {
				redisVal = val
			}
			deleted, err := cache.Client.Del(ctx, pendingKey).Result()
			if err != nil || deleted == 0 {
				_ = h.moderator.AnswerCallbackQuery(ctx, bot, cq.ID, "Captcha already solved or expired.", false)
				return
			}
		}

		var isEphemeral bool
		var captchaMsgID string
		if redisVal != "" {
			parts := strings.SplitN(redisVal, ":", 2)
			if len(parts) == 2 {
				isEphemeral = (parts[0] == "ephemeral")
				captchaMsgID = parts[1]
			}
		}

		_ = tg.UnrestrictChatMember(ctx, cq.Message.Chat.ID, cq.From.ID)
		if isEphemeral && captchaMsgID != "" {
			_ = tg.DeleteEphemeralMessage(ctx, cq.Message.Chat.ID, captchaMsgID)
		} else if cq.Message != nil && cq.Message.EphemeralMessageID.String() != "" {
			_ = tg.DeleteEphemeralMessage(ctx, cq.Message.Chat.ID, cq.Message.EphemeralMessageID.String())
		} else if cq.Message != nil {
			_ = tg.DeleteMessage(ctx, cq.Message.Chat.ID, cq.Message.MessageID)
		}
		_ = tg.AnswerCallbackQuery(ctx, cq.ID, "Verification successful! Welcome.", false)

		h.handleWelcomeMessage(ctx, bot, cq.Message.Chat, cq.Message.MessageThreadID, []User{cq.From})
	} else if strings.HasPrefix(cq.Data, "btn_click:") {
		parts := strings.Split(cq.Data, ":")
		if len(parts) < 2 {
			return
		}
		buttonIDStr := parts[1]
		buttonID, err := uuid.Parse(buttonIDStr)
		if err != nil {
			return
		}

		// Retrieve button info to find channel_id
		button, errButton := h.channelService.GetButtonByID(ctx, buttonID)
		if errButton != nil {
			slog.Error("Failed to find button by ID", "button_id", buttonID, "error", errButton)
			return
		}

		var msgID int64
		if cq.Message != nil {
			msgID = int64(cq.Message.MessageID)
		}

		err = h.channelService.RegisterButtonClick(ctx, button.ChannelID, msgID, buttonID, cq.From.ID)

		token, errToken := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		if errToken == nil {
			tg := telegram.NewBotAPIClient(token)

			if errors.Is(err, channelmgmt.ErrAlreadyClicked) {
				userLang := i18n.DetectLanguage(cq.From.LanguageCode)
				msg := "You have already voted!"
				switch userLang {
				case "fa":
					msg = "شما قبلاً رأی داده‌اید!"
				case "ru":
					msg = "Вы уже проголосовали!"
				case "ar":
					msg = "لقد قمت بالتصويت بالفعل!"
				}
				_ = tg.AnswerCallbackQuery(ctx, cq.ID, msg, true) // true = show alert popup
				return
			} else if err != nil {
				slog.Error("Failed to register button click", "button_id", buttonID, "error", err)
				_ = tg.AnswerCallbackQuery(ctx, cq.ID, "Failed to register click", false)
				return
			}

			_ = tg.AnswerCallbackQuery(ctx, cq.ID, "Click registered!", false)

			// Automatically update the message reply markup
			if cq.Message != nil {
				markup, errMarkup := h.buildChannelInlineKeyboard(ctx, button.ChannelID, msgID)
				if errMarkup == nil && markup != nil {
					_ = tg.EditMessageReplyMarkup(ctx, cq.Message.Chat.ID, cq.Message.MessageID, markup)
				}
			}
		}
	} else if strings.HasPrefix(cq.Data, "approve:") {
		userLang := i18n.DetectLanguage(cq.From.LanguageCode)
		if cq.From.ID != bot.OwnerUserID {
			_ = h.moderator.AnswerCallbackQuery(ctx, bot, cq.ID, i18n.T(userLang, "channel.owner_only_error"), true)
			return
		}
		parts := strings.Split(cq.Data, ":")
		if len(parts) < 2 {
			return
		}
		pendingIDStr := parts[1]

		cache := h.moderator.GetCache()
		if cache == nil || cache.Client == nil {
			return
		}

		cacheKey := fmt.Sprintf("pending_post:%s", pendingIDStr)
		pendingVal, err := cache.Client.Get(ctx, cacheKey).Result()
		if err != nil {
			_ = h.moderator.AnswerCallbackQuery(ctx, bot, cq.ID, i18n.T(userLang, "channel.draft_expired"), true)
			return
		}

		var pending repository.PendingPost
		if err := json.Unmarshal([]byte(pendingVal), &pending); err != nil {
			return
		}

		token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		if err != nil {
			return
		}

		tg := telegram.NewBotAPIClient(token)

		// Fetch language from channel settings
		lang := userLang
		settings, err := h.channelService.GetChannelSettingsDirect(ctx, pending.ChannelID)
		if err == nil && settings != nil {
			var general struct {
				Language string `json:"language"`
			}
			if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
				lang = general.Language
			}
		}

		// Construct reply markup for the channel post
		markup := buildReplyMarkupFromButtons(pending.Buttons)

		// Send message to final channel
		_, err = tg.SendMessageWithMarkup(ctx, pending.ChatID, pending.Text, markup, nil)
		if err != nil {
			_ = tg.AnswerCallbackQuery(ctx, cq.ID, i18n.T(lang, "channel.failed_publish", map[string]interface{}{"err": err.Error()}), true)
			return
		}

		// Delete pending post in Redis
		cache.Client.Del(ctx, cacheKey)

		// Answer callback query
		_ = tg.AnswerCallbackQuery(ctx, cq.ID, i18n.T(lang, "channel.success_publish"), false)

		// Edit original message in PV to show success
		previewText := i18n.T(lang, "channel.draft_status_approved", map[string]interface{}{
			"channel": cq.Message.Chat.Title,
			"text":    pending.Text,
		})
		_ = tg.EditMessageText(ctx, cq.Message.Chat.ID, cq.Message.MessageID, previewText)

	} else if strings.HasPrefix(cq.Data, "reject:") {
		userLang := i18n.DetectLanguage(cq.From.LanguageCode)
		if cq.From.ID != bot.OwnerUserID {
			_ = h.moderator.AnswerCallbackQuery(ctx, bot, cq.ID, i18n.T(userLang, "channel.owner_only_error"), true)
			return
		}
		parts := strings.Split(cq.Data, ":")
		if len(parts) < 2 {
			return
		}
		pendingIDStr := parts[1]

		cache := h.moderator.GetCache()
		if cache == nil || cache.Client == nil {
			return
		}

		cacheKey := fmt.Sprintf("pending_post:%s", pendingIDStr)
		pendingVal, err := cache.Client.Get(ctx, cacheKey).Result()
		if err != nil {
			_ = h.moderator.AnswerCallbackQuery(ctx, bot, cq.ID, i18n.T(userLang, "channel.draft_expired"), true)
			return
		}

		var pending repository.PendingPost
		if err := json.Unmarshal([]byte(pendingVal), &pending); err != nil {
			return
		}

		token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		if err != nil {
			return
		}
		tg := telegram.NewBotAPIClient(token)

		// Fetch language from channel settings
		lang := userLang
		settings, err := h.channelService.GetChannelSettingsDirect(ctx, pending.ChannelID)
		if err == nil && settings != nil {
			var general struct {
				Language string `json:"language"`
			}
			if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
				lang = general.Language
			}
		}

		// Delete pending post in Redis
		cache.Client.Del(ctx, cacheKey)

		_ = tg.AnswerCallbackQuery(ctx, cq.ID, i18n.T(lang, "channel.post_rejected"), false)

		// Edit original message in PV to show rejected status
		previewText := i18n.T(lang, "channel.draft_status_rejected", map[string]interface{}{
			"channel": cq.Message.Chat.Title,
			"text":    pending.Text,
		})
		_ = tg.EditMessageText(ctx, cq.Message.Chat.ID, cq.Message.MessageID, previewText)

	} else if strings.HasPrefix(cq.Data, "edit_text:") {
		userLang := i18n.DetectLanguage(cq.From.LanguageCode)
		if cq.From.ID != bot.OwnerUserID {
			_ = h.moderator.AnswerCallbackQuery(ctx, bot, cq.ID, i18n.T(userLang, "channel.owner_only_error"), true)
			return
		}
		parts := strings.Split(cq.Data, ":")
		if len(parts) < 2 {
			return
		}
		pendingIDStr := parts[1]

		cache := h.moderator.GetCache()
		if cache == nil || cache.Client == nil {
			return
		}

		// Fetch pending draft to check channel language
		lang := userLang
		cacheKey := fmt.Sprintf("pending_post:%s", pendingIDStr)
		pendingVal, err := cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var pending repository.PendingPost
			if json.Unmarshal([]byte(pendingVal), &pending) == nil {
				settings, err := h.channelService.GetChannelSettingsDirect(ctx, pending.ChannelID)
				if err == nil && settings != nil {
					var general struct {
						Language string `json:"language"`
					}
					if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
						lang = general.Language
					}
				}
			}
		}

		// Set user edit text state
		stateKey := fmt.Sprintf("edit_state:%d", cq.From.ID)
		_ = cache.Client.Set(ctx, stateKey, pendingIDStr, 10*time.Minute).Err()

		token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		if err != nil {
			return
		}
		tg := telegram.NewBotAPIClient(token)

		_ = tg.AnswerCallbackQuery(ctx, cq.ID, i18n.T(lang, "channel.send_text_prompt"), false)

		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{
						"text":          i18n.T(lang, "channel.cancel_btn"),
						"callback_data": fmt.Sprintf("cancel_edit:%s", pendingIDStr),
					},
				},
			},
		}

		instruction := i18n.T(lang, "channel.edit_text_instruction")
		_, _ = tg.SendMessageWithMarkup(ctx, cq.Message.Chat.ID, instruction, markup, nil)

	} else if strings.HasPrefix(cq.Data, "edit_btn:") {
		userLang := i18n.DetectLanguage(cq.From.LanguageCode)
		if cq.From.ID != bot.OwnerUserID {
			_ = h.moderator.AnswerCallbackQuery(ctx, bot, cq.ID, i18n.T(userLang, "channel.owner_only_error"), true)
			return
		}
		parts := strings.Split(cq.Data, ":")
		if len(parts) < 2 {
			return
		}
		pendingIDStr := parts[1]

		cache := h.moderator.GetCache()
		if cache == nil || cache.Client == nil {
			return
		}

		// Fetch pending draft to check channel language
		lang := userLang
		cacheKey := fmt.Sprintf("pending_post:%s", pendingIDStr)
		pendingVal, err := cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var pending repository.PendingPost
			if json.Unmarshal([]byte(pendingVal), &pending) == nil {
				settings, err := h.channelService.GetChannelSettingsDirect(ctx, pending.ChannelID)
				if err == nil && settings != nil {
					var general struct {
						Language string `json:"language"`
					}
					if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
						lang = general.Language
					}
				}
			}
		}

		// Set user edit buttons state
		stateKey := fmt.Sprintf("edit_btn_state:%d", cq.From.ID)
		_ = cache.Client.Set(ctx, stateKey, pendingIDStr, 10*time.Minute).Err()

		token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		if err != nil {
			return
		}
		tg := telegram.NewBotAPIClient(token)

		_ = tg.AnswerCallbackQuery(ctx, cq.ID, i18n.T(lang, "channel.send_btn_prompt"), false)

		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{
						"text":          i18n.T(lang, "channel.cancel_btn"),
						"callback_data": fmt.Sprintf("cancel_edit:%s", pendingIDStr),
					},
				},
			},
		}

		instruction := i18n.T(lang, "channel.edit_btn_instruction")
		_, _ = tg.SendMessageWithMarkup(ctx, cq.Message.Chat.ID, instruction, markup, nil)

	} else if strings.HasPrefix(cq.Data, "cancel_edit:") {
		userLang := i18n.DetectLanguage(cq.From.LanguageCode)
		if cq.From.ID != bot.OwnerUserID {
			_ = h.moderator.AnswerCallbackQuery(ctx, bot, cq.ID, i18n.T(userLang, "channel.owner_only_error"), true)
			return
		}
		parts := strings.Split(cq.Data, ":")
		if len(parts) < 2 {
			return
		}
		pendingIDStr := parts[1]

		cache := h.moderator.GetCache()
		if cache != nil && cache.Client != nil {
			cache.Client.Del(ctx, fmt.Sprintf("edit_state:%d", cq.From.ID))
			cache.Client.Del(ctx, fmt.Sprintf("edit_btn_state:%d", cq.From.ID))
		}

		// Fetch pending draft to check channel language
		lang := userLang
		cacheKey := fmt.Sprintf("pending_post:%s", pendingIDStr)
		pendingVal, err := cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var pending repository.PendingPost
			if json.Unmarshal([]byte(pendingVal), &pending) == nil {
				settings, err := h.channelService.GetChannelSettingsDirect(ctx, pending.ChannelID)
				if err == nil && settings != nil {
					var general struct {
						Language string `json:"language"`
					}
					if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
						lang = general.Language
					}
				}
			}
		}

		token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		if err == nil {
			tg := telegram.NewBotAPIClient(token)
			_ = tg.AnswerCallbackQuery(ctx, cq.ID, i18n.T(lang, "channel.edit_cancelled"), false)
			_ = tg.DeleteMessage(ctx, cq.Message.Chat.ID, cq.Message.MessageID)
		}
	}
}

func truncateButtonText(s string, maxRunes int) string {
	runes := []rune(s)
	if len(runes) > maxRunes {
		return string(runes[:maxRunes-1]) + "…"
	}
	return s
}

func (h *WebhookHandler) buildChannelInlineKeyboard(ctx context.Context, channelID uuid.UUID, telegramMessageID int64) (interface{}, error) {
	buttons, err := h.channelService.GetChannelButtonsWithCounts(ctx, channelID, telegramMessageID)
	if err != nil {
		return nil, err
	}
	if len(buttons) == 0 {
		return nil, nil
	}

	var row []InlineKeyboardButton
	for _, btn := range buttons {
		if btn.ID != uuid.Nil && !btn.IsActive {
			continue
		}
		text := ""
		if btn.Emoji != "" {
			text += btn.Emoji + " "
		}
		text += btn.Title
		if btn.Type == "counter" && btn.ClickCount > 0 {
			text += fmt.Sprintf(" (%d)", btn.ClickCount)
		}

		ikb := InlineKeyboardButton{
			Text: truncateButtonText(text, 64),
		}
		if btn.Style != "" && btn.Style != "default" {
			ikb.Style = btn.Style
		}

		switch btnType := strings.ToLower(btn.Type); btnType {
		case "url", "share":
			if btnType == "share" && (btn.Value == "" || btn.Value == "share") {
				ikb.URL = "https://t.me/share/url?url="
			} else {
				uStr := strings.TrimSpace(btn.Value)
				if !strings.HasPrefix(uStr, "http://") && !strings.HasPrefix(uStr, "https://") && !strings.HasPrefix(uStr, "tg://") {
					uStr = "https://" + uStr
				}
				ikb.URL = uStr
			}
		case "payment":
			if strings.HasPrefix(btn.Value, "http://") || strings.HasPrefix(btn.Value, "https://") || strings.HasPrefix(btn.Value, "tg://") {
				ikb.URL = btn.Value
			} else {
				ikb.CallbackData = fmt.Sprintf("btn_click:%s", btn.ID.String())
			}
		default:
			ikb.CallbackData = fmt.Sprintf("btn_click:%s", btn.ID.String())
		}
		row = append(row, ikb)
	}

	if len(row) == 0 {
		return nil, nil
	}

	var keyboard [][]InlineKeyboardButton
	for i := 0; i < len(row); i += 2 {
		end := i + 2
		if end > len(row) {
			end = len(row)
		}
		keyboard = append(keyboard, row[i:end])
	}

	return InlineKeyboardMarkup{InlineKeyboard: keyboard}, nil
}

func buildReplyMarkupFromButtons(buttons []repository.ChannelInlineButton) interface{} {
	if len(buttons) == 0 {
		return nil
	}
	var row []InlineKeyboardButton
	for _, btn := range buttons {
		if btn.ID != uuid.Nil && !btn.IsActive {
			continue
		}
		text := ""
		if btn.Emoji != "" {
			text += btn.Emoji + " "
		}
		text += btn.Title

		ikb := InlineKeyboardButton{
			Text: truncateButtonText(text, 64),
		}
		if btn.Style != "" && btn.Style != "default" {
			ikb.Style = btn.Style
		}

		switch btnType := strings.ToLower(btn.Type); btnType {
		case "url", "share":
			if btnType == "share" && (btn.Value == "" || btn.Value == "share") {
				ikb.URL = "https://t.me/share/url?url="
			} else {
				uStr := strings.TrimSpace(btn.Value)
				if !strings.HasPrefix(uStr, "http://") && !strings.HasPrefix(uStr, "https://") && !strings.HasPrefix(uStr, "tg://") {
					uStr = "https://" + uStr
				}
				ikb.URL = uStr
			}
		case "payment":
			if strings.HasPrefix(btn.Value, "http://") || strings.HasPrefix(btn.Value, "https://") || strings.HasPrefix(btn.Value, "tg://") {
				ikb.URL = btn.Value
			} else {
				ikb.CallbackData = fmt.Sprintf("btn_click:%s", btn.ID.String())
			}
		default:
			ikb.CallbackData = fmt.Sprintf("btn_click:%s", btn.ID.String())
		}
		row = append(row, ikb)
	}

	if len(row) == 0 {
		return nil
	}

	var keyboard [][]InlineKeyboardButton
	for i := 0; i < len(row); i += 2 {
		end := i + 2
		if end > len(row) {
			end = len(row)
		}
		keyboard = append(keyboard, row[i:end])
	}

	return InlineKeyboardMarkup{InlineKeyboard: keyboard}
}

func (h *WebhookHandler) getForwardID(m *Message) int64 {
	if m.ForwardFromChat != nil {
		return m.ForwardFromChat.ID
	}
	if m.ForwardFrom != nil {
		return m.ForwardFrom.ID
	}
	return 0
}

func (h *WebhookHandler) handleJoinCaptcha(ctx context.Context, bot *repository.ManagedBot, m *Message, user *User) bool {
	group, err := h.botRepo.GetGroup(ctx, bot.ID, m.Chat.ID)
	if err != nil {
		return false
	}

	settings, _ := h.moderator.GetSettings(ctx, group.ID)
	if settings == nil {
		return false
	}

	var mm repository.SettingsMandatoryMembership
	var general repository.SettingsGeneral
	json.Unmarshal(settings.MandatoryMembership, &mm)
	json.Unmarshal(settings.General, &general)

	if !mm.VerificationEnabled && !general.VerifyMembers {
		return false
	}

	bot, _ = h.botRepo.GetBotByID(ctx, group.BotID)
	tg, _ := h.moderator.GetTelegramClient(ctx, bot)

	if perms, errPerm := h.getBotPermissionsCached(ctx, tg, m.Chat.ID, bot.BotID); errPerm == nil && !perms.CanRestrictMembers {
		slog.Warn("Bot lacks can_restrict_members permission to restrict member for captcha", "chat_id", m.Chat.ID)
		return false
	}

	// 1. Restrict member
	_ = tg.RestrictChatMember(ctx, m.Chat.ID, user.ID, 0)

	// Detect language from group settings
	lang := "en"
	if general.Language != "" {
		lang = general.Language
	}

	btnText := i18n.T(lang, "captcha.verify_button")
	if btnText == "" || btnText == "captcha.verify_button" {
		btnText = "✅ I am not a robot"
	}

	// 2. Send Captcha
	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{{
				"text":          btnText,
				"callback_data": fmt.Sprintf("captcha:%d", user.ID),
			}},
		},
	}

	welcome := i18n.T(lang, "captcha.welcome_msg", map[string]interface{}{"name": user.FirstName, "id": user.ID})
	if welcome == "" || welcome == "captcha.welcome_msg" {
		welcome = fmt.Sprintf(`👋 Welcome <a href="tg://user?id=%d">%s</a>!

Please click the button below to verify you are human.`, user.ID, telegram.EscapeHTML(user.FirstName))
	}

	cache := h.moderator.GetCache()
	var pendingKey string
	if cache != nil && cache.Client != nil {
		pendingKey = fmt.Sprintf("captcha_pending:%d:%d", m.Chat.ID, user.ID)
		// Pre-set placeholder to prevent race condition if clicked instantly
		cache.Client.Set(ctx, pendingKey, "pending", 10*time.Minute)
	}

	var sendErr error
	var captchaMsgID string
	var isEphemeral bool

	if general.EphemeralCaptcha || general.EphemeralAll {
		isEphemeral = true
		epMsg, err := tg.SendEphemeralMessageWithMarkup(ctx, m.Chat.ID, user.ID, welcome, markup, m.MessageThreadID)
		sendErr = err
		if err == nil && epMsg != nil {
			captchaMsgID = epMsg.EphemeralMessageID.String()
		}
	} else {
		captchaMsg, err := tg.SendMessageWithMarkup(ctx, m.Chat.ID, welcome, markup, m.MessageThreadID)
		sendErr = err
		if err == nil && captchaMsg != nil {
			captchaMsgID = fmt.Sprintf("%d", captchaMsg.MessageID)
		}
	}

	if sendErr == nil && captchaMsgID != "" && cache != nil && cache.Client != nil {
		// Only update if the key still exists (meaning the user hasn't solved it yet)
		redisVal := fmt.Sprintf("public:%s", captchaMsgID)
		if isEphemeral {
			redisVal = fmt.Sprintf("ephemeral:%s", captchaMsgID)
		}
		updated, _ := cache.Client.SetXX(ctx, pendingKey, redisVal, 10*time.Minute).Result()
		if updated {
			time.AfterFunc(5*time.Minute, func() {
				bgCtx := context.Background()
				val, err := cache.Client.Get(bgCtx, pendingKey).Result()
				if err == nil && val == redisVal {
					tgClient, err := h.moderator.GetTelegramClient(bgCtx, bot)
					if err == nil {
						_ = tgClient.BanChatMember(bgCtx, m.Chat.ID, user.ID, time.Now().Add(30*time.Second).Unix(), false)
						_ = tgClient.UnbanChatMember(bgCtx, m.Chat.ID, user.ID, true)
						if isEphemeral {
							_ = tgClient.DeleteEphemeralMessage(bgCtx, m.Chat.ID, captchaMsgID)
						} else {
							if msgIDInt, convErr := strconv.Atoi(captchaMsgID); convErr == nil {
								_ = tgClient.DeleteMessage(bgCtx, m.Chat.ID, msgIDInt)
							}
						}
					}
					cache.Client.Del(bgCtx, pendingKey)
				}
			})
		}
	}
	return true
}

// HandleTonAPIWebhook handles webhooks from TonAPI console for ownership or other events
func (h *WebhookHandler) HandleTonAPIWebhook(w http.ResponseWriter, r *http.Request) {
	// Read raw body for HMAC verification
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	// Restore body
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
		// Compute HMAC SHA256
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

func (h *WebhookHandler) adminInfo(ctx context.Context, tg *telegram.BotAPIClient, m *Message, lang string, group *repository.ManagedGroup, bot *repository.ManagedBot) bool {
	expiryStr := "Never"
	if group.SubscriptionStatus == "trial" {
		expiryStr = group.TrialEndsAt.Format("2006-01-02 15:04")
	} else if group.SubscriptionStatus == "paid" && group.PaidUntil != nil {
		expiryStr = group.PaidUntil.Format("2006-01-02 15:04")
	} else if group.SubscriptionStatus == "expired" {
		expiryStr = "Expired"
	}

	var infoText string
	if lang == "fa" {
		infoText = fmt.Sprintf(
			"ℹ️ *اطلاعات گروه:*\n\n"+
				"👥 نام گروه: `%s`\n"+
				"🆔 شناسه گروه: `%d`\n"+
				"🤖 ربات مدیریت: @%s\n"+
				"💳 وضعیت اشتراک: *%s*\n"+
				"⏰ تاریخ انقضا: `%s`\n"+
				"📊 تعداد اعضا: `%d`",
			group.ChatTitle, group.ChatID, bot.BotUsername, group.SubscriptionStatus, expiryStr, group.MembersCount,
		)
	} else {
		infoText = fmt.Sprintf(
			"ℹ️ *Group Information:*\n\n"+
				"👥 Group Title: `%s`\n"+
				"🆔 Chat ID: `%d`\n"+
				"🤖 Bot: @%s\n"+
				"💳 Subscription: *%s*\n"+
				"⏰ Expires At: `%s`\n"+
				"📊 Members Count: `%d`",
			group.ChatTitle, group.ChatID, bot.BotUsername, group.SubscriptionStatus, expiryStr, group.MembersCount,
		)
	}

	var general repository.SettingsGeneral
	if settings, err := h.moderator.GetSettings(ctx, group.ID); err == nil && settings != nil {
		json.Unmarshal(settings.General, &general)
	}

	if m.From != nil && (general.EphemeralAdminCmd || general.EphemeralAll) {
		h.sendEphemeralBotMessage(ctx, tg, m.Chat.ID, m.From.ID, infoText, nil, m.MessageThreadID, general)
	} else {
		_ = tg.SendMessage(ctx, m.Chat.ID, infoText, &m.MessageID, m.MessageThreadID)
	}
	return true
}

func (h *WebhookHandler) adminStats(ctx context.Context, tg *telegram.BotAPIClient, m *Message, lang string, group *repository.ManagedGroup) bool {
	analyticsRepo := h.moderator.GetAnalyticsRepo()
	if analyticsRepo == nil {
		return false
	}
	summary, err := analyticsRepo.GetSummary(ctx, group.ID, 7)
	if err != nil {
		slog.Error("Failed to get analytics summary for command", "error", err)
		return false
	}

	var statsText string
	if lang == "fa" {
		statsText = fmt.Sprintf(
			"📊 *آمار گروه در ۷ روز گذشته:*\n\n"+
				"💬 تعداد پیام‌ها: `%d`\n"+
				"➕ اعضای جدید: `%d`\n"+
				"➖ اعضای خارج شده: `%d`\n"+
				"🚫 اسپم‌های مسدود شده: `%d`\n"+
				"👥 کاربران فعال: `%d`",
			summary.TotalMessages, summary.NewMembers, summary.MembersLeft, summary.SpamBlocked, summary.ActiveUsers,
		)
	} else {
		statsText = fmt.Sprintf(
			"📊 *Group Stats (Last 7 Days):*\n\n"+
				"💬 Total Messages: `%d`\n"+
				"➕ New Members: `%d`\n"+
				"➖ Members Left: `%d`\n"+
				"🚫 Spam Blocked: `%d`\n"+
				"👥 Active Users: `%d`",
			summary.TotalMessages, summary.NewMembers, summary.MembersLeft, summary.SpamBlocked, summary.ActiveUsers,
		)
	}

	var general repository.SettingsGeneral
	if settings, err := h.moderator.GetSettings(ctx, group.ID); err == nil && settings != nil {
		json.Unmarshal(settings.General, &general)
	}

	if m.From != nil && (general.EphemeralAdminCmd || general.EphemeralAll) {
		h.sendEphemeralBotMessage(ctx, tg, m.Chat.ID, m.From.ID, statsText, nil, m.MessageThreadID, general)
	} else {
		_ = tg.SendMessage(ctx, m.Chat.ID, statsText, &m.MessageID, m.MessageThreadID)
	}
	return true
}

func (h *WebhookHandler) adminClean(ctx context.Context, tg *telegram.BotAPIClient, m *Message, lang string) bool {
	parts := strings.Fields(m.Text)
	n := 10
	if len(parts) > 1 {
		if val, err := strconv.Atoi(parts[1]); err == nil && val > 0 {
			n = val
		}
	}
	if n > 100 {
		n = 100
	}

	cache := h.moderator.GetCache()
	if cache != nil && cache.Client != nil {
		cleanKey := fmt.Sprintf("clean_lock:%d", m.Chat.ID)
		locked, err := cache.Client.SetNX(ctx, cleanKey, "active", 2*time.Minute).Result()
		if err == nil && !locked {
			msg := "⚠️ یک فرآیند پاکسازی در حال حاضر برای این گروه فعال است. لطفاً شکیبا باشید."
			if lang != "fa" {
				msg = "⚠️ A cleanup process is already active for this group. Please wait."
			}
			_ = tg.SendMessage(ctx, m.Chat.ID, msg, &m.MessageID, m.MessageThreadID)
			return true
		}
	}

	_ = tg.DeleteMessage(ctx, m.Chat.ID, m.MessageID)

	GoSafe(func() {
		bgCtx := context.Background()
		if cache != nil && cache.Client != nil {
			defer cache.Client.Del(bgCtx, fmt.Sprintf("clean_lock:%d", m.Chat.ID))
		}

		var msgIDs []int
		for i := 1; i <= n; i++ {
			msgIDs = append(msgIDs, m.MessageID-i)
		}

		errDel := tg.DeleteMessages(bgCtx, m.Chat.ID, msgIDs)
		if errDel != nil {
			for _, msgID := range msgIDs {
				_ = tg.DeleteMessage(bgCtx, m.Chat.ID, msgID)
				time.Sleep(35 * time.Millisecond)
			}
		}

		successMsg := "🧹 Cleaned %d messages."
		if lang == "fa" {
			successMsg = "🧹 تعداد %d پیام پاکسازی شد."
		}
		res, err := tg.SendMessageWithResult(bgCtx, m.Chat.ID, fmt.Sprintf(successMsg, n), nil, m.MessageThreadID)
		if err == nil && res != nil {
			time.Sleep(5 * time.Second)
			_ = tg.DeleteMessage(bgCtx, m.Chat.ID, res.MessageID)
		}
	})

	return true
}

func (h *WebhookHandler) adminDebug(ctx context.Context, bot *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, lang string, group *repository.ManagedGroup) bool {
	startTime := time.Unix(int64(m.Date), 0)
	latency := time.Since(startTime).Milliseconds()
	if latency < 0 {
		latency = 0
	}

	// 1. Check DB Health
	dbStatus := "✅ Connected"
	if err := h.db.Pool.Ping(ctx); err != nil {
		dbStatus = fmt.Sprintf("❌ Error: %v", err)
	}

	// 2. Check Cache Health
	cacheStatus := "✅ Active"
	cache := h.moderator.GetCache()
	if cache == nil || cache.Client == nil {
		cacheStatus = "❌ Nil"
	} else if err := cache.Client.Ping(ctx).Err(); err != nil {
		cacheStatus = fmt.Sprintf("❌ Error: %v", err)
	}

	// 3. Check Bot Permissions
	botPerms, errPerms := h.getBotPermissionsCached(ctx, tg, m.Chat.ID, bot.BotID)
	permsStr := "⚠️ Unknown"
	if errPerms == nil && botPerms != nil {
		del := "❌"
		if botPerms.CanDeleteMessages {
			del = "✅"
		}
		res := "❌"
		if botPerms.CanRestrictMembers {
			res = "✅"
		}
		pin := "❌"
		if botPerms.CanPinMessages {
			pin = "✅"
		}
		inv := "❌"
		if botPerms.CanInviteUsers {
			inv = "✅"
		}
		permsStr = fmt.Sprintf("Del: %s | Restrict: %s | Pin: %s | Invite: %s", del, res, pin, inv)
	}

	// 4. Group Protection Settings Summary
	var gen repository.SettingsGeneral
	var cont repository.SettingsContentRestrictions
	var quiet repository.SettingsQuietHours
	var mand repository.SettingsMandatoryMembership
	settings, errSet := h.moderator.GetSettings(ctx, group.ID)
	if errSet == nil && settings != nil {
		_ = json.Unmarshal(settings.General, &gen)
		_ = json.Unmarshal(settings.ContentRestrictions, &cont)
		_ = json.Unmarshal(settings.QuietHours, &quiet)
		_ = json.Unmarshal(settings.MandatoryMembership, &mand)
	}

	linkFilt := "Off"
	if cont.RemoveLinks.Enabled {
		linkFilt = "On"
	}
	casFilt := "Off"
	if gen.CasEnabled {
		casFilt = "On"
	}
	quietFilt := "Off"
	if quiet.EmergencyLock {
		quietFilt = "Locked"
	} else if len(quiet.Periods) > 0 {
		quietFilt = "Active"
	}
	fjFilt := "Off"
	if mand.ForceJoinEnabled {
		fjFilt = "On"
	}
	ephFilt := "Off"
	if gen.EphemeralAll || gen.EphemeralAdminCmd || gen.EphemeralWarnings {
		ephFilt = fmt.Sprintf("%ds", gen.AutoDeleteDelay)
	}

	var debugText string
	if lang == "fa" {
		debugText = fmt.Sprintf(
			"🛠 <b>وضعیت سیستم و عیب‌یابی (iFragment Debug):</b>\n\n"+
				"🖥 <b>سلامت زیرساخت:</b>\n"+
				"• دیتابیس (PostgreSQL): %s\n"+
				"• ردیس (DragonflyDB): %s\n"+
				"• تاخیر شبکه (Latency): <code>%dms</code>\n\n"+
				"🤖 <b>دسترسی‌های ربات:</b>\n"+
				"• ربات: @%s (ID: <code>%d</code>)\n"+
				"• دسترسی‌ها: %s\n\n"+
				"🛡 <b>تنظیمات امنیتی فعال:</b>\n"+
				"• فیلتر لینک: <code>%s</code> | آنتی‌اسپم CAS: <code>%s</code>\n"+
				"• حالت سکوت/قفل: <code>%s</code> | جوین اجباری: <code>%s</code>\n"+
				"• پیام موقت (Ephemeral): <code>%s</code>\n\n"+
				"📊 <b>وضعیت گروه:</b>\n"+
				"• شناسه چت: <code>%d</code>\n"+
				"• اشتراک: <b>%s</b>",
			dbStatus, cacheStatus, latency,
			bot.BotUsername, bot.BotID, permsStr,
			linkFilt, casFilt, quietFilt, fjFilt, ephFilt,
			group.ChatID, group.SubscriptionStatus,
		)
	} else {
		debugText = fmt.Sprintf(
			"🛠 <b>System Diagnostics (iFragment Debug):</b>\n\n"+
				"🖥 <b>Infrastructure Health:</b>\n"+
				"• PostgreSQL DB: %s\n"+
				"• DragonflyDB / Redis: %s\n"+
				"• Network Latency: <code>%dms</code>\n\n"+
				"🤖 <b>Bot Permissions:</b>\n"+
				"• Bot: @%s (ID: <code>%d</code>)\n"+
				"• Permissions: %s\n\n"+
				"🛡 <b>Active Security Filters:</b>\n"+
				"• Link Filter: <code>%s</code> | CAS: <code>%s</code>\n"+
				"• Quiet/Lock: <code>%s</code> | ForceJoin: <code>%s</code>\n"+
				"• Ephemeral Mode: <code>%s</code>\n\n"+
				"📊 <b>Group State:</b>\n"+
				"• Chat ID: <code>%d</code>\n"+
				"• Subscription: <b>%s</b>",
			dbStatus, cacheStatus, latency,
			bot.BotUsername, bot.BotID, permsStr,
			linkFilt, casFilt, quietFilt, fjFilt, ephFilt,
			group.ChatID, group.SubscriptionStatus,
		)
	}

	var general repository.SettingsGeneral
	if settings != nil {
		_ = json.Unmarshal(settings.General, &general)
	}

	if m.From != nil && (general.EphemeralAdminCmd || general.EphemeralAll) {
		h.sendEphemeralBotMessage(ctx, tg, m.Chat.ID, m.From.ID, debugText, nil, m.MessageThreadID, general)
	} else {
		_ = tg.SendMessage(ctx, m.Chat.ID, debugText, &m.MessageID, m.MessageThreadID)
	}
	return true
}

func buildCustomInlineMarkup(buttons []repository.InlineButton, existingMarkup map[string]interface{}) map[string]interface{} {
	if len(buttons) == 0 {
		return existingMarkup
	}
	var inlineKeyboard [][]map[string]interface{}
	if existingMarkup != nil {
		if rawKb, ok := existingMarkup["inline_keyboard"]; ok {
			if existingRows, ok := rawKb.([][]map[string]interface{}); ok {
				inlineKeyboard = append(inlineKeyboard, existingRows...)
			}
		}
	}
	var currentRow []map[string]interface{}
	for _, btn := range buttons {
		if btn.Title == "" || btn.URL == "" {
			continue
		}
		ikb := map[string]interface{}{
			"text": btn.Title,
			"url":  btn.URL,
		}
		if len(btn.Title) > 20 {
			if len(currentRow) > 0 {
				inlineKeyboard = append(inlineKeyboard, currentRow)
				currentRow = nil
			}
			inlineKeyboard = append(inlineKeyboard, []map[string]interface{}{ikb})
		} else {
			currentRow = append(currentRow, ikb)
			if len(currentRow) == 2 {
				inlineKeyboard = append(inlineKeyboard, currentRow)
				currentRow = nil
			}
		}
	}
	if len(currentRow) > 0 {
		inlineKeyboard = append(inlineKeyboard, currentRow)
	}
	if len(inlineKeyboard) == 0 {
		return existingMarkup
	}
	return map[string]interface{}{
		"inline_keyboard": inlineKeyboard,
	}
}

func (h *WebhookHandler) sendBotMessage(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, text string, replyMarkup map[string]interface{}, threadID *int, general repository.SettingsGeneral) {
	if tg == nil {
		slog.Error("sendBotMessage: telegram client is nil")
		return
	}
	var msg *telegram.MessageResult
	var err error
	if replyMarkup != nil {
		msg, err = tg.SendMessageWithMarkup(ctx, chatID, text, replyMarkup, threadID)
		if err != nil {
			slog.Error("Failed to send bot message with markup", "error", err, "chatID", chatID, "text", text)
			if strings.Contains(err.Error(), "parse") || strings.Contains(err.Error(), "entity") {
				slog.Info("Retrying message with markup in plain text mode", "chatID", chatID)
				msg, err = tg.SendMessageWithMarkup(ctx, chatID, text, replyMarkup, threadID, "")
				if err != nil {
					slog.Error("Failed to send bot message with markup in plain text mode too", "error", err, "chatID", chatID)
				}
			}
		}
	} else {
		msg, err = tg.SendMessageWithResult(ctx, chatID, text, nil, threadID)
		if err != nil {
			slog.Error("Failed to send bot message", "error", err, "chatID", chatID, "text", text)
			if strings.Contains(err.Error(), "parse") || strings.Contains(err.Error(), "entity") {
				slog.Info("Retrying message in plain text mode", "chatID", chatID)
				msg, err = tg.SendMessageWithResult(ctx, chatID, text, nil, threadID, "")
				if err != nil {
					slog.Error("Failed to send bot message in plain text mode too", "error", err, "chatID", chatID)
				}
			}
		}
	}

	if err == nil && msg != nil && (general.AutoDeleteBot || general.EphemeralAll) {
		delaySeconds := general.AutoDeleteDelay
		if delaySeconds <= 0 {
			delaySeconds = 15
		}
		time.AfterFunc(time.Duration(delaySeconds)*time.Second, func() {
			_ = tg.DeleteMessage(context.Background(), chatID, msg.MessageID)
		})
	}
}

func (h *WebhookHandler) sendEphemeralBotMessage(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, receiverUserID int64, text string, replyMarkup map[string]interface{}, threadID *int, general repository.SettingsGeneral) {
	if tg == nil {
		slog.Error("sendEphemeralBotMessage: telegram client is nil")
		return
	}
	var err error
	var epMsg *telegram.EphemeralMessageResult

	if replyMarkup != nil {
		epMsg, err = tg.SendEphemeralMessageWithMarkup(ctx, chatID, receiverUserID, text, replyMarkup, threadID)
		if err != nil {
			slog.Error("Failed to send ephemeral message with markup", "error", err, "chatID", chatID, "receiverUserID", receiverUserID)
			if strings.Contains(err.Error(), "parse") || strings.Contains(err.Error(), "entity") {
				slog.Info("Retrying ephemeral message with markup in plain text mode", "chatID", chatID, "receiverUserID", receiverUserID)
				epMsg, err = tg.SendEphemeralMessageWithMarkup(ctx, chatID, receiverUserID, text, replyMarkup, threadID, "")
			}
		}
	} else {
		epMsg, err = tg.SendEphemeralMessage(ctx, chatID, receiverUserID, text, threadID)
		if err != nil {
			slog.Error("Failed to send ephemeral message", "error", err, "chatID", chatID, "receiverUserID", receiverUserID)
			if strings.Contains(err.Error(), "parse") || strings.Contains(err.Error(), "entity") {
				slog.Info("Retrying ephemeral message in plain text mode", "chatID", chatID, "receiverUserID", receiverUserID)
				epMsg, err = tg.SendEphemeralMessage(ctx, chatID, receiverUserID, text, threadID, "")
			}
		}
	}
	if err != nil {
		slog.Error("Ephemeral message failed after retry, falling back to public message", "error", err, "chatID", chatID, "receiverUserID", receiverUserID)
		h.sendBotMessage(ctx, tg, chatID, text, replyMarkup, threadID, general)
		return
	}

	if epMsg != nil && epMsg.EphemeralMessageID.String() != "" {
		epIDStr := epMsg.EphemeralMessageID.String()
		delaySeconds := general.AutoDeleteDelay
		if delaySeconds <= 0 {
			delaySeconds = 60
		}
		slog.Info("Scheduling auto-delete for ephemeral message", "chatID", chatID, "ephemeralMessageID", epIDStr, "receiverUserID", receiverUserID, "delaySeconds", delaySeconds)
		time.AfterFunc(time.Duration(delaySeconds)*time.Second, func() {
			bgCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			errDel := tg.DeleteEphemeralMessage(bgCtx, chatID, epIDStr, receiverUserID)
			if errDel != nil {
				slog.Error("Failed to auto-delete ephemeral message", "error", errDel, "chatID", chatID, "ephemeralMessageID", epIDStr, "receiverUserID", receiverUserID)
			} else {
				slog.Info("Successfully auto-deleted ephemeral message", "chatID", chatID, "ephemeralMessageID", epIDStr)
			}
		})
	}
}

func (h *WebhookHandler) handleChannelPost(ctx context.Context, bot *repository.ManagedBot, m *Message, isEdit bool) {
	if m == nil || m.Chat == nil {
		return
	}
	slog.Info("Processing channel post", "chat_id", m.Chat.ID, "message_id", m.MessageID, "is_edit", isEdit)

	text := m.Text
	if text == "" {
		text = m.Caption
	}

	// Intercept for Channel Funnel System
	if !isEdit {
		var mediaItems []repository.FunnelMediaItem
		if len(m.Photo) > 0 {
			if photoMap, ok := m.Photo[len(m.Photo)-1].(map[string]interface{}); ok {
				if fileID, ok := photoMap["file_id"].(string); ok {
					mediaItems = append(mediaItems, repository.FunnelMediaItem{
						FileID: fileID,
						Type:   "photo",
					})
				}
			}
		} else if m.Video != nil {
			var videoMap map[string]interface{}
			videoBytes, _ := json.Marshal(m.Video)
			if json.Unmarshal(videoBytes, &videoMap) == nil {
				if fileID, ok := videoMap["file_id"].(string); ok {
					mediaItems = append(mediaItems, repository.FunnelMediaItem{
						FileID: fileID,
						Type:   "video",
					})
				}
			}
		} else if m.Document != nil {
			var docMap map[string]interface{}
			docBytes, _ := json.Marshal(m.Document)
			if json.Unmarshal(docBytes, &docMap) == nil {
				if fileID, ok := docMap["file_id"].(string); ok {
					mediaItems = append(mediaItems, repository.FunnelMediaItem{
						FileID: fileID,
						Type:   "document",
					})
				}
			}
		} else if m.Audio != nil {
			var audioMap map[string]interface{}
			audioBytes, _ := json.Marshal(m.Audio)
			if json.Unmarshal(audioBytes, &audioMap) == nil {
				if fileID, ok := audioMap["file_id"].(string); ok {
					mediaItems = append(mediaItems, repository.FunnelMediaItem{
						FileID: fileID,
						Type:   "audio",
					})
				}
			}
		}

		var authorID *int64
		var authorName string
		if m.From != nil {
			authorID = &m.From.ID
			authorName = m.From.FirstName
			if m.From.Username != "" {
				authorName = authorName + " (@" + m.From.Username + ")"
			}
		} else if m.AuthorSignature != "" {
			authorName = m.AuthorSignature
		}

		handled, funnelErr := h.channelService.ProcessChannelPostForFunnel(ctx, bot, m.Chat.ID, m.MessageID, text, mediaItems, m.MediaGroupID, m.ReplyMarkup, authorID, authorName)
		if funnelErr == nil && handled {
			slog.Info("Post handled by Funnel System; stopping normal pipeline execution", "chat_id", m.Chat.ID, "message_id", m.MessageID)
			return
		}
	}

	if isEdit && h.db != nil && h.db.Pool != nil {
		query := `UPDATE channel_posts cp 
		          SET text = $1, has_media = $2
		          FROM managed_channels mc 
		          WHERE mc.id = cp.channel_id AND mc.chat_id = $3 AND cp.telegram_message_id = $4`
		_, err := h.db.Pool.Exec(ctx, query, text, len(m.Photo) > 0 || m.Video != nil || m.Document != nil, m.Chat.ID, m.MessageID)
		if err != nil {
			slog.Error("Failed to sync edited channel post in db", "error", err)
		}
	}

	err := h.channelService.ProcessChannelPost(ctx, m.Chat.ID, m.MessageID, text, m.ReplyMarkup, isEdit)
	if err != nil {
		slog.Error("Failed to process channel post in service", "error", err)
	}

}

func (h *WebhookHandler) handleChatJoinRequest(ctx context.Context, bot *repository.ManagedBot, req *ChatJoinRequest) {
	if req == nil {
		return
	}
	slog.Info("Processing chat join request", "chat_id", req.Chat.ID, "user_id", req.From.ID)

	// 0. Enforce Telegram Premium restriction for @FragmentInvestors on join requests
	if botmgmt.IsFragmentInvestorsGroup(req.Chat.Title, req.Chat.Username) {
		if !req.From.IsBot && !req.From.IsPremium {
			slog.Info("Decline join request for @FragmentInvestors: user does not have premium", "user_id", req.From.ID, "chat_id", req.Chat.ID)
			tg, err := h.moderator.GetTelegramClient(ctx, bot)
			if err == nil {
				_ = tg.DeclineChatJoinRequest(ctx, req.Chat.ID, req.From.ID)
				userLang := i18n.DetectLanguage(req.From.LanguageCode)
				rejectMsg := i18n.T(userLang, "channel.join_request_rejected_premium", map[string]interface{}{"channel": req.Chat.Title})
				if rejectMsg == "" || rejectMsg == "channel.join_request_rejected_premium" {
					if userLang == "fa" {
						rejectMsg = fmt.Sprintf("⚠️ درخواست عضویت شما در %s به دلیل عدم داشتن اکانت Premium پذیرفته نشد.", req.Chat.Title)
					} else {
						rejectMsg = fmt.Sprintf("⚠️ Your request to join %s was not approved because your account does not have Telegram Premium status.", req.Chat.Title)
					}
				}
				_ = tg.SendMessage(ctx, req.From.ID, rejectMsg, nil, nil)
			}
			return
		}
	}

	// 1. Check if group connection exists in managed_groups
	group, errGroup := h.botRepo.GetGroup(ctx, bot.ID, req.Chat.ID)
	if errGroup == nil && group != nil {
		tg, err := h.moderator.GetTelegramClient(ctx, bot)
		if err != nil {
			return
		}
		settings, _ := h.moderator.GetSettings(ctx, group.ID)
		var mandatory repository.SettingsMandatoryMembership
		if settings != nil {
			_ = json.Unmarshal(settings.MandatoryMembership, &mandatory)
		}

		if mandatory.VerificationEnabled {
			// Send verification button in PV to the user
			userLang := i18n.DetectLanguage(req.From.LanguageCode)
			verifyText := i18n.T(userLang, "verification.pv_prompt", map[string]interface{}{"group": group.ChatTitle})
			if verifyText == "" || verifyText == "verification.pv_prompt" {
				if userLang == "fa" {
					verifyText = fmt.Sprintf("🛡 برای ورود به گروه <b>%s</b>، لطفاً روی دکمه زیر کلیک کنید تا هویت شما تأیید شود:", telegram.EscapeHTML(group.ChatTitle))
				} else {
					verifyText = fmt.Sprintf("🛡 To join <b>%s</b>, please click the button below to verify yourself:", telegram.EscapeHTML(group.ChatTitle))
				}
			}
			btnText := "✅ تأیید و ورود"
			if userLang != "fa" {
				btnText = "✅ Verify & Join"
			}
			markup := map[string]interface{}{
				"inline_keyboard": [][]map[string]interface{}{
					{
						{"text": btnText, "callback_data": fmt.Sprintf("verify_join:%s:%d", group.ID.String(), req.From.ID)},
					},
				},
			}
			_, _ = tg.SendMessageWithMarkup(ctx, req.From.ID, verifyText, markup, nil, "HTML")
			return
		}

		// Auto approve if verification is not enabled
		_ = tg.ApproveChatJoinRequest(ctx, req.Chat.ID, req.From.ID)
		return
	}

	// 2. Verify channel connection exists in managed_channels
	ch, err := h.channelService.GetChannelByChatID(ctx, req.Chat.ID)
	if err != nil || ch == nil {
		slog.Warn("Chat join request ignored: chat is not managed", "chat_id", req.Chat.ID)
		return
	}

	// 3. Fetch channel settings via Service layer to check active policies
	settings, err := h.channelService.GetChannelSettingsDirect(ctx, ch.ID)
	if err != nil {
		slog.Error("Failed to fetch general settings for join request validation", "channel_id", ch.ID, "error", err)
		return
	}

	var config struct {
		JoinRequestsEnabled bool `json:"joinRequestsEnabled"`
		ApprovePremium      bool `json:"approvePremium"`
		ApproveGifts        bool `json:"approveGifts"`
		ApproveProfilePhoto bool `json:"approveProfilePhoto"`
	}
	_ = json.Unmarshal(settings.General, &config)

	// If auto-join requests processing is not active, do not auto-approve
	if !config.JoinRequestsEnabled {
		slog.Info("Auto-join requests are disabled for channel settings, keeping for manual review", "channel_id", ch.ID)
		return
	}

	// 3. Evaluate active join policies
	shouldApprove := true
	reason := ""

	if config.ApprovePremium && !req.From.IsPremium {
		shouldApprove = false
		reason = "premium"
		slog.Info("Failed join request auto-approval check: user does not have premium status", "user_id", req.From.ID, "channel_id", ch.ID)
	}

	if shouldApprove && config.ApproveProfilePhoto {
		tgClient, err := h.moderator.GetTelegramClient(ctx, bot)
		if err == nil {
			photoURL, _ := tgClient.GetUserProfilePhotoURL(ctx, req.From.ID)
			if photoURL == "" {
				shouldApprove = false
				reason = "photo"
				slog.Info("Failed join request auto-approval check: user does not have a profile photo", "user_id", req.From.ID)
			}
		}
	}

	// Decline or wait for manual evaluation
	if !shouldApprove {
		tg, err := h.moderator.GetTelegramClient(ctx, bot)
		if err == nil {
			_ = tg.DeclineChatJoinRequest(ctx, req.Chat.ID, req.From.ID)
			userLang := i18n.DetectLanguage(req.From.LanguageCode)
			rejectMsg := ""

			switch reason {
			case "premium":
				rejectMsg = i18n.T(userLang, "channel.join_request_rejected_premium", map[string]interface{}{"channel": ch.ChatTitle})
				if rejectMsg == "" || rejectMsg == "channel.join_request_rejected_premium" {
					if userLang == "fa" {
						rejectMsg = fmt.Sprintf("⚠️ درخواست عضویت شما در کانال %s به دلیل عدم داشتن اکانت Premium پذیرفته نشد. لطفاً شرایط کانال را مجدداً بررسی کنید.", ch.ChatTitle)
					} else {
						rejectMsg = fmt.Sprintf("⚠️ Your request to join %s was not approved because your account does not have Telegram Premium status.", ch.ChatTitle)
					}
				}
			case "photo":
				rejectMsg = i18n.T(userLang, "channel.join_request_rejected_photo", map[string]interface{}{"channel": ch.ChatTitle})
				if rejectMsg == "" || rejectMsg == "channel.join_request_rejected_photo" {
					if userLang == "fa" {
						rejectMsg = fmt.Sprintf("⚠️ درخواست عضویت شما در کانال %s پذیرفته نشد زیرا شما تصویر پروفایل ندارید.", ch.ChatTitle)
					} else {
						rejectMsg = fmt.Sprintf("⚠️ Your request to join %s was not approved because you do not have a profile photo.", ch.ChatTitle)
					}
				}
			}
			_ = tg.SendMessage(ctx, req.From.ID, rejectMsg, nil, nil)
		}

		// Log specific event to DB Audit Log for dashboard visibility
		meta, _ := json.Marshal(map[string]interface{}{
			"user_id": req.From.ID,
			"reason":  reason,
		})
		_ = h.channelService.GetChannelRepo().LogAudit(ctx, &repository.ChannelAuditLog{
			ChannelID: ch.ID,
			ActorID:   req.From.ID,
			Action:    "channel.join_request.auto_declined",
			Metadata:  meta,
		})
		return
	}

	tg, err := h.moderator.GetTelegramClient(ctx, bot)
	if err != nil {
		slog.Error("Failed to initialize telegram client for join approval", "error", err)
		return
	}

	err = tg.ApproveChatJoinRequest(ctx, req.Chat.ID, req.From.ID)
	if err != nil {
		slog.Error("Failed to approve chat join request via Bot API", "error", err)
	} else {
		slog.Info("Successfully approved join request automatically based on policies", "chat_id", req.Chat.ID, "user_id", req.From.ID)
	}
}

func GoSafe(fn func()) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("CRITICAL: Recovered from panic in background goroutine",
					"panic", r,
					"stack", string(debug.Stack()),
				)
			}
		}()
		fn()
	}()
}

// logIfErr logs non-nil errors at warn level to avoid silent swallowing.
func logIfErr(err error, msg string, args ...interface{}) {
	if err != nil {
		allArgs := append([]interface{}{"error", err}, args...)
		slog.Warn(msg, allArgs...)
	}
}
