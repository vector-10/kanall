package handler

import (
	"io"
	"net/http"

	"github.com/vector-10/kanall/internal/apierror"
	"github.com/vector-10/kanall/internal/middleware"
	"github.com/vector-10/kanall/internal/repository"
	"github.com/vector-10/kanall/internal/service"
)

type WebhookHandler struct {
	reconciliation *service.ReconciliationService
	store          *repository.Store
}

func (h *WebhookHandler) Handle(w http.ResponseWriter, r *http.Request) {
	signature := r.Header.Get("nomba-signature")
	timestamp := r.Header.Get("nomba-timestamp")

	body, err := io.ReadAll(r.Body)
	if err != nil {
		apierror.Respond(w, apierror.BadRequest("failed to read body"))
		return
	}

	h.reconciliation.HandleWebhook(r.Context(), body, signature, timestamp)
	apierror.WriteJSON(w, http.StatusOK, map[string]string{"status": "received"})
}

func (h *WebhookHandler) ListDeadLetters(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())

	deadLetters, err := h.store.WebhookDeliveries.ListDeadLetters(r.Context(), tenant.ID)
	if err != nil {
		apierror.Respond(w, apierror.Internal())
		return
	}

	apierror.WriteJSON(w, http.StatusOK, map[string]any{"deadLetters": deadLetters})
}
