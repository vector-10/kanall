UPDATE ledger_entries SET status = 'provisional' WHERE status = 'needs_review';

ALTER TABLE ledger_entries
    DROP CONSTRAINT IF EXISTS ledger_entries_status_check;

ALTER TABLE ledger_entries
    ADD CONSTRAINT ledger_entries_status_check
    CHECK (status IN ('provisional', 'confirmed', 'reversed'));
