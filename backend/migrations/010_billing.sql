ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'INACTIVE'
  CHECK (subscription_status IN ('INACTIVE','ACTIVE','PAST_DUE','CANCELED'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
