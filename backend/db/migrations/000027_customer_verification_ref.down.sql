ALTER TABLE customers DROP COLUMN IF EXISTS verification_ref;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS nin_document_encrypted TEXT;
