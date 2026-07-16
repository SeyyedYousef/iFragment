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
	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"
	"ifragment-backend/internal/service/channelmgmt"
	"io"
	"log/slog"
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

var telegramUpdatePool = sync.Pool{
	New: func() interface{} {
		return new(TelegramUpdate)
	},
}

type WebhookHandler struct {
	db             *repository.Database
	moderator      *botmgmt.ModeratorService
	botRepo        *repository.BotRepo
	channelService *channelmgmt.ChannelService
	processedJoins sync.Map
}

func NewWebhookHandler(db *repository.Database, moderator *botmgmt.ModeratorService, botRepo *repository.BotRepo, channelService *channelmgmt.ChannelService) *WebhookHandler {
	return &WebhookHandler{
		db:             db,
		moderator:      moderator,
		botRepo:        botRepo,
		channelService: channelService,
	}
}

type TelegramUpdate struct {
	UpdateID          int                `json:"update_id"`
	PreCheckoutQuery  *PreCheckoutQuery  `json:"pre_checkout_query"`
	Message           *Message           `json:"message"`
	EditedMessage     *Message           `json:"edited_message"`
	MyChatMember      *ChatMemberUpdated `json:"my_chat_member"`
	ChatMember        *ChatMemberUpdated `json:"chat_member"`
	CallbackQuery     *CallbackQuery     `json:"callback_query"`
	ChannelPost       *Message           `json:"channel_post"`
	EditedChannelPost *Message           `json:"edited_channel_post"`
	ChatJoinRequest   *ChatJoinRequest   `json:"chat_join_request"`
}

type ChatJoinRequest struct {
	Chat       Chat            `json:"chat"`
	From       User            `json:"from"`
	UserChatID int64           `json:"user_chat_id"`
	Date       int             `json:"date"`
	Bio        string          `json:"bio,omitempty"`
	InviteLink *ChatInviteLink `json:"invite_link,omitempty"`
}

type CallbackQuery struct {
	ID      string   `json:"id"`
	From    User     `json:"from"`
	Message *Message `json:"message"`
	Data    string   `json:"data"`
}

type ChatMemberUpdated struct {
	Chat          Chat            `json:"chat"`
	From          User            `json:"from"`
	Date          int             `json:"date"`
	OldChatMember ChatMember      `json:"old_chat_member"`
	NewChatMember ChatMember      `json:"new_chat_member"`
	InviteLink    *ChatInviteLink `json:"invite_link,omitempty"`
}

type ChatMember struct {
	User   User   `json:"user"`
	Status string `json:"status"`
}

type ChatInviteLink struct {
	InviteLink string `json:"invite_link"`
	Name       string `json:"name,omitempty"`
}

type PreCheckoutQuery struct {
	ID             string `json:"id"`
	InvoicePayload string `json:"invoice_payload"`
	TotalAmount    int    `json:"total_amount"`
	Currency       string `json:"currency"`
	From           *User  `json:"from"`
}

type Chat struct {
	ID    int64  `json:"id"`
	Type  string `json:"type"`
	Title string `json:"title,omitempty"`
}

type Message struct {
	MessageID          int                `json:"message_id"`
	MessageThreadID    *int               `json:"message_thread_id,omitempty"`
	From               *User              `json:"from"`
	Chat               *Chat              `json:"chat"`
	Date               int                `json:"date"`
	Text               string             `json:"text"`
	Caption            string             `json:"caption"`
	Photo              []interface{}      `json:"photo"`
	Sticker            json.RawMessage    `json:"sticker,omitempty"`
	Location           json.RawMessage    `json:"location,omitempty"`
	Audio              json.RawMessage    `json:"audio,omitempty"`
	Voice              json.RawMessage    `json:"voice,omitempty"`
	Document           json.RawMessage    `json:"document,omitempty"`
	Animation          json.RawMessage    `json:"animation,omitempty"`
	Video              json.RawMessage    `json:"video,omitempty"`
	Poll               json.RawMessage    `json:"poll,omitempty"`
	Game               json.RawMessage    `json:"game,omitempty"`
	Entities           []MessageEntity    `json:"entities"`
	CaptionEntities    []MessageEntity    `json:"caption_entities,omitempty"`
	ReplyToMessage     *Message           `json:"reply_to_message"`
	ForwardFrom        *User              `json:"forward_from,omitempty"`
	ForwardFromChat    *Chat              `json:"forward_from_chat"`
	ViaBot             *User              `json:"via_bot"`
	MediaGroupID       string             `json:"media_group_id,omitempty"`
	AuthorSignature    string             `json:"author_signature,omitempty"`
	ReplyMarkup        json.RawMessage    `json:"reply_markup,omitempty"`
	SuccessfulPayment  *SuccessfulPayment `json:"successful_payment"`
	NewChatMembers     []User             `json:"new_chat_members"`
	LeftChatMember     *User              `json:"left_chat_member"`
	IsAutomaticForward bool               `json:"is_automatic_forward,omitempty"`
	SenderChat         *Chat              `json:"sender_chat,omitempty"`
	ReceiverUser       *User                  `json:"receiver_user,omitempty"`
	EphemeralMessageID telegram.FlexibleString `json:"ephemeral_message_id,omitempty"`
}

type MessageEntity struct {
	Type   string `json:"type"`
	Offset int    `json:"offset"`
	Length int    `json:"length"`
	URL    string `json:"url,omitempty"`
}

type BotPermissions struct {
	Status             string `json:"status"`
	CanDeleteMessages  bool   `json:"can_delete_messages"`
	CanRestrictMembers bool   `json:"can_restrict_members"`
	CanPromoteMembers  bool   `json:"can_promote_members"`
	CanChangeInfo      bool   `json:"can_change_info"`
	CanInviteUsers     bool   `json:"can_invite_users"`
	CanPinMessages     bool   `json:"can_pin_messages"`
}

type User struct {
	ID           int64  `json:"id"`
	IsBot        bool   `json:"is_bot"`
	FirstName    string `json:"first_name"`
	Username     string `json:"username,omitempty"`
	LanguageCode string `json:"language_code,omitempty"`
	IsPremium    bool   `json:"is_premium,omitempty"`
}

type SuccessfulPayment struct {
	Currency                string `json:"currency"`
	TotalAmount             int    `json:"total_amount"`
	InvoicePayload          string `json:"invoice_payload"`
	TelegramPaymentChargeID string `json:"telegram_payment_charge_id"`
}

type InlineKeyboardButton struct {
	Text         string `json:"text"`
	URL          string `json:"url,omitempty"`
	CallbackData string `json:"callback_data,omitempty"`
	Style        string `json:"style,omitempty"`
}

type InlineKeyboardMarkup struct {
	InlineKeyboard [][]InlineKeyboardButton `json:"inline_keyboard"`
}

// Central Worker Pool configuration for asynchronous webhook execution
type WebhookJob struct {
	ctx    context.Context
	bot    *repository.ManagedBot
	update *TelegramUpdate
}

var (
	jobQueue   chan WebhookJob
	queueOnce  sync.Once
	maxWorkers = 50 // Handles extremely high concurrent webhook updates
)

func initWorkerPool(db *repository.Database, mod *botmgmt.ModeratorService, botRepo *repository.BotRepo, chanServ *channelmgmt.ChannelService) {
	queueOnce.Do(func() {
		jobQueue = make(chan WebhookJob, 10000)
		handler := NewWebhookHandler(db, mod, botRepo, chanServ)
		for i := 0; i < maxWorkers; i++ {
			go func() {
				for job := range jobQueue {
					func() {
						defer func() {
							if r := recover(); r != nil {
								slog.Error("Worker panic recovered during async webhook execution", "panic", r, "stack", string(debug.Stack()))
							}
						}()
						handler.processUpdateAsync(job.ctx, job.bot, job.update)
					}()
				}
			}()
		}
	})
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

	if err := json.Unmarshal(bodyBytes, update); err != nil {
		slog.Error("Error decoding update", "error", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	// S5 (Replay Window check — 300s window for Render cold-start compatibility)
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
	} else if update.CallbackQuery != nil && update.CallbackQuery.Message != nil {
		updateDate = update.CallbackQuery.Message.Date
	} else if update.MyChatMember != nil {
		updateDate = update.MyChatMember.Date
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

	// 0. Idempotency Check (BUG #16 - Hardened & Improved)
	cacheKey = fmt.Sprintf("update:%s:%d", botIDStr, update.UpdateID)
	if cache != nil && cache.Client != nil {
		// Use SETNX as a "processing" lock with 10 minutes TTL to protect long actions
		locked, err := cache.Client.SetNX(ctx, cacheKey, "processing", 10*time.Minute).Result()
		if err != nil {
			slog.Warn("Redis error in idempotency check", "error", err, "update_id", update.UpdateID, "bot_id", botIDStr)
		} else if !locked {
			val, _ := cache.Client.Get(ctx, cacheKey).Result()
			if val == "processed" {
				slog.Info("Duplicate Telegram update skipped (already processed)", "update_id", update.UpdateID, "bot_id", botIDStr)
				w.WriteHeader(http.StatusOK)
				return
			}
			slog.Warn("Duplicate Telegram update ignored (still processing)", "update_id", update.UpdateID, "bot_id", botIDStr)
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests) // HTTP 429 tells Telegram to retry later
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
		w.WriteHeader(http.StatusOK)
	default:
		slog.Error("CRITICAL: Webhook job queue full! Webhook dropped.")
		w.WriteHeader(http.StatusServiceUnavailable)
	}
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

	if (newStatus == "administrator" || newStatus == "member") && chat.Type != "channel" {
		slog.Info("Bot added to group", "chat_id", chat.ID, "chat_type", chat.Type)
		// Trigger onboarding flow
		h.handleBotAddedToGroup(ctx, bot, &chat, mcm.From.ID)
	}

	if chat.Type == "channel" {
		ch, err := h.channelService.GetChannelByChatID(ctx, chat.ID)
		if err == nil {
			if newStatus == "left" || newStatus == "kicked" || (newStatus == "member" && oldStatus == "administrator") {
				slog.Warn("Bot was kicked or demoted from channel via webhook", "channel_id", ch.ID)
				_ = h.channelService.GetChannelRepo().DeleteChannel(ctx, ch.ID)

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
			if managedGroup.ConnectedByUserID != nil {
				targetUserID = *managedGroup.ConnectedByUserID
			}
			logIfErr(tg.SendMessage(ctx, targetUserID, msg, nil, nil), "Failed to send owner bot_removed notification", "owner_id", targetUserID)
		} else if newStatus == "member" && (oldStatus == "administrator" || oldStatus == "creator") {
			msg := i18n.T(lang, "notifications.admin_revoked_group")
			logIfErr(tg.SendMessage(ctx, chat.ID, msg, nil, nil), "Failed to send admin_revoked group message", "chat_id", chat.ID)
			ownerMsg := i18n.T(lang, "notifications.admin_revoked", map[string]interface{}{"group": chat.Title})
			
			targetUserID := bot.OwnerUserID
			if managedGroup.ConnectedByUserID != nil {
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

	go func() {
		h.processedJoins.Range(func(k, v interface{}) bool {
			if t, ok := v.(time.Time); ok && now.Sub(t) > 30*time.Second {
				h.processedJoins.Delete(k)
			}
			return true
		})
	}()

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
		}

		fakeMsg := &Message{
			Chat: &Chat{
				ID:    cmu.Chat.ID,
				Title: cmu.Chat.Title,
				Type:  cmu.Chat.Type,
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
		if len(parts) == 2 {
			groupIDStr := parts[0]
			packageID := parts[1]
			groupID, err := uuid.Parse(groupIDStr)
			if err == nil {
				botSvc := botmgmt.NewBotService(h.botRepo, repository.NewSettingsRepo(h.db, nil), repository.NewAuditRepo(h.db), repository.NewAnalyticsRepo(h.db), nil, nil)
				err = botSvc.ActivateSubscriptionFromStars(ctx, msg.From.ID, groupID, packageID)
				if err != nil {
					slog.Error("Failed to activate subscription from Stars webhook", "error", err, "payload", pay.InvoicePayload)
				} else {
					slog.Info("Successfully activated subscription via Stars Webhook", "group_id", groupIDStr, "package_id", packageID)
				}
			}
		}
	} else if strings.HasPrefix(pay.InvoicePayload, "sub_chan_stars_") {
		parts := strings.Split(strings.TrimPrefix(pay.InvoicePayload, "sub_chan_stars_"), "_")
		if len(parts) == 2 {
			channelIDStr := parts[0]
			packageID := parts[1]
			channelID, err := uuid.Parse(channelIDStr)
			if err == nil {
				botSvc := botmgmt.NewBotService(h.botRepo, repository.NewSettingsRepo(h.db, nil), repository.NewAuditRepo(h.db), repository.NewAnalyticsRepo(h.db), nil, nil)
				err = botSvc.ActivateChannelSubscriptionFromStars(ctx, msg.From.ID, channelID, packageID)
				if err != nil {
					slog.Error("Failed to activate channel subscription from Stars webhook", "error", err, "payload", pay.InvoicePayload)
				} else {
					slog.Info("Successfully activated channel subscription via Stars Webhook", "channel_id", channelIDStr, "package_id", packageID)
				}
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
			if msg.From != nil {
				inviterID = msg.From.ID
			}
			h.handleBotAddedToGroup(ctx, bot, msg.Chat, inviterID)
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
			if general.HideJoinLeave {
				h.deleteMessage(ctx, bot, msg.Chat.ID, msg.MessageID)
			}
		}
	}
}

func (h *WebhookHandler) handleRegularMessageUpdate(ctx context.Context, bot *repository.ManagedBot, msg *Message) {
	if msg.Chat == nil || msg.From == nil {
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
		} else if strings.HasPrefix(mc.Text, "/settings") {
			h.handleGroupSettingsCommand(ctx, bot, msg)
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
			_, _ = h.channelService.ProcessAutoFirstComment(ctx, tg, ch.ID, msg.Chat.ID, msg.MessageID)
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
			botToken, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
			tg := telegram.NewBotAPIClient(botToken)
			
			group, _ := h.botRepo.GetGroup(ctx, bot.ID, msg.Chat.ID)
			targetUserID := bot.OwnerUserID
			if group != nil && group.ConnectedByUserID != nil {
				targetUserID = *group.ConnectedByUserID
			}
			ownerLang, _ := h.db.GetUserLanguage(ctx, targetUserID)
			lang := i18n.DetectLanguage(ownerLang)
			
			milestoneMsg := i18n.T(lang, "notifications.milestone", map[string]interface{}{"n": total})
			_ = tg.SendMessage(ctx, msg.Chat.ID, milestoneMsg, nil, nil)
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
		IsReplyToCrossChat: m.ReplyToMessage != nil && m.ReplyToMessage.Chat != nil && m.ReplyToMessage.Chat.ID != m.Chat.ID,
		HasViaBot:          m.ViaBot != nil,
		IsCommand:          isCommand,
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

	// 1. Delete message
	if botPerms == nil || botPerms.CanDeleteMessages {
		_ = tgClient.DeleteMessage(ctx, chatID, messageID)
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
	group, err := h.botRepo.GetGroup(ctx, bot.ID, chatID)
	if err == nil {
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
			template = "⚠️ <b>{user}</b> | Warning <b>{count}/{threshold}</b>\n└ Reason: {reason}"
		}

		switch violation.Type {
		case "mandatory_membership":
			template = ct.ForceJoinText
			if template == "" || repository.IsLegacyText(template) {
				template = "📢 <b>{user}</b>, join required channels to chat in <b>{group}</b>:\n\n{channel_names}"
			}
		case "forced_add":
			template = ct.ForceAddText
			if template == "" || repository.IsLegacyText(template) {
				template = "👥 <b>{user}</b>, invite {remainadd} member(s) to chat in <b>{group}</b> ({added}/{number})"
			}
		case "quiet_hours":
			template = ct.SilenceStartText
			if template == "" || repository.IsLegacyText(template) {
				template = "🔒 <b>{group}</b> | Quiet Hours Active"
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
		if general.EphemeralWarnings || general.EphemeralAll {
			h.sendEphemeralBotMessage(ctx, tgClient, chatID, userID, text, nil, threadID, general)
		} else {
			h.sendBotMessage(ctx, tgClient, chatID, text, nil, threadID, general)
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

func (h *WebhookHandler) handlePrivateCommand(ctx context.Context, bot *repository.ManagedBot, m *Message) {
	if strings.HasPrefix(m.Text, "/start") {
		miniAppURL := os.Getenv("MINI_APP_URL")
		if miniAppURL == "" {
			miniAppURL = "https://t.me/iFragmentBot/iFragment"
		}

		// Extract deep linking parameter
		var startParam string
		parts := strings.Split(m.Text, " ")
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
		
		if startParam != "" {
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
					slog.Warn("Failed to set referred_by via webhook", "user_id", m.From.ID, "referrer_code", startParam, "error", err)
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
		if m.From.ID == bot.OwnerUserID {
			welcome = i18n.T(lang, "onboarding.welcome_owner", userName)
		} else {
			if strings.EqualFold(bot.BotUsername, "iFragmentBot") || bot.OwnerUserID == 0 {
				welcome = i18n.T(lang, "onboarding.welcome_public", userName)
			} else {
				welcome = i18n.T(lang, "onboarding.welcome_hosted_public", userName)
			}
		}

		token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		tg := telegram.NewBotAPIClient(token)

		// Inline keyboard with Telegram Web App overlay trigger
		btnText := i18n.T(lang, "onboarding.open_app")
		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{
						"text": btnText,
						"url": targetURL,
					},
				},
			},
		}

		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, welcome, markup, m.MessageThreadID)
	} else if strings.HasPrefix(m.Text, "/language") {
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
	}
}

func (h *WebhookHandler) handleGroupSettingsCommand(ctx context.Context, bot *repository.ManagedBot, m *Message) {
	group, err := h.botRepo.GetGroup(ctx, bot.ID, m.Chat.ID)
	if err != nil {
		return
	}

	bot, _ = h.botRepo.GetBotByID(ctx, group.BotID)
	tg, _ := h.moderator.GetTelegramClient(ctx, bot)

	status, _ := h.moderator.GetChatMemberCached(ctx, tg, m.Chat.ID, m.From.ID)
	if status != "administrator" && status != "creator" {
		return
	}

	miniAppURL := os.Getenv("MINI_APP_URL")
	if miniAppURL == "" {
		miniAppURL = "https://t.me/iFragmentBot/iFragment"
	}
	dashboardURL := fmt.Sprintf("%s?startapp=group_%s", miniAppURL, group.ID)

	msg := fmt.Sprintf("⚙️ *Group Settings*\n\nYou can manage this group's settings via the dashboard:\n\n🔗 [Manage Group](%s)", dashboardURL)
	_ = tg.SendMessage(ctx, m.Chat.ID, msg, &m.MessageID, m.MessageThreadID)
}

func (h *WebhookHandler) handleBotAddedToGroup(ctx context.Context, bot *repository.ManagedBot, chat *Chat, inviterID int64) {
	token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	var tg *telegram.BotAPIClient
	if token != "" {
		tg = telegram.NewBotAPIClient(token)
	}

	var liveMembersCount int
	var livePhotoURL string
	if tg != nil {
		liveMembersCount, _ = tg.GetChatMemberCount(ctx, chat.ID)
		livePhotoURL, _ = tg.GetChatPhotoURL(ctx, chat.ID)
	}

	managedGroup, err := h.botRepo.GetGroup(ctx, bot.ID, chat.ID)
	if err != nil {
		// Group not found under this bot. Check if it exists under another bot to migrate and preserve settings.
		var existingGroupID uuid.UUID
		var oldBotID uuid.UUID
		query := `SELECT id, bot_id FROM managed_groups WHERE chat_id = $1 LIMIT 1`
		errScan := h.db.Pool.QueryRow(ctx, query, chat.ID).Scan(&existingGroupID, &oldBotID)
		if errScan == nil {
			// Migrate the group to the new bot
			updateQuery := `UPDATE managed_groups SET bot_id = $1, updated_at = now() WHERE id = $2`
			_, errUpdate := h.db.Pool.Exec(ctx, updateQuery, bot.ID, existingGroupID)
			if errUpdate != nil {
				slog.Error("Failed to migrate group to new bot", "error", errUpdate, "group_id", existingGroupID, "new_bot_id", bot.ID)
				return
			}
			slog.Info("Successfully migrated group to new bot", "group_id", existingGroupID, "old_bot_id", oldBotID, "new_bot_id", bot.ID)
			managedGroup, err = h.botRepo.GetGroup(ctx, bot.ID, chat.ID)
			if err != nil {
				slog.Error("Failed to fetch migrated group", "error", err)
				return
			}
			if liveMembersCount > 0 || livePhotoURL != "" {
				_ = h.botRepo.UpdateGroupDetails(ctx, managedGroup.ID, chat.Title, liveMembersCount, livePhotoURL)
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

			managedGroup = &repository.ManagedGroup{
				BotID:              bot.ID,
				ChatID:             chat.ID,
				ChatTitle:          chat.Title,
				ChatType:           chat.Type,
				MembersCount:       liveMembersCount,
				PhotoURL:           livePhotoURL,
				SubscriptionStatus: status,
				TrialEndsAt:        time.Now().Add(72 * time.Hour),
				ConnectedByUserID:  &inviterID,
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

	// Sequence of onboarding messages (BUG #8 - Fixed with premium Persian flow)
	GoSafe(func() {
		var msgIDs []int
		ctx := context.Background()

		// Try to detect language from group settings
		lang := "en"
		// We need to fetch the group to get its ID (UUID)
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

		// 1. Thank you message
		welcome := i18n.T(lang, "onboarding.thanks", chat.Title)
		msg1, _ := tg.SendMessageWithResult(ctx, chat.ID, welcome, nil, nil)
		if msg1 != nil {
			msgIDs = append(msgIDs, msg1.MessageID)
		}

		time.Sleep(1 * time.Second)
		// 2. Admin request
		adminMsg := i18n.T(lang, "onboarding.admin_req")
		msg2, _ := tg.SendMessageWithResult(ctx, chat.ID, adminMsg, nil, nil)
		if msg2 != nil {
			msgIDs = append(msgIDs, msg2.MessageID)
		}

		time.Sleep(2 * time.Second)
		// 3. Default features
		miniAppURL := os.Getenv("MINI_APP_URL")
		if miniAppURL == "" {
			miniAppURL = "https://t.me/iFragmentBot/iFragment"
		}
		dashboardURL := fmt.Sprintf("%s?startapp=group_%s", miniAppURL, bot.ID)
		setupMsg := i18n.T(lang, "onboarding.features", dashboardURL)
		msg3, _ := tg.SendMessageWithResult(ctx, chat.ID, setupMsg, nil, nil)
		if msg3 != nil {
			msgIDs = append(msgIDs, msg3.MessageID)
		}

		// Auto-delete after 2 minutes without blocking the goroutine or holding the semaphore
		chatID := chat.ID
		capturedMsgIDs := make([]int, len(msgIDs))
		copy(capturedMsgIDs, msgIDs)
		time.AfterFunc(2*time.Minute, func() {
			bgCtx := context.Background()
			for _, mid := range capturedMsgIDs {
				_ = tg.DeleteMessage(bgCtx, chatID, mid)
			}
		})
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
		welcomeText = "👋 Welcome {user} to <b>{group}</b>!"
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
		rules = "▫️ No Spam, Ads, or Unauthorized Links\n▫️ Maintain respect & decorum"
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
	isPublicCmd := cmd == "/rules" || cmd == "/info" || cmd == "/stats" || cmd == "/report"

	isAdmin := h.isAdmin(ctx, tg, m.Chat.ID, m.From.ID)

	// 3. Admin Check
	if !isAdmin {
		if cmd == "/report" {
			// /report is always allowed for regular users (replies to reported message)
		} else if isPublicCmd && general.PublicCommands {
			// rules, info, stats are allowed if publicCommands is true
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
	case "/ban":
		return h.adminBan(ctx, bot, tg, m, lang, group.ID)
	case "/unban":
		return h.adminUnban(ctx, bot, tg, m, lang, group.ID)
	case "/mute":
		return h.adminMute(ctx, bot, tg, m, lang, group.ID)
	case "/unmute":
		return h.adminUnmute(ctx, bot, tg, m, lang, group.ID)
	case "/warn":
		return h.adminWarn(ctx, bot, m, lang, group.ID)
	case "/rules":
		return h.adminRules(ctx, tg, m, lang, group.ID)
	case "/report":
		targetUserID := bot.OwnerUserID
		if group.ConnectedByUserID != nil {
			targetUserID = *group.ConnectedByUserID
		}
		return h.adminReport(ctx, tg, m, lang, targetUserID)
	case "/pin":
		return h.adminPin(ctx, bot, tg, m)
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

func (h *WebhookHandler) adminMute(ctx context.Context, bot *repository.ManagedBot, tg *telegram.BotAPIClient, m *Message, lang string, _ uuid.UUID) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 {
		return false
	}

	if perms, err := h.getBotPermissionsCached(ctx, tg, m.Chat.ID, bot.BotID); err == nil && perms != nil && !perms.CanRestrictMembers {
		_ = tg.SendMessage(ctx, m.Chat.ID, i18n.T(lang, "moderation.no_mute_perm"), &m.MessageID, m.MessageThreadID)
		return true
	}

	until := time.Now().Add(24 * time.Hour).Unix()
	_ = tg.RestrictChatMember(ctx, m.Chat.ID, targetID, until)
	_ = tg.SendMessage(ctx, m.Chat.ID, i18n.T(lang, "moderation.user_muted", map[string]interface{}{"id": targetID, "name": targetName}), &m.MessageID, m.MessageThreadID)
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

	_ = tg.RestrictChatMember(ctx, m.Chat.ID, targetID, 0)
	_ = tg.SendMessage(ctx, m.Chat.ID, i18n.T(lang, "moderation.user_unmuted", map[string]interface{}{"id": targetID, "name": targetName}), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminWarn(ctx context.Context, bot *repository.ManagedBot, m *Message, _ string, _ uuid.UUID) bool {
	targetID, _ := h.getTarget(m)
	if targetID == 0 {
		return false
	}

	// Use existing moderation logic for warning
	violation := &botmgmt.Violation{
		Type:    "admin_warn",
		Action:  "warn",
		Message: "Warned by administrator",
	}
	h.executeViolationAction(ctx, bot, m.Chat.ID, targetID, m.MessageID, m.MessageThreadID, violation)
	return true
}

func (h *WebhookHandler) adminRules(ctx context.Context, tg *telegram.BotAPIClient, m *Message, lang string, groupID uuid.UUID) bool {
	settings, err := h.moderator.GetSettings(ctx, groupID)
	var general repository.SettingsGeneral
	if settings != nil {
		json.Unmarshal(settings.General, &general)
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
	json.Unmarshal(settings.CustomTexts, &ct)

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
	if m.From != nil && (general.EphemeralAdminCmd || general.EphemeralAll) {
		h.sendEphemeralBotMessage(ctx, tg, m.Chat.ID, m.From.ID, text, nil, m.MessageThreadID, general)
	} else {
		_ = tg.SendMessage(ctx, m.Chat.ID, text, &m.MessageID, m.MessageThreadID)
	}
	return true
}

func (h *WebhookHandler) adminReport(ctx context.Context, tg *telegram.BotAPIClient, m *Message, _ string, ownerID int64) bool {
	if m.ReplyToMessage == nil || m.ReplyToMessage.From == nil {
		return false
	}

	reportMsg := fmt.Sprintf("🚨 *Report Received*\n\nGroup: %s\nReporter: %d\nOffender: %d\nMessage: [Link](https://t.me/c/%s/%d)",
		m.Chat.Title, m.From.ID, m.ReplyToMessage.From.ID, strings.TrimPrefix(fmt.Sprintf("%d", m.Chat.ID), "-100"), m.ReplyToMessage.MessageID)

	_ = tg.SendMessage(ctx, ownerID, reportMsg, nil, nil)
	_ = tg.SendMessage(ctx, m.Chat.ID, "✅ Report sent to administrators.", &m.MessageID, m.MessageThreadID)
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

func (h *WebhookHandler) getTarget(m *Message) (int64, string) {
	if m.ReplyToMessage != nil && m.ReplyToMessage.From != nil {
		name := m.ReplyToMessage.From.FirstName
		if m.ReplyToMessage.From.Username != "" {
			name = "@" + m.ReplyToMessage.From.Username
		}
		return m.ReplyToMessage.From.ID, name
	}
	return 0, ""
}
func (h *WebhookHandler) handleCallbackQuery(ctx context.Context, bot *repository.ManagedBot, cq *CallbackQuery) {
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
		
		if btn.Style != "" {
			ikb.Style = btn.Style
		}
		if btn.Type == "url" {
			ikb.URL = strings.TrimSpace(btn.Value)
			if !strings.HasPrefix(ikb.URL, "http://") && !strings.HasPrefix(ikb.URL, "https://") && !strings.HasPrefix(ikb.URL, "tg://") {
				ikb.URL = "https://" + ikb.URL
			}
		} else {
			// Callback query click button
			ikb.CallbackData = fmt.Sprintf("btn_click:%s", btn.ID.String())
		}
		row = append(row, ikb)
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
		text := ""
		if btn.Emoji != "" {
			text += btn.Emoji + " "
		}
		text += btn.Title

		ikb := InlineKeyboardButton{
			Text:  truncateButtonText(text, 64),
			Style: btn.Style,
		}
		if btn.Type == "url" {
			ikb.URL = strings.TrimSpace(btn.Value)
			if !strings.HasPrefix(ikb.URL, "http://") && !strings.HasPrefix(ikb.URL, "https://") && !strings.HasPrefix(ikb.URL, "tg://") {
				ikb.URL = "https://" + ikb.URL
			}
		} else {
			ikb.CallbackData = fmt.Sprintf("btn_click:%s", btn.ID.String())
		}
		row = append(row, ikb)
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

		for i := 1; i <= n; i++ {
			msgID := m.MessageID - i
			_ = tg.DeleteMessage(bgCtx, m.Chat.ID, msgID)
			// P1-P2: Respect Telegram API rate limit (max 30 req/sec) with a steady 40ms delay
			time.Sleep(40 * time.Millisecond)
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

	if err == nil && msg != nil && general.AutoDeleteBot && general.AutoDeleteDelay > 0 {
		time.AfterFunc(time.Duration(general.AutoDeleteDelay)*time.Second, func() {
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

	// 1. Verify channel connection exists in managed_channels
	ch, err := h.channelService.GetChannelByChatID(ctx, req.Chat.ID)
	if err != nil || ch == nil {
		slog.Warn("Chat join request ignored: channel is not managed", "chat_id", req.Chat.ID)
		return
	}

	// 2. Fetch channel settings via Service layer to check active policies
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

	// Decline or wait for manual evaluation (let's keep for manual review on mismatch)
	if !shouldApprove {
		tg, err := h.moderator.GetTelegramClient(ctx, bot)
		if err == nil {
			userLang := i18n.DetectLanguage(req.From.LanguageCode)
			rejectMsg := ""

			switch reason {
			case "premium":
				rejectMsg = i18n.T(userLang, "channel.join_request_rejected_premium", map[string]interface{}{"channel": ch.ChatTitle})
				if rejectMsg == "" || rejectMsg == "channel.join_request_rejected_premium" {
					rejectMsg = fmt.Sprintf("⚠️ درخواست عضویت شما در کانال %s به دلیل عدم داشتن اکانت Premium پذیرفته نشد. لطفاً شرایط کانال را مجدداً بررسی کنید.", ch.ChatTitle)
				}
			case "photo":
				rejectMsg = i18n.T(userLang, "channel.join_request_rejected_photo", map[string]interface{}{"channel": ch.ChatTitle})
				if rejectMsg == "" || rejectMsg == "channel.join_request_rejected_photo" {
					rejectMsg = fmt.Sprintf("⚠️ درخواست عضویت شما در کانال %s پذیرفته نشد زیرا شما تصویر پروفایل ندارید.", ch.ChatTitle)
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
