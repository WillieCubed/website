import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyIndieAuthToken } from '@/lib/indieweb/indieauth';
import * as endpoints from '@/lib/indieweb/indieauth-endpoints';
import {
  handleAuthorizationRequest,
  handleConsentDecision,
  handleConsentPage,
  handleIntrospection,
  handleProfileRedemption,
  handleRevocation,
  handleTokenRequest,
  handleTokenVerification,
} from '@/lib/indieweb/indieauth-endpoints';
import {
  createTotpOwnerAuthenticator,
  totpCode,
  totpStep,
} from '@/lib/indieweb/indieauth-owner';
import { codeChallengeFor } from '@/lib/indieweb/indieauth-server';
import type {
  IndieAuthClientInfo,
  IndieAuthEndpointOptions,
} from '@/lib/indieweb/types';
import { site } from '@/lib/site';

import {
  memoryIndieAuthStore,
  memoryOwnerSignInStore,
} from './indieauth-memory-store.mts';

const SECRET = Buffer.from('12345678901234567890');
const CLIENT = 'https://client.example/';
const REDIRECT = 'https://client.example/callback';
const VERIFIER = 'v'.repeat(64);
const INTROSPECTION_SECRET = 'introspection-secret';

/** Endpoint options over in-memory stores, a fixed clock, and a fake client. */
function setup({
  client = { name: 'Client', redirectUris: [] },
  owner = true,
}: { client?: IndieAuthClientInfo; owner?: boolean } = {}) {
  let now = new Date('2026-09-22T12:00:00Z');
  const { store } = memoryIndieAuthStore();
  const signIns = memoryOwnerSignInStore();
  const options: IndieAuthEndpointOptions = {
    store,
    owner: owner
      ? createTotpOwnerAuthenticator({
          secret: SECRET,
          store: signIns.store,
          now: () => now,
        })
      : null,
    fetchClient: async () => client,
    introspectionSecret: INTROSPECTION_SECRET,
    now: () => now,
  };
  return {
    options,
    store,
    code: () => totpCode(SECRET, totpStep(now)),
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
}

function authorizationQuery(overrides: Record<string, string> = {}) {
  return new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT,
    redirect_uri: REDIRECT,
    state: 'state-1',
    code_challenge: codeChallengeFor(VERIFIER),
    code_challenge_method: 'S256',
    scope: 'create media profile',
    ...overrides,
  });
}

/** The consent form as the browser posts it back. */
function consentPost(
  fields: Record<string, string | string[]>,
  headers: Record<string, string> = { 'Sec-Fetch-Site': 'same-origin' }
) {
  const body = authorizationQuery();
  body.set('decision', 'approve');
  for (const [key, value] of Object.entries(fields)) {
    body.delete(key);
    for (const item of [value].flat()) body.append(key, item);
  }
  return new Request(`${site.origin}/indieauth/consent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body,
  });
}

function formPost(path: string, fields: Record<string, string>, headers = {}) {
  return new Request(`${site.origin}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body: new URLSearchParams(fields),
  });
}

/** Approve the default request and return the code from the redirect. */
async function approve(
  context: ReturnType<typeof setup>,
  grant: string[] = ['create', 'media', 'profile']
) {
  const response = await handleConsentDecision(
    consentPost({ code: context.code(), grant }),
    context.options
  );
  assert.equal(response.status, 303);
  const location = new URL(response.headers.get('location') ?? '');
  assert.equal(location.origin + location.pathname, REDIRECT);
  assert.equal(location.searchParams.get('state'), 'state-1');
  assert.equal(location.searchParams.get('iss'), `${site.origin}/`);
  return location.searchParams.get('code') ?? '';
}

function tokenRedemption(code: string, overrides: Record<string, string> = {}) {
  return formPost('/indieauth/token', {
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT,
    redirect_uri: REDIRECT,
    code_verifier: VERIFIER,
    ...overrides,
  });
}

test('the authorization endpoint forwards the browser to the consent page', () => {
  const query = authorizationQuery().toString();
  const response = handleAuthorizationRequest(
    new Request(`${site.origin}/indieauth/auth?${query}`)
  );
  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get('location'),
    `${site.origin}/indieauth/consent?${query}`
  );
});

test('the consent page shows the client and the requested scopes', async () => {
  const { options } = setup();
  const response = await handleConsentPage(
    new Request(`${site.origin}/indieauth/consent?${authorizationQuery()}`),
    options
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const html = await response.text();
  assert.match(html, /Sign in to Client/);
  assert.match(html, /Signing in as/);
  assert.match(html, /Requested by/);
  assert.match(html, /Return to/);
  assert.match(html, /Allow Client to/);
  assert.match(html, /https:\/\/client\.example\/callback/);
  assert.match(html, /name="grant" value="create" checked/);
  assert.match(html, /name="grant" value="media" checked/);
  assert.match(html, /autocomplete="one-time-code"/);
});

test('the consent page refuses a redirect URI the client does not list', async () => {
  const { options } = setup();
  const response = await handleConsentPage(
    new Request(
      `${site.origin}/indieauth/consent?${authorizationQuery({
        redirect_uri: 'https://evil.example/callback',
      })}`
    ),
    options
  );
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('location'), null);
});

test('other request errors go back to the client', async () => {
  const { options } = setup();
  const response = await handleConsentPage(
    new Request(
      `${site.origin}/indieauth/consent?${authorizationQuery({
        code_challenge_method: 'plain',
      })}`
    ),
    options
  );
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('location') ?? '');
  assert.equal(location.searchParams.get('error'), 'invalid_request');
  assert.equal(location.searchParams.get('state'), 'state-1');
});

test('sign-in is off until an owner check is configured', async () => {
  const { options } = setup({ owner: false });
  const page = await handleConsentPage(
    new Request(`${site.origin}/indieauth/consent?${authorizationQuery()}`),
    options
  );
  assert.equal(page.status, 503);
  assert.match(await page.text(), /INDIEAUTH_TOTP_SECRET/);
  const post = await handleConsentDecision(consentPost({}), options);
  assert.equal(post.status, 503);
});

test('a consent post from another site is refused', async () => {
  const context = setup();
  for (const headers of [
    { 'Sec-Fetch-Site': 'cross-site' },
    { Origin: 'https://evil.example' },
  ]) {
    const response = await handleConsentDecision(
      consentPost({ code: context.code() }, headers),
      context.options
    );
    assert.equal(response.status, 403);
  }
});

test('a consent post with neither Sec-Fetch-Site nor Origin is refused', async () => {
  const context = setup();
  const response = await handleConsentDecision(
    consentPost({ code: context.code() }, {}),
    context.options
  );
  assert.equal(response.status, 403);
  const sameOrigin = await handleConsentDecision(
    consentPost({ code: context.code() }, { Origin: site.origin }),
    context.options
  );
  assert.equal(sameOrigin.status, 303);
});

test('a wrong code shows the form again and issues nothing', async () => {
  const context = setup();
  const response = await handleConsentDecision(
    consentPost({ code: '000000' }),
    context.options
  );
  assert.equal(response.status, 401);
  assert.match(await response.text(), /That code did not work/);
});

test('denying sends access_denied back to the client', async () => {
  const context = setup();
  const response = await handleConsentDecision(
    consentPost({ decision: 'deny' }),
    context.options
  );
  assert.equal(response.status, 303);
  const location = new URL(response.headers.get('location') ?? '');
  assert.equal(location.searchParams.get('error'), 'access_denied');
  assert.equal(location.searchParams.get('code'), null);
});

test('the full flow verifies issued tokens and revokes them after code replay', async () => {
  const context = setup();
  // The owner clears the media box before approving.
  const code = await approve(context, ['create', 'profile']);

  const exchange = await handleTokenRequest(
    tokenRedemption(code),
    context.options
  );
  assert.equal(exchange.status, 200);
  assert.equal(exchange.headers.get('cache-control'), 'no-store');
  const token = await exchange.json();
  assert.equal(token.token_type, 'Bearer');
  assert.equal(token.scope, 'create profile');
  assert.equal(token.me, `${site.origin}/`);
  assert.equal(token.profile.name, site.author.name);

  // Micropub checks the token against the same store, locally.
  const micropub = {
    bearer: token.access_token,
    expectedMe: site.origin,
    store: context.store,
    now: context.options.now!(),
  };
  assert.equal(
    await verifyIndieAuthToken({ ...micropub, requiredScope: 'create' }),
    true
  );
  assert.equal(
    await verifyIndieAuthToken({ ...micropub, requiredScope: 'media' }),
    false
  );

  const verification = await handleTokenVerification(
    new Request(`${site.origin}/indieauth/token`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }),
    context.options
  );
  assert.deepEqual(await verification.json(), {
    me: `${site.origin}/`,
    client_id: CLIENT,
    scope: 'create profile',
  });

  const introspect = (authorization: string) =>
    handleIntrospection(
      formPost(
        '/indieauth/introspect',
        { token: token.access_token },
        { Authorization: authorization }
      ),
      context.options
    );
  assert.equal((await introspect('Bearer wrong')).status, 401);
  const active = await (
    await introspect(`Bearer ${INTROSPECTION_SECRET}`)
  ).json();
  assert.equal(active.active, true);
  assert.equal(active.client_id, CLIENT);

  // The code was spent by the exchange.
  const replay = await handleTokenRequest(
    tokenRedemption(code),
    context.options
  );
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).error, 'invalid_grant');

  assert.equal(await verifyIndieAuthToken(micropub), false);

  const revoked = await handleRevocation(
    formPost('/indieauth/revoke', { token: token.access_token }),
    context.options
  );
  assert.equal(revoked.status, 200);
  assert.equal(await verifyIndieAuthToken(micropub), false);
  assert.deepEqual(
    await (await introspect(`Bearer ${INTROSPECTION_SECRET}`)).json(),
    { active: false }
  );
  const after = await handleTokenVerification(
    new Request(`${site.origin}/indieauth/token`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }),
    context.options
  );
  assert.equal(after.status, 401);
});

test('the token endpoint still takes the older action=revoke form', async () => {
  const context = setup();
  const code = await approve(context);
  const token = await (
    await handleTokenRequest(tokenRedemption(code), context.options)
  ).json();

  const response = await handleTokenRequest(
    formPost('/indieauth/token', {
      action: 'revoke',
      token: token.access_token,
    }),
    context.options
  );
  assert.equal(response.status, 200);
  assert.equal(
    await verifyIndieAuthToken({
      bearer: token.access_token,
      expectedMe: site.origin,
      store: context.store,
    }),
    false
  );
});

test('a code without a scope redeems for a profile, never a token', async () => {
  const context = setup();
  const tokenCode = await approve(context, []);
  const refused = await handleTokenRequest(
    tokenRedemption(tokenCode),
    context.options
  );
  assert.equal(refused.status, 200);
  assert.deepEqual(await refused.json(), { me: `${site.origin}/` });

  // A fresh code, since the exchange spent that one. Wait for the next TOTP
  // step, as each code signs in once.
  context.advance(30_000);
  const profileCode = await approve(context, []);
  const profile = await handleProfileRedemption(
    formPost('/indieauth/auth', {
      grant_type: 'authorization_code',
      code: profileCode,
      client_id: CLIENT,
      redirect_uri: REDIRECT,
      code_verifier: VERIFIER,
    }),
    context.options
  );
  assert.equal(profile.status, 200);
  assert.deepEqual(await profile.json(), { me: `${site.origin}/` });
});

test('the token endpoint requires form fields for supported grants', async () => {
  const { options } = setup();
  const json = await handleTokenRequest(
    new Request(`${site.origin}/indieauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }),
    options
  );
  assert.equal(json.status, 400);

  const refresh = await handleTokenRequest(
    formPost('/indieauth/token', { grant_type: 'refresh_token' }),
    options
  );
  assert.equal((await refresh.json()).error, 'invalid_request');
});

test('introspection is off without its secret', async () => {
  const { options } = setup();
  const response = await handleIntrospection(
    formPost('/indieauth/introspect', { token: 'x' }),
    { ...options, introspectionSecret: undefined }
  );
  assert.equal(response.status, 503);
});

function refreshRequest(token: string, overrides: Record<string, string> = {}) {
  return formPost('/indieauth/token', {
    grant_type: 'refresh_token',
    refresh_token: token,
    client_id: CLIENT,
    ...overrides,
  });
}

async function issuedTokens(context: ReturnType<typeof setup>) {
  const code = await approve(context);
  return (
    await handleTokenRequest(tokenRedemption(code), context.options)
  ).json();
}

async function tokenStatus(context: ReturnType<typeof setup>, token: string) {
  return handleTokenVerification(
    new Request(`${site.origin}/indieauth/token`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    context.options
  );
}

test('refresh rotates once and reuse disables the entire grant', async () => {
  const context = setup();
  const first = await issuedTokens(context);
  assert.equal(first.expires_in, 3600);
  assert.equal(typeof first.refresh_token, 'string');
  const refreshed = await handleTokenRequest(
    refreshRequest(first.refresh_token),
    context.options
  );
  assert.equal(refreshed.status, 200);
  const next = await refreshed.json();
  assert.notEqual(next.access_token, first.access_token);
  assert.notEqual(next.refresh_token, first.refresh_token);
  assert.equal((await tokenStatus(context, first.access_token)).status, 200);
  assert.equal((await tokenStatus(context, next.access_token)).status, 200);

  const replay = await handleTokenRequest(
    refreshRequest(first.refresh_token),
    context.options
  );
  assert.equal((await replay.json()).error, 'invalid_grant');
  assert.equal((await tokenStatus(context, first.access_token)).status, 401);
  assert.equal((await tokenStatus(context, next.access_token)).status, 401);
  const after = await handleTokenRequest(
    refreshRequest(next.refresh_token),
    context.options
  );
  assert.equal((await after.json()).error, 'invalid_grant');
});

test('refresh rejects another client and scope escalation without consuming the token', async () => {
  const context = setup();
  const first = await issuedTokens(context);
  for (const [fields, error] of [
    [{ client_id: 'https://other.example/' }, 'invalid_grant'],
    [{ scope: 'create delete' }, 'invalid_scope'],
    [{ scope: 'create bogus' }, 'invalid_scope'],
    [{ scope: '' }, 'invalid_scope'],
    [{ scope: 'email' }, 'invalid_scope'],
  ] as const) {
    const response = await handleTokenRequest(
      refreshRequest(first.refresh_token, fields),
      context.options
    );
    assert.equal((await response.json()).error, error);
  }
  const reduced = await handleTokenRequest(
    refreshRequest(first.refresh_token, { scope: 'create' }),
    context.options
  );
  assert.equal(reduced.status, 200);
  const second = await reduced.json();
  assert.equal(second.scope, 'create');
  assert.equal(second.profile, undefined);
  const restored = await handleTokenRequest(
    refreshRequest(second.refresh_token),
    context.options
  );
  assert.equal((await restored.json()).scope, first.scope);
});

test('concurrent refresh requests cannot both rotate the same token', async () => {
  const context = setup();
  const first = await issuedTokens(context);
  const responses = await Promise.all([
    handleTokenRequest(refreshRequest(first.refresh_token), context.options),
    handleTokenRequest(refreshRequest(first.refresh_token), context.options),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 400]);
  const accepted = await responses.find((r) => r.status === 200)!.json();
  assert.equal((await tokenStatus(context, accepted.access_token)).status, 401);
});

test('refresh extends the 90 day inactivity deadline and access tokens expire after an hour', async () => {
  const context = setup();
  const first = await issuedTokens(context);
  context.advance(3600 * 1000);
  assert.equal((await tokenStatus(context, first.access_token)).status, 401);
  context.advance(89 * 24 * 3600 * 1000 - 3600 * 1000);
  const second = await (
    await handleTokenRequest(
      refreshRequest(first.refresh_token),
      context.options
    )
  ).json();
  assert.equal(typeof second.refresh_token, 'string');
  context.advance(2 * 24 * 3600 * 1000);
  const third = await handleTokenRequest(
    refreshRequest(second.refresh_token),
    context.options
  );
  assert.equal(third.status, 200);
  const next = await third.json();
  context.advance(90 * 24 * 3600 * 1000);
  const expired = await handleTokenRequest(
    refreshRequest(next.refresh_token),
    context.options
  );
  assert.equal((await expired.json()).error, 'invalid_grant');
});

test('revoking a refresh token disables its family and related access tokens', async () => {
  const context = setup();
  const first = await issuedTokens(context);
  const revoked = await handleRevocation(
    formPost('/indieauth/revoke', { token: first.refresh_token }),
    context.options
  );
  assert.equal(revoked.status, 200);
  assert.equal((await tokenStatus(context, first.access_token)).status, 401);
  const response = await handleTokenRequest(
    refreshRequest(first.refresh_token),
    context.options
  );
  assert.equal((await response.json()).error, 'invalid_grant');
});

test('userinfo returns only profile fields granted to a valid bearer token', async () => {
  for (const scope of [['create'], ['profile'], ['profile', 'email']]) {
    const context = setup();
    const consent = await handleConsentDecision(
      consentPost({
        code: context.code(),
        scope: scope.join(' '),
        grant: scope,
      }),
      context.options
    );
    const code = new URL(consent.headers.get('location')!).searchParams.get(
      'code'
    )!;
    const token = await (
      await handleTokenRequest(tokenRedemption(code), context.options)
    ).json();
    const response = await endpoints.handleUserInfo(
      new Request(`${site.origin}/indieauth/userinfo`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      }),
      context.options
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
    if (!scope.includes('profile')) {
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error, 'insufficient_scope');
    } else {
      assert.equal(response.status, 200);
      const profile = await response.json();
      assert.equal(profile.name, site.author.name);
      assert.equal(profile.url, `${site.origin}/`);
      assert.equal(
        profile.email,
        scope.includes('email') ? site.author.email : undefined
      );
      assert.equal(profile.me, undefined);
      await handleRevocation(
        formPost('/indieauth/revoke', { token: token.access_token }),
        context.options
      );
      const revoked = await endpoints.handleUserInfo(
        new Request(`${site.origin}/indieauth/userinfo`, {
          headers: { Authorization: `Bearer ${token.access_token}` },
        }),
        context.options
      );
      assert.equal(revoked.status, 401);
    }
  }
  const context = setup();
  const missing = await endpoints.handleUserInfo(
    new Request(`${site.origin}/indieauth/userinfo`),
    context.options
  );
  assert.equal(missing.status, 401);
  const invalid = await endpoints.handleUserInfo(
    new Request(`${site.origin}/indieauth/userinfo`, {
      headers: { Authorization: 'Bearer invalid' },
    }),
    context.options
  );
  assert.equal(invalid.status, 401);
  assert.equal((await invalid.json()).error, 'invalid_token');
});

test('ambiguous authorization and consent parameters cannot redirect or issue a code', async () => {
  for (const key of [
    'client_id',
    'redirect_uri',
    'response_type',
    'state',
    'code_challenge',
    'code_challenge_method',
    'scope',
  ]) {
    const { options, code } = setup();
    const params = authorizationQuery();
    params.append(
      key,
      key === 'redirect_uri'
        ? 'https://attacker.example/callback'
        : params.get(key)!
    );
    const response = await handleConsentPage(
      new Request(`${site.origin}/indieauth/consent?${params}`),
      options
    );
    assert.equal(response.status, 400, key);
    assert.equal(response.headers.get('Location'), null, key);
    params.set('decision', 'approve');
    params.set('code', code());
    const consent = await handleConsentDecision(
      new Request(`${site.origin}/indieauth/consent`, {
        method: 'POST',
        headers: { Origin: site.origin },
        body: params,
      }),
      options
    );
    assert.equal(consent.status, 400, key);
    assert.equal(consent.headers.get('Location'), null, key);
  }
});

test('ambiguous token requests leave authorization codes and refresh tokens usable', async () => {
  const context = setup();
  const code = await approve(context);
  const fields = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT,
    redirect_uri: REDIRECT,
    code_verifier: VERIFIER,
  });
  const send = (body: URLSearchParams) =>
    handleTokenRequest(
      new Request(`${site.origin}/indieauth/token`, { method: 'POST', body }),
      context.options
    );
  for (const key of fields.keys()) {
    const repeated = new URLSearchParams(fields);
    repeated.append(key, fields.get(key)!);
    const refused = await send(repeated);
    assert.equal(refused.status, 400, key);
    assert.equal((await refused.json()).error, 'invalid_request', key);
  }
  const tokenResponse = await send(fields);
  assert.equal(tokenResponse.status, 200);
  const token = await tokenResponse.json();
  const refresh = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: token.refresh_token,
    client_id: CLIENT,
    scope: 'create',
  });
  for (const key of refresh.keys()) {
    const repeated = new URLSearchParams(refresh);
    repeated.append(key, refresh.get(key)!);
    const refused = await send(repeated);
    assert.equal(refused.status, 400, key);
    assert.equal((await refused.json()).error, 'invalid_request', key);
  }
  assert.equal((await send(refresh)).status, 200);
});
