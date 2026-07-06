package service

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/vector-10/kanall/internal/model"
	"github.com/vector-10/kanall/internal/provider"
	"github.com/vector-10/kanall/internal/repository"
)

var settlementBackoff = []time.Duration{
	30 * time.Second,
	2 * time.Minute,
	5 * time.Minute,
	15 * time.Minute,
	30 * time.Minute,
}

const maxSettlementAttempts = 5

type SettlementWorker struct {
	store    *repository.Store
	provider provider.VirtualAccountProvider
	sem      chan struct{}
}

func NewSettlementWorker(store *repository.Store, p provider.VirtualAccountProvider) *SettlementWorker {
	return &SettlementWorker{
		store:    store,
		provider: p,
		sem:      make(chan struct{}, 5),
	}
}

func (w *SettlementWorker) Start(ctx context.Context) {
	log.Println("settlement worker: started")
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			log.Println("settlement worker: stopped")
			return
		case <-ticker.C:
			w.sweep(ctx)
		}
	}
}

func (w *SettlementWorker) sweep(ctx context.Context) {
	jobs, err := w.store.SettlementJobs.ListRetryable(ctx)
	if err != nil {
		log.Printf("settlement worker: list failed: %v", err)
		return
	}
	for _, j := range jobs {
		j := j
		go w.process(ctx, j)
	}
}

func (w *SettlementWorker) process(ctx context.Context, job model.SettlementJob) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("settlement worker: panic recovered for job %s: %v", job.ID, rec)
		}
	}()
	select {
	case w.sem <- struct{}{}:
		defer func() { <-w.sem }()
	case <-ctx.Done():
		return
	}

	// On retry: check current status before re-submitting to avoid double disbursement.
	// If Requery errors (not found), fall through to Transfer — first attempt may not have landed.
	if job.AttemptCount > 0 {
		if result, err := w.provider.Requery(ctx, job.MerchantTxRef); err == nil {
			w.handleResult(ctx, job, result)
			return
		}
	}

	result, err := w.provider.Transfer(ctx, provider.TransferInput{
		AmountNaira:   mustFloat(job.AmountNaira),
		AccountNumber: job.AccountNumber,
		AccountName:   job.AccountName,
		BankCode:      job.BankCode,
		MerchantTxRef: job.MerchantTxRef,
		Narration:     job.Narration,
	})
	if err != nil {
		w.fail(ctx, job, err.Error())
		return
	}
	w.handleResult(ctx, job, result)
}

func (w *SettlementWorker) handleResult(ctx context.Context, job model.SettlementJob, result provider.TransferResult) {
	switch result.Status {
	case "SUCCESS":
		if err := w.store.SettlementJobs.UpdateAfterAttempt(ctx, job.ID, "completed", nil, nil); err != nil {
			log.Printf("settlement worker: mark completed failed %s: %v", job.ID, err)
		}
		if err := w.store.Ledger.ConfirmByTxnRef(ctx, job.MerchantTxRef); err != nil {
			log.Printf("settlement worker: confirm ledger failed %s: %v", job.MerchantTxRef, err)
		}
		log.Printf("settlement worker: completed job %s ref=%s", job.ID, job.MerchantTxRef)

	case "REFUND":
		errMsg := "transfer refunded by Nomba"
		if err := w.store.SettlementJobs.UpdateAfterAttempt(ctx, job.ID, "dead_letter", &errMsg, nil); err != nil {
			log.Printf("settlement worker: mark dead_letter failed %s: %v", job.ID, err)
		}
		w.postReversal(ctx, job)
		log.Printf("settlement worker: refunded job %s ref=%s", job.ID, job.MerchantTxRef)

	default:
		w.fail(ctx, job, "transfer status: "+result.Status)
	}
}

func (w *SettlementWorker) fail(ctx context.Context, job model.SettlementJob, reason string) {
	errMsg := reason
	if job.AttemptCount >= maxSettlementAttempts-1 {
		if err := w.store.SettlementJobs.UpdateAfterAttempt(ctx, job.ID, "dead_letter", &errMsg, nil); err != nil {
			log.Printf("settlement worker: mark dead_letter failed %s: %v", job.ID, err)
		}
		w.postReversal(ctx, job)
		log.Printf("settlement worker: dead_letter %s after %d attempts: %s", job.ID, job.AttemptCount+1, reason)
		return
	}
	t := time.Now().Add(settlementBackoff[job.AttemptCount])
	if err := w.store.SettlementJobs.UpdateAfterAttempt(ctx, job.ID, "failed", &errMsg, &t); err != nil {
		log.Printf("settlement worker: mark failed %s: %v", job.ID, err)
	}
}

func (w *SettlementWorker) postReversal(ctx context.Context, job model.SettlementJob) {
	groupID := uuid.New()

	reverseCredit := model.LedgerEntry{
		ID:                 uuid.New(),
		TenantID:           job.TenantID,
		TransactionGroupID: groupID,
		NombaTxnRef:        "settle-reversal-" + job.MerchantTxRef,
		AccountType:        "virtual_account",
		AccountID:          job.VirtualAccountID,
		Direction:          "credit",
		Amount:             job.AmountNaira,
		Currency:           "NGN",
		Status:             "confirmed",
		ReversesGroupID:    uuid.NullUUID{UUID: job.TransactionGroupID, Valid: true},
	}

	reverseDebit := model.LedgerEntry{
		ID:                 uuid.New(),
		TenantID:           job.TenantID,
		TransactionGroupID: groupID,
		NombaTxnRef:        "settle-reversal-" + job.MerchantTxRef,
		AccountType:        "tenant_settlement",
		AccountID:          job.TenantID,
		Direction:          "debit",
		Amount:             job.AmountNaira,
		Currency:           "NGN",
		Status:             "confirmed",
		ReversesGroupID:    uuid.NullUUID{UUID: job.TransactionGroupID, Valid: true},
	}

	pe := model.ProcessedEvent{
		RequestID:          "settle-reversal-" + job.MerchantTxRef,
		TransactionGroupID: groupID,
	}

	if _, err := w.store.Ledger.PostDoubleEntry(ctx, reverseCredit, reverseDebit, pe); err != nil {
		log.Printf("settlement worker: reversal write failed for %s: %v", job.MerchantTxRef, err)
		return
	}
	if err := w.store.Ledger.MarkAsReversed(ctx, job.MerchantTxRef); err != nil {
		log.Printf("settlement worker: mark reversed failed for %s: %v", job.MerchantTxRef, err)
	}
}

func mustFloat(d interface{ InexactFloat64() float64 }) float64 {
	return d.InexactFloat64()
}
