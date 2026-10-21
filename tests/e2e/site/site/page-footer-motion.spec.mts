import { type Page, expect, test } from '@playwright/test';

const routes = ['/', '/colophon', '/writings', '/music'];

async function scrollToFooter(page: Page, remaining = 0) {
  await expect
    .poll(async () => {
      const expected = await page.evaluate((fraction) => {
        const footer = document.querySelector('.site-footer')!;
        const height = footer.getBoundingClientRect().height;
        const end = Math.max(
          0,
          document.documentElement.scrollHeight - innerHeight
        );
        const remaining = Math.min(height, end) * fraction;
        window.scrollTo(0, end - remaining);
        return 1 - remaining / height;
      }, remaining);
      const actual = await page
        .locator('html')
        .evaluate((el) => Number(el.style.getPropertyValue('--footer-p')));
      return Math.abs(actual - expected);
    })
    .toBeLessThan(0.01);
}

for (const width of [390, 1440, 1920]) {
  test(`page sheet animates consistently across routes at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width < 840 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    let expanded: unknown;
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('html')).toHaveAttribute(
        'data-footer-motion',
        ''
      );
      await page.evaluate(() => document.fonts.ready);
      const footer = page.locator('.site-footer');
      if (route === '/') await expect(footer).toHaveAttribute('data-dock', '');
      else await expect(footer).not.toHaveAttribute('data-dock');
      const surface = page.locator('body > .grow');
      const canScroll = await page.evaluate(
        () => document.documentElement.scrollHeight > innerHeight + 1
      );
      if (!canScroll) {
        await expect(page.locator('html')).toHaveAttribute(
          'data-footer-static',
          ''
        );
        await expect(surface).toHaveCSS('scale', 'none');
        expect(
          await surface.evaluate((el) => getComputedStyle(el).clipPath)
        ).not.toBe('none');
        await page.screenshot({
          path: testInfo.outputPath(`${route.slice(1)}-${width}-static.png`),
        });
        continue;
      }
      await expect(page.locator('html')).not.toHaveAttribute(
        'data-footer-sheet'
      );
      await scrollToFooter(page, 0.8);
      await expect(page.locator('html')).toHaveAttribute(
        'data-footer-sheet',
        ''
      );
      const partial = await surface.evaluate((el) =>
        Number(getComputedStyle(el).scale)
      );
      expect(partial).toBeLessThan(1);
      await scrollToFooter(page);
      const endpoint = await surface.evaluate((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          scale: s.scale,
          clip: s.clipPath,
          left: Math.round(r.left * 10) / 10,
          right: Math.round(r.right * 10) / 10,
        };
      });
      expect(Number(endpoint.scale)).toBeLessThan(partial);
      expect(endpoint.clip).not.toBe('none');
      if (route === '/') expanded = endpoint;
      else
        expect(endpoint, `${route} shares the homepage sheet endpoint`).toEqual(
          expanded
        );
      // The homepage's letter springs finish after the sheet reaches its edge.
      await expect
        .poll(() =>
          page.evaluate(() =>
            'highlights' in CSS
              ? [...CSS.highlights.values()]
                  .flatMap((stage) => [...stage])
                  .filter((range) =>
                    range.startContainer.parentElement?.closest('.site-footer')
                  ).length
              : 0
          )
        )
        .toBe(0);
      await page.screenshot({
        path: testInfo.outputPath(`${route.slice(1) || 'home'}-${width}.png`),
        animations: 'disabled',
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.locator('html')).not.toHaveAttribute(
        'data-footer-sheet'
      );
      await expect(surface).toHaveCSS('scale', 'none');
    }
  });
}

test('reduced motion keeps rounded page endings without scaling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute(
      'data-footer-motion',
      ''
    );
    await scrollToFooter(page);
    const surface = page.locator('body > .grow');
    await expect(surface).toHaveCSS('scale', 'none');
    expect(
      await surface.evaluate((el) => getComputedStyle(el).clipPath)
    ).not.toBe('none');
    await expect(page.locator('.site-footer__pages')).not.toHaveAttribute(
      'inert'
    );
  }
});

test('sheet state follows client navigation between home and content pages', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.site-footer')).toHaveAttribute('data-dock', '');
  await scrollToFooter(page);
  await page
    .locator('.site-footer__pages')
    .getByRole('link', { name: 'Colophon', exact: true })
    .click();
  await expect(page).toHaveURL(/\/colophon$/);
  await expect(page.locator('html')).toHaveAttribute('data-footer-motion', '');
  await expect(page.locator('.site-footer')).not.toHaveAttribute('data-dock');
  await expect(page.locator('html')).not.toHaveAttribute('data-footer-sheet');
  await scrollToFooter(page);
  await expect(page.locator('html')).toHaveAttribute('data-footer-sheet', '');
  await page
    .locator('.site-footer__pages')
    .getByRole('link', { name: 'Writings', exact: true })
    .click();
  await expect(page).toHaveURL(/\/writings$/);
  const canScroll = await page.evaluate(
    () => document.documentElement.scrollHeight > innerHeight + 1
  );
  if (canScroll)
    await expect(page.locator('html')).not.toHaveAttribute('data-footer-sheet');
  else
    await expect(page.locator('html')).toHaveAttribute(
      'data-footer-static',
      ''
    );
  await scrollToFooter(page);
  await expect(page.locator('html')).toHaveAttribute('data-footer-sheet', '');
  await page
    .locator('.site-footer__pages')
    .getByRole('link', { name: 'Colophon', exact: true })
    .click();
  await expect(page).toHaveURL(/\/colophon$/);
  await expect(page.locator('html')).not.toHaveAttribute('data-footer-static');
  await expect(page.locator('html')).not.toHaveAttribute('data-footer-sheet');
  await page
    .locator('header')
    .getByRole('link', { name: 'Willie Chalmers III', exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.site-footer')).toHaveAttribute('data-dock', '');
  await expect(page.locator('html')).not.toHaveAttribute('data-footer-static');
});

test('a short page keeps its initial content and footer available', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1600 });
  await page.goto('/search');
  await expect(page.locator('html')).toHaveAttribute('data-footer-motion', '');
  await expect(page.locator('body > .grow')).toHaveCSS('scale', 'none');
  await expect(page.locator('html')).toHaveAttribute('data-footer-static', '');
  await expect(page.locator('.site-footer__pages')).not.toHaveAttribute(
    'inert'
  );
});

test('pages and footer links remain available without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('html')).not.toHaveAttribute(
      'data-footer-motion'
    );
    await page.locator('.site-footer__pages').scrollIntoViewIfNeeded();
    await expect(
      page
        .locator('.site-footer__pages')
        .getByRole('link', { name: 'Colophon', exact: true })
    ).toBeVisible();
    await expect(page.locator('body > .grow')).toHaveCSS('scale', 'none');
  }
  await context.close();
});
