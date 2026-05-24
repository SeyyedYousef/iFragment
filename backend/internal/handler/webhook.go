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
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"
	"ifragment-backend/internal/service/channelmgmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type WebhookHandler struct {
	db             *repository.Database
	moderator      *botmgmt.ModeratorService
	botRepo        *repository.BotRepo
	channelService *channelmgmt.ChannelService
}

func NewWebhookHandler(db *repository.Database, moderator *botmgmt.ModeratorService, botRepo *repository.BotRepo, channelService *channelmgmt.ChannelService) *WebhookHandler {
	return &WebhookHandler{db: db, moderator: moderator, botRepo: botRepo, channelService: channelService}
}

type TelegramUpdate struct {
	UpdateID          int                `json:"update_id"`
	PreCheckoutQuery  *PreCheckoutQuery  `json:"pre_checkout_query"`
	Message           *Message           `json:"message"`
	EditedMessage     *Message           `json:"edited_message"`
	MyChatMember      *ChatMemberUpdated `json:"my_chat_member"`
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
	ID               string `json:"id"`
	InvoicePayload   string `json:"invoice_payload"`
	TotalAmount      int    `json:"total_amount"`
}

type Chat struct {
	ID    int64  `json:"id"`
	Type  string `json:"type"`
	Title string `json:"title,omitempty"`
}

type Message struct {
	MessageID         int                `json:"message_id"`
	MessageThreadID   *int               `json:"message_thread_id,omitempty"`
	From              *User              `json:"from"`
	Chat              *Chat              `json:"chat"`
	Text              string             `json:"text"`
	Caption           string             `json:"caption"`
	Photo             []interface{}      `json:"photo"`
	Sticker           json.RawMessage    `json:"sticker,omitempty"`
	Location          json.RawMessage    `json:"location,omitempty"`
	Audio             json.RawMessage    `json:"audio,omitempty"`
	Voice             json.RawMessage    `json:"voice,omitempty"`
	Document          json.RawMessage    `json:"document,omitempty"`
	Animation         json.RawMessage    `json:"animation,omitempty"`
	Video             json.RawMessage    `json:"video,omitempty"`
	Poll              json.RawMessage    `json:"poll,omitempty"`
	Game              json.RawMessage    `json:"game,omitempty"`
	Entities          []MessageEntity    `json:"entities"`
	ReplyToMessage    *Message           `json:"reply_to_message"`
	ForwardFromChat   *Chat              `json:"forward_from_chat"`
	ViaBot            *User              `json:"via_bot"`
	ReplyMarkup       json.RawMessage    `json:"reply_markup,omitempty"`
	SuccessfulPayment *SuccessfulPayment `json:"successful_payment"`
	NewChatMembers    []User             `json:"new_chat_members"`
	LeftChatMember    *User              `json:"left_chat_member"`
}

type MessageEntity struct {
	Type   string `json:"type"`
	Offset int    `json:"offset"`
	Length int    `json:"length"`
}

type User struct {
	ID           int64  `json:"id"`
	IsBot        bool   `json:"is_bot"`
	FirstName    string `json:"first_name"`
	Username     string `json:"username,omitempty"`
	LanguageCode string `json:"language_code,omitempty"`
}

type SuccessfulPayment struct {
	InvoicePayload           string `json:"invoice_payload"`
	TelegramPaymentChargeID  string `json:"telegram_payment_charge_id"`
}

func (h *WebhookHandler) HandleTelegramWebhook(w http.ResponseWriter, r *http.Request) {
	// Security: Validate secret token if provided by Telegram
	// ─── AUTHENTICATION (Patch 5) ───
	secretToken := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
	expectedSecret := os.Getenv("WEBHOOK_SECRET_TOKEN")
	isProd := os.Getenv("APP_ENV") == "production"
	if isProd && expectedSecret == "" {
		slog.Warn("Security Alert: WEBHOOK_SECRET_TOKEN is empty in production")
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if expectedSecret != "" && secretToken != expectedSecret {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	botIDStr := chi.URLParam(r, "botID")
	botID, err := uuid.Parse(botIDStr)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	// Verify bot exists
	bot, err := h.botRepo.GetBotByID(r.Context(), botID)
	if err != nil || bot == nil {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	var update TelegramUpdate
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		slog.Error("Error decoding update", "error", err)
		return
	}

	// 0. Idempotency Check (BUG #16 - Hardened)
	ctx := r.Context()
	cacheKey := fmt.Sprintf("update:%s:%d", botIDStr, update.UpdateID)
	cache := h.moderator.GetCache()
	if cache != nil && cache.Client != nil {
		// Use SETNX as a "processing" lock with short TTL
		locked, err := cache.Client.SetNX(ctx, cacheKey, "processing", 2*time.Minute).Result()
		if err != nil {
			slog.Warn("Redis error in idempotency", "error", err)
		} else if !locked {
			val, _ := cache.Client.Get(ctx, cacheKey).Result()
			if val == "processed" {
				w.WriteHeader(http.StatusOK)
				return
			}
			w.WriteHeader(http.StatusAccepted) // Still processing, tell TG we got it
			return
		}
		defer func() {
			if r := recover(); r != nil {
				cache.Client.Del(context.Background(), cacheKey)
				panic(r)
			}
		}()
	}

	// 0.5 Handle Callback Query (Captcha, etc.)
	if update.CallbackQuery != nil {
		h.handleCallbackQuery(ctx, update.CallbackQuery)
		w.WriteHeader(http.StatusOK)
		return
	}

	// 1. Handle Pre-Checkout (Patch 4)
	if update.PreCheckoutQuery != nil {
		ctx := r.Context()
		botToken, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		order, err := h.db.GetOrderByPayload(ctx, update.PreCheckoutQuery.InvoicePayload)
		if err != nil {
			slog.Warn("Pre-checkout failed: Order not found for payload", "payload", update.PreCheckoutQuery.InvoicePayload)
			h.answerPreCheckout(botToken, update.PreCheckoutQuery.ID, false, "Order verification failed")
		} else if order.Amount != update.PreCheckoutQuery.TotalAmount {
			slog.Warn("Pre-checkout failed: Amount mismatch", "expected", order.Amount, "got", update.PreCheckoutQuery.TotalAmount)
			h.answerPreCheckout(botToken, update.PreCheckoutQuery.ID, false, "Price mismatch")
		} else {
			h.answerPreCheckout(botToken, update.PreCheckoutQuery.ID, true, "")
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	// 2. Handle MyChatMember (Onboarding/Setup & Bot Status Updates)
	if update.MyChatMember != nil {
		ctx := r.Context()
		chat := update.MyChatMember.Chat
		newStatus := update.MyChatMember.NewChatMember.Status
		oldStatus := update.MyChatMember.OldChatMember.Status

		if newStatus == "administrator" || newStatus == "member" {
			slog.Info("Bot added to group", "chat_id", chat.ID, "chat_type", chat.Type)
			// Trigger onboarding flow
			h.handleBotAddedToGroup(ctx, bot, &chat, update.MyChatMember.From.ID)
		}

		_, err := h.botRepo.GetGroupByChatID(ctx, chat.ID)
		if err == nil {
			tg, _ := h.moderator.GetTelegramClient(ctx, bot)
			
			lang := "en"
			// Get the group from bot repo to get the UUID
			managedGroup, err := h.botRepo.GetGroupByChatID(ctx, chat.ID)
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
				_ = tg.SendMessage(bot.OwnerUserID, msg, nil, nil)
			} else if newStatus == "member" && (oldStatus == "administrator" || oldStatus == "creator") {
				msg := i18n.T(lang, "notifications.admin_revoked_group")
				_ = tg.SendMessage(chat.ID, msg, nil, nil)
				ownerMsg := i18n.T(lang, "notifications.admin_revoked", map[string]interface{}{"group": chat.Title})
				_ = tg.SendMessage(bot.OwnerUserID, ownerMsg, nil, nil)
			}
		}
	}

	// 2.5 Handle Channel Posts
	if update.ChannelPost != nil {
		h.handleChannelPost(ctx, bot, update.ChannelPost)
		w.WriteHeader(http.StatusOK)
		return
	}
	if update.EditedChannelPost != nil {
		h.handleChannelPost(ctx, bot, update.EditedChannelPost)
		w.WriteHeader(http.StatusOK)
		return
	}

	// 2.7 Handle Chat Join Requests
	if update.ChatJoinRequest != nil {
		h.handleChatJoinRequest(ctx, bot, update.ChatJoinRequest)
		w.WriteHeader(http.StatusOK)
		return
	}

	// 3. Handle Successful Payment
	if update.Message != nil && update.Message.SuccessfulPayment != nil {
		pay := update.Message.SuccessfulPayment
		slog.Info("Successful payment received for payload", "payload", pay.InvoicePayload)
		err := h.db.UpdateOrderStatus(r.Context(), pay.InvoicePayload, "paid", pay.TelegramPaymentChargeID)
		if err == nil {
			if strings.HasPrefix(pay.InvoicePayload, "stars_premium_1m:") {
				parts := strings.Split(pay.InvoicePayload, ":")
				if len(parts) == 2 {
					userID, parseErr := strconv.ParseInt(parts[1], 10, 64)
					if parseErr == nil {
						_ = h.db.UpdateUserPremium(r.Context(), userID, 30*24*time.Hour)
						slog.Info("Granted 30-day Premium access to User via Stars Webhook", "user_id", userID)

						auditRepo := repository.NewAuditRepo(h.db)
						targetType := "user"
						targetID := strconv.FormatInt(userID, 10)
						_ = auditRepo.Log(r.Context(), &repository.AuditLog{
							ActorID:    userID,
							Action:     "premium.grant",
							TargetType: &targetType,
							TargetID:   &targetID,
						})
					}
				}
			} else if strings.HasPrefix(pay.InvoicePayload, "report_pay:") {
				parts := strings.Split(pay.InvoicePayload, ":")
				if len(parts) == 3 {
					userID, parseErr := strconv.ParseInt(parts[1], 10, 64)
					username := parts[2]
					if parseErr == nil && username != "" {
						auditRepo := repository.NewAuditRepo(h.db)
						targetType := "username"
						_ = auditRepo.Log(r.Context(), &repository.AuditLog{
							ActorID:    userID,
							Action:     "report.payment.success",
							TargetType: &targetType,
							TargetID:   &username,
						})
						appURL := os.Getenv("APP_URL")
						if appURL == "" {
							appURL = "https://t.me/ifragment_bot/app"
						}
						reportURL := fmt.Sprintf("%s?startapp=username_%s", appURL, username)
						tg, _ := h.moderator.GetTelegramClient(ctx, bot)
						_ = tg.SendMessage(userID, fmt.Sprintf("Payment received. Your @%s report is unlocked:\n%s", username, reportURL), nil, nil)
					}
				}
			} else {
				// ✅ Payment Notification
				var ownerLang string
				_ = h.db.Pool.QueryRow(ctx, "SELECT language_code FROM users WHERE telegram_id = $1", bot.OwnerUserID).Scan(&ownerLang)
				lang := i18n.DetectLanguage(ownerLang)
				tg, _ := h.moderator.GetTelegramClient(ctx, bot)
				msg := i18n.T(lang, "notifications.payment_success", map[string]interface{}{"date": time.Now().Add(30 * 24 * time.Hour).Format("2006-01-02")})
				_ = tg.SendMessage(bot.OwnerUserID, msg, nil, nil)
			}
		} else {
			slog.Error("Failed to update order status", "error", err)
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	// 4. Handle Join/Leave Events (BUG #10, #11)
	if update.Message != nil && (len(update.Message.NewChatMembers) > 0 || update.Message.LeftChatMember != nil) {
		ctx := r.Context()
		group, err := h.botRepo.GetGroupByChatID(ctx, update.Message.Chat.ID)
		if err == nil {
			settings, _ := h.moderator.GetSettings(ctx, group.ID)
			var content repository.SettingsContentRestrictions
			var general repository.SettingsGeneral
			if settings != nil {
				_ = json.Unmarshal(settings.ContentRestrictions, &content)
				_ = json.Unmarshal(settings.General, &general)
			}

			if len(update.Message.NewChatMembers) > 0 {
				nonBotCount := 0
				for _, user := range update.Message.NewChatMembers {
					if user.IsBot && content.BlockBots.Enabled {
						tgClient, tgErr := h.moderator.GetTelegramClient(ctx, bot)
						if tgErr == nil {
							_ = tgClient.BanChatMember(update.Message.Chat.ID, user.ID, 0, false)
							if content.RemoveBotInviters.Enabled && update.Message.From != nil {
								penalty := content.RemoveBotInviters.Penalty
								if penalty == "" || penalty == "default" {
									penalty = general.DefaultPenalty
								}
								violation := &botmgmt.Violation{
									Type:    "remove_bot_inviters",
									Message: "Adding bots is not allowed",
									Action:  h.moderator.ResolveAction(penalty),
								}
								h.executeViolationAction(ctx, update.Message.Chat.ID, update.Message.From.ID, update.Message.MessageID, update.Message.MessageThreadID, violation)
							}
						}
						continue
					}

					h.moderator.LogMemberEvent(ctx, group.ID, "member_join", &user.ID)
					// 🛡️ Captcha (BUG #10)
					h.handleJoinCaptcha(ctx, update.Message, &user)

					if !user.IsBot && update.Message.From != nil && user.ID != update.Message.From.ID {
						nonBotCount++
					}
				}

				if nonBotCount > 0 && update.Message.From != nil && h.moderator.GetCache() != nil && h.moderator.GetCache().Client != nil {
					key := fmt.Sprintf("invites:%s:%d", group.ID, update.Message.From.ID)
					h.moderator.GetCache().Client.IncrBy(ctx, key, int64(nonBotCount))
				}

				// Handle Welcome Message (BUG #8)
				h.handleWelcomeMessage(ctx, update.Message)
			}
			if update.Message.LeftChatMember != nil {
				h.moderator.LogMemberEvent(ctx, group.ID, "member_leave", &update.Message.LeftChatMember.ID)
			}

			// Handle HideJoinLeave (BUG #8)
			if settings != nil {
				if general.HideJoinLeave {
					h.deleteMessage(ctx, update.Message.Chat.ID, update.Message.MessageID)
				}
			}
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	// 5. Handle Regular/Edited Messages for Moderation
	msg := update.Message
	if msg == nil {
		msg = update.EditedMessage
	}

	if msg != nil && msg.Chat != nil && msg.From != nil {
		ctx := r.Context()
		mc := h.mapToModeratorContext(msg)

		if mc.IsCommand {
			if msg.Chat.Type == "private" {
				h.handlePrivateCommand(ctx, bot, msg)
				w.WriteHeader(http.StatusOK)
				return
			} else if strings.HasPrefix(mc.Text, "/settings") {
				h.handleGroupSettingsCommand(ctx, msg)
				w.WriteHeader(http.StatusOK)
				return
			} else {
				// 🛡️ Admin Commands (/ban, /mute, /warn, etc.)
				handled := h.handleGroupAdminCommand(ctx, msg)
				if handled {
					w.WriteHeader(http.StatusOK)
					return
				}
			}
		}

		// Regular Moderation
		violation, err := h.moderator.ValidateMessage(ctx, mc)
		if err != nil {
			slog.Warn("Moderation error", "error", err)
		} else if violation != nil {
			slog.Info("Violation detected", "type", violation.Type, "chat_id", msg.Chat.ID, "user_id", msg.From.ID)
			h.executeViolationAction(ctx, msg.Chat.ID, msg.From.ID, msg.MessageID, msg.MessageThreadID, violation)

			// 🚨 Spam Attack Detector (>10 violations in 1 minute)
			cache := h.moderator.GetCache()
			if cache != nil && cache.Client != nil {
				attackKey := fmt.Sprintf("attack:%d", msg.Chat.ID)
				count, _ := cache.Client.Incr(ctx, attackKey).Result()
				if count == 1 {
					cache.Client.Expire(ctx, attackKey, 1*time.Minute)
				}
				if count == 10 {
					tg, _ := h.moderator.GetTelegramClient(ctx, bot)
					group, _ := h.botRepo.GetGroupByChatID(ctx, msg.Chat.ID)
					lang := i18n.DetectLanguage("") // Placeholder
					alert := i18n.T(lang, "notifications.mass_spam", map[string]interface{}{"group": group.ChatTitle})
					_ = tg.SendMessage(bot.OwnerUserID, alert, nil, nil)
				}
			}
		}

		// 🎉 Milestones (1000, 10000, etc.)
		totalKey := fmt.Sprintf("total_msgs:%d", msg.Chat.ID)
		total, _ := h.moderator.GetCache().Client.Incr(ctx, totalKey).Result()
		if total == 1000 || total == 10000 || total == 100000 {
			botToken, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
			tg := telegram.NewBotAPIClient(botToken)
			lang := i18n.DetectLanguage("")
			milestoneMsg := i18n.T(lang, "notifications.milestone", map[string]interface{}{"n": total})
			_ = tg.SendMessage(msg.Chat.ID, milestoneMsg, nil, nil)
		}
	}

	// If everything succeeded, mark as processed
	if cache != nil && cache.Client != nil {
		cache.Client.Set(context.Background(), cacheKey, "processed", 10*time.Minute)
	}
	w.WriteHeader(http.StatusOK)
}


func (h *WebhookHandler) mapToModeratorContext(m *Message) *botmgmt.MessageContext {
	isCommand := false
	for _, ent := range m.Entities {
		if ent.Type == "bot_command" && ent.Offset == 0 {
			isCommand = true
			break
		}
	}

	hasRawField := func(raw json.RawMessage) bool {
		return len(raw) > 0 && string(raw) != "null"
	}

	return &botmgmt.MessageContext{
		ChatID:             m.Chat.ID,
		UserID:             m.From.ID,
		MessageID:          m.MessageID,
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
		IsForward:          m.ForwardFromChat != nil,
		ForwardFromChannel: m.ForwardFromChat != nil && m.ForwardFromChat.Type == "channel",
		ForwardFromChatID:  h.getForwardID(m),
		HasInlineKeyboard:  hasRawField(m.ReplyMarkup),
		HasReply:           m.ReplyToMessage != nil,
		HasViaBot:          m.ViaBot != nil,
		IsCommand:          isCommand,
		Username:           m.From.Username,
	}
}

func (h *WebhookHandler) executeViolationAction(ctx context.Context, chatID int64, userID int64, messageID int, threadID *int, violation *botmgmt.Violation) {
	bot, err := h.botRepo.GetBotByChatID(ctx, chatID)
	if err != nil {
		return
	}
	tgClient, err := h.moderator.GetTelegramClient(ctx, bot)
	if err != nil {
		return
	}

	// 1. Delete message
	_ = tgClient.DeleteMessage(chatID, messageID)

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
	group, err := h.botRepo.GetGroupByChatID(ctx, chatID)
	if err == nil {
		settings, _ := h.moderator.GetSettings(ctx, group.ID)
		if settings != nil {
			if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
				lang = general.Language
			}
		}
	}

	penaltyMsg := violation.Message
	if violation.CurrentWarnings > 0 {
		penaltyMsg = i18n.T(lang, "notice.warning", violation.Message, violation.CurrentWarnings, violation.WarningThreshold)
	}

	switch {
	case strings.HasPrefix(violation.Action, "mute"):
		_ = tgClient.RestrictChatMember(chatID, userID, until)
		h.sendBotMessage(ctx, tgClient, chatID, fmt.Sprintf("🔇 User restricted for %s due to: %s", durationText, penaltyMsg), nil, threadID, general)
	case violation.Action == "kick":
		_ = tgClient.BanChatMember(chatID, userID, time.Now().Add(30*time.Second).Unix(), false)
		_ = tgClient.UnbanChatMember(chatID, userID, true)
		h.sendBotMessage(ctx, tgClient, chatID, fmt.Sprintf("👢 User kicked due to: %s", penaltyMsg), nil, threadID, general)
	case violation.Action == "ban":
		_ = tgClient.BanChatMember(chatID, userID, 0, false)
		h.sendBotMessage(ctx, tgClient, chatID, fmt.Sprintf("🚫 User banned due to: %s", penaltyMsg), nil, threadID, general)
	case violation.Action == "delete":
		if violation.CurrentWarnings > 0 && general.WarningMessage {
			h.sendBotMessage(ctx, tgClient, chatID, fmt.Sprintf("⚠️ %s", penaltyMsg), nil, threadID, general)
		}
	}
}

func (h *WebhookHandler) answerPreCheckout(botToken string, id string, ok bool, errorMessage string) {
	url := fmt.Sprintf("https://api.telegram.org/bot%s/answerPreCheckoutQuery", botToken)

	payload := map[string]interface{}{
		"pre_checkout_query_id": id,
		"ok":                    ok,
	}
	if !ok {
		payload["error_message"] = errorMessage
	}

	jsonBody, _ := json.Marshal(payload)
	_, err := http.Post(url, "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		slog.Error("Failed to answer pre-checkout", "error", err)
	}
}

func (h *WebhookHandler) handlePrivateCommand(ctx context.Context, bot *repository.ManagedBot, m *Message) {
	if strings.HasPrefix(m.Text, "/start") {
		appURL := os.Getenv("APP_URL")
		if appURL == "" {
			appURL = "https://t.me/ifragment_bot/app"
		}
		
		userName := m.From.FirstName
		lang := i18n.DetectLanguage(m.From.LanguageCode)

		var welcome string
		if m.From.ID == bot.OwnerUserID {
			welcome = i18n.T(lang, "onboarding.welcome_owner", userName)
		} else {
			welcome = i18n.T(lang, "onboarding.welcome_public", userName)
		}
		
		token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		tg := telegram.NewBotAPIClient(token)

		// Inline keyboard link to Mini-App
		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{
						"text": "🚀 Open iFragment App",
						"url":  appURL,
					},
				},
			},
		}

		_, _ = tg.SendMessageWithMarkup(m.Chat.ID, welcome, markup, m.MessageThreadID)
	}
}

func (h *WebhookHandler) handleGroupSettingsCommand(ctx context.Context, m *Message) {
	group, err := h.botRepo.GetGroupByChatID(ctx, m.Chat.ID)
	if err != nil {
		return
	}

	bot, _ := h.botRepo.GetBotByID(ctx, group.BotID)
	tg, _ := h.moderator.GetTelegramClient(ctx, bot)

	status, _ := h.moderator.GetChatMemberCached(ctx, tg, m.Chat.ID, m.From.ID)
	if status != "administrator" && status != "creator" {
		return
	}

	appURL := os.Getenv("APP_URL")
	if appURL == "" { appURL = "https://t.me/ifragment_bot/app" }
	dashboardURL := fmt.Sprintf("%s?startapp=group_%s", appURL, group.ID)
	
	msg := fmt.Sprintf("⚙️ *Group Settings*\n\nYou can manage this group's settings via the dashboard:\n\n🔗 [Manage Group](%s)", dashboardURL)
	_ = tg.SendMessage(m.Chat.ID, msg, &m.MessageID, m.MessageThreadID)
}

func (h *WebhookHandler) handleBotAddedToGroup(ctx context.Context, bot *repository.ManagedBot, chat *Chat, _ int64) {
	managedGroup, err := h.botRepo.GetGroupByChatID(ctx, chat.ID)
	if err != nil {
		managedGroup = &repository.ManagedGroup{
			BotID:              bot.ID,
			ChatID:             chat.ID,
			ChatTitle:          chat.Title,
			ChatType:           chat.Type,
			SubscriptionStatus: "trial",
			TrialEndsAt:        time.Now().Add(72 * time.Hour),
		}
		err = h.botRepo.CreateGroup(ctx, managedGroup)
		if err != nil {
			slog.Error("Failed to auto-create group in DB", "error", err)
			return
		}
	}

	token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)

	// Sequence of onboarding messages (BUG #8 - Fixed with premium Persian flow)
	go func() {
		var msgIDs []int
		ctx := context.Background()

		// Try to detect language from group settings
		lang := "en"
		// We need to fetch the group to get its ID (UUID)
		managedGroup, err := h.botRepo.GetGroupByChatID(ctx, chat.ID)
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
		msg1, _ := tg.SendMessageWithResult(chat.ID, welcome, nil, nil)
		if msg1 != nil { msgIDs = append(msgIDs, msg1.MessageID) }

		time.Sleep(1 * time.Second)
		// 2. Admin request
		adminMsg := i18n.T(lang, "onboarding.admin_req")
		msg2, _ := tg.SendMessageWithResult(chat.ID, adminMsg, nil, nil)
		if msg2 != nil { msgIDs = append(msgIDs, msg2.MessageID) }

		time.Sleep(2 * time.Second)
		// 3. Default features
		appURL := os.Getenv("APP_URL")
		if appURL == "" {
			appURL = "https://t.me/ifragment_bot/app"
		}
		dashboardURL := fmt.Sprintf("%s?startapp=group_%s", appURL, bot.ID)
		setupMsg := i18n.T(lang, "onboarding.features", dashboardURL)
		msg3, _ := tg.SendMessageWithResult(chat.ID, setupMsg, nil, nil)
		if msg3 != nil { msgIDs = append(msgIDs, msg3.MessageID) }

		// Auto-delete after 2 minutes (P3-B2)
		time.Sleep(2 * time.Minute)
		for _, mid := range msgIDs {
			_ = tg.DeleteMessage(chat.ID, mid)
		}
	}()
}

func (h *WebhookHandler) handleWelcomeMessage(ctx context.Context, m *Message) {
	group, err := h.botRepo.GetGroupByChatID(ctx, m.Chat.ID)
	if err != nil {
		return
	}
	settings, _ := h.moderator.GetSettings(ctx, group.ID)
	if settings == nil {
		return
	}

	var general repository.SettingsGeneral
	var ct repository.SettingsCustomTexts
	json.Unmarshal(settings.General, &general)
	json.Unmarshal(settings.CustomTexts, &ct)

	if !general.WelcomeMessage || ct.WelcomeText == "" {
		return
	}

	bot, _ := h.botRepo.GetBotByID(ctx, group.BotID)
	tg, _ := h.moderator.GetTelegramClient(ctx, bot)

	// Gather all non-bot users
	var userLinks []string
	for _, user := range m.NewChatMembers {
		if user.IsBot {
			continue
		}
		name := user.FirstName
		if user.Username != "" {
			name = "@" + user.Username
		}
		userLinks = append(userLinks, fmt.Sprintf("[%s](tg://user?id=%d)", name, user.ID))
	}
	if len(userLinks) == 0 {
		return
	}

	// Enforce 10-second rate limit using Redis
	cache := h.moderator.GetCache()
	if cache != nil && cache.Client != nil {
		key := fmt.Sprintf("last_welcome_sent:%s", group.ID)
		locked, err := cache.Client.SetNX(ctx, key, "1", 10*time.Second).Result()
		if err == nil && !locked {
			// Rate limited! A welcome message was sent within the last 10 seconds.
			return
		}
	}

	// Format welcome text with placeholders
	text := ct.WelcomeText
	usersStr := strings.Join(userLinks, ", ")
	text = strings.ReplaceAll(text, "{user}", usersStr)
	text = strings.ReplaceAll(text, "{group}", m.Chat.Title)
	text = strings.ReplaceAll(text, "{chat_title}", m.Chat.Title)

	// Member count placeholder
	count := 0
	if tg != nil {
		if cnt, err := tg.GetChatMemberCount(m.Chat.ID); err == nil {
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
		rules = "Be respectful and follow standard group rules."
	}
	text = strings.ReplaceAll(text, "{rules}", rules)

	var markup map[string]interface{}
	if len(ct.InlineButtons) > 0 {
		var inlineKeyboard [][]map[string]interface{}
		for _, btn := range ct.InlineButtons {
			inlineKeyboard = append(inlineKeyboard, []map[string]interface{}{
				{
					"text": btn.Title,
					"url":  btn.URL,
				},
			})
		}
		markup = map[string]interface{}{
			"inline_keyboard": inlineKeyboard,
		}
	}

	h.sendBotMessage(ctx, tg, m.Chat.ID, text, markup, m.MessageThreadID, general)
}

func (h *WebhookHandler) deleteMessage(ctx context.Context, chatID int64, messageID int) {
	bot, err := h.botRepo.GetBotByChatID(ctx, chatID)
	if err != nil {
		return
	}
	token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)
	_ = tg.DeleteMessage(chatID, messageID)
}

func (h *WebhookHandler) handleGroupAdminCommand(ctx context.Context, m *Message) bool {
	if m.From == nil || m.Chat == nil { return false }
	
	// Command check
	cmd := ""
	for _, ent := range m.Entities {
		if ent.Type == "bot_command" && ent.Offset == 0 {
			cmd = strings.Split(m.Text, "@")[0]
			cmd = strings.Split(cmd, " ")[0]
			break
		}
	}
	if cmd == "" { return false }

	group, err := h.botRepo.GetGroupByChatID(ctx, m.Chat.ID)
	if err != nil { return false }

	bot, _ := h.botRepo.GetBotByID(ctx, group.BotID)
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

	lang := i18n.DetectLanguage(m.From.LanguageCode)

	switch cmd {
	case "/ban":
		return h.adminBan(ctx, tg, m, lang, group.ID)
	case "/unban":
		return h.adminUnban(ctx, tg, m, lang, group.ID)
	case "/mute":
		return h.adminMute(ctx, tg, m, lang, group.ID)
	case "/unmute":
		return h.adminUnmute(ctx, tg, m, lang, group.ID)
	case "/warn":
		return h.adminWarn(ctx, tg, m, lang, group.ID)
	case "/rules":
		return h.adminRules(ctx, tg, m, group.ID)
	case "/report":
		return h.adminReport(ctx, tg, m, bot.OwnerUserID)
	case "/pin":
		return h.adminPin(ctx, tg, m)
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

func (h *WebhookHandler) adminBan(_ context.Context, tg *telegram.BotAPIClient, m *Message, _ string, _ uuid.UUID) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 { return false }
	_ = tg.BanChatMember(m.Chat.ID, targetID, 0, false)
	_ = tg.SendMessage(m.Chat.ID, fmt.Sprintf("🚫 *User Banned*\n\nUser: [%s](tg://user?id=%d)", targetName, targetID), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminUnban(_ context.Context, tg *telegram.BotAPIClient, m *Message, _ string, _ uuid.UUID) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 { return false }
	_ = tg.UnbanChatMember(m.Chat.ID, targetID, false)
	_ = tg.SendMessage(m.Chat.ID, fmt.Sprintf("✅ *User Unbanned*\n\nUser: [%s](tg://user?id=%d)", targetName, targetID), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminMute(_ context.Context, tg *telegram.BotAPIClient, m *Message, _ string, _ uuid.UUID) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 { return false }
	until := time.Now().Add(24 * time.Hour).Unix()
	_ = tg.RestrictChatMember(m.Chat.ID, targetID, until)
	_ = tg.SendMessage(m.Chat.ID, fmt.Sprintf("🔇 *User Muted (24h)*\n\nUser: [%s](tg://user?id=%d)", targetName, targetID), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminUnmute(_ context.Context, tg *telegram.BotAPIClient, m *Message, _ string, _ uuid.UUID) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 { return false }
	
	_ = tg.UnrestrictChatMember(m.Chat.ID, targetID)
	_ = tg.SendMessage(m.Chat.ID, fmt.Sprintf("🔊 *User Unmuted*\n\nUser: [%s](tg://user?id=%d)", targetName, targetID), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminWarn(ctx context.Context, _ *telegram.BotAPIClient, m *Message, _ string, _ uuid.UUID) bool {
	targetID, _ := h.getTarget(m)
	if targetID == 0 { return false }

	// Use existing moderation logic for warning
	violation := &botmgmt.Violation{
		Type: "admin_warn",
		Action: "warn",
		Message: "Warned by administrator",
	}
	h.executeViolationAction(ctx, m.Chat.ID, targetID, m.MessageID, m.MessageThreadID, violation)
	return true
}

func (h *WebhookHandler) adminRules(ctx context.Context, tg *telegram.BotAPIClient, m *Message, groupID uuid.UUID) bool {
	settings, _ := h.moderator.GetSettings(ctx, groupID)
	if settings == nil { return false }
	
	var ct repository.SettingsCustomTexts
	json.Unmarshal(settings.CustomTexts, &ct)
	
	if ct.RulesText == "" {
		_ = tg.SendMessage(m.Chat.ID, "⚠️ Rules are not set for this group.", &m.MessageID, m.MessageThreadID)
		return true
	}
	
	_ = tg.SendMessage(m.Chat.ID, fmt.Sprintf("📜 *Group Rules*\n\n%s", ct.RulesText), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminReport(_ context.Context, tg *telegram.BotAPIClient, m *Message, ownerID int64) bool {
	if m.ReplyToMessage == nil { return false }
	
	reportMsg := fmt.Sprintf("🚨 *Report Received*\n\nGroup: %s\nReporter: %d\nOffender: %d\nMessage: [Link](https://t.me/c/%s/%d)", 
		m.Chat.Title, m.From.ID, m.ReplyToMessage.From.ID, strings.TrimPrefix(fmt.Sprintf("%d", m.Chat.ID), "-100"), m.ReplyToMessage.MessageID)
	
	_ = tg.SendMessage(ownerID, reportMsg, nil, nil)
	_ = tg.SendMessage(m.Chat.ID, "✅ Report sent to administrators.", &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminPin(_ context.Context, tg *telegram.BotAPIClient, m *Message) bool {
	if m.ReplyToMessage == nil { return false }
	_ = tg.PinChatMessage(m.Chat.ID, m.ReplyToMessage.MessageID)
	return true
}

func (h *WebhookHandler) getTarget(m *Message) (int64, string) {
	if m.ReplyToMessage != nil && m.ReplyToMessage.From != nil {
		name := m.ReplyToMessage.From.FirstName
		if m.ReplyToMessage.From.Username != "" { name = "@" + m.ReplyToMessage.From.Username }
		return m.ReplyToMessage.From.ID, name
	}
	return 0, ""
}
func (h *WebhookHandler) handleCallbackQuery(ctx context.Context, cq *CallbackQuery) {
	if strings.HasPrefix(cq.Data, "captcha:") {
		parts := strings.Split(cq.Data, ":")
		if len(parts) < 2 { return }
		expectedUserID := parts[1]
		
		group, err := h.botRepo.GetGroupByChatID(ctx, cq.Message.Chat.ID)
		if err != nil { return }
		bot, _ := h.botRepo.GetBotByID(ctx, group.BotID)

		if fmt.Sprintf("%d", cq.From.ID) != expectedUserID {
			_ = h.moderator.AnswerCallbackQuery(ctx, bot, cq.ID, "This is not for you!", false)
			return
		}

		tg, _ := h.moderator.GetTelegramClient(ctx, bot)

		_ = tg.UnrestrictChatMember(cq.Message.Chat.ID, cq.From.ID)
		_ = tg.DeleteMessage(cq.Message.Chat.ID, cq.Message.MessageID)
		_ = tg.AnswerCallbackQuery(cq.ID, "Verification successful! Welcome.", false)

		// Clear pending captcha in Redis
		cache := h.moderator.GetCache()
		if cache != nil && cache.Client != nil {
			pendingKey := fmt.Sprintf("captcha_pending:%d:%d", cq.Message.Chat.ID, cq.From.ID)
			cache.Client.Del(ctx, pendingKey)
		}
	}
}

func (h *WebhookHandler) getForwardID(m *Message) int64 {
	if m.ForwardFromChat != nil {
		return m.ForwardFromChat.ID
	}
	return 0
}

func (h *WebhookHandler) handleJoinCaptcha(ctx context.Context, m *Message, user *User) {
	group, err := h.botRepo.GetGroupByChatID(ctx, m.Chat.ID)
	if err != nil { return }
	
	settings, _ := h.moderator.GetSettings(ctx, group.ID)
	if settings == nil { return }
	
	var mm repository.SettingsMandatoryMembership
	var general repository.SettingsGeneral
	json.Unmarshal(settings.MandatoryMembership, &mm)
	json.Unmarshal(settings.General, &general)
	
	if !mm.VerificationEnabled && !general.VerifyMembers { return }

	bot, _ := h.botRepo.GetBotByID(ctx, group.BotID)
	tg, _ := h.moderator.GetTelegramClient(ctx, bot)

	// 1. Restrict member
	_ = tg.RestrictChatMember(m.Chat.ID, user.ID, 0)

	// 2. Send Captcha
	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{{
				"text":          "✅ I am not a robot",
				"callback_data": fmt.Sprintf("captcha:%d", user.ID),
			}},
		},
	}
	
	welcome := fmt.Sprintf("👋 Welcome [%s](tg://user?id=%d)!\n\nPlease click the button below to verify you are human.", user.FirstName, user.ID)
	captchaMsg, sendErr := tg.SendMessageWithMarkup(m.Chat.ID, welcome, markup, m.MessageThreadID)
	if sendErr == nil && captchaMsg != nil {
		cache := h.moderator.GetCache()
		if cache != nil && cache.Client != nil {
			pendingKey := fmt.Sprintf("captcha_pending:%d:%d", m.Chat.ID, user.ID)
			cache.Client.Set(ctx, pendingKey, captchaMsg.MessageID, 10*time.Minute)

			go func(chatID, userID int64, msgID int, botInfo *repository.ManagedBot) {
				time.Sleep(5 * time.Minute)
				bgCtx := context.Background()

				val, err := cache.Client.Get(bgCtx, pendingKey).Result()
				if err == nil && val == fmt.Sprintf("%d", msgID) {
					tgClient, err := h.moderator.GetTelegramClient(bgCtx, botInfo)
					if err == nil {
						_ = tgClient.BanChatMember(chatID, userID, time.Now().Add(30*time.Second).Unix(), false)
						_ = tgClient.UnbanChatMember(chatID, userID, true)
						_ = tgClient.DeleteMessage(chatID, msgID)
					}
					cache.Client.Del(bgCtx, pendingKey)
				}
			}(m.Chat.ID, user.ID, captchaMsg.MessageID, bot)
		}
	}
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

	_ = tg.SendMessage(m.Chat.ID, infoText, &m.MessageID, m.MessageThreadID)
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

	_ = tg.SendMessage(m.Chat.ID, statsText, &m.MessageID, m.MessageThreadID)
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

	_ = tg.DeleteMessage(m.Chat.ID, m.MessageID)

	go func() {
		for i := 1; i <= n; i++ {
			msgID := m.MessageID - i
			_ = tg.DeleteMessage(m.Chat.ID, msgID)
			if n > 20 {
				time.Sleep(50 * time.Millisecond)
			}
		}
		successMsg := "🧹 Cleaned %d messages."
		if lang == "fa" {
			successMsg = "🧹 تعداد %d پیام پاکسازی شد."
		}
		res, err := tg.SendMessageWithResult(m.Chat.ID, fmt.Sprintf(successMsg, n), nil, m.MessageThreadID)
		if err == nil && res != nil {
			time.Sleep(5 * time.Second)
			_ = tg.DeleteMessage(m.Chat.ID, res.MessageID)
		}
	}()

	return true
}

func (h *WebhookHandler) sendBotMessage(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, text string, replyMarkup map[string]interface{}, threadID *int, general repository.SettingsGeneral) {
	var msg *telegram.MessageResult
	var err error
	if replyMarkup != nil {
		msg, err = tg.SendMessageWithMarkup(chatID, text, replyMarkup, threadID)
	} else {
		msg, err = tg.SendMessageWithResult(chatID, text, nil, threadID)
	}

	if err == nil && msg != nil && general.AutoDeleteBot && general.AutoDeleteDelay > 0 {
		go func(cID int64, mID int, delay int) {
			time.Sleep(time.Duration(delay) * time.Second)
			_ = tg.DeleteMessage(cID, mID)
		}(chatID, msg.MessageID, general.AutoDeleteDelay)
	}
}

func (h *WebhookHandler) handleChannelPost(ctx context.Context, bot *repository.ManagedBot, m *Message) {
	if m == nil || m.Chat == nil {
		return
	}
	slog.Info("Processing channel post", "chat_id", m.Chat.ID, "message_id", m.MessageID)

	text := m.Text
	if text == "" {
		text = m.Caption
	}

	err := h.channelService.ProcessChannelPost(ctx, m.Chat.ID, text, m.ReplyMarkup)
	if err != nil {
		slog.Error("Failed to process channel post in service", "error", err)
	}
}

func (h *WebhookHandler) handleChatJoinRequest(ctx context.Context, bot *repository.ManagedBot, req *ChatJoinRequest) {
	if req == nil {
		return
	}
	slog.Info("Processing chat join request", "chat_id", req.Chat.ID, "user_id", req.From.ID)

	token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	if err != nil {
		return
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/approveChatJoinRequest", token)
	payload := map[string]interface{}{
		"chat_id": req.Chat.ID,
		"user_id": req.From.ID,
	}
	jsonBody, _ := json.Marshal(payload)
	_, err = http.Post(url, "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		slog.Error("Failed to approve chat join request", "error", err)
	} else {
		slog.Info("Successfully approved join request", "chat_id", req.Chat.ID, "user_id", req.From.ID)
	}
}
