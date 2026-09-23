import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isRedirectUriAllowed,
  parseClientHtml,
  parseClientId,
  parseClientMetadataJson,
} from '@/lib/indieweb/indieauth-client';
import {
  ACCESS_TOKEN_LIFETIME_MS,
  AUTHORIZATION_CODE_LIFETIME_MS,
  INDIEAUTH_ISSUER,
  buildIndieAuthMetadata,
  codeChallengeFor,
  findActiveToken,
  hashSecret,
  introspectionResponse,
  issueAccessToken,
  issueAuthorizationCode,
  parseAuthorizationRequest,
  parseScope,
  profileResponse,
  redeemAuthorizationCode,
  revokeAccessToken,
  verifyPkce,
} from '@/lib/indieweb/indieauth-server';
import type { IndieAuthAuthorizationRequest } from '@/lib/indieweb/types';
import { site } from '@/lib/site';

import { memoryIndieAuthStore } from './indieauth-memory-store.mts';

const NOW = new Date('2026-09-22T12:00:00Z');
// RFC 7636 appendix B.
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

const request: IndieAuthAuthorizationRequest = {
  clientId: 'https://client.example/',
  redirectUri: 'https://client.example/callback',
  state: 'state-1',
  codeChallenge: CHALLENGE,
  scope: ['profile', 'create'],
};

function redemption(code: string, overrides: Record<string, string> = {}) {
  return new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    code_verifier: VERIFIER,
    ...overrides,
  });
}

test('metadata names the issuer and every endpoint on this origin', () => {
  const metadata = buildIndieAuthMetadata();
  assert.equal(metadata.issuer, `${site.origin}/`);
  assert.equal(
    metadata.authorization_endpoint,
    `${site.origin}/indieauth/auth`
  );
  assert.equal(metadata.token_endpoint, `${site.origin}/indieauth/token`);
  assert.equal(
    metadata.introspection_endpoint,
    `${site.origin}/indieauth/introspect`
  );
  assert.equal(metadata.revocation_endpoint, `${site.origin}/indieauth/revoke`);
  assert.deepEqual(metadata.code_challenge_methods_supported, ['S256']);
  assert.equal(metadata.authorization_response_iss_parameter_supported, true);
});

test('parseScope keeps supported scopes once, and email only with profile', () => {
  assert.deepEqual(parseScope('create  create media bogus'), [
    'create',
    'media',
  ]);
  assert.deepEqual(parseScope('email create'), ['create']);
  assert.deepEqual(parseScope('profile email'), ['profile', 'email']);
  assert.deepEqual(parseScope(null), []);
});

test('PKCE matches the RFC 7636 example and nothing else', () => {
  assert.equal(codeChallengeFor(VERIFIER), CHALLENGE);
  assert.equal(verifyPkce(VERIFIER, CHALLENGE), true);
  assert.equal(verifyPkce(`${VERIFIER.slice(0, -1)}Y`, CHALLENGE), false);
  // Too short to be a verifier, even when its digest would match.
  assert.equal(verifyPkce('short', codeChallengeFor('short')), false);
  // The plain method would send the verifier itself as the challenge.
  assert.equal(verifyPkce(VERIFIER, VERIFIER), false);
});

test('parseAuthorizationRequest accepts an S256 request with state', () => {
  const parsed = parseAuthorizationRequest(
    new URLSearchParams({
      response_type: 'code',
      client_id: request.clientId,
      redirect_uri: request.redirectUri,
      state: 'state-1',
      code_challenge: CHALLENGE,
      code_challenge_method: 'S256',
      scope: 'profile create',
      me: 'https://willie.page/',
    })
  );
  assert.deepEqual(parsed, { ok: true, request });
});

test('parseAuthorizationRequest refuses what it cannot redirect, and redirects the rest', () => {
  const base = {
    response_type: 'code',
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    state: 'state-1',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
  };
  const parse = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(base);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    return parseAuthorizationRequest(params);
  };

  for (const overrides of [
    { client_id: null },
    { client_id: 'ftp://client.example/' },
    { redirect_uri: 'not a url' },
    { redirect_uri: 'https://client.example/callback#fragment' },
  ]) {
    const parsed = parse(overrides);
    assert.equal(!parsed.ok && parsed.fatal, true, JSON.stringify(overrides));
  }

  for (const [overrides, error] of [
    [{ response_type: 'token' }, 'unsupported_response_type'],
    [{ state: null }, 'invalid_request'],
    [{ code_challenge: null }, 'invalid_request'],
    [{ code_challenge_method: 'plain' }, 'invalid_request'],
    [{ code_challenge_method: null }, 'invalid_request'],
  ] as const) {
    const parsed = parse(overrides);
    assert.ok(!parsed.ok && !parsed.fatal, JSON.stringify(overrides));
    assert.equal(parsed.error, error);
    assert.equal(parsed.redirectUri, request.redirectUri);
  }
});

test('a code redeems once, for its client, redirect, and verifier', async () => {
  const { store } = memoryIndieAuthStore();
  const code = await issueAuthorizationCode(store, request, ['create'], NOW);

  const redeemed = await redeemAuthorizationCode(store, redemption(code), NOW);
  assert.ok(redeemed.ok);
  assert.equal(redeemed.record.me, INDIEAUTH_ISSUER);
  assert.deepEqual(redeemed.record.scope, ['create']);

  const again = await redeemAuthorizationCode(store, redemption(code), NOW);
  assert.deepEqual(again.ok ? null : again.error, 'invalid_grant');
});

test('a host-only client redeems with the URLs exactly as it sent them', async () => {
  // The spec lets a client_id have no path; the URL parser stores it with
  // `/`. The client sends its own spelling again when it redeems.
  const sent = {
    client_id: 'https://App.example',
    redirect_uri: 'https://App.example',
  };
  const parsed = parseAuthorizationRequest(
    new URLSearchParams({
      response_type: 'code',
      ...sent,
      state: 'state-1',
      code_challenge: CHALLENGE,
      code_challenge_method: 'S256',
      scope: 'create',
    })
  );
  assert.ok(parsed.ok);
  assert.equal(parsed.request.clientId, 'https://app.example/');
  const { store } = memoryIndieAuthStore();
  const code = await issueAuthorizationCode(
    store,
    parsed.request,
    ['create'],
    NOW
  );

  const redeemed = await redeemAuthorizationCode(
    store,
    redemption(code, sent),
    NOW
  );
  assert.ok(redeemed.ok, redeemed.ok ? '' : redeemed.description);
  assert.equal(redeemed.record.clientId, 'https://app.example/');
});

test('a redemption with a client_id that is not a client URL is refused', async () => {
  const { store } = memoryIndieAuthStore();
  const code = await issueAuthorizationCode(store, request, ['create'], NOW);
  const refused = await redeemAuthorizationCode(
    store,
    redemption(code, { client_id: 'not a url' }),
    NOW
  );
  assert.equal(refused.ok ? null : refused.error, 'invalid_grant');
});

test('only the digest of a code is stored', async () => {
  const { store, codes } = memoryIndieAuthStore();
  const code = await issueAuthorizationCode(store, request, [], NOW);
  assert.deepEqual([...codes.keys()], [hashSecret(code)]);
  assert.ok(!JSON.stringify([...codes.values()]).includes(code));
});

test('a code is refused for another client, redirect, or verifier, and is spent', async () => {
  for (const overrides of [
    { client_id: 'https://other.example/' },
    { redirect_uri: 'https://client.example/other' },
    { code_verifier: 'x'.repeat(43) },
  ]) {
    const { store } = memoryIndieAuthStore();
    const code = await issueAuthorizationCode(store, request, ['create'], NOW);

    const wrong = await redeemAuthorizationCode(
      store,
      redemption(code, overrides),
      NOW
    );
    assert.equal(wrong.ok ? null : wrong.error, 'invalid_grant');

    // The failed attempt burned the code.
    const right = await redeemAuthorizationCode(store, redemption(code), NOW);
    assert.equal(right.ok, false, JSON.stringify(overrides));
  }
});

test('a code expires after ten minutes', async () => {
  const { store } = memoryIndieAuthStore();
  const code = await issueAuthorizationCode(store, request, ['create'], NOW);
  const later = new Date(NOW.getTime() + AUTHORIZATION_CODE_LIFETIME_MS);
  const redeemed = await redeemAuthorizationCode(
    store,
    redemption(code),
    later
  );
  assert.equal(redeemed.ok, false);
});

test('a redemption missing a field or using another grant is refused unspent', async () => {
  const { store } = memoryIndieAuthStore();
  const code = await issueAuthorizationCode(store, request, ['create'], NOW);

  const missing = redemption(code);
  missing.delete('code_verifier');
  const refused = await redeemAuthorizationCode(store, missing, NOW);
  assert.equal(refused.ok ? null : refused.error, 'invalid_request');

  const grant = await redeemAuthorizationCode(
    store,
    redemption(code, { grant_type: 'refresh_token' }),
    NOW
  );
  assert.equal(grant.ok ? null : grant.error, 'unsupported_grant_type');

  assert.equal(
    (await redeemAuthorizationCode(store, redemption(code), NOW)).ok,
    true
  );
});

test('the profile response carries the profile only when granted', () => {
  const record = {
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    me: INDIEAUTH_ISSUER,
    scope: ['profile'],
    codeChallenge: CHALLENGE,
    expiresAt: NOW,
  };
  const withProfile = profileResponse(record);
  assert.equal(withProfile.me, INDIEAUTH_ISSUER);
  assert.equal(withProfile.profile?.name, site.author.name);
  assert.equal(withProfile.profile?.email, undefined);
  assert.equal(
    profileResponse({ ...record, scope: ['profile', 'email'] }).profile?.email,
    site.author.email
  );
  assert.deepEqual(profileResponse({ ...record, scope: [] }), {
    me: INDIEAUTH_ISSUER,
  });
});

test('an issued token verifies until it expires or is revoked', async () => {
  const { store, tokens } = memoryIndieAuthStore();
  const code = await issueAuthorizationCode(store, request, ['create'], NOW);
  const redeemed = await redeemAuthorizationCode(store, redemption(code), NOW);
  assert.ok(redeemed.ok);

  const response = await issueAccessToken(store, redeemed.record, NOW);
  assert.equal(response.token_type, 'Bearer');
  assert.equal(response.scope, 'create');
  assert.equal(response.me, INDIEAUTH_ISSUER);
  assert.equal(response.expires_in, ACCESS_TOKEN_LIFETIME_MS / 1000);
  assert.ok(!tokens.has(response.access_token), 'stored by digest only');

  const record = await findActiveToken(store, response.access_token, NOW);
  assert.equal(record?.clientId, request.clientId);
  assert.equal(await findActiveToken(store, 'another-token', NOW), null);
  assert.equal(await findActiveToken(store, '', NOW), null);

  const expiry = new Date(NOW.getTime() + ACCESS_TOKEN_LIFETIME_MS);
  assert.equal(
    await findActiveToken(store, response.access_token, expiry),
    null
  );

  await revokeAccessToken(store, response.access_token, NOW);
  assert.equal(await findActiveToken(store, response.access_token, NOW), null);
  // Revoking again, or revoking nonsense, is not an error.
  await revokeAccessToken(store, response.access_token, NOW);
  await revokeAccessToken(store, 'nonsense', NOW);
});

test('introspection reports active grants and nothing about inactive ones', () => {
  assert.deepEqual(introspectionResponse(null), { active: false });
  assert.deepEqual(
    introspectionResponse({
      clientId: request.clientId,
      me: INDIEAUTH_ISSUER,
      scope: ['create', 'media'],
      issuedAt: NOW,
      expiresAt: new Date(NOW.getTime() + 1000),
    }),
    {
      active: true,
      me: INDIEAUTH_ISSUER,
      client_id: request.clientId,
      scope: 'create media',
      iat: NOW.getTime() / 1000,
      exp: NOW.getTime() / 1000 + 1,
    }
  );
});

test('parseClientId follows the spec’s client identifier rules', () => {
  for (const valid of [
    'https://client.example/',
    'https://client.example/app?x=1',
    'http://localhost:3000/',
    'http://127.0.0.1/',
    'http://[::1]/',
  ]) {
    assert.ok(parseClientId(valid), valid);
  }
  for (const invalid of [
    null,
    '',
    'client.example',
    'mailto:me@client.example',
    'https://client.example/#frag',
    'https://user:pass@client.example/',
    'https://client.example/a/../b',
    'https://client.example/./b',
    'https://10.0.0.1/',
    'https://[2001:db8::1]/',
  ]) {
    assert.equal(parseClientId(invalid), null, String(invalid));
  }
});

test('a redirect URI off the client’s host must be listed by the client', () => {
  const client = new URL('https://client.example/');
  const none = { redirectUris: [] };
  assert.equal(
    isRedirectUriAllowed(client, new URL('https://client.example/cb'), none),
    true
  );
  assert.equal(
    isRedirectUriAllowed(client, new URL('http://client.example/cb'), none),
    false
  );
  assert.equal(
    isRedirectUriAllowed(client, new URL('https://evil.example/cb'), none),
    false
  );
  assert.equal(
    isRedirectUriAllowed(client, new URL('app://callback'), {
      redirectUris: ['app://callback'],
    }),
    true
  );
  // A listed URI matches however the client spelled it.
  assert.equal(
    isRedirectUriAllowed(client, new URL('https://Callback.example'), {
      redirectUris: ['https://callback.EXAMPLE'],
    }),
    true
  );
});

test('client metadata is read from JSON and from HTML', () => {
  const json = parseClientMetadataJson('https://client.example/', {
    client_id: 'https://client.example/',
    client_name: 'Client',
    client_uri: 'https://client.example/',
    logo_uri: 'https://client.example/logo.png',
    redirect_uris: ['app://callback', 42],
  });
  assert.deepEqual(json, {
    name: 'Client',
    url: 'https://client.example/',
    logo: 'https://client.example/logo.png',
    redirectUris: ['app://callback'],
  });
  // A host-only client_id is the same client as the one with its `/`.
  assert.deepEqual(
    parseClientMetadataJson('https://client.example/', {
      client_id: 'https://Client.example',
      redirect_uris: ['app://callback'],
    }).redirectUris,
    ['app://callback']
  );
  // A document that names another client_id says nothing about this one.
  assert.deepEqual(
    parseClientMetadataJson('https://client.example/', {
      client_id: 'https://other.example/',
      redirect_uris: ['app://callback'],
    }),
    { redirectUris: [] }
  );

  const html = parseClientHtml(
    `<link rel="redirect_uri" href="/callback">
     <div class="h-app"><a class="u-url p-name" href="/">Quill</a>
     <img class="u-logo" src="/logo.png" alt=""></div>`,
    'https://quill.example/'
  );
  assert.equal(html.name, 'Quill');
  assert.equal(html.logo, 'https://quill.example/logo.png');
  assert.deepEqual(html.redirectUris, ['https://quill.example/callback']);
});
