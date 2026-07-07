ALTER TABLE customers ADD COLUMN verification_ref TEXT;
ALTER TABLE customers DROP COLUMN IF EXISTS nin_document_encrypted;
