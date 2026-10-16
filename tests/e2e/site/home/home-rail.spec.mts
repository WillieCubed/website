import { expect, test } from '@playwright/test';

test('the desktop rail clears the docked footer', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const footer = page.locator('footer.site-footer');
  await expect(footer).toHaveAttribute('data-dock', '');
  for (const [width, height] of [
    [840, 700],
    [840, 801],
    [840, 850],
    [1000, 700],
    [1000, 800],
    [1000, 801],
    [1000, 850],
    [1000, 900],
    [1000, 901],
    [1199, 850],
    [1200, 850],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    const gap = await page.evaluate(() => {
      const lastFocus = [...document.querySelectorAll('.focus')].at(-1);
      const contact = document.querySelector('.site-footer__row');
      if (!lastFocus || !contact)
        throw new Error('Rail or contact row missing');
      return (
        contact.getBoundingClientRect().top -
        lastFocus.getBoundingClientRect().bottom
      );
    });
    expect(gap, `${width}×${height} rail gap`).toBeGreaterThanOrEqual(12);
    // Narrow containers hide labels; the closed dock must retain their
    // icons so the four kept contact links still have visible targets.
    for (const link of await page
      .locator('.site-footer__profiles li:not([data-extra]) a')
      .all()) {
      await expect(link).toBeVisible();
      expect((await link.boundingBox())!.width).toBeGreaterThanOrEqual(16);
    }
  }
});

test('the closed footer name stays hidden while the headline is visible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 850 });
  await page.goto('/');
  await expect(page.locator('footer.site-footer')).toHaveAttribute(
    'data-dock',
    ''
  );
  await expect(page.locator('.site-footer__wordmark')).toHaveCSS(
    'opacity',
    '0'
  );

  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight })
  );
  await expect(page.locator('.site-footer__wordmark')).toHaveCSS(
    'opacity',
    '1'
  );
});
