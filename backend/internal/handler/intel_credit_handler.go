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
