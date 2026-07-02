package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/vector-10/kanall/internal/apierror"
	"github.com/vector-10/kanall/internal/crypto"
	"github.com/vector-10/kanall/internal/middleware"
	"github.com/vector-10/kanall/internal/repository"
)

type CustomerHandler struct {
	store         *repository.Store
	encryptionKey string
}

func (h *CustomerHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())

	customerID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid customer id"))
		return
	}

	customer, err := h.store.Customers.GetByID(r.Context(), tenant.ID, customerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apierror.Respond(w, apierror.NotFound("customer not found"))
			return
		}
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusOK, customer)
}

func (h *CustomerHandler) List(w http.ResponseWriter, r *http.Request) {
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
			apierror.Respond(w, apierror.BadRequest("after must be a valid customer ID"))
			return
		}
		cursorID = &id
	}

	customers, err := h.store.Customers.ListByTenant(r.Context(), tenant.ID, limit+1, cursorID)
	if err != nil {
		internalError(w, r, err)
		return
	}

	hasMore := len(customers) > limit
	if hasMore {
		customers = customers[:limit]
	}

	var nextCursor *uuid.UUID
	if hasMore && len(customers) > 0 {
		last := customers[len(customers)-1].ID
		nextCursor = &last
	}

	apierror.WriteJSON(w, http.StatusOK, map[string]any{
		"customers":  customers,
		"pagination": listPagination{Limit: limit, NextCursor: nextCursor, HasMore: hasMore},
	})
}

type customerPatchRequest struct {
	Name *string `json:"name"`
}

func (h *CustomerHandler) Patch(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())

	customerID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid customer id"))
		return
	}

	var req customerPatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid request body"))
		return
	}
	if req.Name == nil || *req.Name == "" {
		apierror.Respond(w, apierror.BadRequest("name is required"))
		return
	}

	if err := h.store.Customers.UpdateName(r.Context(), tenant.ID, customerID, *req.Name); err != nil {
		internalError(w, r, err)
		return
	}

	customer, err := h.store.Customers.GetByID(r.Context(), tenant.ID, customerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apierror.Respond(w, apierror.NotFound("customer not found"))
			return
		}
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusOK, customer)
}

type kycUpgradeRequest struct {
	NIN string `json:"nin"`
}

func (h *CustomerHandler) UpgradeKYC(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())

	customerID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid customer id"))
		return
	}

	var req kycUpgradeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid request body"))
		return
	}
	if len(req.NIN) < 11 {
		apierror.Respond(w, apierror.BadRequest("nin must be 11 digits"))
		return
	}

	customer, err := h.store.Customers.GetByID(r.Context(), tenant.ID, customerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apierror.Respond(w, apierror.NotFound("customer not found"))
			return
		}
		internalError(w, r, err)
		return
	}

	if customer.KYCTier >= 2 {
		apierror.Respond(w, apierror.BadRequest("customer is already at tier 2 or above"))
		return
	}

	encryptedNIN, err := crypto.Encrypt(req.NIN, h.encryptionKey)
	if err != nil {
		internalError(w, r, err)
		return
	}
	ninLast4 := req.NIN[len(req.NIN)-4:]

	if err := h.store.Customers.UpdateKYC(r.Context(), tenant.ID, customerID, encryptedNIN, ninLast4, 2); err != nil {
		internalError(w, r, err)
		return
	}

	customer.NINLast4 = &ninLast4
	customer.KYCTier = 2

	apierror.WriteJSON(w, http.StatusOK, customer)
}
