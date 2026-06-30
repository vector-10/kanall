ALTER TABLE tenants ADD COLUMN email VARCHAR(255);
CREATE UNIQUE INDEX tenants_email_key ON tenants (email) WHERE email IS NOT NULL;
