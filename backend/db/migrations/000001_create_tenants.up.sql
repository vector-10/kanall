CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    api_key_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending_verification'
        CHECK (status IN ('pending_verification', 'active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- api_key_hash is '' until OTP verification issues a real key, so uniqueness
-- is only enforced once a tenant actually has one (empty string is not unique).
CREATE UNIQUE INDEX tenants_api_key_hash_key ON tenants (api_key_hash) WHERE api_key_hash <> '';
