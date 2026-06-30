package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vector-10/kanall/internal/model"
)

type WebhookDeliveryRepo struct {
	pool *pgxpool.Pool
}

func (r *WebhookDeliveryRepo) Create(ctx context.Context, d *model.TenantWebhookDelivery) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO tenant_webhook_deliveries
			(id, tenant_id, transaction_group_id, payload, callback_url, status, attempt_count)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, d.ID, d.TenantID, d.TransactionGroupID, d.Payload, d.CallbackURL, d.Status, d.AttemptCount)
	return err
}

// ListRetryable returns pending deliveries and failed ones past their next_retry_at.
func (r *WebhookDeliveryRepo) ListRetryable(ctx context.Context) ([]model.TenantWebhookDelivery, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, tenant_id, transaction_group_id, payload, callback_url, status,
		       attempt_count, last_error, next_retry_at, created_at, delivered_at
		FROM tenant_webhook_deliveries
		WHERE status = 'pending'
		   OR (status = 'failed' AND next_retry_at <= now())
		ORDER BY next_retry_at ASC NULLS FIRST
		LIMIT 100
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanDeliveries(rows)
}

// UpdateAfterAttempt updates status and retry metadata after each delivery attempt.
func (r *WebhookDeliveryRepo) UpdateAfterAttempt(ctx context.Context, id uuid.UUID, status string, lastError *string, nextRetryAt *time.Time) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE tenant_webhook_deliveries
		SET status        = $2,
		    last_error    = $3,
		    next_retry_at = $4,
		    attempt_count = attempt_count + 1,
		    delivered_at  = CASE WHEN $2 = 'delivered' THEN now() ELSE NULL END
		WHERE id = $1
	`, id, status, lastError, nextRetryAt)
	return err
}

func (r *WebhookDeliveryRepo) ListDeadLetters(ctx context.Context, tenantID uuid.UUID) ([]model.TenantWebhookDelivery, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, tenant_id, transaction_group_id, payload, callback_url, status,
		       attempt_count, last_error, next_retry_at, created_at, delivered_at
		FROM tenant_webhook_deliveries
		WHERE tenant_id = $1 AND status = 'dead_letter'
		ORDER BY created_at DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanDeliveries(rows)
}

func scanDeliveries(rows pgx.Rows) ([]model.TenantWebhookDelivery, error) {
	var deliveries []model.TenantWebhookDelivery
	for rows.Next() {
		var d model.TenantWebhookDelivery
		if err := rows.Scan(
			&d.ID, &d.TenantID, &d.TransactionGroupID, &d.Payload, &d.CallbackURL, &d.Status,
			&d.AttemptCount, &d.LastError, &d.NextRetryAt, &d.CreatedAt, &d.DeliveredAt,
		); err != nil {
			return nil, err
		}
		deliveries = append(deliveries, d)
	}
	return deliveries, rows.Err()
}
