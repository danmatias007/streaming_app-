ALTER TABLE catalog_titles
  ADD COLUMN IF NOT EXISTS media_url text NOT NULL DEFAULT '';

UPDATE catalog_titles
SET media_url = preview_url
WHERE media_url = '' AND preview_url <> '';

ALTER TABLE media_jobs
  ADD COLUMN IF NOT EXISTS media_purpose varchar(20) NOT NULL DEFAULT 'MAIN_CONTENT'
  CHECK (media_purpose IN ('TRAILER','MAIN_CONTENT'));

CREATE INDEX IF NOT EXISTS media_jobs_target_purpose_idx
  ON media_jobs(content_id, media_purpose, created_at DESC);
