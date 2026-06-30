package service

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/vector-10/kanall/internal/model"
	"github.com/vector-10/kanall/internal/repository"
)

var deliveryBackoff = []time.Duration{
	2 * time.Minute,
	5 * time.Minute,
	11 * time.Minute,
	24 * time.Minute,
	53 * time.Minute,
}

const maxDeliveryAttempts = 5

type OutboxWorker struct {
	store      *repository.Store
	httpClient *http.Client
	sem        chan struct{}
}

func NewOutboxWorker(store *repository.Store, httpTimeout time.Duration) *OutboxWorker {
	return &OutboxWorker{
		store:      store,
		httpClient: &http.Client{Timeout: httpTimeout},
		sem:        make(chan struct{}, 10),
	}
}

func (w *OutboxWorker) Start(ctx context.Context) {
	log.Println("outbox: worker started")
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			log.Println("outbox: worker stopped")
			return
		case <-ticker.C:
			w.sweep(ctx)
		}
	}
}

func (w *OutboxWorker) sweep(ctx context.Context) {
	deliveries, err := w.store.WebhookDeliveries.ListRetryable(ctx)
	if err != nil {
		log.Printf("outbox: list failed: %v", err)
		return
	}
	for _, d := range deliveries {
		d := d
		go w.deliver(ctx, d)
	}
}

func (w *OutboxWorker) deliver(ctx context.Context, d model.TenantWebhookDelivery) {
	select {
	case w.sem <- struct{}{}:
		defer func() { <-w.sem }()
	case <-ctx.Done():
		return
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.CallbackURL, bytes.NewReader(d.Payload))
	if err != nil {
		w.fail(ctx, d, fmt.Sprintf("build request: %v", err))
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := w.httpClient.Do(req)
	if err != nil {
		w.fail(ctx, d, fmt.Sprintf("http: %v", err))
		return
	}
	resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		if err := w.store.WebhookDeliveries.UpdateAfterAttempt(ctx, d.ID, "delivered", nil, nil); err != nil {
			log.Printf("outbox: mark delivered failed %s: %v", d.ID, err)
		}
		return
	}

	w.fail(ctx, d, fmt.Sprintf("non-2xx: %d", resp.StatusCode))
}

func (w *OutboxWorker) fail(ctx context.Context, d model.TenantWebhookDelivery, reason string) {
	errMsg := reason

	if d.AttemptCount >= maxDeliveryAttempts-1 {
		if err := w.store.WebhookDeliveries.UpdateAfterAttempt(ctx, d.ID, "dead_letter", &errMsg, nil); err != nil {
			log.Printf("outbox: mark dead_letter failed %s: %v", d.ID, err)
		}
		log.Printf("outbox: dead_letter %s after %d attempts: %s", d.ID, d.AttemptCount+1, reason)
		return
	}

	t := time.Now().Add(deliveryBackoff[d.AttemptCount])
	if err := w.store.WebhookDeliveries.UpdateAfterAttempt(ctx, d.ID, "failed", &errMsg, &t); err != nil {
		log.Printf("outbox: mark failed %s: %v", d.ID, err)
	}
}
