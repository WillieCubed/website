import { expect, test } from '@playwright/test';

import { waitForHomeDetailHydration } from '../../../support/home/hydration.mts';

test('the opening morph retains the decoded tile image while a larger candidate is pending', async ({
  page,
}) => {
  await page.goto('/');
  await waitForHomeDetailHydration(page);
  const product = page.locator('[data-product="docket"]');
  await product.scrollIntoViewIfNeeded();
  const source = await product
    .locator('img')
    .evaluate(async (image: HTMLImageElement) => {
      await image.decode();
      return image.currentSrc;
    });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/_next/image?**', async (route) => {
    if (route.request().url() !== source) await pending;
    await route.continue().catch(() => undefined);
  });
  await page.evaluate(() => {
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = (options) => {
      const update = typeof options === 'function' ? options : options?.update;
      return start(async () => {
        await update?.();
        const image = document.querySelector<HTMLImageElement>(
          'dialog.detail [data-morph="docket"]'
        );
        document.documentElement.dataset.morphBitmap = JSON.stringify({
          complete: image?.complete,
          width: image?.naturalWidth,
          source: image?.currentSrc,
        });
      });
    };
  });
  try {
    await product.click();
    await expect
      .poll(() => page.locator('html').getAttribute('data-morph-bitmap'))
      .toBeTruthy();
    const bitmap = JSON.parse(
      (await page.locator('html').getAttribute('data-morph-bitmap'))!
    );
    expect(bitmap.complete).toBe(true);
    expect(bitmap.width).toBeGreaterThan(0);
    expect(bitmap.source).toBe(source);
  } finally {
    release();
  }
  await expect(page.locator('dialog.detail')).toBeVisible();
});
