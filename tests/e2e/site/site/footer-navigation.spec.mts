import { expect, test } from '@playwright/test';

for (const width of [320, 390, 840, 1440]) {
  test(`footer navigation reads down each column at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width < 840 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of ['/', '/colophon', '/writings']) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight)
      );
      const nav = page.locator('.site-footer__pages');
      await expect(nav).not.toHaveAttribute('inert');
      const links = nav.getByRole('link');
      const layout = await links.evaluateAll((els) =>
        els.map((el) => {
          const { x, y } = el.getBoundingClientRect();
          return { label: el.textContent?.trim(), x, y };
        })
      );
      const visualOrder = [...layout].sort((a, b) =>
        Math.abs(a.x - b.x) < 1 ? a.y - b.y : a.x - b.x
      );
      expect(
        layout.map((link) => link.label),
        `${route}: source order must read top to bottom, then the next column`
      ).toEqual(visualOrder.map((link) => link.label));
      await page.keyboard.press('Tab');
      await links.first().focus();
      for (let index = 0; index < layout.length; index++) {
        await expect(links.nth(index)).toBeFocused();
        await page.keyboard.press('Tab');
      }
      if (route !== '/writings') {
        await page.screenshot({
          path: testInfo.outputPath(
            `${route === '/' ? 'home' : 'colophon'}-footer-${width}.png`
          ),
        });
      }
    }
  });
}
