package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vector-10/kanall/internal/model"
)

type ConfirmationJobRepo struct {
	pool *pgxpool.Pool
}

func (r *ConfirmationJobRepo) Create(ctx context.Context, job model.ConfirmationJob) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO confirmation_jobs
			(id, tenant_id, nomba_txn_ref, transaction_group_id, status, next_retry_at)
		VALUES ($1, $2, $3, $4, 'pending', now())
		ON CONFLICT (nomba_txn_ref) DO NOTHING
	`, job.ID, job.TenantID, job.NombaTxnRef, job.TransactionGroupID)
	return err
}


func (r *ConfirmationJobRepo) ClaimBatch(ctx context.Context, limit int) ([]model.ConfirmationJob, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		SELECT id, tenant_id, nomba_txn_ref, transaction_group_id,
		       status, attempt_count, last_error, next_retry_at, created_at
		FROM confirmation_jobs
		WHERE status = 'pending' AND next_retry_at <= now()
		ORDER BY next_retry_at ASC
		LIMIT $1
		FOR UPDATE SKIP LOCKED
	`, limit)
	if err != nil {
		return nil, err
	}

	var jobs []model.ConfirmationJob
	var ids []uuid.UUID
	for rows.Next() {
		var j model.ConfirmationJob
		if err := rows.Scan(
			&j.ID, &j.TenantID, &j.NombaTxnRef, &j.TransactionGroupID,
			&j.Status, &j.AttemptCount, &j.LastError, &j.NextRetryAt, &j.CreatedAt,
		); err != nil {
			rows.Close()
			return nil, err
		}
		jobs = append(jobs, j)
		ids = append(ids, j.ID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(ids) == 0 {
		return nil, tx.Commit(ctx)
	}

	_, err = tx.Exec(ctx, `
		UPDATE confirmation_jobs
		SET next_retry_at = now() + interval '6 minutes'
		WHERE id = ANY($1)
	`, ids)
	if err != nil {
		return nil, err
	}

	return jobs, tx.Commit(ctx)
}

func (r *ConfirmationJobRepo) MarkConfirmed(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE confirmation_jobs SET status = 'confirmed'
		WHERE id = $1
	`, id)
	return err
}

func (r *ConfirmationJobRepo) MarkExhausted(ctx context.Context, id uuid.UUID, lastError string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE confirmation_jobs
		SET status       = 'exhausted',
		    last_error   = $2,
		    attempt_count = attempt_count + 1
		WHERE id = $1
	`, id, lastError)
	return err
}

func (r *ConfirmationJobRepo) IncrementAttempt(ctx context.Context, id uuid.UUID, nextRetryAt time.Time, lastError string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE confirmation_jobs
		SET attempt_count = attempt_count + 1,
		    next_retry_at = $2,
		    last_error    = $3
		WHERE id = $1
	`, id, nextRetryAt, lastError)
	return err
}
