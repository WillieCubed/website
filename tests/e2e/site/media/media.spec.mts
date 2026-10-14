import { expect, test } from '@playwright/test';

test('media appears in the footer, page registry, and sitemap', async ({
  page,
  request,
}) => {
  await page.goto('/media');
  await expect(
    page
      .getByRole('navigation', { name: 'Pages', exact: true })
      .getByRole('link', { name: 'Media', exact: true })
  ).toHaveAttribute('href', '/media');
  const registry = await request.get('/entities.json');
  expect(registry.status()).toBe(200);
  expect(await registry.json()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ href: '/media', title: 'Media' }),
    ])
  );
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain(
    '<loc>https://willie.page/media</loc>'
  );
});

test('media sources and excerpts remain separate keyboard actions', async ({
  page,
}) => {
  const response = await page.goto('/media');
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe('/media');
  const main = page.getByRole('main');
  for (const name of [
    'FOX5 Vegas',
    'Las Vegas Sun',
    'Nevada Current',
    'RTC of Southern Nevada',
    'UT Dallas News Center',
    'UT Dallas Jonsson School',
    'The UTD Mercury',
    'The College Tour',
  ]) {
    await expect(
      main.getByRole('link', { name, exact: true }).first()
    ).toBeVisible();
  }
  const fox5 = main.getByRole('article', { name: /RTC challenges/ });
  const excerpt = fox5.locator('summary');
  await expect(fox5.getByRole('blockquote')).toBeHidden();
  await excerpt.focus();
  await excerpt.press('Enter');
  await expect(fox5.getByRole('blockquote')).toBeVisible();
  await expect(
    main
      .getByRole('article', { name: /warn proposed fare hikes/ })
      .getByRole('blockquote')
  ).toBeHidden();
  await excerpt.press('Enter');
  await expect(fox5.getByRole('blockquote')).toBeHidden();
  await expect(fox5.locator('time')).toHaveText('Sep 30');
  await expect(
    fox5.getByRole('link', { name: 'FOX5 Vegas', exact: true })
  ).toHaveAttribute(
    'href',
    'https://www.fox5vegas.com/2026/10/01/rtc-challenges-las-vegas-valley-drivers-try-week-without-driving/'
  );
});

test('media stays readable at 320px and needs no scripts for excerpts', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 320, height: 720 },
  });
  const page = await context.newPage();
  await page.goto('/media');
  const main = page.getByRole('main');
  const sun = main.getByRole('article', { name: /warn proposed fare hikes/ });
  await sun.locator('summary').click();
  await expect(sun.getByRole('blockquote')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ).toBeLessThanOrEqual(1);
  const images = main.locator('img');
  expect(await images.count()).toBeGreaterThan(1);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
      .toBeGreaterThan(0);
  }
  await expect(main.locator('.media-mention--featured')).toHaveCount(1);
  await context.close();
});

test('the footer keeps each page layout across client navigation and history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const footer = page.locator('.site-footer__inner');
  const geometry = () =>
    footer.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: element.getBoundingClientRect().width,
        padding: style.paddingInlineStart,
      };
    });
  await page.goto('/writings');
  await expect(page.locator('.site-footer')).toHaveAttribute(
    'data-column',
    'content'
  );
  const writings = await geometry();
  await page
    .getByRole('navigation', { name: 'Pages', exact: true })
    .getByRole('link', { name: 'Media', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Media', exact: true, level: 1 })
  ).toBeVisible();
  const media = await geometry();
  await page
    .getByRole('navigation', { name: 'Pages', exact: true })
    .getByRole('link', { name: 'Writings', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Writings', exact: true, level: 1 })
  ).toBeVisible();
  await expect.poll(geometry).toEqual(writings);
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Media', exact: true, level: 1 })
  ).toBeVisible();
  await expect.poll(geometry).toEqual(media);
  await page.goForward();
  await expect(
    page.getByRole('heading', { name: 'Writings', exact: true, level: 1 })
  ).toBeVisible();
  await expect.poll(geometry).toEqual(writings);
});
