#!/usr/bin/env node
/** Read-only hosted release gate for the canonical site and isolated preview. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { isMain } from '../shared/command.mts';

export async function verifyPublicRoutes() {
  const PREVIEW_ORIGIN =
    'https://willie-page-preview.willieechalmers-18f.workers.dev';
  const PRODUCTION_DIAGNOSTIC_ORIGIN =
    'https://willie-page.willieechalmers-18f.workers.dev';
  const CANONICAL_ORIGIN = 'https://willie.page';
  const ALLOWED_ORIGINS = new Set([
    PREVIEW_ORIGIN,
    PRODUCTION_DIAGNOSTIC_ORIGIN,
    CANONICAL_ORIGIN,
  ]);

  const { values } = parseArgs({
    options: {
      origin: { type: 'string', default: PREVIEW_ORIGIN },
      sha: { type: 'string' },
      output: { type: 'string' },
    },
  });
  const origin = values.origin!;
  assert(
    ALLOWED_ORIGINS.has(origin),
    'Use the preview, production diagnostic, or canonical origin.'
  );
  assert(
    /^[a-f0-9]{40}$/.test(values.sha ?? ''),
    'Pass --sha with a full Git SHA.'
  );
  const expectedSha = values.sha!;

  const checks: Array<Record<string, unknown>> = [];
  async function get(path: string, status: number, contentType?: string) {
    const response = await fetch(`${origin}${path}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(
      response.headers.get('server')?.toLowerCase(),
      'cloudflare',
      `${path} is not served by the Cloudflare Worker`
    );
    assert.equal(response.status, status, `${path} returned the wrong status`);
    const observedType = response.headers.get('content-type');
    if (contentType) {
      assert(
        observedType?.startsWith(contentType),
        `${path} returned ${observedType}, expected ${contentType}`
      );
    }
    checks.push({ path, status, contentType: observedType });
    return response;
  }

  const revision = await get('/api/indieweb/revision', 200, 'application/json');
  const release = await revision.json();
  assert.equal(release.sha, expectedSha, 'Wrong deployed revision');
  assert.equal(
    release.runtime,
    'cloudflare-workers',
    'Revision route lacks Worker deployment bindings'
  );

  const metadata = await get(
    '/.well-known/oauth-authorization-server',
    200,
    'application/json'
  );
  const issuer = (await metadata.json()).issuer;
  const expectedIssuer =
    origin === PRODUCTION_DIAGNOSTIC_ORIGIN ? CANONICAL_ORIGIN : origin;
  assert.equal(
    issuer,
    `${expectedIssuer}/`,
    'IndieAuth advertises the wrong origin'
  );

  const admin = await get(
    '/api/admin/status',
    origin === CANONICAL_ORIGIN ? 302 : 401,
    origin === CANONICAL_ORIGIN ? 'text/html' : 'application/json'
  );
  if (origin === CANONICAL_ORIGIN) {
    const location = new URL(admin.headers.get('location') ?? '', origin);
    assert.equal(
      location.hostname,
      'williecubed.cloudflareaccess.com',
      'Unauthenticated admin status did not redirect to Cloudflare Access'
    );
    assert(
      location.pathname.startsWith('/cdn-cgi/access/login/'),
      'Unauthenticated admin status did not redirect to an Access login'
    );
  }
  await admin.body?.cancel();

  const routes: Array<[string, number, string?]> = [
    ['/', 200, 'text/html'],
    ['/status', 200, 'text/html'],
    ['/search', 200, 'text/html'],
    ['/api/status', 200, 'application/json'],
    ['/api/search?q=Willie', 200, 'application/json'],
    ['/writings/feed.xml', 200, 'application/rss+xml'],
    ['/writings/feed/atom', 200, 'application/atom+xml'],
    ['/writings/feed/json', 200, 'application/feed+json'],
    ['/oauth-client-metadata.json', 200, 'application/json'],
    ['/robots.txt', 200, 'text/plain'],
    ['/sitemap.xml', 200, 'application/xml'],
    ['/micropub', 200],
    ['/webmention', 200, 'application/json'],
    ['/writings/opengraph-image', 200, 'image/png'],
    ['/initiatives/opengraph-image', 200, 'image/png'],
    ['/micropub/media', 405],
    ['/media/media/migration-check-missing.jpg', 404],
    ['/writings/migration-check-missing', 404],
  ];
  for (const [path, status, contentType] of routes) {
    const response = await get(path, status, contentType);
    await response.body?.cancel();
  }

  const redirect = await get('/rss.xml', 308);
  assert.equal(
    redirect.headers.get('location'),
    '/feed.xml',
    'The legacy feed redirect changed'
  );
  await redirect.body?.cancel();

  const receipt = {
    checkedAt: new Date().toISOString(),
    origin,
    sha: expectedSha,
    result: 'passed',
    writes: 'None. All checks use GET.',
    checks,
  };
  if (values.output) {
    const output = resolve(values.output);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(receipt, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    console.log(`Hosted route matrix passed: ${output}`);
  } else {
    console.log(`Hosted route matrix passed: ${origin} at ${expectedSha}`);
  }
}

if (isMain(import.meta.url)) await verifyPublicRoutes();
