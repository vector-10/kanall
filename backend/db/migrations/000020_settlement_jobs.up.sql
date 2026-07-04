CREATE TABLE settlement_jobs (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    virtual_account_id  UUID NOT NULL REFERENCES virtual_accounts(id),
    transaction_group_id UUID NOT NULL,
    merchant_tx_ref     VARCHAR NOT NULL UNIQUE,
    amount_naira        NUMERIC(20, 4) NOT NULL,
    bank_code           VARCHAR NOT NULL,
    account_number      VARCHAR(10) NOT NULL,
    account_name        VARCHAR NOT NULL,
    narration           TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'completed', 'failed', 'dead_letter')),
    attempt_count       INT NOT NULL DEFAULT 0,
    last_error          TEXT,
    next_retry_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_settlement_jobs_retryable
    ON settlement_jobs (next_retry_at ASC NULLS FIRST)
    WHERE status IN ('pending', 'failed');
