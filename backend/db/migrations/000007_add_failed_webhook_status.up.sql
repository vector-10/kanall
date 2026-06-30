-- Add 'failed' as a retryable status distinct from 'dead_letter' (permanent failure).
-- failed      = transient error (DB hiccup, temporary unavailability) — retryable
-- dead_letter = permanent failure (invalid signature, unknown account) — needs investigation
DO $$ DECLARE
    v_conname text;
BEGIN
    SELECT conname INTO v_conname
    FROM pg_constraint
    WHERE conrelid = 'webhook_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%';

    IF v_conname IS NOT NULL THEN
        EXECUTE 'ALTER TABLE webhook_events DROP CONSTRAINT ' || quote_ident(v_conname);
    END IF;
END $$;

ALTER TABLE webhook_events
    ADD CONSTRAINT webhook_events_status_check
    CHECK (status IN ('pending', 'processed', 'dead_letter', 'failed'));
