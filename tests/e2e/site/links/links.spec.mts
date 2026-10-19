import { expect, test } from '@playwright/test';

test('a registry response after hover ends cannot reopen a preview', async ({
  page,
}) => {
  let releaseRegistry!: () => void;
  const registryReady = new Promise<void>((resolve) => {
    releaseRegistry = resolve;
  });
  await page.route('**/entities.json', async (route) => {
    await registryReady;
    await route.continue();
  });
  await page.goto('/');
  const link = page.locator('.p-note').getByRole('link', {
    name: 'Las Vegans for Better Transit',
  });
  const requested = page.waitForRequest('**/entities.json');
  await link.hover();
  await requested;
  await page.mouse.move(0, 0);
  const responded = page.waitForResponse('**/entities.json');
  releaseRegistry();
  await (await responded).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  await expect(page.locator('.link-preview:popover-open')).toHaveCount(0);
  await link.hover();
  await expect(page.locator('.link-preview:popover-open')).toContainText(
    'Las Vegans for Better Transit'
  );
});

test('a headline venture shows its card on hover and on keyboard focus', async ({
  page,
}) => {
  await page.goto('/');
  const link = page
    .locator('.p-note')
    .getByRole('link', { name: 'Las Vegans for Better Transit' });
  const card = page.locator('.link-preview:popover-open');

  await link.hover();
  await expect(card).toContainText('Las Vegans for Better Transit');

  await page.mouse.move(0, 0);
  await expect(card).toHaveCount(0);

  await page.keyboard.press('Tab');
  await link.focus();
  await expect(card).toContainText('Las Vegans for Better Transit');
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
});

test('preview text lines up with its link when the viewport has room', async ({
  page,
}, testInfo) => {
  await page.goto('/colophon');
  const link = page.locator('.colophon-publishing a[href="/writings"]');
  const card = page.locator('.link-preview:popover-open');
  for (const width of [1440, 600]) {
    await page.setViewportSize({ width, height: 1000 });
    await link.hover();
    await expect(card).toBeVisible();
    const anchor = (await link.boundingBox())!;
    for (const selector of ['.link-preview__title', '.link-preview__desc']) {
      const text = (await card.locator(selector).boundingBox())!;
      expect(
        Math.abs(text.x - anchor.x),
        JSON.stringify({
          selector,
          width,
          text,
          anchor,
          viewport: await page.evaluate(() => ({
            clientLeft: document.documentElement.clientLeft,
            innerWidth,
            clientWidth: document.documentElement.clientWidth,
          })),
        })
      ).toBeLessThan(1);
    }
    if (width === 1440) {
      await expect(card).toHaveCSS('opacity', '1');
      await page.screenshot({
        path: testInfo.outputPath('preview-desktop.png'),
      });
    }
    await page.keyboard.press('Escape');
  }
  await page.keyboard.press('Tab');
  await link.focus();
  await expect(card).toBeVisible();
  const anchor = (await link.boundingBox())!;
  const title = (await card.locator('.link-preview__title').boundingBox())!;
  expect(Math.abs(title.x - anchor.x)).toBeLessThan(1);
});

test('preview alignment preserves viewport gutters at both edges', async ({
  page,
}, testInfo) => {
  await page.goto('/colophon');
  const link = page.locator('.colophon-publishing a[href="/writings"]');
  const card = page.locator('.link-preview:popover-open');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    // Put a real preview-enabled link at each boundary to exercise clamping.
    for (const edge of ['left', 'right']) {
      await link.evaluate((element, edge) => {
        Object.assign((element as HTMLElement).style, {
          position: 'fixed',
          top: '100px',
          left: edge === 'left' ? '16px' : 'auto',
          right: edge === 'right' ? '16px' : 'auto',
        });
      }, edge);
      await link.hover();
      await expect(card).toBeVisible();
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(16);
      expect(box.x + box.width).toBeLessThanOrEqual(width - 16);
      const title = (await card.locator('.link-preview__title').boundingBox())!;
      const description = (await card
        .locator('.link-preview__desc')
        .boundingBox())!;
      expect(title.x).toBe(description.x);
      await page.keyboard.press('Escape');
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await link.hover();
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS('opacity', '1');
  await page.screenshot({ path: testInfo.outputPath('preview-phone.png') });
});
