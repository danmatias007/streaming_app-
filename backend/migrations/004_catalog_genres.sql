CREATE TABLE IF NOT EXISTS catalog_genres (
  id text PRIMARY KEY,
  name varchar(80) NOT NULL UNIQUE,
  slug varchar(80) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_title_genres (
  title_id text NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  genre_id text NOT NULL REFERENCES catalog_genres(id) ON DELETE RESTRICT,
  PRIMARY KEY (title_id, genre_id)
);

CREATE INDEX IF NOT EXISTS catalog_title_genres_genre_idx
  ON catalog_title_genres(genre_id, title_id);
