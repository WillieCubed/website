import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyIndieAuthToken } from '@/lib/indieweb/indieauth';
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

test('the full flow: approve, exchange, verify for Micropub, introspect, revoke', async () => {
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

  // The code was spent by the exchange.
  const replay = await handleTokenRequest(
    tokenRedemption(code),
    context.options
  );
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).error, 'invalid_grant');

  // Micropub checks the token against the same store, locally.
  const micropub = {
    bearer: token.access_token,
    expectedMe: site.origin,
    store: context.store,
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
  assert.equal(refused.status, 400);
  assert.equal((await refused.json()).error, 'invalid_grant');

  // A fresh code, since the refusal spent that one. Wait for the next TOTP
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

test('the token endpoint wants a form and the authorization_code grant', async () => {
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
  assert.equal((await refresh.json()).error, 'unsupported_grant_type');
});

test('introspection is off without its secret', async () => {
  const { options } = setup();
  const response = await handleIntrospection(
    formPost('/indieauth/introspect', { token: 'x' }),
    { ...options, introspectionSecret: undefined }
  );
  assert.equal(response.status, 503);
});
