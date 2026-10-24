import { expect, test } from '@playwright/test';

test.skip(
  process.env.STUDIO_E2E !== '1',
  'The complete tour remains an authenticated draft.'
);

const root = '/initiatives/fall-tour-2026';
const paths = [root, ...[1, 2, 3, 4].map((part) => `${root}/part-${part}`)];

test('Fall Tour renders every chapter with readable content and loaded viewport media', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [index, path] of paths.entries()) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const main = page.locator('main');
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() =>
        main.locator('img').evaluateAll((images) =>
          images
            .filter((image) => {
              const rect = image.getBoundingClientRect();
              return rect.top < innerHeight && rect.bottom > 0;
            })
            .every(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0
            )
        )
      )
      .toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    if (index === 0 && info.project.name.startsWith('phone')) {
      const chapters = main.locator('.playbill--full h3');
      for (const chapter of [chapters.nth(0), chapters.nth(1)]) {
        const bounds = await chapter.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
          await page.evaluate(() => innerHeight)
        );
      }
    }
    await page.screenshot({
      path: info.outputPath(`tour-${index}-viewport.png`),
    });
    await page.screenshot({
      path: info.outputPath(`tour-${index}-full.png`),
      fullPage: true,
    });
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    if (index === 0 && info.project.name.startsWith('phone')) {
      await page.screenshot({
        path: info.outputPath('overview-large-text.png'),
      });
      await page.screenshot({
        path: info.outputPath('overview-large-text-full.png'),
        fullPage: true,
      });
    }
  }
  await page.goto(`${root}/part-2`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A Staycation with Friends from Unlikely Places'
  );
  await expect(page.locator('main')).toContainText('New York City Marathon');
  await expect(page.locator('main')).not.toContainText(
    /Columbus|Cleveland|Boston/
  );
  if (info.project.name.startsWith('desktop')) {
    await page.reload();
    for (const width of [768, 840, 1024]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth)
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: info.outputPath(`part-2-${width}-viewport.png`),
      });
    }
  }
});

test('Fall Tour keeps chapter artwork and complete navigation in server HTML', async ({
  browser,
  baseURL,
}, info) => {
  const context = await browser.newContext({
    baseURL,
    viewport: info.project.use.viewport,
    colorScheme: info.project.use.colorScheme,
    hasTouch: info.project.use.hasTouch,
    javaScriptEnabled: false,
    extraHTTPHeaders: {
      'cf-access-jwt-assertion': process.env.STUDIO_TEST_TOKEN || '',
    },
  });
  try {
    const page = await context.newPage();
    await page.goto(root);
    const chapters = page.locator('.playbill--full');
    await expect(chapters.locator('img')).toHaveCount(4);
    await chapters.locator(`a[href="${root}/part-1"]`).click();
    await expect(page).toHaveURL(new RegExp(`${root}/part-1$`));
    await page.getByRole('link', { name: /^Part 2/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'A Staycation with Friends from Unlikely Places'
    );
    await page.getByRole('link', { name: 'All of Fall Tour 2026' }).click();
    await expect(page).toHaveURL(new RegExp(`${root}$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${root}/part-2$`));
  } finally {
    await context.close();
  }
});
