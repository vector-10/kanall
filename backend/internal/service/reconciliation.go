package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/vector-10/kanall/internal/model"
	"github.com/vector-10/kanall/internal/repository"
)

type permanentErr struct{ cause error }

func (e *permanentErr) Error() string { return e.cause.Error() }
func (e *permanentErr) Unwrap() error { return e.cause }
func permanent(err error) error       { return &permanentErr{err} }

type ReconciliationService struct {
	store         *repository.Store
	webhookSecret string
}

func NewReconciliationService(store *repository.Store, webhookSecret string) *ReconciliationService {
	return &ReconciliationService{store: store, webhookSecret: webhookSecret}
}

type webhookPayload struct {
	EventType string `json:"event_type"`
	RequestID string `json:"requestId"`
	Data      struct {
		Merchant struct {
			UserID   string `json:"userId"`
			WalletID string `json:"walletId"`
		} `json:"merchant"`
		Transaction struct {
			TransactionID         string      `json:"transactionId"`
			Type                  string      `json:"type"`
			Time                  string      `json:"time"`
			ResponseCode          string      `json:"responseCode"`
			TransactionAmount     json.Number `json:"transactionAmount"`
			Fee                   json.Number `json:"fee"`
			Currency              string      `json:"currency"`
			AliasAccountReference string      `json:"aliasAccountReference"`
			Narration             string      `json:"narration"`
		} `json:"transaction"`
		Customer struct {
			SenderName    string `json:"senderName"`
			SenderAccount string `json:"accountNumber"`
			BankName      string `json:"bankName"`
		} `json:"customer"`
	} `json:"data"`
}

func (s *ReconciliationService) HandleWebhook(ctx context.Context, rawBody []byte, signature, timestamp string) error {
	var payload webhookPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		event := &model.WebhookEvent{
			ID:             uuid.New(),
			PayloadRaw:     rawBody,
			SignatureValid: false,
			Status:         "pending",
		}
		if createErr := s.store.Webhooks.Create(ctx, event); createErr == nil {
			errMsg := "invalid JSON: " + err.Error()
			_ = s.store.Webhooks.UpdateStatus(ctx, event.ID, "dead_letter", &errMsg)
		}
		return fmt.Errorf("invalid webhook payload: %w", err)
	}

	sigValid := s.verifySignature(payload, signature, timestamp)

	event := &model.WebhookEvent{
		ID:             uuid.New(),
		PayloadRaw:     rawBody,
		SignatureValid: sigValid,
		Status:         "pending",
	}
	if txnID := payload.Data.Transaction.TransactionID; txnID != "" {
		event.NombaTxnRef = &txnID
	}

	if !sigValid {
		cat := "sig_invalid"
		event.Category = &cat
	} else if payload.Data.Transaction.Type != "vact_transfer" {
		cat := "non_payment_event"
		event.Category = &cat
	}

	if err := s.store.Webhooks.Create(ctx, event); err != nil {
		return fmt.Errorf("failed to persist webhook: %w", err)
	}

	if !sigValid {
		errMsg := "invalid signature"
		_ = s.store.Webhooks.UpdateStatus(ctx, event.ID, "dead_letter", &errMsg)
		return fmt.Errorf("webhook signature invalid")
	}

	if payload.RequestID == "" {
		errMsg := "missing requestId"
		cat := "processing_error"
		_ = s.store.Webhooks.UpdateCategory(ctx, event.ID, cat)
		_ = s.store.Webhooks.UpdateStatus(ctx, event.ID, "dead_letter", &errMsg)
		return fmt.Errorf("webhook missing requestId")
	}

	if payload.Data.Transaction.Type != "vact_transfer" {
		_ = s.store.Webhooks.UpdateStatus(ctx, event.ID, "processed", nil)
		return nil
	}

	if err := s.postEntries(ctx, payload); err != nil {
		errMsg := err.Error()
		status := "failed"
		category := "processing_error"
		var pErr *permanentErr
		if errors.As(err, &pErr) {
			status = "dead_letter"
			if isMisdirected(err) {
				category = "misdirected"
			}
		}
		_ = s.store.Webhooks.UpdateCategory(ctx, event.ID, category)
		_ = s.store.Webhooks.UpdateStatus(ctx, event.ID, status, &errMsg)
		return err
	}

	cat := "payment"
	_ = s.store.Webhooks.UpdateCategory(ctx, event.ID, cat)
	_ = s.store.Webhooks.UpdateStatus(ctx, event.ID, "processed", nil)
	return nil
}

type misdirectedErr struct{ cause error }

func (e *misdirectedErr) Error() string { return e.cause.Error() }
func (e *misdirectedErr) Unwrap() error { return e.cause }
func misdirected(err error) error       { return permanent(&misdirectedErr{err}) }
func isMisdirected(err error) bool {
	var m *misdirectedErr
	return errors.As(err, &m)
}

func (s *ReconciliationService) postEntries(ctx context.Context, payload webhookPayload) error {
	amountNGN, _ := decimal.NewFromString(payload.Data.Transaction.TransactionAmount.String())
	feeNGN, _ := decimal.NewFromString(payload.Data.Transaction.Fee.String())

	currency := payload.Data.Transaction.Currency
	if currency == "" {
		currency = "NGN"
	}

	accountRef := payload.Data.Transaction.AliasAccountReference
	va, err := s.store.Accounts.GetByAccountRefGlobal(ctx, accountRef)
	if err != nil {
		return misdirected(fmt.Errorf("account not found for ref %q: %w", accountRef, err))
	}

	if va.ExpectedAmount != nil && !amountNGN.Equal(*va.ExpectedAmount) {
		log.Printf("webhook: amount mismatch account=%s expected=%s got=%s",
			accountRef, va.ExpectedAmount.String(), amountNGN.String())
	}

	groupID := uuid.New()
	narration := payload.Data.Transaction.Narration
	txnID := payload.Data.Transaction.TransactionID

	credit := model.LedgerEntry{
		ID:                 uuid.New(),
		TenantID:           va.TenantID,
		TransactionGroupID: groupID,
		NombaTxnRef:        txnID,
		AccountType:        "virtual_account",
		AccountID:          va.ID,
		Direction:          "credit",
		Amount:             amountNGN,
		Fee:                feeNGN,
		Currency:           currency,
		Status:             "provisional",
		Narration:          &narration,
	}

	debit := model.LedgerEntry{
		ID:                 uuid.New(),
		TenantID:           va.TenantID,
		TransactionGroupID: groupID,
		NombaTxnRef:        txnID,
		AccountType:        "tenant_settlement",
		AccountID:          va.TenantID,
		Direction:          "debit",
		Amount:             amountNGN,
		Fee:                feeNGN,
		Currency:           currency,
		Status:             "provisional",
		Narration:          &narration,
	}

	pe := model.ProcessedEvent{
		RequestID:          payload.RequestID,
		TransactionGroupID: groupID,
	}

	posted, err := s.store.Ledger.PostDoubleEntry(ctx, credit, debit, pe)
	if err != nil {
		return fmt.Errorf("ledger write failed: %w", err)
	}
	if !posted {
		return nil
	}

	if va.CallbackURL != nil {
		notif, _ := json.Marshal(map[string]any{
			"eventType":          "payment.received",
			"transactionGroupId": groupID.String(),
			"accountRef":         accountRef,
			"amount":             amountNGN,
			"currency":           currency,
			"senderName":         payload.Data.Customer.SenderName,
			"narration":          payload.Data.Transaction.Narration,
			"status":             "provisional",
		})
		delivery := &model.TenantWebhookDelivery{
			ID:                 uuid.New(),
			TenantID:           va.TenantID,
			TransactionGroupID: groupID,
			Payload:            notif,
			CallbackURL:        *va.CallbackURL,
			Status:             "pending",
		}
		if err := s.store.WebhookDeliveries.Create(ctx, delivery); err != nil {
			log.Printf("reconciliation: enqueue delivery failed for group %s: %v", groupID, err)
		}
	}
	return nil
}

// verifySignature builds Nomba's 9-field colon-separated signed string,
// HMAC-SHA256s it, and compares the base64 output against the nomba-signature header.
func (s *ReconciliationService) verifySignature(payload webhookPayload, signature, timestamp string) bool {
	responseCode := payload.Data.Transaction.ResponseCode
	if responseCode == "null" {
		responseCode = ""
	}
	signed := strings.Join([]string{
		payload.EventType,
		payload.RequestID,
		payload.Data.Merchant.UserID,
		payload.Data.Merchant.WalletID,
		payload.Data.Transaction.TransactionID,
		payload.Data.Transaction.Type,
		payload.Data.Transaction.Time,
		responseCode,
		timestamp,
	}, ":")
	mac := hmac.New(sha256.New, []byte(s.webhookSecret))
	mac.Write([]byte(signed))
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(signature), []byte(expected))
}
