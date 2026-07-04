
ALTER TABLE customers
  ADD COLUMN kyc_status VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN nin_document_encrypted TEXT;

ALTER TABLE customers
  ADD CONSTRAINT customers_kyc_status_check
  CHECK (kyc_status IN ('none', 'pending_review', 'approved', 'rejected'));
