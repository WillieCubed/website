-- Bind refresh grants to spent authorization codes without changing legacy tokens.
BEGIN;

ALTER TABLE indieauth_codes ADD COLUMN IF NOT EXISTS replayed_at TIMESTAMPTZ;
ALTER TABLE indieauth_refresh_families ADD COLUMN IF NOT EXISTS authorization_code_hash TEXT
  REFERENCES indieauth_codes(code_hash) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_indieauth_grant_code
  ON indieauth_refresh_families(authorization_code_hash);

CREATE OR REPLACE FUNCTION indieauth_consume_code(p_hash TEXT, p_now TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_code indieauth_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_code FROM indieauth_codes WHERE code_hash = p_hash FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_code.used_at IS NOT NULL THEN
    UPDATE indieauth_codes SET replayed_at = COALESCE(replayed_at, p_now)
      WHERE code_hash = p_hash;
    UPDATE indieauth_refresh_families SET revoked_at = COALESCE(revoked_at, p_now)
      WHERE authorization_code_hash = p_hash;
    UPDATE indieauth_tokens SET revoked_at = COALESCE(revoked_at, p_now)
      WHERE refresh_family_id IN (
        SELECT family_id FROM indieauth_refresh_families WHERE authorization_code_hash = p_hash
      );
    RETURN NULL;
  END IF;
  IF v_code.expires_at <= p_now THEN RETURN NULL; END IF;
  UPDATE indieauth_codes SET used_at = p_now WHERE code_hash = p_hash;
  RETURN to_jsonb(v_code);
END;
$$;

-- Both operations lock the code first. A replay before issuance therefore
-- prevents issuance, and a replay after issuance revokes the entire family.
CREATE OR REPLACE FUNCTION indieauth_save_token_grant(
  p_code_hash TEXT, p_access_hash TEXT, p_family TEXT, p_refresh_hash TEXT,
  p_client TEXT, p_me TEXT, p_scope TEXT, p_now TIMESTAMPTZ,
  p_access_expiry TIMESTAMPTZ, p_refresh_expiry TIMESTAMPTZ
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_code indieauth_codes%ROWTYPE;
BEGIN
  IF p_code_hash IS NOT NULL THEN
    SELECT * INTO v_code FROM indieauth_codes WHERE code_hash = p_code_hash FOR UPDATE;
    IF NOT FOUND OR v_code.used_at IS NULL OR v_code.replayed_at IS NOT NULL
      OR v_code.client_id <> p_client OR v_code.me <> p_me OR v_code.scope <> p_scope
      OR EXISTS (SELECT 1 FROM indieauth_refresh_families WHERE authorization_code_hash = p_code_hash)
    THEN RETURN FALSE; END IF;
  END IF;
  INSERT INTO indieauth_refresh_families
    (family_id, client_id, me, scope, issued_at, authorization_code_hash)
    VALUES (p_family, p_client, p_me, p_scope, p_now, p_code_hash);
  INSERT INTO indieauth_refresh_tokens (token_hash, family_id, issued_at, expires_at)
    VALUES (p_refresh_hash, p_family, p_now, p_refresh_expiry);
  INSERT INTO indieauth_tokens
    (token_hash, client_id, me, scope, issued_at, expires_at, refresh_family_id)
    VALUES (p_access_hash, p_client, p_me, p_scope, p_now, p_access_expiry, p_family);
  RETURN TRUE;
END;
$$;

COMMIT;
