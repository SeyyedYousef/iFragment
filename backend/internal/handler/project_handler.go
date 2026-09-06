package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/service/botmgmt"
	"ifragment-backend/internal/service/channelmgmt"
	"ifragment-backend/internal/service/payment"
)

type ProjectHandler struct {
	svc            *channelmgmt.ProjectService
	botSvc         *botmgmt.BotService
	paymentService *payment.StarsService
}

func NewProjectHandler(svc *channelmgmt.ProjectService, botSvc *botmgmt.BotService, paymentService *payment.StarsService) *ProjectHandler {
	return &ProjectHandler{
		svc:            svc,
		botSvc:         botSvc,
		paymentService: paymentService,
	}
}

func (h *ProjectHandler) getUserID(r *http.Request) int64 {
	id, _ := middleware.GetUserID(r.Context())
	return id
}

func (h *ProjectHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	projects, err := h.svc.ListProjects(r.Context(), userID)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to list projects", err)
		return
	}

	RespondJSON(w, http.StatusOK, projects)
}

func (h *ProjectHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
	var req channelmgmt.CreateProjectInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	project, err := h.svc.CreateProject(r.Context(), userID, req)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusCreated, project)
}

func (h *ProjectHandler) GetProject(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	projectIDStr := chi.URLParam(r, "projectID")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid project ID", err)
		return
	}

	project, err := h.svc.GetProject(r.Context(), userID, projectID)
	if err != nil {
		RespondError(w, r, http.StatusNotFound, "project not found", err)
		return
	}

	RespondJSON(w, http.StatusOK, project)
}

func (h *ProjectHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	projectIDStr := chi.URLParam(r, "projectID")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid project ID", err)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
	var req channelmgmt.UpdateProjectInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	project, err := h.svc.UpdateProjectChannels(r.Context(), userID, projectID, req)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, project)
}

type ToggleProjectRequest struct {
	Active bool `json:"active"`
}

func (h *ProjectHandler) ToggleProject(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	projectIDStr := chi.URLParam(r, "projectID")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid project ID", err)
		return
	}

	var req ToggleProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid request body", err)
		return
	}

	project, err := h.svc.ToggleProjectStatus(r.Context(), userID, projectID, req.Active)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, project)
}

type RenewProjectRequest struct {
	DurationDays int `json:"duration_days"`
}

func (h *ProjectHandler) RenewProject(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	projectIDStr := chi.URLParam(r, "projectID")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid project ID", err)
		return
	}

	var req RenewProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.DurationDays <= 0 {
		req.DurationDays = 30 // default 30 days
	}

	project, err := h.svc.RenewProjectSubscription(r.Context(), userID, projectID, req.DurationDays)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, project)
}

func (h *ProjectHandler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	projectIDStr := chi.URLParam(r, "projectID")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid project ID", err)
		return
	}

	if err := h.svc.DeleteProject(r.Context(), userID, projectID); err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

type ProjectSubscribeCreditsRequest struct {
	PackageID string `json:"package_id"`
}

func (h *ProjectHandler) SubscribeCredits(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	projectIDStr := chi.URLParam(r, "projectID")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid project ID", err)
		return
	}

	if _, err := h.svc.GetProject(r.Context(), userID, projectID); err != nil {
		RespondError(w, r, http.StatusForbidden, "project not found or access denied", err)
		return
	}

	var req ProjectSubscribeCreditsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PackageID == "" {
		RespondError(w, r, http.StatusBadRequest, "invalid request body: package_id required", err)
		return
	}

	if h.botSvc == nil {
		RespondError(w, r, http.StatusInternalServerError, "bot service unavailable", nil)
		return
	}

	if err := h.botSvc.SubscribeChannelWithCredits(r.Context(), userID, projectID, req.PackageID); err != nil {
		RespondError(w, r, http.StatusBadRequest, err.Error(), err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "active",
		"message": "Project subscription activated successfully with Intel Credits",
	})
}

type ProjectSubscribeStarsRequest struct {
	PackageID       string `json:"package_id"`
	DiscountPercent int    `json:"discount_percent,omitempty"`
}

func (h *ProjectHandler) SubscribeStars(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if userID == 0 {
		RespondError(w, r, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	projectIDStr := chi.URLParam(r, "projectID")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "invalid project ID", err)
		return
	}

	project, err := h.svc.GetProject(r.Context(), userID, projectID)
	if err != nil || project == nil {
		RespondError(w, r, http.StatusForbidden, "project not found or access denied", err)
		return
	}

	var req ProjectSubscribeStarsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PackageID == "" {
		RespondError(w, r, http.StatusBadRequest, "invalid request body: package_id required", err)
		return
	}

	if h.botSvc == nil || h.paymentService == nil {
		RespondError(w, r, http.StatusInternalServerError, "payment service unavailable", nil)
		return
	}

	pkg := h.botSvc.GetPackageByID(req.PackageID)
	if pkg == nil {
		RespondError(w, r, http.StatusBadRequest, "invalid package", nil)
		return
	}

	finalStars := pkg.PriceStars
	discountPercent := 0
	if req.DiscountPercent > 0 {
		discountPercent = req.DiscountPercent
		if discountPercent > 75 {
			discountPercent = 75
		}
		savedStars := (pkg.PriceStars * discountPercent) / 100
		finalStars = pkg.PriceStars - savedStars
		if finalStars < 1 {
			finalStars = 1
		}
		requiredCoins := float64(savedStars * 1032)

		profile, err := h.botSvc.BotRepo().DB().GetProfileStats(r.Context(), userID)
		if err != nil || profile == nil || profile.AirdropCoins < requiredCoins {
			currentCoins := 0.0
			if profile != nil {
				currentCoins = profile.AirdropCoins
			}
			RespondError(w, r, http.StatusBadRequest, fmt.Sprintf("Insufficient coins for discount voucher. Required: %.0f, Available: %.0f", requiredCoins, currentCoins), nil)
			return
		}
	}

	title := "Project Pipeline Subscription"
	desc := fmt.Sprintf("%s subscription for project %s", pkg.Name, project.Name)
	payload := fmt.Sprintf("sub_chan_stars_%s_%s_%d", projectID.String(), pkg.ID, discountPercent)

	link, err := h.paymentService.CreateInvoiceLink(title, desc, payload, finalStars)
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "failed to generate invoice link", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"invoice_link": link,
		"final_stars":  finalStars,
	})
}

