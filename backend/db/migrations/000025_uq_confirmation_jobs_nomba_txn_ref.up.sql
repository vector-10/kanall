ALTER TABLE confirmation_jobs
ADD CONSTRAINT uq_confirmation_jobs_nomba_txn_ref UNIQUE (nomba_txn_ref);
