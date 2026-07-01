ALTER TABLE virtual_accounts
  ADD CONSTRAINT uq_virtual_accounts_tenant_customer UNIQUE (tenant_id, customer_id);
