CREATE TABLE IF NOT EXISTS music_revisions (
 id uuid PRIMARY KEY, body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), conflict boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS music_catalog_head (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), revision_id uuid REFERENCES music_revisions(id));
INSERT INTO music_catalog_head(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION music_revision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Music revisions are immutable'; END $$;
DROP TRIGGER IF EXISTS music_revision_immutable ON music_revisions;
CREATE TRIGGER music_revision_immutable BEFORE UPDATE OR DELETE ON music_revisions FOR EACH ROW EXECUTE FUNCTION music_revision_immutable();
CREATE TABLE IF NOT EXISTS music_connections (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), owner_id text NOT NULL, encrypted_grant text NOT NULL, reconnect boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS music_oauth_states (state_hash text PRIMARY KEY, owner_email text NOT NULL, verifier text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS music_provider_cache (id text PRIMARY KEY, body jsonb NOT NULL, checked_at timestamptz NOT NULL, eligible boolean NOT NULL);
CREATE TABLE IF NOT EXISTS music_import_state (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), body jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS music_publications (id uuid PRIMARY KEY, revision_id uuid NOT NULL UNIQUE REFERENCES music_revisions(id), body jsonb NOT NULL);
