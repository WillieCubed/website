import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { SITE_URL } from '@/lib/indieweb/constants';
import { site } from '@/lib/site/identity';
import { absoluteUrl } from '@/lib/site/urls';

import { parseClientId, parseRedirectUri } from './client';
import type {
  IndieAuthAuthorizationRequest,
  IndieAuthCodeRecord,
  IndieAuthProfile,
  IndieAuthStore,
  IndieAuthTokenRecord,
} from './types';

export const INDIEAUTH_ME = `${SITE_URL}/`;
export const AUTHORIZATION_CODE_LIFETIME_MS = 10 * 60 * 1000;
export const ACCESS_TOKEN_LIFETIME_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

/** A fresh 256-bit secret, base64url encoded, for a code or a token. */
function newSecret(): string {
  return randomBytes(32).toString('base64url');
}

/** The digest a code or token is stored under. */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function isValidCodeVerifier(verifier: string): boolean {
  return CODE_VERIFIER_PATTERN.test(verifier);
}

/** The S256 code challenge for a verifier (RFC 7636 section 4.2). */
export function codeChallengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** Whether a verifier matches the challenge the code was issued for. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!isValidCodeVerifier(verifier)) return false;
  const expected = Buffer.from(challenge);
  const actual = Buffer.from(codeChallengeFor(verifier));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Compare an `Authorization` header against a bearer secret. The digests keep
 * the comparison constant-time whatever the header's length.
 */
export function bearerMatches(
  authorization: string | null,
  secret: string
): boolean {
  if (!authorization) return false;
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest();
  const actual = createHash('sha256').update(authorization).digest();
  return timingSafeEqual(expected, actual);
}

/**
 * Store a code for an approved request and return it. Only its digest is
 * kept, so the code itself exists only in the redirect.
 */
export async function issueAuthorizationCode(
  store: IndieAuthStore,
  request: IndieAuthAuthorizationRequest,
  scope: string[],
  now: Date
): Promise<string> {
  const code = newSecret();
  await store.saveCode(hashSecret(code), {
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    me: INDIEAUTH_ME,
    scope,
    codeChallenge: request.codeChallenge,
    expiresAt: new Date(now.getTime() + AUTHORIZATION_CODE_LIFETIME_MS),
  });
  return code;
}

export type CodeRedemption =
  | { ok: true; record: IndieAuthCodeRecord }
  | { ok: false; error: string; description: string };

/**
 * Redeem a code from a form-encoded redemption request, at either the
 * authorization or the token endpoint. The code is spent as soon as it is
 * looked up, so a request with the wrong verifier burns it too.
 */
export async function redeemAuthorizationCode(
  store: IndieAuthStore,
  form: URLSearchParams,
  now: Date
): Promise<CodeRedemption> {
  const grantType = form.get('grant_type');
  if (grantType !== null && grantType !== 'authorization_code') {
    return {
      ok: false,
      error: 'unsupported_grant_type',
      description: 'Only the authorization_code grant is supported.',
    };
  }
  const code = form.get('code');
  const clientId = form.get('client_id');
  const redirectUri = form.get('redirect_uri');
  const verifier = form.get('code_verifier');
  if (!code || !clientId || !redirectUri || !verifier) {
    return {
      ok: false,
      error: 'invalid_request',
      description:
        'code, client_id, redirect_uri, and code_verifier are all required.',
    };
  }

  const record = await store.consumeCode(hashSecret(code), now);
  if (!record) {
    return {
      ok: false,
      error: 'invalid_grant',
      description: 'The code is unknown, expired, or already used.',
    };
  }
  const mismatch = codeBindingError(record, clientId, redirectUri, verifier);
  if (mismatch) return mismatch;
  return {
    ok: true,
    record: { ...record, authorizationCodeHash: hashSecret(code) },
  };
}

/** The `profile` object for a grant that includes the `profile` scope. */
export function buildProfile(scope: string[]): IndieAuthProfile | undefined {
  if (!scope.includes('profile')) return undefined;
  return {
    name: site.author.name,
    url: INDIEAUTH_ME,
    photo: absoluteUrl(site.author.photo),
    ...(scope.includes('email') ? { email: site.author.email } : {}),
  };
}

/** The authorization endpoint's answer to a redemption: who signed in. */
export function profileResponse(record: IndieAuthCodeRecord) {
  const profile = buildProfile(record.scope);
  return { me: record.me, ...(profile ? { profile } : {}) };
}

/**
 * Mint an access token for a redeemed code and return the token endpoint's
 * response. The caller refuses codes issued without a scope first.
 */
export async function issueAccessToken(
  store: IndieAuthStore,
  record: IndieAuthCodeRecord,
  now: Date
) {
  const token = newSecret();
  const refreshToken = newSecret();
  const grant = {
    authorizationCodeHash: record.authorizationCodeHash,
    clientId: record.clientId,
    me: record.me,
    scope: record.scope,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + ACCESS_TOKEN_LIFETIME_MS),
    refreshFamilyId: newSecret(),
    refreshTokenHash: hashSecret(refreshToken),
    refreshExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_LIFETIME_MS),
  };
  if ((await store.saveTokenGrant(hashSecret(token), grant)) === false)
    return null;
  return tokenResponse(token, refreshToken, grant);
}

function tokenResponse(
  accessToken: string,
  refreshToken: string,
  record: IndieAuthTokenRecord
) {
  const profile = buildProfile(record.scope);
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    scope: record.scope.join(' '),
    me: record.me,
    expires_in: Math.floor(ACCESS_TOKEN_LIFETIME_MS / 1000),
    ...(profile ? { profile } : {}),
  };
}

/** Validate the request before the store atomically spends and replaces it. */
export async function refreshAccessToken(
  store: IndieAuthStore,
  form: URLSearchParams,
  now: Date
) {
  const refreshToken = form.get('refresh_token');
  const rawClientId = form.get('client_id');
  if (!refreshToken || !rawClientId) {
    return {
      ok: false,
      error: 'invalid_request',
      description: 'refresh_token and client_id are required.',
    } as const;
  }
  const clientId = parseClientId(rawClientId)?.href;
  if (!clientId) {
    return {
      ok: false,
      error: 'invalid_grant',
      description: 'The refresh token is not valid for this client.',
    } as const;
  }
  // Keep unsupported scopes for the store's subset check; parseScope would
  // silently discard them and accept a request for extra privileges.
  const scope = form.has('scope')
    ? [...new Set((form.get('scope') ?? '').split(/\s+/).filter(Boolean))]
    : null;
  const nextRefreshToken = newSecret();
  const accessToken = newSecret();
  const result = await store.rotateRefreshToken({
    refreshTokenHash: hashSecret(refreshToken),
    clientId,
    scope,
    nextRefreshTokenHash: hashSecret(nextRefreshToken),
    accessTokenHash: hashSecret(accessToken),
    now,
    accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_LIFETIME_MS),
    refreshExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_LIFETIME_MS),
  });
  if (!result.ok) {
    return {
      ...result,
      description:
        result.error === 'invalid_scope'
          ? 'The requested scope must be a non-empty subset of the approved scopes.'
          : 'The refresh token is unknown, expired, revoked, or already used.',
    };
  }
  return {
    ok: true,
    token: tokenResponse(accessToken, nextRefreshToken, result.record),
  } as const;
}

/** The stored grant behind a token, or null when it is not active. */
export function findActiveToken(
  store: IndieAuthStore,
  token: string,
  now: Date
): Promise<IndieAuthTokenRecord | null> {
  if (!token) return Promise.resolve(null);
  return store.findToken(hashSecret(token), now);
}

/** Revoke an access token or refresh family; unknown tokens also succeed. */
export async function revokeAccessToken(
  store: IndieAuthStore,
  token: string,
  now: Date
): Promise<void> {
  if (token) await store.revokeToken(hashSecret(token), now);
}

function codeBindingError(
  record: IndieAuthCodeRecord,
  clientId: string,
  redirectUri: string,
  verifier: string
): CodeRedemption | null {
  // The record holds the URLs as parsed at authorization, so the form's are
  // parsed the same way: `https://app.example` was stored as
  // `https://app.example/`.
  if (
    parseClientId(clientId)?.href !== record.clientId ||
    parseRedirectUri(redirectUri)?.href !== record.redirectUri
  ) {
    return {
      ok: false,
      error: 'invalid_grant',
      description: 'The code was issued to a different client or redirect.',
    };
  }
  if (!verifyPkce(verifier, record.codeChallenge)) {
    return {
      ok: false,
      error: 'invalid_grant',
      description: 'The code_verifier does not match the code_challenge.',
    };
  }
  return null;
}
