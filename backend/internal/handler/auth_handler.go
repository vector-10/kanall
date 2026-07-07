package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/go-chi/chi/v5"
	"github.com/vector-10/kanall/internal/apierror"
	"github.com/vector-10/kanall/internal/crypto"
	"github.com/vector-10/kanall/internal/middleware"
	"github.com/vector-10/kanall/internal/repository"
	"github.com/vector-10/kanall/internal/service"
)

type AuthHandler struct {
	auth          *service.AuthService
	verification  *service.VerificationService
	store         *repository.Store
	env           string
	encryptionKey string
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
		internalError(w, r, err)
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
		"id":           tenant.ID,
		"name":         tenant.Name,
		"email":        tenant.Email,
		"status":       tenant.Status,
		"apiKeySuffix": tenant.APIKeySuffix,
		"kycStatus":    tenant.KYCStatus,
		"businessType": tenant.BusinessType,
		"webhookUrl":   tenant.WebhookURL,
		"createdAt":    tenant.CreatedAt,
	})
}

type businessKYCRequest struct {
	BusinessType string `json:"businessType"`
	CACNumber    string `json:"cacNumber"`
}

func (h *AuthHandler) SubmitBusinessKYC(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	if tenant == nil {
		apierror.Respond(w, apierror.Unauthorized())
		return
	}

	var req businessKYCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid request body"))
		return
	}
	if req.BusinessType == "" {
		apierror.Respond(w, apierror.BadRequest("businessType is required"))
		return
	}

	validTypes := map[string]bool{
		"sole_proprietor":     true,
		"registered_business": true,
		"ngo":                 true,
		"other":               true,
	}
	if !validTypes[req.BusinessType] {
		apierror.Respond(w, apierror.BadRequest("businessType must be one of: sole_proprietor, registered_business, ngo, other"))
		return
	}

	if err := h.store.Tenants.SubmitBusinessKYC(r.Context(), tenant.ID, req.BusinessType, req.CACNumber); err != nil {
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusOK, map[string]string{
		"kycStatus":    "verified",
		"businessType": req.BusinessType,
	})
}

type setWebhookURLRequest struct {
	URL string `json:"url"`
}

func (h *AuthHandler) SetWebhookURL(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	if tenant == nil {
		apierror.Respond(w, apierror.Unauthorized())
		return
	}

	var req setWebhookURLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid request body"))
		return
	}
	if req.URL == "" {
		apierror.Respond(w, apierror.BadRequest("url is required"))
		return
	}

	if err := h.store.Tenants.UpdateWebhookURL(r.Context(), tenant.ID, req.URL); err != nil {
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusOK, map[string]string{"webhookUrl": req.URL})
}

func (h *AuthHandler) WebhookSecret(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	if tenant == nil {
		apierror.Respond(w, apierror.Unauthorized())
		return
	}

	if tenant.WebhookSecretEncrypted != nil {
		raw, err := crypto.Decrypt(*tenant.WebhookSecretEncrypted, h.encryptionKey)
		if err != nil {
			internalError(w, r, err)
			return
		}
		apierror.WriteJSON(w, http.StatusOK, map[string]string{"webhookSecret": raw})
		return
	}

	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		internalError(w, r, err)
		return
	}
	raw := hex.EncodeToString(rawBytes)
	encrypted, err := crypto.Encrypt(raw, h.encryptionKey)
	if err != nil {
		internalError(w, r, err)
		return
	}
	if err := h.store.Tenants.UpdateWebhookSecret(r.Context(), tenant.ID, encrypted); err != nil {
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusOK, map[string]string{"webhookSecret": raw})
}

type verifyEmailRequest struct {
	TenantID string `json:"tenantId"`
	OTP      string `json:"otp"`
}

func (h *AuthHandler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req verifyEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid request body"))
		return
	}
	if req.TenantID == "" || req.OTP == "" {
		apierror.Respond(w, apierror.BadRequest("tenantId and otp are required"))
		return
	}

	tenantID, err := uuid.Parse(req.TenantID)
	if err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid tenantId"))
		return
	}

	result, err := h.verification.VerifyEmail(r.Context(), tenantID, req.OTP)
	if err != nil {
		if errors.Is(err, service.ErrInvalidOTP) {
			apierror.Respond(w, apierror.BadRequest("invalid or expired verification code"))
			return
		}
		if errors.Is(err, service.ErrAlreadyActive) {
			apierror.Respond(w, apierror.BadRequest("account is already verified"))
			return
		}
		internalError(w, r, err)
		return
	}

	rawToken, err := h.auth.CreateSession(r.Context(), tenantID)
	if err != nil {
		log.Printf("warn %s %s: session creation failed after OTP verify for tenant %s: %v", r.Method, r.URL.Path, tenantID, err)
		apierror.WriteJSON(w, http.StatusOK, map[string]string{
			"apiKey":  result.APIKey,
			"warning": "session creation failed — please log in manually",
		})
		return
	}

	h.setSessionCookie(w, rawToken)
	apierror.WriteJSON(w, http.StatusOK, map[string]string{"apiKey": result.APIKey})
}

func (h *AuthHandler) RotateKey(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	if tenant == nil {
		apierror.Respond(w, apierror.Unauthorized())
		return
	}

	rawKey, keyHash, err := service.GenerateAPIKey()
	if err != nil {
		internalError(w, r, err)
		return
	}

	suffix := rawKey[len(rawKey)-4:]
	if err := h.store.Tenants.RotateAPIKey(r.Context(), tenant.ID, keyHash, suffix); err != nil {
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusOK, map[string]string{"apiKey": rawKey})
}


func (h *AuthHandler) ApproveCustomerKYC(w http.ResponseWriter, r *http.Request) {
	customerID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid customer id"))
		return
	}

	tenant := middleware.GetTenant(r.Context())

	customer, err := h.store.Customers.GetByID(r.Context(), tenant.ID, customerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apierror.Respond(w, apierror.NotFound("customer not found"))
			return
		}
		internalError(w, r, err)
		return
	}

	if customer.KYCStatus != "pending_review" {
		apierror.Respond(w, apierror.BadRequest("customer is not pending review"))
		return
	}

	if err := h.store.Customers.ApproveKYC(r.Context(), tenant.ID, customerID); err != nil {
		internalError(w, r, err)
		return
	}

	customer.KYCTier = 2
	customer.KYCStatus = "approved"
	apierror.WriteJSON(w, http.StatusOK, customer)
}

func (h *AuthHandler) RejectCustomerKYC(w http.ResponseWriter, r *http.Request) {
	customerID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid customer id"))
		return
	}

	tenant := middleware.GetTenant(r.Context())

	customer, err := h.store.Customers.GetByID(r.Context(), tenant.ID, customerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apierror.Respond(w, apierror.NotFound("customer not found"))
			return
		}
		internalError(w, r, err)
		return
	}

	if customer.KYCStatus != "pending_review" {
		apierror.Respond(w, apierror.BadRequest("customer is not pending review"))
		return
	}

	if err := h.store.Customers.RejectKYC(r.Context(), tenant.ID, customerID); err != nil {
		internalError(w, r, err)
		return
	}

	customer.KYCStatus = "rejected"
	apierror.WriteJSON(w, http.StatusOK, customer)
}


func (h *AuthHandler) setSessionCookie(w http.ResponseWriter, rawToken string) {
	sameSite := http.SameSiteLaxMode
	if h.env == "production" {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "kanall_session",
		Value:    rawToken,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60,
		HttpOnly: true,
		Secure:   h.env == "production",
		SameSite: sameSite,
	})
}

func (h *AuthHandler) clearSessionCookie(w http.ResponseWriter) {
	sameSite := http.SameSiteLaxMode
	if h.env == "production" {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "kanall_session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   h.env == "production",
		SameSite: sameSite,
	})
}
