CREATE TABLE IF NOT EXISTS profile_watchlist (
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_id text NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, content_id)
);

CREATE INDEX IF NOT EXISTS profile_watchlist_profile_created_idx
  ON profile_watchlist(profile_id, created_at DESC);
