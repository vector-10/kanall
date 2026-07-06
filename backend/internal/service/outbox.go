package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/vector-10/kanall/internal/crypto"
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
	store         *repository.Store
	httpClient    *http.Client
	work          chan model.TenantWebhookDelivery
	encryptionKey string
}

func NewOutboxWorker(store *repository.Store, httpTimeout time.Duration, encryptionKey string) *OutboxWorker {
	return &OutboxWorker{
		store:         store,
		httpClient:    &http.Client{Timeout: httpTimeout},
		work:          make(chan model.TenantWebhookDelivery, 500),
		encryptionKey: encryptionKey,
	}
}

func (w *OutboxWorker) Start(ctx context.Context) {
	log.Println("outbox: worker started")
	for i := 0; i < 10; i++ {
		go w.runWorker(ctx)
	}
	ticker := time.NewTicker(5 * time.Second)
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

func (w *OutboxWorker) runWorker(ctx context.Context) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("outbox: worker panic recovered: %v", rec)
		}
	}()
	for {
		select {
		case <-ctx.Done():
			return
		case d := <-w.work:
			w.deliver(ctx, d)
		}
	}
}

func (w *OutboxWorker) sweep(ctx context.Context) {
	deliveries, err := w.store.WebhookDeliveries.ClaimBatch(ctx, 100)
	if err != nil {
		log.Printf("outbox: claim failed: %v", err)
		return
	}
	for _, d := range deliveries {
		select {
		case w.work <- d:
		default:
			// channel full — delivery stays in DB and is picked up next sweep
		}
	}
}

func (w *OutboxWorker) deliver(ctx context.Context, d model.TenantWebhookDelivery) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.CallbackURL, bytes.NewReader(d.Payload))
	if err != nil {
		w.fail(ctx, d, fmt.Sprintf("build request: %v", err))
		return
	}
	req.Header.Set("Content-Type", "application/json")

	if sig, ok := w.buildSignature(ctx, d); ok {
		req.Header.Set("X-Kanall-Signature", sig)
	}

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

func (w *OutboxWorker) buildSignature(ctx context.Context, d model.TenantWebhookDelivery) (string, bool) {
	if w.encryptionKey == "" {
		return "", false
	}

	tenant, err := w.store.Tenants.GetByID(ctx, d.TenantID)
	if err != nil || tenant.WebhookSecretEncrypted == nil {
		return "", false
	}

	rawSecret, err := crypto.Decrypt(*tenant.WebhookSecretEncrypted, w.encryptionKey)
	if err != nil {
		log.Printf("outbox: failed to decrypt webhook secret for tenant %s: %v", d.TenantID, err)
		return "", false
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	signed := timestamp + "." + string(d.Payload)
	mac := hmac.New(sha256.New, []byte(rawSecret))
	mac.Write([]byte(signed))
	sig := "t=" + timestamp + ",v1=" + hex.EncodeToString(mac.Sum(nil))
	return sig, true
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
