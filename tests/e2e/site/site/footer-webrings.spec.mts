import { type Page, expect, test } from '@playwright/test';

import {
  pageSurfaceGeometry,
  scrollToExpandedFooter,
} from './page-surface-geometry.mts';

const footerStatusFixture = {
  location: {
    city: 'Las Vegas',
    region: 'Nevada',
    country: 'United States',
    timezone: 'America/Los_Angeles',
    updatedAt: null,
  },
  weather: {
    temperature: 72,
    unit: 'F',
    code: 0,
    isDay: true,
    observedAt: new Date().toISOString(),
  },
};

for (const width of [320, 390]) {
  test(`compact footer keeps complete priority profiles and inset labels at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route('**/api/status', (request) =>
      request.fulfill({ json: footerStatusFixture })
    );
    await page.goto('/writings');
    await expect(page.locator('.microstatus .status-city')).toHaveText(
      'Las Vegas'
    );
    await expect(page.locator('html')).toHaveAttribute(
      'data-footer-motion',
      ''
    );
    await scrollToExpandedFooter(page);
    await expect(page.locator('.microstatus')).toHaveCSS(
      'padding-left',
      '12px'
    );
    await expect(page.locator('.microstatus')).toHaveCSS(
      'padding-right',
      '12px'
    );
    const inset = await page.locator('.site-webrings').evaluate((el) => {
      const group = el.getBoundingClientRect();
      const label = el
        .querySelector('.site-webrings__label')!
        .getBoundingClientRect();
      return label.left - group.left;
    });
    expect(
      inset,
      'the label has the same compact inset as the group padding'
    ).toBe(8);
    const frameEdges = await page.evaluate(() => ({
      group: document.querySelector('.site-webrings')!.getBoundingClientRect()
        .left,
      navigation: document
        .querySelector('.site-footer__pages a')!
        .getBoundingClientRect().left,
    }));
    expect(
      frameEdges.group,
      'webring frame uses the navigation edge'
    ).toBeCloseTo(frameEdges.navigation, 0);
    const count = width === 320 ? 2 : 3;
    const profiles = page.locator('.site-footer__profiles');
    const strip = (await profiles.boundingBox())!;
    for (const link of (await profiles.locator('a').all()).slice(0, count)) {
      const target = (await link.boundingBox())!;
      expect(
        target.x,
        'priority target starts inside the strip'
      ).toBeGreaterThanOrEqual(strip.x);
      expect(
        target.x + target.width,
        'priority target is completely visible'
      ).toBeLessThanOrEqual(strip.x + strip.width);
    }
  });
}

test('compact priority targets remain whole with fallback text metrics', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route('**/api/status', (request) =>
    request.fulfill({ json: footerStatusFixture })
  );
  await page.goto('/writings');
  await expect(page.locator('.microstatus .temperature')).toContainText('72');
  await page.addStyleTag({
    content:
      '.site-footer .microstatus { font-family: Arial, sans-serif !important; }',
  });
  await scrollToExpandedFooter(page);
  const strip = (await page.locator('.site-footer__profiles').boundingBox())!;
  const priority = await page
    .locator('.site-footer__profiles a')
    .nth(1)
    .boundingBox();
  expect(priority!.x + priority!.width).toBeLessThanOrEqual(
    strip.x + strip.width
  );
});

type TargetBounds = Pick<
  DOMRect,
  'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'
>;

for (const width of [320, 390]) {
  test(`overlay-scrollbar phones show complete profile artwork at ${width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    try {
      await page.route('**/api/status', (request) =>
        request.fulfill({ json: footerStatusFixture })
      );
      await page.goto('/writings');
      await expect(page.locator('.microstatus .temperature')).toContainText(
        '72'
      );
      await expect(page.locator('html')).toHaveAttribute(
        'data-footer-motion',
        ''
      );
      await scrollToExpandedFooter(page);
      const strip = page.locator('.site-footer__profiles');
      const bounds = (await strip.boundingBox())!;
      expect(bounds.width).toBe((width === 320 ? 2 : 3) * 44);
      let visibleIcons = 0;
      for (const icon of await strip.locator('svg').all()) {
        const artwork = await icon.boundingBox();
        if (!artwork) continue;
        if (
          artwork.x < bounds.x + bounds.width &&
          artwork.x + artwork.width > bounds.x
        ) {
          visibleIcons++;
          expect(artwork.x).toBeGreaterThanOrEqual(bounds.x);
          expect(artwork.x + artwork.width).toBeLessThanOrEqual(
            bounds.x + bounds.width
          );
        }
      }
      expect(visibleIcons).toBe(width === 320 ? 2 : 3);
    } finally {
      await context.close();
    }
  });
}

function expectUsableTargets(targets: TargetBounds[], panel: TargetBounds) {
  for (const [index, target] of targets.entries()) {
    expect(target.width).toBe(44);
    expect(target.height).toBe(44);
    expect(target.left).toBeGreaterThanOrEqual(panel.left);
    expect(target.right).toBeLessThanOrEqual(panel.right);
    for (const previous of targets.slice(0, index)) {
      expect(
        target.left >= previous.right ||
          target.right <= previous.left ||
          target.top >= previous.bottom ||
          target.bottom <= previous.top
      ).toBe(true);
    }
  }
}

type MobileRingLayout = Record<
  | 'rings'
  | 'row'
  | 'pages'
  | 'footer'
  | 'label'
  | 'panel'
  | 'firstArrow'
  | 'firstPage',
  TargetBounds
> & { targets: TargetBounds[] };

function expectMobileRingLayout(bounds: MobileRingLayout, width: number) {
  expect(bounds.rings.top).toBeGreaterThan(bounds.row.bottom);
  expect(bounds.row.top).toBeGreaterThan(bounds.pages.bottom);
  expect(bounds.rings.left).toBeCloseTo(bounds.firstPage.left, 0);
  if (width >= 360) {
    const targetOverhang = bounds.rings.left - bounds.row.left;
    expect(targetOverhang).toBeGreaterThanOrEqual(0);
    expect(targetOverhang).toBeLessThanOrEqual(12);
    expect(bounds.row.right - bounds.rings.right).toBeCloseTo(
      targetOverhang,
      0
    );
  } else {
    expect(bounds.rings.left).toBeGreaterThanOrEqual(bounds.footer.left);
    expect(bounds.rings.right).toBeLessThanOrEqual(bounds.footer.right);
  }
  const sharedRow = bounds.label.bottom > bounds.panel.top;
  if (sharedRow) {
    expect(bounds.label.right).toBeLessThanOrEqual(bounds.panel.left);
    expect(bounds.firstArrow.left - bounds.label.right).toBeGreaterThanOrEqual(
      6
    );
  } else {
    expect(bounds.label.bottom).toBeLessThanOrEqual(bounds.panel.top);
  }
  expect(bounds.label.left - bounds.rings.left).toBe(8);
  expectUsableTargets(bounds.targets, bounds.panel);
  expect(bounds.panel.left).toBeGreaterThanOrEqual(bounds.footer.left + 6);
  expect(bounds.panel.right).toBeLessThanOrEqual(bounds.footer.right - 6);
  expect(bounds.panel.top).toBeGreaterThan(bounds.pages.bottom);
}

async function expectFooterTouchTargets(
  page: Page,
  footer: TargetBounds,
  width: number
) {
  const utilityWidth = await page
    .locator('.site-footer__utilities')
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(
    utilityWidth,
    `${width}px utilities retain their column`
  ).toBeGreaterThan(48);
  const targets = await page
    .locator(
      '.site-footer__row a, .site-footer__row .feeds-button, .site-webring__link'
    )
    .all();
  for (const link of targets) {
    const initial = await link.boundingBox();
    if (!initial || initial.width === 0) continue;
    await link.scrollIntoViewIfNeeded();
    const target = await link.evaluate((link) => {
      const r = link.getBoundingClientRect();
      return {
        label: link.getAttribute('aria-label') ?? link.textContent,
        minimum: link.classList.contains('feeds-button') ? 48 : 44,
        bounds: r.toJSON(),
        edgeHits: [
          [r.left + 2, r.top + r.height / 2],
          [r.right - 2, r.top + r.height / 2],
          [r.left + r.width / 2, r.top + 2],
          [r.left + r.width / 2, r.bottom - 2],
        ].map(([x, y]) => link.contains(document.elementFromPoint(x, y))),
      };
    });
    const message = `${width}px ${target.label}`;
    expect(target.bounds.width, message).toBeGreaterThanOrEqual(target.minimum);
    expect(target.bounds.height, message).toBeGreaterThanOrEqual(
      target.minimum
    );
    expect(target.bounds.left, message).toBeGreaterThanOrEqual(footer.left);
    expect(target.bounds.right, message).toBeLessThanOrEqual(footer.right);
    expect(target.edgeHits, `${message} native padding accepts input`).toEqual(
      Array(4).fill(true)
    );
  }
}

test('both rings expose previous, directory, and next destinations', async ({
  page,
}) => {
  await page.goto('/writings');
  const rings = page.getByRole('region', { name: 'Webrings', exact: true });
  await expect(
    rings.getByRole('heading', { name: 'Webrings', exact: true })
  ).toHaveCount(1);
  await expect(rings.getByRole('navigation')).toHaveCount(2);
  await expect(rings.getByRole('link')).toHaveCount(6);
  for (const [name, href] of [
    ['Previous site in the IndieWeb Webring', 'https://xn--sr8hvo.ws/previous'],
    ['IndieWeb Webring', 'https://xn--sr8hvo.ws'],
    ['Next site in the IndieWeb Webring', 'https://xn--sr8hvo.ws/next'],
    [
      'Previous site in the UT Dallas ECS Webring',
      'https://ecs.utdring.com/#https://willie.page?nav=prev',
    ],
    ['UT Dallas ECS Webring', 'https://ecs.utdring.com/#https://willie.page'],
    [
      'Next site in the UT Dallas ECS Webring',
      'https://ecs.utdring.com/#https://willie.page?nav=next',
    ],
  ]) {
    await expect(
      rings.getByRole('link', { name, exact: true })
    ).toHaveAttribute('href', href);
  }
});

test('the open dock keeps all six ring links available while tabbing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const rings = page.locator('.site-webrings');
  await expect(rings).toHaveAttribute('inert', '');
  await expect(page.locator('.site-footer')).toHaveAttribute('data-dock', '');
  await expect
    .poll(() =>
      page
        .locator('[data-footer-contact]')
        .evaluate((row) => innerHeight - row.getBoundingClientRect().bottom)
    )
    .toBeCloseTo(16, 0);
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight)
  );
  await expect(rings).not.toHaveAttribute('inert');
  await page.getByRole('button', { name: 'Feeds', exact: true }).focus();
  for (const name of [
    'Previous site in the IndieWeb Webring',
    'IndieWeb Webring',
    'Next site in the IndieWeb Webring',
    'Previous site in the UT Dallas ECS Webring',
    'UT Dallas ECS Webring',
    'Next site in the UT Dallas ECS Webring',
  ]) {
    await page.keyboard.press('Tab');
    await expect(rings.getByRole('link', { name, exact: true })).toBeFocused();
    await expect(rings).not.toHaveAttribute('inert');
  }
});

test('keyboard tooltips dismiss with Escape without changing the link', async ({
  page,
}) => {
  await page.goto('/writings');
  const link = page.getByRole('link', {
    name: 'IndieWeb Webring',
    exact: true,
  });
  await link.scrollIntoViewIfNeeded();
  await page
    .getByRole('link', {
      name: 'Previous site in the IndieWeb Webring',
      exact: true,
    })
    .focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tooltip')).toHaveText('IndieWeb Webring');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).not.toBeVisible();
  await expect(link).toBeFocused();
  await expect(link).toHaveAttribute('href', 'https://xn--sr8hvo.ws');
});

test('a keyboard tooltip stays with its link when the page scrolls', async ({
  page,
}) => {
  await page.goto('/writings');
  const link = page.getByRole('link', {
    name: 'IndieWeb Webring',
    exact: true,
  });
  await link.scrollIntoViewIfNeeded();
  await page
    .getByRole('link', {
      name: 'Previous site in the IndieWeb Webring',
      exact: true,
    })
    .focus();
  await page.keyboard.press('Tab');
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toHaveText('IndieWeb Webring');
  // Focus scrolling its link into view must not dismiss the tooltip.
  await page.evaluate(() => window.scrollBy(0, -40));
  await expect(tooltip).toBeVisible();
  await expect
    .poll(async () => {
      const [tip, target] = await Promise.all([
        tooltip.boundingBox(),
        link.boundingBox(),
      ]);
      return Math.abs(tip!.y + tip!.height + 8 - target!.y);
    })
    .toBeLessThan(2);
});

test('the restored ring group contains full touch targets at every width', async ({
  page,
}) => {
  await page.goto('/');
  await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
  // If scrolling reaches the server footer before hydration, FooterFrame
  // intentionally retains that plain footer. This test exercises the dock.
  await expect(page.locator('.site-footer')).toHaveAttribute('data-dock', '');
  await page.evaluate(() => document.fonts.ready);
  // Leave room for platform font metrics and wider classic scrollbars:
  // 318px with a 15px bar has the same content budget as 320px with 17px.
  for (const width of [
    318, 320, 390, 599, 600, 839, 840, 1199, 1200, 1920, 2560,
  ]) {
    await page.setViewportSize({ width, height: 900 });
    // Reflow can increase the document height on the measurement frame.
    // Follow the current end until it settles; the contact row never wraps.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            window.scrollTo(0, document.documentElement.scrollHeight);
            return Number(
              document
                .querySelector<HTMLElement>('.site-footer')!
                .style.getPropertyValue('--p')
            );
          }),
        { message: `${width}px footer opens after resizing` }
      )
      .toBe(1);
    // The surface fits its frame without scaling its contents.
    await expect
      .poll(async () => {
        const surface = await pageSurfaceGeometry(page);
        const inset = width < 840 ? 8 : 16;
        return Math.abs(surface.width - (surface.viewportWidth - inset * 2));
      })
      .toBeLessThan(0.5);
    const bounds = await page.evaluate(() => {
      const box = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect().toJSON();
      return {
        footer: box('.site-footer'),
        page: box('body > .grow'),
        viewport: box('body'),
        name: box('.site-footer__lockup'),
        pages: box('.site-footer__pages'),
        firstPage: box('.site-footer__pages a'),
        rings: box('.site-webrings'),
        label: box('.site-webrings__label'),
        firstArrow: box('.site-webring__direction svg'),
        panel: box('.site-webrings__controls'),
        row: box('.site-footer__row'),
        targets: [...document.querySelectorAll('.site-webring__link')].map(
          (e) => e.getBoundingClientRect().toJSON()
        ),
        overflow: document.documentElement.scrollWidth > innerWidth,
        ringsLast:
          document.querySelector('.site-footer__inner')!.lastElementChild ===
          document.querySelector('.site-webrings'),
      };
    });
    expect(bounds.overflow, `${width}px overflow`).toBe(false);
    expect(bounds.name.bottom).toBeLessThan(bounds.pages.top);
    const painted = await pageSurfaceGeometry(page);
    const inset = (painted.viewportWidth - painted.width) / 2;
    expect(painted.left).toBeCloseTo(bounds.viewport.left + inset, 0);
    expect(painted.right).toBeCloseTo(bounds.viewport.right - inset, 0);
    expect(bounds.ringsLast).toBe(true);
    if (width < 600) expectMobileRingLayout(bounds, width);
    if (width >= 840) {
      expect(bounds.rings.left).toBeGreaterThan(bounds.pages.right);
      expect(bounds.rings.top).toBeLessThan(bounds.pages.bottom);
      expect(bounds.rings.bottom).toBeLessThan(bounds.row.top);
    }
    expectUsableTargets(bounds.targets, bounds.panel);
    await expectFooterTouchTargets(page, bounds.footer, width);

    for (let i = 0; i < bounds.targets.length; i += 3) {
      expect(
        new Set(bounds.targets.slice(i, i + 3).map((target) => target.top)).size
      ).toBe(1);
    }
    if (width >= 360 && width < 600)
      expect(new Set(bounds.targets.map((target) => target.top)).size).toBe(1);
  }
});

for (const width of [320, 390]) {
  test(`mobile status preserves a longer city name at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/status', (request) =>
      request.fulfill({
        json: {
          ...footerStatusFixture,
          location: {
            ...footerStatusFixture.location,
            city: 'San Luis Obispo',
          },
        },
      })
    );
    for (const route of ['/', '/colophon']) {
      await page.goto(route);
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight)
      );
      const city = page.locator('.microstatus .status-city');
      await expect(city).toHaveText('San Luis Obispo');
      await expect(city).toBeVisible();
      const bounds = await city.evaluate((el) => {
        const text = el.getBoundingClientRect();
        const status = el.closest('.microstatus')!.getBoundingClientRect();
        return {
          fits: el.scrollWidth <= el.clientWidth,
          inset: Math.min(text.left - status.left, status.right - text.right),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(bounds.fits).toBe(true);
      expect(bounds.inset).toBeGreaterThanOrEqual(12);
      expect(bounds.overflow).toBe(false);
    }
  });
}

for (const route of ['/', '/writings']) {
  test(`footer contacts and status fit without clipping the city: ${route}`, async ({
    page,
  }, testInfo) => {
    await page.route('**/api/status', (request) =>
      request.fulfill({ json: footerStatusFixture })
    );
    await page.goto(route);
    if (route === '/')
      await expect(page.locator('.site-footer')).toHaveAttribute(
        'data-dock',
        ''
      );
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    );
    await expect(page.locator('.microstatus')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
    for (const width of [
      300, 316, 318, 320, 360, 390, 480, 599, 600, 840, 1000, 1200, 1440, 1920,
    ]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('.site-webrings').scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          page.evaluate(() => {
            window.scrollTo(0, document.documentElement.scrollHeight);
            const footer = document.querySelector<HTMLElement>('.site-footer')!;
            return (
              !footer.hasAttribute('data-dock') ||
              Number(footer.style.getPropertyValue('--p')) === 1
            );
          })
        )
        .toBe(true);
      await expect(
        page.locator('.site-footer .microstatus-weather .temperature')
      ).toContainText('72');
      await expect(
        page.locator('.site-footer .microstatus-weather')
      ).toBeVisible();
      if (width >= 320) {
        await expect(
          page.locator('.site-footer .weather-picture--compact')
        ).toBeVisible();
      }
      const geometry = await page.evaluate(() => {
        const box = (selector: string) =>
          document.querySelector(selector)!.getBoundingClientRect().toJSON();
        return {
          contacts: box('.site-footer__profiles'),
          utilities: box('.site-footer__utilities'),
          status: box('.site-footer__utilities .microstatus'),
          row: box('.site-footer__row'),
          feeds: box('.site-footer__utilities .feeds-button'),
          weather: box('.site-footer .microstatus-weather'),
          temperatureFits: (() => {
            const temperature = document.querySelector<HTMLElement>(
              '.site-footer .temperature'
            )!;
            return (
              temperature.scrollWidth <= temperature.clientWidth &&
              getComputedStyle(temperature).fontSize === '14px'
            );
          })(),
          statusFill: getComputedStyle(
            document.querySelector('.site-footer .microstatus')!
          ).backgroundColor,
          statusRadius: getComputedStyle(
            document.querySelector('.site-footer .microstatus')!
          ).borderRadius,
          footerFill: getComputedStyle(document.querySelector('.site-footer')!)
            .backgroundColor,
          statusParts: [
            ...document.querySelectorAll('.site-footer .microstatus > span'),
          ]
            .filter((element) => element.getBoundingClientRect().width > 0)
            .map((element) => element.getBoundingClientRect().toJSON()),
          links: [...document.querySelectorAll('.site-footer__profiles a')]
            .filter((element) => element.getBoundingClientRect().width > 0)
            .map((element) => element.getBoundingClientRect().toJSON()),
          overflow:
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        };
      });
      expect(geometry.overflow, `${width}px footer overflow`).toBe(false);
      expect(geometry.statusFill, `${width}px status has a surface`).not.toBe(
        'rgba(0, 0, 0, 0)'
      );
      expect(geometry.statusFill).not.toBe(geometry.footerFill);
      expect(geometry.statusRadius).toBe('24px');
      for (const part of geometry.statusParts) {
        expect(part.left - geometry.status.left).toBeGreaterThanOrEqual(12);
        expect(geometry.status.right - part.right).toBeGreaterThanOrEqual(12);
      }
      expect(
        geometry.utilities.width,
        `${width}px utilities retain their column`
      ).toBeGreaterThan(48);
      expect(
        geometry.status.width,
        `${width}px status stays readable`
      ).toBeGreaterThanOrEqual(44);
      for (const link of geometry.links) {
        expect(link.width).toBeGreaterThanOrEqual(44);
        expect(link.height).toBeGreaterThanOrEqual(44);
      }
      expect(geometry.contacts.top).toBeCloseTo(geometry.utilities.top, 0);
      expect(geometry.contacts.right).toBeLessThanOrEqual(
        geometry.utilities.left
      );
      expect(geometry.status.left).toBeGreaterThanOrEqual(
        geometry.contacts.right
      );
      expect(geometry.row.height, `${width}px row must never stack`).toBe(48);
      expect(
        geometry.feeds.left - geometry.status.right,
        `${width}px status keeps the requested 4px gap before Feeds`
      ).toBeCloseTo(4, 0);
      expect(
        geometry.feeds.top,
        `${width}px Feeds shares the contact row`
      ).toBeCloseTo(geometry.utilities.top, 0);
      if (width <= 480) {
        const city = page.locator('.microstatus .status-city');
        await expect(city).toBeVisible();
        expect(
          await city.evaluate((el) => el.scrollWidth <= el.clientWidth)
        ).toBe(true);
      }
      expect(
        geometry.weather.width,
        `${width}px temperature remains readable`
      ).toBeGreaterThan(0);
      expect(
        geometry.temperatureFits,
        `${width}px temperature is full size and unclipped`
      ).toBe(true);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: testInfo.outputPath(`footer-fit-${width}.png`),
      });
    }
    await page.route('**/api/status', (request) =>
      request.fulfill({ json: { ...footerStatusFixture, weather: null } })
    );
    await page.setViewportSize({ width: 318, height: 1000 });
    await page.locator('.site-webrings').scrollIntoViewIfNeeded();
    await page.evaluate(() =>
      document.dispatchEvent(new Event('visibilitychange'))
    );
    await expect(page.locator('.site-footer .microstatus-weather')).toHaveCount(
      0
    );
    await expect(page.locator('.site-footer .microstatus-place')).toBeVisible();
    await expect(
      page.locator('.site-footer .microstatus')
    ).toHaveAccessibleName(/Las Vegas/);
    const fallbackGeometry = () =>
      page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        const status = document
          .querySelector('.site-footer .microstatus')!
          .getBoundingClientRect();
        const feeds = document
          .querySelector('.site-footer .feeds-button')!
          .getBoundingClientRect();
        // The profile strip scrolls horizontally; links outside its viewport
        // do not occupy the status column.
        const contacts = document
          .querySelector('.site-footer__profiles')!
          .getBoundingClientRect();
        return {
          status: status.toJSON(),
          feeds: feeds.toJSON(),
          lastContact: contacts.right,
        };
      });
    await expect
      .poll(async () => {
        const fallback = await fallbackGeometry();
        return (
          fallback.status.left >= fallback.lastContact &&
          Math.abs(fallback.feeds.left - fallback.status.right - 4) < 1
        );
      })
      .toBe(true);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: testInfo.outputPath('footer-no-weather-318.png'),
    });
  });
}

test('a touch tap follows a ring link immediately', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  const destination = 'https://xn--sr8hvo.ws/next';
  await page.route(destination, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<title>Next site</title>',
    })
  );
  await page.goto('/writings');
  await page
    .getByRole('link', {
      name: 'Next site in the IndieWeb Webring',
      exact: true,
    })
    .tap();
  await expect(page).toHaveURL(destination);
  await context.close();
});

test('both rings remain usable without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  for (const path of ['/', '/writings']) {
    await page.goto(path);
    const links = page
      .getByRole('region', { name: 'Webrings', exact: true })
      .getByRole('link');
    await expect(links).toHaveCount(6);
    for (const link of await links.all()) await expect(link).toBeVisible();
  }
  await context.close();
});

for (const width of [390, 1440]) {
  test(`webrings retain their outlined group and tonal centers at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto('/writings');
    await expect(page.locator('html')).toHaveAttribute(
      'data-footer-motion',
      ''
    );
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
    const link = page.locator('.site-webring__mark').first();
    await scrollToExpandedFooter(page);
    const surface = link.locator('.site-control__surface');
    await expect(surface).toHaveCount(1);
    const box = (await link.boundingBox())!;
    const visual = (await surface.boundingBox())!;
    expect(box.width).toBe(44);
    expect(box.height).toBe(44);
    expect(visual.width).toBe(32);
    expect(visual.height).toBe(32);
    await expect(page.locator('.site-webrings')).toHaveCSS(
      'outline-width',
      '1px'
    );
    await expect(page.locator('.site-webrings')).toHaveCSS(
      'outline-style',
      'solid'
    );
    const frame = page.locator('.site-webrings');
    expect(
      await frame.evaluate((element) => getComputedStyle(element).outlineColor)
    ).toBe(
      await frame.evaluate((element) => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--color-outline)';
        element.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      })
    );
    await expect(surface).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await page.screenshot({ path: testInfo.outputPath('rest-webrings.png') });
    await page.keyboard.press('Tab');
    await link.focus();
    await expect(link).toHaveCSS('outline-width', '3px');
    // Keyboard focus may scroll a full-height page; press must preserve the target
    // at its focused position, independently of that native viewport movement.
    await scrollToExpandedFooter(page);
    const focusedBox = (await link.boundingBox())!;
    expect(focusedBox.width).toBe(box.width);
    expect(focusedBox.height).toBe(box.height);
    await page.mouse.move(
      focusedBox.x + focusedBox.width / 2,
      focusedBox.y + focusedBox.height / 2
    );
    await page.mouse.down();
    try {
      await expect(surface).toHaveCSS('border-radius', '8px');
      expect(await link.boundingBox()).toEqual(focusedBox);
      await page.screenshot({
        path: testInfo.outputPath('compact-webrings.png'),
      });
    } finally {
      await page.mouse.move(0, 0);
      await page.mouse.up();
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(link).toHaveCSS('transition-duration', '0s');
    await page.emulateMedia({ forcedColors: 'active' });
    await link.focus();
    await expect(link).toHaveCSS('outline-style', 'solid');
  });
}

test('the invisible padding around a compact webring remains a native touch target', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    javaScriptEnabled: false,
  });
  try {
    const page = await context.newPage();
    const destination = 'https://xn--sr8hvo.ws/next';
    await page.route(destination, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<title>Next site</title>',
      })
    );
    await page.goto('/writings');
    const link = page.getByRole('link', {
      name: 'Next site in the IndieWeb Webring',
      exact: true,
    });
    await link.tap({ position: { x: 2, y: 22 } });
    await expect(page).toHaveURL(destination);
  } finally {
    await context.close();
  }
});

test('labelled homepage contacts stay visually separate', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.locator('.site-footer')).toHaveAttribute('data-dock', '');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1200, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    );
    await expect
      .poll(() =>
        page
          .locator('.site-footer')
          .evaluate((e) =>
            Number((e as HTMLElement).style.getPropertyValue('--p'))
          )
      )
      .toBe(1);
    const gaps = await page
      .locator('.site-footer__profiles a')
      .evaluateAll((links) =>
        links
          .slice(1)
          .map(
            (link, index) =>
              link.querySelector('svg')!.getBoundingClientRect().left -
              links[index]
                .querySelector('.site-footer__label')!
                .getBoundingClientRect().right
          )
      );
    for (const gap of gaps)
      expect(
        gap,
        `${width}px labelled contact separation`
      ).toBeGreaterThanOrEqual(8);
    await page.screenshot({
      path: testInfo.outputPath(`labelled-contacts-${width}.png`),
    });
  }
});
