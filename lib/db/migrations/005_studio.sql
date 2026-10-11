-- Apply only to the dedicated private studio database, never the public DB.
CREATE TABLE IF NOT EXISTS studio_documents (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  head_id uuid,
  live_revision_id uuid,
  deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS studio_revisions (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES studio_documents(id),
  number integer NOT NULL,
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, number)
);
CREATE TABLE IF NOT EXISTS studio_publications (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES studio_documents(id),
  revision_id uuid NOT NULL REFERENCES studio_revisions(id),
  body jsonb NOT NULL,
  UNIQUE(document_id, revision_id)
);
CREATE TABLE IF NOT EXISTS studio_generations (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES studio_documents(id),
  revision_id uuid NOT NULL REFERENCES studio_revisions(id),
  body jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS studio_components (
  id uuid PRIMARY KEY,
  body jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS studio_assets (
  id uuid PRIMARY KEY,
  pathname text NOT NULL,
  content_type text NOT NULL,
  original_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS studio_asset_promotions (
  publication_id text NOT NULL,
  asset_id uuid NOT NULL REFERENCES studio_assets(id),
  public_url text NOT NULL,
  PRIMARY KEY(publication_id, asset_id)
);

-- History is retained even if a document is deleted or an application regresses.
CREATE OR REPLACE FUNCTION studio_reject_revision_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'Studio revisions are immutable';
END $$;
DROP TRIGGER IF EXISTS studio_revisions_immutable ON studio_revisions;
CREATE TRIGGER studio_revisions_immutable BEFORE UPDATE OR DELETE ON studio_revisions
FOR EACH ROW EXECUTE FUNCTION studio_reject_revision_mutation();
