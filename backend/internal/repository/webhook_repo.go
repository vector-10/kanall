package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vector-10/kanall/internal/model"
)

type WebhookRepo struct {
	pool *pgxpool.Pool
}

func (r *WebhookRepo) Create(ctx context.Context, w *model.WebhookEvent) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO webhook_events (id, nomba_txn_ref, payload_raw, signature_valid, status, retry_count)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING received_at
	`, w.ID, w.NombaTxnRef, w.PayloadRaw, w.SignatureValid, w.Status, w.RetryCount).
		Scan(&w.ReceivedAt)
}

func (r *WebhookRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status string, errMsg *string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE webhook_events
		SET status = $1, error_message = $2, processed_at = now(), retry_count = retry_count + 1
		WHERE id = $3
	`, status, errMsg, id)
	return err
}
