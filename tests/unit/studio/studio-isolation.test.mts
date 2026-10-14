import { proxy } from '@/proxy';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { NextRequest } from 'next/server';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

const envKeys = [
  'SITE_MODE',
  'OWNER_ACCESS_ISSUER',
  'OWNER_ACCESS_AUDIENCE',
  'OWNER_ACCESS_EMAIL',
] as const;

function restoreEnv(saved: NodeJS.ProcessEnv) {
  for (const key of envKeys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

test('public deployments hide every studio page and API while allowing public routes', async () => {
  const saved = { ...process.env };
  try {
    process.env.SITE_MODE = 'public';
    for (const path of [
      '/studio',
      '/studio/read/secret',
      '/api/studio',
      '/api/studio/documents',
    ]) {
      assert.equal(
        (await proxy(new NextRequest(`https://willie.page${path}`))).status,
        404,
        path
      );
    }
    assert.equal(
      (
        await proxy(new NextRequest('https://willie.page/writings'))
      ).headers.get('x-middleware-next'),
      '1'
    );
  } finally {
    restoreEnv(saved);
  }
});

test('preview gates pages, static artifacts and discovery endpoints before routing', async () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, {
      SITE_MODE: 'preview',
      OWNER_ACCESS_ISSUER: 'https://access.example.com',
      OWNER_ACCESS_AUDIENCE: 'preview',
      OWNER_ACCESS_EMAIL: 'owner@example.com',
    });
    for (const path of [
      '/',
      '/studio',
      '/writings/secret',
      '/api/search?q=secret',
      '/search-index.json',
      '/pagefind/pagefind.js',
      '/_next/static/chunk.js',
      '/api/mcp',
      '/feed.xml',
      '/sitemap.xml',
      '/llms.txt',
    ]) {
      const response = await proxy(
        new NextRequest(`https://preview.willie.page${path}`)
      );
      assert.equal(response.status, 401, path);
      assert.match(
        response.headers.get('cache-control') ?? '',
        /private, no-store/,
        path
      );
      assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/, path);
      assert.equal(response.headers.get('x-middleware-rewrite'), null, path);
    }
  } finally {
    restoreEnv(saved);
  }
});

test('a verified preview owner sees request-time writing rewrites, while syndication stays closed', async () => {
  const saved = { ...process.env };
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: 'test-key',
    alg: 'RS256',
    use: 'sig',
  };
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const issuer = `http://127.0.0.1:${address.port}`;
  try {
    Object.assign(process.env, {
      SITE_MODE: 'preview',
      OWNER_ACCESS_ISSUER: issuer,
      OWNER_ACCESS_AUDIENCE: 'preview',
      OWNER_ACCESS_EMAIL: 'owner@example.com',
    });
    const jwt = await new SignJWT({ email: 'owner@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .setIssuer(issuer)
      .setAudience('preview')
      .sign(privateKey);
    const strangerJwt = await new SignJWT({ email: 'stranger@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .setIssuer(issuer)
      .setAudience('preview')
      .sign(privateKey);
    const denied = await proxy(
      new NextRequest('https://preview.willie.page/writings/secret', {
        headers: { 'cf-access-jwt-assertion': strangerJwt },
      })
    );
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('x-middleware-rewrite'), null);
    const request = (path: string) =>
      new NextRequest(`https://preview.willie.page${path}`, {
        headers: { 'cf-access-jwt-assertion': jwt },
      });
    const response = await proxy(request('/writings/secret?revision=one'));
    assert.equal(
      response.headers.get('x-middleware-rewrite'),
      'https://preview.willie.page/studio/read/secret?revision=one'
    );
    assert.match(
      response.headers.get('cache-control') ?? '',
      /private, no-store/
    );
    for (const path of [
      '/feed.xml',
      '/writings/tags/private/feed/json',
      '/llms.txt',
      '/sitemap.xml',
      '/oembed',
      '/api/mcp',
      '/webmentions',
    ]) {
      assert.equal((await proxy(request(path))).status, 404, path);
    }
  } finally {
    restoreEnv(saved);
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});
