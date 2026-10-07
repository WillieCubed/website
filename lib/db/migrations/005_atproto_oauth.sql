CREATE TABLE IF NOT EXISTS atproto_oauth_states (
  key_hash TEXT PRIMARY KEY,
  encrypted_value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS atproto_oauth_states_expiry ON atproto_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS atproto_oauth_sessions (
  key_hash TEXT PRIMARY KEY,
  encrypted_value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS atproto_oauth_sessions_expiry ON atproto_oauth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS atproto_browser_sessions (
  token_hash TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS atproto_browser_sessions_expiry ON atproto_browser_sessions(expires_at);

CREATE TABLE IF NOT EXISTS atproto_rate_limits (
  key_hash TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS atproto_rate_limits_expiry ON atproto_rate_limits(expires_at);
