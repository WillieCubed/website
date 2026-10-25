import { expect, test } from '@playwright/test';

test.skip(
  process.env.STUDIO_E2E !== '1',
  'The complete tour remains an authenticated draft.'
);

const root = '/initiatives/fall-tour-2026';
const paths = [root, ...[1, 2, 3, 4].map((part) => `${root}/part-${part}`)];

test('part navigation uses full-width text links and one page-to-footer gap', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const part of [1, 3, 4]) {
    await page.goto(`${root}/part-${part}`);
    await expect(page.locator('html')).toHaveAttribute(
      'data-footer-motion',
      ''
    );
    const nav = page.getByRole('navigation', {
      name: 'Fall Tour 2026 navigation',
    });
    const links = nav.getByRole('link');
    await expect(links).toHaveCount(part === 3 ? 2 : 1);
    await expect(nav.getByText(/All of/)).toHaveCount(0);
    await expect(nav.getByRole('button')).toHaveCount(0);
    expect(await nav.textContent()).not.toMatch(/[←→]/);
    const boxes = await links.evaluateAll((nodes) =>
      nodes.map((node) => {
        const { x, y, width, height, bottom } = node.getBoundingClientRect();
        return { x, y, width, height, bottom };
      })
    );
    for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(48);
    expect(await links.locator('svg').count()).toBe(boxes.length);
    const frame = await page.locator('main').evaluate((node) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        left: box.left + parseFloat(style.paddingLeft),
        right: box.right - parseFloat(style.paddingRight),
      };
    });
    expect(boxes[0].x).toBeCloseTo(frame.left, 0);
    expect(boxes[0].x + boxes[0].width).toBeCloseTo(frame.right, 0);
    if (boxes.length === 2) {
      expect(boxes[0].x).toBeCloseTo(boxes[1].x, 0);
      expect(boxes[0].width).toBeCloseTo(boxes[1].width, 0);
      expect(boxes[1].y - boxes[0].bottom).toBeCloseTo(8, 0);
    }
    const footer = await page.locator('.site-footer').boundingBox();
    expect(footer!.y - boxes.at(-1)!.bottom).toBeCloseTo(8, 0);
    if (part === 3) {
      await nav.evaluate((node) => node.scrollIntoView({ block: 'center' }));
      await page.screenshot({
        path: info.outputPath('part-navigation-viewport.png'),
      });
    }
  }
});

test('part footer spacing follows navigation and history without leaking from hidden pages', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${root}/part-3`);
  const sheet = page.locator('body > .grow');
  await expect(sheet).toHaveCSS('padding-bottom', '8px');
  await page
    .locator('.site-footer__pages')
    .getByRole('link', { name: 'Colophon' })
    .click();
  await expect(page).toHaveURL(/\/colophon$/);
  await expect(sheet).toHaveCSS('padding-bottom', '40px');
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${root}/part-3$`));
  await expect(sheet).toHaveCSS('padding-bottom', '8px');
  await page.goForward();
  await expect(page).toHaveURL(/\/colophon$/);
  await expect(sheet).toHaveCSS('padding-bottom', '40px');
});

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
    const lastPartLink = await page.locator('.part-nav a').last().boundingBox();
    const footer = await page.locator('.site-footer').boundingBox();
    expect(footer!.y - lastPartLink!.y - lastPartLink!.height).toBeCloseTo(
      8,
      0
    );
    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    const parent = breadcrumbs.getByRole('button', {
      name: 'Open menu for Fall Tour 2026',
      exact: true,
    });
    if (await parent.isVisible()) await parent.click();
    else
      await breadcrumbs
        .getByRole('button', { name: 'Pages above this one', exact: true })
        .click();
    await expect(breadcrumbs.locator('.site-popover:popover-open')).toHaveCSS(
      'transform',
      'none'
    );
    await breadcrumbs
      .getByRole('link', { name: 'Fall Tour 2026', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${root}$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${root}/part-2$`));
  } finally {
    await context.close();
  }
});
