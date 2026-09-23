import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import {
  INDIEAUTH_AUTHORIZATION_ENDPOINT,
  INDIEAUTH_INTROSPECTION_ENDPOINT,
  INDIEAUTH_REVOCATION_ENDPOINT,
  INDIEAUTH_TOKEN_ENDPOINT,
  SITE_URL,
} from '@/lib/indieweb/constants';
import {
  parseClientId,
  parseRedirectUri,
} from '@/lib/indieweb/indieauth-client';
import type {
  IndieAuthAuthorizationRequest,
  IndieAuthCodeRecord,
  IndieAuthProfile,
  IndieAuthStore,
  IndieAuthTokenRecord,
} from '@/lib/indieweb/types';
import { absoluteSiteUrl } from '@/lib/indieweb/utils';
import { site } from '@/lib/site';

/**
 * The protocol half of the site's IndieAuth server
 * (indieauth.spec.indieweb.org): metadata, scopes, PKCE, and issuing,
 * redeeming, checking, and revoking codes and tokens. It knows nothing about
 * HTTP or Postgres; `indieauth-endpoints.ts` wires it to requests and
 * `indieauth-storage.ts` to the database.
 */

/** The issuer and the one profile URL this server signs in. */
export const INDIEAUTH_ISSUER = `${SITE_URL}/`;
export const INDIEAUTH_ME = `${SITE_URL}/`;

/**
 * Scopes a client may be granted. `profile` and `email` shape the sign-in
 * response; the rest are the Micropub scopes.
 */
export const INDIEAUTH_SCOPES = [
  'profile',
  'email',
  'create',
  'draft',
  'update',
  'delete',
  'undelete',
  'media',
] as const;

/** The spec recommends codes live at most ten minutes. */
export const AUTHORIZATION_CODE_LIFETIME_MS = 10 * 60 * 1000;
/** Access tokens last 90 days; there are no refresh tokens. */
export const ACCESS_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

const SUPPORTED_SCOPES = new Set<string>(INDIEAUTH_SCOPES);
// RFC 7636: 43 to 128 characters from the unreserved set.
const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;
// A base64url SHA-256 digest without padding is always 43 characters.
const S256_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function buildIndieAuthMetadata() {
  return {
    issuer: INDIEAUTH_ISSUER,
    authorization_endpoint: absoluteSiteUrl(
      INDIEAUTH_AUTHORIZATION_ENDPOINT,
      SITE_URL
    ),
    token_endpoint: absoluteSiteUrl(INDIEAUTH_TOKEN_ENDPOINT, SITE_URL),
    introspection_endpoint: absoluteSiteUrl(
      INDIEAUTH_INTROSPECTION_ENDPOINT,
      SITE_URL
    ),
    introspection_endpoint_auth_methods_supported: ['Bearer'],
    revocation_endpoint: absoluteSiteUrl(
      INDIEAUTH_REVOCATION_ENDPOINT,
      SITE_URL
    ),
    revocation_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...INDIEAUTH_SCOPES],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    service_documentation: 'https://indieauth.spec.indieweb.org/',
    code_challenge_methods_supported: ['S256'],
    authorization_response_iss_parameter_supported: true,
  };
}

/**
 * The supported scopes in a space-separated list, once each, in order.
 * Anything unsupported is dropped, and `email` only counts beside `profile`.
 */
export function parseScope(value: string | null | undefined): string[] {
  const scopes = [...new Set((value ?? '').split(/\s+/))].filter((scope) =>
    SUPPORTED_SCOPES.has(scope)
  );
  return scopes.includes('profile')
    ? scopes
    : scopes.filter((scope) => scope !== 'email');
}

/** A fresh 256-bit secret, base64url encoded, for a code or a token. */
export function newSecret(): string {
  return randomBytes(32).toString('base64url');
}

/** The digest a code or token is stored under. */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function isValidCodeVerifier(verifier: string): boolean {
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

export type AuthorizationRequestParse =
  | { ok: true; request: IndieAuthAuthorizationRequest }
  /** The client or redirect URI is unusable: tell the owner, never redirect. */
  | { ok: false; fatal: true; description: string }
  /**
   * Something else is wrong. Once the redirect URI checks out, the error
   * goes back to the client there.
   */
  | {
      ok: false;
      fatal: false;
      clientId: string;
      redirectUri: string;
      state?: string;
      error: string;
      description: string;
    };

/**
 * Check the parameters of an authorization request. PKCE with S256 is
 * required, as the spec requires of clients, and `state` is required.
 */
export function parseAuthorizationRequest(
  params: URLSearchParams
): AuthorizationRequestParse {
  const clientId = parseClientId(params.get('client_id'));
  if (!clientId) {
    return {
      ok: false,
      fatal: true,
      description: 'The client_id is missing or is not a valid client URL.',
    };
  }
  const redirectUri = parseRedirectUri(params.get('redirect_uri'));
  if (!redirectUri) {
    return {
      ok: false,
      fatal: true,
      description: 'The redirect_uri is missing or is not a valid URL.',
    };
  }

  const state = params.get('state') ?? undefined;
  const fail = (error: string, description: string) =>
    ({
      ok: false,
      fatal: false,
      clientId: clientId.href,
      redirectUri: redirectUri.href,
      state,
      error,
      description,
    }) as const;

  if (params.get('response_type') !== 'code') {
    return fail('unsupported_response_type', 'response_type must be "code".');
  }
  if (!state) return fail('invalid_request', 'state is required.');

  const codeChallenge = params.get('code_challenge') ?? '';
  if (params.get('code_challenge_method') !== 'S256') {
    return fail('invalid_request', 'code_challenge_method must be "S256".');
  }
  if (!S256_CHALLENGE_PATTERN.test(codeChallenge)) {
    return fail('invalid_request', 'code_challenge must be an S256 digest.');
  }

  return {
    ok: true,
    request: {
      clientId: clientId.href,
      redirectUri: redirectUri.href,
      state,
      codeChallenge,
      scope: parseScope(params.get('scope')),
    },
  };
}

/** `redirectUri` with the given parameters added to its query. */
export function authorizationRedirect(
  redirectUri: string,
  params: Record<string, string | undefined>
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.href;
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
  return { ok: true, record };
}

/** The `profile` object for a grant that includes the `profile` scope. */
export function buildProfile(scope: string[]): IndieAuthProfile | undefined {
  if (!scope.includes('profile')) return undefined;
  return {
    name: site.author.name,
    url: INDIEAUTH_ME,
    photo: absoluteSiteUrl(site.author.photo, SITE_URL),
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
  await store.saveToken(hashSecret(token), {
    clientId: record.clientId,
    me: record.me,
    scope: record.scope,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + ACCESS_TOKEN_LIFETIME_MS),
  });
  const profile = buildProfile(record.scope);
  return {
    access_token: token,
    token_type: 'Bearer',
    scope: record.scope.join(' '),
    me: record.me,
    expires_in: Math.floor(ACCESS_TOKEN_LIFETIME_MS / 1000),
    ...(profile ? { profile } : {}),
  };
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

/** Revoke a token. Unknown and already revoked tokens are not an error. */
export async function revokeAccessToken(
  store: IndieAuthStore,
  token: string,
  now: Date
): Promise<void> {
  if (token) await store.revokeToken(hashSecret(token), now);
}

/** The introspection response (RFC 7662) for a token's stored grant. */
export function introspectionResponse(record: IndieAuthTokenRecord | null) {
  if (!record) return { active: false };
  return {
    active: true,
    me: record.me,
    client_id: record.clientId,
    scope: record.scope.join(' '),
    iat: Math.floor(record.issuedAt.getTime() / 1000),
    exp: Math.floor(record.expiresAt.getTime() / 1000),
  };
}
