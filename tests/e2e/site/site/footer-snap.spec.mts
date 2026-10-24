import { expect, test } from '@playwright/test';

for (const width of [390, 1920]) {
  for (const route of ['/', '/colophon']) {
    test(`footer settles softly and releases on ${route} at ${width}px`, async ({
      page,
    }) => {
      const height = width < 840 ? 844 : 1000;
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.goto(route);
      await expect(page.locator('html')).toHaveAttribute(
        'data-footer-motion',
        ''
      );
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('html')).toHaveCSS('scroll-snap-type', 'none');
      await expect(page.locator('.site-footer__snap-end')).toHaveCSS(
        'scroll-snap-align',
        'end'
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      const delta = await page.evaluate(
        () => document.documentElement.scrollHeight - innerHeight - scrollY - 32
      );
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.wheel(0, delta);
      await expect
        .poll(() =>
          page.evaluate(() =>
            Math.abs(
              document.documentElement.scrollHeight - innerHeight - scrollY
            )
          )
        )
        .toBeLessThan(1);
      await expect(page.locator('html')).toHaveCSS(
        'scroll-snap-type',
        /^y(?: proximity)?$/
      );
      await expect(page.locator('.site-footer__pages')).toBeVisible();
      await expect(page.locator('.site-footer__row')).toHaveCSS(
        'margin-block-start',
        '24px'
      );
      await page.mouse.wheel(0, -height * 0.75);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollHeight - innerHeight - scrollY
          )
        )
        .toBeGreaterThan(200);
    });
  }
}

test('reduced motion leaves scrolling unsnapped', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/colophon');
  await expect(page.locator('html')).toHaveAttribute('data-footer-motion', '');
  await expect(page.locator('html')).toHaveCSS('scroll-snap-type', 'none');
  await expect(page.locator('.site-footer__snap-end')).toHaveAttribute(
    'aria-hidden',
    'true'
  );
});

test('a partially visible footer does not pull a short page down on load', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/music');
  await expect(page.locator('html')).toHaveAttribute('data-footer-motion', '');
  await expect(page.locator('html')).toHaveCSS('scroll-snap-type', 'none');
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
