CREATE TABLE email_verifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    otp_hash   TEXT        NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one pending (unverified) record per tenant at a time
CREATE UNIQUE INDEX email_verifications_tenant_pending
    ON email_verifications (tenant_id)
    WHERE verified_at IS NULL;
