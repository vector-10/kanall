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
	auth         *service.AuthService
	env          string
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
		apierror.Respond(w, apierror.Internal())
		return
	}

	// Auto-login: create session and set cookie so the user lands in the dashboard
	rawToken, err := h.auth.CreateSession(r.Context(), result.TenantID)
	if err != nil {
		// Non-fatal: registration succeeded, but they'll need to log in manually
		apierror.WriteJSON(w, http.StatusCreated, map[string]string{
			"tenantId": result.TenantID.String(),
			"apiKey":   result.APIKey,
			"warning":  "Store this API key securely — it will not be shown again",
		})
		return
	}

	authH := &AuthHandler{auth: h.auth, env: h.env}
	authH.setSessionCookie(w, rawToken)

	apierror.WriteJSON(w, http.StatusCreated, map[string]string{
		"tenantId": result.TenantID.String(),
		"apiKey":   result.APIKey,
		"warning":  "Store this API key securely — it will not be shown again",
	})
}