import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import kit from '../../lib/brand/kit.json' with { type: 'json' };

test('brand downloads, navigation, and disclosures work', async ({ page }) => {
  await page.goto('/brand');
  const downloads = await page
    .locator('a[download]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  const expectedDownloads = [
    kit.archive,
    ...kit.tokens,
    ...kit.marks.flatMap((mark) => mark.downloads),
    ...kit.lockups.flatMap((lockup) => lockup.downloads),
    ...kit.appIcons.flatMap((icon) => icon.downloads),
    ...kit.platforms.flatMap((group) => group.files),
  ];
  for (const file of expectedDownloads) expect(downloads).toContain(file.href);
  await page
    .getByRole('button', { name: 'Brand sections', exact: true })
    .click();
  await expect(
    page.getByRole('navigation', { name: 'Brand sections' }).getByRole('link')
  ).toHaveCount(4);

  const mark = page.locator('figure').filter({
    has: page.getByRole('heading', { name: 'The cube', exact: true }),
  });
  await expect(
    mark.getByRole('link', { name: 'Download PNG', exact: true })
  ).toHaveAttribute('href', '/brand/mark/png/williecubed-mark-1024.png');
  await expect(
    mark.getByRole('link', { name: 'PDF', exact: true })
  ).not.toBeVisible();
  await mark.getByRole('button', { name: 'More formats', exact: true }).click();
  await expect(
    mark.getByRole('link', { name: 'PDF', exact: true })
  ).toBeVisible();
  await expect(
    mark.getByRole('link', { name: 'PNG 2048', exact: true })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Brand sections', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Brand sections' })
    .getByRole('link', { name: 'Colors', exact: true })
    .click();
  await expect(page).toHaveURL(/#color$/);
  await expect(page.locator('#color')).toBeFocused();
  await page
    .getByRole('button', { name: 'Brand sections', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.brand-section-menu')).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Brand sections', exact: true })
  ).toBeFocused();

  const platform = page.locator('.brand-platform').filter({
    has: page.locator('summary[aria-label="Web and PWA: browse files"]'),
  });
  await expect(
    platform.getByRole('link', { name: /favicon.svg/ })
  ).not.toBeVisible();
  await platform.locator('summary').click();
  await expect(
    platform.getByRole('link', { name: /favicon.svg/ })
  ).toBeVisible();
});

for (const succeeds of [true, false]) {
  test(`hex copy ${succeeds ? 'succeeds' : 'fails accessibly'}`, async ({
    page,
  }) => {
    await page.addInitScript((ok) => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (value: string) => {
            if (!ok) throw new Error('Clipboard unavailable');
            document.documentElement.dataset.copied = value;
          },
        },
      });
    }, succeeds);
    await page.goto('/brand');
    const button = page.getByRole('button', {
      name: 'Copy Accent green hex value',
    });
    await button.click();
    await expect(button).toBeFocused();
    const swatch = page.locator('.brand-swatch').first();
    await expect(swatch.getByRole('status')).toHaveText(
      succeeds
        ? 'Copied'
        : 'Could not copy. Select the hex value and copy it manually.'
    );
    await expect(swatch.locator('code').first()).toHaveText('#2f6f5e');
    if (succeeds)
      await expect(page.locator('html')).toHaveAttribute(
        'data-copied',
        '#2f6f5e'
      );
  });
}

for (const width of [320, 390, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`brand is accessible at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/brand');
      const headerCenters = await page
        .locator('.brand-header header > *')
        .evaluateAll((elements) =>
          elements.map((element) => {
            const box = element.getBoundingClientRect();
            return box.top + box.height / 2;
          })
        );
      expect(
        Math.max(...headerCenters) - Math.min(...headerCenters)
      ).toBeLessThan(2);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(violations).toEqual([]);
      await page
        .getByRole('button', { name: 'Brand sections', exact: true })
        .focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.brand-section-menu')).toHaveCSS(
        'opacity',
        '1'
      );
      const openPicker = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(openPicker.violations).toEqual([]);
      await page
        .getByRole('navigation', { name: 'Brand sections' })
        .getByRole('link')
        .first()
        .focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#mark$/);
    });
  }
}

for (const deviceScaleFactor of [1, 2, 3]) {
  test(`glass previews retain detail at ${deviceScaleFactor}x`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor,
    });
    const page = await context.newPage();
    await page.goto(
      new URL('/brand#app-icon', testInfo.project.use.baseURL).href
    );
    const images = page.locator('.brand-app-icon');
    await expect(images).toHaveCount(3);
    const measurements = [];
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
          )
        )
        .toBe(true);
      const data = await image.evaluate((img: HTMLImageElement) => ({
        src: img.currentSrc,
        width: img.getBoundingClientRect().width,
        height: img.getBoundingClientRect().height,
        alt: img.alt,
      }));
      expect(data.width).toBe(160);
      expect(data.height).toBe(160);
      const url = new URL(data.src);
      expect(Number(url.searchParams.get('w'))).toBeGreaterThanOrEqual(
        160 * deviceScaleFactor
      );
      expect(url.searchParams.get('q')).toBe('90');
      const response = await context.request.get(data.src, {
        headers: { Accept: 'image/webp' },
      });
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toBe('image/webp');
      const original = await context.request.get(
        new URL(url.searchParams.get('url')!, data.src).href
      );
      const master = await original.body();
      expect(master.readUInt32BE(16)).toBe(1024);
      expect(master.readUInt32BE(20)).toBe(1024);
      measurements.push({
        ...data,
        optimizedBytes: (await response.body()).length,
        originalBytes: master.length,
      });
    }
    await testInfo.attach('image-delivery', {
      body: JSON.stringify(measurements, null, 2),
      contentType: 'application/json',
    });
    console.log(`Glass ${deviceScaleFactor}x: ${JSON.stringify(measurements)}`);
    await page.screenshot({
      path: testInfo.outputPath(`glass-${deviceScaleFactor}x.png`),
    });
    await context.close();
  });
}

for (const width of [390, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`brand screenshots at ${width}px in ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/brand');
      await page.evaluate(() => document.fonts.ready);
      for (const [name, hash] of [
        ['intro', ''],
        ['downloads', '#mark'],
        ['colors', '#color'],
        ['type', '#type'],
        ['glass', '#app-icon'],
        ['usage', '#usage'],
      ] as const) {
        await page.goto(`/brand${hash}`);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          'WillieCubed brand'
        );
        await page.screenshot({
          path: testInfo.outputPath(`${name}-${width}-${colorScheme}.png`),
        });
      }
    });
  }
}
