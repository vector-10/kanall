ALTER TABLE virtual_accounts
    ADD COLUMN expires_at  TIMESTAMPTZ,
    ADD COLUMN va_type     TEXT NOT NULL DEFAULT 'dedicated'
        CHECK (va_type IN ('dedicated', 'onetime'));
