-- Change idempotency key from transactionId to requestId (webhook delivery ID).
-- requestId is stable across Nomba retries; transactionId is not the dedup key.
ALTER TABLE processed_events RENAME COLUMN nomba_txn_ref TO request_id;
