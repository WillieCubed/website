import { type Locator, expect, test } from '@playwright/test';

import { scrollToExpandedFooter } from './page-surface-geometry.mts';

async function contentEdges(frame: Locator) {
  return frame.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      left: box.left + parseFloat(style.paddingLeft),
      right: box.right - parseFloat(style.paddingRight),
    };
  });
}

for (const width of [320, 390, 1440, 1920]) {
  test(`header, page, and footer share a responsive frame at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width < 840 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const route of ['/', '/status', '/colophon', '/brand', '/search']) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      const main = page.locator(route === '/' ? '.home .shell' : '#main');
      const header = page.locator('header[data-column]').first();
      const brand = page.locator('.site-footer__brand');
      await expect(page.locator('html')).toHaveAttribute(
        'data-footer-motion',
        ''
      );
      const initial = await contentEdges(main);
      const initiallyLifted = await page
        .locator('html')
        .evaluate((el) => el.hasAttribute('data-footer-sheet'));
      const before = await contentEdges(brand);
      expect(
        Math.abs(initial.left - before.left),
        `${route}: initial left edge`
      ).toBeLessThan(1);
      expect(
        Math.abs(initial.right - before.right),
        `${route}: initial right edge`
      ).toBeLessThan(1);
      if (route !== '/') {
        const top = await contentEdges(header);
        expect(
          Math.abs(top.left - initial.left),
          `${route}: header left`
        ).toBeLessThan(1);
        expect(
          Math.abs(top.right - initial.right),
          `${route}: header right`
        ).toBeLessThan(1);
      }
      const font = await page
        .locator('h1')
        .first()
        .evaluate((node) => getComputedStyle(node).fontSize);
      for (let i = 0; i < 4; i++) {
        await page.evaluate(async () => {
          document.documentElement.style.scrollSnapType = 'none';
          window.scrollTo(0, document.documentElement.scrollHeight);
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        });
      }
      await expect(page.locator('html')).toHaveAttribute(
        'data-footer-sheet',
        ''
      );
      const sheet = await page.locator('body > .grow').boundingBox();
      const stationary =
        (await page.locator('html').getAttribute('data-footer-static')) !==
        null;
      if (!stationary) expect(sheet!.x).toBeGreaterThan(0);
      const end = await contentEdges(main);
      const footer = await contentEdges(brand);
      const cube = (await page.locator('.site-footer__mark').boundingBox())!;
      const cubeTarget = (await page
        .locator('.site-footer__mark-button')
        .boundingBox())!;
      expect(
        Math.abs(cube.x - footer.left),
        `${route}: drawn cube follows the content edge`
      ).toBeLessThan(1);
      expect(cubeTarget.width).toBeGreaterThanOrEqual(48);
      expect(cubeTarget.height).toBeGreaterThanOrEqual(48);
      expect(
        Math.abs(end.left - footer.left),
        `${route}: expanded left edge`
      ).toBeLessThan(1);
      expect(
        Math.abs(end.right - footer.right),
        `${route}: expanded right edge`
      ).toBeLessThan(1);
      expect(end.left).toBeGreaterThanOrEqual(sheet!.x);
      expect(end.right).toBeLessThanOrEqual(sheet!.x + sheet!.width);
      if (width === 390 && !initiallyLifted) {
        expect(
          end.left,
          `${route}: content moves with the sheet`
        ).toBeGreaterThan(initial.left + 6);
        expect(end.right).toBeLessThan(initial.right - 6);
      }
      expect(
        await page
          .locator('h1')
          .first()
          .evaluate((node) => getComputedStyle(node).fontSize)
      ).toBe(font);
      await expect(page.locator('body > .grow')).toHaveCSS('scale', 'none');
      await page.screenshot({
        path: info.outputPath(`frame-${route.slice(1) || 'home'}-${width}.png`),
      });
    }
  });
}

test('surface narrowing stays settled when a long page reflows', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/writings');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('html')).toHaveAttribute('data-footer-motion', '');
  // Model a long document gaining height as its actual content width narrows.
  // A fixed scroll position must not alternate between wide and narrow layouts.
  await page.addStyleTag({
    content: `
    body > .grow { container-type: inline-size; }
    .surface-reflow-probe { height: calc((100vw - 100cqw) * 50); }
  `,
  });
  await page.locator('body > .grow').evaluate((surface) => {
    const probe = document.createElement('div');
    probe.className = 'surface-reflow-probe';
    surface.append(probe);
  });
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight)
  );
  await expect
    .poll(() =>
      page
        .locator('body > .grow')
        .evaluate((surface) => surface.getBoundingClientRect().left)
    )
    .toBe(8);
  const samples = await page.evaluate(async () => {
    const widths = [];
    for (let i = 0; i < 30; i++) {
      await new Promise(requestAnimationFrame);
      widths.push(
        document.querySelector('body > .grow')!.getBoundingClientRect().left
      );
    }
    return widths;
  });
  expect(
    samples.every((left) => left === 8),
    'sheet must not undo its own reflow'
  ).toBe(true);
});

test('resting-width measurement preserves the viewport at the end of a long page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/brand');
  await scrollToExpandedFooter(page);
  const before = await page.evaluate(() => scrollY);
  await page.locator('body > .grow').evaluate((surface) => {
    const addition = document.createElement('div');
    addition.style.height = '1px';
    surface.append(addition);
  });
  const positions = await page.evaluate(async () => {
    const positions = [];
    for (let i = 0; i < 30; i++) {
      await new Promise(requestAnimationFrame);
      positions.push(scrollY);
    }
    return positions;
  });
  for (const y of positions)
    expect(Math.abs(y - before)).toBeLessThanOrEqual(1);
  await scrollToExpandedFooter(page);
  const end = await page.locator('.site-footer').boundingBox();
  expect(end!.y + end!.height).toBeLessThanOrEqual(845);
});

for (const width of [390, 1440]) {
  test(`shared page frame aligns without JavaScript at ${width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: { width, height: 1000 },
    });
    const page = await context.newPage();
    for (const route of ['/status', '/colophon', '/brand', '/search']) {
      await page.goto(route);
      await page.screenshot();
      const main = await contentEdges(page.locator('#main'));
      const header = await contentEdges(
        page.locator('header[data-column]').first()
      );
      const footer = await contentEdges(page.locator('.site-footer__brand'));
      for (const edges of [header, footer]) {
        expect(Math.abs(main.left - edges.left), route).toBeLessThan(1);
        expect(Math.abs(main.right - edges.right), route).toBeLessThan(1);
      }
    }
    await context.close();
  });
}

test('active frame follows client navigation rather than retained hidden pages', async ({
  page,
}) => {
  await page.goto('/search');
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-page-column', 'reading');
  await page
    .getByRole('navigation', { name: 'Breadcrumb' })
    .getByRole('link', { name: 'Willie Chalmers III' })
    .click();
  await expect(page).toHaveURL('/');
  await expect(root).toHaveAttribute('data-page-column', 'home');
  await page
    .locator('.site-footer__pages')
    .getByRole('link', { name: 'Colophon', exact: true })
    .click();
  await expect(page).toHaveURL('/colophon');
  await expect(root).toHaveAttribute('data-page-column', 'content');
  const main = await contentEdges(page.locator('#main'));
  const footer = await contentEdges(page.locator('.site-footer__brand'));
  expect(Math.abs(main.left - footer.left)).toBeLessThan(1);
  expect(Math.abs(main.right - footer.right)).toBeLessThan(1);
});
