import { type Page, expect, test } from '@playwright/test';

// docs/metadata.md: og:site_name carries the name, so no social title
// repeats it, and every title reads on its own.

const SITE_NAME = 'Willie Chalmers III';

async function meta(page: Page, selector: string) {
  return page.locator(`meta[${selector}]`).first().getAttribute('content');
}

const PAGES = [
  { path: '/writings', title: 'Writings' },
  { path: '/initiatives', title: 'Initiatives' },
  { path: '/initiatives/twd', title: 'The Willie Diaries' },
  { path: '/initiatives/fall-tour-2026', title: 'Fall Tour 2026' },
  {
    path: '/initiatives/fall-tour-2026/part-1',
    title: 'Fall Tour 2026 Part 1: A Boy Goes Back to Dallas',
  },
];

for (const { path, title } of PAGES) {
  test(`${path} names itself once and leaves the name to og:site_name`, async ({
    page,
  }) => {
    await page.goto(path);
    expect(await meta(page, 'property="og:site_name"')).toBe(SITE_NAME);
    expect(await meta(page, 'property="og:title"')).toBe(title);
    expect(await meta(page, 'name="twitter:title"')).toBe(title);
    await expect(page).toHaveTitle(`${title} · ${SITE_NAME}`);
  });
}

test('the homepage title is its headline, not the site name again', async ({
  page,
}) => {
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

test('an in-site link shows its card on hover and on keyboard focus', async ({
  page,
}) => {
  await page.goto('/initiatives/twd');
  const link = page.getByRole('link', { name: 'Fall Tour 2026' }).last();
  const card = page.locator('.link-preview:popover-open');

  await link.hover();
  await expect(card).toContainText('Fall Tour 2026');

  await page.mouse.move(0, 0);
  await expect(card).toHaveCount(0);

  await page.keyboard.press('Tab');
  await link.focus();
  await expect(card).toContainText('Fall Tour 2026');
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
});
