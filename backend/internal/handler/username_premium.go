package handler

import (
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/payment"
	"ifragment-backend/internal/service/username"
	"net/http"
	"os"
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

func extractTelegramUserID(ctx map[string]interface{}) (int64, bool) {
	switch v := ctx["id"].(type) {
	case float64:
		return int64(v), true
	case int64:
		return v, true
	case int:
		return int64(v), true
	default:
		return 0, false
	}
}

func userIDFromRequest(r *http.Request) (int64, bool) {
	tgUser, ok := r.Context().Value(middleware.UserContextKey).(map[string]interface{})
	if !ok {
		return 0, false
	}
	return extractTelegramUserID(tgUser)
}

func (h *PremiumHandler) RequestPremiumReport(w http.ResponseWriter, r *http.Request) {
	var req ReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request", err)
		return
	}

	if !username.ValidateUsername(req.Username) {
		RespondError(w, r, http.StatusBadRequest, "invalid username format", nil)
		return
	}

	userID, ok := userIDFromRequest(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	payload := fmt.Sprintf("report_pay:%d:%s", userID, req.Username)

	link, err := h.paymentService.CreateInvoiceLink(
		"Premium Username Report",
		"Detailed analysis for @"+req.Username,
		payload,
		100,
	)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to create invoice", err)
		return
	}

	_, err = h.paymentService.DB.CreateOrder(r.Context(), repository.Order{
		UserID:  userID,
		Amount:  100,
		Status:  "pending",
		Payload: payload,
	})
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to create order", err)
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
		RespondError(w, r, http.StatusBadRequest, "missing username", nil)
		return
	}

	if !username.ValidateUsername(u) {
		RespondError(w, r, http.StatusBadRequest, "invalid username format", nil)
		return
	}

	userID, ok := userIDFromRequest(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	if !allowUnpaidReports() {
		hasPaid, err := h.reportService.CheckPayment(r.Context(), userID, u)
		if err != nil {
			RespondError(w, r, http.StatusInternalServerError, "database error", err)
			return
		}

		if !hasPaid {
			RespondError(w, r, http.StatusPaymentRequired, "Payment required for this report", nil)
			return
		}
	}

	report, err := h.reportService.GenerateDeepReport(r.Context(), userID, u)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to generate report", err)
		return
	}

	h.reportService.SaveReportToDB(r.Context(), userID, u, report)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(report)
}

func (h *PremiumHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromRequest(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "user not found in context", nil)
		return
	}

	reports, err := h.reportService.GetUserHistory(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to fetch history", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reports)
}

func allowUnpaidReports() bool {
	return os.Getenv("IFRAGMENT_ALLOW_UNPAID_REPORTS") == "true"
}
