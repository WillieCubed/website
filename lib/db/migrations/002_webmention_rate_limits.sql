-- Webmention receiving rate limit
-- Run with: psql $DATABASE_URL -f lib/db/migrations/002_webmention_rate_limits.sql

-- ============================================================================
-- Per-client request counts for POST /api/webmention, kept in Postgres so the
-- limit holds across serverless instances. One row per client key, holding
-- the start of its current window and the requests made in it.
-- ============================================================================
CREATE TABLE IF NOT EXISTS webmention_rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hits INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_webmention_rate_limits_window
  ON webmention_rate_limits(window_start);
