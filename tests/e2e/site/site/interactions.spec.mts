import { expect, test } from '@playwright/test';

import { scrollToExpandedFooter } from './page-surface-geometry.mts';

const appearances = ['light', 'dark'] as const;
const motions = ['no-preference', 'reduce'] as const;
const layouts = appearances.flatMap((colorScheme) =>
  [390, 1440].flatMap((width) =>
    motions.map((reducedMotion) => ({ colorScheme, width, reducedMotion }))
  )
);

for (const layout of layouts) {
  test(`public action targets stay stable: ${layout.width} ${layout.colorScheme} ${layout.reducedMotion}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({
      width: layout.width,
      height: layout.width < 840 ? 844 : 1000,
    });
    await page.emulateMedia(layout);
    await page.route('**/api/status', (route) =>
      route.fulfill({
        json: {
          location: {
            city: 'Las Vegas',
            region: 'Nevada',
            country: 'United States',
            timezone: 'America/Los_Angeles',
            updatedAt: null,
          },
          weather: {
            temperature: 72,
            unit: 'F',
            code: 0,
            isDay: true,
            observedAt: new Date().toISOString(),
          },
        },
      })
    );
    for (const [route, selector, pressed] of [
      ['/', '.palette-trigger[data-control-size="medium"]', '12px'],
      ['/search', '#main form button[type="submit"]', '8px'],
      ['/brand', '.brand-more-formats', '8px'],
      ['/status', 'button.weather-reading', '8px'],
      ['/writings', '.site-breadcrumb-menu-trigger', '8px'],
      ['/writings', '.feeds-button', '8px'],
    ]) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('html')).toHaveAttribute(
        'data-footer-motion',
        ''
      );
      const target = page.locator(selector).first();
      await target.scrollIntoViewIfNeeded();
      await page.keyboard.press('Tab');
      await target.focus();
      await expect(target).toHaveCSS('outline-width', '3px');
      if (selector === '.feeds-button') {
        // Focus can bring a below-the-fold footer into its sheet state.
        // Measure press stability only after that scroll-driven reflow ends.
        await scrollToExpandedFooter(page);
      }
      const initial = (await target.boundingBox())!;
      expect(initial.width).toBeGreaterThanOrEqual(48);
      expect(initial.height).toBeGreaterThanOrEqual(
        pressed === '12px' ? 56 : 48
      );
      const restingRadius = await target.evaluate(
        (el) => getComputedStyle(el).borderRadius
      );
      if (selector === '.feeds-button') {
        expect(restingRadius).toBe('24px');
        expect(initial.height).toBe(48);
        if (layout.width < 600) expect(initial.width).toBe(48);
      }
      await page.mouse.move(
        initial.x + initial.width / 2,
        initial.y + initial.height / 2
      );
      await page.mouse.down();
      try {
        await expect(target).toHaveCSS('border-radius', pressed);
        expect(await target.boundingBox()).toEqual(initial);
        if (layout.reducedMotion === 'reduce')
          await expect(target).toHaveCSS('transition-duration', '0s');
        if (route === '/search')
          await page.screenshot({
            path: testInfo.outputPath('search-held.png'),
          });
      } finally {
        // Release away from the target to inspect feedback without activation.
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }
      await expect(target).toHaveCSS('border-radius', restingRadius);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true);
    }
  });
}

test('native search retains its action states without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await page.goto('/search');
    const target = page.locator('#main form button[type="submit"]');
    await page.keyboard.press('Tab');
    await target.focus();
    await expect(target).toHaveCSS('outline-width', '3px');
    await page.getByRole('searchbox').fill('music');
    await target.click();
    await expect(page).toHaveURL(/\/search\?q=music/);
  } finally {
    await context.close();
  }
});
