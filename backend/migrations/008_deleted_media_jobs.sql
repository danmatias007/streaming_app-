ALTER TABLE media_jobs
  DROP CONSTRAINT IF EXISTS media_jobs_status_check;

ALTER TABLE media_jobs
  ADD CONSTRAINT media_jobs_status_check
  CHECK (status IN ('QUEUED','PROCESSING','READY','FAILED','DELETED'));
