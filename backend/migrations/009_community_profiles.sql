ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'STANDARD'
  CHECK (subscription_tier IN ('STANDARD', 'PRO', 'FAMILY'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'pt'
  CHECK (preferred_language IN ('pt', 'es', 'en'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorite_genres text[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorite_kinds text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('WELCOME', 'GIFT', 'SOCIAL', 'CONTENT', 'PLAN')),
  title text NOT NULL,
  message text NOT NULL,
  action_url text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_profile_created_idx ON notifications(profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS content_reviews (
  id uuid PRIMARY KEY,
  content_id text NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (char_length(body) BETWEEN 3 AND 2000),
  spoiler boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_reviews_content_created_idx ON content_reviews(content_id, created_at DESC);

CREATE TABLE IF NOT EXISTS review_likes (
  review_id uuid NOT NULL REFERENCES content_reviews(id) ON DELETE CASCADE,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(review_id, profile_id)
);

CREATE TABLE IF NOT EXISTS review_replies (
  id uuid PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES content_reviews(id) ON DELETE CASCADE,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_replies_review_created_idx ON review_replies(review_id, created_at);
