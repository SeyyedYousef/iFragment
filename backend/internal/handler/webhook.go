package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"
	"ifragment-backend/internal/client/telegram"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
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

type Message struct {
	MessageID         int                `json:"message_id"`
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
	ID       int64  `json:"id"`
	IsBot    bool   `json:"is_bot"`
	Username string `json:"username,omitempty"`
}

type Chat struct {
	ID   int64  `json:"id"`
	Type string `json:"type"`
}

type SuccessfulPayment struct {
	InvoicePayload           string `json:"invoice_payload"`
	TelegramPaymentChargeID  string `json:"telegram_payment_charge_id"`
}

func (h *WebhookHandler) HandleTelegramWebhook(w http.ResponseWriter, r *http.Request) {
	// Security: Validate secret token if provided by Telegram
	secret := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
	expectedSecret := os.Getenv("WEBHOOK_SECRET_TOKEN")
	if expectedSecret != "" && secret != expectedSecret {
		RespondError(w, r, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	var update TelegramUpdate
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		log.Printf("Error decoding update: %v", err)
		return
	}

	// 0. Idempotency Check (BUG #16)
	ctx := r.Context()
	cacheKey := fmt.Sprintf("update:%d", update.UpdateID)
	if h.moderator.GetCache() != nil {
		exists, _ := h.moderator.GetCache().Client.Exists(ctx, cacheKey).Result()
		if exists > 0 {
			w.WriteHeader(http.StatusOK)
			return
		}
		h.moderator.GetCache().Client.Set(ctx, cacheKey, "1", 10*time.Minute)
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
		if err != nil {
			log.Printf("❌ Failed to update order status: %v", err)
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
			}
		}

		// Regular Moderation
		violation, err := h.moderator.ValidateMessage(ctx, mc)
		if err != nil {
			log.Printf("⚠️ Moderation error: %v", err)
		} else if violation != nil {
			log.Printf("🚫 Violation detected: %s in chat %d by user %d", violation.Type, msg.Chat.ID, msg.From.ID)
			h.executeViolationAction(ctx, msg.Chat.ID, msg.From.ID, msg.MessageID, violation)
		}
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
		HasInlineKeyboard:  m.ReplyMarkup != nil,
		HasReply:           m.ReplyToMessage != nil,
		HasViaBot:          m.ViaBot != nil,
		IsCommand:          isCommand,
		Username:           m.From.Username,
	}
}

func (h *WebhookHandler) executeViolationAction(ctx context.Context, chatID int64, userID int64, messageID int, violation *botmgmt.Violation) {
	bot, err := h.botRepo.GetBotByChatID(ctx, chatID)
	if err != nil {
		return
	}
	token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	if err != nil {
		return
	}
	tgClient := telegram.NewBotAPIClient(token)

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
		_ = tgClient.SendMessage(chatID, fmt.Sprintf("🔇 User restricted for %s due to: %s", durationText, penaltyMsg), nil)
	case violation.Action == "kick":
		_ = tgClient.UnbanChatMember(chatID, userID, true)
		_ = tgClient.SendMessage(chatID, fmt.Sprintf("👢 User kicked due to: %s", penaltyMsg), nil)
	case violation.Action == "ban":
		_ = tgClient.BanChatMember(chatID, userID, 0, false)
		_ = tgClient.SendMessage(chatID, fmt.Sprintf("🚫 User banned due to: %s", penaltyMsg), nil)
	case violation.Action == "delete":
		if violation.CurrentWarnings > 0 {
			_ = tgClient.SendMessage(chatID, fmt.Sprintf("⚠️ %s", penaltyMsg), nil)
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
		appURL := "https://t.me/ifragment_bot/app"
		welcome := "👋 *Welcome to iFragment!*\n\nI am the most advanced group management bot. Add me to your group to start protecting it from spam and managing your community.\n\n🚀 [Open Dashboard](" + appURL + ")"
		
		botToken := os.Getenv("BOT_TOKEN")
		tg := telegram.NewBotAPIClient(botToken)
		_ = tg.SendMessage(m.Chat.ID, welcome, nil)
	}
}

func (h *WebhookHandler) handleGroupSettingsCommand(ctx context.Context, m *Message) {
	group, err := h.botRepo.GetGroupByChatID(ctx, m.Chat.ID)
	if err != nil {
		return
	}

	bot, _ := h.botRepo.GetBotByID(ctx, group.BotID)
	token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)

	status, _ := tg.GetChatMember(m.Chat.ID, m.From.ID)
	if status != "administrator" && status != "creator" {
		return
	}

	appURL := fmt.Sprintf("https://t.me/ifragment_bot/app?startapp=group_%s", group.ID)
	msg := fmt.Sprintf("⚙️ *Group Settings*\n\nYou can manage this group's settings via the dashboard:\n\n🔗 [Manage Group](%s)", appURL)
	_ = tg.SendMessage(m.Chat.ID, msg, &m.MessageID)
}

func (h *WebhookHandler) handleBotAddedToGroup(ctx context.Context, chat *Chat, _ int64) {
	bot, err := h.botRepo.GetBotByChatID(ctx, chat.ID)
	if err != nil {
		return
	}
	token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)

	// Sequence of onboarding messages (BUG #8)
	welcome := "✨ *iFragment has been added to the group!*\n\nI am ready to protect and manage your community."
	_ = tg.SendMessage(chat.ID, welcome, nil)

	time.Sleep(1 * time.Second)
	adminMsg := "⚠️ *Important: Admin Permissions Required*\n\nPlease promote me to administrator with 'Delete Messages' and 'Restrict Members' permissions to enable full protection."
	_ = tg.SendMessage(chat.ID, adminMsg, nil)

	time.Sleep(2 * time.Second)
	setupMsg := "🚀 *Get Started:*\nUse /settings to configure the bot or open the [Dashboard](https://t.me/ifragment_bot/app)."
	_ = tg.SendMessage(chat.ID, setupMsg, nil)
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
	token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)

	// Replace placeholders
	text := ct.WelcomeText
	user := m.NewChatMembers[0]
	text = strings.ReplaceAll(text, "{user}", fmt.Sprintf("[%s](tg://user?id=%d)", user.Username, user.ID))
	text = strings.ReplaceAll(text, "{group}", m.Chat.Type)

	_ = tg.SendMessage(m.Chat.ID, text, nil)
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
