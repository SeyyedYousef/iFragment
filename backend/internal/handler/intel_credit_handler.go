package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/intelcredit"
)

type IntelCreditHandler struct {
	service *intelcredit.IntelCreditService
}

func NewIntelCreditHandler(service *intelcredit.IntelCreditService) *IntelCreditHandler {
	return &IntelCreditHandler{service: service}
}

type ConsumeCreditRequest struct {
	Reason  string `json:"reason"`   // e.g. "report:number", "report:gift", "report:username"
	Entity  string `json:"entity"`   // e.g. "+88888888888", "plush_pepe-42", "@durov"
	IdemKey string `json:"idem_key"` // Client-generated UUID for idempotency
}

// GetBalance returns user's active Intel Credit balance and nearest expiry
func (h *IntelCreditHandler) GetBalance(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	bal, err := h.service.GetBalance(ctx, userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to get intel credits balance", err)
		return
	}

	RespondJSON(w, http.StatusOK, bal)
}

// Consume processes an atomic credit deduction or returns HTTP 402 if balance is insufficient
func (h *IntelCreditHandler) Consume(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	var req ConsumeCreditRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", nil)
		return
	}

	if req.Reason == "" {
		req.Reason = "report:intel"
	}

	remaining, err := h.service.ConsumeCredit(ctx, userID, req.Reason, req.Entity, req.IdemKey)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientIntelCredits) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusPaymentRequired) // HTTP 402
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "insufficient_credits",
				"message": "no intel credits remaining",
				"balance": 0,
			})
			return
		}
		RespondError(w, r, http.StatusInternalServerError, "failed to consume credit", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"balance": remaining,
	})
}

// GetStoreConfig returns the server-authoritative credit store pricing.
// The Mini App must render prices exclusively from this response.
func (h *IntelCreditHandler) GetStoreConfig(w http.ResponseWriter, r *http.Request) {
	store := intelcredit.NewStoreService(nil)
	RespondJSON(w, http.StatusOK, store.GetConfig())
}

type PurchaseCreditsRequest struct {
	Method string `json:"method"` // currently only "stars"
	Pack   string `json:"pack"`   // "c1", "c3p1", "c10p3"
}

// Purchase creates a pending order and returns a Telegram Stars invoice link.
// Credits are granted asynchronously by the bot webhook after successful payment.
func (h *IntelCreditHandler) Purchase(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	var req PurchaseCreditsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Pack == "" {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", nil)
		return
	}
	if req.Method != "" && req.Method != "stars" {
		RespondError(w, r, http.StatusBadRequest, "unsupported purchase method", nil)
		return
	}

	store := intelcredit.NewStoreService(h.service.DB())
	link, err := store.CreateStarsInvoice(ctx, userID, req.Pack)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to create invoice", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success":      true,
		"invoice_link": link,
	})
}

// ExchangeCoins atomically converts Airdrop Coins into 1 Intel Credit (HTTP 402 when short).
func (h *IntelCreditHandler) ExchangeCoins(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, err := middleware.GetUserID(ctx)
	if err != nil {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	store := intelcredit.NewStoreService(h.service.DB())
	balance, err := store.ExchangeCoins(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientCoins) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusPaymentRequired)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "insufficient_coins",
				"message": "not enough airdrop coins for exchange",
			})
			return
		}
		RespondError(w, r, http.StatusInternalServerError, "failed to exchange coins", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"balance": balance,
	})
}
