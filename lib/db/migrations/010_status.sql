-- City-center coordinates only. Device/beacon positions do not belong here.
CREATE TABLE IF NOT EXISTS status_location (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  source text NOT NULL CHECK (source = 'manual'),
  location jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS status_admin_sessions (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS status_admin_sessions_expiry ON status_admin_sessions (expires_at);
