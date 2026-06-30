package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/vector-10/kanall/internal/apierror"
	"github.com/vector-10/kanall/internal/middleware"
	"github.com/vector-10/kanall/internal/service"
)

type StatementHandler struct {
	statement *service.StatementService
}

func (h *StatementHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	accountRef := chi.URLParam(r, "accountRef")

	limitStr := r.URL.Query().Get("limit")
	if limitStr == "" {
		limitStr = "50"
	}
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 200 {
		apierror.Respond(w, apierror.BadRequest("limit must be a number between 1 and 200"))
		return
	}

	var cursorID *uuid.UUID
	if after := r.URL.Query().Get("after"); after != "" {
		id, err := uuid.Parse(after)
		if err != nil {
			apierror.Respond(w, apierror.BadRequest("after must be a valid entry ID"))
			return
		}
		cursorID = &id
	}

	stmt, err := h.statement.GetStatement(r.Context(), tenant.ID, accountRef, limit, cursorID)
	if err != nil {
		if errors.Is(err, service.ErrAccountNotFound) {
			apierror.Respond(w, apierror.NotFound("account not found"))
			return
		}
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusOK, stmt)
}
