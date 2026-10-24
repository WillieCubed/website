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
    const header = await page.locator('header[data-column]').boundingBox();
    const frame = await main.boundingBox();
    expect(header).not.toBeNull();
    expect(frame).not.toBeNull();
    expect(header!.x).toBeCloseTo(frame!.x, 0);
    expect(header!.width).toBeCloseTo(frame!.width, 0);
    await page.evaluate(() => document.fonts.ready);
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    const currentLabel = breadcrumb.locator(
      '.site-breadcrumbs__crumb:last-child .site-breadcrumb-menu__label'
    );
    await expect(currentLabel).toHaveText(
      index === 0 ? 'Fall Tour 2026' : `Part ${index}`
    );
    expect(
      await currentLabel.evaluate(
        (node) => node.scrollWidth <= node.clientWidth + 1
      )
    ).toBe(true);
    expect(
      await breadcrumb
        .locator(':scope > div')
        .evaluateAll(
          (items) =>
            items.filter((item) => item.getBoundingClientRect().width > 0)
              .length
        )
    ).toBeLessThanOrEqual(4);
    const search = await page.locator('.site-topbar-search').boundingBox();
    expect(search!.x + search!.width).toBeCloseTo(
      header!.x + header!.width - 16,
      0
    );

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
      const artwork = main.locator('.initiative-trailer figure');
      const bounds = await artwork.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeGreaterThan(300);
      expect(bounds!.height).toBeGreaterThan(260);
      const hero = await main.locator('.initiative-introduction').boundingBox();
      expect(hero!.height).toBeGreaterThan(
        info.project.use.viewport!.height * 0.65
      );
      expect(bounds!.y).toBeLessThan(await page.evaluate(() => innerHeight));
    }
    await expect(page.locator('.site-private-indicator')).toHaveCount(0);
    await expect(main.getByText('Draft', { exact: true })).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath(`tour-${index}-viewport.png`),
    });
    await page.screenshot({
      path: info.outputPath(`tour-${index}-full.png`),
      fullPage: true,
    });
    const originals = await main
      .locator('h1, h2, h3, p, li')
      .evaluateAll((nodes) => {
        const sizes = nodes.map((node) => ({
          node,
          size: parseFloat(getComputedStyle(node).fontSize),
          height: parseFloat(getComputedStyle(node).lineHeight),
        }));
        for (const { node, size, height } of sizes) {
          const element = node as HTMLElement;
          element.style.fontSize = `${size * 2}px`;
          if (Number.isFinite(height))
            element.style.lineHeight = `${height * 2}px`;
        }
        return sizes.map(({ size }) => size);
      });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
    const enlarged = await main
      .locator('h1, h2, h3, p, li')
      .evaluateAll((nodes) =>
        nodes.map((node) => parseFloat(getComputedStyle(node).fontSize))
      );
    expect(enlarged.length).toBeGreaterThan(0);
    expect(enlarged.length).toBe(originals.length);
    expect(enlarged).toEqual(
      originals.map((size) => expect.closeTo(size * 2, 1))
    );
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
    await expect(chapters.locator('img')).toHaveCount(0);
    await expect(page.locator('main img')).toHaveCount(1);
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
