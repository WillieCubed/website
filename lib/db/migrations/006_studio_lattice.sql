CREATE TABLE IF NOT EXISTS studio_connections (
  id TEXT PRIMARY KEY,
  credential TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
