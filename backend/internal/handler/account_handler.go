package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
	"github.com/vector-10/kanall/internal/apierror"
	"github.com/vector-10/kanall/internal/middleware"
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
}

type accountUpdateRequest struct {
	CallbackURL    *string          `json:"callbackUrl"`
	ExpectedAmount *decimal.Decimal `json:"expectedAmount"`
}

type lifecycleRequest struct {
	Reason *string `json:"reason"`
}

type listPagination struct {
	Limit      int        `json:"limit"`
	NextCursor *uuid.UUID `json:"nextCursor,omitempty"`
	HasMore    bool       `json:"hasMore"`
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

	va, err := h.provisioning.Provision(r.Context(), service.ProvisionInput{
		TenantID:       tenant.ID,
		ExternalRef:    req.ExternalRef,
		Name:           req.Name,
		BVN:            req.BVN,
		CallbackURL:    req.CallbackURL,
		ExpectedAmount: req.ExpectedAmount,
	})
	if err != nil {
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusCreated, va)
}

func (h *AccountHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	accountRef := chi.URLParam(r, "accountRef")

	va, err := h.store.Accounts.GetByAccountRef(r.Context(), tenant.ID, accountRef)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apierror.Respond(w, apierror.NotFound("account not found"))
			return
		}
		internalError(w, r, err)
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
	if req.CallbackURL == nil && req.ExpectedAmount == nil {
		apierror.Respond(w, apierror.BadRequest("at least one of callbackUrl or expectedAmount is required"))
		return
	}

	if err := h.store.Accounts.Update(r.Context(), tenant.ID, accountRef, req.CallbackURL, req.ExpectedAmount); err != nil {
		internalError(w, r, err)
		return
	}

	va, err := h.store.Accounts.GetByAccountRef(r.Context(), tenant.ID, accountRef)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apierror.Respond(w, apierror.NotFound("account not found"))
			return
		}
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusOK, va)
}

func (h *AccountHandler) Suspend(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, "suspended")
}

func (h *AccountHandler) Expire(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, "expired")
}

func (h *AccountHandler) Reactivate(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, "active")
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
