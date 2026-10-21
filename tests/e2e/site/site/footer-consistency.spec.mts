import { type Page, expect, test } from '@playwright/test';

async function expandFooter(page: Page, route: string, scripts: boolean) {
  await page.goto(route);
  const footer = page.locator('.site-footer');
  if (route === '/' && scripts) {
    await expect(footer).toHaveAttribute('data-dock', '');
  }
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.site-footer__brand-detail p').evaluate((el) => {
    el.textContent = 'A personal website.';
  });
  const scrollToEnd = () =>
    page.evaluate(async (animated) => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      if (animated) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );
      }
    }, scripts);
  await scrollToEnd();
  if (route === '/' && scripts) {
    await expect
      .poll(async () => {
        await scrollToEnd();
        return footer.evaluate((el) =>
          getComputedStyle(el).getPropertyValue('--p')
        );
      })
      .toBe('1.0000');
    await expect(footer.locator('.site-footer__pages')).toHaveCSS(
      'opacity',
      '1'
    );
  }
  return footer;
}

for (const width of [320, 390, 840, 1440]) {
  for (const scripts of [true, false]) {
    test(`expanded footer shares typography and spacing at ${width}px, scripts ${scripts}`, async ({
      browser,
      baseURL,
    }, testInfo) => {
      const context = await browser.newContext({
        baseURL,
        viewport: { width, height: width < 840 ? 844 : 1000 },
        javaScriptEnabled: scripts,
        reducedMotion: 'reduce',
        colorScheme: scripts ? 'light' : 'dark',
      });
      const page = await context.newPage();
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
              isDay: true,
              observedAt: new Date().toISOString(),
            },
          },
        })
      );
      let reference: unknown;
      for (const route of ['/', '/colophon', '/writings', '/music']) {
        const footer = await expandFooter(page, route, scripts);
        const metrics = await footer.evaluate((el) => {
          const read = (selector: string) => {
            const target = el.querySelector(selector)!;
            const s = getComputedStyle(target);
            return Object.fromEntries(
              [
                'fontFamily',
                'fontSize',
                'fontWeight',
                'lineHeight',
                'letterSpacing',
                'paddingTop',
                'paddingBottom',
                'paddingLeft',
                'paddingRight',
                'gap',
              ].map((key) => [key, s[key as keyof CSSStyleDeclaration]])
            );
          };
          const box = (selector: string) =>
            el.querySelector(selector)!.getBoundingClientRect();
          const lockup = box('.site-footer__lockup');
          const detail = box('.site-footer__brand-detail');
          const nav = box('.site-footer__pages');
          const inner = el.querySelector('.site-footer__inner')!;
          const frame = getComputedStyle(inner);
          return {
            lockup: read('.site-footer__lockup'),
            tagline: read('.site-footer__brand-detail p'),
            navigation: read('.site-footer__pages'),
            pageLink: read('.site-footer__pages a'),
            profileLink: read('.site-footer__profiles a'),
            utilities: read('.site-footer__utilities'),
            topPadding: frame.paddingTop,
            bottomPadding: frame.paddingBottom,
            brandHeight: Math.round(lockup.height * 10) / 10,
            taglineGap: Math.round((detail.top - lockup.bottom) * 10) / 10,
            navigationGap: Math.round((nav.top - detail.bottom) * 10) / 10,
          };
        });
        const profiles = footer.locator('.site-footer__profiles');
        const iconOnly = await profiles
          .locator('.site-footer__label')
          .first()
          .evaluate((el) => getComputedStyle(el).position === 'absolute');
        await expect(profiles).toHaveCSS('column-gap', '0px');
        await expect(profiles.locator('.site-footer__label').first()).toHaveCSS(
          'margin-inline-end',
          iconOnly ? '0px' : '12px'
        );
        if (route === '/') reference = metrics;
        else
          expect(
            metrics,
            `${route} matches the expanded homepage footer`
          ).toEqual(reference);
        if (route === '/' || route === '/colophon') {
          await page.screenshot({
            path: testInfo.outputPath(
              `${route === '/' ? 'home' : 'colophon'}-${width}.png`
            ),
          });
        }
      }
      await context.close();
    });
  }
}
