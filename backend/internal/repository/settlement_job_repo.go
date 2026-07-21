package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vector-10/kanall/internal/model"
)

type SettlementJobRepo struct {
	pool *pgxpool.Pool
}


func (r *SettlementJobRepo) ClaimBatch(ctx context.Context) ([]model.SettlementJob, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		SELECT id, tenant_id, virtual_account_id, transaction_group_id, merchant_tx_ref,
		       amount_naira, bank_code, account_number, account_name, narration,
		       status, attempt_count, last_error, next_retry_at, created_at, updated_at
		FROM settlement_jobs
		WHERE (status = 'pending' OR status = 'failed')
		  AND (next_retry_at IS NULL OR next_retry_at <= now())
		ORDER BY next_retry_at ASC NULLS FIRST
		LIMIT 50
		FOR UPDATE SKIP LOCKED
	`)
	if err != nil {
		return nil, err
	}

	var jobs []model.SettlementJob
	var ids []uuid.UUID
	for rows.Next() {
		var j model.SettlementJob
		if err := rows.Scan(
			&j.ID, &j.TenantID, &j.VirtualAccountID, &j.TransactionGroupID, &j.MerchantTxRef,
			&j.AmountNaira, &j.BankCode, &j.AccountNumber, &j.AccountName, &j.Narration,
			&j.Status, &j.AttemptCount, &j.LastError, &j.NextRetryAt, &j.CreatedAt, &j.UpdatedAt,
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
		UPDATE settlement_jobs
		SET next_retry_at = now() + interval '2 minutes'
		WHERE id = ANY($1)
	`, ids)
	if err != nil {
		return nil, err
	}

	return jobs, tx.Commit(ctx)
}

func (r *SettlementJobRepo) UpdateAfterAttempt(ctx context.Context, id uuid.UUID, status string, lastError *string, nextRetryAt *time.Time) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE settlement_jobs
		SET status        = $2,
		    last_error    = $3,
		    next_retry_at = $4,
		    attempt_count = attempt_count + 1,
		    updated_at    = now()
		WHERE id = $1
	`, id, status, lastError, nextRetryAt)
	return err
}

func (r *SettlementJobRepo) GetByMerchantTxRef(ctx context.Context, tenantID uuid.UUID, ref string) (*model.SettlementJob, error) {
	j := &model.SettlementJob{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, tenant_id, virtual_account_id, transaction_group_id, merchant_tx_ref,
		       amount_naira, bank_code, account_number, account_name, narration,
		       status, attempt_count, last_error, next_retry_at, created_at, updated_at
		FROM settlement_jobs
		WHERE tenant_id = $1 AND merchant_tx_ref = $2
	`, tenantID, ref).Scan(
		&j.ID, &j.TenantID, &j.VirtualAccountID, &j.TransactionGroupID, &j.MerchantTxRef,
		&j.AmountNaira, &j.BankCode, &j.AccountNumber, &j.AccountName, &j.Narration,
		&j.Status, &j.AttemptCount, &j.LastError, &j.NextRetryAt, &j.CreatedAt, &j.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return j, nil
}
