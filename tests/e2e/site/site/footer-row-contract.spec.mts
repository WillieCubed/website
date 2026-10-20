import { expect, test } from '@playwright/test';

import { expectSingleFooterRow } from './footer-row-contract.mts';

const widths = [
  240, 280, 300, 316, 318, 320, 359, 360, 375, 390, 400, 412, 414, 430, 448,
  449, 480, 559, 560, 561, 599, 600, 639, 640, 700, 768, 839, 840, 1000, 1120,
  1121, 1200, 1440, 1920,
];

test.describe('footer one-row invariant', () => {
  test.describe.configure({ retries: 0, timeout: 120_000 });

  for (const mode of ['light', 'dark', 'no-javascript'] as const) {
    test(`never wraps at any supported width: ${mode}`, async ({
      browser,
      baseURL,
    }) => {
      const context = await browser.newContext({
        baseURL,
        javaScriptEnabled: mode !== 'no-javascript',
        colorScheme: mode === 'dark' ? 'dark' : 'light',
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      for (const route of ['/', '/colophon', '/writings']) {
        await page.goto(route);
        await page.evaluate(() => document.fonts.ready);
        for (const width of widths) {
          await page.setViewportSize({ width, height: 1000 });
          if (route === '/') {
            for (const progress of [0, 0.5]) {
              await page.evaluate(
                async ({ p, animated }) => {
                  const footer =
                    document.querySelector<HTMLElement>('.site-footer')!;
                  const end =
                    document.documentElement.scrollHeight - innerHeight;
                  window.scrollTo(
                    0,
                    Math.max(0, end - footer.offsetHeight * (1 - p))
                  );
                  if (animated) {
                    await new Promise<void>((resolve) =>
                      requestAnimationFrame(() =>
                        requestAnimationFrame(() => resolve())
                      )
                    );
                  }
                },
                { p: progress, animated: mode !== 'no-javascript' }
              );
              await expectSingleFooterRow(
                page,
                `${mode} collapsed/moving ${width}px ${progress}`
              );
            }
          }
          await page.evaluate(() =>
            window.scrollTo(0, document.documentElement.scrollHeight)
          );
          await expectSingleFooterRow(page, `${mode} ${route} ${width}px`);
        }
      }
      await context.close();
    });
  }

  test('cannot wrap with enlarged text, long names, or unavailable weather', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of ['/', '/colophon']) {
      await page.goto(route);
      await page.addStyleTag({
        content:
          'html{font-size:200%} .site-footer{letter-spacing:.12em;word-spacing:.16em}',
      });
      for (const city of [
        'Las Vegas',
        'San Luis Obispo',
        'Llanfairpwllgwyngyll',
      ]) {
        await page
          .locator('.microstatus .status-city')
          .evaluate((el, value) => {
            el.textContent = value;
          }, city);
        for (const width of [240, 320, 390, 430, 600, 840, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.evaluate(() =>
            window.scrollTo(0, document.documentElement.scrollHeight)
          );
          await expectSingleFooterRow(
            page,
            `${route} ${city} enlarged ${width}px`
          );
        }
      }
      await page
        .locator('.microstatus-weather')
        .evaluateAll((els) => els.forEach((el) => el.remove()));
      await expectSingleFooterRow(page, `${route} without weather`);
    }
  });

  test('guard rejects an actual two-line regression', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/colophon');
    await page.addStyleTag({
      content:
        '.site-footer__row{flex-wrap:wrap!important}.site-footer__utilities{flex-basis:100%!important}',
    });
    await expect(
      expectSingleFooterRow(page, 'deliberately broken layout')
    ).rejects.toThrow('row must never wrap');
    await page.addStyleTag({
      content:
        '.site-footer__row{flex-wrap:nowrap!important;display:grid!important;grid-template-columns:1fr!important}',
    });
    await expect(
      expectSingleFooterRow(page, 'stacked grid regression')
    ).rejects.toThrow('same physical line');
    await expect(page.locator('.microstatus .status-city')).toBeVisible();
    await page.addStyleTag({
      content:
        '.site-footer__row{display:flex!important}.site-footer__utilities{flex-basis:auto!important}.site-footer .microstatus .status-city{inline-size:1ch!important;white-space:normal!important;overflow-wrap:anywhere!important}',
    });
    await expect(
      expectSingleFooterRow(page, 'wrapped text regression')
    ).rejects.toThrow('city text must not wrap');
  });

  for (const width of [320, 390]) {
    test(`every profile remains keyboard reachable without wrapping at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/colophon');
      await page.keyboard.press('Tab');
      await page.getByRole('link', { name: 'Email', exact: true }).focus();
      for (const name of ['Email', 'Spotify', 'LinkedIn', 'GitHub']) {
        const link = page
          .locator('.site-footer__profiles')
          .getByRole('link', { name, exact: true });
        await expect(link).toBeFocused();
        await expect
          .poll(
            () =>
              link.evaluate((el) => {
                const target = el.getBoundingClientRect();
                const strip = el
                  .closest('.site-footer__profiles')!
                  .getBoundingClientRect();
                const fullyVisible =
                  target.left >= strip.left - 1 &&
                  target.right <= strip.right + 1;
                return {
                  fullyVisible,
                  hit: el.contains(
                    document.elementFromPoint(
                      target.x + target.width / 2,
                      target.y + target.height / 2
                    )
                  ),
                  target: target.toJSON(),
                  strip: strip.toJSON(),
                  scroll: el.closest('.site-footer__profiles')!.scrollLeft,
                };
              }),
            { message: `${name} is fully revealed by keyboard focus` }
          )
          .toMatchObject({ fullyVisible: true, hit: true });
        await expectSingleFooterRow(page, `${width}px focused ${name}`);
        await page.keyboard.press('Tab');
      }
      await expect(page.locator('.microstatus')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('button', { name: 'Feeds', exact: true })
      ).toBeFocused();
    });
  }
});
