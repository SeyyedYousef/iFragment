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
	UpdateID          int               `json:"update_id"`
	PreCheckoutQuery  *PreCheckoutQuery  `json:"pre_checkout_query"`
	Message           *Message           `json:"message"`
	EditedMessage     *Message           `json:"edited_message"`
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
}

type MessageEntity struct {
	Type   string `json:"type"`
	Offset int    `json:"offset"`
	Length int    `json:"length"`
}

type User struct {
	ID    int64 `json:"id"`
	IsBot bool  `json:"is_bot"`
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

	// 2. Handle Successful Payment
	if update.Message != nil && update.Message.SuccessfulPayment != nil {
		pay := update.Message.SuccessfulPayment
		log.Printf("💰 Successful payment received for payload: %s", pay.InvoicePayload)
		
		// Update DB
		err := h.db.UpdateOrderStatus(context.Background(), pay.InvoicePayload, "paid", pay.TelegramPaymentChargeID)
		if err != nil {
			log.Printf("❌ Failed to update order status: %v", err)
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	// 3. Handle Regular/Edited Messages for Moderation
	msg := update.Message
	if msg == nil {
		msg = update.EditedMessage
	}

	if msg != nil && msg.Chat != nil && msg.From != nil {
		ctx := r.Context()
		mc := h.mapToModeratorContext(msg)
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

	// 1. Delete message if required
	if violation.Action == "delete" || violation.Action == "mute" || violation.Action == "kick" || violation.Action == "ban" {
		_ = tgClient.DeleteMessage(chatID, messageID)
	}

	// 2. Execute Penalty
	penaltyMsg := violation.Message
	if violation.CurrentWarnings > 0 {
		penaltyMsg = fmt.Sprintf("%s (Warning %d/%d)", violation.Message, violation.CurrentWarnings, violation.WarningThreshold)
	}

	switch violation.Action {
	case "mute":
		until := time.Now().Add(24 * time.Hour).Unix()
		_ = tgClient.RestrictChatMember(chatID, userID, until)
		_ = tgClient.SendMessage(chatID, fmt.Sprintf("🔇 User restricted for 24h due to: %s", penaltyMsg), &messageID)
	case "kick":
		_ = tgClient.RestrictChatMember(chatID, userID, time.Now().Add(60*time.Second).Unix())
		_ = tgClient.SendMessage(chatID, fmt.Sprintf("👢 User kicked due to: %s", penaltyMsg), nil)
	case "ban":
		_ = tgClient.RestrictChatMember(chatID, userID, time.Now().Add(365*24*time.Hour).Unix())
		_ = tgClient.SendMessage(chatID, fmt.Sprintf("🚫 User banned due to: %s", penaltyMsg), nil)
	case "delete":
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
