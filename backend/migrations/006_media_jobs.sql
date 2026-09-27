CREATE TABLE IF NOT EXISTS media_jobs (
  id text PRIMARY KEY,
  content_id text NOT NULL,
  original_filename text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  source_path text NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','PROCESSING','READY','FAILED')),
  output_url text NOT NULL DEFAULT '',
  error_message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_jobs_content_created_idx ON media_jobs(content_id, created_at DESC);
