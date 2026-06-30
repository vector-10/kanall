-- Lifecycle audit trail for virtual accounts: every state transition
-- (provisioning_pending -> active, active -> suspended, rename, closure,
-- KYC tier change) is appended here, never overwritten.
CREATE TABLE account_state_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    virtual_account_id UUID NOT NULL REFERENCES virtual_accounts(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_state_log_account ON account_state_log(virtual_account_id);
