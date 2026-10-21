import { type Page, expect, test } from '@playwright/test';

async function showProgress(page: Page, p: number) {
  await page.evaluate((p) => {
    const footer = document.querySelector<HTMLElement>('.site-footer')!;
    window.scrollTo(
      0,
      document.documentElement.scrollHeight -
        innerHeight -
        footer.offsetHeight * (1 - p)
    );
  }, p);
  await expect
    .poll(() =>
      page
        .locator('.site-footer')
        .evaluate((el) => parseFloat(el.style.getPropertyValue('--p')))
    )
    .toBeCloseTo(p, 2);
}

for (const width of [390, 1440]) {
  test(`footer changes shape with opaque surfaces at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width < 840 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await expect(page.locator('.site-footer')).toHaveAttribute('data-dock', '');
    await page.evaluate(() => document.fonts.ready);
    await showProgress(page, 1);
    const opaque = await page
      .locator('.site-footer')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    let previousWidth = Infinity;
    let previousClip = '';
    for (const p of [0, 0.06, 0.2, 0.4, 1]) {
      await showProgress(page, p);
      await expect(page.locator('.site-footer')).toHaveCSS(
        'background-color',
        opaque
      );
      await expect(page.locator('body')).toHaveCSS('background-color', opaque);
      const shape = await page.locator('body > .grow').evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        clip: getComputedStyle(el).clipPath,
        opacity: getComputedStyle(el).opacity,
      }));
      expect(shape.opacity).toBe('1');
      if (p > 0 && p <= 0.4) {
        expect(shape.width).toBeLessThan(previousWidth);
        expect(shape.clip).not.toBe(previousClip);
      }
      previousWidth = shape.width;
      previousClip = shape.clip;
      await page.screenshot({
        path: info.outputPath(`shape-${width}-${p}.png`),
      });
    }
  });
}
