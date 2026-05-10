package handler

import (
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/payment"
	"ifragment-backend/internal/service/username"
	"net/http"
)

type PremiumHandler struct {
	reportService  *username.ReportService
	paymentService *payment.StarsService
}

func NewPremiumHandler(r *username.ReportService, p *payment.StarsService) *PremiumHandler {
	return &PremiumHandler{
		reportService:  r,
		paymentService: p,
	}
}

type ReportRequest struct {
	Username string `json:"username"`
}

func (h *PremiumHandler) RequestPremiumReport(w http.ResponseWriter, r *http.Request) {
	var req ReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	if !username.ValidateUsername(req.Username) {
		http.Error(w, "invalid username format", http.StatusBadRequest)
		return
	}

	// Get user from context
	tgUser, ok := r.Context().Value(middleware.UserContextKey).(map[string]interface{})
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	userID := int64(tgUser["id"].(float64))
	payload := fmt.Sprintf("report_pay:%d:%s", userID, req.Username)

	// 1. Create Invoice Link (100 Stars)
	link, err := h.paymentService.CreateInvoiceLink(
		"Premium Username Report",
		"Detailed analysis for @"+req.Username,
		payload,
		100,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. Save Pending Order to DB
	_, err = h.paymentService.DB.CreateOrder(r.Context(), repository.Order{
		UserID:  userID,
		Amount:  100,
		Status:  "pending",
		Payload: payload,
	})
	if err != nil {
		http.Error(w, "failed to create order", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"invoice_link": link,
	})
}

func (h *PremiumHandler) GetReport(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	if u == "" {
		http.Error(w, "missing username", http.StatusBadRequest)
		return
	}

	if !username.ValidateUsername(u) {
		http.Error(w, "invalid username format", http.StatusBadRequest)
		return
	}

	// 1. Access Control (Patch 2)
	tgUser, ok := r.Context().Value(middleware.UserContextKey).(map[string]interface{})
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	userID := int64(tgUser["id"].(float64))

	hasPaid, err := h.reportService.CheckPayment(r.Context(), userID, u)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	if !hasPaid {
		http.Error(w, "Payment required for this report", http.StatusPaymentRequired)
		return
	}

	report, err := h.reportService.GenerateDeepReport(r.Context(), userID, u)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Save report to DB (Patch: userID already extracted)
	h.reportService.SaveReportToDB(r.Context(), userID, u, report)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(report)
}

func (h *PremiumHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	tgUser, ok := r.Context().Value(middleware.UserContextKey).(map[string]interface{})
	if !ok {
		http.Error(w, "user not found in context", http.StatusUnauthorized)
		return
	}

	userID := int64(tgUser["id"].(float64))
	reports, err := h.reportService.GetUserHistory(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reports)
}
