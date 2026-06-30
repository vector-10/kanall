package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/vector-10/kanall/internal/model"
	"github.com/vector-10/kanall/internal/provider"
	"github.com/vector-10/kanall/internal/repository"
)

type ConvergenceService struct {
	store    *repository.Store
	provider provider.VirtualAccountProvider
	interval time.Duration
}

func NewConvergenceService(store *repository.Store, p provider.VirtualAccountProvider, interval time.Duration) *ConvergenceService {
	return &ConvergenceService{store: store, provider: p, interval: interval}
}

func (s *ConvergenceService) Start(ctx context.Context) {
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := s.sweep(ctx); err != nil {
				log.Printf("convergence sweep error: %v", err)
			}
		case <-ctx.Done():
			log.Println("convergence sweep stopped")
			return
		}
	}
}

func (s *ConvergenceService) sweep(ctx context.Context) error {
	entries, err := s.store.Ledger.ListProvisional(ctx)
	if err != nil {
		return err
	}
	if len(entries) == 0 {
		return nil
	}

	// One provider call per sweep covering the last 48h — safe window for any provisional entry
	now := time.Now()
	txns, err := s.provider.FetchTransactions(ctx, now.Add(-48*time.Hour), now)
	if err != nil {
		return fmt.Errorf("convergence: provider fetch failed: %w", err)
	}

	confirmed := make(map[string]bool, len(txns))
	for _, t := range txns {
		confirmed[t.TransactionRef] = true
	}

	seen := make(map[string]bool)
	for _, e := range entries {
		if seen[e.NombaTxnRef] {
			continue
		}
		seen[e.NombaTxnRef] = true

		if confirmed[e.NombaTxnRef] {
			if err := s.store.Ledger.ConfirmByTxnRef(ctx, e.NombaTxnRef); err != nil {
				log.Printf("convergence: confirm failed for txn %s: %v", e.NombaTxnRef, err)
			}
		} else {
			s.postReversal(ctx, e)
		}
	}
	return nil
}

func (s *ConvergenceService) postReversal(ctx context.Context, original model.LedgerEntry) {
	groupID := uuid.New()

	reverseCredit := model.LedgerEntry{
		ID:                 uuid.New(),
		TenantID:           original.TenantID,
		TransactionGroupID: groupID,
		NombaTxnRef:        original.NombaTxnRef,
		AccountType:        "virtual_account",
		AccountID:          original.AccountID,
		Direction:          "debit", // opposite of original credit
		Amount:             original.Amount,
		Currency:           original.Currency,
		Status:             "confirmed",
		ReversesGroupID:    uuid.NullUUID{UUID: original.TransactionGroupID, Valid: true},
	}

	reverseDebit := model.LedgerEntry{
		ID:                 uuid.New(),
		TenantID:           original.TenantID,
		TransactionGroupID: groupID,
		NombaTxnRef:        original.NombaTxnRef,
		AccountType:        "tenant_settlement",
		AccountID:          original.TenantID,
		Direction:          "credit", // opposite of original debit
		Amount:             original.Amount,
		Currency:           original.Currency,
		Status:             "confirmed",
		ReversesGroupID:    uuid.NullUUID{UUID: original.TransactionGroupID, Valid: true},
	}

	pe := model.ProcessedEvent{
		RequestID:          "reversal-" + original.NombaTxnRef,
		TransactionGroupID: groupID,
	}

	posted, err := s.store.Ledger.PostDoubleEntry(ctx, reverseCredit, reverseDebit, pe)
	if err != nil {
		log.Printf("convergence: reversal write failed for txn %s: %v", original.NombaTxnRef, err)
		return
	}
	if posted {
		if err := s.store.Ledger.MarkAsReversed(ctx, original.NombaTxnRef); err != nil {
			log.Printf("convergence: failed to mark entries reversed for txn %s: %v", original.NombaTxnRef, err)
		}
		log.Printf("convergence: posted reversal for unconfirmed txn %s", original.NombaTxnRef)
	}

}
