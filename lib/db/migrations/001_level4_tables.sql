-- IndieMark Level 4 Database Schema
-- Run with: psql $DATABASE_URL -f lib/db/migrations/001_level4_tables.sql

-- ============================================================================
-- Outgoing Webmention Tracking
-- Tracks webmentions we've sent to avoid duplicates and handle updates/deletes
-- ============================================================================
CREATE TABLE IF NOT EXISTS outgoing_webmentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  endpoint_url TEXT,
  post_slug TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  response_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_url, target_url)
);

CREATE INDEX IF NOT EXISTS idx_outgoing_wm_slug ON outgoing_webmentions(post_slug);
CREATE INDEX IF NOT EXISTS idx_outgoing_wm_status ON outgoing_webmentions(status);
CREATE INDEX IF NOT EXISTS idx_outgoing_wm_created ON outgoing_webmentions(created_at DESC);

-- ============================================================================
-- Reply Context Cache
-- Caches metadata about URLs we're replying to, liking, reposting, etc.
-- ============================================================================
CREATE TABLE IF NOT EXISTS reply_context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_url TEXT NOT NULL UNIQUE,
  author_name TEXT,
  author_url TEXT,
  author_photo TEXT,
  title TEXT,
  content_preview TEXT,
  published_at TIMESTAMPTZ,
  site_name TEXT,
  site_icon TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  raw_mf2_json JSONB,
  fetch_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_reply_context_url ON reply_context_cache(target_url);
CREATE INDEX IF NOT EXISTS idx_reply_context_expires ON reply_context_cache(expires_at);

-- ============================================================================
-- Server-Side Search Index
-- PostgreSQL full-text search with weighted fields
-- ============================================================================
CREATE TABLE IF NOT EXISTS search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_text TEXT NOT NULL,
  tags TEXT[],
  published_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ,
  url TEXT NOT NULL,
  -- Generated full-text search vector with weights:
  -- A (highest): title
  -- B: description, tags
  -- C: content
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content_text, '')), 'C')
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_vector ON search_index USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_search_published ON search_index(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_type ON search_index(content_type);
CREATE INDEX IF NOT EXISTS idx_search_slug ON search_index(slug);

-- ============================================================================
-- Alterations to existing webmentions table
-- Add columns for update/delete tracking
-- ============================================================================
DO $$
BEGIN
  -- Add original_source_hash for detecting updates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webmentions' AND column_name = 'original_source_hash'
  ) THEN
    ALTER TABLE webmentions ADD COLUMN original_source_hash TEXT;
  END IF;

  -- Add is_deleted for soft deletes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webmentions' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE webmentions ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add deleted_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webmentions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE webmentions ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;

  -- Add updated_at for tracking when webmention content changed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webmentions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE webmentions ADD COLUMN updated_at TIMESTAMPTZ;
  END IF;
END $$;

-- Index for finding non-deleted webmentions
CREATE INDEX IF NOT EXISTS idx_webmentions_not_deleted
  ON webmentions(target_url)
  WHERE is_deleted = FALSE;

-- ============================================================================
-- Helper function: Update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to outgoing_webmentions
DROP TRIGGER IF EXISTS update_outgoing_wm_updated_at ON outgoing_webmentions;
CREATE TRIGGER update_outgoing_wm_updated_at
  BEFORE UPDATE ON outgoing_webmentions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
