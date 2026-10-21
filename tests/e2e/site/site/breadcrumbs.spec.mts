import { expect, test } from '@playwright/test';

import { skipUnlessPublished } from '../../../support/browser/published.mts';

for (const width of [320, 390, 1440]) {
  test(`breadcrumb units stay compact and separate at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/brand');

    const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
    // The site name is a plain link home; section crumbs open menus.
    const site = trail.getByRole('link', { name: 'Willie Chalmers III' });
    const brand = trail.getByRole('button', { name: 'Open menu for Brand' });
    await expect(site).toHaveAttribute('href', '/');
    await expect(site.locator('.site-breadcrumb-menu__icon')).toHaveCount(0);
    await expect(brand.locator('.site-breadcrumb-menu__icon')).toHaveCount(1);
    await expect(brand).toHaveAttribute('aria-controls', /.+/);

    const spacing = await trail.evaluate((element) => {
      const compact = element.closest('header')?.dataset.compact === 'true';
      const siteLabel = element.querySelector(
        compact ? '.site-breadcrumb-name__mark' : '.site-breadcrumb-name__label'
      )!;
      const slash = element.querySelector('.site-breadcrumbs__crumb > span')!;
      const brandLabel = element.querySelector(
        '.site-breadcrumbs__crumb .site-breadcrumb-menu__label'
      )!;
      const siteRect = siteLabel.getBoundingClientRect();
      const slashRect = slash.getBoundingClientRect();
      const brandRect = brandLabel.getBoundingClientRect();
      return {
        beforeSlash: slashRect.left - siteRect.right,
        afterSlash: brandRect.left - slashRect.right,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
    expect(Math.abs(spacing.beforeSlash - spacing.afterSlash)).toBeLessThan(2);
    // The label inset and separator gap both follow the shared 4px grid.
    expect(spacing.beforeSlash).toBeCloseTo(width <= 360 ? 8 : 16, 0);
    expect(spacing.documentWidth).toBeLessThanOrEqual(spacing.viewportWidth);

    const before = await brand.boundingBox();
    await site.focus();
    await expect(site.locator('.site-breadcrumb-menu__icon')).toHaveCount(0);
    const after = await brand.boundingBox();
    expect(after).toMatchObject(before!);

    await brand.click();
    const brandMenu = page.locator(
      `#${await brand.getAttribute('aria-controls')}`
    );
    await expect(brandMenu).toHaveCSS('transform', 'none');
    const brandLinks = brandMenu
      .getByRole('navigation', { name: 'Brand destinations' })
      .getByRole('link');
    await expect(brandLinks).toHaveCount(5);
    await expect(brandMenu.getByRole('heading')).toHaveCount(0);
    await expect(brandLinks.nth(0)).toHaveAttribute('href', '/brand');
    await expect(brandLinks.nth(1)).toHaveAttribute('href', '#mark');
    await expect(brandLinks.nth(4)).toHaveAttribute('href', '#in-use');
    await expect(
      brandMenu.getByRole('link', { name: 'Initiatives' })
    ).toHaveCount(0);

    const menuRect = await brandMenu.boundingBox();
    expect(menuRect!.x).toBeGreaterThanOrEqual(16);
    expect(menuRect!.x + menuRect!.width).toBeLessThanOrEqual(width - 16);
    const placement = await brandMenu.evaluate((menu) => {
      const trigger = document.querySelector<HTMLButtonElement>(
        '.site-breadcrumbs__crumb .site-breadcrumb-menu-trigger'
      )!;
      const label = trigger.querySelector('.site-breadcrumb-menu__label')!;
      const firstLink = menu.querySelector<HTMLElement>(
        '.site-breadcrumb-menu__link'
      )!;
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const linkRect = firstLink.getBoundingClientRect();
      const searchRect = document
        .querySelector('.palette-trigger--compact')!
        .getBoundingClientRect();
      return {
        visibleGap:
          menuRect.top - Math.max(triggerRect.bottom, searchRect.bottom),
        textOffset:
          linkRect.left +
          parseFloat(getComputedStyle(firstLink).paddingLeft) -
          label.getBoundingClientRect().left,
        overlapsSearch:
          menuRect.left < searchRect.right &&
          menuRect.right > searchRect.left &&
          menuRect.top < searchRect.bottom &&
          menuRect.bottom > searchRect.top,
      };
    });
    expect(placement.visibleGap).toBeGreaterThanOrEqual(4);
    expect(placement.visibleGap).toBeLessThanOrEqual(6);
    expect(placement.overlapsSearch).toBe(false);
    if (width >= 390) expect(Math.abs(placement.textOffset)).toBeLessThan(2);
  });
}

test('an open breadcrumb popup stays aligned after resizing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 844 });
  await page.goto('/brand');
  const brand = page.getByRole('button', { name: 'Open menu for Brand' });
  await brand.click();
  const menu = page.locator(`#${await brand.getAttribute('aria-controls')}`);
  await expect(menu).toHaveCSS('transform', 'none');

  await page.setViewportSize({ width: 320, height: 844 });
  const measurePlacement = () =>
    menu.evaluate((element) => {
      const label = document.querySelector<HTMLElement>(
        '.site-breadcrumbs__crumb .site-breadcrumb-menu__label'
      )!;
      const link = element.querySelector<HTMLElement>(
        '.site-breadcrumb-menu__link'
      )!;
      const menuRect = element.getBoundingClientRect();
      const linkTextInset =
        link.getBoundingClientRect().left -
        menuRect.left +
        parseFloat(getComputedStyle(link).paddingLeft);
      const preferredLeft = label.getBoundingClientRect().left - linkTextInset;
      return {
        left: menuRect.left,
        expectedLeft: Math.min(
          Math.max(16, preferredLeft),
          innerWidth - menuRect.width - 16
        ),
        right: menuRect.right,
      };
    });
  await expect
    .poll(async () => {
      const placement = await measurePlacement();
      return Math.abs(placement.left - placement.expectedLeft);
    })
    .toBeLessThan(2);
  const placement = await measurePlacement();
  expect(placement.right).toBeLessThanOrEqual(304);
});

test('the site name links home and the Writings crumb opens its menu', async ({
  page,
}) => {
  await page.goto('/writings');
  const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
  const site = trail.getByRole('link', { name: 'Willie Chalmers III' });
  const writings = trail.getByRole('button', {
    name: 'Open menu for Writings',
  });

  await expect(site).toHaveAttribute('href', '/');
  await expect(site).toHaveAttribute('rel', 'author');
  await expect(
    trail.getByRole('button', { name: 'Open menu for Willie Chalmers III' })
  ).toHaveCount(0);

  await writings.click();
  await expect(writings).toHaveAttribute('aria-expanded', 'true');
  const writingsMenu = page.locator(
    `#${await writings.getAttribute('aria-controls')}`
  );
  const writingLinks = writingsMenu
    .getByRole('navigation', { name: 'Writings destinations' })
    .getByRole('link');
  await expect(writingLinks.first()).toHaveAttribute('href', '/writings');
  expect(await writingLinks.count()).toBeGreaterThan(1);
  await expect(writingsMenu.getByRole('heading')).toHaveCount(0);
  if ((await writingsMenu.getByRole('link', { name: 'Brand' }).count()) > 0) {
    const hrefs = await writingLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href'))
    );
    expect(new Set(hrefs).size).toBe(hrefs.length);
    await expect(
      writingsMenu.getByRole('link', { name: 'Initiatives' })
    ).toHaveCount(1);
  }
});

test('breadcrumb menu supports keyboard navigation and hash links', async ({
  page,
}) => {
  await page.goto('/brand');
  const brand = page.getByRole('button', { name: 'Open menu for Brand' });
  await brand.focus();
  await page.keyboard.press('Enter');
  await expect(brand).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(brand).toHaveAttribute('aria-expanded', 'false');
  await expect(brand).toBeFocused();
  await page.keyboard.press('Space');
  await expect(brand).toHaveAttribute('aria-expanded', 'true');
  await page
    .getByRole('navigation', { name: 'Brand destinations' })
    .getByRole('link', { name: 'Colors' })
    .click();
  await expect(page).toHaveURL(/#color$/);
  await expect(page.locator('#color')).toBeFocused();
});

test('an initiative crumb lists only its own children or parts', async ({
  page,
}) => {
  const response = await page.goto('/initiatives/fall-tour-2026/part-1');
  test.skip(
    response?.status() === 404,
    'Initiative examples are draft-only in production builds.'
  );

  const parent = page.getByRole('button', {
    name: 'Open menu for The Willie Diaries',
  });
  await parent.click();
  const parentLinks = page
    .getByRole('navigation', { name: 'The Willie Diaries destinations' })
    .getByRole('link');
  await expect(parentLinks.first()).toHaveAttribute('href', '/initiatives/twd');
  await expect(parentLinks.nth(1)).toHaveAttribute(
    'href',
    '/initiatives/fall-tour-2026'
  );
  await expect(parentLinks).toHaveCount(2);

  const initiative = page.getByRole('button', {
    name: 'Open menu for Fall Tour 2026',
  });
  await initiative.click();
  const parts = page
    .getByRole('navigation', { name: 'Fall Tour 2026 destinations' })
    .getByRole('link');
  await expect(parts.first()).toHaveAttribute(
    'href',
    '/initiatives/fall-tour-2026'
  );
  await expect(parts).toHaveCount(5);
  await expect(parts.nth(1)).toHaveAttribute(
    'href',
    '/initiatives/fall-tour-2026/part-1'
  );
  await expect(initiative.locator('.site-breadcrumb-menu__icon')).toHaveCount(
    1
  );
  await expect(parent.locator('.site-breadcrumb-menu__icon')).toHaveCount(0);
});

test('a long trail swaps the name for the cube on a phone', async ({
  page,
  request,
}) => {
  await skipUnlessPublished(request, '/initiatives/fall-tour-2026');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/initiatives/fall-tour-2026');

  const banner = page.getByRole('banner');
  await expect(banner).toHaveAttribute('data-compact', 'true');
  await expect(banner.locator('.site-breadcrumb-name__mark')).toBeVisible();
  await expect(
    banner.getByRole('link', { name: 'Willie Chalmers III' })
  ).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 812 });
  await expect(banner).toHaveAttribute('data-compact', 'false');
  await expect(banner.locator('.site-breadcrumb-name__mark')).toBeHidden();
});

test('a long trail paints compact before the bar measures itself', async ({
  browser,
  request,
}) => {
  await skipUnlessPublished(request, '/initiatives/fall-tour-2026');
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  await page.goto('/initiatives/fall-tour-2026');

  const banner = page.getByRole('banner');
  await expect(banner).not.toHaveAttribute('data-compact');
  await expect(banner.locator('.site-breadcrumb-name__mark')).toBeVisible();
  await context.close();
});

for (const width of [320, 375, 390]) {
  test(`a long trail never scrolls and keeps the cube on the text edge at ${width}px`, async ({
    page,
    request,
  }) => {
    await skipUnlessPublished(request, '/initiatives/fall-tour-2026');
    await page.setViewportSize({ width, height: 812 });
    for (const path of [
      '/initiatives/fall-tour-2026',
      '/initiatives/fall-tour-2026/part-1',
      '/projects/hackportal',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('banner')).toHaveAttribute(
        'data-compact',
        'true'
      );
      const layout = await page.evaluate(() => {
        const rail = document.querySelector<HTMLElement>('.site-breadcrumbs')!;
        // Part pages inset their h1 inside the hero card, so the page's
        // text edge is the leftmost heading or paragraph.
        const edge = Math.min(
          ...[...document.querySelectorAll('main :is(h1, p)')].map(
            (element) => element.getBoundingClientRect().left
          )
        );
        return {
          overflow: rail.scrollWidth - rail.clientWidth,
          scrollLeft: rail.scrollLeft,
          cube: document
            .querySelector('.site-breadcrumb-name__mark')!
            .getBoundingClientRect().left,
          edge,
        };
      });
      expect(layout.overflow, path).toBeLessThanOrEqual(0);
      expect(layout.scrollLeft, path).toBe(0);
      expect(Math.abs(layout.cube - layout.edge), path).toBeLessThan(1);
    }
  });
}

test('a trail folds only as many crumbs as it has to', async ({
  page,
  request,
}) => {
  await skipUnlessPublished(request, '/initiatives/fall-tour-2026');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/initiatives/fall-tour-2026');
  const banner = page.getByRole('banner');
  // Drawing the crumbs closer makes room for this trail without folding.
  await expect(banner).toHaveAttribute('data-folded', '0');
  await expect(
    banner.getByRole('button', { name: 'Open menu for Initiatives' })
  ).toBeVisible();

  await page.goto('/initiatives/fall-tour-2026/part-1');
  await expect(banner).toHaveAttribute('data-folded', '2');
  const ellipsis = banner.getByRole('button', {
    name: 'Pages above this one',
  });
  await ellipsis.click();
  const folded = page
    .getByRole('navigation', { name: 'Pages above this one' })
    .getByRole('link');
  await expect(folded).toHaveCount(2);
  await expect(folded.nth(0)).toHaveAttribute('href', '/initiatives');
  await expect(folded.nth(1)).toHaveAttribute('href', '/initiatives/twd');
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 430, height: 812 });
  await expect(banner).toHaveAttribute('data-folded', '1');
  await expect(
    banner.getByRole('button', { name: 'Open menu for The Willie Diaries' })
  ).toBeVisible();
  await ellipsis.click();
  await expect(folded.locator('visible=true')).toHaveCount(1);
  await expect(folded.locator('visible=true')).toHaveAttribute(
    'href',
    '/initiatives'
  );
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 1280, height: 812 });
  await expect(banner).toHaveAttribute('data-folded', '0');
  await expect(ellipsis).toBeHidden();
});

test('a deep trail paints folded before the bar measures itself', async ({
  browser,
  request,
}) => {
  await skipUnlessPublished(request, '/initiatives/fall-tour-2026');
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  await page.goto('/initiatives/fall-tour-2026/part-1');

  const banner = page.getByRole('banner');
  await expect(banner).not.toHaveAttribute('data-folded');
  await expect(
    banner.getByRole('button', { name: 'Pages above this one' })
  ).toBeVisible();
  await expect(
    banner.getByRole('button', { name: 'Open menu for Initiatives' })
  ).toBeHidden();
  await context.close();
});

for (const width of [320, 390, 1440]) {
  test(`breadcrumb state surface has equal padding at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/status');
    const trigger = page.getByRole('button', {
      name: 'Open menu for Status',
      exact: true,
    });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger.locator('.site-breadcrumb-menu__icon')).toHaveCSS(
      'transform',
      'matrix(-1, 0, 0, -1, 0, 0)'
    );
    const geometry = await trigger.evaluate((button) => {
      const surface = button.querySelector('.site-control__surface')!;
      const label = button.querySelector('.site-breadcrumb-menu__label')!;
      const icon = button.querySelector('.site-breadcrumb-menu__icon')!;
      const target = button.getBoundingClientRect();
      const box = surface.getBoundingClientRect();
      const text = label.getBoundingClientRect();
      const arrow = icon.getBoundingClientRect();
      return {
        left: text.left - box.left,
        right: box.right - arrow.right,
        top: text.top - box.top,
        bottom: box.bottom - text.bottom,
        targetWidth: target.width,
        targetHeight: target.height,
        surfaceHeight: box.height,
      };
    });
    const padding = width <= 360 ? 4 : 8;
    for (const side of ['left', 'right', 'top', 'bottom'] as const)
      expect(geometry[side]).toBeCloseTo(padding, 1);
    expect(geometry.targetWidth).toBeGreaterThanOrEqual(48);
    expect(geometry.targetHeight).toBeGreaterThanOrEqual(48);
    expect(geometry.surfaceHeight).toBeLessThan(geometry.targetHeight);
    await page.screenshot({
      path: info.outputPath(`status-breadcrumb-${width}.png`),
    });
    // The transparent area above the visual surface is still a hit target.
    const target = (await trigger.boundingBox())!;
    await page.mouse.click(target.x + target.width / 2, target.y + 1);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
}

for (const width of [390, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`breadcrumb links and menus share states at ${width}px in ${colorScheme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/status');
      const home = page
        .getByRole('navigation', { name: 'Breadcrumb' })
        .getByRole('link', { name: 'Willie Chalmers III' });
      const menu = page.getByRole('button', {
        name: 'Open menu for Status',
        exact: true,
      });
      await expect(home).toHaveAttribute('href', '/');
      const fills: string[][] = [];
      for (const control of [home, menu]) {
        await expect(control).toHaveClass(/site-control/);
        const surface = control.locator(':scope > .site-control__surface');
        await expect(surface).toBeVisible();
        const box = (await control.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(48);
        const colors: string[] = [];
        await control.hover();
        colors.push(
          await surface.evaluate(
            (node) => getComputedStyle(node).backgroundColor
          )
        );
        expect(colors[0]).not.toBe('rgba(0, 0, 0, 0)');
        await page.mouse.down();
        try {
          colors.push(
            await surface.evaluate(
              (node) => getComputedStyle(node).backgroundColor
            )
          );
          expect(colors[1]).not.toBe(colors[0]);
          await expect(control).toHaveCSS('border-radius', '8px');
        } finally {
          await page.mouse.move(0, 0);
          await page.mouse.up();
        }
        await page.keyboard.press('Tab');
        await control.focus();
        await expect(control).toBeFocused();
        await expect(control).toHaveCSS('outline-width', '3px');
        const ring = await control.evaluate((node) => {
          const box = node.getBoundingClientRect();
          const nav = node.closest('nav')!;
          const rail = nav.getBoundingClientRect();
          const clipped = getComputedStyle(nav).overflowX === 'clip';
          const style = getComputedStyle(node);
          const outset = Math.max(
            0,
            parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset)
          );
          return {
            left: box.left - outset,
            right: box.right + outset,
            railLeft: clipped ? rail.left : 0,
            railRight: clipped ? rail.right : innerWidth,
          };
        });
        expect(ring.left).toBeGreaterThanOrEqual(ring.railLeft);
        expect(ring.right).toBeLessThanOrEqual(ring.railRight);
        colors.push(
          await surface.evaluate(
            (node) => getComputedStyle(node).backgroundColor
          )
        );
        expect(colors[2]).toBe(colors[1]);
        expect(await control.boundingBox()).toEqual(box);
        fills.push(colors);
        await page.screenshot({
          path: info.outputPath(
            `breadcrumb-${control === home ? 'home' : 'menu'}-${width}-${colorScheme}.png`
          ),
        });
      }
      expect(fills[0]).toEqual(fills[1]);
    });
  }
}
