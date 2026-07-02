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
		INSERT INTO webhook_events (id, nomba_txn_ref, payload_raw, signature_valid, status, category, retry_count)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING received_at
	`, w.ID, w.NombaTxnRef, w.PayloadRaw, w.SignatureValid, w.Status, w.Category, w.RetryCount).
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

func (r *WebhookRepo) UpdateCategory(ctx context.Context, id uuid.UUID, category string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE webhook_events SET category = $1 WHERE id = $2
	`, category, id)
	return err
}

func (r *WebhookRepo) ListMisdirected(ctx context.Context) ([]model.WebhookEvent, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, nomba_txn_ref, payload_raw, signature_valid, status, category, error_message, retry_count, received_at, processed_at
		FROM webhook_events
		WHERE category = 'misdirected'
		ORDER BY received_at DESC
		LIMIT 200
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []model.WebhookEvent
	for rows.Next() {
		var e model.WebhookEvent
		if err := rows.Scan(
			&e.ID, &e.NombaTxnRef, &e.PayloadRaw, &e.SignatureValid,
			&e.Status, &e.Category, &e.ErrorMessage, &e.RetryCount,
			&e.ReceivedAt, &e.ProcessedAt,
		); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, rows.Err()
}
