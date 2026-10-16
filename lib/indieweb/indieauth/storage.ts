import { sql } from '@/lib/db/postgres';
import { fetchIndieAuthClient } from '@/lib/indieweb/indieauth/client';
import type {
  IndieAuthCodeRecord,
  IndieAuthEndpointOptions,
  IndieAuthStore,
  IndieAuthTokenRecord,
} from '@/lib/indieweb/indieauth/types';
import { ownerAccessAuthenticatorFromEnvironment } from '@/lib/owner/access';

/**
 * Postgres storage for the IndieAuth server. The tables are created by
 * migrations 003, 006 and 009. Codes and tokens are stored as
 * SHA-256 digests, so a copy of the database holds nothing a client could
 * present.
 */

function scopeList(value: string): string[] {
  return value.split(' ').filter(Boolean);
}

export const indieAuthStore: IndieAuthStore = {
  async saveCode(codeHash, record) {
    // Spent digests remain associated with grants so replay revocation survives refresh.
    await sql`DELETE FROM indieauth_codes WHERE expires_at < NOW() AND used_at IS NULL`;
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
    const result = await sql`SELECT indieauth_consume_code(
      ${codeHash}, ${now.toISOString()}) AS record`;
    const row = result.rows[0].record;
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
    const result = await sql`SELECT indieauth_save_token_grant(
      ${grant.authorizationCodeHash ?? null}, ${tokenHash},
      ${grant.refreshFamilyId}, ${grant.refreshTokenHash},
      ${grant.clientId}, ${grant.me}, ${grant.scope.join(' ')},
      ${grant.issuedAt.toISOString()}, ${grant.expiresAt.toISOString()},
      ${grant.refreshExpiresAt.toISOString()}) AS saved`;
    return result.rows[0].saved === true;
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
    if (row == null) return null;
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

/** Production storage, owner authentication, and client fetching. */
export function indieAuthEndpointOptions(): IndieAuthEndpointOptions {
  return {
    store: indieAuthStore,
    owner: ownerAccessAuthenticatorFromEnvironment(process.env),
    fetchClient: fetchIndieAuthClient,
    introspectionSecret: process.env.INDIEAUTH_INTROSPECTION_SECRET,
  };
}
