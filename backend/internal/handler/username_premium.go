package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/payment"
	"ifragment-backend/internal/service/username"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
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

const premiumReportPrice = 100

func extractTelegramUserID(ctx map[string]interface{}) (int64, bool) {
	switch v := ctx["id"].(type) {
	case float64:
		return int64(v), true
	case int64:
		return v, true
	case int:
		return int64(v), true
	case string:
		id, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			return id, true
		}
		return 0, false
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

	req.Username = strings.ToLower(strings.TrimPrefix(req.Username, "@"))

	if !username.ValidateUsername(req.Username) {
		RespondError(w, r, http.StatusBadRequest, "invalid username format", nil)
		return
	}

	userID, ok := userIDFromRequest(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}
	
	nonceBytes := make([]byte, 4)
	if _, err := rand.Read(nonceBytes); err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to generate secure nonce", err)
		return
	}
	nonce := hex.EncodeToString(nonceBytes)
	payload := fmt.Sprintf("report_pay:%d:%s:%s", userID, req.Username, nonce)

	// First, create the local order in the DB
	_, err := h.paymentService.DB.CreateOrder(r.Context(), repository.Order{
		UserID:  userID,
		Amount:  premiumReportPrice,
		Status:  "pending",
		Payload: payload,
	})
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to create order", err)
		return
	}

	// Then, create the invoice link using the provider
	link, err := h.paymentService.CreateInvoiceLink(
		"Premium Username Report",
		"Detailed analysis for @"+req.Username,
		payload,
		premiumReportPrice,
	)
	if err != nil {
		// Attempt to rollback or mark failed if invoice fails
		h.paymentService.DB.UpdateOrderStatus(r.Context(), payload, "failed", "")
		RespondError(w, r, http.StatusInternalServerError, "failed to create invoice", err)
		return
	}

	auditRepo := repository.NewAuditRepo(h.paymentService.DB)
	targetType := "username"
	if err := auditRepo.Log(r.Context(), &repository.AuditLog{
		ActorID:    userID,
		Action:     "report.request",
		TargetType: &targetType,
		TargetID:   &req.Username,
	}); err != nil {
		slog.Error("Failed to audit log report.request", "error", err)
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

	u = strings.ToLower(strings.TrimPrefix(u, "@"))

	if !username.ValidateUsername(u) {
		RespondError(w, r, http.StatusBadRequest, "invalid username format", nil)
		return
	}

	userID, ok := userIDFromRequest(r)
	if !ok {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	// Check if user has paid for this report
	// hasPaid, err := h.reportService.CheckPayment(r.Context(), userID, u)
	// if err != nil {
	// 	RespondError(w, r, http.StatusInternalServerError, "failed to verify payment status", err)
	// 	return
	// }

	// TEMPORARILY FREE: Bypass payment check
	hasPaid := true

	if !hasPaid {
		RespondError(w, r, http.StatusPaymentRequired, "Payment required for this report", nil)
		return
	}

	report, err := h.reportService.GenerateDeepReport(r.Context(), userID, u)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to generate report", err)
		return
	}

	h.reportService.SaveReportToDB(r.Context(), userID, u, report)

	auditRepo := repository.NewAuditRepo(h.paymentService.DB)
	targetType := "username"
	if err := auditRepo.Log(r.Context(), &repository.AuditLog{
		ActorID:    userID,
		Action:     "report.generate",
		TargetType: &targetType,
		TargetID:   &u,
	}); err != nil {
		slog.Error("Failed to audit log report.generate", "error", err)
	}

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

	if reports == nil {
		reports = []repository.DBReport{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reports)
}
