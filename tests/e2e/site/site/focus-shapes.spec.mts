import { expect, test } from '@playwright/test';

for (const width of [320, 390, 1440]) {
  test(`link focus follows inline and footer target shapes at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width < 840 ? 844 : 1000 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.route('**/api/status', (route) =>
      route.fulfill({
        json: {
          location: {
            city: 'Las Vegas',
            region: 'Nevada',
            country: 'United States',
            timezone: 'America/Los_Angeles',
            updatedAt: null,
          },
          weather: {
            temperature: 68,
            unit: 'F',
            code: 0,
            isDay: false,
            observedAt: new Date().toISOString(),
          },
        },
      })
    );
    for (const route of ['/colophon', '/']) {
      await page.goto(route);
      await page.keyboard.press('Tab');
      const inline =
        route === '/colophon'
          ? page.locator('.colophon-publishing a[href="/writings"]')
          : page.locator('.p-note a').first();
      await inline.focus();
      const inlineRadius = await inline.evaluate((el) =>
        parseFloat(getComputedStyle(el).borderTopLeftRadius)
      );
      expect(inlineRadius, `${route} inline link`).toBeGreaterThan(0);
      const footer = page.locator('.site-footer');
      if (route === '/') {
        await page.evaluate(() =>
          window.scrollTo(0, document.documentElement.scrollHeight)
        );
        await expect(page.locator('.site-webrings')).not.toHaveAttribute(
          'inert'
        );
      }
      const profiles = await footer
        .locator('.site-footer__profiles a')
        .evaluateAll((links) =>
          links.map((link) => {
            const { width, height } = link.getBoundingClientRect();
            return { width, height };
          })
        );
      for (const profile of profiles) {
        expect
          .soft(profile.height, `${route} profile target`)
          .toBeLessThanOrEqual(profile.width + 0.5);
      }
      const city = footer.locator('.microstatus .status-city');
      await expect(city).toBeVisible();
      expect(
        await city.evaluate((el) => el.scrollWidth <= el.clientWidth)
      ).toBe(true);
      const statusInset = await footer
        .locator('.microstatus')
        .evaluate((el) => {
          const bounds = el.getBoundingClientRect();
          const content = [...el.children]
            .map((child) => child.getBoundingClientRect())
            .filter((rect) => rect.width > 0);
          return {
            start: Math.min(...content.map((rect) => rect.left)) - bounds.left,
            end: bounds.right - Math.max(...content.map((rect) => rect.right)),
          };
        });
      expect
        .soft(statusInset.start, `${route} status start inset`)
        .toBeGreaterThanOrEqual(16);
      expect
        .soft(statusInset.end, `${route} status end inset`)
        .toBeGreaterThanOrEqual(16);
      for (const [name, target] of [
        ['email', footer.getByRole('link', { name: 'Email', exact: true })],
        ['status', footer.locator('.microstatus')],
      ] as const) {
        await target.scrollIntoViewIfNeeded();
        const before = await target.boundingBox();
        await target.focus();
        await expect(target).toBeFocused();
        const focus = await target.evaluate((el) => {
          const s = getComputedStyle(el);
          return {
            radius: parseFloat(s.borderTopLeftRadius),
            width: parseFloat(s.outlineWidth),
            visible: el.matches(':focus-visible'),
            height: el.getBoundingClientRect().height,
          };
        });
        expect(focus.visible).toBe(true);
        expect(focus.width).toBeGreaterThanOrEqual(2);
        expect(focus.radius, `${route} ${name}`).toBeGreaterThanOrEqual(
          focus.height / 2
        );
        expect(await target.boundingBox()).toEqual(before);
        {
          const prefix = route === '/' ? 'home' : 'colophon';
          await page.screenshot({
            path: testInfo.outputPath(`${prefix}-footer-${name}.png`),
          });
          const row = (await footer
            .locator('.site-footer__row')
            .boundingBox())!;
          await page.screenshot({
            path: testInfo.outputPath(`${prefix}-footer-${name}-detail.png`),
            clip: {
              x: row.x - 8,
              y: row.y - 8,
              width: row.width + 16,
              height: row.height + 16,
            },
          });
        }
      }
      await page.emulateMedia({ forcedColors: 'active' });
      await expect(footer.locator('.microstatus')).toHaveCSS(
        'outline-style',
        'solid'
      );
      await expect(footer.locator('.microstatus')).toHaveCSS(
        'outline-width',
        '3px'
      );
      await page.emulateMedia({ forcedColors: 'none' });
    }
  });
}
