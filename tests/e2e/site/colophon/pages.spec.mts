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
  await expect(page.getByRole('table', { name: 'This build' })).toBeVisible();
  await expect(
    page.getByRole('rowheader', { name: 'Version', exact: true })
  ).toBeVisible();
  await expect(page.locator('main h1')).toHaveText('Colophon');
  if (testInfo.project.name === 'phone')
    await expect(
      page.getByRole('heading', { name: 'Type', exact: true })
    ).toBeInViewport();
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
      'Built locally'
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
    await expect(page.locator('.colophon-notes')).toContainText('Credits');
    await expect(
      page.getByRole('link', { name: 'RSS, Atom, and JSON feeds', exact: true })
    ).toHaveAttribute('href', '/sitemap');
    await page
      .getByRole('link', {
        name: 'Plain-text credits (humans.txt)',
        exact: true,
      })
      .click();
    await expect(page.locator('body')).toContainText(
      'Developer: Willie Chalmers III'
    );
  } finally {
    await context.close();
  }
});

test('decoration stays silent while the specimens and build table remain accessible', async ({
  page,
}) => {
  await page.goto('/colophon');
  const illustration = page.locator('.colophon-illustration');
  await expect(illustration).toHaveAttribute('aria-hidden', 'true');
  await expect(
    illustration.locator('a, button, input, select, textarea, [tabindex]')
  ).toHaveCount(0);
  const intro = await page.locator('.colophon-intro').ariaSnapshot();
  expect(intro).toContain('heading "Colophon"');
  expect(intro).not.toContain('Aa');
  expect(intro).not.toContain('0O');
  await expect(
    page.getByRole('figure', { name: 'Atkinson Hyperlegible type specimens' })
  ).toBeVisible();
  await expect(page.getByRole('rowheader')).toHaveText([
    'Version',
    'Last built',
    'Build record',
  ]);
});

test('content reflows with increased text spacing at 320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/colophon');
  // WCAG 1.4.12: visitors can override these settings without losing content.
  await page.addStyleTag({
    content: `main.colophon, main.colophon * {
      line-height: 1.5 !important;
      letter-spacing: 0.12em !important;
      word-spacing: 0.16em !important;
    }
    main.colophon p { margin-bottom: 2em !important; }`,
  });
  const overflowing = await page
    .locator('main.colophon')
    .evaluate((main) =>
      [
        ...main.querySelectorAll<HTMLElement>(
          'h1, h2, p, .colophon-sample-text, th, td'
        ),
      ]
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => element.textContent?.trim())
    );
  expect(overflowing).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ).toBeLessThanOrEqual(1);
});

test('keyboard navigation skips decoration and keeps focus visible in forced colors', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto('/colophon');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' })
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main.colophon')).toBeFocused();
  for (const link of await page.locator('main.colophon a').all()) {
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    const focus = await link.evaluate((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        outlineWidth: parseFloat(style.outlineWidth),
        outlineStyle: style.outlineStyle,
        transition: style.transitionDuration,
        // Native keyboard scrolling rounds to whole CSS pixels.
        visible: box.top >= -1 && box.bottom <= innerHeight + 1,
        top: box.top,
        bottom: box.bottom,
        viewport: innerHeight,
        label: element.textContent,
      };
    });
    expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(focus.outlineStyle).not.toBe('none');
    expect(
      focus.transition.split(',').every((value) => parseFloat(value) <= 0.001)
    ).toBe(true);
    expect(focus.visible, JSON.stringify(focus)).toBe(true);
  }
});
