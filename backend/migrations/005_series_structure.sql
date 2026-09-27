CREATE TABLE IF NOT EXISTS catalog_seasons (
  id text PRIMARY KEY,
  title_id text NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  season_number smallint NOT NULL CHECK (season_number > 0),
  title varchar(160) NOT NULL,
  synopsis text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (title_id, season_number)
);

CREATE TABLE IF NOT EXISTS catalog_episodes (
  id text PRIMARY KEY,
  season_id text NOT NULL REFERENCES catalog_seasons(id) ON DELETE CASCADE,
  episode_number smallint NOT NULL CHECK (episode_number > 0),
  title varchar(160) NOT NULL,
  synopsis text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 10000),
  thumbnail_url text NOT NULL DEFAULT '',
  video_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, episode_number)
);

CREATE INDEX IF NOT EXISTS catalog_seasons_title_idx ON catalog_seasons(title_id, season_number);
CREATE INDEX IF NOT EXISTS catalog_episodes_season_idx ON catalog_episodes(season_id, episode_number);
