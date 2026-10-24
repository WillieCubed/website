import { expect, test } from '@playwright/test';

test.skip(
  process.env.STUDIO_E2E !== '1',
  'The complete tour remains an authenticated draft.'
);
const root = '/initiatives/fall-tour-2026';

test('city names are readable on the map and support selection, zoom, drag, and keyboard panning', async ({
  page,
}, info) => {
  await page.goto(root);
  const map = page.locator('.route-map__interactive').first();
  await expect(map).toHaveAttribute('data-ready', 'true');
  await map.scrollIntoViewIfNeeded();
  const cities = map.locator('.route-map__city');
  expect(await cities.count()).toBeGreaterThanOrEqual(4);
  expect(await cities.count()).toBeLessThanOrEqual(12);
  const boxes = await cities.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return {
        name: node.textContent,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        font: parseFloat(getComputedStyle(node).fontSize),
        clipped: node.scrollWidth > node.clientWidth + 1,
      };
    })
  );
  for (const box of boxes) {
    expect(box.font).toBeGreaterThanOrEqual(14);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.clipped, `${box.name} should fit its label`).toBe(false);
    for (const other of boxes) {
      if (box === other) continue;
      expect(
        box.x + box.width <= other.x + 1 ||
          other.x + other.width <= box.x + 1 ||
          box.y + box.height <= other.y + 1 ||
          other.y + other.height <= box.y + 1,
        `${box.name} overlaps ${other.name}`
      ).toBe(true);
    }
  }
  const plane = map.locator('.route-map__canvas > svg').first();
  const original = await plane.getAttribute('viewBox');
  await map
    .getByRole('combobox', { name: 'Find a city' })
    .selectOption('Plano');
  const plano = map.getByRole('button', { name: /Plano/ });
  if (info.project.use.hasTouch) await plano.tap();
  else await plano.click();
  await expect(plano).toHaveAttribute('aria-pressed', 'true');
  await expect(plane).not.toHaveAttribute('viewBox', original!);
  const radius = await map
    .locator('.route-map__leaders circle')
    .first()
    .evaluate((node) => {
      if (!(node instanceof SVGCircleElement))
        throw new Error('Expected an SVG map marker');
      return (
        parseFloat(getComputedStyle(node).r) * (node.getScreenCTM()?.a ?? 0)
      );
    });
  expect(radius).toBeCloseTo(5, 0);
  await map.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const zoomed = await plane.getAttribute('viewBox');
  await plane.focus();
  await page.keyboard.press('ArrowRight');
  await expect(plane).not.toHaveAttribute('viewBox', zoomed!);
  const beforeDrag = await plane.getAttribute('viewBox');
  const bounds = await plane.boundingBox();
  if (info.project.use.hasTouch) {
    const session = await page.context().newCDPSession(page);
    try {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: bounds!.x + 12, y: bounds!.y + 12 }],
      });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: bounds!.x + 48, y: bounds!.y + 36 }],
      });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
    } finally {
      await session.detach();
    }
  } else {
    await page.mouse.move(bounds!.x + 12, bounds!.y + 12);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + 48, bounds!.y + 36, { steps: 4 });
    await page.mouse.up();
  }
  await expect(plane).not.toHaveAttribute('viewBox', beforeDrag!);
  await map.getByRole('button', { name: 'Show all' }).click();
  await expect(plane).toHaveAttribute('viewBox', original!);
  await map
    .getByRole('combobox', { name: 'Find a city' })
    .selectOption('New York');
  await expect(
    map.getByRole('button', { name: 'New York', exact: true })
  ).toHaveAttribute('aria-pressed', 'true');
  await map.getByRole('button', { name: 'Show all' }).click();
  await page.screenshot({ path: info.outputPath('labeled-map-viewport.png') });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
});

test('the unenhanced map keeps named cities readable with horizontal scrolling', async ({
  browser,
  baseURL,
}, info) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: info.project.use.viewport,
    colorScheme: info.project.use.colorScheme,
    extraHTTPHeaders: {
      'cf-access-jwt-assertion': process.env.STUDIO_TEST_TOKEN || '',
    },
  });
  try {
    const page = await context.newPage();
    await page.goto(root);
    const map = page.locator('.route-map__interactive').first();
    await expect(map.getByRole('button', { name: 'Show all' })).toBeHidden();
    const plano = map.getByRole('button', { name: /Plano/ });
    await plano.scrollIntoViewIfNeeded();
    await expect(plano).toBeVisible();
    await expect(plano).toBeDisabled();
    expect(
      await plano.evaluate((node) =>
        parseFloat(getComputedStyle(node).fontSize)
      )
    ).toBeGreaterThanOrEqual(14);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  } finally {
    await context.close();
  }
});
