import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the header and body share content edges across window sizes', async ({
  page,
}) => {
  await page.goto('/colophon');
  for (const width of [320, 390, 600, 840, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const edges = await page.evaluate(() => {
      const contentEdges = (selector: string) => {
        const element = document.querySelector(selector)!;
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          left: box.left + parseFloat(style.paddingLeft),
          right: box.right - parseFloat(style.paddingRight),
        };
      };
      return {
        header: contentEdges('header'),
        body: contentEdges('main.colophon'),
      };
    });
    expect(
      Math.abs(edges.header.left - edges.body.left),
      `left edge at ${width}px`
    ).toBeLessThan(1);
    expect(
      Math.abs(edges.header.right - edges.body.right),
      `right edge at ${width}px`
    ).toBeLessThan(1);
  }
});

test('the colophon shows the served artifact and remains readable at every viewport', async ({
  page,
  request,
}, testInfo) => {
  if (testInfo.project.name === 'phone')
    await page.setViewportSize({ width: 390, height: 844 });
  else await page.setViewportSize({ width: 1440, height: 1000 });
  const response = await page.goto('/colophon');
  expect(response?.status()).toBe(200);
  const record = await (await request.get('/api/indieweb/revision')).json();
  await expect(page.locator('main h1')).toHaveText(
    'A little about how this place is made.'
  );
  await expect(page.locator('.colophon-revision')).toHaveAttribute(
    'href',
    `https://github.com/WillieCubed/website/commit/${record.sha}`
  );
  await expect(page.locator('.colophon-build time')).toHaveAttribute(
    'datetime',
    record.builtAt
  );
  if (record.buildUrl)
    await expect(page.locator('.colophon-build a').last()).toHaveAttribute(
      'href',
      record.buildUrl
    );
  else
    await expect(page.locator('.colophon-build')).toContainText(
      'No CI run for this build'
    );
  await expect(page).toHaveTitle('Colophon · Willie Chalmers III');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    }))
  ).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('colophon-viewport.png') });
  await page.screenshot({
    path: testInfo.outputPath('colophon-full.png'),
    fullPage: true,
  });
});

test('direct loading without JavaScript preserves the note, version, and links', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    expect((await page.goto('/colophon'))?.status()).toBe(200);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('.colophon-build time')).toBeVisible();
    await expect(page.locator('.colophon-notes')).toContainText(
      'A few credits.'
    );
    await expect(
      page.getByRole('link', { name: 'status page', exact: true })
    ).toHaveAttribute('href', '/status');
    await page.getByRole('link', { name: 'humans.txt', exact: true }).click();
    await expect(page.locator('body')).toContainText(
      'Developer: Willie Chalmers III'
    );
  } finally {
    await context.close();
  }
});
