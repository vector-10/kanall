package service

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/vector-10/kanall/internal/provider"
	"github.com/vector-10/kanall/internal/repository"
)

type ConvergenceService struct {
	store    *repository.Store
	provider provider.VirtualAccountProvider
	interval time.Duration
	mu       sync.Mutex
}

func NewConvergenceService(store *repository.Store, p provider.VirtualAccountProvider, interval time.Duration) *ConvergenceService {
	return &ConvergenceService{store: store, provider: p, interval: interval}
}

func (s *ConvergenceService) Start(ctx context.Context) {
	log.Println("convergence: sweep started")
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if !s.mu.TryLock() {
				log.Println("convergence: previous sweep still running, skipping tick")
				continue
			}
			go func() {
				defer s.mu.Unlock()
				defer func() {
					if rec := recover(); rec != nil {
						log.Printf("convergence: panic recovered: %v", rec)
					}
				}()
				if err := s.sweep(ctx); err != nil {
					log.Printf("convergence: sweep error: %v", err)
				}
			}()
		case <-ctx.Done():
			log.Println("convergence: sweep stopped")
			return
		}
	}
}

func (s *ConvergenceService) sweep(ctx context.Context) error {
	if n, err := s.store.Accounts.ExpireOnetimeVAs(ctx); err != nil {
		log.Printf("convergence: onetime VA expiry sweep failed: %v", err)
	} else if n > 0 {
		log.Printf("convergence: expired %d onetime VA(s) past deadline", n)
	}

	provisionals, err := s.store.Ledger.ListProvisional(ctx)
	if err != nil {
		return err
	}

	needsReview, err := s.store.Ledger.ListNeedsReviewAll(ctx)
	if err != nil {
		log.Printf("convergence: list needs_review failed: %v", err)
	}

	if len(provisionals) == 0 && len(needsReview) == 0 {
		return nil
	}

	now := time.Now()
	txns, err := s.provider.FetchTransactions(ctx, now.Add(-7*24*time.Hour), now)
	if err != nil {
		return fmt.Errorf("convergence: provider fetch failed: %w", err)
	}
	if len(txns) == 0 {
		log.Printf("convergence: nomba returned 0 transactions — skipping sweep to avoid false actions")
		return nil
	}

	confirmedInBulk := make(map[string]bool, len(txns))
	for _, t := range txns {
		confirmedInBulk[t.TransactionRef] = true
	}

	// Layer 2: confirm provisionals found in the bulk list.
	seen := make(map[string]bool)
	for _, e := range provisionals {
		if seen[e.NombaTxnRef] {
			continue
		}
		seen[e.NombaTxnRef] = true

		if confirmedInBulk[e.NombaTxnRef] {
			if err := s.store.Ledger.ConfirmByTxnRef(ctx, e.NombaTxnRef); err != nil {
				log.Printf("convergence: confirm failed for txn %s: %v", e.NombaTxnRef, err)
			} else {
				log.Printf("convergence: confirmed %s via bulk sweep", e.NombaTxnRef)
			}
		}
	}

	// Layer 3 (aged auditor): targeted requery for provisionals older than 2h.
	for _, e := range provisionals {
		if confirmedInBulk[e.NombaTxnRef] {
			continue
		}
		age := time.Since(e.CreatedAt)
		if age < 2*time.Hour {
			continue
		}

		found, err := s.provider.FetchInboundTxn(ctx, e.NombaTxnRef)
		if err != nil {
			log.Printf("convergence: aged auditor requery failed for %s: %v", e.NombaTxnRef, err)
			continue
		}

		if found {
			if err := s.store.Ledger.ConfirmByTxnRef(ctx, e.NombaTxnRef); err != nil {
				log.Printf("convergence: aged confirm failed for %s: %v", e.NombaTxnRef, err)
			} else {
				log.Printf("convergence: confirmed %s via targeted requery", e.NombaTxnRef)
			}
			continue
		}

		if age > 24*time.Hour {
			if err := s.store.Ledger.FlagAsNeedsReview(ctx, e.NombaTxnRef); err != nil {
				log.Printf("convergence: flag needs_review failed for %s: %v", e.NombaTxnRef, err)
			} else {
				log.Printf("convergence: flagged %s as needs_review after 24h without confirmation", e.NombaTxnRef)
			}
		}
	}

	// Layer 4: re-examine needs_review entries using bulk map + targeted requery.
	// ConfirmByTxnRef now accepts both 'provisional' and 'needs_review' statuses.
	seenNR := make(map[string]bool)
	for _, e := range needsReview {
		if seenNR[e.NombaTxnRef] {
			continue
		}
		seenNR[e.NombaTxnRef] = true

		if confirmedInBulk[e.NombaTxnRef] {
			if err := s.store.Ledger.ConfirmByTxnRef(ctx, e.NombaTxnRef); err != nil {
				log.Printf("convergence: needs_review confirm (bulk) failed for %s: %v", e.NombaTxnRef, err)
			} else {
				log.Printf("convergence: resolved needs_review %s via bulk sweep", e.NombaTxnRef)
			}
			continue
		}

		found, err := s.provider.FetchInboundTxn(ctx, e.NombaTxnRef)
		if err != nil {
			log.Printf("convergence: needs_review requery failed for %s: %v", e.NombaTxnRef, err)
			continue
		}
		if found {
			if err := s.store.Ledger.ConfirmByTxnRef(ctx, e.NombaTxnRef); err != nil {
				log.Printf("convergence: needs_review confirm (requery) failed for %s: %v", e.NombaTxnRef, err)
			} else {
				log.Printf("convergence: resolved needs_review %s via targeted requery", e.NombaTxnRef)
			}
		}
		// Still not found — leave as needs_review for human review via dashboard.
	}

	return nil
}
