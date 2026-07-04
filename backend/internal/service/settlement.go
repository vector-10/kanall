package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/vector-10/kanall/internal/model"
	"github.com/vector-10/kanall/internal/provider"
	"github.com/vector-10/kanall/internal/repository"
)

type SettlementService struct {
	store    *repository.Store
	provider provider.VirtualAccountProvider
}

func NewSettlementService(store *repository.Store, p provider.VirtualAccountProvider) *SettlementService {
	return &SettlementService{store: store, provider: p}
}

type SettleResult struct {
	MerchantTxRef string
	Status        string
	Amount        decimal.Decimal
	Currency      string
	AccountRef    string
}

func (s *SettlementService) ListBanks(ctx context.Context) ([]provider.Bank, error) {
	return s.provider.ListBanks(ctx)
}

func (s *SettlementService) LookupAccount(ctx context.Context, accountNumber, bankCode string) (provider.BankAccount, error) {
	return s.provider.LookupAccount(ctx, accountNumber, bankCode)
}

func (s *SettlementService) Settle(
	ctx context.Context,
	tenantID uuid.UUID,
	accountRef string,
	amount decimal.Decimal,
	bankCode, accountNumber, narration string,
) (SettleResult, error) {
	va, err := s.store.Accounts.GetByAccountRef(ctx, tenantID, accountRef)
	if err != nil {
		return SettleResult{}, fmt.Errorf("account not found: %w", err)
	}

	looked, err := s.provider.LookupAccount(ctx, accountNumber, bankCode)
	if err != nil {
		return SettleResult{}, fmt.Errorf("recipient lookup failed: %w", err)
	}

	merchantTxRef := uuid.New().String()
	groupID := uuid.New()

	debit := model.LedgerEntry{
		ID:                 uuid.New(),
		TenantID:           tenantID,
		TransactionGroupID: groupID,
		NombaTxnRef:        merchantTxRef,
		AccountType:        "virtual_account",
		AccountID:          va.ID,
		Direction:          "debit",
		Amount:             amount,
		Currency:           "NGN",
		Status:             "provisional",
		Narration:          &narration,
	}

	credit := model.LedgerEntry{
		ID:                 uuid.New(),
		TenantID:           tenantID,
		TransactionGroupID: groupID,
		NombaTxnRef:        merchantTxRef,
		AccountType:        "tenant_settlement",
		AccountID:          tenantID,
		Direction:          "credit",
		Amount:             amount,
		Currency:           "NGN",
		Status:             "provisional",
		Narration:          &narration,
	}

	job := model.SettlementJob{
		ID:                 uuid.New(),
		TenantID:           tenantID,
		VirtualAccountID:   va.ID,
		TransactionGroupID: groupID,
		MerchantTxRef:      merchantTxRef,
		AmountNaira:        amount,
		BankCode:           bankCode,
		AccountNumber:      looked.AccountNumber,
		AccountName:        looked.AccountName,
		Narration:          narration,
		Status:             "pending",
	}

	if err := s.store.Ledger.PostSettlementIntent(ctx, debit, credit, job); err != nil {
		return SettleResult{}, fmt.Errorf("settlement intent failed: %w", err)
	}

	return SettleResult{
		MerchantTxRef: merchantTxRef,
		Status:        "queued",
		Amount:        amount,
		Currency:      "NGN",
		AccountRef:    accountRef,
	}, nil
}
