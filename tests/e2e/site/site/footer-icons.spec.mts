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
        if (route === '/')
          await expect(page.locator('.site-footer')).toHaveAttribute(
            'data-dock',
            ''
          );
        await page.evaluate(() => document.fonts.ready);
        await expect
          .poll(async () => {
            await page.evaluate(async () => {
              window.scrollTo(0, document.documentElement.scrollHeight);
              await new Promise(requestAnimationFrame);
              await new Promise(requestAnimationFrame);
            });
            return page.evaluate(() => ({
              remaining: Math.round(
                document.documentElement.scrollHeight - innerHeight - scrollY
              ),
              // Reflow can extend the document after the first bottom frame.
              expanded:
                !document.querySelector('.site-footer[data-dock]') ||
                getComputedStyle(document.querySelector('.site-footer__pages')!)
                  .opacity === '1',
            }));
          })
          .toEqual({ remaining: 0, expanded: true });
        if (route === '/') {
          await expect(page.locator('.site-footer')).toHaveCSS('--p', '1.0000');
          await expect(page.locator('.site-footer__wordmark')).toHaveCSS(
            'opacity',
            '1'
          );
          await expect(page.locator('.site-footer__pages')).toHaveCSS(
            'opacity',
            '1'
          );
        }
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
          const artwork = await icon.evaluate((svg) => {
            const edges = [...svg.querySelectorAll('path')].flatMap((path) => {
              const bounds = path.getBBox();
              const matrix = path.getScreenCTM()!;
              const style = getComputedStyle(path);
              const stroke =
                style.stroke === 'none' ? 0 : parseFloat(style.strokeWidth) / 2;
              return [
                new DOMPoint(bounds.x - stroke, bounds.y - stroke),
                new DOMPoint(
                  bounds.x + bounds.width + stroke,
                  bounds.y + bounds.height + stroke
                ),
              ].map((point) => point.matrixTransform(matrix));
            });
            const left = Math.min(...edges.map((point) => point.x));
            const right = Math.max(...edges.map((point) => point.x));
            const top = Math.min(...edges.map((point) => point.y));
            const bottom = Math.max(...edges.map((point) => point.y));
            const canvas = svg.getBoundingClientRect();
            return {
              size: Math.max(right - left, bottom - top),
              offsetX: (left + right) / 2 - (canvas.left + canvas.right) / 2,
              offsetY: (top + bottom) / 2 - (canvas.top + canvas.bottom) / 2,
            };
          });
          expect(
            artwork.size,
            await icon.evaluate((svg) => svg.closest('a')?.textContent)
          ).toBeCloseTo(20, 0);
          expect(Math.abs(artwork.offsetX)).toBeLessThan(0.2);
          expect(Math.abs(artwork.offsetY)).toBeLessThan(0.2);
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
