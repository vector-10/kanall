ALTER TABLE customers
    ADD COLUMN kyc_tier   INT          NOT NULL DEFAULT 1 CHECK (kyc_tier IN (1, 2, 3)),
    ADD COLUMN nin_encrypted TEXT,
    ADD COLUMN nin_last4     VARCHAR(4);

ALTER TABLE webhook_events
    ADD COLUMN category VARCHAR(30);
