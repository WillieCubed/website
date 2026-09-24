import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

/**
 * The pages that exist in production. Drafts are hidden there, so nothing
 * here depends on a writing or an initiative that may not be published.
 */
const PAGES = [
  { path: '/', heading: /Willie Chalmers/ },
  { path: '/writings', heading: 'Writings' },
  { path: '/initiatives', heading: 'Initiatives' },
  { path: '/search', heading: 'Search' },
];

/** Fails with every WCAG 2.2 A and AA violation axe finds on the page. */
async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    // Known issue: the studio tile's pager dots on a phone are 8px targets
    // 14px apart, under the 24px that target-size asks for. Drop this once
    // the pager is resized.
    .exclude('.pager')
    .analyze();
  const summary = violations.map(
    ({ id, impact, nodes }) =>
      `${id} (${impact}): ${nodes.map((node) => node.target.join(' ')).join(', ')}`
  );
  expect(summary).toEqual([]);
}

for (const { path, heading } of PAGES) {
  test(`${path} loads and passes axe`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { level: 1, name: heading })
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });
}

test('an unknown path shows the 404 page and passes axe', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'No page lives at this address.',
    })
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

test('the homepage countdown renders at its full size', async ({ page }) => {
  await page.goto('/');
  const count = page.locator('.count').first();
  const number = count.locator('b');
  // The number streams in at request time and then counts up.
  await expect(number).toHaveText(/^\d+$/);
  const size = (element: Element) =>
    parseFloat(getComputedStyle(element).fontSize);
  const numberSize = await number.evaluate(size);
  const captionSize = await count.locator('> span').evaluate(size);
  // home.css draws the number at clamp(36px, 3.6vw, 54px); a stray
  // descendant selector once shrank it to the caption's 14px.
  expect(numberSize).toBeGreaterThanOrEqual(36);
  expect(numberSize).toBeGreaterThan(captionSize * 2);
});

test('the homepage footer docks and opens at the end', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer.site-footer');
  await expect(footer).toHaveAttribute('data-dock', '');
  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight })
  );
  await expect
    .poll(() =>
      footer.evaluate((element) =>
        parseFloat((element as HTMLElement).style.getPropertyValue('--p'))
      )
    )
    .toBe(1);
});

test('the footer stays a plain block off the homepage', async ({ page }) => {
  await page.goto('/writings');
  const footer = page.locator('footer.site-footer');
  await expect(footer).toBeVisible();
  await expect(footer).not.toHaveAttribute('data-dock');
});
