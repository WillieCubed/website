import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginOAuth,
  completeOAuth,
  seal,
  unseal,
  writingReturnPath,
} from '../../lib/studio/oauth.ts';

process.env.STUDIO_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
  'base64'
);
process.env.STUDIO_LATTICE_ISSUER = 'https://auth.example';
process.env.STUDIO_LATTICE_CLIENT_ID = 'studio';
process.env.STUDIO_LATTICE_GATEWAY = 'https://lattice.example';
test('authorization uses personal inference scope, PKCE and a sealed verifier', () => {
  const flow = beginOAuth('https://preview.example'),
    url = new URL(flow.url);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('resource'), 'https://lattice.example');
  assert.doesNotMatch(url.searchParams.get('scope')!, /marketplace|manage/);
  const decoded = unseal<{ verifier: string; state: string }>(flow.cookie);
  assert.equal(decoded.state, url.searchParams.get('state'));
  assert.equal(decoded.verifier.length, 43);
  assert.ok(!flow.cookie.includes(decoded.verifier));
});
test('sealed credentials reject tampering', () => {
  const value = seal({ token: 'secret' }),
    bytes = Buffer.from(value, 'base64url');
  bytes[bytes.length - 1] ^= 1;
  assert.throws(() => unseal(bytes.toString('base64url')));
});
test('a key change asks the owner to reconnect Lattice', () => {
  const value = seal({ token: 'secret' });
  const saved = process.env.STUDIO_TOKEN_ENCRYPTION_KEY;
  try {
    process.env.STUDIO_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString(
      'base64'
    );
    assert.throws(() => unseal(value), /Reconnect your Lattice account/);
  } finally {
    process.env.STUDIO_TOKEN_ENCRYPTION_KEY = saved;
  }
});
test('callback rejects state mismatch before any token exchange', async () => {
  const flow = beginOAuth('https://preview.example');
  await assert.rejects(
    completeOAuth(
      new Request(
        'https://preview.example/api/studio/lattice/callback?code=x&state=invalid',
        { headers: { cookie: `studio_lattice_flow=${flow.cookie}` } }
      )
    ),
    /does not match/
  );
});
test('callback rejects an expired authorization attempt', async () => {
  const cookie = seal({
    state: 'x',
    verifier: 'v',
    origin: 'https://preview.example',
    expiresAt: 0,
  });
  await assert.rejects(
    completeOAuth(
      new Request(
        'https://preview.example/api/studio/lattice/callback?code=x&state=x',
        { headers: { cookie: `studio_lattice_flow=${cookie}` } }
      )
    ),
    /expired/
  );
});

test('production publishes a public URL OAuth identity with only the private callback and minimal scopes', async () => {
  const { GET } =
    await import('../../app/.well-known/lattice-client.json/route.ts');
  const saved = {
    mode: process.env.SITE_MODE,
    origin: process.env.STUDIO_ORIGIN,
    gateway: process.env.STUDIO_LATTICE_GATEWAY,
  };
  try {
    process.env.SITE_MODE = 'public';
    process.env.STUDIO_ORIGIN = 'https://preview.willie.page';
    process.env.STUDIO_LATTICE_GATEWAY = 'https://lattice.uselovelace.com';
    const response = await GET(),
      body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(
      body.client_id,
      'https://willie.page/.well-known/lattice-client.json'
    );
    assert.deepEqual(body.redirect_uris, [
      'https://preview.willie.page/api/studio/lattice/callback',
    ]);
    assert.deepEqual(body.grant_types, ['authorization_code', 'refresh_token']);
    assert.equal(body.token_endpoint_auth_method, 'none');
    assert.deepEqual(body.resource, ['https://lattice.uselovelace.com']);
    assert.equal(body.scope, 'openid offline_access lattice:compute:inference');
    assert.doesNotMatch(
      JSON.stringify(body),
      /accessToken|refreshToken|client_secret|marketplace|personal_runtime:manage/
    );
    assert.match(response.headers.get('cache-control')!, /public/);
    process.env.SITE_MODE = 'preview';
    const hidden = await GET();
    assert.equal(hidden.status, 404);
    assert.match(hidden.headers.get('x-robots-tag')!, /noindex/);
  } finally {
    for (const [name, value] of Object.entries({
      SITE_MODE: saved.mode,
      STUDIO_ORIGIN: saved.origin,
      STUDIO_LATTICE_GATEWAY: saved.gateway,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('OAuth returns only to a sealed writing task and rejects redirect injection', () => {
  const path = '/studio/12345678-1234-1234-1234-123456789abc?components=1';
  assert.equal(writingReturnPath(path), path);
  for (const value of [
    'https://evil.example',
    '//evil.example',
    '/studio/../api/studio/assets',
    '/studio/x?components=1',
    path + '&next=https://evil.example',
  ])
    assert.equal(writingReturnPath(value), '/studio');
  const flow = beginOAuth('https://preview.example', path);
  assert.equal(unseal<{ returnTo: string }>(flow.cookie).returnTo, path);
  assert.ok(!new URL(flow.url).searchParams.has('returnTo'));
});
