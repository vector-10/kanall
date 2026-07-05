CREATE TABLE confirmation_jobs (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID        NOT NULL,
    nomba_txn_ref        TEXT        NOT NULL,
    transaction_group_id UUID        NOT NULL,
    status               TEXT        NOT NULL DEFAULT 'pending',
    attempt_count        INT         NOT NULL DEFAULT 0,
    last_error           TEXT,
    next_retry_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_confirmation_jobs_pending
    ON confirmation_jobs (status, next_retry_at)
    WHERE status = 'pending';
