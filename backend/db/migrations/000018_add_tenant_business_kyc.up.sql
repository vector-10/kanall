ALTER TABLE tenants
    ADD COLUMN business_type           VARCHAR(50),
    ADD COLUMN cac_number              VARCHAR(20),
    ADD COLUMN kyc_status              VARCHAR(20) NOT NULL DEFAULT 'unverified'
                                           CHECK (kyc_status IN ('unverified', 'pending_review', 'verified')),
    ADD COLUMN kyc_submitted_at        TIMESTAMPTZ,
    ADD COLUMN webhook_secret_encrypted TEXT;
