CREATE TABLE virtual_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    account_ref VARCHAR(64) NOT NULL UNIQUE,
    provider VARCHAR(30) NOT NULL DEFAULT 'nomba',
    bank_account_number VARCHAR(10),
    bank_account_name VARCHAR(100),
    bank_name VARCHAR(100),
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    status VARCHAR(30) NOT NULL DEFAULT 'provisioning_pending'
        CHECK (status IN ('provisioning_pending', 'active', 'suspended', 'expired', 'closed')),
    callback_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_virtual_accounts_tenant_id ON virtual_accounts(tenant_id);
CREATE INDEX idx_virtual_accounts_customer_id ON virtual_accounts(customer_id);
CREATE INDEX idx_virtual_accounts_bank_account_number ON virtual_accounts(bank_account_number);
