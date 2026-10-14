import { SignJWT, generateKeyPair } from 'jose';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ownerAccessAuthenticatorFromEnvironment,
  verifyOwnerAccess,
} from '../../../lib/owner/access';

const config = {
  issuer: 'https://owner.cloudflareaccess.com',
  audience: 'writing-and-site-owner',
  email: 'owner@example.test',
};

test('signed Access JWT grants the configured owner, including through a direct Worker URL', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const token = await new SignJWT({ email: 'OWNER@example.test' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  const request = new Request('https://example.workers.dev/admin/status', {
    headers: { 'Cf-Access-Jwt-Assertion': token },
  });
  assert.equal(
    await verifyOwnerAccess(request, config, async () => publicKey),
    true
  );
});

test('owner check rejects absent, forged, expired, wrong-audience, and other-user tokens', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const otherKey = (await generateKeyPair('RS256')).privateKey;
  const verifyKey = async () => publicKey;
  const sign = (
    overrides: {
      email?: string;
      audience?: string;
      issuer?: string;
      expires?: string;
      key?: typeof privateKey;
    } = {}
  ) =>
    new SignJWT({ email: overrides.email ?? config.email })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(overrides.issuer ?? config.issuer)
      .setAudience(overrides.audience ?? config.audience)
      .setIssuedAt()
      .setExpirationTime(overrides.expires ?? '5m')
      .sign(overrides.key ?? privateKey);
  assert.equal(
    await verifyOwnerAccess(
      new Request('https://willie.page/admin'),
      config,
      verifyKey
    ),
    false
  );
  for (const options of [
    { key: otherKey },
    { expires: '-1m' },
    { audience: 'other' },
    { issuer: 'https://other.cloudflareaccess.com' },
    { email: 'intruder@example.test' },
  ]) {
    const token = await sign(options);
    const request = new Request('https://willie.page/admin', {
      headers: { 'Cf-Access-Jwt-Assertion': token },
    });
    assert.equal(await verifyOwnerAccess(request, config, verifyKey), false);
  }
});

test('IndieAuth consent uses Access identity without asking for another code', async () => {
  assert.equal(ownerAccessAuthenticatorFromEnvironment({}), null);
  const owner = ownerAccessAuthenticatorFromEnvironment({
    OWNER_ACCESS_ISSUER: config.issuer,
    OWNER_ACCESS_AUDIENCE: config.audience,
    OWNER_ACCESS_EMAIL: config.email,
  });
  assert.deepEqual(
    await owner?.verify(new Request('https://willie.page/indieauth/consent')),
    { ok: false, reason: 'invalid' }
  );
});
