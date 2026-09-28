import { expect, test } from '@playwright/test';

import { skipUnlessPublished } from './published';

// These check the server's answers rather than a rendered page, so
// playwright.config.mts runs them in the desktop project only.

const REDIRECTS = [
  // Retired pages, temporary while their replacements settle.
  { from: '/media', to: '/initiatives/twd', status: 307 },
  { from: '/apps', to: '/projects', status: 307 },
  // Paths feed readers guess.
  { from: '/rss.xml', to: '/feed.xml', status: 308 },
  { from: '/rss', to: '/feed.xml', status: 308 },
  { from: '/feed', to: '/feed.xml', status: 308 },
  { from: '/index.xml', to: '/feed.xml', status: 308 },
  { from: '/atom.xml', to: '/feed/atom', status: 308 },
];

for (const { from, to, status } of REDIRECTS) {
  test(`${from} redirects to ${to}`, async ({ request, baseURL }) => {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(status);
    expect(new URL(response.headers()['location'], baseURL).pathname).toBe(to);
  });
}

// lib/indieweb/discovery.ts: the head's endpoint links, as a header.
const DISCOVERY_LINKS = [
  '</webmention>; rel="webmention"',
  '</micropub>; rel="micropub"',
  '</.well-known/oauth-authorization-server>; rel="indieauth-metadata"',
  '</indieauth/auth>; rel="authorization_endpoint"',
  '</indieauth/token>; rel="token_endpoint"',
  '<https://websubhub.com/hub>; rel="hub"',
];

for (const path of ['/', '/writings', '/initiatives/fall-tour-2026/part-1']) {
  test(`${path} advertises the IndieWeb endpoints in a Link header`, async ({
    request,
  }) => {
    await skipUnlessPublished(request, path);
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const link = response.headers()['link'] ?? '';
    for (const entry of DISCOVERY_LINKS) expect(link).toContain(entry);
  });
}

test('a feed carries no page Link header', async ({ request }) => {
  const response = await request.get('/feed.xml');
  expect(response.headers()['link'] ?? '').not.toContain('rel="webmention"');
});

test('/feed.xml serves the RSS feed', async ({ request }) => {
  const response = await request.get('/feed.xml');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/rss+xml');
  expect(await response.text()).toMatch(/<rss[\s>][\s\S]*<channel>/);
});

const ALIAS_HOSTS = [
  { host: 'tour.willie.page', to: '/initiatives/fall-tour-2026' },
  { host: 'diaries.willie.page', to: '/initiatives/twd' },
];

for (const { host, to } of ALIAS_HOSTS) {
  test(`${host} redirects to ${to}`, async ({ request }) => {
    const response = await request.get('/', {
      headers: { host },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    expect(
      new URL(response.headers()['location'], 'https://willie.page').pathname
    ).toBe(to);
  });
}
