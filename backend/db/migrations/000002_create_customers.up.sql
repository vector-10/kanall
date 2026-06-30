CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_ref VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    bvn_encrypted TEXT,
    bvn_last4 VARCHAR(4),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, external_ref)
);

CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
