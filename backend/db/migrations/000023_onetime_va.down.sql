ALTER TABLE virtual_accounts
    DROP COLUMN IF EXISTS expires_at,
    DROP COLUMN IF EXISTS va_type;
