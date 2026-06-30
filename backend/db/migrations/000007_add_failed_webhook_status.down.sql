-- Revert to three-state status. Any rows currently in 'failed' must be cleared first.
UPDATE webhook_events SET status = 'dead_letter' WHERE status = 'failed';

ALTER TABLE webhook_events
    DROP CONSTRAINT IF EXISTS webhook_events_status_check;

ALTER TABLE webhook_events
    ADD CONSTRAINT webhook_events_status_check
    CHECK (status IN ('pending', 'processed', 'dead_letter'));
