-- IndieAuth server
-- Run with: psql $DATABASE_URL -f lib/db/migrations/003_indieauth.sql

-- ============================================================================
-- Authorization codes issued by /indieauth/consent. Stored by SHA-256 digest,
-- never in the clear. A code lives ten minutes and redeems once: used_at is
-- set the moment it is looked up.
-- ============================================================================
CREATE TABLE IF NOT EXISTS indieauth_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  me TEXT NOT NULL,
  -- Space-separated, as OAuth writes scopes.
  scope TEXT NOT NULL DEFAULT '',
  code_challenge TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_indieauth_codes_expires
  ON indieauth_codes(expires_at);

-- ============================================================================
-- Access tokens issued by /indieauth/token, also stored by digest. Revoking
-- sets revoked_at rather than deleting the row, so the grant history stays.
-- ============================================================================
CREATE TABLE IF NOT EXISTS indieauth_tokens (
  token_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  me TEXT NOT NULL,
  scope TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_indieauth_tokens_client
  ON indieauth_tokens(client_id);

-- ============================================================================
-- The owner check on the consent page. The latest TOTP time step used, so a
-- code works once, and each failed attempt, so guessing is capped per day.
-- ============================================================================
CREATE TABLE IF NOT EXISTS indieauth_totp_steps (
  step BIGINT PRIMARY KEY,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indieauth_sign_in_failures (
  id BIGSERIAL PRIMARY KEY,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indieauth_sign_in_failures_failed
  ON indieauth_sign_in_failures(failed_at);
