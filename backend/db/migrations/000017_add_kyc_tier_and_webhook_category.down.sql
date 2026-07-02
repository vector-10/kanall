ALTER TABLE customers
    DROP COLUMN IF EXISTS kyc_tier,
    DROP COLUMN IF EXISTS nin_encrypted,
    DROP COLUMN IF EXISTS nin_last4;

ALTER TABLE webhook_events
    DROP COLUMN IF EXISTS category;
