-- Idempotency gate: one row per provider transaction reference.
-- Atomic INSERT ... ON CONFLICT DO NOTHING is the single source of truth
-- for "have we already processed this event".
CREATE TABLE processed_events (
    nomba_txn_ref VARCHAR(255) PRIMARY KEY,
    transaction_group_id UUID NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- True double-entry ledger. Every inbound payment posts two rows sharing
-- a transaction_group_id: a credit to the customer's virtual_account and
-- a debit to the tenant's settlement account (account_type = 'tenant_settlement',
-- account_id = tenants.id). Sum of all entries is always zero.
-- Corrections never mutate existing rows -- a correcting entry sets
-- reverses_group_id and points back at the group it corrects.
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    transaction_group_id UUID NOT NULL,
    nomba_txn_ref VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('virtual_account', 'tenant_settlement')),
    account_id UUID NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('debit', 'credit')),
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    status VARCHAR(20) NOT NULL DEFAULT 'provisional' CHECK (status IN ('provisional', 'confirmed', 'reversed')),
    reverses_group_id UUID,
    narration TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (transaction_group_id, account_id)
);

CREATE INDEX idx_ledger_entries_nomba_txn_ref ON ledger_entries(nomba_txn_ref);
CREATE INDEX idx_ledger_entries_tenant_account ON ledger_entries(tenant_id, account_id);
CREATE INDEX idx_ledger_entries_status ON ledger_entries(status);
