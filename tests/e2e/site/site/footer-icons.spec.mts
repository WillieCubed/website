import { expect, test } from '@playwright/test';

for (const width of [390, 576, 1440]) {
  for (const deviceScaleFactor of [1, 2]) {
    test(`footer icons stay native-sized at ${width}px and ${deviceScaleFactor}x`, async ({
      browser,
      baseURL,
    }, info) => {
      const context = await browser.newContext({
        baseURL,
        viewport: { width, height: width < 840 ? 844 : 1000 },
        deviceScaleFactor,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      for (const route of ['/', '/colophon']) {
        await page.goto(route);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() =>
          window.scrollTo(0, document.documentElement.scrollHeight)
        );
        if (route === '/')
          await expect(page.locator('.site-footer')).toHaveCSS('--p', '1.0000');
        for (const icon of await page
          .locator('.site-footer__profiles a > svg')
          .all()) {
          if (!(await icon.isVisible())) continue;
          await expect(icon).toHaveCSS('width', '24px');
          await expect(icon).toHaveCSS('height', '24px');
          await expect(icon).toHaveCSS('scale', 'none');
          const box = await icon.boundingBox();
          expect(box!.width).toBe(24);
          expect(box!.height).toBe(24);
        }
        await page.screenshot({
          path: info.outputPath(
            `${route.slice(1) || 'home'}-${width}-${deviceScaleFactor}x.png`
          ),
        });
      }
      await context.close();
    });
  }
}
