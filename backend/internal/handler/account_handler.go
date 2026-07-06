package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
	"github.com/vector-10/kanall/internal/apierror"
	"github.com/vector-10/kanall/internal/middleware"
	"github.com/vector-10/kanall/internal/model"
	"github.com/vector-10/kanall/internal/repository"
	"github.com/vector-10/kanall/internal/service"
)

type AccountHandler struct {
	provisioning *service.ProvisioningService
	lifecycle    *service.LifecycleService
	store        *repository.Store
}

type provisionRequest struct {
	ExternalRef    string           `json:"externalRef"`
	Name           string           `json:"name"`
	BVN            string           `json:"bvn"`
	CallbackURL    string           `json:"callbackUrl"`
	ExpectedAmount *decimal.Decimal `json:"expectedAmount"`
	ExpiresAt      *time.Time       `json:"expiresAt"`
	Mode           string           `json:"mode"` // "dedicated" (default) | "onetime"
}

type accountUpdateRequest struct {
	CallbackURL    *string          `json:"callbackUrl"`
	ExpectedAmount *decimal.Decimal `json:"expectedAmount"`
	Name           *string          `json:"name"`
}

type lifecycleRequest struct {
	Reason *string `json:"reason"`
}

type listPagination struct {
	Limit      int        `json:"limit"`
	NextCursor *uuid.UUID `json:"nextCursor,omitempty"`
	HasMore    bool       `json:"hasMore"`
}

func (h *AccountHandler) fetchVA(w http.ResponseWriter, r *http.Request, tenantID uuid.UUID, accountRef string) (*model.VirtualAccount, bool) {
	va, err := h.store.Accounts.GetByAccountRef(r.Context(), tenantID, accountRef)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apierror.Respond(w, apierror.NotFound("account not found"))
			return nil, false
		}
		internalError(w, r, err)
		return nil, false
	}
	return va, true
}

func (h *AccountHandler) Provision(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())

	var req provisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid request body"))
		return
	}
	if req.ExternalRef == "" || req.Name == "" {
		apierror.Respond(w, apierror.BadRequest("externalRef and name are required"))
		return
	}

	if req.Mode != "" && req.Mode != "dedicated" && req.Mode != "onetime" {
		apierror.Respond(w, apierror.BadRequest("mode must be 'dedicated' or 'onetime'"))
		return
	}

	va, err := h.provisioning.Provision(r.Context(), service.ProvisionInput{
		TenantID:       tenant.ID,
		ExternalRef:    req.ExternalRef,
		Name:           req.Name,
		BVN:            req.BVN,
		CallbackURL:    req.CallbackURL,
		ExpectedAmount: req.ExpectedAmount,
		ExpiresAt:      req.ExpiresAt,
		Mode:           req.Mode,
	})
	if err != nil {
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusCreated, va)
}

func (h *AccountHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	va, ok := h.fetchVA(w, r, tenant.ID, chi.URLParam(r, "accountRef"))
	if !ok {
		return
	}
	apierror.WriteJSON(w, http.StatusOK, va)
}

func (h *AccountHandler) List(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())

	limitStr := r.URL.Query().Get("limit")
	if limitStr == "" {
		limitStr = "50"
	}
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 200 {
		apierror.Respond(w, apierror.BadRequest("limit must be between 1 and 200"))
		return
	}

	var cursorID *uuid.UUID
	if after := r.URL.Query().Get("after"); after != "" {
		id, err := uuid.Parse(after)
		if err != nil {
			apierror.Respond(w, apierror.BadRequest("after must be a valid account ID"))
			return
		}
		cursorID = &id
	}

	accounts, err := h.store.Accounts.ListByTenant(r.Context(), tenant.ID, limit+1, cursorID)
	if err != nil {
		internalError(w, r, err)
		return
	}

	hasMore := len(accounts) > limit
	if hasMore {
		accounts = accounts[:limit]
	}

	var nextCursor *uuid.UUID
	if hasMore && len(accounts) > 0 {
		last := accounts[len(accounts)-1].ID
		nextCursor = &last
	}

	apierror.WriteJSON(w, http.StatusOK, map[string]any{
		"accounts":   accounts,
		"pagination": listPagination{Limit: limit, NextCursor: nextCursor, HasMore: hasMore},
	})
}

func (h *AccountHandler) Update(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	accountRef := chi.URLParam(r, "accountRef")

	var req accountUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid request body"))
		return
	}
	if req.CallbackURL == nil && req.ExpectedAmount == nil && req.Name == nil {
		apierror.Respond(w, apierror.BadRequest("at least one of callbackUrl, expectedAmount, or name is required"))
		return
	}

	va, err := h.lifecycle.UpdateAccount(r.Context(), tenant.ID, accountRef, req.CallbackURL, req.ExpectedAmount, req.Name)
	if err != nil {
		if errors.Is(err, service.ErrAccountNotFound) {
			apierror.Respond(w, apierror.NotFound("account not found"))
			return
		}
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusOK, va)
}

func (h *AccountHandler) Expire(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, "expired")
}

func (h *AccountHandler) Balance(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	va, ok := h.fetchVA(w, r, tenant.ID, chi.URLParam(r, "accountRef"))
	if !ok {
		return
	}

	balance, err := h.store.Ledger.GetBalance(r.Context(), tenant.ID, va.ID)
	if err != nil {
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusOK, map[string]any{
		"accountRef": va.AccountRef,
		"balance":    balance.StringFixed(2),
		"currency":   "NGN",
	})
}

func (h *AccountHandler) TenantBalance(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())

	balance, err := h.store.Ledger.GetTenantBalance(r.Context(), tenant.ID)
	if err != nil {
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusOK, map[string]any{
		"balance":  balance.StringFixed(2),
		"currency": "NGN",
	})
}

func (h *AccountHandler) History(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	va, ok := h.fetchVA(w, r, tenant.ID, chi.URLParam(r, "accountRef"))
	if !ok {
		return
	}

	history, err := h.store.Accounts.GetStateHistory(r.Context(), va.ID)
	if err != nil {
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusOK, map[string]any{"history": history})
}

func (h *AccountHandler) transition(w http.ResponseWriter, r *http.Request, toStatus string) {
	tenant := middleware.GetTenant(r.Context())
	accountRef := chi.URLParam(r, "accountRef")

	var req lifecycleRequest
	_ = json.NewDecoder(r.Body).Decode(&req) // reason is optional

	va, err := h.lifecycle.Transition(r.Context(), tenant.ID, accountRef, toStatus, req.Reason)
	if err != nil {
		if errors.Is(err, service.ErrAccountNotFound) {
			apierror.Respond(w, apierror.NotFound("account not found"))
			return
		}
		if errors.Is(err, service.ErrInvalidTransition) {
			apierror.Respond(w, apierror.BadRequest(err.Error()))
			return
		}
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusOK, va)
}
