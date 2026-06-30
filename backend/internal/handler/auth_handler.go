package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/vector-10/the-tenet/internal/apierror"
	"github.com/vector-10/the-tenet/internal/crypto"
	"github.com/vector-10/the-tenet/internal/middleware"
	"github.com/vector-10/the-tenet/internal/service"
)

type AuthHandler struct {
	auth *service.AuthService
	env  string
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid request body"))
		return
	}
	if req.Email == "" || req.Password == "" {
		apierror.Respond(w, apierror.BadRequest("email and password are required"))
		return
	}

	rawToken, err := h.auth.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			apierror.Respond(w, apierror.Unauthorized())
			return
		}
		if errors.Is(err, service.ErrAccountSuspended) {
			apierror.Respond(w, apierror.Forbidden("account suspended"))
			return
		}
		apierror.Respond(w, apierror.Internal())
		return
	}

	h.setSessionCookie(w, rawToken)
	apierror.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("kanall_session")
	if err == nil && cookie.Value != "" {
		tokenHash := crypto.HashAPIKey(cookie.Value)
		_ = h.auth.Logout(r.Context(), tokenHash)
	}
	h.clearSessionCookie(w)
	apierror.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	if tenant == nil {
		apierror.Respond(w, apierror.Unauthorized())
		return
	}
	apierror.WriteJSON(w, http.StatusOK, map[string]any{
		"id":        tenant.ID,
		"name":      tenant.Name,
		"email":     tenant.Email,
		"status":    tenant.Status,
		"createdAt": tenant.CreatedAt,
	})
}

func (h *AuthHandler) setSessionCookie(w http.ResponseWriter, rawToken string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "kanall_session",
		Value:    rawToken,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60,
		HttpOnly: true,
		Secure:   h.env == "production",
		SameSite: http.SameSiteStrictMode,
	})
}

func (h *AuthHandler) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "kanall_session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   h.env == "production",
		SameSite: http.SameSiteStrictMode,
	})
}
