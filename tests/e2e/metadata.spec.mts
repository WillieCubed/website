import { type Page, expect, test } from '@playwright/test';

import { skipUnlessPublished } from './published';

// docs/metadata.md: og:site_name carries the name, so no social title
// repeats it, and every title reads on its own.

const SITE_NAME = 'Willie Chalmers III';

async function meta(page: Page, selector: string) {
  return page.locator(`meta[${selector}]`).first().getAttribute('content');
}

const PAGES = [
  { path: '/writings', title: 'Writings' },
  { path: '/initiatives', title: 'Initiatives' },
  { path: '/brand', title: 'Brand' },
];

for (const { path, title } of PAGES) {
  test(`${path} leaves the name to og:site_name`, async ({ page }) => {
    await page.goto(path);
    expect(await meta(page, 'property="og:site_name"')).toBe(SITE_NAME);
    expect(await meta(page, 'property="og:title"')).toBe(title);
    expect(await meta(page, 'name="twitter:title"')).toBe(title);
    await expect(page).toHaveTitle(`${title} · ${SITE_NAME}`);
  });
}

test('a tag page is titled with the tag alone', async ({ page, request }) => {
  await skipUnlessPublished(request, '/writings/tags/note');
  await page.goto('/writings/tags/note');
  expect(await meta(page, 'property="og:site_name"')).toBe(SITE_NAME);
  expect(await meta(page, 'property="og:title"')).toBe('#note');
});

test('the homepage title is its headline', async ({ page }) => {
  await page.goto('/');
  const title = await meta(page, 'property="og:title"');
  expect(await meta(page, 'property="og:site_name"')).toBe(SITE_NAME);
  expect(title).not.toBe(SITE_NAME);
  expect(title).toMatch(/builds software/);
});

test('a missing page keeps the name out of its social title', async ({
  page,
}) => {
  await page.goto('/this-page-does-not-exist');
  expect(await meta(page, 'property="og:title"')).toBe('Not found');
});
