-- Remove suspended/closed from virtual_accounts — only active and expired are real states
ALTER TABLE virtual_accounts
    DROP CONSTRAINT virtual_accounts_status_check;

ALTER TABLE virtual_accounts
    ADD CONSTRAINT virtual_accounts_status_check
    CHECK (status IN ('provisioning_pending', 'active', 'expired'));

-- Remove suspended/closed from customers — only active is used
ALTER TABLE customers
    DROP CONSTRAINT customers_status_check;

ALTER TABLE customers
    ADD CONSTRAINT customers_status_check
    CHECK (status IN ('active'));
