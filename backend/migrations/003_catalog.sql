ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'USER'
  CHECK (role IN ('USER', 'ADMIN'));

CREATE TABLE IF NOT EXISTS catalog_titles (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('MOVIE', 'SERIES')),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  synopsis text NOT NULL,
  release_year smallint NOT NULL CHECK (release_year BETWEEN 1888 AND 2200),
  maturity_rating text NOT NULL,
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  thumbnail_url text NOT NULL DEFAULT '',
  hero_image_url text NOT NULL DEFAULT '',
  preview_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS catalog_titles_status_published_idx
  ON catalog_titles(status, published_at DESC);

CREATE INDEX IF NOT EXISTS catalog_titles_title_idx
  ON catalog_titles(lower(title));
