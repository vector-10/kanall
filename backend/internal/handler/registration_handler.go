package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/vector-10/kanall/internal/apierror"
	"github.com/vector-10/kanall/internal/service"
)

type RegistrationHandler struct {
	registration *service.RegistrationService
}

type registerRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Password string `json:"password"`
}
func (h *RegistrationHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid request body"))
		return
	}
	if req.Name == "" {
		apierror.Respond(w, apierror.BadRequest("name is required"))
		return
	}
	if req.Email == "" {
		apierror.Respond(w, apierror.BadRequest("email is required"))
		return
	}
	if len(req.Password) < 8 {
		apierror.Respond(w, apierror.BadRequest("password must be at least 8 characters"))
		return
	}

	result, err := h.registration.Register(r.Context(), service.RegisterInput{
		Name:     req.Name,
		Email:    req.Email,
		Password: req.Password,
	})
	if err != nil {
		if errors.Is(err, service.ErrEmailTaken) {
			apierror.Respond(w, apierror.Conflict("email already registered"))
			return
		}
		internalError(w, r, err)
		return
	}

	status := http.StatusCreated
	if !result.Created {
		status = http.StatusOK
	}
	apierror.WriteJSON(w, status, map[string]string{
		"tenantId": result.TenantID.String(),
	})
}