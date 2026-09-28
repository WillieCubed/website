import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { ENDPOINT_DISCOVERY_LINKS } from '@/lib/indieweb/discovery-links';
import { siteHeaders } from '@/lib/response-headers';

const CLACKS = { key: 'X-Clacks-Overhead', value: 'GNU Terry Pratchett' };

/** The headers a path gets, matched the way next.config's headers() is. */
function headersFor(path: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const rule of siteHeaders) {
    if (!getPathMatch(rule.source, { strict: true })(path)) continue;
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
