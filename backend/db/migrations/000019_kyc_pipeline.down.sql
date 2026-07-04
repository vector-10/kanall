ALTER TABLE customers
  DROP CONSTRAINT customers_kyc_status_check,
  DROP COLUMN nin_document_encrypted,
  DROP COLUMN kyc_status;
