package handler

import (
	"net/http"

	"github.com/shopspring/decimal"
	"github.com/vector-10/kanall/internal/apierror"
	"github.com/vector-10/kanall/internal/service"
)

type FeeHandler struct{}


func (h *FeeHandler) Calculate(w http.ResponseWriter, r *http.Request) {
	raw := r.URL.Query().Get("amount")
	if raw == "" {
		apierror.Respond(w, apierror.BadRequest("amount query param is required"))
		return
	}
	amount, err := decimal.NewFromString(raw)
	if err != nil || !amount.IsPositive() {
		apierror.Respond(w, apierror.BadRequest("amount must be a positive number"))
		return
	}

	sendAmount, fee := service.GrossUp(amount)
	apierror.WriteJSON(w, http.StatusOK, map[string]string{
		"receive_amount": amount.StringFixed(2),
		"nomba_fee":      fee.StringFixed(2),
		"send_amount":    sendAmount.StringFixed(2),
	})
}
