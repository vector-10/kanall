-- Outbox table for outbound webhook delivery to tenant callback URLs.
-- The retry worker polls this table and fires HTTP POST to callback_url.
-- Append-only insert at ledger-write time; status transitions via UPDATE.
CREATE TABLE tenant_webhook_deliveries (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    transaction_group_id UUID NOT NULL,
    payload              JSONB NOT NULL,
    callback_url         TEXT NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'delivered', 'failed', 'dead_letter')),
    attempt_count        INT NOT NULL DEFAULT 0,
    last_error           TEXT,
    next_retry_at        TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at         TIMESTAMPTZ
);

CREATE INDEX idx_twd_tenant_id ON tenant_webhook_deliveries(tenant_id);
CREATE INDEX idx_twd_status ON tenant_webhook_deliveries(status);
-- Partial index: only pending/failed rows are ever polled by the retry worker.
CREATE INDEX idx_twd_retryable ON tenant_webhook_deliveries(next_retry_at)
    WHERE status IN ('pending', 'failed');
