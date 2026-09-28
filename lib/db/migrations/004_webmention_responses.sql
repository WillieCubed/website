-- Webmention responses
-- Run with: psql $DATABASE_URL -f lib/db/migrations/004_webmention_responses.sql
-- Apply it before deploying the code that reads these columns: every
-- webmention query names them, and a query that names a missing column fails.

-- ============================================================================
-- The answer an RSVP gave. Only rows of type 'rsvp' carry one, and every
-- answer is kept, including 'no', which the post does not display.
-- ============================================================================
ALTER TABLE webmentions
  ADD COLUMN IF NOT EXISTS rsvp TEXT
  CHECK (rsvp IN ('yes', 'no', 'maybe', 'interested'));
