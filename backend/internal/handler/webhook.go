package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type WebhookHandler struct {
	db        *repository.Database
	moderator *botmgmt.ModeratorService
	botRepo   *repository.BotRepo
}

func NewWebhookHandler(db *repository.Database, moderator *botmgmt.ModeratorService, botRepo *repository.BotRepo) *WebhookHandler {
	return &WebhookHandler{db: db, moderator: moderator, botRepo: botRepo}
}

type TelegramUpdate struct {
	UpdateID          int                `json:"update_id"`
	PreCheckoutQuery  *PreCheckoutQuery  `json:"pre_checkout_query"`
	Message           *Message           `json:"message"`
	EditedMessage     *Message           `json:"edited_message"`
	MyChatMember      *ChatMemberUpdated `json:"my_chat_member"`
	CallbackQuery     *CallbackQuery     `json:"callback_query"`
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
	Sticker           *interface{}       `json:"sticker"`
	Location          *interface{}       `json:"location"`
	Audio             *interface{}       `json:"audio"`
	Voice             *interface{}       `json:"voice"`
	Document          *interface{}       `json:"document"`
	Animation         *interface{}       `json:"animation"`
	Video             *interface{}       `json:"video"`
	Poll              *interface{}       `json:"poll"`
	Game              *interface{}       `json:"game"`
	Entities          []MessageEntity    `json:"entities"`
	ReplyToMessage    *Message           `json:"reply_to_message"`
	ForwardFromChat   *Chat              `json:"forward_from_chat"`
	ViaBot            *User              `json:"via_bot"`
	ReplyMarkup       *interface{}       `json:"reply_markup"`
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
		log.Printf("Error decoding update: %v", err)
		return
	}

	// 0. Idempotency Check (BUG #16 - Hardened)
	ctx := r.Context()
	cacheKey := fmt.Sprintf("update:%d", update.UpdateID)
	cache := h.moderator.GetCache()
	if cache != nil && cache.Client != nil {
		// Use SETNX as a "processing" lock with short TTL
		locked, err := cache.Client.SetNX(ctx, cacheKey, "processing", 2*time.Minute).Result()
		if err != nil {
			log.Printf("⚠️ Redis error in idempotency: %v", err)
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
		order, err := h.db.GetOrderByPayload(ctx, update.PreCheckoutQuery.InvoicePayload)
		if err != nil {
			log.Printf("⚠️ Pre-checkout failed: Order not found for payload %s", update.PreCheckoutQuery.InvoicePayload)
			h.answerPreCheckout(update.PreCheckoutQuery.ID, false, "Order verification failed")
		} else if order.Amount != update.PreCheckoutQuery.TotalAmount {
			log.Printf("⚠️ Pre-checkout failed: Amount mismatch. Expected %d, got %d", order.Amount, update.PreCheckoutQuery.TotalAmount)
			h.answerPreCheckout(update.PreCheckoutQuery.ID, false, "Price mismatch")
		} else {
			h.answerPreCheckout(update.PreCheckoutQuery.ID, true, "")
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	// 2. Handle MyChatMember (Onboarding/Setup)
	if update.MyChatMember != nil {
		ctx := r.Context()
		if update.MyChatMember.NewChatMember.Status == "administrator" || update.MyChatMember.NewChatMember.Status == "member" {
			log.Printf("🤖 Bot added to group %d (%s)", update.MyChatMember.Chat.ID, update.MyChatMember.Chat.Type)
			// Trigger onboarding flow
			h.handleBotAddedToGroup(ctx, &update.MyChatMember.Chat, update.MyChatMember.From.ID)
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	// 3. Handle Successful Payment
	if update.Message != nil && update.Message.SuccessfulPayment != nil {
		pay := update.Message.SuccessfulPayment
		log.Printf("💰 Successful payment received for payload: %s", pay.InvoicePayload)
		err := h.db.UpdateOrderStatus(context.Background(), pay.InvoicePayload, "paid", pay.TelegramPaymentChargeID)
		if err == nil {
			// ✅ Payment Notification
			lang := i18n.DetectLanguage(bot.Status)
			settings, _ := h.moderator.GetSettings(ctx, bot.ID)
			if settings != nil {
				var general repository.SettingsGeneral
				if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
					lang = general.Language
				}
			}
			tg, _ := h.moderator.GetTelegramClient(ctx, bot)
			msg := i18n.T(lang, "notifications.payment_success", map[string]interface{}{"date": time.Now().Add(30 * 24 * time.Hour).Format("2006-01-02")})
			_ = tg.SendMessage(bot.OwnerUserID, msg, nil)
		} else {
			log.Printf("❌ Failed to update order status: %v", err)
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	// 3. Handle Chat Member Updates (Bot Status)
	if update.MyChatMember != nil {
		ctx := r.Context()
		chat := update.MyChatMember.Chat
		newStatus := update.MyChatMember.NewChatMember.Status
		oldStatus := update.MyChatMember.OldChatMember.Status

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
				_ = tg.SendMessage(bot.OwnerUserID, msg, nil)
			} else if newStatus == "member" && (oldStatus == "administrator" || oldStatus == "creator") {
				msg := i18n.T(lang, "notifications.admin_revoked_group")
				_ = tg.SendMessage(chat.ID, msg, nil)
				ownerMsg := i18n.T(lang, "notifications.admin_revoked", map[string]interface{}{"group": chat.Title})
				_ = tg.SendMessage(bot.OwnerUserID, ownerMsg, nil)
			}
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	// 4. Handle Join/Leave Events (BUG #10, #11)
	if update.Message != nil && (len(update.Message.NewChatMembers) > 0 || update.Message.LeftChatMember != nil) {
		ctx := r.Context()
		group, err := h.botRepo.GetGroupByChatID(ctx, update.Message.Chat.ID)
		if err == nil {
			if len(update.Message.NewChatMembers) > 0 {
				for _, user := range update.Message.NewChatMembers {
					h.moderator.LogMemberEvent(ctx, group.ID, "member_join", &user.ID)
					// 🛡️ Captcha (BUG #10)
					h.handleJoinCaptcha(ctx, update.Message, &user)
				}
				// Handle Welcome Message (BUG #8)
				h.handleWelcomeMessage(ctx, update.Message)
			}
			if update.Message.LeftChatMember != nil {
				h.moderator.LogMemberEvent(ctx, group.ID, "member_leave", &update.Message.LeftChatMember.ID)
			}

			// Handle HideJoinLeave (BUG #8)
			settings, _ := h.moderator.GetSettings(ctx, group.ID)
			if settings != nil {
				var general repository.SettingsGeneral
				json.Unmarshal(settings.General, &general)
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
				h.handlePrivateCommand(ctx, msg)
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
			log.Printf("⚠️ Moderation error: %v", err)
		} else if violation != nil {
			log.Printf("🚫 Violation detected: %s in chat %d by user %d", violation.Type, msg.Chat.ID, msg.From.ID)
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
					_ = tg.SendMessage(bot.OwnerUserID, alert, nil)
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
			_ = tg.SendMessage(msg.Chat.ID, milestoneMsg, nil)
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

	return &botmgmt.MessageContext{
		ChatID:             m.Chat.ID,
		UserID:             m.From.ID,
		MessageID:          m.MessageID,
		Text:               m.Text,
		Caption:            m.Caption,
		IsBot:              m.From.IsBot,
		HasPhoto:           len(m.Photo) > 0,
		HasSticker:         m.Sticker != nil,
		HasLocation:        m.Location != nil,
		HasAudio:           m.Audio != nil,
		HasVoice:           m.Voice != nil,
		HasDocument:        m.Document != nil,
		HasAnimation:       m.Animation != nil,
		HasVideo:           m.Video != nil,
		HasPoll:            m.Poll != nil,
		HasGame:            m.Game != nil,
		IsForward:          m.ForwardFromChat != nil,
		ForwardFromChannel: m.ForwardFromChat != nil && m.ForwardFromChat.Type == "channel",
		ForwardFromChatID:  h.getForwardID(m),
		HasInlineKeyboard:  m.ReplyMarkup != nil,
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
	penaltyMsg := violation.Message
	if violation.CurrentWarnings > 0 {
		penaltyMsg = fmt.Sprintf("%s (Warning %d/%d)", violation.Message, violation.CurrentWarnings, violation.WarningThreshold)
	}

	switch {
	case strings.HasPrefix(violation.Action, "mute"):
		_ = tgClient.RestrictChatMember(chatID, userID, until)
		_ = tgClient.SendMessage(chatID, fmt.Sprintf("🔇 User restricted for %s due to: %s", durationText, penaltyMsg), nil, threadID)
	case violation.Action == "kick":
		_ = tgClient.UnbanChatMember(chatID, userID, true)
		_ = tgClient.SendMessage(chatID, fmt.Sprintf("👢 User kicked due to: %s", penaltyMsg), nil, threadID)
	case violation.Action == "ban":
		_ = tgClient.BanChatMember(chatID, userID, 0, false)
		_ = tgClient.SendMessage(chatID, fmt.Sprintf("🚫 User banned due to: %s", penaltyMsg), nil, threadID)
	case violation.Action == "delete":
		if violation.CurrentWarnings > 0 {
			_ = tgClient.SendMessage(chatID, fmt.Sprintf("⚠️ %s", penaltyMsg), nil, threadID)
		}
	}
}

func (h *WebhookHandler) answerPreCheckout(id string, ok bool, errorMessage string) {
	botToken := os.Getenv("BOT_TOKEN")
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
		log.Printf("❌ Failed to answer pre-checkout: %v", err)
	}
}

func (h *WebhookHandler) handlePrivateCommand(_ context.Context, m *Message) {
	if strings.HasPrefix(m.Text, "/start") {
		appURL := os.Getenv("APP_URL")
		if appURL == "" {
			appURL = "https://t.me/ifragment_bot/app"
		}
		
		userName := m.From.FirstName
		lang := i18n.DetectLanguage(m.From.LanguageCode)
		welcome := i18n.T(lang, "onboarding.welcome_pv", userName)
		
		botToken := os.Getenv("BOT_TOKEN")
		tg := telegram.NewBotAPIClient(botToken)
		_ = tg.SendMessage(m.Chat.ID, welcome, nil, m.MessageThreadID)
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

func (h *WebhookHandler) handleBotAddedToGroup(ctx context.Context, chat *Chat, _ int64) {
	bot, err := h.botRepo.GetBotByChatID(ctx, chat.ID)
	if err != nil {
		return
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
		msg1, _ := tg.SendMessageWithResult(chat.ID, welcome, nil)
		if msg1 != nil { msgIDs = append(msgIDs, msg1.MessageID) }

		time.Sleep(1 * time.Second)
		// 2. Admin request
		adminMsg := i18n.T(lang, "onboarding.admin_req")
		msg2, _ := tg.SendMessageWithResult(chat.ID, adminMsg, nil)
		if msg2 != nil { msgIDs = append(msgIDs, msg2.MessageID) }

		time.Sleep(2 * time.Second)
		// 3. Default features
		appURL := os.Getenv("APP_URL")
		if appURL == "" {
			appURL = "https://t.me/ifragment_bot/app"
		}
		dashboardURL := fmt.Sprintf("%s?startapp=group_%s", appURL, bot.ID)
		setupMsg := i18n.T(lang, "onboarding.features", dashboardURL)
		msg3, _ := tg.SendMessageWithResult(chat.ID, setupMsg, nil)
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

	// Handle all new members
	for _, user := range m.NewChatMembers {
		if user.IsBot { continue }
		
		text := ct.WelcomeText
		// Improved placeholders
		name := user.FirstName
		if user.Username != "" { name = "@" + user.Username }
		
		text = strings.ReplaceAll(text, "{user}", fmt.Sprintf("[%s](tg://user?id=%d)", name, user.ID))
		text = strings.ReplaceAll(text, "{group}", m.Chat.Title)
		text = strings.ReplaceAll(text, "{chat_title}", m.Chat.Title)

		_ = tg.SendMessage(m.Chat.ID, text, nil, m.MessageThreadID)
	}
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

	// Admin Check
	if !h.isAdmin(ctx, tg, m.Chat.ID, m.From.ID) {
		return false
	}

	lang := i18n.DetectLanguage(m.From.LanguageCode)

	switch cmd {
	case "/ban":
		return h.adminBan(ctx, tg, m, lang)
	case "/unban":
		return h.adminUnban(ctx, tg, m, lang)
	case "/mute":
		return h.adminMute(ctx, tg, m, lang)
	case "/unmute":
		return h.adminUnmute(ctx, tg, m, lang)
	case "/warn":
		return h.adminWarn(ctx, tg, m, lang, group.ID)
	case "/rules":
		return h.adminRules(ctx, tg, m, group.ID)
	case "/report":
		return h.adminReport(ctx, tg, m, bot.OwnerUserID)
	case "/pin":
		return h.adminPin(ctx, tg, m)
	}

	return false
}

func (h *WebhookHandler) isAdmin(ctx context.Context, tg *telegram.BotAPIClient, chatID, userID int64) bool {
	status, _ := h.moderator.GetChatMemberCached(ctx, tg, chatID, userID)
	return status == "administrator" || status == "creator"
}

func (h *WebhookHandler) adminBan(ctx context.Context, tg *telegram.BotAPIClient, m *Message, lang string) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 { return false }
	
	_ = tg.BanChatMember(m.Chat.ID, targetID, 0, false)
	_ = tg.SendMessage(m.Chat.ID, fmt.Sprintf("🚫 *User Banned*\n\nUser: [%s](tg://user?id=%d)", targetName, targetID), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminUnban(ctx context.Context, tg *telegram.BotAPIClient, m *Message, lang string) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 { return false }
	
	_ = tg.UnbanChatMember(m.Chat.ID, targetID, false)
	_ = tg.SendMessage(m.Chat.ID, fmt.Sprintf("✅ *User Unbanned*\n\nUser: [%s](tg://user?id=%d)", targetName, targetID), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminMute(ctx context.Context, tg *telegram.BotAPIClient, m *Message, lang string) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 { return false }
	
	until := time.Now().Add(24 * time.Hour).Unix()
	_ = tg.RestrictChatMember(m.Chat.ID, targetID, until)
	_ = tg.SendMessage(m.Chat.ID, fmt.Sprintf("🔇 *User Muted (24h)*\n\nUser: [%s](tg://user?id=%d)", targetName, targetID), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminUnmute(ctx context.Context, tg *telegram.BotAPIClient, m *Message, lang string) bool {
	targetID, targetName := h.getTarget(m)
	if targetID == 0 { return false }
	
	_ = tg.UnrestrictChatMember(m.Chat.ID, targetID)
	_ = tg.SendMessage(m.Chat.ID, fmt.Sprintf("🔊 *User Unmuted*\n\nUser: [%s](tg://user?id=%d)", targetName, targetID), &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminWarn(ctx context.Context, tg *telegram.BotAPIClient, m *Message, lang string, groupID uuid.UUID) bool {
	targetID, targetName := h.getTarget(m)
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

func (h *WebhookHandler) adminReport(ctx context.Context, tg *telegram.BotAPIClient, m *Message, ownerID int64) bool {
	if m.ReplyToMessage == nil { return false }
	
	reportMsg := fmt.Sprintf("🚨 *Report Received*\n\nGroup: %s\nReporter: %d\nOffender: %d\nMessage: [Link](https://t.me/c/%d/%d)", 
		m.Chat.Title, m.From.ID, m.ReplyToMessage.From.ID, strings.TrimPrefix(fmt.Sprintf("%d", m.Chat.ID), "-100"), m.ReplyToMessage.MessageID)
	
	_ = tg.SendMessage(ownerID, reportMsg, nil)
	_ = tg.SendMessage(m.Chat.ID, "✅ Report sent to administrators.", &m.MessageID, m.MessageThreadID)
	return true
}

func (h *WebhookHandler) adminPin(ctx context.Context, tg *telegram.BotAPIClient, m *Message) bool {
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
		
		if fmt.Sprintf("%d", cq.From.ID) != expectedUserID {
			_ = h.moderator.AnswerCallbackQuery(cq.ID, "This is not for you!", false)
			return
		}

		group, err := h.botRepo.GetGroupByChatID(ctx, cq.Message.Chat.ID)
		if err != nil { return }
		
		bot, _ := h.botRepo.GetBotByID(ctx, group.BotID)
		tg, _ := h.moderator.GetTelegramClient(ctx, bot)

		_ = tg.UnrestrictChatMember(cq.Message.Chat.ID, cq.From.ID)
		_ = tg.DeleteMessage(cq.Message.Chat.ID, cq.Message.MessageID)
		_ = tg.AnswerCallbackQuery(cq.ID, "Verification successful! Welcome.", false)
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
	json.Unmarshal(settings.MandatoryMembership, &mm)
	
	if !mm.VerificationEnabled { return }

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
	_, _ = tg.SendMessageWithMarkup(m.Chat.ID, welcome, markup, m.MessageThreadID)
}
