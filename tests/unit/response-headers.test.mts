import { modifyRouteRegex } from 'next/dist/lib/redirect-status';
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { ENDPOINT_DISCOVERY_LINKS } from '@/lib/indieweb/discovery-links';
import { siteHeaders } from '@/lib/response-headers';

const CLACKS = { key: 'X-Clacks-Overhead', value: 'GNU Terry Pratchett' };

/**
 * The headers a path gets, matched with the options Next's router uses for
 * next.config's headers() (next/dist/server/lib/router-utils/filesystem.js).
 */
function headersFor(path: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const rule of siteHeaders) {
    const match = getPathMatch(rule.source, {
      strict: true,
      regexModifier: (regex) => modifyRouteRegex(regex),
    });
    if (!match(path)) continue;
    for (const { key, value } of rule.headers) found.set(key, value);
  }
  return found;
}

// Metadata files answer at a name of their own rather than at their folder.
const METADATA_FILES: Record<string, string> = {
  'opengraph-image.tsx': 'opengraph-image',
  'manifest.ts': 'manifest.webmanifest',
  'robots.ts': 'robots.txt',
  'sitemap.ts': 'sitemap.xml',
};

/**
 * Every routed file under app/, as a request path. Private folders are not
 * routed and route groups leave no segment. A dynamic segment gets a value
 * a real request would carry.
 */
function appRoutes(dir = 'app', segments: string[] = []) {
  const routes: Array<{ path: string; kind: 'page' | 'handler' }> = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_')) continue;
      const dynamic = /^\[(.+)\]$/.exec(entry.name)?.[1];
      const segment = entry.name.startsWith('(')
        ? []
        : [dynamic ? (dynamic === 'part' ? 'part-1' : 'a-slug') : entry.name];
      routes.push(
        ...appRoutes(join(dir, entry.name), [...segments, ...segment])
      );
      continue;
    }
    const path = (extra: string[] = []) =>
      `/${[...segments, ...extra].join('/')}`;
    if (entry.name === 'page.tsx') routes.push({ path: path(), kind: 'page' });
    if (entry.name === 'route.ts') {
      routes.push({ path: path(), kind: 'handler' });
    }
    if (entry.name in METADATA_FILES) {
      routes.push({
        path: path([METADATA_FILES[entry.name]]),
        kind: 'handler',
      });
    }
  }
  return routes;
}

test('every path carries the Clacks overhead', () => {
  const rule = siteHeaders.find((entry) => entry.source === '/:path*');

  assert.ok(rule, 'a rule for every path');
  assert.deepEqual(
    rule.headers.find((header) => header.key === CLACKS.key),
    CLACKS
  );
});

test('every page advertises the discovery endpoints in a Link header', () => {
  const pages = appRoutes().filter((route) => route.kind === 'page');
  assert.ok(pages.length >= 8, 'found the pages under app/');

  for (const { path } of pages) {
    const link = headersFor(path).get('Link');
    assert.ok(link, `${path} has a Link header`);
    for (const { rel, href } of ENDPOINT_DISCOVERY_LINKS) {
      assert.ok(link.includes(`<${href}>; rel="${rel}"`), `${path} ${rel}`);
    }
  }
});

test('route handlers, images, and files get no Link header', () => {
  const others = [
    ...appRoutes()
      .filter((route) => route.kind === 'handler')
      .map((route) => route.path),
    '/_next/static/chunks/main.js',
    '/pagefind/pagefind.js',
    '/brand/web/icon-48.png',
    '/writings/a-slug.md',
  ];
  assert.ok(others.includes('/writings/feed.xml'), 'found the handlers');

  for (const path of others) {
    assert.ok(!headersFor(path).has('Link'), `${path} has no Link header`);
  }
});

test('every path refuses sniffing and denies unused permissions', () => {
  for (const path of ['/', '/feed.xml', '/indieauth/consent', '/api/mcp']) {
    const headers = headersFor(path);
    assert.equal(headers.get('X-Content-Type-Options'), 'nosniff', path);
    const permissions = headers.get('Permissions-Policy') ?? '';
    for (const feature of [
      'camera',
      'microphone',
      'geolocation',
      'interest-cohort',
      'browsing-topics',
    ]) {
      assert.ok(permissions.includes(`${feature}=()`), `${path} ${feature}`);
    }
  }
});

test('the referrer policy is pinned everywhere the consent page does not set its own', () => {
  for (const path of ['/', '/writings/a-slug', '/feed.xml', '/api/mcp']) {
    assert.equal(
      headersFor(path).get('Referrer-Policy'),
      'strict-origin-when-cross-origin',
      path
    );
  }
  for (const path of ['/indieauth/consent', '/indieauth/auth']) {
    assert.ok(!headersFor(path).has('Referrer-Policy'), path);
  }
});

test('pages isolate their opener but the IndieAuth routes never do', () => {
  for (const path of ['/', '/writings/a-slug']) {
    assert.equal(
      headersFor(path).get('Cross-Origin-Opener-Policy'),
      'same-origin-allow-popups',
      path
    );
  }
  const indieauth = appRoutes()
    .map((route) => route.path)
    .filter((path) => path.startsWith('/indieauth/'));
  assert.ok(indieauth.includes('/indieauth/consent'));
  for (const path of indieauth) {
    assert.ok(!headersFor(path).has('Cross-Origin-Opener-Policy'), path);
  }
});

test('the Link header lists each endpoint once, in the order the head does', () => {
  const link = headersFor('/').get('Link');

  assert.equal(
    link,
    '</webmention>; rel="webmention", </micropub>; rel="micropub", ' +
      '</.well-known/oauth-authorization-server>; rel="indieauth-metadata", ' +
      '</indieauth/auth>; rel="authorization_endpoint", ' +
      '</indieauth/token>; rel="token_endpoint", ' +
      '<https://websubhub.com/hub>; rel="hub"'
  );
});

test('next.config.ts serves the site headers', async () => {
  const { default: config } = await import('../../next.config');

  assert.deepEqual(await config.headers?.(), siteHeaders);
});
