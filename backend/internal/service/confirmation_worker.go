package service

import (
	"context"
	"log"
	"time"

	"github.com/vector-10/kanall/internal/model"
	"github.com/vector-10/kanall/internal/provider"
	"github.com/vector-10/kanall/internal/repository"
)

var confirmBackoff = []time.Duration{
	30 * time.Second,
	2 * time.Minute,
	5 * time.Minute,
}

const maxConfirmAttempts = 3

type ConfirmationWorker struct {
	store    *repository.Store
	provider provider.VirtualAccountProvider
	jobs     chan model.ConfirmationJob
}

func NewConfirmationWorker(store *repository.Store, prov provider.VirtualAccountProvider) *ConfirmationWorker {
	return &ConfirmationWorker{
		store:    store,
		provider: prov,
		jobs:     make(chan model.ConfirmationJob, 1000),
	}
}


func (w *ConfirmationWorker) Enqueue(job model.ConfirmationJob) {
	select {
	case w.jobs <- job:
	default:
		// Channel full — DB recovery poller will pick it up within 10s.
		log.Printf("confirmation: channel full, job %s will be picked up by poller", job.NombaTxnRef)
	}
}


func (w *ConfirmationWorker) Start(ctx context.Context, numWorkers int) {
	log.Printf("confirmation: starting %d workers", numWorkers)
	for i := 0; i < numWorkers; i++ {
		go w.runWorker(ctx)
	}
	go w.runPoller(ctx)
}

func (w *ConfirmationWorker) runWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case job := <-w.jobs:
			w.process(ctx, job)
		}
	}
}

func (w *ConfirmationWorker) runPoller(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			jobs, err := w.store.ConfirmationJobs.ClaimBatch(ctx, 50)
			if err != nil {
				log.Printf("confirmation: poller claim failed: %v", err)
				continue
			}
			for _, j := range jobs {
				select {
				case w.jobs <- j:
				case <-ctx.Done():
					return
				}
			}
		}
	}
}

func (w *ConfirmationWorker) process(ctx context.Context, job model.ConfirmationJob) {
	found, err := w.provider.FetchInboundTxn(ctx, job.NombaTxnRef)
	if err != nil {
		w.scheduleRetry(ctx, job, err.Error())
		return
	}

	if found {
		if err := w.store.Ledger.ConfirmByTxnRef(ctx, job.NombaTxnRef); err != nil {
			log.Printf("confirmation: ConfirmByTxnRef failed for %s: %v", job.NombaTxnRef, err)
			w.scheduleRetry(ctx, job, err.Error())
			return
		}
		if err := w.store.ConfirmationJobs.MarkConfirmed(ctx, job.ID); err != nil {
			log.Printf("confirmation: MarkConfirmed failed for job %s: %v", job.ID, err)
		}
		log.Printf("confirmation: confirmed %s", job.NombaTxnRef)
		return
	}

	w.scheduleRetry(ctx, job, "transaction not yet visible")
}

func (w *ConfirmationWorker) scheduleRetry(ctx context.Context, job model.ConfirmationJob, reason string) {
	if job.AttemptCount >= maxConfirmAttempts {
		if err := w.store.ConfirmationJobs.MarkExhausted(ctx, job.ID, reason); err != nil {
			log.Printf("confirmation: MarkExhausted failed for job %s: %v", job.ID, err)
		}
		log.Printf("confirmation: exhausted %s after %d attempts: %s", job.NombaTxnRef, job.AttemptCount, reason)
		return
	}
	delay := confirmBackoff[job.AttemptCount]
	nextRetry := time.Now().Add(delay)
	if err := w.store.ConfirmationJobs.IncrementAttempt(ctx, job.ID, nextRetry, reason); err != nil {
		log.Printf("confirmation: IncrementAttempt failed for job %s: %v", job.ID, err)
	}
}
