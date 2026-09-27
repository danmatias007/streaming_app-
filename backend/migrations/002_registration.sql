CREATE TABLE IF NOT EXISTS registration_tokens (
  token_hash text PRIMARY KEY,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registration_tokens_email_idx ON registration_tokens(email);
CREATE INDEX IF NOT EXISTS registration_tokens_expires_at_idx ON registration_tokens(expires_at);
