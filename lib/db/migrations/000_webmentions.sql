CREATE TABLE IF NOT EXISTS webmentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  type TEXT,
  author_name TEXT,
  author_url TEXT,
  author_photo TEXT,
  content TEXT,
  published_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  is_verified BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  raw_mf2_json JSONB,
  UNIQUE(source_url, target_url)
);

CREATE INDEX IF NOT EXISTS idx_webmentions_target
  ON webmentions(target_url);
CREATE INDEX IF NOT EXISTS idx_webmentions_verified
  ON webmentions(is_verified, is_approved);
