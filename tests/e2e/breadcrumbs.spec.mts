import { expect, test } from '@playwright/test';

for (const width of [320, 390, 1440]) {
  test(`breadcrumb units stay compact and separate at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/brand');

    const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
    const site = trail.getByRole('button', {
      name: 'Open menu for Willie Chalmers III',
    });
    const brand = trail.getByRole('button', { name: 'Open menu for Brand' });
    await expect(site.locator('.site-breadcrumb-menu__icon')).toHaveCount(0);
    await expect(brand.locator('.site-breadcrumb-menu__icon')).toHaveCount(1);
    await expect(brand).toHaveAttribute('aria-controls', /.+/);

    const spacing = await trail.evaluate((element) => {
      const siteLabel = element.querySelector(
        '.site-breadcrumb-item--home button span'
      )!;
      const slash = element.querySelector('.site-breadcrumbs__crumb > span')!;
      const brandLabel = element.querySelector(
        '.site-breadcrumbs__crumb button span'
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
    expect(spacing.beforeSlash).toBeCloseTo(width <= 360 ? 7 : 15, 0);
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
      const label = trigger.querySelector('span')!;
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
        visibleGap: menuRect.top - (triggerRect.bottom - 8),
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
  await expect
    .poll(async () => (await menu.boundingBox())?.x)
    .toBeLessThan(160);
  const placement = await menu.evaluate((element) => {
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
  expect(Math.abs(placement.left - placement.expectedLeft)).toBeLessThan(2);
  expect(placement.right).toBeLessThanOrEqual(304);
});

test('the site and Writings crumbs open independent menus', async ({
  page,
}) => {
  await page.goto('/writings');
  const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
  const site = trail.getByRole('button', {
    name: 'Open menu for Willie Chalmers III',
  });
  const writings = trail.getByRole('button', {
    name: 'Open menu for Writings',
  });

  await site.click();
  const siteMenu = page.locator(`#${await site.getAttribute('aria-controls')}`);
  const siteLinks = siteMenu
    .getByRole('navigation', { name: 'Willie Chalmers III destinations' })
    .getByRole('link');
  await expect(siteLinks).toHaveCount(4);
  await expect(siteLinks.nth(0)).toHaveAttribute('href', '/');
  await expect(siteLinks.nth(1)).toHaveAttribute('href', '/writings');
  await expect(siteLinks.nth(2)).toHaveAttribute('href', '/initiatives');
  await expect(siteLinks.nth(3)).toHaveAttribute('href', '/brand');

  await writings.click();
  await expect(site).toHaveAttribute('aria-expanded', 'false');
  const writingsMenu = page.locator(
    `#${await writings.getAttribute('aria-controls')}`
  );
  const writingLinks = writingsMenu
    .getByRole('navigation', { name: 'Writings destinations' })
    .getByRole('link');
  await expect(writingLinks.first()).toHaveAttribute('href', '/writings');
  expect(await writingLinks.count()).toBeGreaterThan(1);
  await expect(writingsMenu.getByRole('heading')).toHaveCount(0);
  if (await writingsMenu.getByRole('link', { name: 'Brand' }).count()) {
    await expect(writingLinks).toHaveCount(3);
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
