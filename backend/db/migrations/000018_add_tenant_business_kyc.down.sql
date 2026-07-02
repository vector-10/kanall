ALTER TABLE tenants
    DROP COLUMN IF EXISTS business_type,
    DROP COLUMN IF EXISTS cac_number,
    DROP COLUMN IF EXISTS kyc_status,
    DROP COLUMN IF EXISTS kyc_submitted_at,
    DROP COLUMN IF EXISTS webhook_secret_encrypted;
