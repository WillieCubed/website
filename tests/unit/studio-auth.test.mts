import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { authorizeStudio, checkMutationOrigin } from '../../lib/studio/auth';

test('studio refuses public deployments even when a caller supplies a token', async () => {
  await assert.rejects(
    () =>
      authorizeStudio(new Request('https://willie.page/api/studio/documents'), {
        SITE_MODE: 'public',
      }),
    /not found/i
  );
});

test('Access validation rejects missing, wrong-audience and expired tokens', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const key = createLocalJWKSet({ keys: [await exportJWK(publicKey)] });
  const env = {
    SITE_MODE: 'preview',
    OWNER_ACCESS_ISSUER: 'https://team.cloudflareaccess.com',
    OWNER_ACCESS_AUDIENCE: 'studio',
    OWNER_ACCESS_EMAIL: 'owner@example.com',
  };
  const signed = (aud: string, exp: number) =>
    new SignJWT({ email: 'owner@example.com' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(env.OWNER_ACCESS_ISSUER)
      .setAudience(aud)
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(privateKey);
  const request = (token?: string) =>
    new Request('https://preview.willie.page/api/studio/documents', {
      headers: token ? { 'cf-access-jwt-assertion': token } : {},
    });
  await assert.rejects(() => authorizeStudio(request(), env, key));
  await assert.rejects(async () =>
    authorizeStudio(
      request(await signed('other', Math.floor(Date.now() / 1000) + 60)),
      env,
      key
    )
  );
  await assert.rejects(async () =>
    authorizeStudio(request(await signed('studio', 1)), env, key)
  );
  assert.equal(
    (
      await authorizeStudio(
        request(await signed('studio', Math.floor(Date.now() / 1000) + 60)),
        env,
        key
      )
    ).email,
    'owner@example.com'
  );
});

test('mutating preview requests require exact origin, including port', () => {
  assert.throws(() =>
    checkMutationOrigin(
      new Request('https://preview.willie.page/api/studio/documents', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
      }),
      'https://preview.willie.page'
    )
  );
  assert.throws(() =>
    checkMutationOrigin(
      new Request('https://preview.willie.page/api/studio/documents', {
        method: 'POST',
      }),
      'https://preview.willie.page'
    )
  );
  checkMutationOrigin(
    new Request('https://preview.willie.page/api/studio/documents', {
      method: 'POST',
      headers: { origin: 'https://preview.willie.page' },
    }),
    'https://preview.willie.page'
  );
});
