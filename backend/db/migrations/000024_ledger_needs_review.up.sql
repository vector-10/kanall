ALTER TABLE ledger_entries
    DROP CONSTRAINT IF EXISTS ledger_entries_status_check;

ALTER TABLE ledger_entries
    ADD CONSTRAINT ledger_entries_status_check
    CHECK (status IN ('provisional', 'confirmed', 'reversed', 'needs_review'));
