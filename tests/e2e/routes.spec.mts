import { expect, test } from '@playwright/test';

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

test('/feed.xml serves the RSS feed', async ({ request }) => {
  const response = await request.get('/feed.xml');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/rss+xml');
  expect(await response.text()).toMatch(/<rss[\s>][\s\S]*<channel>/);
});
