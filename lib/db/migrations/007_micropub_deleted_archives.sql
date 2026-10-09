-- Private source archives commit before the public file is deleted.
-- Transaction advisory locks serialize mutations for one permalink.
CREATE TABLE IF NOT EXISTS micropub_deleted_writings (
  mutation_key TEXT PRIMARY KEY,
  permalink TEXT NOT NULL,
  slug TEXT NOT NULL,
  path TEXT NOT NULL,
  source TEXT NOT NULL,
  original_sha TEXT,
  state TEXT NOT NULL CHECK (state IN ('archived', 'deleted', 'restored')),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  restored_at TIMESTAMPTZ
);
