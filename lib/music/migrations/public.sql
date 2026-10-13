CREATE TABLE IF NOT EXISTS music_approved_cache (id text PRIMARY KEY, body jsonb NOT NULL, checked_at timestamptz NOT NULL, eligible boolean NOT NULL);
