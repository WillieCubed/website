import { INDIEAUTH_CONSENT_ENDPOINT } from '@/lib/indieweb/constants';
import { getBearerToken } from '@/lib/indieweb/indieauth';
import { isRedirectUriAllowed } from '@/lib/indieweb/indieauth-client';
import {
  htmlResponse,
  renderConsentPage,
  renderSignInMessage,
} from '@/lib/indieweb/indieauth-consent';
import {
  INDIEAUTH_ISSUER,
  INDIEAUTH_ME,
  authorizationRedirect,
  bearerMatches,
  findActiveToken,
  introspectionResponse,
  issueAccessToken,
  issueAuthorizationCode,
  parseAuthorizationRequest,
  parseScope,
  profileResponse,
  redeemAuthorizationCode,
  revokeAccessToken,
} from '@/lib/indieweb/indieauth-server';
import { jsonError, jsonResponse } from '@/lib/indieweb/responses';
import type {
  IndieAuthAuthorizationRequest,
  IndieAuthClientInfo,
  IndieAuthEndpointOptions,
} from '@/lib/indieweb/types';

/**
 * The HTTP half of the IndieAuth server. Each handler takes its store, owner
 * check, and client fetcher as options, so the routes under `app/indieauth`
 * pass the Postgres-backed ones and the tests pass in-memory ones.
 *
 * The owner only ever acts at `/indieauth/consent`. The authorization
 * endpoint forwards browsers there, and every other endpoint is called by
 * clients and Micropub servers, so the consent path alone can move behind
 * Cloudflare Access without blocking those calls.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

// Token responses must not be cached (RFC 6749 section 5.1).
const TOKEN_HEADERS = {
  ...CORS_HEADERS,
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
};

function clock(options: IndieAuthEndpointOptions): Date {
  return options.now?.() ?? new Date();
}

function oauthError(
  error: string,
  status: number,
  description?: string
): Response {
  const response = jsonError(error, status, description);
  for (const [key, value] of Object.entries(TOKEN_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

/** The answer to a CORS preflight on the client-facing endpoints. */
export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Form fields, or null when the body is not a form. */
async function readForm(request: Request): Promise<URLSearchParams | null> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.includes('application/x-www-form-urlencoded')) return null;
  return new URLSearchParams(await request.text());
}

/**
 * A consent POST must come from the consent page itself. Browsers mark
 * cross-site form posts, so a page elsewhere cannot submit one on the owner's
 * behalf once the owner check rides on a session, as Cloudflare Access's
 * does. Every browser that submits the form sends one of the two headers, so
 * a post with neither is refused rather than trusted.
 */
export function isSameOriginPost(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = request.headers.get('origin');
  if (origin) return origin === new URL(request.url).origin;
  return false;
}

type CheckedRequest =
  | {
      kind: 'ok';
      request: IndieAuthAuthorizationRequest;
      client: IndieAuthClientInfo;
    }
  | { kind: 'redirect'; location: string }
  | { kind: 'page'; response: Response };

/**
 * Parse an authorization request and confirm its redirect URI belongs to the
 * client. Errors about the client or redirect URI are shown to the owner;
 * any other error is sent back to the client at its redirect URI.
 */
async function checkAuthorizationRequest(
  params: URLSearchParams,
  options: IndieAuthEndpointOptions
): Promise<CheckedRequest> {
  const parsed = parseAuthorizationRequest(params);
  if (!parsed.ok && parsed.fatal) {
    return {
      kind: 'page',
      response: htmlResponse(
        renderSignInMessage(
          'This sign-in request is invalid',
          parsed.description
        ),
        400
      ),
    };
  }

  const clientId = parsed.ok ? parsed.request.clientId : parsed.clientId;
  const redirectUri = parsed.ok
    ? parsed.request.redirectUri
    : parsed.redirectUri;
  const client = await options.fetchClient(clientId);
  if (!isRedirectUriAllowed(new URL(clientId), new URL(redirectUri), client)) {
    return {
      kind: 'page',
      response: htmlResponse(
        renderSignInMessage(
          'This sign-in request is invalid',
          `${clientId} does not list ${redirectUri} as one of its redirect URIs.`
        ),
        400
      ),
    };
  }

  if (!parsed.ok) {
    return {
      kind: 'redirect',
      location: authorizationRedirect(redirectUri, {
        error: parsed.error,
        error_description: parsed.description,
        state: parsed.state,
        iss: INDIEAUTH_ISSUER,
      }),
    };
  }
  return { kind: 'ok', request: parsed.request, client };
}

function signInOff(): Response {
  return htmlResponse(
    renderSignInMessage(
      'Sign-in is not set up',
      'This site has no owner check configured, so it cannot approve sign-ins. Set INDIEAUTH_TOTP_SECRET.'
    ),
    503
  );
}

/**
 * GET on the authorization endpoint: send the browser to the consent page
 * with the same query.
 */
export function handleAuthorizationRequest(request: Request): Response {
  const url = new URL(request.url);
  const consent = new URL(INDIEAUTH_CONSENT_ENDPOINT, url);
  consent.search = url.search;
  return new Response(null, {
    status: 302,
    headers: { Location: consent.href, 'Cache-Control': 'no-store' },
  });
}

/** GET on the consent page: show the form for a valid request. */
export async function handleConsentPage(
  request: Request,
  options: IndieAuthEndpointOptions
): Promise<Response> {
  if (!options.owner) return signInOff();

  const checked = await checkAuthorizationRequest(
    new URL(request.url).searchParams,
    options
  );
  if (checked.kind === 'page') return checked.response;
  if (checked.kind === 'redirect') {
    return Response.redirect(checked.location, 302);
  }

  return htmlResponse(
    renderConsentPage({
      request: checked.request,
      client: checked.client,
      me: INDIEAUTH_ME,
      prompt: options.owner.prompt,
    })
  );
}

/**
 * POST on the consent page: deny, or check the owner and send the client a
 * code for the scopes left checked.
 */
export async function handleConsentDecision(
  request: Request,
  options: IndieAuthEndpointOptions
): Promise<Response> {
  if (!isSameOriginPost(request)) {
    return htmlResponse(
      renderSignInMessage(
        'This sign-in request is invalid',
        'The form was not sent from this site.'
      ),
      403
    );
  }
  if (!options.owner) return signInOff();

  const body = await request.formData().catch(() => null);
  if (!body) {
    return htmlResponse(
      renderSignInMessage(
        'This sign-in request is invalid',
        'The form could not be read.'
      ),
      400
    );
  }
  const params = new URLSearchParams();
  for (const key of [
    'response_type',
    'client_id',
    'redirect_uri',
    'state',
    'code_challenge',
    'code_challenge_method',
    'scope',
  ]) {
    const value = body.get(key);
    if (typeof value === 'string') params.set(key, value);
  }

  const checked = await checkAuthorizationRequest(params, options);
  if (checked.kind === 'page') return checked.response;
  if (checked.kind === 'redirect') {
    return Response.redirect(checked.location, 303);
  }
  const { request: authorization, client } = checked;

  if (body.get('decision') !== 'approve') {
    return Response.redirect(
      authorizationRedirect(authorization.redirectUri, {
        error: 'access_denied',
        state: authorization.state,
        iss: INDIEAUTH_ISSUER,
      }),
      303
    );
  }

  const owner = await options.owner.verify(request, body);
  if (!owner.ok) {
    const locked = owner.reason === 'locked';
    return htmlResponse(
      renderConsentPage({
        request: authorization,
        client,
        me: INDIEAUTH_ME,
        prompt: options.owner.prompt,
        error: locked
          ? 'Too many wrong codes today. Sign-in is paused; try again tomorrow.'
          : 'That code did not work. Wait for the next one and try again.',
      }),
      locked ? 429 : 401
    );
  }

  // Only scopes the client asked for, of those the owner left checked.
  const checkedScopes = new Set(
    body.getAll('grant').filter((value) => typeof value === 'string')
  );
  const granted = parseScope(
    authorization.scope.filter((scope) => checkedScopes.has(scope)).join(' ')
  );
  const code = await issueAuthorizationCode(
    options.store,
    authorization,
    granted,
    clock(options)
  );
  return Response.redirect(
    authorizationRedirect(authorization.redirectUri, {
      code,
      state: authorization.state,
      iss: INDIEAUTH_ISSUER,
    }),
    303
  );
}

/**
 * POST on the authorization endpoint: redeem a code for the profile URL
 * alone, for clients that only sign people in.
 */
export async function handleProfileRedemption(
  request: Request,
  options: IndieAuthEndpointOptions
): Promise<Response> {
  const form = await readForm(request);
  if (!form) {
    return oauthError('invalid_request', 400, 'Send a form-encoded body.');
  }
  const redemption = await redeemAuthorizationCode(
    options.store,
    form,
    clock(options)
  );
  if (!redemption.ok) {
    return oauthError(redemption.error, 400, redemption.description);
  }
  return jsonResponse(profileResponse(redemption.record), {
    headers: TOKEN_HEADERS,
  });
}

/**
 * POST on the token endpoint: redeem a code for an access token, or, for
 * older clients, `action=revoke` with a `token`.
 */
export async function handleTokenRequest(
  request: Request,
  options: IndieAuthEndpointOptions
): Promise<Response> {
  const form = await readForm(request);
  if (!form) {
    return oauthError('invalid_request', 400, 'Send a form-encoded body.');
  }
  const now = clock(options);

  if (form.get('action') === 'revoke') {
    await revokeAccessToken(options.store, form.get('token') ?? '', now);
    return new Response(null, { status: 200, headers: TOKEN_HEADERS });
  }
  if (form.get('grant_type') !== 'authorization_code') {
    return oauthError(
      'unsupported_grant_type',
      400,
      'Only the authorization_code grant is supported.'
    );
  }

  const redemption = await redeemAuthorizationCode(options.store, form, now);
  if (!redemption.ok) {
    return oauthError(redemption.error, 400, redemption.description);
  }
  if (redemption.record.scope.length === 0) {
    return oauthError(
      'invalid_grant',
      400,
      'The code was issued without a scope, so it cannot become a token. Redeem it at the authorization endpoint.'
    );
  }

  const token = await issueAccessToken(options.store, redemption.record, now);
  return jsonResponse(token, { headers: TOKEN_HEADERS });
}

/**
 * GET on the token endpoint with a bearer token: the older verification
 * call, answered from the database.
 */
export async function handleTokenVerification(
  request: Request,
  options: IndieAuthEndpointOptions
): Promise<Response> {
  const bearer = getBearerToken(request);
  const record = bearer
    ? await findActiveToken(options.store, bearer, clock(options))
    : null;
  if (!record) return oauthError('invalid_token', 401);
  return jsonResponse(
    {
      me: record.me,
      client_id: record.clientId,
      scope: record.scope.join(' '),
    },
    { headers: TOKEN_HEADERS }
  );
}

/**
 * POST on the introspection endpoint (RFC 7662). Callers authenticate with
 * `INDIEAUTH_INTROSPECTION_SECRET` as a bearer token, so a stranger cannot
 * probe for live tokens.
 */
export async function handleIntrospection(
  request: Request,
  options: IndieAuthEndpointOptions
): Promise<Response> {
  if (!options.introspectionSecret) {
    return oauthError(
      'temporarily_unavailable',
      503,
      'Set INDIEAUTH_INTROSPECTION_SECRET to enable introspection.'
    );
  }
  if (
    !bearerMatches(
      request.headers.get('authorization'),
      options.introspectionSecret
    )
  ) {
    return oauthError('unauthorized', 401);
  }
  const form = await readForm(request);
  const token = form?.get('token');
  if (!token) {
    return oauthError('invalid_request', 400, 'token is required.');
  }
  const record = await findActiveToken(options.store, token, clock(options));
  return jsonResponse(introspectionResponse(record), {
    headers: TOKEN_HEADERS,
  });
}

/**
 * POST on the revocation endpoint (RFC 7009). It answers 200 whether or not
 * the token existed, so the answer says nothing about which tokens are live.
 */
export async function handleRevocation(
  request: Request,
  options: IndieAuthEndpointOptions
): Promise<Response> {
  const form = await readForm(request);
  const token = form?.get('token');
  if (!token) {
    return oauthError('invalid_request', 400, 'token is required.');
  }
  await revokeAccessToken(options.store, token, clock(options));
  return new Response(null, { status: 200, headers: TOKEN_HEADERS });
}
