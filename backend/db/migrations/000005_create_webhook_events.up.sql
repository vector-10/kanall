-- Every inbound webhook is persisted here first, before any processing.
-- This is the dead-letter queue: failed events stay replayable with their
-- raw payload intact, so reconciliation is never dependent on a webhook
-- being processed successfully on first receipt.
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomba_txn_ref VARCHAR(255),
    payload_raw JSONB NOT NULL,
    signature_valid BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'dead_letter')),
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_nomba_txn_ref ON webhook_events(nomba_txn_ref);
