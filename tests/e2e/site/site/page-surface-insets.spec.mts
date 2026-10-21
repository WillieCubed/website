import { expect, test } from '@playwright/test';

for (const width of [390, 1920]) {
  test(`surface insets stay independent of page length and content width at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width < 840 ? 844 : 1152 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const route of [
      '/',
      '/colophon',
      '/status',
      '/media',
      '/writings',
      '/initiatives',
    ]) {
      await page.goto(route);
      await expect(page.locator('html')).toHaveAttribute(
        'data-footer-motion',
        ''
      );
      await page.evaluate(() => document.fonts.ready);
      await expect
        .poll(
          async () => {
            return page.evaluate(async () => {
              document.documentElement.style.scrollSnapType = 'none';
              window.scrollTo(0, document.documentElement.scrollHeight);
              await new Promise(requestAnimationFrame);
              await new Promise(requestAnimationFrame);
              const body = document.body.getBoundingClientRect();
              const sheet = document
                .querySelector('body > .grow')!
                .getBoundingClientRect();
              return {
                left: Math.round(sheet.left - body.left),
                right: Math.round(body.right - sheet.right),
              };
            });
          },
          {
            message: `${route}: the surface uses a viewport inset, independently of the content cap`,
          }
        )
        .toEqual({ left: width < 840 ? 8 : 16, right: width < 840 ? 8 : 16 });
      const geometry = await page.evaluate(() => {
        const edges = (selector: string) => {
          const node = document.querySelector(selector)!;
          const box = node.getBoundingClientRect();
          const css = getComputedStyle(node);
          return {
            left: box.left + parseFloat(css.paddingLeft),
            right: box.right - parseFloat(css.paddingRight),
          };
        };
        const sheet = document
          .querySelector('body > .grow')!
          .getBoundingClientRect();
        const cards = document
          .querySelector('.collection-items')
          ?.getBoundingClientRect();
        return {
          main: edges(
            document.querySelector('.home') ? '.home .shell' : '#main'
          ),
          footer: edges('.site-footer__brand'),
          cards: cards && {
            left: cards.left - sheet.left,
            right: sheet.right - cards.right,
          },
        };
      });
      expect(
        Math.abs(geometry.main.left - geometry.footer.left),
        route
      ).toBeLessThan(1);
      expect(
        Math.abs(geometry.main.right - geometry.footer.right),
        route
      ).toBeLessThan(1);
      if (geometry.cards) {
        expect(
          geometry.cards.left,
          `${route}: card bleed stays inside the surface`
        ).toBeGreaterThanOrEqual(4);
        expect(
          geometry.cards.right,
          `${route}: card bleed stays inside the surface`
        ).toBeGreaterThanOrEqual(4);
      }
      if (
        route !== '/' &&
        (await page
          .locator('header[data-column]')
          .first()
          .evaluate((el) => el.getBoundingClientRect().bottom <= 0))
      ) {
        await expect(page.locator('.site-footer__lockup')).toHaveAttribute(
          'data-revealed',
          'true'
        );
        await expect(page.locator('.site-footer__wordmark')).toHaveCSS(
          'clip-path',
          /^(?:none|inset\(0px\))$/
        );
      }
      if (
        (await page.locator('.site-footer').getAttribute('data-dock')) !== null
      ) {
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                [...CSS.highlights.values()]
                  .flatMap((stage) => [...stage])
                  .filter((range) =>
                    range.startContainer.parentElement?.closest('.site-footer')
                  ).length
            )
          )
          .toBe(0);
      }
      await page.screenshot({
        animations: 'disabled',
        path: info.outputPath(`${route.slice(1) || 'home'}-${width}.png`),
      });
    }
  });
}

test('short-page reflow settles without creating a width oscillation or snapping on load', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1920, height: 1600 });
  await page.goto('/writings');
  await expect(page.locator('html')).toHaveAttribute('data-footer-motion', '');
  for (const height of [1600, 1152, 1000, 844, 650, 1600]) {
    await page.setViewportSize({ width: 1920, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    const samples = await page.evaluate(async () => {
      const samples: { x: number; width: number; scroll: number }[] = [];
      for (let i = 0; i < 40; i++) {
        await new Promise(requestAnimationFrame);
        const box = document
          .querySelector('body > .grow')!
          .getBoundingClientRect();
        if (i >= 30)
          samples.push({ x: box.x, width: box.width, scroll: scrollY });
      }
      return samples;
    });
    expect(
      Math.max(...samples.map((s) => s.width)) -
        Math.min(...samples.map((s) => s.width)),
      `${height}px: reflow converges`
    ).toBeLessThan(0.1);
    expect(
      samples.every((s) => s.scroll === 0),
      `${height}px: no native snap on load`
    ).toBe(true);
    expect(samples.at(-1)!.width).toBeLessThan(
      await page.evaluate(() => document.body.getBoundingClientRect().width)
    );
  }
});
