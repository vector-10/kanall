ALTER TABLE virtual_accounts
    DROP CONSTRAINT virtual_accounts_status_check;

ALTER TABLE virtual_accounts
    ADD CONSTRAINT virtual_accounts_status_check
    CHECK (status IN ('provisioning_pending', 'active', 'suspended', 'expired', 'closed'));

ALTER TABLE customers
    DROP CONSTRAINT customers_status_check;

ALTER TABLE customers
    ADD CONSTRAINT customers_status_check
    CHECK (status IN ('active', 'suspended', 'closed'));
