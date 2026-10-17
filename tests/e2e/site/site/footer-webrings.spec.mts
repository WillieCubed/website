import { expect, test } from '@playwright/test';

type TargetBounds = Pick<
  DOMRect,
  'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'
>;

function expectUsableTargets(targets: TargetBounds[], panel: TargetBounds) {
  for (const [index, target] of targets.entries()) {
    expect(target.width).toBe(48);
    expect(target.height).toBe(48);
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

test('the footer keeps aligned containers and stacks the rings on phones', async ({
  page,
}) => {
  await page.goto('/');
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
    // A resize can wrap the contact row and increase the document height on
    // the dock's measurement frame. Follow the current end until it settles.
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
    // Resizing updates the sheet's measured width on the next frame. Wait
    // for the visible edges, rather than a progress value already at 1.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const surface = document
            .querySelector('body > .grow')!
            .getBoundingClientRect();
          const row = document
            .querySelector('.site-footer__row')!
            .getBoundingClientRect();
          return Math.max(
            Math.abs(surface.left - row.left),
            Math.abs(surface.right - row.right)
          );
        })
      )
      .toBeLessThan(0.5);
    const bounds = await page.evaluate(() => {
      const box = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect().toJSON();
      return {
        page: box('body > .grow'),
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
    expect(bounds.page.left).toBeCloseTo(bounds.row.left, 0);
    expect(bounds.page.right).toBeCloseTo(bounds.row.right, 0);
    expect(bounds.ringsLast).toBe(true);
    if (width < 600) {
      expect(bounds.rings.top).toBeGreaterThan(bounds.row.bottom);
      expect(bounds.row.top).toBeGreaterThan(bounds.pages.bottom);
      expect(bounds.rings.left).toBeCloseTo(bounds.row.left, 0);
      expect(bounds.rings.width).toBeCloseTo(
        Math.min(480, bounds.row.width),
        0
      );
      const sharedRow = bounds.label.bottom > bounds.panel.top;
      if (sharedRow) {
        expect(bounds.label.right).toBeLessThanOrEqual(bounds.panel.left);
        expect(
          bounds.firstArrow.left - bounds.label.right
        ).toBeGreaterThanOrEqual(6);
      } else {
        expect(bounds.label.bottom).toBeLessThanOrEqual(bounds.panel.top);
      }
      expect(bounds.label.left).toBeCloseTo(bounds.firstPage.left, 0);
      expectUsableTargets(bounds.targets, bounds.panel);
      expect(bounds.panel.right).toBeLessThanOrEqual(bounds.rings.right);
      expect(bounds.panel.top).toBeGreaterThan(bounds.pages.bottom);
    } else {
      expect(bounds.panel.bottom).toBeLessThan(bounds.row.top);
      expect(bounds.rings.right).toBeCloseTo(bounds.row.right, 0);
      expect(bounds.pages.right).toBeLessThan(bounds.panel.left);
    }
  }
});

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
