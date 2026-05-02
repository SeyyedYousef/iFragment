package handler

import (
	"encoding/json"
	"ifragment-backend/internal/repository"
	"log"
	"net/http"
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
	var update TelegramUpdate
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		log.Printf("Error decoding update: %v", err)
		return
	}

	// 1. Handle Pre-Checkout (MUST answer within 10 seconds)
	if update.PreCheckoutQuery != nil {
		h.answerPreCheckout(update.PreCheckoutQuery.ID)
		return
	}

	// 2. Handle Successful Payment
	if update.Message != nil && update.Message.SuccessfulPayment != nil {
		pay := update.Message.SuccessfulPayment
		log.Printf("💰 Successful payment received for payload: %s", pay.InvoicePayload)
		
		// Mark order as paid in DB (Phase C: DB integration)
		// For now, we log and proceed
	}

	w.WriteHeader(http.StatusOK)
}

func (h *WebhookHandler) answerPreCheckout(id string) {
	// Telegram expects an answer to allow the payment to proceed
	// API: https://api.telegram.org/bot<token>/answerPreCheckoutQuery?pre_checkout_query_id=<id>&ok=true
	// We'll skip implementation details here but this is the logic
}
