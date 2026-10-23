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
} from '@/lib/indieweb/indieauth/client';
import type {
  IndieAuthAuthorizationRequest,
  IndieAuthTokenRecord,
} from '@/lib/indieweb/indieauth/types';
import { absoluteUrl } from '@/lib/site/urls';

/**
 * Authorization request parsing and discovery metadata for the IndieAuth server.
 * Grant lifecycle operations keep their store contract separate from HTTP
 * request orchestration and the database adapter.
 */

/** The issuer reported in discovery metadata and authorization responses. */
export const INDIEAUTH_ISSUER = `${SITE_URL}/`;

/**
 * Scopes a client may be granted. `profile` and `email` shape the sign-in
 * response; the rest are the Micropub scopes.
 */
const INDIEAUTH_SCOPES = [
  'profile',
  'email',
  'create',
  'draft',
  'update',
  'delete',
  'undelete',
  'media',
] as const;

const SUPPORTED_SCOPES = new Set<string>(INDIEAUTH_SCOPES);
// A base64url SHA-256 digest without padding is always 43 characters.
const S256_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function buildIndieAuthMetadata() {
  return {
    issuer: INDIEAUTH_ISSUER,
    authorization_endpoint: absoluteUrl(INDIEAUTH_AUTHORIZATION_ENDPOINT),
    token_endpoint: absoluteUrl(INDIEAUTH_TOKEN_ENDPOINT),
    introspection_endpoint: absoluteUrl(INDIEAUTH_INTROSPECTION_ENDPOINT),
    introspection_endpoint_auth_methods_supported: ['Bearer'],
    revocation_endpoint: absoluteUrl(INDIEAUTH_REVOCATION_ENDPOINT),
    revocation_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...INDIEAUTH_SCOPES],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    userinfo_endpoint: absoluteUrl('/indieauth/userinfo'),
    token_endpoint_auth_methods_supported: ['none'],
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

export function hasRepeatedOAuthParameters(params: URLSearchParams): boolean {
  return [...new Set(params.keys())].some(
    (key) => params.getAll(key).length > 1
  );
}

/**
 * Check the parameters of an authorization request. PKCE with S256 is
 * required, as the spec requires of clients, and `state` is required.
 */
export function parseAuthorizationRequest(
  params: URLSearchParams
): AuthorizationRequestParse {
  if (hasRepeatedOAuthParameters(params)) {
    return {
      ok: false,
      fatal: true,
      description: 'Authorization parameters must not appear more than once.',
    };
  }
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
