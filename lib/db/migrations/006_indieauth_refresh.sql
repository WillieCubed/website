-- Refresh grants retain the original scopes. Access tokens may narrow them.
-- Existing access token rows retain their recorded expiry and no family.
BEGIN;

CREATE TABLE IF NOT EXISTS indieauth_refresh_families (
  family_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  me TEXT NOT NULL,
  scope TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS indieauth_refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES indieauth_refresh_families(family_id),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_indieauth_refresh_tokens_family
  ON indieauth_refresh_tokens(family_id);

ALTER TABLE indieauth_tokens ADD COLUMN IF NOT EXISTS refresh_family_id TEXT
  REFERENCES indieauth_refresh_families(family_id);

CREATE INDEX IF NOT EXISTS idx_indieauth_tokens_refresh_family
  ON indieauth_tokens(refresh_family_id);

-- Retain spent refresh digests so presenting an old credential revokes its
-- family. Lock the family before reading used_at: concurrent rotations then
-- see the first committed spend instead of issuing two replacement tokens.
CREATE OR REPLACE FUNCTION indieauth_rotate_refresh(
  p_refresh_hash TEXT,
  p_client_id TEXT,
  p_scope TEXT,
  p_next_refresh_hash TEXT,
  p_access_hash TEXT,
  p_now TIMESTAMPTZ,
  p_access_expires_at TIMESTAMPTZ,
  p_refresh_expires_at TIMESTAMPTZ
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_family indieauth_refresh_families%ROWTYPE;
  v_refresh indieauth_refresh_tokens%ROWTYPE;
  v_scope TEXT;
  v_scopes TEXT[];
BEGIN
  SELECT family.* INTO v_family
  FROM indieauth_refresh_families family
  JOIN indieauth_refresh_tokens refresh ON refresh.family_id = family.family_id
  WHERE refresh.token_hash = p_refresh_hash
  FOR UPDATE OF family;

  IF NOT FOUND OR v_family.revoked_at IS NOT NULL
    OR v_family.client_id <> p_client_id THEN
    RETURN jsonb_build_object('error', 'invalid_grant');
  END IF;

  SELECT refresh.* INTO v_refresh FROM indieauth_refresh_tokens refresh
  WHERE refresh.token_hash = p_refresh_hash;

  IF v_refresh.used_at IS NOT NULL THEN
    UPDATE indieauth_refresh_families SET revoked_at = p_now
    WHERE family_id = v_family.family_id;
    RETURN jsonb_build_object('error', 'invalid_grant');
  END IF;
  IF v_refresh.expires_at <= p_now THEN
    RETURN jsonb_build_object('error', 'invalid_grant');
  END IF;

  v_scope := COALESCE(p_scope, v_family.scope);
  v_scopes := string_to_array(v_scope, ' ');
  IF v_scope = '' OR NOT (v_scopes <@ string_to_array(v_family.scope, ' '))
    OR ('email' = ANY(v_scopes) AND NOT ('profile' = ANY(v_scopes))) THEN
    RETURN jsonb_build_object('error', 'invalid_scope');
  END IF;

  UPDATE indieauth_refresh_tokens SET used_at = p_now
  WHERE token_hash = p_refresh_hash;
  INSERT INTO indieauth_refresh_tokens (
    token_hash, family_id, issued_at, expires_at
  ) VALUES (
    p_next_refresh_hash, v_family.family_id, p_now, p_refresh_expires_at
  );
  INSERT INTO indieauth_tokens (
    token_hash, client_id, me, scope, issued_at, expires_at, refresh_family_id
  ) VALUES (
    p_access_hash, v_family.client_id, v_family.me, v_scope, p_now,
    p_access_expires_at, v_family.family_id
  );

  RETURN jsonb_build_object(
    'client_id', v_family.client_id, 'me', v_family.me,
    'scope', v_scope, 'family_id', v_family.family_id
  );
END;
$$;

COMMIT;
