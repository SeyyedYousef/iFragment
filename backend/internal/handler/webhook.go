package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/repository"
	"log"
	"net/http"
	"os"
)

type WebhookHandler struct {
	db *repository.Database
}

func NewWebhookHandler(db *repository.Database) *WebhookHandler {
	return &WebhookHandler{db: db}
}

type TelegramUpdate struct {
	UpdateID          int               `json:"update_id"`
	PreCheckoutQuery  *PreCheckoutQuery  `json:"pre_checkout_query"`
	Message           *Message           `json:"message"`
}

type PreCheckoutQuery struct {
	ID               string `json:"id"`
	InvoicePayload   string `json:"invoice_payload"`
	TotalAmount      int    `json:"total_amount"`
}

type Message struct {
	SuccessfulPayment *SuccessfulPayment `json:"successful_payment"`
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
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var update TelegramUpdate
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		log.Printf("Error decoding update: %v", err)
		return
	}

	// 1. Handle Pre-Checkout
	if update.PreCheckoutQuery != nil {
		h.answerPreCheckout(update.PreCheckoutQuery.ID, true, "")
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
	}

	w.WriteHeader(http.StatusOK)
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
