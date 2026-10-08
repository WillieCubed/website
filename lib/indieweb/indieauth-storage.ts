import { sql } from '@vercel/postgres';

import { fetchIndieAuthClient } from '@/lib/indieweb/indieauth-client';
import { ownerAuthenticatorFromEnvironment } from '@/lib/indieweb/indieauth-owner';
import type {
  IndieAuthCodeRecord,
  IndieAuthEndpointOptions,
  IndieAuthStore,
  IndieAuthTokenRecord,
  OwnerSignInStore,
} from '@/lib/indieweb/types';

/**
 * Postgres storage for the IndieAuth server. The tables are created by
 * migrations 003 and 006. Codes and tokens are stored as
 * SHA-256 digests, so a copy of the database holds nothing a client could
 * present.
 */

function scopeList(value: string): string[] {
  return value.split(' ').filter(Boolean);
}

export const indieAuthStore: IndieAuthStore = {
  async saveCode(codeHash, record) {
    // Spent and expired codes are useless, so each new code clears them.
    await sql`DELETE FROM indieauth_codes WHERE expires_at < NOW()`;
    await sql`
      INSERT INTO indieauth_codes (
        code_hash, client_id, redirect_uri, me, scope, code_challenge,
        expires_at
      )
      VALUES (
        ${codeHash}, ${record.clientId}, ${record.redirectUri}, ${record.me},
        ${record.scope.join(' ')}, ${record.codeChallenge},
        ${record.expiresAt.toISOString()}
      )
    `;
  },
  async consumeCode(codeHash, now) {
    const result = await sql`
      UPDATE indieauth_codes SET used_at = ${now.toISOString()}
      WHERE code_hash = ${codeHash}
        AND used_at IS NULL
        AND expires_at > ${now.toISOString()}
      RETURNING client_id, redirect_uri, me, scope, code_challenge, expires_at
    `;
    const row = result.rows[0];
    if (!row) return null;
    return {
      clientId: row.client_id,
      redirectUri: row.redirect_uri,
      me: row.me,
      scope: scopeList(row.scope),
      codeChallenge: row.code_challenge,
      expiresAt: new Date(row.expires_at),
    } satisfies IndieAuthCodeRecord;
  },
  async saveToken(tokenHash, record) {
    await sql`
      INSERT INTO indieauth_tokens (
        token_hash, client_id, me, scope, issued_at, expires_at, refresh_family_id
      )
      VALUES (
        ${tokenHash}, ${record.clientId}, ${record.me},
        ${record.scope.join(' ')}, ${record.issuedAt.toISOString()},
        ${record.expiresAt.toISOString()}, ${record.refreshFamilyId ?? null}
      )
    `;
  },
  async saveTokenGrant(tokenHash, grant) {
    await sql`
      WITH family AS (
        INSERT INTO indieauth_refresh_families (
          family_id, client_id, me, scope, issued_at
        ) VALUES (
          ${grant.refreshFamilyId}, ${grant.clientId}, ${grant.me},
          ${grant.scope.join(' ')}, ${grant.issuedAt.toISOString()}
        ) RETURNING family_id
      ), refresh AS (
        INSERT INTO indieauth_refresh_tokens (
          token_hash, family_id, issued_at, expires_at
        ) SELECT ${grant.refreshTokenHash}, family_id,
          ${grant.issuedAt.toISOString()}, ${grant.refreshExpiresAt.toISOString()}
        FROM family
        RETURNING family_id
      )
      INSERT INTO indieauth_tokens (
        token_hash, client_id, me, scope, issued_at, expires_at, refresh_family_id
      ) SELECT ${tokenHash}, ${grant.clientId}, ${grant.me},
        ${grant.scope.join(' ')}, ${grant.issuedAt.toISOString()},
        ${grant.expiresAt.toISOString()}, family_id
      FROM refresh
    `;
  },
  async rotateRefreshToken(rotation) {
    const result = await sql`
      SELECT indieauth_rotate_refresh(
        ${rotation.refreshTokenHash}, ${rotation.clientId},
        ${rotation.scope?.join(' ') ?? null}, ${rotation.nextRefreshTokenHash},
        ${rotation.accessTokenHash}, ${rotation.now.toISOString()},
        ${rotation.accessExpiresAt.toISOString()},
        ${rotation.refreshExpiresAt.toISOString()}
      ) AS result
    `;
    const row = result.rows[0].result;
    if (row.error) return { ok: false, error: row.error };
    return {
      ok: true,
      record: {
        clientId: row.client_id,
        me: row.me,
        scope: scopeList(row.scope),
        issuedAt: rotation.now,
        expiresAt: rotation.accessExpiresAt,
        refreshFamilyId: row.family_id,
      },
    };
  },
  async findToken(tokenHash, now) {
    const result = await sql`
      SELECT client_id, me, scope, issued_at, expires_at, refresh_family_id
      FROM indieauth_tokens
      WHERE token_hash = ${tokenHash}
        AND revoked_at IS NULL
        AND expires_at > ${now.toISOString()}
        AND (
          refresh_family_id IS NULL OR EXISTS (
            SELECT 1 FROM indieauth_refresh_families
            WHERE family_id = indieauth_tokens.refresh_family_id
              AND revoked_at IS NULL
          )
        )
    `;
    const row = result.rows[0];
    if (!row) return null;
    return {
      clientId: row.client_id,
      me: row.me,
      scope: scopeList(row.scope),
      issuedAt: new Date(row.issued_at),
      expiresAt: new Date(row.expires_at),
      ...(row.refresh_family_id
        ? { refreshFamilyId: row.refresh_family_id }
        : {}),
    } satisfies IndieAuthTokenRecord;
  },
  async revokeToken(tokenHash, now) {
    await sql`
      WITH family_revocation AS (
        UPDATE indieauth_refresh_families SET revoked_at = ${now.toISOString()}
        WHERE family_id = (
          SELECT family_id FROM indieauth_refresh_tokens WHERE token_hash = ${tokenHash}
        ) AND revoked_at IS NULL
      )
      UPDATE indieauth_tokens SET revoked_at = ${now.toISOString()}
      WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
    `;
  },
};

export const ownerSignInStore: OwnerSignInStore = {
  async recordAttempt(windowMs, now) {
    const since = new Date(now.getTime() - windowMs).toISOString();
    await sql`DELETE FROM indieauth_sign_in_failures WHERE failed_at <= ${since}`;
    // The insert commits before the count runs, so parallel requests each
    // see their own row and every row recorded before it.
    const inserted = await sql`
      INSERT INTO indieauth_sign_in_failures (failed_at)
      VALUES (${now.toISOString()})
      RETURNING id
    `;
    const result = await sql`
      SELECT COUNT(*) AS attempts FROM indieauth_sign_in_failures
      WHERE failed_at > ${since}
    `;
    return {
      id: String(inserted.rows[0].id),
      attempts: Number(result.rows[0].attempts),
    };
  },
  async forgetAttempt(id) {
    await sql`DELETE FROM indieauth_sign_in_failures WHERE id = ${id}`;
  },
  async claimTotpStep(step, now) {
    // A step claims only when it is later than every step used before, and
    // the primary key settles two requests racing with the same code.
    const result = await sql`
      INSERT INTO indieauth_totp_steps (step, used_at)
      SELECT ${step}, ${now.toISOString()}
      WHERE NOT EXISTS (
        SELECT 1 FROM indieauth_totp_steps WHERE step >= ${step}
      )
      ON CONFLICT (step) DO NOTHING
      RETURNING step
    `;
    if (result.rows.length === 0) return false;
    // Only the latest step matters to the check above.
    await sql`DELETE FROM indieauth_totp_steps WHERE step < ${step}`;
    return true;
  },
};

/** The options the `app/indieauth` routes run with. */
export function indieAuthEndpointOptions(): IndieAuthEndpointOptions {
  return {
    store: indieAuthStore,
    owner: ownerAuthenticatorFromEnvironment(process.env, ownerSignInStore),
    fetchClient: fetchIndieAuthClient,
    introspectionSecret: process.env.INDIEAUTH_INTROSPECTION_SECRET,
  };
}
