package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
	"github.com/vector-10/kanall/internal/apierror"
	"github.com/vector-10/kanall/internal/middleware"
	"github.com/vector-10/kanall/internal/service"
)

type SettlementHandler struct {
	settlement *service.SettlementService
}

func (h *SettlementHandler) ListBanks(w http.ResponseWriter, r *http.Request) {
	banks, err := h.settlement.ListBanks(r.Context())
	if err != nil {
		internalError(w, r, err)
		return
	}
	if q := strings.ToLower(r.URL.Query().Get("search")); q != "" {
		filtered := banks[:0]
		for _, b := range banks {
			if strings.Contains(strings.ToLower(b.Name), q) {
				filtered = append(filtered, b)
			}
		}
		banks = filtered
	}
	apierror.WriteJSON(w, http.StatusOK, map[string]any{"banks": banks})
}

type lookupRequest struct {
	AccountNumber string `json:"accountNumber"`
	BankCode      string `json:"bankCode"`
}

func (h *SettlementHandler) LookupAccount(w http.ResponseWriter, r *http.Request) {
	var req lookupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid request body"))
		return
	}
	if len(req.AccountNumber) != 10 {
		apierror.Respond(w, apierror.BadRequest("accountNumber must be 10 digits"))
		return
	}
	if req.BankCode == "" {
		apierror.Respond(w, apierror.BadRequest("bankCode is required"))
		return
	}

	account, err := h.settlement.LookupAccount(r.Context(), req.AccountNumber, req.BankCode)
	if err != nil {
		apierror.Respond(w, &apierror.APIError{Code: http.StatusBadGateway, Message: "lookup failed: " + err.Error()})
		return
	}
	apierror.WriteJSON(w, http.StatusOK, account)
}

type settleRequest struct {
	Amount        string `json:"amount"`
	BankCode      string `json:"bankCode"`
	AccountNumber string `json:"accountNumber"`
	Narration     string `json:"narration"`
}

func (h *SettlementHandler) Settle(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	accountRef := chi.URLParam(r, "accountRef")

	var req settleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.Respond(w, apierror.BadRequest("invalid request body"))
		return
	}

	amount, err := decimal.NewFromString(req.Amount)
	if err != nil || !amount.IsPositive() {
		apierror.Respond(w, apierror.BadRequest(`amount must be a positive decimal string e.g. "5000.00"`))
		return
	}
	if len(req.AccountNumber) != 10 {
		apierror.Respond(w, apierror.BadRequest("accountNumber must be 10 digits"))
		return
	}
	if req.BankCode == "" {
		apierror.Respond(w, apierror.BadRequest("bankCode is required"))
		return
	}

	result, err := h.settlement.Settle(r.Context(), tenant.ID, accountRef, amount, req.BankCode, req.AccountNumber, req.Narration)
	if err != nil {
		if errors.Is(err, service.ErrInsufficientFunds) {
			apierror.Respond(w, apierror.BadRequest("insufficient funds: balance is less than the requested amount"))
			return
		}
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusAccepted, map[string]any{
		"merchantTxRef": result.MerchantTxRef,
		"status":        result.Status,
		"amount":        result.Amount.StringFixed(2),
		"currency":      result.Currency,
		"accountRef":    result.AccountRef,
	})
}

func (h *SettlementHandler) GetTransferStatus(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	ref := chi.URLParam(r, "merchantTxRef")

	job, err := h.settlement.GetTransferStatus(r.Context(), tenant.ID, ref)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apierror.Respond(w, apierror.NotFound("transfer not found"))
			return
		}
		internalError(w, r, err)
		return
	}

	apierror.WriteJSON(w, http.StatusOK, map[string]any{
		"merchantTxRef": job.MerchantTxRef,
		"status":        job.Status,
		"amount":        job.AmountNaira.StringFixed(2),
		"currency":      "NGN",
		"attemptCount":  job.AttemptCount,
		"lastError":     job.LastError,
		"createdAt":     job.CreatedAt,
		"updatedAt":     job.UpdatedAt,
	})
}
