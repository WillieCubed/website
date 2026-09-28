import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

import { skipUnlessPublished } from './published';

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
    .analyze();
  const summary = violations.map(
    ({ id, impact, nodes }) =>
      `${id} (${impact}): ${nodes.map((node) => node.target.join(' ')).join(', ')}`
  );
  expect(summary).toEqual([]);
}

test('the error page returns 500 and passes axe', async ({ page }) => {
  const response = await page.goto('/500');
  expect(response?.status()).toBe(500);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Something went wrong.' })
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

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

test('a tag page loads and passes axe', async ({ page, request }) => {
  await skipUnlessPublished(request, '/writings/tags/note');
  await page.goto('/writings/tags/note');
  await expect(
    page.getByRole('heading', { level: 1, name: 'note' })
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

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

test('the IndieAuth consent fallback passes axe', async ({ page }) => {
  const response = await page.goto('/indieauth/consent');
  expect(response?.status()).toBeGreaterThanOrEqual(400);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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

test('focus previews a homepage row without reporting a pinned selection', async ({
  page,
}) => {
  await page.goto('/');
  const row = page.locator('.focuses button').first();
  await row.focus();
  await expect(row).toHaveAttribute('aria-pressed', 'false');
  await row.press('Enter');
  await expect(row).toHaveAttribute('aria-pressed', 'true');
  await row.press('Enter');
  await expect(row).toHaveAttribute('aria-pressed', 'false');
});

test('collapsed footer controls stay out of the tab order', async ({
  page,
}) => {
  await page.goto('/');
  const footer = page.locator('footer.site-footer');
  await expect(footer.locator('.site-footer__pages')).toHaveAttribute(
    'inert',
    ''
  );
  await expect(footer.locator('.feeds-button')).toHaveAttribute('inert', '');
  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight })
  );
  await expect(footer.locator('.site-footer__pages')).not.toHaveAttribute(
    'inert',
    ''
  );
  await expect(footer.locator('.feeds-button')).not.toHaveAttribute(
    'inert',
    ''
  );
});

test('the studio pager keeps 24px targets without changing its dot design', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const buttons = page.locator('.pager button');
  await expect(buttons.first()).toBeVisible();
  for (const button of await buttons.all()) {
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
  }
});

test('the open homepage detail view passes axe and returns focus', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.locator('#lvbt a.cover');
  await trigger.click();
  const dialog = page.locator('dialog.detail');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await expectNoAxeViolations(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('feed links receive focus when the popover opens and Escape restores it', async ({
  page,
}) => {
  await page.goto('/writings');
  const trigger = page.getByRole('button', { name: 'Feeds' });
  await trigger.click();
  const panel = page.locator('.feeds-popover:popover-open');
  await expect(panel.getByRole('link', { name: /RSS/ })).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('the homepage reflows at 320px without horizontal scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ).toBeLessThanOrEqual(1);
});

test('focus remains visible in forced colors', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
  await page.keyboard.press('Tab');
  const trigger = page.getByRole('link', { name: 'Skip to content' });
  await expect(trigger).toBeFocused();
  const outline = await trigger.evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });
  expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  expect(outline.style).not.toBe('none');
});

test('reduced motion suppresses decorative transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const duration = await page
    .locator('.product')
    .first()
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(
    duration
      .split(',')
      .every((value) =>
        value.trim().endsWith('ms')
          ? parseFloat(value) <= 1
          : parseFloat(value) <= 0.001
      )
  ).toBe(true);
});
