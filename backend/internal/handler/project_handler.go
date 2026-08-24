package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/service/channelmgmt"
)

type ProjectHandler struct {
	svc *channelmgmt.ProjectService
}

func NewProjectHandler(svc *channelmgmt.ProjectService) *ProjectHandler {
	return &ProjectHandler{svc: svc}
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
